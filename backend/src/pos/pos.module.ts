import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [ProductsModule, NotificationsModule, EventsModule, AuditLogModule],
  providers: [PosService],
  controllers: [PosController],
})
export class PosModule {}
