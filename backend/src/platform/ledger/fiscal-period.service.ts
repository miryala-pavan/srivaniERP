import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainClock } from '../clock/clock.interface';

@Injectable()
export class FiscalPeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: DomainClock,
  ) {}

  async getOpen(businessId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { businessId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    });
    if (!period) throw new NotFoundException('No open fiscal period found');
    return period;
  }

  async createFiscalYear(businessId: string, year: number) {
    // Indian FY: April 1 to March 31
    const startDate = new Date(`${year}-04-01`);
    const endDate = new Date(`${year + 1}-03-31`);
    return this.prisma.fiscalPeriod.create({
      data: { businessId, name: `FY ${year}-${year + 1}`, startDate, endDate, status: 'OPEN' },
    });
  }
}
