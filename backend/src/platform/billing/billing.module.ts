import { Module } from '@nestjs/common';
import { PlanGuard } from './plan.guard';

@Module({
  providers: [PlanGuard],
  exports: [PlanGuard],
})
export class BillingModule {}
