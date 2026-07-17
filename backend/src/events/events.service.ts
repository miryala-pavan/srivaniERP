import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private gateway: EventsGateway) {}

  emitToBusiness(businessId: string, event: string, payload: any) {
    try {
      if (!this.gateway.server) return;
      this.gateway.server
        .to(`business:${businessId}`)
        .emit(event, payload);
    } catch (err) {
      this.logger.error(`emitToBusiness failed for ${event}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
