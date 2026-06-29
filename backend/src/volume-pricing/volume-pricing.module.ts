import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VolumePricingService } from './volume-pricing.service';
import { VolumePricingController } from './volume-pricing.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VolumePricingController],
  providers: [VolumePricingService],
  exports: [VolumePricingService],
})
export class VolumePricingModule {}
