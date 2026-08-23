import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TdsSection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RuleEngineService } from '../platform/rule-engine/rule-engine.service';

export interface TdsComputationInput {
  section: string;        // 194J | 194C | 194I | 194H | 194A …
  grossAmount: number;
  partyPan?: string;
  partyType?: 'INDIVIDUAL' | 'COMPANY' | 'HUF' | 'FIRM';
  isLowerDeductionCert?: boolean;
  lowerDeductionRate?: number;
}

export interface TdsComputationResult {
  section: string;
  grossAmount: number;
  tdsRate: number;
  tdsAmount: number;
  netAmount: number;
  surcharge: number;
  cess: number;
  totalTds: number;
  rulesApplied: string[];
}

// Bare-digit section codes matching the real TdsSection enum (S192, S194A, ...)
// minus the leading "S". Kept bare here because Supplier.tdsSection is a plain
// string documented/entered without the "S" (e.g. "194C"), while TdsEntry.section
// is the strict Prisma enum WITH the "S" prefix -- normalizeSection() below
// bridges the two so callers can pass either form.
const TDS_SECTIONS = ['192', '194A', '194C', '194D', '194H', '194I', '194IB', '194J', '194LA', '194M', '194N', '194Q', 'OTHER'];

function normalizeSection(section: string): string {
  return section.replace(/^S/i, '');
}

