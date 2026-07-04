import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { JournalBridgeModule } from '../platform/journal-bridge/journal-bridge.module';

@Module({
  imports:     [AuditLogModule, JournalBridgeModule],
  providers:   [ExpensesService],
  controllers: [ExpensesController],
  exports:     [ExpensesService],
})
export class ExpensesModule {}
