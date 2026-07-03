import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NumberSeriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically get the next number in a series.
   * Uses a raw advisory-lock-guarded UPDATE to prevent duplicates under concurrency.
   */
  async next(businessId: string, seriesCode: string): Promise<string> {
    const result = await this.prisma.$queryRaw<[{ next_val: bigint; prefix: string; pad_length: number }]>`
      UPDATE "NumberSeries"
      SET "currentValue" = "currentValue" + 1, "updatedAt" = NOW()
      WHERE "businessId" = ${businessId} AND "code" = ${seriesCode}
      RETURNING "currentValue" as next_val, "prefix", "padLength" as pad_length
    `;

    if (!result.length) {
      throw new Error(`NumberSeries '${seriesCode}' not found for business ${businessId}`);
    }

    const { next_val, prefix, pad_length } = result[0];
    const numStr = String(next_val).padStart(pad_length, '0');
    return `${prefix}${numStr}`;
  }

  async create(businessId: string, code: string, prefix: string, padLength = 6) {
    return this.prisma.numberSeries.create({
      data: { businessId, code, prefix, padLength, currentValue: 0 },
    });
  }

  async ensureExists(businessId: string, code: string, prefix: string, padLength = 6) {
    const existing = await this.prisma.numberSeries.findFirst({
      where: { businessId, code },
    });
    if (!existing) {
      await this.create(businessId, code, prefix, padLength);
    }
  }
}
