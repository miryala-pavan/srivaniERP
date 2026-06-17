import { Module } from '@nestjs/common';
import { FinancialYearService }    from './financial-year.service';
import { FinancialYearController } from './financial-year.controller';

@Module({
  controllers: [FinancialYearController],
  providers:   [FinancialYearService],
  exports:     [FinancialYearService],
})
export class FinancialYearModule {}
