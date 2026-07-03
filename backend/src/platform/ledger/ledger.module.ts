import { Module } from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { JournalService } from './journal.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../clock/clock.module';

@Module({
  imports: [PrismaModule, ClockModule],
  providers: [ChartOfAccountsService, JournalService, FiscalPeriodService],
  exports: [ChartOfAccountsService, JournalService, FiscalPeriodService],
})
export class LedgerModule {}
