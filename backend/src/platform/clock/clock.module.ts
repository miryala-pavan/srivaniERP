import { Module } from '@nestjs/common';
import { DomainClock } from './clock.interface';
import { RealClockService } from './real-clock.service';

@Module({
  providers: [{ provide: DomainClock, useClass: RealClockService }],
  exports: [DomainClock],
})
export class ClockModule {}
