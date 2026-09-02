import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private gateway: EventsGateway) {}

  emitToBusiness(businessId: string, event: string, payload: any) {
    this.emitToRoom(`business:${businessId}`, event, payload);
  }

  /** Generic room emit — used for the per-rider (`rider:<id>`) and per-delivery (`delivery:<id>`) rooms. */
  emitToRoom(room: string, event: string, payload: any) {
    try {
      if (!this.gateway.server) return;
      this.gateway.server.to(room).emit(event, payload);
    } catch (err) {
      this.logger.error(`emitToRoom(${room}) failed for ${event}: ${err instanceof Error ? err.message : err}`);
    }
  }
}
