import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { JournalBridgeModule } from '../platform/journal-bridge/journal-bridge.module';

@Module({
  imports: [EventsModule, AuditLogModule, JournalBridgeModule],
  providers: [SuppliersService],
  controllers: [SuppliersController],
  exports: [SuppliersService],
})
export class SuppliersModule {}
