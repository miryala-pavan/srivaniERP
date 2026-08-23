import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';

const TICK_MS = 60 * 60_000; // check every hour — reminders don't need unread-SLA-style minute precision

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  openingBalance: any;
  createdAt: Date;
}

/**
 * Periodically evaluates active WaReminderRule rows and auto-sends
 * PAYMENT_OVERDUE / REORDER_DUE reminders. Reuses the existing single-customer
 * sendCreditReminder/sendReorderReminder helpers (whatsapp.service.ts) — this
 * service is purely the trigger/scheduling layer around them. Follows the
 * same setInterval + re-entrancy-guard shape as EscalationCheckerService /
 * CampaignSchedulerService.
 */
@Injectable()
export class ReminderRuleCheckerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderRuleCheckerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(`Reminder rule checker started (interval ${TICK_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.checkAll();
    } catch (err) {
      this.logger.error(`Reminder rule tick failed, will retry next cycle: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async checkAll(): Promise<void> {
    const rules = await this.prisma.waReminderRule.findMany({ where: { isActive: true } });
    for (const rule of rules) {
      try {
        if (rule.triggerType === 'PAYMENT_OVERDUE') {
          await this.runPaymentOverdue(rule.id, rule.businessId, rule.thresholdDays, rule.cooldownDays);
        } else if (rule.triggerType === 'REORDER_DUE') {
          await this.runReorderDue(rule.id, rule.businessId, rule.thresholdDays, rule.cooldownDays);
        }
        await this.prisma.waReminderRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
      } catch (err) {
        this.logger.error(`Reminder rule ${rule.id} (${rule.name}) failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private async recentlySent(ruleId: string, cooldownDays: number): Promise<Set<string>> {
    const cutoff = new Date(Date.now() - cooldownDays * 86_400_000);
    const rows = await this.prisma.waReminderLog.findMany({
      where: { ruleId, sentAt: { gte: cutoff } },
      select: { customerId: true },
    });
    return new Set(rows.map(r => r.customerId));
  }

  private async runPaymentOverdue(ruleId: string, businessId: string, thresholdDays: number, cooldownDays: number): Promise<void> {
    const [customers, billGroups, payGroups, creditGroups, skip] = await Promise.all([
      this.prisma.customer.findMany({
        where: { businessId, whatsappOptIn: true, phone: { not: null } },
        select: { id: true, name: true, phone: true, openingBalance: true, createdAt: true },
      }) as Promise<CustomerRow[]>,
      this.prisma.salesBill.groupBy({
        by: ['customerId'],
        where: { businessId, saleType: 'CREDIT' as any, status: 'FINAL' as any },
        _sum: { balanceAmount: true },
        _max: { billDate: true },
      }),
      this.prisma.customerPayment.groupBy({
        by: ['customerId'],
        where: { businessId },
        _sum: { amount: true },
        _max: { paymentDate: true },
      }),
      this.prisma.creditNote.groupBy({
        by: ['customerId'],
        where: { businessId },
        _sum: { totalAmount: true },
      }),
      this.recentlySent(ruleId, cooldownDays),
    ]);

    const billMap = new Map(billGroups.map((g: any) => [g.customerId, { sum: Number(g._sum.balanceAmount ?? 0), last: g._max.billDate as Date | null }]));
    const payMap  = new Map(payGroups.map((g: any) => [g.customerId, { sum: Number(g._sum.amount ?? 0), last: g._max.paymentDate as Date | null }]));
    const cnMap   = new Map(creditGroups.map((g: any) => [g.customerId, Number(g._sum.totalAmount ?? 0)]));

    const cutoffMs = Date.now() - thresholdDays * 86_400_000;

    for (const c of customers) {
      if (!c.phone || skip.has(c.id)) continue;
      const bill = billMap.get(c.id);
      const pay = payMap.get(c.id);
      const outstanding = Number(c.openingBalance) + (bill?.sum ?? 0) - (pay?.sum ?? 0) - (cnMap.get(c.id) ?? 0);
      if (outstanding <= 0) continue;

      const lastActivity = [bill?.last, pay?.last, c.createdAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
      if (lastActivity.getTime() > cutoffMs) continue; // not overdue enough yet

      // sendCreditReminder is fire-and-forget (Promise<void>) — actual
      // delivery success/failure is already tracked per-message on WaMessage
      // via logAndSend, same as every other outbound send. waSent here just
      // means "this rule fired for this customer" for cooldown/audit purposes.
      // Wrapped per-customer so one throw (network blip, bad phone format)
      // can't abort the rest of the batch — without this, everyone after
      // the failing customer in this tick got silently skipped until the
      // next hourly run.
      try {
        await this.whatsapp.sendCreditReminder(businessId, {
          customerName: c.name, customerPhone: c.phone, amountDue: outstanding,
        });
        await this.prisma.waReminderLog.create({
          data: { ruleId, businessId, customerId: c.id, waSent: true },
        });
      } catch (err) {
        this.logger.error(`Credit reminder failed for customer ${c.id}: ${err}`);
      }
    }
  }

  private async runReorderDue(ruleId: string, businessId: string, thresholdDays: number, cooldownDays: number): Promise<void> {
    const [candidates, skip] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; phone: string; name: string }[]>`
        SELECT c.id, c.phone, c.name FROM customer c
        WHERE c."businessId" = ${businessId}
          AND c."whatsappOptIn" = true
          AND c.phone IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM online_order o
            WHERE o."customerPhone" = c.phone AND o."businessId" = ${businessId}
              AND o."createdAt" > NOW() - (${thresholdDays} || ' days')::interval
          )`,
      this.recentlySent(ruleId, cooldownDays),
    ]);

    for (const c of candidates) {
      if (skip.has(c.id)) continue;
      try {
        await this.whatsapp.sendReorderReminder(businessId, {
          customerName: c.name, customerPhone: c.phone,
        });
        await this.prisma.waReminderLog.create({
          data: { ruleId, businessId, customerId: c.id, waSent: true },
        });
      } catch (err) {
        this.logger.error(`Reorder reminder failed for customer ${c.id}: ${err}`);
      }
    }
  }
}
