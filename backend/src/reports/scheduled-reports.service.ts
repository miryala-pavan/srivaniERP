import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { EmailService } from '../notifications/email.service';

const TICK_MS = 60_000; // check every minute
const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export const REPORT_TYPES = [
  'DAY_BOOK',
  'SALES_BY_CATEGORY',
  'PAYMENT_MODES',
  'EXPENSES',
  'PURCHASES',
] as const;

export interface ScheduleInput {
  name: string;
  reportType: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  sendAt: string;        // "HH:mm" IST
  weekday?: number;      // 0-6 (WEEKLY)
  dayOfMonth?: number;   // 1-28 (MONTHLY)
  channel: 'WHATSAPP' | 'EMAIL';
  recipient: string;
}

/** Now, expressed in IST wall-clock via UTC getters. */
function nowIst(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}
function istDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));

@Injectable()
export class ScheduledReportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledReportsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(`Scheduled reports runner started (interval ${TICK_MS / 1000}s, IST)`);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  list(businessId: string) {
    return this.prisma.scheduledReport.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(businessId: string, input: ScheduleInput, createdBy?: string) {
    this.validate(input);
    return this.prisma.scheduledReport.create({
      data: { businessId, ...this.clean(input), createdBy },
    });
  }

  async update(businessId: string, id: string, input: Partial<ScheduleInput> & { isActive?: boolean }) {
    const existing = await this.prisma.scheduledReport.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Schedule not found');
    const merged = { ...existing, ...input } as ScheduleInput;
    this.validate(merged);
    return this.prisma.scheduledReport.update({
      where: { id },
      data: { ...this.clean(merged), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
    });
  }

  async remove(businessId: string, id: string) {
    const existing = await this.prisma.scheduledReport.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Schedule not found');
    await this.prisma.scheduledReport.delete({ where: { id } });
    return { deleted: true };
  }

  /** Manual "send test now" — runs the schedule immediately regardless of time. */
  async runNow(businessId: string, id: string) {
    const s = await this.prisma.scheduledReport.findFirst({ where: { id, businessId } });
    if (!s) throw new NotFoundException('Schedule not found');
    await this.execute(s);
    return this.prisma.scheduledReport.findUnique({ where: { id } });
  }

  private validate(input: ScheduleInput) {
    if (!REPORT_TYPES.includes(input.reportType as any))
      throw new BadRequestException(`reportType must be one of ${REPORT_TYPES.join(', ')}`);
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(input.frequency))
      throw new BadRequestException('frequency must be DAILY, WEEKLY or MONTHLY');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.sendAt))
      throw new BadRequestException('sendAt must be HH:mm (24h, IST)');
    if (input.frequency === 'WEEKLY' && (input.weekday == null || input.weekday < 0 || input.weekday > 6))
      throw new BadRequestException('weekday (0=Sun … 6=Sat) required for WEEKLY');
    if (input.frequency === 'MONTHLY' && (input.dayOfMonth == null || input.dayOfMonth < 1 || input.dayOfMonth > 28))
      throw new BadRequestException('dayOfMonth (1–28) required for MONTHLY');
    if (!['WHATSAPP', 'EMAIL'].includes(input.channel))
      throw new BadRequestException('channel must be WHATSAPP or EMAIL');
    if (input.channel === 'EMAIL' && !/^\S+@\S+\.\S+$/.test(input.recipient))
      throw new BadRequestException('recipient must be a valid email address');
    if (input.channel === 'WHATSAPP' && !/\d{10}/.test(input.recipient.replace(/\D/g, '')))
      throw new BadRequestException('recipient must be a valid 10-digit phone number');
    if (!input.name?.trim()) throw new BadRequestException('name is required');
  }

  private clean(input: ScheduleInput) {
    return {
      name: input.name.trim(),
      reportType: input.reportType,
      frequency: input.frequency,
      sendAt: input.sendAt,
      weekday: input.frequency === 'WEEKLY' ? input.weekday : null,
      dayOfMonth: input.frequency === 'MONTHLY' ? input.dayOfMonth : null,
      channel: input.channel,
      recipient: input.recipient.trim(),
    };
  }

  // ── Runner ────────────────────────────────────────────────────────────────

  async tick(): Promise<void> {
    if (this.running) return; // skip overlapping ticks
    this.running = true;
    try {
      const ist = nowIst();
      const hhmm = ist.toISOString().slice(11, 16);
      const todayIst = istDateStr(ist);
      const weekday = ist.getUTCDay();
      const dom = ist.getUTCDate();

      const due = await this.prisma.scheduledReport.findMany({ where: { isActive: true } });

      for (const s of due) {
        // Frequency gate for today
        if (s.frequency === 'WEEKLY'  && s.weekday    !== weekday) continue;
        if (s.frequency === 'MONTHLY' && s.dayOfMonth !== dom)     continue;
        // Time gate: due once IST clock passes sendAt
        if (hhmm < s.sendAt) continue;
        // Once-per-period gate: skip if already ran today (IST)
        if (s.lastRunAt && istDateStr(new Date(s.lastRunAt.getTime() + IST_OFFSET_MS)) === todayIst) continue;

        await this.execute(s);
      }
    } catch (err) {
      this.logger.error(`Scheduled reports tick failed: ${err}`);
    } finally {
      this.running = false;
    }
  }

  private async execute(s: {
    id: string; businessId: string; name: string; reportType: string;
    frequency: string; channel: string; recipient: string;
  }): Promise<void> {
    try {
      const { text, html, subject } = await this.render(s.businessId, s.reportType, s.frequency);
      if (s.channel === 'WHATSAPP') await this.whatsapp.sendTextMessage(s.recipient, text);
      else await this.email.sendReportEmail(s.recipient, subject, html);

      await this.prisma.scheduledReport.update({
        where: { id: s.id },
        data: { lastRunAt: new Date(), lastStatus: 'SENT', lastError: null },
      });
      this.logger.log(`Scheduled report "${s.name}" sent via ${s.channel} to ${s.recipient}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.prisma.scheduledReport.update({
        where: { id: s.id },
        data: { lastRunAt: new Date(), lastStatus: 'FAILED', lastError: msg.slice(0, 500) },
      });
      this.logger.error(`Scheduled report "${s.name}" failed: ${msg}`);
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /** Reporting window by frequency: DAILY = yesterday; WEEKLY = last 7 days
   *  ending yesterday; MONTHLY = previous calendar month. All IST. */
  private window(frequency: string): { startDate: string; endDate: string; label: string } {
    const ist = nowIst();
    const day = (offset: number) => {
      const d = new Date(ist); d.setUTCDate(d.getUTCDate() + offset);
      return istDateStr(d);
    };
    if (frequency === 'WEEKLY') {
      return { startDate: day(-7), endDate: day(-1), label: `${day(-7)} → ${day(-1)}` };
    }
    if (frequency === 'MONTHLY') {
      const first = new Date(ist); first.setUTCMonth(first.getUTCMonth() - 1, 1);
      const last  = new Date(ist); last.setUTCDate(0);
      return { startDate: istDateStr(first), endDate: istDateStr(last), label: istDateStr(first).slice(0, 7) };
    }
    return { startDate: day(-1), endDate: day(-1), label: day(-1) };
  }

  private async render(businessId: string, reportType: string, frequency: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    const bizName = biz?.name ?? 'Your Store';
    const w = this.window(frequency);
    const lines: string[] = [];
    let title = '';

    switch (reportType) {
      case 'DAY_BOOK': {
        const d = await this.reports.getDayBook(businessId, w.endDate);
        title = `Day Book — ${w.endDate}`;
        lines.push(
          `Money In: ₹${inr(d.dayBook.totalIn)}   Money Out: ₹${inr(d.dayBook.totalOut)}`,
          `Sales: ₹${inr(d.dayBook.salesTotal)}   Receipts: ₹${inr(d.dayBook.receiptsTotal)}`,
          `Expenses: ₹${inr(d.dayBook.expenseTotal)}   Supplier Pmts: ₹${inr(d.dayBook.supplierTotal)}`,
          `Cash: opening ₹${inr(d.cashBook.openingCash)} → expected closing ₹${inr(d.cashBook.expectedClosing)}`,
          `${d.entries.length} transactions`,
        );
        break;
      }
      case 'SALES_BY_CATEGORY': {
        const d = await this.reports.getSalesByCategory(businessId, w);
        title = `Sales by Category — ${w.label}`;
        lines.push(`Total revenue: ₹${inr(d.summary.totalRevenue)} across ${d.summary.categoryCount} categories`);
        for (const c of d.categories.slice(0, 5)) {
          lines.push(`• ${c.categoryName}: ₹${inr(c.totalRevenue)} (${c.revenuePct}%)`);
        }
        break;
      }
      case 'PAYMENT_MODES': {
        const d = await this.reports.getSalesByPaymentMode(businessId, w);
        title = `Payment Modes — ${w.label}`;
        lines.push(`Collected: ₹${inr(d.summary.totalAmount)} over ${d.summary.totalBills} bills`);
        for (const m of d.modes) {
          lines.push(`• ${m.paymentMode}: ₹${inr(m.totalAmount)} (${m.pct}%)`);
        }
        break;
      }
      case 'EXPENSES': {
        const d = await this.reports.getExpenseReport(businessId, w);
        title = `Expenses — ${w.label}`;
        lines.push(`Total: ₹${inr(d.summary.totalAmount)} in ${d.summary.count} entries`);
        for (const c of d.byCategory.slice(0, 5)) {
          lines.push(`• ${c.category}: ₹${inr(c.total)}`);
        }
        break;
      }
      case 'PURCHASES': {
        const d = await this.reports.getPurchaseRegister(businessId, w);
        title = `Purchases — ${w.label}`;
        lines.push(
          `${d.summary.count} GRNs, grand total ₹${inr(d.summary.grandTotal)}`,
          `Approved: ${d.summary.approved}   Pending approval: ${d.summary.pending}`,
        );
        break;
      }
      default:
        throw new BadRequestException(`Unknown reportType ${reportType}`);
    }

    const text = `📊 ${title}\n${bizName}\n\n${lines.join('\n')}\n\n— Automated report`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#1B4F8A;margin-bottom:2px">${title}</h2>
        <p style="color:#666;margin-top:0">${bizName}</p>
        <ul style="line-height:1.8;color:#333;padding-left:18px">
          ${lines.map(l => `<li>${l.replace(/^• /, '')}</li>`).join('')}
        </ul>
        <p style="color:#999;font-size:12px">Automated report — manage schedules in your ERP under Reports → Scheduled Reports.</p>
      </div>`;
    return { text, html, subject: `${title} · ${bizName}` };
  }
}
