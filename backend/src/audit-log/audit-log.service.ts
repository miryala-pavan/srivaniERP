import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditActor {
  userId?: string;
  userName: string;
  userRole: string;
  businessId: string;
}

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string;
  entityRef?: string;
  description: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(actor: AuditActor, entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          businessId:  actor.businessId,
          userId:      actor.userId ?? null,
          userName:    actor.userName,
          userRole:    actor.userRole,
          action:      entry.action,
          entity:      entry.entity,
          entityId:    entry.entityId ?? null,
          entityRef:   entry.entityRef ?? null,
          description: entry.description,
          meta:        entry.meta ? (entry.meta as any) : undefined,
        },
      });
    } catch {
      // Never let audit failure break the main flow
    }
  }

  async list(businessId: string, opts: {
    entity?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    take?: number;
    skip?: number;
  }) {
    const where: any = { businessId };

    if (opts.entity && opts.entity !== 'ALL') where.entity = opts.entity;
    if (opts.userId)  where.userId = opts.userId;

    if (opts.dateFrom || opts.dateTo) {
      where.createdAt = {
        ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
        ...(opts.dateTo   ? { lt:  new Date(new Date(opts.dateTo).getTime() + 86400000) } : {}),
      };
    }

    if (opts.search) {
      const s = opts.search.trim();
      where.OR = [
        { description: { contains: s, mode: 'insensitive' } },
        { entityRef:   { contains: s, mode: 'insensitive' } },
        { userName:    { contains: s, mode: 'insensitive' } },
      ];
    }

    const take = opts.take ?? 100;
    const skip = opts.skip ?? 0;

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { rows, total };
  }
}
