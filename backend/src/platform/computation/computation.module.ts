import { Module } from '@nestjs/common';
import { ComputationService } from './computation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../clock/clock.module';

@Module({
  imports: [PrismaModule, ClockModule],
  providers: [ComputationService],
  exports: [ComputationService],
})
export class ComputationModule {}
