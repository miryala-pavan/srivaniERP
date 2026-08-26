import { Module } from '@nestjs/common';
import { GrnService } from './grn.service';
import { GrnController } from './grn.controller';
import { GrnCalculationsService } from './grn-calculations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { EventsModule } from '../events/events.module';
import { BankModule } from '../bank/bank.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { JournalBridgeModule } from '../platform/journal-bridge/journal-bridge.module';
import { GstModule } from '../gst/gst.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [NotificationsModule, SuppliersModule, EventsModule, BankModule, AuditLogModule, JournalBridgeModule, GstModule, ProductsModule],
  providers: [GrnService, GrnCalculationsService],
  controllers: [GrnController],
})
export class GrnModule {}
