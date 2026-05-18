import { EventsGateway } from './events.gateway';
export declare class EventsService {
    private gateway;
    constructor(gateway: EventsGateway);
    emitToBusiness(businessId: string, event: string, payload: any): void;
}
