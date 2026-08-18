import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';

const TICK_MS = 60_000; // check every minute
const TIER1_MIN = 15; // nudge the assignee
const TIER2_MIN = 60; // whole-business blast

interface OldestUnreadRow {
  businessId: string;
  phone: string;
  oldestUnreadAt: Date;
}

interface ConvMeta {
  status: 'OPEN' | 'RESOLVED';
  snoozedUntil: Date | null;
  assignedToUserId: string | null;
  lastEscalationTier: number;
}

const DEFAULT_META: ConvMeta = { status: 'OPEN', snoozedUntil: null, assignedToUserId: null, lastEscalationTier: 0 };

/**
 * Periodically nudges staff about WhatsApp conversations that have sat
 * unread too long — a tiered reminder (assignee-specific, then business-wide)
 * matching Front/Zendesk-style unread-SLA escalation. Follows the same
 * setInterval + re-entrancy-guard shape as ScheduledReportsService/
 * OutboxProcessor — this codebase has no @nestjs/schedule dependency.
 */
@Injectable()
export class EscalationCheckerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationCheckerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly events: EventsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(`Escalation checker started (interval ${TICK_MS / 1000}s)`);
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
      this.logger.error(`Escalation tick failed, will retry next cycle: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async checkAll(): Promise<void> {
    const oldestUnread = await this.prisma.$queryRaw<OldestUnreadRow[]>`
      SELECT m."businessId", m.phone, MIN(m."createdAt") AS "oldestUnreadAt"
      FROM wa_message m
      WHERE m.direction = 'INBOUND' AND m."readByStaffAt" IS NULL
      GROUP BY m."businessId", m.phone`;

    if (!oldestUnread.length) return;

    const businessIds = Array.from(new Set(oldestUnread.map(r => r.businessId)));
    const convRows = await this.prisma.waConversation.findMany({
      where: { businessId: { in: businessIds } },
      select: { businessId: true, phone: true, status: true, snoozedUntil: true, assignedToUserId: true, lastEscalationTier: true },
    });
    const metaMap = new Map(convRows.map(r => [`${r.businessId}:${r.phone}`, r as ConvMeta]));

    const now = new Date();
    for (const row of oldestUnread) {
      const meta = metaMap.get(`${row.businessId}:${row.phone}`) ?? DEFAULT_META;
      if (meta.status === 'RESOLVED') continue;
      if (meta.snoozedUntil && meta.snoozedUntil > now) continue;

      const ageMin = (now.getTime() - row.oldestUnreadAt.getTime()) / 60_000;
      const targetTier = ageMin >= TIER2_MIN ? 2 : ageMin >= TIER1_MIN ? 1 : 0;
      if (targetTier === 0 || targetTier <= meta.lastEscalationTier) continue;

      await this.escalate(row.businessId, row.phone, targetTier, meta.assignedToUserId);
    }
  }

  private async escalate(businessId: string, phone: string, tier: number, assignedToUserId: string | null): Promise<void> {
    try {
      if (tier === 1 && assignedToUserId) {
        await this.push.sendToUser(businessId, assignedToUserId, {
          title: '⏰ Still unread',
          body: `+${phone} hasn't been replied to in ${TIER1_MIN} min`,
          phone,
        });
      } else if (tier === 2) {
        await this.push.sendToBusiness(businessId, {
          title: '🚨 Unread message escalation',
          body: `+${phone} still unread after ${TIER2_MIN} min`,
          phone,
        });
      }
      // tier 1 with no assignee: nobody specific to nudge — still record the
      // tier below so it falls through to tier 2's business-wide blast
      // instead of re-checking (and doing nothing) every tick.
    } catch (err) {
      this.logger.warn(`Escalation push failed for ${businessId}/${phone} tier ${tier}: ${err instanceof Error ? err.message : String(err)}`);
    }

    await this.prisma.waConversation.upsert({
      where:  { businessId_phone: { businessId, phone } },
      update: { lastEscalationTier: tier },
      create: { businessId, phone, lastEscalationTier: tier },
    }).catch(() => {});

    try {
      this.events.emitToBusiness(businessId, Events.WA_CONVERSATION_ESCALATED, { phone, tier, assignedToUserId });
    } catch { /* fire-and-forget */ }
  }
}
