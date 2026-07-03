import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent } from './interfaces/domain-event.interface';

@Injectable()
export class OutboxService {
  /**
   * Enqueue a domain event inside an existing Prisma transaction.
   * Always call this inside a $transaction — never standalone.
   */
  async publish(
    tx: Prisma.TransactionClient,
    event: DomainEvent,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        businessId: event.businessId,
        correlationId: event.correlationId,
        causationId: event.causationId,
      },
    });
  }
}
