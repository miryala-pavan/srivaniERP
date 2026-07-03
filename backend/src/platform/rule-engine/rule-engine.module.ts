import { Module } from '@nestjs/common';
import { RuleEngineService } from './rule-engine.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ClockModule } from '../clock/clock.module';

@Module({
  imports: [PrismaModule, ClockModule],
  providers: [RuleEngineService],
  exports: [RuleEngineService],
})
export class RuleEngineModule {}
