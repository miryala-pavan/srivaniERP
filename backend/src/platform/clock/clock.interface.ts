export abstract class DomainClock {
  abstract now(): Date;
  abstract requestId(): string;
}
