import { Module } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
