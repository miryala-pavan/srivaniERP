import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { StockTakeDto } from './dto/stock-take.dto';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async adjust(businessId: string, dto: AdjustStockDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, businessId, isActive: true },
      select: { id: true, name: true, barcode: true, autoInactiveReason: true, reorderLevel: true, allowNegativeStock: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const isIncoming = dto.adjustedQuantity > 0;

    if (!isIncoming && !product.allowNegativeStock) {
      const stockRows = await this.prisma.stockLedger.aggregate({
        where:  { productId: dto.productId, branchId: dto.branchId },
        _sum:   { quantity: true },
      });
      const current = Number(stockRows._sum.quantity ?? 0);
      if (current + dto.adjustedQuantity < 0) {
        throw new BadRequestException(
          `Insufficient stock. Current: ${current}, Adjustment: ${dto.adjustedQuantity}`,
        );
      }
    }

    const movementType = isIncoming ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const notes = [dto.type, dto.reason].filter(Boolean).join(' — ') || undefined;

    const entry = await this.prisma.stockLedger.create({
      data: {
        businessId,
        branchId:      dto.branchId,
        productId:     dto.productId,
        movementType:  movementType as any,
        quantity:      dto.adjustedQuantity,
        referenceType: 'ADJUSTMENT',
        notes,
      },
    });

    // Fetch updated stock
    const agg = await this.prisma.stockLedger.aggregate({
      where: { productId: dto.productId, branchId: dto.branchId },
      _sum:  { quantity: true },
    });
    const currentStock = Number(agg._sum.quantity ?? 0);

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
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, businessId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const productIds = dto.items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId, isActive: true },
      select: { id: true },
    });
    const validIds = new Set(products.map(p => p.id));

    const errors: { productId: string; error: string }[] = [];
    const creates: any[] = [];

    for (const item of dto.items) {
      if (!validIds.has(item.productId)) {
        errors.push({ productId: item.productId, error: 'Product not found or inactive' });
        continue;
      }
      creates.push({
        businessId,
        branchId:      dto.branchId,
        productId:     item.productId,
        movementType:  'OPENING_STOCK' as any,
        quantity:      item.quantity,
        referenceType: 'STOCK_TAKE',
        notes:         dto.sessionName ?? 'Opening Stock',
      });
    }

    if (creates.length > 0) {
      await this.prisma.stockLedger.createMany({ data: creates });
    }

    return { created: creates.length, errors };
  }

  async getStockTakeTemplate(businessId: string): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, barcode: true, unitOfMeasure: true },
      orderBy: { name: 'asc' },
    });

    const rows = products.map(p =>
      [p.id, `"${p.name.replace(/"/g, '""')}"`, p.barcode ?? '', p.unitOfMeasure ?? '', '0'].join(','),
    );

    return ['productId,productName,barcode,unitOfMeasure,quantity', ...rows].join('\r\n');
  }

  async getStockLevels(businessId: string, branchId?: string) {
    const where: any = { businessId };
    if (branchId) where.branchId = branchId;

    const ledger = await this.prisma.stockLedger.groupBy({
      by: ['productId', 'branchId'],
      where,
      _sum: { quantity: true },
    });

    const productIds = [...new Set(ledger.map(r => r.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, barcode: true, unitOfMeasure: true, reorderLevel: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const branches = await this.prisma.branch.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });
    const branchMap = new Map(branches.map(b => [b.id, b]));

    return ledger.map(row => ({
      productId:   row.productId,
      branchId:    row.branchId,
      product:     productMap.get(row.productId),
      branch:      branchMap.get(row.branchId),
      currentStock: Number(row._sum.quantity ?? 0),
    }));
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
}
