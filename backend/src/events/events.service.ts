import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(private gateway: EventsGateway) {}

  emitToBusiness(businessId: string, event: string, payload: any) {
    this.gateway.server
      .to(`business:${businessId}`)
      .emit(event, payload);
  }
}
