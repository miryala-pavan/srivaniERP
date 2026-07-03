import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotently record that an event has been received.
   * Returns true if this is a new (not-yet-processed) event.
   */
  async receive(eventId: string, eventType: string, businessId: string): Promise<boolean> {
    const existing = await this.prisma.inboxEvent.findFirst({
      where: { eventId, businessId },
    });

    if (existing) {
      this.logger.debug(`Duplicate event ignored: ${eventId}`);
      return false;
    }

    await this.prisma.inboxEvent.create({
      data: { eventId, eventType, businessId, status: 'RECEIVED' },
    });
    return true;
  }

  async markProcessed(eventId: string, businessId: string): Promise<void> {
    await this.prisma.inboxEvent.updateMany({
      where: { eventId, businessId },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  }

  async markFailed(eventId: string, businessId: string, error: string): Promise<void> {
    await this.prisma.inboxEvent.updateMany({
      where: { eventId, businessId },
      data: { status: 'FAILED', error },
    });
  }
}
