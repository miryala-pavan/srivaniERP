import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [NotificationsModule, EventsModule, AuditLogModule],
  providers: [InventoryService],
  controllers: [InventoryController],
})
export class InventoryModule {}
