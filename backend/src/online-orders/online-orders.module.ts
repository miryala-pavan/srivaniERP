import { Module } from '@nestjs/common';
import { OnlineOrdersController } from './online-orders.controller';
import { OnlineOrdersService } from './online-orders.service';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EventsModule, AuditLogModule, NotificationsModule],
  controllers: [OnlineOrdersController],
  providers: [OnlineOrdersService],
})
export class OnlineOrdersModule {}
