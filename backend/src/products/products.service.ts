import {
  Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { assertMargin } from '../common/margin.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { canViewCost } from '../common/helpers/cost-visibility';
import { wildcardFilter, hasWildcard, toSqlLike } from '../common/helpers/search.helper';
import { ShopCacheService } from '../shop/shop-cache.service';

function isManagerRole(role?: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER';
}

function tcField(s: string | undefined | null): string | undefined {
  if (!s) return s ?? undefined;
  return s.trim().split(' ').map((w) => {
    if (!w) return w;
    if (/\d/.test(w)) return w;
    if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z]+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

const DEFAULT_TAXES = [
  { taxName: 'GST 0%',    taxCode: 'GST0',   taxRate: 0 },
  { taxName: 'GST 5%',    taxCode: 'GST5',   taxRate: 5 },
  { taxName: 'GST 12%',   taxCode: 'GST12',  taxRate: 12 },
  { taxName: 'GST 18%',   taxCode: 'GST18',  taxRate: 18 },
  { taxName: 'GST 28%',   taxCode: 'GST28',  taxRate: 28 },
  { taxName: 'Non-GST',   taxCode: 'NONGST', taxRate: 0 },
];

export interface ProductSearchResult {
  id: string;
  productCode: string;
  name: string;
  shortName: string | null;
  categoryLabel: string;
  categoryName: string;
  barcode: string | null;
  sellingPrice: number;
  mrp: number;
  gstRatePercent: number;
  taxId: string;
  unitOfMeasure: string;
  currentStock: number;
  allowNegativeStock: boolean;
  cessRate: number;
  pluCode: string | null;
  wholesalePrice: number | null;
  activePluCount: number;
  hasMultiplePlus: boolean;
  defaultPlu: {
    id: string;
    pluCode: string;
    sellingPrice: number;
    mrp: number;
    costPrice: number;
    gstRate: number;
    cessRate: number;
    wholesalePrice: number | null;
    stockOnHand: number;
  } | null;
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
    private shopCache: ShopCacheService,
  ) {}

  // ─── AUDIT LOG ──────────────────────────────────────────────────────────────

  private async audit(
    userId: string | null,
    businessId: string,
    action: string,
    entity: string,
    entityId: string,
    description: string,
    meta?: object,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId, businessId,
          userName: 'System',
          userRole: 'SUPER_ADMIN',
          action, entity, entityId, description,
          meta: meta ?? undefined,
        },
      });
    } catch { /* audit failures must never break the main flow */ }
  }

  // ─── NOTIFICATION HELPER ────────────────────────────────────────────────────

  async createNotification(businessId: string, type: string, title: string, message: string, productId?: string) {
    try {
      await this.prisma.notification.create({
        data: { businessId, type, title, message, productId: productId ?? null },
      });
    } catch { /* swallow */ }
  }

  // ─── TAX ────────────────────────────────────────────────────────────────────

  async seedTaxes(businessId: string) {
    const existing = await this.prisma.tax.count({ where: { businessId } });
    if (existing > 0) return { message: 'Tax rates already seeded', count: existing };
    await this.prisma.tax.createMany({
      data: DEFAULT_TAXES.map((t) => ({ businessId, ...t, isActive: true })),
    });
    return { message: 'Default GST rates seeded', count: DEFAULT_TAXES.length };
  }

  async getTaxes(businessId: string) {
    return this.prisma.tax.findMany({
      where: { businessId, isActive: true },
      orderBy: { taxRate: 'asc' },
    });
  }

  // ─── CATEGORY ───────────────────────────────────────────────────────────────

  async createCategory(businessId: string, dto: CreateCategoryDto) {
    const code = dto.code.toUpperCase();
    const byCode = await this.prisma.category.findUnique({
      where: { businessId_code: { businessId, code } },
    });
    if (byCode) throw new ConflictException(`Category code "${code}" already exists`);

    const created = await this.prisma.category.create({
      data: {
        businessId,
        name: dto.name,
        code,
        label: dto.label ?? dto.name,
        parentId: dto.parentId,
        departmentId: (dto as any).departmentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      },
      include: {
        parent:      { select: { id: true, name: true, label: true, code: true } },
        department:  { select: { id: true, name: true, code: true } },
        _count:      { select: { products: true, children: true } },
      },
    });
    try {
      this.eventsService.emitToBusiness(businessId, Events.CATEGORY_CREATED, {
        categoryId: created.id, code: created.code, name: created.name,
      });
    } catch (_err) { /* fire-and-forget */ }
    return created;
  }

  async updateCategory(businessId: string, id: string, body: {
    name?: string; sortOrder?: number; isActive?: boolean; departmentId?: string;
  }) {
    const cat = await this.prisma.category.findFirst({ where: { id, businessId } });
    if (!cat) throw new NotFoundException('Category not found');
    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(body.name         !== undefined ? { name: body.name.trim(), label: body.name.trim() } : {}),
        ...(body.sortOrder    !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive     !== undefined ? { isActive: body.isActive } : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId || null } : {}),
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        _count:     { select: { products: true, children: true } },
      },
    });
    try {
      this.eventsService.emitToBusiness(businessId, Events.CATEGORY_UPDATED, {
        categoryId: id, code: updated.code, name: updated.name,
      });
    } catch (_err) { /* fire-and-forget */ }
    return updated;
  }

  async deleteCategory(businessId: string, id: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id, businessId },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!cat) throw new NotFoundException('Category not found');
    if (cat._count.children > 0) {
      throw new BadRequestException(`Cannot delete — category has ${cat._count.children} sub-categories`);
    }
    if (cat._count.products > 0) {
      throw new BadRequestException(`Cannot delete — category has ${cat._count.products} products`);
    }
    await this.prisma.category.delete({ where: { id } });
    try {
      this.eventsService.emitToBusiness(businessId, Events.CATEGORY_DELETED, {
        categoryId: id, code: cat.code,
      });
    } catch (_err) { /* fire-and-forget */ }
    return { message: 'Category deleted' };
  }

  async getSubCategories(businessId: string, categoryId?: string, departmentId?: string) {
    const where: any = { businessId, parentId: { not: null } };
    if (categoryId)   where.parentId     = categoryId;
    if (departmentId) where.departmentId = departmentId;
    return this.prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent:     { select: { id: true, name: true, label: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
        _count:     { select: { products: true } },
      },
    });
  }

  async createSubCategory(businessId: string, body: { name: string; categoryId: string; sortOrder?: number; hsnCode?: string }) {
    const parent = await this.prisma.category.findFirst({
      where: { id: body.categoryId, businessId, parentId: null },
    });
    if (!parent) throw new NotFoundException('Parent category not found');

    const existing = await this.prisma.category.findMany({
      where: { businessId, parentId: body.categoryId },
      select: { code: true },
    });
    const prefix = `${parent.code}_`;
    const codeSet = new Set(existing.map((c) => c.code));
    let nn = existing.reduce((max, c) => {
      if (!c.code.startsWith(prefix)) return max;
      const suffix = c.code.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) return max;
      return Math.max(max, parseInt(suffix, 10));
    }, 0) + 1;
    let finalCode = `${parent.code}_${String(nn).padStart(2, '0')}`;
    while (codeSet.has(finalCode)) {
      nn++;
      finalCode = `${parent.code}_${String(nn).padStart(2, '0')}`;
    }

    const created = await this.prisma.category.create({
      data: {
        businessId,
        parentId: body.categoryId,
        departmentId: parent.departmentId,
        name: body.name.trim(),
        code: finalCode,
        label: body.name.trim(),
        sortOrder: body.sortOrder ?? 0,
        ...(body.hsnCode ? { hsnCode: body.hsnCode.trim() } : {}),
      },
      include: {
        parent:     { select: { id: true, name: true, label: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
    try {
      this.eventsService.emitToBusiness(businessId, Events.SUBCATEGORY_CREATED, {
        subcategoryId: created.id, code: created.code, name: created.name, parentId: body.categoryId,
      });
    } catch (_err) { /* fire-and-forget */ }
    return created;
  }

  async updateSubCategory(businessId: string, id: string, body: {
    name?: string; sortOrder?: number; isActive?: boolean; categoryId?: string; hsnCode?: string | null;
  }) {
    const cat = await this.prisma.category.findFirst({
      where: { id, businessId, parentId: { not: null } },
    });
    if (!cat) throw new NotFoundException('Sub-category not found');
    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(body.name       !== undefined ? { name: body.name.trim(), label: body.name.trim() } : {}),
        ...(body.sortOrder  !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive   !== undefined ? { isActive: body.isActive } : {}),
        ...(body.categoryId !== undefined ? { parentId: body.categoryId || null } : {}),
        ...(body.hsnCode    !== undefined ? { hsnCode: body.hsnCode ? body.hsnCode.trim() : null } : {}),
      },
    });
    try {
      this.eventsService.emitToBusiness(businessId, Events.SUBCATEGORY_UPDATED, {
        subcategoryId: id, code: updated.code, name: updated.name,
      });
    } catch (_err) { /* fire-and-forget */ }
    return updated;
  }

  async deleteSubCategory(businessId: string, id: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id, businessId, parentId: { not: null } },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) throw new NotFoundException('Sub-category not found');
    if (cat.code.endsWith('_GEN')) {
      throw new BadRequestException('Cannot delete the General fallback subcategory');
    }
    if (cat._count.products > 0) {
      throw new BadRequestException(`Cannot delete — sub-category has ${cat._count.products} products`);
    }
    await this.prisma.category.delete({ where: { id } });
    try {
      this.eventsService.emitToBusiness(businessId, Events.SUBCATEGORY_DELETED, {
        subcategoryId: id, code: cat.code,
      });
    } catch (_err) { /* fire-and-forget */ }
    return { message: 'Sub-category deleted' };
  }

  async applyHsnToSubcategory(businessId: string, subcategoryId: string, hsnCode: string, mode: 'ALL' | 'UNSET_ONLY') {
    const cat = await this.prisma.category.findFirst({
      where: { id: subcategoryId, businessId, parentId: { not: null } },
    });
    if (!cat) throw new NotFoundException('Sub-category not found');

    await this.prisma.category.update({ where: { id: subcategoryId }, data: { hsnCode: hsnCode.trim() } });

    const where: any = { businessId, categoryId: subcategoryId };
    if (mode === 'UNSET_ONLY') where.hsnCode = '0000';

    const { count } = await this.prisma.product.updateMany({ where, data: { hsnCode: hsnCode.trim() } });
    return { updated: count, subcategoryId, hsnCode };
  }

  async bulkApplyHsn(businessId: string, entries: { subcategoryId: string; hsnCode: string }[], mode: 'ALL' | 'UNSET_ONLY') {
    let total = 0;
    for (const entry of entries) {
      if (!entry.hsnCode || !/^\d+$/.test(entry.hsnCode) || ![4, 6, 8].includes(entry.hsnCode.length)) continue;
      const res = await this.applyHsnToSubcategory(businessId, entry.subcategoryId, entry.hsnCode, mode);
      total += res.updated;
    }
    return { totalProductsUpdated: total, entriesProcessed: entries.length };
  }

  async getHsnStats(businessId: string) {
    const subcategories = await this.prisma.category.findMany({
      where: { businessId, parentId: { not: null } },
      select: {
        id: true, name: true, code: true, hsnCode: true,
        parentId: true,
        parent: { select: { id: true, name: true, code: true, departmentId: true, department: { select: { id: true, name: true, code: true } } } },
        _count: { select: { products: true } },
      },
      orderBy: [{ parent: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    const subcatIds = subcategories.map((s) => s.id);
    const productHsns = await this.prisma.product.groupBy({
      by: ['categoryId', 'hsnCode'],
      where: { businessId, categoryId: { in: subcatIds } },
      _count: { id: true },
    });

    const hsnMap = new Map<string, { matched: number; different: number; unset: number }>();
    for (const row of productHsns) {
      if (!row.categoryId) continue;
      if (!hsnMap.has(row.categoryId)) hsnMap.set(row.categoryId, { matched: 0, different: 0, unset: 0 });
      const entry = hsnMap.get(row.categoryId)!;
      if (row.hsnCode === '0000' || !row.hsnCode) entry.unset += row._count.id;
      else entry.different += row._count.id;
    }

    const subcatsWithHsn = subcategories.filter((s) => s.hsnCode).length;
    const totalProducts = subcategories.reduce((sum, s) => sum + s._count.products, 0);

    for (const sub of subcategories) {
      const stats = hsnMap.get(sub.id);
      if (stats && sub.hsnCode) {
        const matchedGroup = productHsns.find((p) => p.categoryId === sub.id && p.hsnCode === sub.hsnCode);
        stats.matched = matchedGroup?._count.id ?? 0;
        stats.different = stats.different - (matchedGroup ? stats.different : 0);
        const unsetGroup = productHsns.find((p) => p.categoryId === sub.id && (p.hsnCode === '0000' || !p.hsnCode));
        stats.unset = unsetGroup?._count.id ?? 0;
        stats.different = (sub._count.products) - stats.matched - stats.unset;
        if (stats.different < 0) stats.different = 0;
      }
    }

    const coveredProducts = productHsns
      .filter((p) => p.hsnCode && p.hsnCode !== '0000')
      .reduce((sum, p) => sum + p._count.id, 0);

    return {
      summary: {
        totalSubcategories: subcategories.length,
        subcatsWithHsn,
        subcatsWithoutHsn: subcategories.length - subcatsWithHsn,
        totalProducts,
        coveredProducts,
        uncoveredProducts: totalProducts - coveredProducts,
      },
      subcategories: subcategories.map((s) => ({
        ...s,
        stats: hsnMap.get(s.id) ?? { matched: 0, different: 0, unset: s._count.products },
      })),
    };
  }

  async getCategories(businessId: string, departmentId?: string) {
    const where: any = { businessId, isActive: true, parentId: null };
    if (departmentId) where.departmentId = departmentId;
    const all = await this.prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, code: true, label: true,
        parentId: true, departmentId: true, sortOrder: true, isActive: true,
        department: { select: { id: true, name: true, code: true } },
        children: {
          where:   { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select:  { id: true, name: true, code: true, label: true, sortOrder: true, hsnCode: true },
        },
        _count: { select: { products: true, children: true } },
      },
    });
    return all;
  }

  async getCategoriesFlat(businessId: string) {
    return this.prisma.category.findMany({
      where:   { businessId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, code: true, label: true, parentId: true, departmentId: true, hsnCode: true,
        parent:     { select: { id: true, name: true, label: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getProductsByCategory(businessId: string, categoryId: string) {
    const cat = await this.prisma.category.findFirst({
      where:  { id: categoryId, businessId },
      select: { id: true, children: { select: { id: true } } },
    });
    if (!cat) throw new NotFoundException('Category not found');
    const ids = [cat.id, ...cat.children.map((c) => c.id)];
    return this.prisma.product.findMany({
      where:   { businessId, isActive: true, categoryId: { in: ids } },
      orderBy: { productCode: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, label: true, code: true, parent: { select: { id: true, name: true, label: true, code: true } } },
        },
        tax: { select: { id: true, taxName: true, taxRate: true } },
      },
    });
  }

  // ─── BRANDS ─────────────────────────────────────────────────────────────────

  async getBrands(businessId: string) {
    return this.prisma.brand.findMany({
      where:   { businessId, isActive: true },
      select:  { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async getMarginStats(businessId: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        p.id, p.name, p."sellingPrice", p."costPrice",
        c.name AS category,
        CASE WHEN p."sellingPrice" > 0 AND p."costPrice" > 0
          THEN ROUND(((p."sellingPrice" - p."costPrice") / p."sellingPrice" * 100)::numeric, 1)
          ELSE NULL END AS margin
      FROM product p
      LEFT JOIN category c ON p."categoryId" = c.id
      WHERE p."businessId" = ${businessId} AND p."isActive" = true AND p."sellingPrice" > 0
    `;

    const withMargin  = rows.filter(r => r.margin !== null);
    const zeroCost    = rows.filter(r => r.margin === null); // null margin ↔ costPrice is 0 or null (WHERE already filters sellingPrice > 0)
    const negative    = withMargin.filter(r => Number(r.margin) < 0)
                          .sort((a, b) => Number(a.margin) - Number(b.margin))
                          .slice(0, 10)
                          .map(r => ({ id: r.id, name: r.name, sellingPrice: Number(r.sellingPrice), costPrice: Number(r.costPrice), margin: Number(r.margin) }));

    // avgMargin excludes extreme outliers (|margin| > 100%) which are bulk-cost vs unit-price entry errors
    const reliable    = withMargin.filter(r => Math.abs(Number(r.margin)) <= 100);
    const avgMargin   = reliable.length
      ? Math.round(reliable.reduce((s, r) => s + Number(r.margin), 0) / reliable.length * 10) / 10
      : 0;
    const suspectCount = withMargin.length - reliable.length;

    // Category breakdown
    const catMap: Record<string, { total: number; count: number }> = {};
    for (const r of withMargin) {
      const cat = r.category || 'Uncategorised';
      if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
      catMap[cat].total += Number(r.margin);
      catMap[cat].count += 1;
    }
    const byCategory = Object.entries(catMap)
      .map(([name, v]) => ({ name, avgMargin: Math.round(v.total / v.count * 10) / 10, count: v.count }))
      .sort((a, b) => b.avgMargin - a.avgMargin);

    return {
      totalProducts:    rows.length,
      withCostPrice:    withMargin.length,
      zeroCostCount:    zeroCost.length,
      negativeCount:    negative.length,
      suspectCount,
      avgMargin,
      topCategories:    byCategory.slice(0, 8),
      bottomCategories: byCategory.slice(-5).reverse(),
      negativeMarginProducts: negative,
    };
  }

  async createBrand(businessId: string, name: string, code?: string) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new BadRequestException('Brand name required');
    try {
      return await this.prisma.brand.create({
        data: { businessId, name: trimmedName, code: code?.trim().toUpperCase() || null, isActive: true },
        select: { id: true, name: true, code: true },
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException(`Brand "${trimmedName}" already exists`);
      throw e;
    }
  }

  // ─── PRODUCT CODE ────────────────────────────────────────────────────────────

  private async generateProductCode(tx: any, businessId: string): Promise<string> {
    const last = await tx.product.findFirst({
      where:   { businessId, productCode: { not: null } },
      orderBy: { productCode: 'desc' },
      select:  { productCode: true },
    });
    const next = last?.productCode ? parseInt(last.productCode, 10) + 1 : 1;
    return String(next).padStart(6, '0');
  }

  // ─── PRODUCT CRUD ────────────────────────────────────────────────────────────

  async createProduct(businessId: string, dto: CreateProductDto, userId?: string, role?: string) {
    if (dto.mrp < dto.sellingPrice) throw new BadRequestException('MRP must be ≥ selling price');
    if (dto.barcode) {
      const dup = await this.prisma.product.findUnique({ where: { businessId_barcode: { businessId, barcode: dto.barcode } } });
      if (dup) throw new ConflictException(`Barcode "${dto.barcode}" already in use`);
    }
    const tax = await this.prisma.tax.findUnique({ where: { id: dto.taxId } });
    if (!tax || tax.businessId !== businessId) throw new BadRequestException('Invalid tax ID');
    // Only managers/admins may flag a product to bypass the 5% margin rule
    const allowBelowMargin = !!dto.allowBelowMargin && isManagerRole(role);
    assertMargin({
      sellingPrice: dto.sellingPrice,
      costPrice:    dto.costPrice ?? 0,
      gstRate:      dto.gstRatePercent ?? Number(tax.taxRate),
      cessRate:     (dto as any).cessRate ?? 0,
      label:        dto.name,
      bypass:       allowBelowMargin,
    });

    const product = await this.prisma.$transaction(async (tx) => {
      const productCode = await this.generateProductCode(tx, businessId);
      const binCode = [dto.aisle, dto.rackNumber, dto.shelfPosition].filter(Boolean).join('-') || null;

      const p = await tx.product.create({
        data: {
          businessId, productCode,
          taxId: dto.taxId, departmentId: dto.departmentId, categoryId: dto.categoryId, brandId: dto.brandId,
          name: tcField(dto.name) ?? dto.name, shortName: tcField(dto.shortName), barcode: dto.barcode,
          hsnCode: dto.hsnCode, unitOfMeasure: dto.unitOfMeasure ?? 'PCS',
          productType: dto.productType ?? 'STANDARD',
          mrp: dto.mrp, sellingPrice: dto.sellingPrice, costPrice: dto.costPrice,
          gstRatePercent: dto.gstRatePercent ?? Number(tax.taxRate),
          reorderLevel: dto.reorderLevel ?? 10, minimumStockLevel: dto.minimumStockLevel ?? 0,
          reorderQuantity: dto.reorderQuantity ?? 0, maximumStockLevel: dto.maximumStockLevel ?? 0,
          leadTimeDays: dto.leadTimeDays ?? 2, minSellingQty: dto.minSellingQty ?? 1,
          moqFromSupplier: dto.moqFromSupplier ?? 1,
          allowDecimalQty: dto.allowDecimalQty ?? false, allowNegativeStock: dto.allowNegativeStock ?? false,
          allowBelowMargin,
          isForSale: dto.isForSale ?? true, isForPurchase: dto.isForPurchase ?? true,
          isRepackingItem: dto.isRepackingItem ?? false, isPerishable: dto.isPerishable ?? false,
          expiryTracking: dto.expiryTracking ?? false, availableOnline: dto.availableOnline ?? false,
          shelfLifeDays: dto.shelfLifeDays ?? null, nearExpiryAlertDays: dto.nearExpiryAlertDays ?? null,
          preferredSupplierId: dto.preferredSupplierId,
          aisle: dto.aisle, rackNumber: dto.rackNumber, shelfPosition: dto.shelfPosition, binCode,
          imageUrl: dto.imageUrl, isActive: true,
          isReturnable: dto.isReturnable ?? true,
          returnPeriodDays: dto.returnPeriodDays ?? 7,
          nonReturnableReason: dto.nonReturnableReason ?? null,
          ...({
            defaultPackSize: dto.defaultPackSize ?? 1,
            brandName: dto.brandName ?? null,
            purchaseUnit: dto.purchaseUnit ?? 'PCS',
            stockUnit: dto.stockUnit ?? 'PCS',
            cessRate: dto.cessRate ?? 0,
          } as any),
        },
        include: { category: true, brand: true, tax: true },
      });

      if (dto.barcode) {
        await tx.productBarcode.create({ data: { productId: p.id, businessId, barcodeType: 'EAN13', barcodeValue: dto.barcode, isPrimary: true } });
      }
      await tx.productPrice.create({
        data: { productId: p.id, businessId, priceListType: 'RETAIL', costPrice: dto.costPrice ?? 0, sellingPrice: dto.sellingPrice, mrp: dto.mrp, maxDiscountPct: 5 },
      });

      // Auto-create first PLU
      const pluCode = `${productCode}001`;
      await tx.productPlu.create({
        data: {
          businessId, productId: p.id, pluCode,
          costPrice: dto.costPrice ?? 0,
          mrp: dto.mrp,
          sellingPrice: dto.sellingPrice,
          wholesalePrice: dto.wholesalePrice ?? null,
          minSellingPrice: dto.minSellingPrice ?? 0,
          receivedQty: 0, soldQty: 0, stockOnHand: 0,
          isDefault: true, isActive: true, isArchived: false,
          createdByName: 'System (auto-created)',
        },
      });

      // If no barcode provided, use PLU code as the product barcode
      if (!dto.barcode) {
        await tx.product.update({
          where: { id: p.id },
          data: { barcode: pluCode, ...(({ pluAutoBarcode: true }) as any) },
        });
        await tx.productBarcode.create({
          data: { productId: p.id, businessId, barcodeType: 'CODE128', barcodeValue: pluCode, isPrimary: true },
        });
        return { ...p, barcode: pluCode, pluCode, pluAutoBarcode: true };
      }

      return { ...p, pluCode };
    });

    this.audit(userId ?? null, businessId, 'CREATE', 'PRODUCT', product.id, `Product created: ${product.name} (${product.productCode})`, { productCode: product.productCode });
    try {
      this.eventsService.emitToBusiness(businessId, Events.PRODUCT_CREATED, {
        productId:   product.id,
        productCode: product.productCode,
        name:        product.name,
      });
    } catch (_err) { /* fire-and-forget */ }
    return product;
  }

  async getProducts(businessId: string, query: ProductQueryDto, role?: string) {
    const page  = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;
    const order = (query.sortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

    const where: any = { businessId };
    if (query.includeInactive) { /* show all products regardless of isActive */ }
    else if (query.isActive !== undefined) where.isActive = query.isActive;
    else where.isActive = true;

    // ── Bug fix 1: Department filter (was frontend-only, now applied at DB level)
    if (query.departmentId) where.departmentId = query.departmentId;

    // ── Category filter: subCategoryId takes priority, else expand main cat to include children
    if (query.subCategoryId) {
      where.categoryId = query.subCategoryId;
    } else if (query.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where:  { id: query.categoryId, businessId },
        select: { id: true, children: { select: { id: true } } },
      });
      const ids = cat ? [cat.id, ...cat.children.map((c) => c.id)] : [query.categoryId];
      where.categoryId = { in: ids };
    }

    if (query.brandId)     where.brandId     = query.brandId;
    if (query.productType) where.productType = query.productType;
    if (query.gstRate !== undefined) where.gstRatePercent = query.gstRate;
    if (query.hsnCode === 'UNSET') where.hsnCode = '0000';
    else if (query.hsnCode) where.hsnCode = query.hsnCode;

    if (query.imageFilter === 'WITH_IMAGE') {
      where.imageUrl = { not: null };
    } else if (query.imageFilter === 'WITHOUT_IMAGE') {
      where.imageUrl = null;
    }

    // ── Bug fix 2: Status filter — OUT_OF_STOCK was using unreliable autoInactiveReason.
    //    Now uses PLU stockOnHand (same source as frontend getStatus() / currentStock).
    if (query.status === 'DISABLED') {
      where.isManuallyDisabled = true;
    } else if (query.status === 'ACTIVE') {
      where.isManuallyDisabled = false;
      where.plusList = { some: { stockOnHand: { gt: 0 }, isActive: true, isArchived: false } };
    } else if (query.status === 'OUT_OF_STOCK') {
      where.isManuallyDisabled = false;
      where.plusList = { none: { stockOnHand: { gt: 0 }, isActive: true, isArchived: false } };
    }

    // ── Bug fix 3: stockStatus was post-filtering AFTER pagination (broke page counts + totals).
    //    Now filters at DB level using PLU stockOnHand so pagination and total are correct.
    //    LOW_STOCK still needs a post-filter since it compares against per-product reorderLevel.
    if (query.stockStatus === 'OUT_OF_STOCK') {
      // No PLU has stock > 0
      where.AND = [...(where.AND ?? []),
        { plusList: { none: { stockOnHand: { gt: 0 }, isActive: true, isArchived: false } } },
      ];
    } else if (query.stockStatus === 'IN_STOCK') {
      // At least one PLU has stock > 0
      where.AND = [...(where.AND ?? []),
        { plusList: { some: { stockOnHand: { gt: 0 }, isActive: true, isArchived: false } } },
      ];
    } else if (query.stockStatus === 'LOW_STOCK') {
      // Has some stock — LOW_STOCK post-filter will further narrow to <= reorderLevel
      where.AND = [...(where.AND ?? []),
        { plusList: { some: { stockOnHand: { gt: 0 }, isActive: true, isArchived: false } } },
      ];
    }

    if (query.search) {
      const wf = wildcardFilter(query.search);
      where.OR = [
        { name:        wf },
        { shortName:   wf },
        { barcode:     wf },
        { productCode: wf },
        { hsnCode:     wildcardFilter(query.search) },
      ];
    }

    // ── Build orderBy
    // 'stock' sort uses product.totalStock — a maintained denormalized field updated
    // on every GRN approval, sale, and stock adjustment. This gives a true global
    // DB-level sort so pagination correctly shows stocked products on page 1.
    // (Prisma relation-aggregate _sum in orderBy is not supported; totalStock is the right field.)
    const sortFieldMap: Record<string, any> = {
      code:           { productCode:    order },
      name:           { name:           order },
      mrp:            { mrp:            order },
      sellingPrice:   { sellingPrice:   order },
      gstRatePercent: { gstRatePercent: order },
      createdAt:      { createdAt:      order },
      stock:          { totalStock:     order },
    };
    const orderBy = [
      sortFieldMap[query.sortBy ?? 'code'] ?? { productCode: 'asc' },
      // Secondary sort: stable productCode tiebreaker for consistent pagination
      ...(query.sortBy && query.sortBy !== 'code' ? [{ productCode: 'asc' }] : []),
    ];

    const catSelect = {
      id: true, name: true, label: true, code: true,
      parent: { select: { id: true, name: true, label: true, code: true } },
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where, skip, take: limit, orderBy,
        include: {
          category: { select: catSelect },
          brand:    { select: { id: true, name: true } },
          tax:      { select: { id: true, taxName: true, taxRate: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Batch stock calculation for all returned products
    const productIds = products.map((p) => p.id);
    const branchId   = await this.getDefaultBranchId(businessId);
    const stockMap   = await this.batchStockCount(productIds, branchId);

    // Batch PLU enrichment
    const defaultPluMap     = new Map<string, any>();
    const activePluCountMap = new Map<string, number>();

    if (productIds.length > 0) {
      const defaultPlus = await this.prisma.productPlu.findMany({
        where: { productId: { in: productIds }, businessId, isDefault: true, isActive: true, isArchived: false },
        select: {
          id: true, productId: true, pluCode: true, sellingPrice: true, mrp: true,
          costPrice: true, gstRate: true, cessRate: true, wholesalePrice: true, stockOnHand: true,
          availableOnline: true, onlinePrice: true, displayName: true,
        },
      });
      defaultPlus.forEach((plu) => defaultPluMap.set(plu.productId, plu));

      const activePluCounts = await this.prisma.productPlu.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, businessId, isActive: true, isArchived: false },
        _count: { id: true },
      });
      activePluCounts.forEach((row) => activePluCountMap.set(row.productId, row._count.id));
    }

    const hideCost = !canViewCost(role);
    let enriched = products.map((p) => {
      const plu = defaultPluMap.get(p.id) ?? null;
      if (plu && hideCost) { delete plu.costPrice; delete (plu as any).basicCost; }
      return {
        ...p,
        costPrice:      hideCost ? undefined : (p as any).costPrice,
        currentStock:   stockMap.get(p.id) ?? 0,
        defaultPlu:     plu,
        activePluCount: activePluCountMap.get(p.id) ?? 0,
      };
    });

    // LOW_STOCK still needs post-filter (compares currentStock against per-product reorderLevel)
    if (query.stockStatus === 'LOW_STOCK') {
      enriched = enriched.filter((p) => p.currentStock > 0 && p.currentStock <= Number(p.reorderLevel));
    }

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getProductById(businessId: string, id: string, role?: string) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [product, soldMonth, soldLifetime] = await Promise.all([
      this.prisma.product.findFirst({
        where: { id, businessId },
        include: {
          category: {
            include: { parent: { select: { id: true, name: true, label: true, code: true } } },
          },
          brand: true, tax: true,
          barcodes: { where: { isActive: true } },
          prices:   { orderBy: { priceListType: 'asc' } },
        },
      }),
      this.prisma.salesItem.aggregate({
        where: { productId: id, bill: { businessId, billDate: { gte: monthStart } } },
        _sum: { quantity: true },
      }),
      this.prisma.salesItem.aggregate({
        where: { productId: id, bill: { businessId } },
        _sum: { quantity: true },
      }),
    ]);
    if (!product) throw new NotFoundException('Product not found');
    if (!canViewCost(role)) delete (product as any).costPrice;
    return {
      ...product,
      stats: {
        soldThisMonth:  Number(soldMonth._sum.quantity    ?? 0),
        lifetimeSold:   Number(soldLifetime._sum.quantity ?? 0),
      },
    };
  }

  async updateProduct(businessId: string, id: string, dto: UpdateProductDto, userId?: string, role?: string) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    const mrp    = dto.mrp    ?? Number(product.mrp);
    const sprice = dto.sellingPrice ?? Number(product.sellingPrice);
    if (mrp < sprice) throw new BadRequestException('MRP must be ≥ selling price');
    // Resolve the below-margin exception flag (only managers may change it)
    let allowBelowMargin = (product as any).allowBelowMargin ?? false;
    if (dto.allowBelowMargin !== undefined) {
      if (!isManagerRole(role)) throw new ForbiddenException('Only a manager can change the below-margin exception');
      allowBelowMargin = dto.allowBelowMargin;
    }
    // Enforce 5% margin when price/cost/tax is being changed
    if (dto.sellingPrice !== undefined || dto.costPrice !== undefined
        || dto.gstRatePercent !== undefined || (dto as any).cessRate !== undefined) {
      assertMargin({
        sellingPrice: sprice,
        costPrice:    dto.costPrice ?? Number(product.costPrice ?? 0),
        gstRate:      dto.gstRatePercent ?? Number(product.gstRatePercent ?? 0),
        cessRate:     (dto as any).cessRate ?? Number((product as any).cessRate ?? 0),
        label:        product.name,
        bypass:       allowBelowMargin,
      });
    }

    if (dto.barcode && dto.barcode !== product.barcode) {
      const dup = await this.prisma.product.findUnique({ where: { businessId_barcode: { businessId, barcode: dto.barcode } } });
      if (dup) throw new ConflictException(`Barcode "${dto.barcode}" already in use`);
    }

    const binCode = [dto.aisle ?? product.aisle, dto.rackNumber ?? product.rackNumber, dto.shelfPosition ?? product.shelfPosition]
      .filter(Boolean).join('-') || null;

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        taxId: dto.taxId, departmentId: dto.departmentId, categoryId: dto.categoryId, brandId: dto.brandId,
        name: dto.name !== undefined ? tcField(dto.name) ?? dto.name : undefined,
        shortName: dto.shortName !== undefined ? tcField(dto.shortName) : undefined,
        barcode: dto.barcode,
        hsnCode: dto.hsnCode, unitOfMeasure: dto.unitOfMeasure, productType: dto.productType,
        mrp: dto.mrp, sellingPrice: dto.sellingPrice, costPrice: dto.costPrice,
        gstRatePercent: dto.gstRatePercent, reorderLevel: dto.reorderLevel,
        minimumStockLevel: dto.minimumStockLevel, reorderQuantity: dto.reorderQuantity,
        maximumStockLevel: dto.maximumStockLevel, leadTimeDays: dto.leadTimeDays,
        minSellingQty: dto.minSellingQty, allowDecimalQty: dto.allowDecimalQty,
        allowNegativeStock: dto.allowNegativeStock,
        ...(dto.allowBelowMargin !== undefined ? { allowBelowMargin } : {}),
        isForSale: dto.isForSale,
        isForPurchase: dto.isForPurchase, isRepackingItem: dto.isRepackingItem,
        isPerishable: dto.isPerishable, expiryTracking: dto.expiryTracking,
        ...(dto.shelfLifeDays       !== undefined ? { shelfLifeDays:       dto.shelfLifeDays       } : {}),
        ...(dto.nearExpiryAlertDays !== undefined ? { nearExpiryAlertDays: dto.nearExpiryAlertDays } : {}),
        availableOnline: dto.availableOnline, aisle: dto.aisle, rackNumber: dto.rackNumber,
        shelfPosition: dto.shelfPosition, binCode, imageUrl: dto.imageUrl, isActive: dto.isActive,
        ...(dto.keywords    !== undefined ? { keywords:    dto.keywords    } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        isReturnable: dto.isReturnable, returnPeriodDays: dto.returnPeriodDays,
        nonReturnableReason: dto.isReturnable === false ? (dto.nonReturnableReason ?? null) : null,
        ...({
          defaultPackSize: dto.defaultPackSize,
          brandName: dto.brandName,
          purchaseUnit: dto.purchaseUnit,
          stockUnit: dto.stockUnit,
          cessRate: dto.cessRate,
        } as any),
      },
      include: { category: true, brand: true, tax: true },
    });

    this.audit(userId ?? null, businessId, 'UPDATE', 'PRODUCT', id,
      `Product updated: ${updated.name}`,
      { mrp: updated.mrp, sellingPrice: updated.sellingPrice },
    );
    try {
      this.eventsService.emitToBusiness(businessId, Events.PRODUCT_UPDATED, {
        productId:   id,
        productCode: updated.productCode,
      });
    } catch (_err) { /* fire-and-forget */ }

    // If cost price or MRP changed, archive old default PLU and create new one
    const costChanged = dto.costPrice !== undefined && Number(dto.costPrice) !== Number(product.costPrice);
    const mrpChanged  = dto.mrp !== undefined && Number(dto.mrp) !== Number(product.mrp);
    if (costChanged || mrpChanged) {
      try {
        const defaultPlu = await this.prisma.productPlu.findFirst({
          where: { productId: id, isDefault: true, isActive: true, isArchived: false },
          orderBy: { createdAt: 'desc' },
        });
        if (defaultPlu) {
          // Get next PLU sequence number
          const existingPlus = await this.prisma.productPlu.count({ where: { productId: id } });
          const seq = String(existingPlus + 1).padStart(3, '0');
          const newPluCode = `${updated.productCode}${seq}`;

          const [_archived, newPlu] = await this.prisma.$transaction([
            this.prisma.productPlu.update({
              where: { id: defaultPlu.id },
              data: { isDefault: false, isActive: false, isArchived: true, archivedAt: new Date(), archivedReason: 'Price changed' },
            }),
            this.prisma.productPlu.create({
              data: {
                businessId, productId: id, pluCode: newPluCode,
                costPrice: dto.costPrice ?? Number(product.costPrice ?? 0),
                mrp: dto.mrp ?? Number(product.mrp),
                sellingPrice: dto.sellingPrice ?? Number(product.sellingPrice),
                receivedQty: 0, soldQty: 0, stockOnHand: 0,
                isDefault: true, isActive: true, isArchived: false,
                createdByName: 'System (price change)',
              },
            }),
          ]);
          try {
            this.eventsService.emitToBusiness(businessId, Events.PLU_UPDATED, {
              pluId:         newPlu.id,
              productId:     id,
              pluCode:       newPlu.pluCode,
              archivedPluId: defaultPlu.id,
            });
          } catch (_err) { /* fire-and-forget */ }
        }
      } catch { /* PLU archival errors must never block product updates */ }
    }

    return updated;
  }

  // ─── TOGGLE STATUS (Feature 1) ───────────────────────────────────────────────

  async toggleStatus(businessId: string, id: string, action: 'DISABLE' | 'ENABLE', userId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    let data: any;
    if (action === 'DISABLE') {
      data = { isManuallyDisabled: true, disabledById: userId ?? null, disabledAt: new Date() };
    } else {
      data = { isManuallyDisabled: false, disabledById: null, disabledAt: null, disabledReason: null };
    }

    const updated = await this.prisma.product.update({ where: { id }, data });
    this.audit(userId ?? null, businessId, action === 'ENABLE' ? 'UPDATE' : 'UPDATE', 'PRODUCT', id, `Product ${action.toLowerCase()}d: ${product.name}`);
    return updated;
  }

  // ─── ONLINE VISIBILITY (Feature 2) ──────────────────────────────────────────

  async setOnlineVisibility(businessId: string, id: string, online: boolean, userId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.$transaction([
      // Update product-level flag
      this.prisma.product.update({
        where: { id },
        data:  { availableOnline: online },
      }),
      // Sync all active PLUs — storefront filters by PLU.availableOnline
      this.prisma.productPlu.updateMany({
        where: { productId: id, businessId, isActive: true, isArchived: false },
        data:  { availableOnline: online },
      }),
    ]);

    this.audit(userId ?? null, businessId, 'UPDATE', 'PRODUCT', id, `Product online visibility set to ${online}`);

    return { id, availableOnline: online };
  }

  async bulkSetOnlineVisibility(businessId: string, ids: string[], online: boolean, userId?: string) {
    if (!ids?.length) throw new BadRequestException('No product IDs provided');

    await this.prisma.$transaction([
      this.prisma.product.updateMany({
        where: { id: { in: ids }, businessId },
        data:  { availableOnline: online },
      }),
      this.prisma.productPlu.updateMany({
        where: { productId: { in: ids }, businessId, isActive: true, isArchived: false },
        data:  { availableOnline: online },
      }),
    ]);

    this.audit(userId ?? null, businessId, 'UPDATE', 'PRODUCT', 'bulk', `Bulk online visibility set to ${online} for ${ids.length} products`);

    return { updated: ids.length, availableOnline: online };
  }

  // ─── INLINE TAX UPDATE (Feature 3) ──────────────────────────────────────────

  // ─── PLU BUNDLE ─────────────────────────────────────────────────────────────

  async getPluBundle(businessId: string, pluId: string) {
    const [asBulk, asSingle] = await Promise.all([
      this.prisma.pluBundle.findFirst({
        where: { bulkPluId: pluId },
        include: {
          singlePlu: { select: { id: true, pluCode: true, mrp: true, sellingPrice: true, stockOnHand: true } },
        },
      }),
      this.prisma.pluBundle.findMany({
        where: { singlePluId: pluId },
        include: {
          bulkPlu: { select: { id: true, pluCode: true, mrp: true, sellingPrice: true, stockOnHand: true } },
        },
      }),
    ]);
    return { asBulk, asSingle };
  }

  async createPluBundle(businessId: string, body: {
    bulkPluId: string; singlePluId: string; conversionQty: number; notes?: string;
  }) {
    // Verify both PLUs belong to this business
    const [bulk, single] = await Promise.all([
      this.prisma.productPlu.findFirst({ where: { id: body.bulkPluId }, include: { product: { select: { businessId: true, name: true } } } }),
      this.prisma.productPlu.findFirst({ where: { id: body.singlePluId }, include: { product: { select: { businessId: true, name: true } } } }),
    ]);
    if (!bulk   || bulk.product.businessId   !== businessId) throw new NotFoundException('Bulk PLU not found');
    if (!single || single.product.businessId !== businessId) throw new NotFoundException('Single PLU not found');
    if (body.conversionQty < 1) throw new BadRequestException('Conversion qty must be >= 1');

    return this.prisma.pluBundle.upsert({
      where: { bulkPluId: body.bulkPluId },
      create: {
        businessId,
        bulkPluId:      body.bulkPluId,
        singlePluId:    body.singlePluId,
        conversionQty:  body.conversionQty,
        notes:          body.notes,
      },
      update: {
        singlePluId:   body.singlePluId,
        conversionQty: body.conversionQty,
        notes:         body.notes,
      },
    });
  }

  async deletePluBundle(businessId: string, bundleId: string) {
    const bundle = await this.prisma.pluBundle.findFirst({ where: { id: bundleId, businessId } });
    if (!bundle) throw new NotFoundException('Bundle not found');
    await this.prisma.pluBundle.delete({ where: { id: bundleId } });
    return { message: 'Bundle removed' };
  }

  async breakBulk(businessId: string, body: {
    bundleId: string; bulkQty: number; userId?: string; userName?: string; notes?: string;
  }) {
    const bundle = await this.prisma.pluBundle.findFirst({
      where: { id: body.bundleId, businessId },
      include: {
        bulkPlu:   { include: { product: { select: { id: true, name: true } } } },
        singlePlu: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    if (!bundle) throw new NotFoundException('PLU bundle not found');
    if (body.bulkQty < 1) throw new BadRequestException('Quantity must be at least 1');

    const bulkStock = Number(bundle.bulkPlu.stockOnHand ?? 0);
    if (bulkStock < body.bulkQty) {
      throw new BadRequestException(
        `Not enough bulk stock. Available: ${bulkStock}, requested: ${body.bulkQty}`
      );
    }

    const singlesCreated = body.bulkQty * bundle.conversionQty;

    await this.prisma.$transaction(async (tx) => {
      // Deduct from bulk PLU
      await tx.productPlu.update({
        where: { id: bundle.bulkPluId },
        data: { stockOnHand: { decrement: body.bulkQty } },
      });
      // Add to single PLU
      await tx.productPlu.update({
        where: { id: bundle.singlePluId },
        data: { stockOnHand: { increment: singlesCreated } },
      });
      // Log it
      await tx.breakBulkLog.create({
        data: {
          businessId,
          pluBundleId:    bundle.id,
          bulkPluId:      bundle.bulkPluId,
          singlePluId:    bundle.singlePluId,
          bulkQtyBroken:  body.bulkQty,
          singlesCreated,
          notes:          body.notes,
          createdById:    body.userId,
          createdByName:  body.userName,
        },
      });
      // Sync product.totalStock for both products
      const singleAgg = await tx.productPlu.aggregate({
        where: { productId: bundle.singlePlu.product.id },
        _sum: { stockOnHand: true },
      });
      await tx.product.update({
        where: { id: bundle.singlePlu.product.id },
        data: { totalStock: Number(singleAgg._sum.stockOnHand ?? 0) },
      });
      const bulkAgg = await tx.productPlu.aggregate({
        where: { productId: bundle.bulkPlu.product.id },
        _sum: { stockOnHand: true },
      });
      await tx.product.update({
        where: { id: bundle.bulkPlu.product.id },
        data: { totalStock: Number(bulkAgg._sum.stockOnHand ?? 0) },
      });
    });

    try {
      this.eventsService.emitToBusiness(businessId, Events.PLU_UPDATED, {
        productId: bundle.bulkPlu.product.id,
      });
      this.eventsService.emitToBusiness(businessId, Events.PLU_UPDATED, {
        productId: bundle.singlePlu.product.id,
      });
    } catch (_) { /* fire-and-forget */ }

    return {
      message:        `Opened ${body.bulkQty} bulk unit(s) → ${singlesCreated} singles created`,
      bulkQtyBroken:  body.bulkQty,
      singlesCreated,
      bulkPluCode:    bundle.bulkPlu.pluCode,
      singlePluCode:  bundle.singlePlu.pluCode,
    };
  }

  async breakBulkMulti(businessId: string, body: {
    bulkPluId: string;
    bulkQty: number;
    targets: { bundleId: string; singlesQty: number }[];
    notes?: string;
    userId?: string;
    userName?: string;
  }) {
    if (body.bulkQty < 1) throw new BadRequestException('Bulk quantity must be at least 1');
    if (!body.targets?.length) throw new BadRequestException('At least one target size required');

    // Load bulk PLU
    const bulkPlu = await this.prisma.productPlu.findFirst({
      where: { id: body.bulkPluId, businessId },
      include: { product: { select: { id: true, name: true } } },
    });
    if (!bulkPlu) throw new NotFoundException('Bulk PLU not found');

    const bulkStock = Number(bulkPlu.stockOnHand ?? 0);
    if (bulkStock < body.bulkQty) {
      throw new BadRequestException(
        `Not enough bulk stock. Available: ${bulkStock}, requested: ${body.bulkQty}`,
      );
    }

    // Load all target bundles + validate they belong to this bulk PLU
    const bundles = await this.prisma.pluBundle.findMany({
      where: { id: { in: body.targets.map(t => t.bundleId) }, businessId, bulkPluId: body.bulkPluId },
      include: { singlePlu: { include: { product: { select: { id: true } } } } },
    });
    if (bundles.length !== body.targets.length) {
      throw new BadRequestException('One or more bundle IDs are invalid or do not belong to this bulk PLU');
    }

    const targetMap = new Map(bundles.map(b => [b.id, b]));
    const summaryLines: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // Deduct bulk stock
      await tx.productPlu.update({
        where: { id: body.bulkPluId },
        data: { stockOnHand: { decrement: body.bulkQty } },
      });

      for (const t of body.targets) {
        if (t.singlesQty <= 0) continue;
        const bundle = targetMap.get(t.bundleId)!;
        // Add to single PLU
        await tx.productPlu.update({
          where: { id: bundle.singlePluId },
          data: { stockOnHand: { increment: t.singlesQty } },
        });
        // Log each conversion separately
        await tx.breakBulkLog.create({
          data: {
            businessId,
            pluBundleId:   bundle.id,
            bulkPluId:     body.bulkPluId,
            singlePluId:   bundle.singlePluId,
            bulkQtyBroken: body.bulkQty,
            singlesCreated: t.singlesQty,
            notes:         body.notes,
            createdById:   body.userId,
            createdByName: body.userName,
          },
        });
        // Update target product totalStock
        const agg = await tx.productPlu.aggregate({
          where: { productId: bundle.singlePlu.product.id, isActive: true, isArchived: false },
          _sum: { stockOnHand: true },
        });
        await tx.product.update({
          where: { id: bundle.singlePlu.product.id },
          data: { totalStock: Number(agg._sum.stockOnHand ?? 0) },
        });
        summaryLines.push(`${t.singlesQty} × ${bundle.singlePlu.pluCode}`);
      }

      // Update bulk product totalStock
      const bulkAgg = await tx.productPlu.aggregate({
        where: { productId: bulkPlu.product.id, isActive: true, isArchived: false },
        _sum: { stockOnHand: true },
      });
      await tx.product.update({
        where: { id: bulkPlu.product.id },
        data: { totalStock: Number(bulkAgg._sum.stockOnHand ?? 0) },
      });
    });

    return {
      message: `Opened ${body.bulkQty} bulk unit(s) → ${summaryLines.join(', ')}`,
      bulkQtyBroken: body.bulkQty,
      targets: summaryLines,
    };
  }

  async getBreakBulkHistory(businessId: string, pluId?: string) {
    const where: any = { businessId };
    if (pluId) where.OR = [{ bulkPluId: pluId }, { singlePluId: pluId }];
    return this.prisma.breakBulkLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateHsn(businessId: string, id: string, hsnCode: string, userId?: string) {
    const hsn = (hsnCode ?? '').trim();
    if (!/^\d+$/.test(hsn) || ![4, 6, 8].includes(hsn.length)) {
      throw new BadRequestException('HSN code must be 4, 6, or 8 numeric digits');
    }
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id }, data: { hsnCode: hsn } });
    try {
      this.eventsService.emitToBusiness(businessId, Events.PRODUCT_UPDATED, { productId: id });
    } catch (_) { /* fire-and-forget */ }
    return { id, hsnCode: hsn };
  }

  async updateTax(businessId: string, id: string, taxId: string, userId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    const tax = await this.prisma.tax.findFirst({ where: { id: taxId, businessId } });
    if (!tax) throw new BadRequestException('Invalid tax ID');

    const updated = await this.prisma.product.update({
      where: { id },
      data: { taxId, gstRatePercent: Number(tax.taxRate) },
      include: { tax: { select: { id: true, taxName: true, taxRate: true } } },
    });

    this.audit(userId ?? null, businessId, 'UPDATE', 'PRODUCT', id, `Tax changed to ${updated.gstRatePercent}% for ${product.name}`);
    return updated;
  }

  // ─── SMART SEARCH ────────────────────────────────────────────────────────────

  async smartSearch(businessId: string, q: string, branchId?: string): Promise<ProductSearchResult[]> {
    if (!q?.trim()) return [];
    const term = q.trim();

    const include = {
      tax:      { select: { id: true, taxRate: true } },
      category: { select: { id: true, name: true, label: true, parent: { select: { id: true, name: true, label: true } } } },
    };

    const posWhere = { businessId, isActive: true, isManuallyDisabled: false };

    const pluSelect = {
      id: true, pluCode: true, productId: true,
      sellingPrice: true, mrp: true, costPrice: true,
      gstRate: true, cessRate: true, wholesalePrice: true, stockOnHand: true,
      isDefault: true,
    };

    const hasStock = (p: any) => Number((p as any).totalStock ?? 0) > 0 || p.allowNegativeStock;

    const fmt = (p: any, defaultPlu: any | null, activePlus: any[]): ProductSearchResult => {
      const cat    = p.category;
      const parent = cat?.parent;
      const catLabel = cat ? (parent ? `${cat.label} (${parent.label})` : cat.label) : '';
      const sellingPrice   = defaultPlu ? Number(defaultPlu.sellingPrice) : Number(p.sellingPrice);
      const mrp            = defaultPlu ? Number(defaultPlu.mrp) : Number(p.mrp);
      const gstRatePercent = (defaultPlu && defaultPlu.gstRate != null)
        ? Number(defaultPlu.gstRate) : Number(p.gstRatePercent ?? p.tax?.taxRate ?? 0);
      const cessRate = defaultPlu ? Number(defaultPlu.cessRate ?? 0) : Number((p as any).cessRate ?? 0);
      return {
        id: p.id, productCode: p.productCode ?? '', name: p.name, shortName: p.shortName ?? null,
        categoryLabel: catLabel, categoryName: cat?.name ?? '',
        barcode: p.barcode ?? null, sellingPrice, mrp, gstRatePercent, taxId: p.taxId,
        unitOfMeasure: p.unitOfMeasure, allowNegativeStock: p.allowNegativeStock,
        currentStock: Number((p as any).totalStock ?? 0),
        cessRate,
        pluCode: defaultPlu?.pluCode ?? null,
        wholesalePrice: (defaultPlu?.wholesalePrice != null) ? Number(defaultPlu.wholesalePrice) : null,
        activePluCount: activePlus.length,
        hasMultiplePlus: activePlus.length > 1,
        defaultPlu: defaultPlu ? {
          id: defaultPlu.id, pluCode: defaultPlu.pluCode,
          sellingPrice: Number(defaultPlu.sellingPrice), mrp: Number(defaultPlu.mrp),
          costPrice: Number(defaultPlu.costPrice),
          gstRate: Number(defaultPlu.gstRate ?? 0), cessRate: Number(defaultPlu.cessRate ?? 0),
          wholesalePrice: (defaultPlu.wholesalePrice != null) ? Number(defaultPlu.wholesalePrice) : null,
          stockOnHand: Number(defaultPlu.stockOnHand),
        } : null,
      };
    };

    const fetchDefaultPlu = (productId: string) => this.prisma.productPlu.findFirst({
      where: { productId, businessId, isActive: true, isArchived: false, isDefault: true },
      orderBy: { createdAt: 'desc' },
      select: pluSelect,
    });

    const fetchActivePlus = (productId: string) => this.prisma.productPlu.findMany({
      where: { productId, businessId, isActive: true, isArchived: false, stockOnHand: { gt: 0 } },
      orderBy: { receivedDate: 'asc' },
      select: pluSelect,
    });

    const batchFmt = async (products: any[]): Promise<ProductSearchResult[]> => {
      if (products.length === 0) return [];
      const ids = products.map((p) => p.id);
      const [defaultPlus, activePlusAll] = await Promise.all([
        this.prisma.productPlu.findMany({
          where: { productId: { in: ids }, businessId, isActive: true, isArchived: false, isDefault: true },
          orderBy: { createdAt: 'desc' }, select: pluSelect,
        }),
        this.prisma.productPlu.findMany({
          where: { productId: { in: ids }, businessId, isActive: true, isArchived: false, stockOnHand: { gt: 0 } },
          orderBy: { receivedDate: 'asc' }, select: pluSelect,
        }),
      ]);
      const defMap = new Map<string, any>();
      for (const plu of defaultPlus) {
        const pid = (plu as any).productId as string;
        if (!defMap.has(pid)) defMap.set(pid, plu);
      }
      const actMap = new Map<string, any[]>();
      for (const plu of activePlusAll) {
        const pid = (plu as any).productId as string;
        if (!actMap.has(pid)) actMap.set(pid, []);
        actMap.get(pid)!.push(plu);
      }
      const results: ProductSearchResult[] = [];
      for (const p of products) {
        results.push(fmt(p, defMap.get(p.id) ?? null, actMap.get(p.id) ?? []));
      }
      return results;
    };

    // 1. ProductBarcode lookup → use barcode-linked PLU if set
    const byNewBarcode = await this.prisma.productBarcode.findFirst({
      where: { businessId, barcodeValue: term, isActive: true },
      include: { product: { include } },
    });
    if (byNewBarcode?.product && !byNewBarcode.product.isManuallyDisabled && byNewBarcode.product.isActive) {
      const p = byNewBarcode.product;
      if (!hasStock(p)) return [];
      let defaultPlu: any = null;
      if ((byNewBarcode as any).pluId) {
        defaultPlu = await this.prisma.productPlu.findFirst({
          where: { id: (byNewBarcode as any).pluId, isActive: true, isArchived: false },
          select: pluSelect,
        });
      }
      if (!defaultPlu) defaultPlu = await fetchDefaultPlu(p.id);
      const activePlus = await fetchActivePlus(p.id);
      return [fmt(p, defaultPlu, activePlus)];
    }

    // 2. PLU eanCode lookup
    const byPluEan = await this.prisma.productPlu.findFirst({
      where: { businessId, eanCode: term, isActive: true, isArchived: false },
      select: pluSelect,
    });
    if (byPluEan) {
      const p = await this.prisma.product.findFirst({ where: { id: (byPluEan as any).productId, ...posWhere }, include });
      if (p) {
        if (!hasStock(p)) return [];
        const activePlus = await fetchActivePlus(p.id);
        return [fmt(p, byPluEan, activePlus)];
      }
    }

    // 2b + 3. Pure digits → pad and try PLU code (9 digits) then product code (6 digits)
    if (/^\d+$/.test(term)) {
      const asPluCode     = term.padStart(9, '0');
      const asProductCode = term.padStart(6, '0');

      // Try PLU code first (9-digit pad)
      const byPluCode = await this.prisma.productPlu.findFirst({
        where: { businessId, pluCode: asPluCode, isActive: true, isArchived: false },
        select: pluSelect,
      });
      if (byPluCode) {
        const p = await this.prisma.product.findFirst({
          where: { id: (byPluCode as any).productId, ...posWhere },
          include,
        });
        if (p) {
          if (!hasStock(p)) return [];
          const activePlus = await fetchActivePlus(p.id);
          const result = fmt(p, byPluCode, activePlus);
          result.hasMultiplePlus = false;
          return [result];
        }
      }

      // Try product code second (6-digit pad)
      const byCode = await this.prisma.product.findFirst({ where: { ...posWhere, productCode: asProductCode }, include });
      if (byCode) {
        if (!hasStock(byCode)) return [];
        const [defaultPlu, activePlus] = await Promise.all([fetchDefaultPlu(byCode.id), fetchActivePlus(byCode.id)]);
        return [fmt(byCode, defaultPlu, activePlus)];
      }
    }

    // 4. Legacy barcode field
    const byBarcode = await this.prisma.product.findFirst({ where: { ...posWhere, barcode: term }, include });
    if (byBarcode) {
      if (!hasStock(byBarcode)) return [];
      const [defaultPlu, activePlus] = await Promise.all([fetchDefaultPlu(byBarcode.id), fetchActivePlus(byBarcode.id)]);
      return [fmt(byBarcode, defaultPlu, activePlus)];
    }

    // 5. Category label (incl. sub-category children)
    const catMatches = await this.prisma.category.findMany({
      where:  { businessId, label: { contains: term, mode: 'insensitive' } },
      select: { id: true, children: { select: { id: true } } },
    });
    if (catMatches.length > 0) {
      const catIds = new Set<string>();
      for (const c of catMatches) { catIds.add(c.id); for (const ch of c.children) catIds.add(ch.id); }
      const byCat = await this.prisma.product.findMany({
        where: { ...posWhere, categoryId: { in: [...catIds] } }, take: 15, orderBy: { productCode: 'asc' }, include,
      });
      const filtered = await batchFmt(byCat);
      if (filtered.length > 0) return filtered;
    }

    // 6. Name / brand partial match
    const byName = await this.prisma.product.findMany({
      where: { ...posWhere, OR: [{ name: { contains: term, mode: 'insensitive' } }, { shortName: { contains: term, mode: 'insensitive' } }, { brand: { name: { contains: term, mode: 'insensitive' } } }] },
      take: 15, orderBy: { productCode: 'asc' },
      include: { ...include, brand: { select: { id: true, name: true } } },
    });
    return batchFmt(byName);
  }

  async searchProducts(businessId: string, q: string) {
    return this.smartSearch(businessId, q);
  }

  async searchByName(businessId: string, q: string) {
    if (!q?.trim()) return [];
    return this.prisma.product.findMany({
      where: {
        businessId,
        name: { contains: q.trim(), mode: 'insensitive' },
      },
      take: 8,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, productCode: true, isActive: true },
    });
  }

  // ─── PLU MANAGEMENT ─────────────────────────────────────────────────────────

  async getPlusForProduct(businessId: string, productId: string, role?: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    const plus = await this.prisma.productPlu.findMany({
      where: { productId, businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        barcodes: { where: { isActive: true }, select: { id: true, barcodeValue: true, barcodeType: true, isPrimary: true } },
      },
    });
    if (!canViewCost(role)) {
      return plus.map(p => { const r = { ...p } as any; delete r.costPrice; delete r.basicCost; return r; });
    }
    return plus;
  }

  async getActivePlusForProduct(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.productPlu.findMany({
      where: { productId, businessId, isActive: true, isArchived: false },
      orderBy: { createdAt: 'desc' },
      include: {
        barcodes: { where: { isActive: true }, select: { id: true, barcodeValue: true, barcodeType: true, isPrimary: true } },
      },
    });
  }

  async createPlu(businessId: string, productId: string, body: {
    eanCode?: string; basicCost?: number; costPrice?: number;
    mrp: number; sellingPrice: number; wholesalePrice?: number;
    minSellingPrice?: number; gstRate?: number; hsnCode?: string;
    cessRate?: number; taxInclusive?: boolean; openingStock?: number;
  }) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    if (body.mrp < body.sellingPrice) throw new BadRequestException('MRP must be >= selling price');
    assertMargin({
      sellingPrice: body.sellingPrice,
      costPrice:    body.costPrice ?? body.basicCost ?? 0,
      gstRate:      body.gstRate ?? Number(product.gstRatePercent ?? 0),
      cessRate:     body.cessRate ?? Number((product as any).cessRate ?? 0),
      label:        product.name,
      bypass:       (product as any).allowBelowMargin ?? false,
    });

    const newPlu = await this.prisma.$transaction(async (tx) => {
      const existingCount = await tx.productPlu.count({ where: { productId } });
      let seq = existingCount + 1;
      let pluCode = `${product.productCode}${String(seq).padStart(3, '0')}`;
      while (await tx.productPlu.findUnique({ where: { businessId_pluCode: { businessId, pluCode } } })) {
        seq++;
        pluCode = `${product.productCode}${String(seq).padStart(3, '0')}`;
      }

      const costPrice  = body.costPrice ?? body.basicCost ?? 0;
      const mrp        = body.mrp;
      const marginRs   = mrp > 0 ? this.r2(mrp - costPrice) : 0;
      const marginPct  = mrp > 0 ? Math.round(((mrp - costPrice) / mrp) * 100 * 10000) / 10000 : 0;
      const openStock  = body.openingStock ?? 0;

      await tx.productPlu.updateMany({
        where: { productId, businessId, isDefault: true },
        data:  { isDefault: false },
      });

      const newPlu = await tx.productPlu.create({
        data: {
          businessId, productId, pluCode,
          eanCode:        body.eanCode ?? null,
          basicCost:      body.basicCost ?? costPrice,
          costPrice,
          mrp,
          sellingPrice:   body.sellingPrice,
          wholesalePrice: body.wholesalePrice ?? null,
          minSellingPrice: body.minSellingPrice ?? 0,
          gstRate:        body.gstRate ?? Number(product.gstRatePercent ?? 0),
          hsnCode:        body.hsnCode ?? product.hsnCode ?? null,
          cessRate:       body.cessRate ?? 0,
          taxInclusive:   body.taxInclusive ?? false,
          marginPercent:  marginPct,
          marginRs,
          stockOnHand:    openStock,
          receivedQty:    openStock,
          soldQty:        0,
          isDefault:      true,
          isActive:       true,
          isArchived:     false,
          effectiveFrom:  new Date(),
          createdByName:  'Manual entry',
        },
      });

      const agg = await tx.productPlu.aggregate({
        where: { productId, isActive: true, isArchived: false },
        _sum:  { stockOnHand: true },
      });
      // New PLU is the default — sync product master prices + stock
      await tx.product.update({
        where: { id: productId },
        data: {
          totalStock:   Number(agg._sum.stockOnHand ?? 0),
          mrp:          newPlu.mrp,
          sellingPrice: newPlu.sellingPrice,
          ...(newPlu.costPrice != null ? { costPrice: newPlu.costPrice } : {}),
          ...(newPlu.gstRate   != null ? { gstRatePercent: newPlu.gstRate } : {}),
        } as any,
      });

      return newPlu;
    });

    try {
      this.eventsService.emitToBusiness(businessId, Events.PLU_CREATED, {
        pluId: newPlu.id, productId, pluCode: newPlu.pluCode,
        sellingPrice: Number(newPlu.sellingPrice),
      });
    } catch (_err) { /* fire-and-forget */ }

    // Bust shop cache: new PLU may change price/availability on the storefront
    this.shopCache.bustProduct(product.productCode ?? '').catch(() => {});
    this.shopCache.bustNavigation().catch(() => {});

    return newPlu;
  }

  /** Flag/unflag a product to allow pricing below the minimum-margin rule (manager only). */
  async setAllowBelowMargin(businessId: string, productId: string, allow: boolean, role?: string) {
    if (!isManagerRole(role)) throw new ForbiddenException('Only a manager can change the below-margin exception');
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.update({ where: { id: productId }, data: { allowBelowMargin: allow } });
    return { productId, allowBelowMargin: allow };
  }

  async updatePlu(businessId: string, productId: string, pluId: string, body: {
    eanCode?: string; mrp?: number; sellingPrice?: number; wholesalePrice?: number;
    minSellingPrice?: number; gstRate?: number; cessRate?: number; taxInclusive?: boolean;
    availableOnline?: boolean; onlinePrice?: number | null;
    onlineStockCap?: number | null;
    packLabel?: string | null;
  }) {
    const plu = await this.prisma.productPlu.findFirst({ where: { id: pluId, productId, businessId } });
    if (!plu) throw new NotFoundException('PLU not found');
    if (body.mrp !== undefined && body.sellingPrice !== undefined && body.mrp < body.sellingPrice)
      throw new BadRequestException('MRP must be >= selling price');
    if (body.mrp !== undefined && body.sellingPrice === undefined && body.mrp < Number(plu.sellingPrice))
      throw new BadRequestException('MRP must be >= current selling price');
    // Enforce margin only when a price/tax field is genuinely being changed.
    // If the frontend sends back the same value that's already stored (e.g. user
    // only toggled availableOnline), skip the check so old under-margin PLUs
    // can still be updated for non-price fields.
    const spChanged   = body.sellingPrice !== undefined && Number(body.sellingPrice) !== Number(plu.sellingPrice);
    const gstChanged  = body.gstRate      !== undefined && Number(body.gstRate)      !== Number(plu.gstRate  ?? 0);
    const cessChanged = body.cessRate     !== undefined && Number(body.cessRate)     !== Number(plu.cessRate ?? 0);
    if (spChanged || gstChanged || cessChanged) {
      const prod = await this.prisma.product.findUnique({
        where: { id: productId }, select: { allowBelowMargin: true },
      });
      assertMargin({
        sellingPrice: body.sellingPrice ?? Number(plu.sellingPrice),
        costPrice:    Number(plu.costPrice ?? 0),
        gstRate:      body.gstRate  ?? Number(plu.gstRate ?? 0),
        cessRate:     body.cessRate ?? Number(plu.cessRate ?? 0),
        bypass:       (prod as any)?.allowBelowMargin ?? false,
      });
    }
    const updated = await this.prisma.productPlu.update({
      where: { id: pluId },
      data: {
        ...(body.eanCode            !== undefined ? { eanCode: body.eanCode }                   : {}),
        ...(body.mrp                !== undefined ? { mrp: body.mrp }                           : {}),
        ...(body.sellingPrice       !== undefined ? { sellingPrice: body.sellingPrice }         : {}),
        ...(body.wholesalePrice     !== undefined ? { wholesalePrice: body.wholesalePrice }     : {}),
        ...(body.minSellingPrice    !== undefined ? { minSellingPrice: body.minSellingPrice }   : {}),
        ...(body.gstRate            !== undefined ? { gstRate: body.gstRate }                   : {}),
        ...(body.cessRate           !== undefined ? { cessRate: body.cessRate }                 : {}),
        ...(body.taxInclusive       !== undefined ? { taxInclusive: body.taxInclusive }         : {}),
        ...(body.availableOnline    !== undefined ? { availableOnline: body.availableOnline }     : {}),
        ...(body.onlinePrice        !== undefined ? { onlinePrice: body.onlinePrice }             : {}),
        ...(body.onlineStockCap     !== undefined ? { onlineStockCap: body.onlineStockCap }       : {}),
        ...(body.packLabel          !== undefined ? { displayName: body.packLabel }               : {}),
      },
    });
    // Keep product master prices in sync with its default PLU
    if (updated.isDefault) {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          mrp: updated.mrp,
          sellingPrice: updated.sellingPrice,
          ...(updated.costPrice != null ? { costPrice: updated.costPrice } : {}),
          ...(updated.gstRate   != null ? { gstRatePercent: updated.gstRate } : {}),
        },
      });
    }
    try {
      this.eventsService.emitToBusiness(businessId, Events.PLU_UPDATED, {
        pluId, productId, pluCode: plu.pluCode,
      });
    } catch (_err) { /* fire-and-forget */ }

    // Bust shop cache: price, MRP, availableOnline or packLabel changed
    const prod = await this.prisma.product.findUnique({ where: { id: productId }, select: { productCode: true } });
    if (prod?.productCode) {
      this.shopCache.bustProduct(prod.productCode).catch(() => {});
      if (body.availableOnline !== undefined) this.shopCache.bustNavigation().catch(() => {});
    }

    return updated;
  }

  async setDefaultPlu(businessId: string, productId: string, pluId: string) {
    const plu = await this.prisma.productPlu.findFirst({
      where: { id: pluId, productId, businessId, isActive: true },
    });
    if (!plu) throw new NotFoundException('PLU not found or inactive');
    await this.prisma.$transaction([
      this.prisma.productPlu.updateMany({ where: { productId, businessId, isDefault: true }, data: { isDefault: false } }),
      this.prisma.productPlu.update({ where: { id: pluId }, data: { isDefault: true } }),
      // Sync product master prices to the new default PLU
      this.prisma.product.update({
        where: { id: productId },
        data: {
          mrp: plu.mrp,
          sellingPrice: plu.sellingPrice,
          ...(plu.costPrice != null ? { costPrice: plu.costPrice } : {}),
          ...(plu.gstRate   != null ? { gstRatePercent: plu.gstRate } : {}),
        },
      }),
    ]);
    try {
      this.eventsService.emitToBusiness(businessId, Events.PLU_UPDATED, {
        pluId, productId, pluCode: plu.pluCode,
      });
    } catch (_err) { /* fire-and-forget */ }

    const prod = await this.prisma.product.findUnique({ where: { id: productId }, select: { productCode: true } });
    if (prod?.productCode) this.shopCache.bustProduct(prod.productCode).catch(() => {});

    return { message: 'Default PLU updated' };
  }

  async deactivatePlu(businessId: string, productId: string, pluId: string, reason?: string) {
    const plu = await this.prisma.productPlu.findFirst({ where: { id: pluId, productId, businessId } });
    if (!plu) throw new NotFoundException('PLU not found');
    if (!plu.isActive) throw new BadRequestException('PLU is already inactive');

    await this.prisma.productPlu.update({
      where: { id: pluId },
      data: {
        isActive:       false,
        archivedReason: reason ?? null,
        ...(plu.isDefault ? { isDefault: false } : {}),
      },
    });

    if (plu.isDefault) {
      const next = await this.prisma.productPlu.findFirst({
        where: { productId, businessId, isActive: true, isArchived: false },
        orderBy: { createdAt: 'desc' },
      });
      if (next) await this.prisma.productPlu.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    const agg = await this.prisma.productPlu.aggregate({
      where: { productId, isActive: true, isArchived: false },
      _sum:  { stockOnHand: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data:  { totalStock: Number(agg._sum.stockOnHand ?? 0) } as any,
    });

    try {
      this.eventsService.emitToBusiness(businessId, Events.PLU_ARCHIVED, {
        pluId, productId, pluCode: plu.pluCode,
      });
    } catch (_err) { /* fire-and-forget */ }

    // Deactivating a PLU changes online visibility and stock — bust both
    const prod = await this.prisma.product.findUnique({ where: { id: productId }, select: { productCode: true } });
    if (prod?.productCode) {
      this.shopCache.bustProduct(prod.productCode).catch(() => {});
      this.shopCache.bustNavigation().catch(() => {});
    }

    return { message: 'PLU deactivated' };
  }

  async getProductStockHistory(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.stockLedger.findMany({
      where: { productId, businessId },
      orderBy: { movementDate: 'desc' },
      take: 200,
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  async getProductSales(
    businessId: string, productId: string,
    query: { page?: string; limit?: string; dateFrom?: string; dateTo?: string },
  ) {
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip  = (page - 1) * limit;

    const billWhere: any = { businessId };
    if (query.dateFrom) billWhere.billDate = { ...billWhere.billDate, gte: new Date(query.dateFrom) };
    if (query.dateTo)   billWhere.billDate = { ...billWhere.billDate, lte: new Date(query.dateTo) };

    const where = { productId, bill: billWhere };
    const [rows, total] = await Promise.all([
      this.prisma.salesItem.findMany({
        where,
        orderBy: { bill: { billDate: 'desc' } },
        skip, take: limit,
        include: { bill: { select: { id: true, billNumber: true, billDate: true, grandTotal: true, status: true } } },
      }),
      this.prisma.salesItem.count({ where }),
    ]);
    return { data: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getProductPurchases(
    businessId: string, productId: string,
    query: { page?: string; limit?: string },
    isOwner: boolean,
  ) {
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip  = (page - 1) * limit;

    const where = { productId, purchase: { businessId } };
    const [rows, total] = await Promise.all([
      this.prisma.purchaseItem.findMany({
        where,
        orderBy: { purchase: { invoiceDate: 'desc' } },
        skip, take: limit,
        include: {
          purchase: { select: { id: true, grnNumber: true, invoiceDate: true, supplierId: true, supplierName: true, status: true } },
        },
      }),
      this.prisma.purchaseItem.count({ where }),
    ]);
    const data = rows.map(r => {
      if (isOwner) return r;
      const row = { ...r } as any;
      delete row.netCostPrice; delete row.trueCostPrice; delete row.lastCostPrice;
      return row;
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getProductSuppliers(businessId: string, productId: string, isOwner: boolean) {
    const rows = await this.prisma.$queryRaw<Array<{
      supplierId: string; supplierName: string; timesOrdered: bigint;
      lastOrderDate: Date | null; lastUnitCost: string | null; totalQty: string | null;
    }>>(Prisma.sql`
      SELECT p."supplierId", p."supplierName",
        COUNT(DISTINCT p.id)::bigint AS "timesOrdered",
        MAX(p."invoiceDate") AS "lastOrderDate",
        MAX(pi."netCostPrice")::text AS "lastUnitCost",
        SUM(pi."totalReceivedQty")::text AS "totalQty"
      FROM purchase_item pi
      JOIN purchase p ON pi."purchaseId" = p.id
      WHERE pi."productId" = ${productId} AND p."businessId" = ${businessId} AND p.status = 'APPROVED'
      GROUP BY p."supplierId", p."supplierName"
      ORDER BY COUNT(DISTINCT p.id) DESC
    `);
    return rows.map(r => ({
      supplierId:    r.supplierId,
      supplierName:  r.supplierName,
      timesOrdered:  Number(r.timesOrdered),
      lastOrderDate: r.lastOrderDate,
      lastUnitCost:  isOwner ? (r.lastUnitCost !== null ? Number(r.lastUnitCost) : null) : null,
      totalQty:      r.totalQty ? Number(r.totalQty) : 0,
    }));
  }

  private r2(n: number) { return Math.round(n * 100) / 100; }

  // ─── PRIVATE HELPERS ──────────────────────────────────────────────────────

  private async getDefaultBranchId(businessId: string): Promise<string | null> {
    const branch = await this.prisma.branch.findFirst({ where: { businessId, isActive: true }, orderBy: { createdAt: 'asc' } });
    return branch?.id ?? null;
  }

  private async batchStockCount(productIds: string[], branchId: string | null): Promise<Map<string, number>> {
    if (!branchId || productIds.length === 0) return new Map();
    const aggs = await this.prisma.stockLedger.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, branchId },
      _sum: { quantity: true },
    });
    return new Map(aggs.map((a) => [a.productId, Number(a._sum.quantity ?? 0)]));
  }

  private async getStockCount(productId: string, branchId: string): Promise<number> {
    const agg = await this.prisma.stockLedger.aggregate({
      where: { productId, branchId },
      _sum:  { quantity: true },
    });
    return Number(agg._sum.quantity ?? 0);
  }

  // ─── PRODUCT IMAGE ────────────────────────────────────────────────────────────

  private get imagesDir(): string {
    return process.env.PRODUCT_IMAGES_DIR
      ?? path.join(process.cwd(), '..', 'storage', 'product-images');
  }

  async uploadProductImage(
    businessId: string,
    productId: string,
    file: Express.Multer.File,
  ): Promise<{ imageUrl: string }> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      throw new BadRequestException('Only jpg, png, and webp images are allowed');
    }

    fs.mkdirSync(this.imagesDir, { recursive: true });

    // Remove any existing images for this product code (never touch noimage.*)
    const base = product.productCode ?? productId;
    if (base === 'noimage') throw new BadRequestException('Reserved filename');
    const exts = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
    for (const e of exts) {
      const existing = path.join(this.imagesDir, `${base}${e}`);
      if (fs.existsSync(existing)) fs.unlinkSync(existing);
    }

    const filename = `${base}${ext}`;
    fs.writeFileSync(path.join(this.imagesDir, filename), file.buffer);

    const imageUrl = `/uploads/products/${filename}`;
    await this.prisma.product.update({ where: { id: productId }, data: { imageUrl } });

    try {
      this.eventsService.emitToBusiness(businessId, Events.PRODUCT_UPDATED, { productId, productCode: product.productCode });
    } catch (_err) { /* fire-and-forget */ }

    return { imageUrl };
  }

  async deleteProductImage(businessId: string, productId: string): Promise<{ message: string }> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    if (product.imageUrl) {
      const base = product.productCode ?? productId;
      if (base !== 'noimage') {
        const exts = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
        for (const e of exts) {
          const p = path.join(this.imagesDir, `${base}${e}`);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
      }
      await this.prisma.product.update({ where: { id: productId }, data: { imageUrl: null } });

      try {
        this.eventsService.emitToBusiness(businessId, Events.PRODUCT_UPDATED, { productId, productCode: product.productCode });
      } catch (_err) { /* fire-and-forget */ }
    }

    return { message: 'Image removed' };
  }

  // ─── ONLINE VISIBILITY AUDIT ──────────────────────────────────────────────

  async getOnlineAudit(businessId: string, filter?: string, search?: string) {
    const n = (v: any) => parseFloat(String(v ?? 0)) || 0;

    // Fetch all active, non-disabled products with their online PLUs
    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        ...(search?.trim() ? {
          OR: [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { productCode: { contains: search.trim(), mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true,
        productCode: true,
        name: true,
        imageUrl: true,
        isManuallyDisabled: true,
        totalStock: true,
        reorderLevel: true,
        allowNegativeStock: true,
        categoryId: true,
        category: { select: { label: true, name: true, parent: { select: { label: true } } } },
        plusList: {
          where: { isActive: true, isArchived: false },
          select: {
            id: true,
            pluCode: true,
            displayName: true,
            sellingPrice: true,
            mrp: true,
            costPrice: true,
            gstRate: true,
            onlinePrice: true,
            onlineStockCap: true,
            availableOnline: true,
            isActive: true,
            barcodes: { where: { isActive: true }, select: { id: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const results = products.map(p => {
      const totalStock = n(p.totalStock);
      const onlinePlus = p.plusList.filter(pl => pl.availableOnline);
      const isOnline   = onlinePlus.length > 0;

      // Per-PLU issues (use online PLU if available, else first active PLU)
      const checkPlu = onlinePlus[0] ?? p.plusList[0] ?? null;
      const selling  = n(checkPlu?.sellingPrice);
      const mrp      = n(checkPlu?.mrp);
      const cost     = n(checkPlu?.costPrice);
      const gst      = n(checkPlu?.gstRate);
      const hasBarcode = (checkPlu?.barcodes?.length ?? 0) > 0;

      // Issue flags
      const flags: string[] = [];
      if (!checkPlu)                                  flags.push('NO_PLU');
      if (checkPlu && selling === 0)                  flags.push('ZERO_PRICE');
      if (checkPlu && mrp === 0)                      flags.push('ZERO_MRP');
      if (checkPlu && mrp > 0 && selling > mrp)       flags.push('SELLING_ABOVE_MRP');
      if (checkPlu && cost > 0 && selling > 0 && selling < cost) flags.push('BELOW_COST');
      if (checkPlu && cost === 0)                     flags.push('NO_COST_PRICE');
      if (checkPlu && gst === 0)                      flags.push('NO_GST');
      if (!p.imageUrl)                                flags.push('NO_IMAGE');
      if (!checkPlu?.displayName)                     flags.push('NO_PACK_LABEL');
      if (!hasBarcode)                                flags.push('NO_BARCODE');
      if (!p.categoryId)                              flags.push('NO_CATEGORY');
      if (p.isManuallyDisabled)                       flags.push('MANUALLY_DISABLED');
      if (isOnline && totalStock <= 0 && !p.allowNegativeStock) flags.push('OUT_OF_STOCK');
      if (isOnline && p.reorderLevel && totalStock > 0 && totalStock <= n(p.reorderLevel)) flags.push('LOW_STOCK');

      // Auto-block: should NOT be online
      const shouldBlock = flags.some(f => ['NO_PLU','ZERO_PRICE','ZERO_MRP','SELLING_ABOVE_MRP','BELOW_COST','MANUALLY_DISABLED'].includes(f));

      return {
        id:            p.id,
        productCode:   p.productCode,
        name:          p.name,
        imageUrl:      p.imageUrl ?? null,
        isOnline,
        shouldBlock,
        totalStock,
        selling,
        mrp,
        cost,
        gst,
        hasBarcode,
        category:      p.category?.parent?.label ?? p.category?.label ?? null,
        packLabel:     checkPlu?.displayName ?? null,
        onlinePluCode: onlinePlus[0]?.pluCode ?? null,
        pluId:         checkPlu?.id ?? null,
        flags,
      };
    });

    // Apply filter
    const filtered = (() => {
      switch (filter) {
        case 'HEALTHY':            return results.filter(r => r.isOnline && r.flags.length === 0);
        case 'CRITICAL':           return results.filter(r => r.shouldBlock);
        case 'ZERO_PRICE':         return results.filter(r => r.flags.includes('ZERO_PRICE'));
        case 'ZERO_MRP':           return results.filter(r => r.flags.includes('ZERO_MRP'));
        case 'SELLING_ABOVE_MRP':  return results.filter(r => r.flags.includes('SELLING_ABOVE_MRP'));
        case 'BELOW_COST':         return results.filter(r => r.flags.includes('BELOW_COST'));
        case 'NO_COST_PRICE':      return results.filter(r => r.flags.includes('NO_COST_PRICE'));
        case 'NO_GST':             return results.filter(r => r.flags.includes('NO_GST'));
        case 'NO_IMAGE':           return results.filter(r => r.flags.includes('NO_IMAGE'));
        case 'NO_PACK_LABEL':      return results.filter(r => r.flags.includes('NO_PACK_LABEL'));
        case 'NO_BARCODE':         return results.filter(r => r.flags.includes('NO_BARCODE'));
        case 'OUT_OF_STOCK':       return results.filter(r => r.flags.includes('OUT_OF_STOCK'));
        case 'LOW_STOCK':          return results.filter(r => r.flags.includes('LOW_STOCK'));
        case 'ONLINE':             return results.filter(r => r.isOnline);
        case 'OFFLINE':            return results.filter(r => !r.isOnline);
        case 'WITH_FLAGS':         return results.filter(r => r.flags.length > 0);
        default:                   return results;
      }
    })();

    // Summary counts
    const summary = {
      total:            results.length,
      online:           results.filter(r => r.isOnline).length,
      offline:          results.filter(r => !r.isOnline).length,
      healthy:          results.filter(r => r.isOnline && r.flags.length === 0).length,
      critical:         results.filter(r => r.shouldBlock).length,
      zeroPrice:        results.filter(r => r.flags.includes('ZERO_PRICE')).length,
      zeroMrp:          results.filter(r => r.flags.includes('ZERO_MRP')).length,
      sellingAboveMrp:  results.filter(r => r.flags.includes('SELLING_ABOVE_MRP')).length,
      belowCost:        results.filter(r => r.flags.includes('BELOW_COST')).length,
      noCostPrice:      results.filter(r => r.flags.includes('NO_COST_PRICE')).length,
      noGst:            results.filter(r => r.flags.includes('NO_GST')).length,
      noImage:          results.filter(r => r.flags.includes('NO_IMAGE')).length,
      noPackLabel:      results.filter(r => r.flags.includes('NO_PACK_LABEL')).length,
      noBarcode:        results.filter(r => r.flags.includes('NO_BARCODE')).length,
      outOfStock:       results.filter(r => r.flags.includes('OUT_OF_STOCK')).length,
      lowStock:         results.filter(r => r.flags.includes('LOW_STOCK')).length,
    };

    return { summary, data: filtered };
  }

  async bulkTakeOffline(businessId: string, productIds: string[]) {
    if (!productIds?.length) return { updated: 0 };
    await this.prisma.$transaction([
      this.prisma.product.updateMany({
        where: { businessId, id: { in: productIds } },
        data:  { availableOnline: false },
      }),
      this.prisma.productPlu.updateMany({
        where: { businessId, productId: { in: productIds }, isActive: true },
        data:  { availableOnline: false },
      }),
    ]);
    // Bust cache for each
    for (const id of productIds) {
      const p = await this.prisma.product.findUnique({ where: { id }, select: { productCode: true } });
      if (p?.productCode) await this.shopCache.bustProduct(p.productCode).catch(() => {});
    }
    await this.shopCache.bustNavigation().catch(() => {});
    return { updated: productIds.length };
  }
}
