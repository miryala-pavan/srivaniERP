import { Module } from '@nestjs/common';
import { OnlineOrdersController } from './online-orders.controller';
import { OnlineOrdersService } from './online-orders.service';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServiceablePincodesModule } from '../serviceable-pincodes/serviceable-pincodes.module';

@Module({
  imports: [EventsModule, AuditLogModule, NotificationsModule, ServiceablePincodesModule],
  controllers: [OnlineOrdersController],
  providers: [OnlineOrdersService],
  exports: [OnlineOrdersService],
})
export class OnlineOrdersModule {}
