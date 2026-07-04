import { Module } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { OnboardingModule } from '../platform/onboarding/onboarding.module';

@Module({
  imports: [OnboardingModule],
  providers: [BusinessService],
  controllers: [BusinessController],
})
export class BusinessModule {}
