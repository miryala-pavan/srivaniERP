import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const REPACK_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'PURCHASE_CHECKER'];

@Injectable()
export class RepackService {
  constructor(private prisma: PrismaService) {}

  // ─── Search PLUs that have at least one FIXED bundle (source for fixed break) ──
  async searchSourcePlus(businessId: string, query: string) {
    return this.prisma.productPlu.findMany({
      where: {
        businessId,
        isActive: true,
        isArchived: false,
        asBulk: { some: {} },   // only PLUs configured as bulk
        OR: [
          { pluCode: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
          { product: { name: { contains: query, mode: 'insensitive' } } },
          { eanCode: { contains: query } },
        ],
      },
      select: {
        id: true, pluCode: true, displayName: true, stockOnHand: true, costPrice: true,
        measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true, gstUqc: true, isLoose: true,
        product: { select: { id: true, name: true } },
        asBulk: {
          select: {
            id: true, type: true, conversionQty: true,
            bulkWeightG: true, unitWeightG: true,
            singlePlu: {
              select: {
                id: true, pluCode: true, displayName: true, stockOnHand: true,
                measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true,
              },
            },
          },
        },
      },
      take: 20,
    });
  }

  // ─── Search ALL active PLUs (for unified break-bulk source picker) ────────────
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
      select: {
        id: true, pluCode: true, displayName: true, stockOnHand: true, costPrice: true,
        measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true, gstUqc: true, isLoose: true,
        product: { select: { id: true, name: true } },
        asBulk: {
          select: {
            id: true, type: true, conversionQty: true, bulkWeightG: true, unitWeightG: true,
            singlePlu: {
              select: {
                id: true, pluCode: true, displayName: true, stockOnHand: true,
                measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true,
              },
            },
          },
        },
      },
      take: 20,
    });
  }

  // ─── Search any PLU for variable output lines ───────────────────────────────
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
        measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true,
        product: { select: { name: true } },
        asSingle: { select: { unitWeightG: true } },
      },
      take: 15,
    });
  }

  // ─── Get all PLU bundles ────────────────────────────────────────────────────
  async getAllBundles(businessId: string) {
    return this.prisma.pluBundle.findMany({
      where: { businessId },
      include: {
        bulkPlu:   { select: { id: true, pluCode: true, displayName: true, stockOnHand: true, measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true, product: { select: { name: true } } } },
        singlePlu: { select: { id: true, pluCode: true, displayName: true, stockOnHand: true, measureType: true, unitSymbol: true, unitSize: true, baseUnitQty: true, product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── Commit a repack session ────────────────────────────────────────────────
  async commitSession(businessId: string, body: {
    sourcePluId: string;
    sourceQty: number;
    type: 'FIXED' | 'VARIABLE';
    lines: { targetPluId: string; qty: number; unitWeightG?: number; notes?: string }[];
    bulkWeightG?: number;       // grams per bulk unit (VARIABLE)
    wastageG?: number;          // grams wasted (VARIABLE)
    wastageUnits?: number;      // units wasted (FIXED)
    wastageNotes?: string;
    notes?: string;
    userId?: string;
    userName?: string;
    userRole?: string;
  }) {
    // ── Role guard ────────────────────────────────────────────────────────────
    if (body.userRole && !REPACK_ROLES.includes(body.userRole)) {
      throw new ForbiddenException('You do not have permission to commit repack sessions');
    }

    // ── Input validation ──────────────────────────────────────────────────────
    if (!body.sourceQty || body.sourceQty <= 0) {
      throw new BadRequestException('sourceQty must be greater than 0');
    }
    if (body.type === 'FIXED' && !Number.isInteger(body.sourceQty)) {
      throw new BadRequestException('For FIXED type, sourceQty must be a whole number');
    }
    if (!body.lines || body.lines.length === 0) {
      throw new BadRequestException('At least one output line is required');
    }

    // ── VARIABLE weight balance check ─────────────────────────────────────────
    if (body.type === 'VARIABLE' && body.bulkWeightG) {
      const totalInputG = body.sourceQty * body.bulkWeightG;
      const totalOutputG = body.lines.reduce((s, l) => s + (l.qty * (l.unitWeightG ?? 0)), 0);
      const wastageG = body.wastageG ?? 0;
      if (totalOutputG + wastageG > totalInputG + 1) {  // 1g tolerance for rounding
        throw new BadRequestException(
          `Output (${(totalOutputG / 1000).toFixed(3)} kg) + wastage exceeds input (${(totalInputG / 1000).toFixed(3)} kg)`
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // ── 1. Verify source PLU belongs to this business ─────────────────────
      const sourcePlu = await tx.productPlu.findFirst({
        where: { id: body.sourcePluId, businessId },
        select: { id: true, pluCode: true, displayName: true, stockOnHand: true, costPrice: true,
                  asBulk: { select: { id: true }, take: 1 } },
      });
      if (!sourcePlu) throw new NotFoundException('Source PLU not found');
      if (body.type === 'FIXED' && sourcePlu.asBulk.length === 0) {
        throw new BadRequestException(
          `Source PLU "${sourcePlu.displayName ?? sourcePlu.pluCode}" has no bundle configured — set up a PLU bundle before running a FIXED break-bulk`,
        );
      }

      // ── 2. Atomic stock deduction — prevents negative stock under concurrent load ──
      // The WHERE clause on stockOnHand acts as a row-level guard.
      const deducted = await tx.$executeRaw`
        UPDATE "product_plu"
        SET "stockOnHand" = "stockOnHand" - ${body.sourceQty}
        WHERE id = ${body.sourcePluId}
          AND "businessId" = ${businessId}
          AND "stockOnHand" >= ${body.sourceQty}
      `;
      if (deducted === 0) {
        const fresh = await tx.productPlu.findFirst({
          where: { id: body.sourcePluId },
          select: { stockOnHand: true },
        });
        throw new BadRequestException(
          `Insufficient stock — only ${fresh?.stockOnHand ?? 0} units available`
        );
      }

      // ── 3. Validate and credit each target PLU ────────────────────────────
      for (const line of body.lines) {
        if (!line.targetPluId) throw new BadRequestException('targetPluId is required on each line');
        if (!line.qty || line.qty <= 0) throw new BadRequestException('Line qty must be > 0');
        const t = await tx.productPlu.findFirst({ where: { id: line.targetPluId, businessId }, select: { id: true } });
        if (!t) throw new NotFoundException(`Target PLU not found: ${line.targetPluId}`);
        await tx.productPlu.update({
          where: { id: line.targetPluId },
          data: { stockOnHand: { increment: line.qty } },
        });
      }

      // ── 3b. Cost allocation — update costPrice on each output PLU ────────
      const sourceCost = Number(sourcePlu.costPrice ?? 0);
      if (sourceCost > 0) {
        for (const line of body.lines) {
          let newCost: number | null = null;

          if (body.type === 'FIXED') {
            const bundle = await tx.pluBundle.findFirst({
              where: { bulkPluId: body.sourcePluId, singlePluId: line.targetPluId },
              select: { conversionQty: true },
            });
            if (bundle && bundle.conversionQty > 0) {
              newCost = sourceCost / bundle.conversionQty;
            }
          } else if (body.type === 'VARIABLE' && body.bulkWeightG && body.bulkWeightG > 0 && line.unitWeightG && line.unitWeightG > 0) {
            newCost = sourceCost * (line.unitWeightG / body.bulkWeightG);
          }

          if (newCost !== null && newCost > 0) {
            const target = await tx.productPlu.findFirst({
              where: { id: line.targetPluId },
              select: { mrp: true, sellingPrice: true },
            });
            if (target) {
              const mrp = Number(target.mrp);
              const sp  = Number(target.sellingPrice);
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
      }

      // ── 4. Compute weight totals for VARIABLE ─────────────────────────────
      let totalInputG: number | null = null;
      let totalOutputG: number | null = null;
      if (body.type === 'VARIABLE' && body.bulkWeightG) {
        totalInputG  = body.sourceQty * body.bulkWeightG;
        totalOutputG = body.lines.reduce((s, l) => s + (l.qty * (l.unitWeightG ?? 0)), 0);
      }

      // ── 5. Generate session number inside the transaction (unique constraint prevents duplicates) ──
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await tx.repackSession.count({
        where: { businessId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      });
      const sessionNo = `RPK-${today}-${String(count + 1).padStart(4, '0')}`;

      // ── 6. Create session record ──────────────────────────────────────────
      return tx.repackSession.create({
        data: {
          businessId,
          sessionNo,
          sourcePluId: body.sourcePluId,
          sourceQty: body.sourceQty,
          type: body.type,
          bulkWeightG: body.bulkWeightG ?? null,
          totalInputG,
          totalOutputG,
          wastageG:    body.type === 'VARIABLE' ? (body.wastageG ?? 0) : 0,
          wastageUnits: body.type === 'FIXED'   ? (body.wastageUnits ?? 0) : 0,
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
        include: { lines: true },
      });
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
      // Restore source stock atomically
      await tx.productPlu.update({
        where: { id: session.sourcePluId },
        data: { stockOnHand: { increment: Number(session.sourceQty) } },
      });

      // Deduct each target — check stock first
      for (const line of session.lines) {
        const t = await tx.productPlu.findFirst({
          where: { id: line.targetPluId },
          select: { stockOnHand: true, pluCode: true },
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

  // ─── Update PluBundle type/weights ──────────────────────────────────────────
  async updateBundle(businessId: string, bundleId: string, body: {
    type?: 'FIXED' | 'VARIABLE';
    bulkWeightG?: number;
    unitWeightG?: number;
    conversionQty?: number;
    notes?: string;
    userRole?: string;
  }) {
    if (body.userRole && !REPACK_ROLES.includes(body.userRole)) {
      throw new ForbiddenException('You do not have permission to update bundles');
    }
    const bundle = await this.prisma.pluBundle.findFirst({ where: { id: bundleId, businessId } });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return this.prisma.pluBundle.update({
      where: { id: bundleId },
      data: {
        ...(body.type         !== undefined ? { type: body.type } : {}),
        ...(body.bulkWeightG  !== undefined ? { bulkWeightG: body.bulkWeightG } : {}),
        ...(body.unitWeightG  !== undefined ? { unitWeightG: body.unitWeightG } : {}),
        ...(body.conversionQty !== undefined ? { conversionQty: body.conversionQty } : {}),
        ...(body.notes        !== undefined ? { notes: body.notes } : {}),
      },
    });
  }
}
