import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { StockTakeDto } from './dto/stock-take.dto';
import { lockPluCandidatesForDeduction } from '../common/helpers/stock-lock.util';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private eventsService: EventsService,
  ) {}

  async adjust(businessId: string, dto: AdjustStockDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId, isActive: true },
      select: { id: true, name: true, barcode: true, autoInactiveReason: true, reorderLevel: true, allowNegativeStock: true, expiryTracking: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const isIncoming = dto.adjustedQuantity > 0;
    const movementType = isIncoming ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const notes = [dto.type, dto.reason].filter(Boolean).join(' — ') || undefined;

    // Mirrors the stock-mutation shape already used by GRN receiving and POS
    // sales: write the ledger row, then sync ProductPlu.stockOnHand and
    // Product.totalStock in the same transaction — this is the field POS
    // and the storefront actually check for availability, and this endpoint
    // previously never touched it.
    const { entry, currentStock } = await this.prisma.$transaction(async (tx) => {
      let entry;

      if (isIncoming) {
        // FOUND / RECOUNT-up: add to the default PLU (mirrors stockTake()).
        const defaultPlu = await tx.productPlu.findFirst({
          where: { productId: dto.productId, businessId, isDefault: true, isArchived: false },
          orderBy: { createdAt: 'desc' },
        });
        if (!defaultPlu) {
          throw new BadRequestException('This product has no active price/batch (PLU) to receive stock into — create one via a GRN first.');
        }
        entry = await tx.stockLedger.create({
          data: {
            businessId, branchId: dto.branchId, productId: dto.productId,
            movementType: movementType as any, quantity: dto.adjustedQuantity,
            referenceType: 'ADJUSTMENT', notes,
          },
        });
        await tx.productPlu.update({
          where: { id: defaultPlu.id },
          data: { stockOnHand: { increment: dto.adjustedQuantity }, receivedQty: { increment: dto.adjustedQuantity }, isActive: true },
        });
      } else {
        // DAMAGE / LOSS / EXPIRY: decrement FEFO across active PLUs, same
        // pattern as the POS sale decrement. Candidates are row-locked for
        // the rest of this transaction to close the same TOCTOU window.
        const need = Math.abs(dto.adjustedQuantity);
        const plus = await lockPluCandidatesForDeduction(tx, businessId, dto.productId, product.expiryTracking);
        const totalAvailable = plus.reduce((s, p) => s + p.stockOnHand, 0);
        if (need > totalAvailable && !product.allowNegativeStock) {
          throw new BadRequestException(`Insufficient stock. Current: ${totalAvailable}, Adjustment: ${dto.adjustedQuantity}`);
        }

        entry = await tx.stockLedger.create({
          data: {
            businessId, branchId: dto.branchId, productId: dto.productId,
            movementType: movementType as any, quantity: dto.adjustedQuantity,
            referenceType: 'ADJUSTMENT', notes,
          },
        });

        let remaining = need;
        for (const plu of plus) {
          if (remaining <= 0) break;
          const deduct = Math.min(remaining, Number(plu.stockOnHand));
          await tx.productPlu.update({ where: { id: plu.id }, data: { stockOnHand: { decrement: deduct } } });
          remaining -= deduct;
        }
        // Any remainder beyond tracked PLU stock only happens with
        // allowNegativeStock — nothing left to decrement from, so it's
        // absorbed by the ledger entry alone (matches how sales handle it).
      }

      const agg = await tx.productPlu.aggregate({ where: { productId: dto.productId, isArchived: false }, _sum: { stockOnHand: true } });
      const currentStock = Number(agg._sum.stockOnHand ?? 0);
      await tx.product.update({ where: { id: dto.productId }, data: { totalStock: currentStock } });

      return { entry, currentStock };
    });

    // Emit stock notifications for outgoing adjustments
    if (!isIncoming) {
      this.checkStockNotification(businessId, dto.branchId, product, currentStock).catch(() => {});
    }

    return {
      entry,
      currentStock,
      product: { id: product.id, name: product.name, barcode: product.barcode },
    };
  }

  private async checkStockNotification(
    businessId: string,
    _branchId: string,
    product: { id: string; name: string; autoInactiveReason: string | null; reorderLevel: any },
    currentStock: number,
  ) {
    const reorderLevel = Number(product.reorderLevel ?? 0);

    if (currentStock <= 0 && product.autoInactiveReason !== 'OUT_OF_STOCK') {
      await this.prisma.product.update({ where: { id: product.id }, data: { autoInactiveReason: 'OUT_OF_STOCK' } });
      await this.notifications.create({
        businessId,
        type: 'OUT_OF_STOCK', priority: 'URGENT',
        title: `Out of Stock: ${product.name}`,
        message: 'Stock adjusted to zero. Product hidden from POS. Create GRN to restock.',
        productId: product.id,
        actionUrl: '/dashboard/grn/new', actionLabel: 'Create GRN',
      });
    } else if (currentStock > 0 && currentStock <= reorderLevel) {
      const recent = await this.prisma.notification.findFirst({
        where: { businessId, productId: product.id, type: 'LOW_STOCK',
          createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } },
      });
      if (!recent) {
        await this.notifications.create({
          businessId,
          type: 'LOW_STOCK', priority: 'HIGH',
          title: `Low Stock: ${product.name}`,
          message: `Only ${currentStock} units remaining. Reorder level: ${reorderLevel}.`,
          productId: product.id,
          actionUrl: '/dashboard/grn/new', actionLabel: 'Create GRN',
        });
      }
    }
  }

  async stockTake(businessId: string, userId: string, dto: StockTakeDto) {
    const stockTakeId = `ST-${Date.now()}`;
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId },
      select: { id: true },
    });
    const validIds = new Set(products.map(p => p.id));

    const errors: { productId: string; error: string }[] = [];
    let createdCount = 0;

    // Stock-take is a reconciliation against a physical count, not a
    // receipt — the frontend shows staff the current system stock next to
    // the count they enter. Treating item.quantity as an increment (the
    // previous behavior) added the counted amount on TOP of existing stock
    // every time this ran, and could never record a downward correction
    // (shrinkage/theft) at all. Now computed as counted-vs-current variance,
    // applied per item in its own transaction so a failure partway through
    // a large stock-take doesn't leave ledger rows without matching PLU
    // updates for the items already processed.
    for (const item of dto.items) {
      if (!validIds.has(item.productId)) {
        errors.push({ productId: item.productId, error: 'Product not found' });
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const defaultPlu = await tx.productPlu.findFirst({
          where: { productId: item.productId, businessId, isDefault: true, isArchived: false },
          orderBy: { createdAt: 'desc' },
        });
        const currentQty = defaultPlu ? Number(defaultPlu.stockOnHand) : 0;
        const countedQty = Number(item.quantity);
        const variance = countedQty - currentQty;

        await tx.stockLedger.create({
          data: {
            businessId,
            branchId:      dto.branchId,
            productId:     item.productId,
            movementType:  'OPENING_STOCK' as any,
            quantity:      variance,
            referenceType: 'STOCK_TAKE',
            notes:         dto.sessionName ?? 'Stock Take',
          },
        });

        if (defaultPlu) {
          await tx.productPlu.update({
            where: { id: defaultPlu.id },
            data: {
              stockOnHand: countedQty,
              // A downward correction isn't a receipt — only count positive
              // variance toward the lifetime "total ever received" figure.
              ...(variance > 0 ? { receivedQty: { increment: variance } } : {}),
              isActive: true,
            },
          });
          const agg = await tx.productPlu.aggregate({
            where: { productId: item.productId, isActive: true, isArchived: false },
            _sum:  { stockOnHand: true },
          });
          await tx.product.update({
            where: { id: item.productId },
            data:  { totalStock: Number(agg._sum.stockOnHand ?? 0) } as any,
          });
        }
      });

      createdCount++;
    }

    try {
      this.eventsService.emitToBusiness(businessId, Events.INVENTORY_STOCK_ADJUSTED, {
        stockTakeId,
        productCount: createdCount,
        branchId:     dto.branchId,
        performedBy:  userId,
      });
    } catch (_err) { /* fire-and-forget */ }

    return { created: createdCount, errors };
  }

  async getStockTakeTemplate(businessId: string): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { businessId },
      select: { id: true, name: true, barcode: true, unitOfMeasure: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    const rows = products.map(p =>
      [p.id, `"${p.name.replace(/"/g, '""')}"`, p.barcode ?? '', p.unitOfMeasure ?? '', '0'].join(','),
    );

    return ['productId,productName,barcode,unitOfMeasure,quantity', ...rows].join('\r\n');
  }

  async getStockLevels(businessId: string, branchId?: string) {
    // Start from product catalog so products with no ledger entries show currentStock: 0
    const products = await this.prisma.product.findMany({
      where: { businessId },
      select: { id: true, name: true, barcode: true, unitOfMeasure: true, reorderLevel: true, isActive: true, isManuallyDisabled: true },
      orderBy: { name: 'asc' },
    });

    const productIds = products.map(p => p.id);

    const ledgerWhere: any = { businessId, productId: { in: productIds } };
    if (branchId) ledgerWhere.branchId = branchId;

    const ledger = await this.prisma.stockLedger.groupBy({
      by: ['productId', 'branchId'],
      where: ledgerWhere,
      _sum: { quantity: true },
    });

    // Build map: productId → branchId → stock sum
    const stockMap = new Map<string, Map<string, number>>();
    for (const row of ledger) {
      if (!stockMap.has(row.productId)) stockMap.set(row.productId, new Map());
      stockMap.get(row.productId)!.set(row.branchId, Number(row._sum.quantity ?? 0));
    }

    const branches = await this.prisma.branch.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });
    const branchMap = new Map(branches.map(b => [b.id, b]));

    const targetBranchIds = branchId ? [branchId] : branches.map(b => b.id);

    const results: Array<{
      productId: string; branchId: string; currentStock: number;
      product: typeof products[0]; branch: typeof branches[0] | undefined;
    }> = [];

    for (const product of products) {
      for (const bId of targetBranchIds) {
        const currentStock = stockMap.get(product.id)?.get(bId) ?? 0;
        results.push({
          productId: product.id,
          branchId:  bId,
          currentStock,
          product,
          branch: branchMap.get(bId),
        });
      }
    }

    return results;
  }

  async getOpeningStockSummary(businessId: string, branchId?: string) {
    const resolvedBranchId = branchId ?? await this.getDefaultBranchId(businessId);

    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true, name: true, barcode: true, unitOfMeasure: true,
        productCode: true, reorderLevel: true, category: { select: { name: true, label: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    let stockMap = new Map<string, number>();
    if (resolvedBranchId) {
      const ledger = await this.prisma.stockLedger.groupBy({
        by: ['productId'],
        where: { businessId, branchId: resolvedBranchId },
        _sum: { quantity: true },
      });
      stockMap = new Map(ledger.map(r => [r.productId, Number(r._sum.quantity ?? 0)]));
    }

    return {
      branchId: resolvedBranchId,
      products: products.map(p => ({
        ...p,
        currentStock: stockMap.get(p.id) ?? 0,
      })),
    };
  }

  private async getDefaultBranchId(businessId: string): Promise<string | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return branch?.id ?? null;
  }

  async getMovements(businessId: string, query: MovementQueryDto) {
    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '30'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId };
    if (query.productId)    where.productId    = query.productId;
    if (query.branchId)     where.branchId     = query.branchId;
    if (query.movementType) where.movementType = query.movementType;

    if (query.startDate || query.endDate) {
      where.movementDate = {};
      if (query.startDate) {
        const s = new Date(query.startDate); s.setHours(0, 0, 0, 0);
        where.movementDate.gte = s;
      }
      if (query.endDate) {
        const e = new Date(query.endDate); e.setHours(23, 59, 59, 999);
        where.movementDate.lte = e;
      }
    }

    const [movements, total] = await this.prisma.$transaction([
      this.prisma.stockLedger.findMany({
        where,
        orderBy: { movementDate: 'desc' },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, barcode: true, unitOfMeasure: true } },
          branch:  { select: { id: true, name: true } },
        },
      }),
      this.prisma.stockLedger.count({ where }),
    ]);

    return {
      data: movements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── EXPIRY DASHBOARD ─────────────────────────────────────────────────────────

  async getExpiringBatches(businessId: string, days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const batches = await this.prisma.productBatch.findMany({
      where: {
        product:      { businessId },
        remainingQty: { gt: 0 },
        status:       { not: 'DEPLETED' },
        expiryDate:   { lte: cutoff },
      },
      include: {
        product: {
          select: {
            id: true, name: true, productCode: true, unitOfMeasure: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return batches.map((b) => {
      const daysLeft = b.expiryDate
        ? Math.ceil((b.expiryDate.getTime() - today.getTime()) / 86_400_000)
        : null;
      const urgency =
        daysLeft === null   ? 'UNKNOWN'
        : daysLeft <= 0     ? 'EXPIRED'
        : daysLeft <= 7     ? 'CRITICAL'
        : daysLeft <= 14    ? 'WARNING'
        : 'WATCH';
      return {
        id:           b.id,
        batchNumber:  b.batchNumber,
        expiryDate:   b.expiryDate,
        daysLeft,
        urgency,
        remainingQty: Number(b.remainingQty),
        costPrice:    Number(b.costPrice),
        rackLocation: b.rackLocation,
        product: {
          id:           b.product.id,
          name:         b.product.name,
          productCode:  b.product.productCode,
          category:     b.product.category?.name ?? null,
          unitOfMeasure: b.product.unitOfMeasure,
        },
      };
    });
  }
}
