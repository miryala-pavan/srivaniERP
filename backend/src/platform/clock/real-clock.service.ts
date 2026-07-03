import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DomainClock } from './clock.interface';

@Injectable()
export class RealClockService extends DomainClock {
  now(): Date {
    return new Date();
  }

  requestId(): string {
    return randomUUID();
  }
}
