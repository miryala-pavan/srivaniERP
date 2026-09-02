import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { DeliverySettingsService } from './delivery-settings.service';
import { DeliveryDispatchService } from './delivery-dispatch.service';

const TICK_MS = 60_000;
// Not business-configurable (unlike the other thresholds) — this is an
// operational safety net, not a tunable dispatch-speed knob.
const STUCK_IN_TRANSIT_MINUTES = 45;

/**
 * No-accept escalation ladder + stuck-in-transit flagging. Same
 * setInterval + re-entrancy-guard shape as CampaignSchedulerService — see
 * that file's comment for why this codebase avoids @nestjs/schedule.
 */
@Injectable()
export class DeliveryEscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryEscalationService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly events: EventsService,
    private readonly settings: DeliverySettingsService,
    private readonly dispatch: DeliveryDispatchService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(`Delivery escalation checker started (interval ${TICK_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.checkBroadcasting();
      await this.checkStuckInTransit();
    } catch (err) {
      this.logger.error(`Escalation tick failed, will retry next cycle: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async checkBroadcasting(): Promise<void> {
    const deliveries = await this.prisma.delivery.findMany({ where: { status: 'BROADCASTING' } });
    if (!deliveries.length) return;

    const settingsCache = new Map<string, Awaited<ReturnType<DeliverySettingsService['getAll']>>>();
    const now = Date.now();

    for (const delivery of deliveries) {
      let settings = settingsCache.get(delivery.businessId);
      if (!settings) {
        settings = await this.settings.getAll(delivery.businessId);
        settingsCache.set(delivery.businessId, settings);
      }
      const ageMinutes = (now - delivery.createdAt.getTime()) / 60000;

      if (delivery.broadcastRound === 1 && ageMinutes >= settings.rebroadcastMinutes) {
        await this.dispatch.broadcast(delivery.id, 2).catch(err =>
          this.logger.error(`Re-broadcast failed for delivery ${delivery.id}: ${err instanceof Error ? err.message : err}`));
      }

      if (!delivery.escalatedAt && ageMinutes >= settings.staffAlertMinutes) {
        await this.prisma.delivery.update({ where: { id: delivery.id }, data: { escalatedAt: new Date() } });
        await this.prisma.deliveryEvent.create({ data: { deliveryId: delivery.id, type: 'ESCALATED' } });
        this.events.emitToBusiness(delivery.businessId, Events.DELIVERY_ESCALATED, { deliveryId: delivery.id });

        if (settings.managerAlertPhone) {
          this.whatsapp.sendTextMessage(
            delivery.businessId, settings.managerAlertPhone,
            `⚠️ Delivery ${delivery.id} has no rider after ${settings.staffAlertMinutes} min — please assign manually.`,
          ).catch(err => this.logger.error(`Manager alert failed for delivery ${delivery.id}: ${err instanceof Error ? err.message : err}`));
        }
      }
    }
  }

  private async checkStuckInTransit(): Promise<void> {
    const cutoff = new Date(Date.now() - STUCK_IN_TRANSIT_MINUTES * 60000);
    const stuck = await this.prisma.delivery.findMany({
      where: { status: 'ASSIGNED', assignedAt: { lte: cutoff } },
    });

    for (const delivery of stuck) {
      const alreadyFlagged = await this.prisma.deliveryEvent.findFirst({
        where: { deliveryId: delivery.id, type: 'STUCK_IN_TRANSIT_FLAGGED' },
      });
      if (alreadyFlagged) continue;

      await this.prisma.deliveryEvent.create({ data: { deliveryId: delivery.id, type: 'STUCK_IN_TRANSIT_FLAGGED' } });
      this.events.emitToBusiness(delivery.businessId, Events.DELIVERY_ESCALATED, { deliveryId: delivery.id });
    }
  }
}
