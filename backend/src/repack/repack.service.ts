import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RepackService {
  constructor(private prisma: PrismaService) {}

  // ─── Search PLUs that can be used as source (have bundles OR any PLU for variable) ───
  async searchSourcePlus(businessId: string, query: string) {
    return this.prisma.productPlu.findMany({
      where: {
        businessId,
        isActive: true,
        isArchived: false,
        OR: [
          { pluCode: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { product: { name: { contains: query, mode: 'insensitive' } } },
          { eanCode: { contains: query } },
        ],
      },
      select: {
        id: true, pluCode: true, displayName: true, stockOnHand: true,
        product: { select: { id: true, name: true } },
        asBulk: {
          select: {
            id: true, type: true, conversionQty: true,
            bulkWeightG: true, unitWeightG: true,
            singlePlu: { select: { id: true, pluCode: true, displayName: true, stockOnHand: true } },
          },
        },
      },
      take: 20,
    });
  }

  // ─── Search any PLU for output lines ───────────────────────────────────────────
  async searchTargetPlus(businessId: string, query: string, excludePluId: string) {
    return this.prisma.productPlu.findMany({
      where: {
        businessId,
        isActive: true,
        isArchived: false,
        id: { not: excludePluId },
        OR: [
          { pluCode: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { product: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true, pluCode: true, displayName: true, stockOnHand: true,
        product: { select: { name: true } },
        asSingle: { select: { unitWeightG: true }, take: 1 },
      },
      take: 15,
    });
  }

  // ─── Get all PLU bundles (for fixed break bulk page) ───────────────────────────
  async getAllBundles(businessId: string) {
    return this.prisma.pluBundle.findMany({
      where: { businessId },
      include: {
        bulkPlu:   { select: { id: true, pluCode: true, displayName: true, stockOnHand: true, product: { select: { name: true } } } },
        singlePlu: { select: { id: true, pluCode: true, displayName: true, stockOnHand: true, product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Commit a repack session ────────────────────────────────────────────────────
  async commitSession(businessId: string, body: {
    sourcePluId: string;
    sourceQty: number;
    type: 'FIXED' | 'VARIABLE';
    lines: { targetPluId: string; qty: number; unitWeightG?: number; notes?: string }[];
    wastageG?: number;
    wastageNotes?: string;
    notes?: string;
    userId?: string;
    userName?: string;
  }) {
    const sourcePlu = await this.prisma.productPlu.findFirst({
      where: { id: body.sourcePluId, businessId },
    });
    if (!sourcePlu) throw new NotFoundException('Source PLU not found');
    if (Number(sourcePlu.stockOnHand) < body.sourceQty) {
      throw new BadRequestException(`Only ${sourcePlu.stockOnHand} units in stock`);
    }
    if (!body.lines || body.lines.length === 0) {
      throw new BadRequestException('At least one output line is required');
    }

    // Validate all target PLUs
    for (const line of body.lines) {
      const t = await this.prisma.productPlu.findFirst({ where: { id: line.targetPluId, businessId } });
      if (!t) throw new NotFoundException(`Target PLU not found: ${line.targetPluId}`);
      if (line.qty <= 0) throw new BadRequestException('Line qty must be > 0');
    }

    // Generate session number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.repackSession.count({
      where: { businessId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    const sessionNo = `RPK-${today}-${String(count + 1).padStart(3, '0')}`;

    // Weight calculations for VARIABLE
    let totalInputG: number | null = null;
    let totalOutputG: number | null = null;
    if (body.type === 'VARIABLE') {
      totalOutputG = body.lines.reduce((sum, l) => sum + (l.qty * (l.unitWeightG ?? 0)), 0);
    }

    return this.prisma.$transaction(async (tx) => {
      // Deduct source stock
      await tx.productPlu.update({
        where: { id: body.sourcePluId },
        data: { stockOnHand: { decrement: body.sourceQty } },
      });

      // Add to each target
      for (const line of body.lines) {
        await tx.productPlu.update({
          where: { id: line.targetPluId },
          data: { stockOnHand: { increment: line.qty } },
        });
      }

      // Create session record
      return tx.repackSession.create({
        data: {
          businessId,
          sessionNo,
          sourcePluId: body.sourcePluId,
          sourceQty: body.sourceQty,
          type: body.type,
          totalInputG,
          totalOutputG,
          wastageG: body.wastageG ?? 0,
          wastageNotes: body.wastageNotes,
          notes: body.notes,
          createdById: body.userId,
          createdByName: body.userName,
          lines: {
            create: body.lines.map(l => ({
              targetPluId: l.targetPluId,
              qty: l.qty,
              unitWeightG: l.unitWeightG ?? null,
              totalWeightG: l.unitWeightG ? l.qty * l.unitWeightG : null,
              notes: l.notes,
            })),
          },
        },
        include: {
          lines: true,
        },
      });
    });
  }

  // ─── List sessions ──────────────────────────────────────────────────────────────
  async getSessions(businessId: string, sourcePluId?: string, take = 50) {
    return this.prisma.repackSession.findMany({
      where: {
        businessId,
        ...(sourcePluId ? { sourcePluId } : {}),
      },
      include: {
        lines: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  // ─── Wastage report ─────────────────────────────────────────────────────────────
  async getWastageReport(businessId: string, fromDate?: string, toDate?: string) {
    const where: any = {
      businessId,
      wastageG: { gt: 0 },
    };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate)   where.createdAt.lte = new Date(toDate + 'T23:59:59Z');
    }

    const sessions = await this.prisma.repackSession.findMany({
      where,
      select: {
        sessionNo: true, sourcePluId: true, sourceQty: true,
        wastageG: true, wastageNotes: true, totalInputG: true,
        createdByName: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by sourcePluId
    const grouped: Record<string, any> = {};
    for (const s of sessions) {
      if (!grouped[s.sourcePluId]) {
        grouped[s.sourcePluId] = { sourcePluId: s.sourcePluId, totalWastageG: 0, sessions: [] };
      }
      grouped[s.sourcePluId].totalWastageG += Number(s.wastageG);
      grouped[s.sourcePluId].sessions.push(s);
    }

    return Object.values(grouped);
  }

  // ─── Update PluBundle type/weights ──────────────────────────────────────────────
  async updateBundle(businessId: string, bundleId: string, body: {
    type?: 'FIXED' | 'VARIABLE';
    bulkWeightG?: number;
    unitWeightG?: number;
    conversionQty?: number;
    notes?: string;
  }) {
    const bundle = await this.prisma.pluBundle.findFirst({ where: { id: bundleId, businessId } });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return this.prisma.pluBundle.update({
      where: { id: bundleId },
      data: {
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.bulkWeightG !== undefined ? { bulkWeightG: body.bulkWeightG } : {}),
        ...(body.unitWeightG !== undefined ? { unitWeightG: body.unitWeightG } : {}),
        ...(body.conversionQty !== undefined ? { conversionQty: body.conversionQty } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
  }
}
