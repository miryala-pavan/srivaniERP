export interface DomainEvent {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  businessId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
}
