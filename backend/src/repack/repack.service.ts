import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const REPACK_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'PURCHASE_CHECKER'];

const PLU_SELECT = {
  id: true, pluCode: true, displayName: true, stockOnHand: true, costPrice: true,
  measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true, gstUqc: true, isLoose: true,
  product: { select: { id: true, name: true } },
} as const;

@Injectable()
export class RepackService {
  constructor(private prisma: PrismaService) {}

  // ─── Search all active PLUs (source or target picker) ───────────────────────
  async searchAnyPlu(businessId: string, query: string) {
    return this.prisma.productPlu.findMany({
      where: {
        businessId, isActive: true, isArchived: false,
        OR: [
          { pluCode: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { product: { name: { contains: query, mode: 'insensitive' } } },
          { eanCode: { contains: query } },
        ],
      },
      select: PLU_SELECT,
      take: 20,
    });
  }

  // ─── Search any PLU for an output line, excluding the source ────────────────
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
      select: PLU_SELECT,
      take: 15,
    });
  }

  // ─── Recently repacked source→target pairs, for the "Quick Pick" list ───────
  async getRecentPairs(businessId: string) {
    const sessions = await this.prisma.repackSession.findMany({
      where: { businessId, reversed: false },
      include: { lines: { select: { targetPluId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const seen = new Set<string>();
    const pairs: { sourcePluId: string; targetPluId: string }[] = [];
    outer: for (const s of sessions) {
      for (const l of s.lines) {
        const key = `${s.sourcePluId}:${l.targetPluId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ sourcePluId: s.sourcePluId, targetPluId: l.targetPluId });
        if (pairs.length >= 15) break outer;
      }
    }

    const pluIds = [...new Set(pairs.flatMap(p => [p.sourcePluId, p.targetPluId]))];
    const plus = await this.prisma.productPlu.findMany({ where: { id: { in: pluIds } }, select: PLU_SELECT });
    const pluMap: Record<string, any> = {};
    for (const p of plus) pluMap[p.id] = p;

    return pairs
      .map(p => ({ sourcePlu: pluMap[p.sourcePluId] ?? null, targetPlu: pluMap[p.targetPluId] ?? null }))
      .filter(p => p.sourcePlu && p.targetPlu);
  }

  // ─── Keep Product.totalStock in sync with the sum of its active PLUs ────────
  private async resyncProductTotalStock(tx: any, productId: string) {
    const agg = await tx.productPlu.aggregate({
      where: { productId, isActive: true, isArchived: false },
      _sum: { stockOnHand: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: { totalStock: agg._sum.stockOnHand ?? 0 },
    });
  }

  // ─── Commit a repack session — one unified flow, no Fixed/Variable branch ───
  async commitSession(businessId: string, body: {
    sourcePluId: string;
    sourceQty: number;
    lines: { targetPluId: string; qty: number; notes?: string }[];
    wastageNotes?: string;
    notes?: string;
    userId?: string;
    userName?: string;
    userRole?: string;
  }) {
    if (body.userRole && !REPACK_ROLES.includes(body.userRole)) {
      throw new ForbiddenException('You do not have permission to commit repack sessions');
    }
    if (!body.sourceQty || body.sourceQty <= 0) {
      throw new BadRequestException('sourceQty must be greater than 0');
    }
    if (!body.lines || body.lines.length === 0) {
      throw new BadRequestException('At least one output line is required');
    }
    for (const line of body.lines) {
      if (!line.targetPluId) throw new BadRequestException('targetPluId is required on each line');
      if (!line.qty || line.qty <= 0) throw new BadRequestException('Line qty must be > 0');
    }

    return this.prisma.$transaction(async (tx) => {
      // ── 1. Verify source PLU belongs to this business ─────────────────────
      const sourcePlu = await tx.productPlu.findFirst({
        where: { id: body.sourcePluId, businessId },
        select: {
          id: true, pluCode: true, displayName: true, stockOnHand: true, costPrice: true,
          measureType: true, baseUnitQty: true, productId: true,
        },
      });
      if (!sourcePlu) throw new NotFoundException('Source PLU not found');

      // ── 2. Atomic stock deduction — the WHERE clause guards against negative stock under concurrent load ──
      const deducted = await tx.$executeRaw`
        UPDATE "product_plu"
        SET "stockOnHand" = "stockOnHand" - ${body.sourceQty}
        WHERE id = ${body.sourcePluId}
          AND "businessId" = ${businessId}
          AND "stockOnHand" >= ${body.sourceQty}
      `;
      if (deducted === 0) {
        const fresh = await tx.productPlu.findFirst({ where: { id: body.sourcePluId }, select: { stockOnHand: true } });
        throw new BadRequestException(`Insufficient stock — only ${fresh?.stockOnHand ?? 0} units available`);
      }

      // ── 3. Fetch + validate every target PLU up front ─────────────────────
      const targets: Record<string, any> = {};
      for (const line of body.lines) {
        if (targets[line.targetPluId]) continue;
        const t = await tx.productPlu.findFirst({
          where: { id: line.targetPluId, businessId },
          select: { id: true, measureType: true, baseUnitQty: true, mrp: true, sellingPrice: true, productId: true },
        });
        if (!t) throw new NotFoundException(`Target PLU not found: ${line.targetPluId}`);
        targets[line.targetPluId] = t;
      }

      // ── 4. Base-unit balance check + wastage — only when every side shares a comparable unit ──
      const sourceBase = sourcePlu.baseUnitQty ? Number(sourcePlu.baseUnitQty) : null;
      const sameUnitEverywhere = sourceBase !== null && body.lines.every(l => {
        const t = targets[l.targetPluId];
        return t.baseUnitQty && t.measureType === sourcePlu.measureType;
      });

      let totalInputG: number | null = null;
      let totalOutputG: number | null = null;
      let wastageBase = 0;
      if (sameUnitEverywhere) {
        totalInputG  = body.sourceQty * sourceBase!;
        totalOutputG = body.lines.reduce((s, l) => s + l.qty * Number(targets[l.targetPluId].baseUnitQty), 0);
        const tolerance = Math.max(1, totalInputG * 0.001);
        if (totalOutputG > totalInputG + tolerance) {
          const unit = totalInputG >= 1000 ? 'kg' : 'g';
          const fmt = (g: number) => (unit === 'kg' ? (g / 1000).toFixed(3) + ' kg' : g.toFixed(0) + ' g');
          throw new BadRequestException(`Output (${fmt(totalOutputG)}) exceeds input (${fmt(totalInputG)})`);
        }
        wastageBase = Math.max(0, totalInputG - totalOutputG);
      }
      const isCount = sourcePlu.measureType === 'COUNT' || !sourcePlu.measureType;
      const wastageUnits = isCount ? Math.round(wastageBase) : 0;
      const wastageG      = !isCount ? wastageBase : 0;
      const sessionType    = isCount ? 'FIXED' : 'VARIABLE';

      // ── 5. Credit each target PLU + re-allocate cost ──────────────────────
      const sourceCost = Number(sourcePlu.costPrice ?? 0);
      for (const line of body.lines) {
        await tx.productPlu.update({
          where: { id: line.targetPluId },
          data: { stockOnHand: { increment: line.qty } },
        });

        const t = targets[line.targetPluId];
        if (sourceCost > 0 && sourceBase && sourceBase > 0 && t.baseUnitQty && t.measureType === sourcePlu.measureType) {
          const perBaseUnitCost = sourceCost / sourceBase;
          const newCost = perBaseUnitCost * Number(t.baseUnitQty);
          if (newCost > 0) {
            const mrp = Number(t.mrp);
            const sp  = Number(t.sellingPrice);
            await tx.productPlu.update({
              where: { id: line.targetPluId },
              data: {
                costPrice:     newCost,
                basicCost:     newCost,
                marginRs:      sp - newCost,
                marginPercent: mrp > 0 ? ((mrp - newCost) / mrp) * 100 : null,
              },
            });
          }
        }
      }

      // ── 6. Generate session number inside the transaction ─────────────────
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await tx.repackSession.count({
        where: { businessId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      });
      const sessionNo = `RPK-${today}-${String(count + 1).padStart(4, '0')}`;

      // ── 7. Create session record ───────────────────────────────────────────
      const session = await tx.repackSession.create({
        data: {
          businessId,
          sessionNo,
          sourcePluId: body.sourcePluId,
          sourceQty: body.sourceQty,
          type: sessionType,
          bulkWeightG: sourceBase ?? null,
          totalInputG,
          totalOutputG,
          wastageG,
          wastageUnits,
          wastageNotes: body.wastageNotes,
          notes: body.notes,
          createdById: body.userId,
          createdByName: body.userName,
          lines: {
            create: body.lines.map(l => {
              const t = targets[l.targetPluId];
              const unitWeightG = t.baseUnitQty ? Number(t.baseUnitQty) : null;
              return {
                targetPluId: l.targetPluId,
                qty: l.qty,
                unitWeightG,
                totalWeightG: unitWeightG ? l.qty * unitWeightG : null,
                notes: l.notes,
              };
            }),
          },
        },
        include: { lines: true },
      });

      // ── 8. Keep Product.totalStock in sync on both sides ──────────────────
      await this.resyncProductTotalStock(tx, sourcePlu.productId);
      const targetProductIds = new Set(Object.values(targets).map((t: any) => t.productId));
      for (const productId of targetProductIds) {
        await this.resyncProductTotalStock(tx, productId);
      }

      return session;
    });
  }

  // ─── Reverse a committed session ────────────────────────────────────────────
  async reverseSession(businessId: string, sessionId: string, body: {
    userId?: string;
    userName?: string;
    userRole?: string;
    reason?: string;
  }) {
    if (body.userRole && !REPACK_ROLES.includes(body.userRole)) {
      throw new ForbiddenException('You do not have permission to reverse sessions');
    }

    const session = await this.prisma.repackSession.findFirst({
      where: { id: sessionId, businessId },
      include: { lines: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.reversed) throw new BadRequestException('Session is already reversed');

    return this.prisma.$transaction(async (tx) => {
      const sourcePlu = await tx.productPlu.findFirst({
        where: { id: session.sourcePluId },
        select: { productId: true },
      });

      // Restore source stock atomically
      await tx.productPlu.update({
        where: { id: session.sourcePluId },
        data: { stockOnHand: { increment: Number(session.sourceQty) } },
      });

      // Deduct each target — check stock first
      const targetProductIds = new Set<string>();
      for (const line of session.lines) {
        const t = await tx.productPlu.findFirst({
          where: { id: line.targetPluId },
          select: { stockOnHand: true, pluCode: true, productId: true },
        });
        if (!t || Number(t.stockOnHand) < Number(line.qty)) {
          throw new BadRequestException(
            `Cannot reverse: insufficient stock in output PLU (${t?.pluCode ?? line.targetPluId}). Items may have been sold.`
          );
        }
        await tx.productPlu.update({
          where: { id: line.targetPluId },
          data: { stockOnHand: { decrement: Number(line.qty) } },
        });
        targetProductIds.add(t.productId);
      }

      // Mark original as reversed
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await tx.repackSession.count({
        where: { businessId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      });
      const reverseSessionNo = `RPK-${today}-${String(count + 1).padStart(4, '0')}-REV`;

      // Create a reversal record (zero qty session for audit trail)
      const reversal = await tx.repackSession.create({
        data: {
          businessId,
          sessionNo: reverseSessionNo,
          sourcePluId: session.sourcePluId,
          sourceQty: Number(session.sourceQty),
          type: session.type,
          notes: `REVERSAL of ${session.sessionNo}${body.reason ? ': ' + body.reason : ''}`,
          wastageG: 0,
          wastageUnits: 0,
          createdById: body.userId,
          createdByName: body.userName,
          lines: { create: [] },
        },
      });

      await tx.repackSession.update({
        where: { id: sessionId },
        data: {
          reversed: true,
          reversedAt: new Date(),
          reversedById: body.userId,
          reversedByName: body.userName,
          reversedSessionId: reversal.id,
        },
      });

      // Keep Product.totalStock in sync on both sides
      if (sourcePlu) await this.resyncProductTotalStock(tx, sourcePlu.productId);
      for (const productId of targetProductIds) {
        await this.resyncProductTotalStock(tx, productId);
      }

      return { reversalSessionNo: reverseSessionNo, reversedSessionNo: session.sessionNo };
    });
  }

  // ─── List sessions (with source PLU details) ────────────────────────────────
  async getSessions(businessId: string, sourcePluId?: string, take = 50) {
    const sessions = await this.prisma.repackSession.findMany({
      where: {
        businessId,
        ...(sourcePluId ? { sourcePluId } : {}),
      },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take,
    });

    // Resolve PLU names in batch
    const pluIds = [...new Set([
      ...sessions.map(s => s.sourcePluId),
      ...sessions.flatMap(s => s.lines.map(l => l.targetPluId)),
    ])];
    const plus = await this.prisma.productPlu.findMany({
      where: { id: { in: pluIds } },
      select: { id: true, pluCode: true, displayName: true, product: { select: { name: true } } },
    });
    const pluMap: Record<string, any> = {};
    for (const p of plus) pluMap[p.id] = p;

    return sessions.map(s => ({
      ...s,
      sourcePlu: pluMap[s.sourcePluId] ?? null,
      lines: s.lines.map(l => ({ ...l, targetPlu: pluMap[l.targetPluId] ?? null })),
    }));
  }

  // ─── Wastage report ─────────────────────────────────────────────────────────
  async getWastageReport(businessId: string, fromDate?: string, toDate?: string) {
    const where: any = {
      businessId,
      reversed: false,
      OR: [{ wastageG: { gt: 0 } }, { wastageUnits: { gt: 0 } }],
    };
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate)   where.createdAt.lte = new Date(toDate + 'T23:59:59Z');
    }

    const sessions = await this.prisma.repackSession.findMany({
      where,
      select: {
        sessionNo: true, sourcePluId: true, sourceQty: true, type: true,
        wastageG: true, wastageUnits: true, wastageNotes: true, totalInputG: true,
        createdByName: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Resolve PLU names
    const pluIds = [...new Set(sessions.map(s => s.sourcePluId))];
    const plus = await this.prisma.productPlu.findMany({
      where: { id: { in: pluIds } },
      select: { id: true, pluCode: true, displayName: true, product: { select: { name: true } } },
    });
    const pluMap: Record<string, any> = {};
    for (const p of plus) pluMap[p.id] = p;

    // Group by sourcePluId — FIXED and VARIABLE waste tracked separately
    const grouped: Record<string, any> = {};
    for (const s of sessions) {
      if (!grouped[s.sourcePluId]) {
        grouped[s.sourcePluId] = {
          sourcePluId: s.sourcePluId,
          sourcePlu: pluMap[s.sourcePluId] ?? null,
          totalWastageG: 0,
          totalWastageUnits: 0,
          sessions: [],
        };
      }
      grouped[s.sourcePluId].totalWastageG     += Number(s.wastageG);
      grouped[s.sourcePluId].totalWastageUnits += Number(s.wastageUnits);
      grouped[s.sourcePluId].sessions.push({ ...s, sourcePlu: pluMap[s.sourcePluId] ?? null });
    }

    return Object.values(grouped);
  }
}
