import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

const OUTBOX_QUEUE = 'domain-events';
const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 50;
const MAX_RETRIES = 5;

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private queue: Queue;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const url = new URL(redisUrl);

    this.queue = new Queue(OUTBOX_QUEUE, {
      connection: {
        host: url.hostname,
        port: Number(url.port ?? 6379),
        password: url.password || undefined,
      },
    });

    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    this.logger.log(`Outbox processor started (interval ${POLL_INTERVAL_MS}ms)`);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.queue?.close();
  }

  async poll(): Promise<void> {
    const events = await this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING', retryCount: { lt: MAX_RETRIES } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    if (!events.length) return;

    for (const event of events) {
      try {
        await this.queue.add(
          event.eventType,
          {
            eventId: event.id,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            eventType: event.eventType,
            payload: event.payload,
            businessId: event.businessId,
            correlationId: event.correlationId,
            causationId: event.causationId,
          },
          {
            jobId: event.id,       // idempotency: same job id = deduped
            removeOnComplete: true,
            removeOnFail: false,
          },
        );

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            retryCount: { increment: 1 },
            error,
            status: event.retryCount + 1 >= MAX_RETRIES ? 'FAILED' : 'PENDING',
          },
        });
        this.logger.error(`Failed to publish outbox event ${event.id}: ${error}`);
      }
    }
  }
}
