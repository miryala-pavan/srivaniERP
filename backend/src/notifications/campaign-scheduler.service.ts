import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from './whatsapp.service';

const TICK_MS = 60_000; // check every minute

/**
 * Periodically dispatches WaCampaign rows whose scheduledAt has arrived.
 * Follows the same setInterval + re-entrancy-guard shape as
 * EscalationCheckerService — this codebase has no @nestjs/schedule
 * dependency, and BullMQ (used only for Google Contacts sync) needs a
 * REDIS_URL that isn't guaranteed to be set, so this avoids that dependency.
 */
@Injectable()
export class CampaignSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(`Campaign scheduler started (interval ${TICK_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.dispatchDue();
    } catch (err) {
      this.logger.error(`Campaign scheduler tick failed, will retry next cycle: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async dispatchDue(): Promise<void> {
    const due = await this.prisma.waCampaign.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    });
    if (!due.length) return;

    for (const campaign of due) {
      // Claim it first (SENDING) so a slow send doesn't get double-picked-up
      // by the next tick if this one runs long.
      const claimed = await this.prisma.waCampaign.updateMany({
        where: { id: campaign.id, status: 'SCHEDULED' },
        data: { status: 'SENDING' },
      });
      if (claimed.count === 0) continue; // already claimed elsewhere

      try {
        const result = await this.whatsapp.sendScheduledCampaign(campaign.businessId, {
          id: campaign.id,
          segmentId: campaign.segmentId,
          customerIds: campaign.customerIds,
          templateName: campaign.templateName,
          language: campaign.language,
          params: campaign.params,
        });
        await this.prisma.waCampaign.update({
          where: { id: campaign.id },
          data: {
            status: 'SENT',
            totalCount: result.total,
            sentCount: result.sent,
            failedCount: result.failed,
            sentAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.error(`Campaign ${campaign.id} failed to send: ${err instanceof Error ? err.message : String(err)}`);
        await this.prisma.waCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' },
        }).catch(() => {});
      }
    }
  }
}