@Injectable()
export class TdsService {
  private readonly logger = new Logger(TdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  async computeTds(
    businessId: string,
    rawInput: TdsComputationInput,
  ): Promise<TdsComputationResult> {
    const input = { ...rawInput, section: normalizeSection(rawInput.section) };
    if (!TDS_SECTIONS.includes(input.section))
      throw new BadRequestException(`Unknown TDS section: ${input.section}`);

    // If deductee has lower deduction certificate, use that rate
    if (input.isLowerDeductionCert && input.lowerDeductionRate !== undefined) {
      const tdsAmount = round4(input.grossAmount * input.lowerDeductionRate);
      return {
        section: input.section,
        grossAmount: input.grossAmount,
        tdsRate: input.lowerDeductionRate,
        tdsAmount,
        netAmount: round4(input.grossAmount - tdsAmount),
        surcharge: 0,
        cess: 0,
        totalTds: tdsAmount,
        rulesApplied: ['LOWER_DEDUCTION_CERT'],
      };
    }

    // No PAN → 20% flat (Sec 206AA)
    if (!input.partyPan || input.partyPan.trim().length < 10) {
      const tdsRate = 0.2;
      const tdsAmount = round4(input.grossAmount * tdsRate);
      return {
        section: input.section,
        grossAmount: input.grossAmount,
        tdsRate,
        tdsAmount,
        netAmount: round4(input.grossAmount - tdsAmount),
        surcharge: 0,
        cess: 0,
        totalTds: tdsAmount,
        rulesApplied: ['SEC_206AA_NO_PAN'],
      };
    }

    const ruleSetCode = `TDS_${input.section}`;
    const result = await this.ruleEngine.evaluate({
      businessId,
      ruleSetCode,
      inputs: {
        grossAmount: input.grossAmount,
        partyType: input.partyType ?? 'COMPANY',
        section: input.section,
      },
    });

    const tdsRate = Number((result.output as any).tdsRate ?? 0);
    const tdsAmountFromEngine = (result.output as any).tdsAmount;
    const tdsAmount = tdsAmountFromEngine != null
      ? Number(tdsAmountFromEngine)
      : round4(input.grossAmount * tdsRate);
    const surcharge = 0; // surcharge applies only for high-income individuals; feature-ready
    const cess = round4(tdsAmount * 0.04); // Health & Education Cess 4%
    const totalTds = round4(tdsAmount + cess);

    return {
      section: input.section,
      grossAmount: input.grossAmount,
      tdsRate,
      tdsAmount: round4(tdsAmount),
      netAmount: round4(input.grossAmount - totalTds),
      surcharge,
      cess,
      totalTds,
      rulesApplied: result.firedRules.map((r) => r.ruleId),
    };
  }

  async getLedger(businessId: string, financialYear?: string, section?: string) {
    const sectionEnum = section ? (section as TdsSection) : undefined;
    return this.prisma.tdsEntry.findMany({
      where: {
        businessId,
        ...(financialYear ? { financialYear } : {}),
        ...(sectionEnum ? { section: sectionEnum } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLedgerEntry(id: string, businessId: string) {
    const e = await this.prisma.tdsEntry.findFirst({ where: { id, businessId } });
    if (!e) throw new NotFoundException('TDS entry not found');
    return e;
  }

  /**
   * Applies computeTds() to an existing entry and saves the result. For
   * auto-created stub entries (0% rate, deductee has a PAN) this is what
   * actually fills in the real Rule Engine rate — computeTds() alone only
   * calculates a hypothetical result, it never touches stored entries.
   */
  async recomputeLedgerEntry(businessId: string, id: string) {
    const entry = await this.prisma.tdsEntry.findFirst({ where: { id, businessId } });
    if (!entry) throw new NotFoundException('TDS entry not found');

    const result = await this.computeTds(businessId, {
      section: entry.section,
      grossAmount: Number(entry.paymentAmount),
      partyPan: entry.deducteePan ?? undefined,
    });

    return this.prisma.tdsEntry.update({
      where: { id },
      data: {
        tdsRatePct: result.tdsRate * 100,
        tdsAmount: result.tdsAmount,
        cess: result.cess,
        totalTdsAmount: result.totalTds,
        remarks: `Rate computed: ${result.rulesApplied.join(', ') || 'default'}.`,
      },
    });
  }

  async recordChallan(
    businessId: string,
    data: {
      financialYear: string;
      quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
      section: string;
      amountDeducted: number;
      amountDeposited: number;
      interest?: number;
      lateFee?: number;
      bsrCode?: string;
      challanSerial?: string;
      depositedAt?: Date;
    },
  ) {
    return this.prisma.tdsChallan.create({
      data: {
        businessId,
        financialYear: data.financialYear,
        quarter: data.quarter,
        section: data.section,
        amountDeducted: new Decimal(data.amountDeducted),
        amountDeposited: new Decimal(data.amountDeposited),
        interest: new Decimal(data.interest ?? 0),
        lateFee: new Decimal(data.lateFee ?? 0),
        bsrCode: data.bsrCode,
        challanSerial: data.challanSerial,
        depositedAt: data.depositedAt ?? new Date(),
      },
    });
  }

  async listChallans(businessId: string, financialYear?: string) {
    return this.prisma.tdsChallan.findMany({
      where: { businessId, ...(financialYear ? { financialYear } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSummary(businessId: string) {
    const entries = await this.prisma.tdsEntry.findMany({ where: { businessId } });
    const challans = await this.prisma.tdsChallan.findMany({ where: { businessId } });

    const totalDeducted = entries.reduce((s, e) => s + Number(e.tdsAmount), 0);
    const totalDeposited = challans.reduce((s, c) => s + Number(c.amountDeposited), 0);
    const outstanding = round4(totalDeducted - totalDeposited);

    // Group by section
    const bySectionMap: Record<string, { deducted: number; deposited: number }> = {};
    for (const e of entries) {
      const key = String(e.section);
      bySectionMap[key] = bySectionMap[key] ?? { deducted: 0, deposited: 0 };
      bySectionMap[key].deducted += Number(e.tdsAmount);
    }
    for (const c of challans) {
      const key = String(c.section);
      bySectionMap[key] = bySectionMap[key] ?? { deducted: 0, deposited: 0 };
      bySectionMap[key].deposited += Number(c.amountDeposited);
    }
    const bySection = Object.entries(bySectionMap).map(([section, v]) => ({
      section,
      deducted: round4(v.deducted),
      deposited: round4(v.deposited),
      outstanding: round4(v.deducted - v.deposited),
    }));

    return {
      totalDeducted: round4(totalDeducted),
      totalDeposited: round4(totalDeposited),
      outstanding,
      bySection,
    };
  }

  async getForm26QData(businessId: string, financialYear: string, quarter: string) {
    // Determine date range for the quarter within the financial year
    const fy = financialYear; // e.g. "2025-26"
    const startYear = Number(fy.split('-')[0]);
    const quarterDates: Record<string, [Date, Date]> = {
      Q1: [new Date(`${startYear}-04-01`), new Date(`${startYear}-06-30`)],
      Q2: [new Date(`${startYear}-07-01`), new Date(`${startYear}-09-30`)],
      Q3: [new Date(`${startYear}-10-01`), new Date(`${startYear}-12-31`)],
      Q4: [new Date(`${startYear + 1}-01-01`), new Date(`${startYear + 1}-03-31`)],
    };
    const [from, to] = quarterDates[quarter] ?? [new Date(0), new Date()];

    const entries = await this.prisma.tdsEntry.findMany({
      where: {
        businessId,
        financialYear,
        paymentDate: { gte: from, lte: to },
      },
    });

    // Group by deductee PAN for 26Q deductee-wise rows
    const byPan: Record<
      string,
      { pan: string; name: string; section: string; gross: number; tds: number; count: number }
    > = {};

    for (const e of entries) {
      const pan = e.deducteePan ?? 'PANNOTAVBL';
      byPan[pan] = byPan[pan] ?? {
        pan,
        name: e.deducteeName ?? 'Unknown',
        section: String(e.section),
        gross: 0,
        tds: 0,
        count: 0,
      };
      byPan[pan].gross += Number(e.paymentAmount);
      byPan[pan].tds += Number(e.tdsAmount);
      byPan[pan].count += 1;
    }

    return {
      financialYear,
      quarter,
      deductees: Object.values(byPan).map((d) => ({
        ...d,
        gross: round4(d.gross),
        tds: round4(d.tds),
      })),
      totalTdsDeducted: round4(entries.reduce((s, e) => s + Number(e.tdsAmount), 0)),
      _meta: { note: 'TRACES 2.0 API filing is feature-ready (Phase 2)' },
    };
  }

  async listSections(_businessId: string) {
    const ruleSets = await this.prisma.ruleSet.findMany({
      where: { code: { startsWith: 'TDS_' } },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    });

    return ruleSets.map((rs) => ({
      section: rs.code.replace('TDS_', ''),
      ruleSet: rs.code,
      description: rs.name,
    }));
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
