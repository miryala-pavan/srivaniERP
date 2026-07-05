import { Module } from '@nestjs/common';
import { PlanGuard } from './plan.guard';
import { BillingController } from './billing.controller';

@Module({
  providers: [PlanGuard],
  controllers: [BillingController],
  exports: [PlanGuard],
})
export class BillingModule {}
