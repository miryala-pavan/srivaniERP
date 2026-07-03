import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainClock } from '../clock/clock.interface';
import { RuleContext, RuleResult, FiredRule } from './rule-engine.interface';

interface RuleCondition {
  op?: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value?: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: DomainClock,
  ) {}

  async evaluate(context: RuleContext): Promise<RuleResult> {
    return this.evaluateAt(context, context.asOf ?? this.clock.now());
  }

  async evaluateAt(context: RuleContext, asOf: Date): Promise<RuleResult> {
    const ruleSet = await this.prisma.ruleSet.findFirst({
      where: {
        code: context.ruleSetCode,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      include: {
        rules: { orderBy: { priority: 'asc' } },
        authority: true,
      },
    });

    if (!ruleSet) {
      throw new NotFoundException(
        `RuleSet '${context.ruleSetCode}' not found for date ${asOf.toISOString()}`,
      );
    }

    // Check for business-level override
    const override = await this.prisma.businessRuleOverride.findFirst({
      where: {
        businessId: context.businessId,
        ruleSetCode: context.ruleSetCode,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
    });

    const rules = override
      ? [{ ...override, id: override.id, priority: -1, condition: {}, ruleSetId: ruleSet.id }]
      : ruleSet.rules;

    const firedRules: FiredRule[] = [];
    const output: Record<string, unknown> = {};

    for (const rule of rules) {
      const condition = rule.condition as Record<string, unknown>;
      if (this.matchesCondition(condition, context.inputs)) {
        firedRules.push({
          ruleId: rule.id,
          priority: rule.priority,
          condition,
          effect: rule.effect as Record<string, unknown>,
        });
        Object.assign(output, rule.effect as Record<string, unknown>);
      }
    }

    // Compute derived output
    this.deriveOutput(context, output);

    return {
      ruleSetCode: context.ruleSetCode,
      firedRules,
      output,
      explanation: this.buildExplanation(context, ruleSet.authority.name, firedRules, output),
      confidence: 1.0,
      computedAt: this.clock.now(),
      ruleSnapshotVersion: ruleSet.version,
    };
  }

  explain(result: RuleResult): string {
    return result.explanation;
  }

  private matchesCondition(
    condition: Record<string, unknown>,
    inputs: Record<string, unknown>,
  ): boolean {
    for (const [key, condValue] of Object.entries(condition)) {
      const inputValue = inputs[key];

      if (condValue === null || condValue === undefined) continue;

      if (typeof condValue === 'object' && !Array.isArray(condValue)) {
        const cond = condValue as RuleCondition;

        // Range check: { from, to }
        if (cond.from !== undefined && cond.to !== undefined) {
          const num = Number(inputValue);
          if (num < cond.from || num > cond.to) return false;
          continue;
        }

        // Operator check: { op, value }
        if (cond.op !== undefined && cond.value !== undefined) {
          const num = Number(inputValue);
          const threshold = cond.value;
          switch (cond.op) {
            case 'lt': if (!(num < threshold)) return false; break;
            case 'lte': if (!(num <= threshold)) return false; break;
            case 'gt': if (!(num > threshold)) return false; break;
            case 'gte': if (!(num >= threshold)) return false; break;
            case 'eq': if (num !== threshold) return false; break;
          }
          continue;
        }
      }

      // Empty object = catch-all, always matches
      if (typeof condValue === 'object' && Object.keys(condValue as object).length === 0) {
        continue;
      }

      // Exact equality
      if (inputValue !== condValue) return false;
    }
    return true;
  }

  private deriveOutput(context: RuleContext, output: Record<string, unknown>): void {
    // Compute TDS amount if rate and amount are available
    if (output.rate !== undefined && context.inputs.amount !== undefined && !output.exempt) {
      const amount = Number(context.inputs.amount);
      const rate = Number(output.rate);
      output.tdsAmount = Math.round(amount * rate * 100) / 100;
      output.netAmount = Math.round((amount - (output.tdsAmount as number)) * 100) / 100;
    }

    // If exempt, zero out amounts
    if (output.exempt === true) {
      output.tdsAmount = 0;
      output.netAmount = context.inputs.amount;
    }
  }

  private buildExplanation(
    context: RuleContext,
    authorityName: string,
    firedRules: FiredRule[],
    output: Record<string, unknown>,
  ): string {
    if (firedRules.length === 0) {
      return `No rules matched for ${context.ruleSetCode}`;
    }

    const parts: string[] = [`[${context.ruleSetCode}] Authority: ${authorityName}.`];

    if (output.exempt) {
      parts.push(`Exempt — threshold not met.`);
    } else if (output.rate !== undefined) {
      const ratePercent = (Number(output.rate) * 100).toFixed(0);
      if (context.inputs.amount) {
        parts.push(
          `Rate ${ratePercent}% on ₹${Number(context.inputs.amount).toLocaleString('en-IN')} = ₹${Number(output.tdsAmount ?? 0).toLocaleString('en-IN')}.`,
        );
      } else {
        parts.push(`Rate ${ratePercent}%.`);
      }
    }

    if (output.disallowed) {
      parts.push(`Disallowed: ${output.reason as string}`);
    }

    return parts.join(' ');
  }
}
