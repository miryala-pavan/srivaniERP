import { Injectable } from '@nestjs/common';
import { DomainClock } from './clock.interface';

@Injectable()
export class TestClockService extends DomainClock {
  private _now: Date = new Date('2024-01-01T00:00:00Z');
  private _requestId = 'test-request-id';

  setNow(date: Date) {
    this._now = date;
  }

  now(): Date {
    return this._now;
  }

  requestId(): string {
    return this._requestId;
  }
}
