import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports:     [AuditLogModule],
  providers:   [ExpensesService],
  controllers: [ExpensesController],
  exports:     [ExpensesService],
})
export class ExpensesModule {}
