import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAuditLogDto {
  businessId: string;
  userId?: string;
  action: string;
  tableName: string;
  recordId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    await this.prisma.platformAuditLog.create({
      data: {
        businessId: dto.businessId,
        userId: dto.userId,
        action: dto.action,
        tableName: dto.tableName,
        recordId: dto.recordId,
        before: (dto.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (dto.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        correlationId: dto.correlationId,
      },
    });
  }
}
