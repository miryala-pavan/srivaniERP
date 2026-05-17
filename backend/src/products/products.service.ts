import {
  Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductQueryDto } from './dto/product-query.dto';

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
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ─── AUDIT LOG ──────────────────────────────────────────────────────────────

  private async audit(
    userId: string | null,
    businessId: string,
    actionType: string,
    entityType: string,
    entityId: string,
    oldValues?: object,
    newValues?: object,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, businessId, actionType, entityType, entityId, oldValues, newValues },
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

    return this.prisma.category.create({
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
  }

  async updateCategory(businessId: string, id: string, body: {
    name?: string; sortOrder?: number; isActive?: boolean; departmentId?: string;
  }) {
    const cat = await this.prisma.category.findFirst({ where: { id, businessId } });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.category.update({
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

  async createSubCategory(businessId: string, body: { name: string; categoryId: string; sortOrder?: number }) {
    const parent = await this.prisma.category.findFirst({
      where: { id: body.categoryId, businessId, parentId: null },
    });
    if (!parent) throw new NotFoundException('Parent category not found');
    const code = `${parent.code}_${body.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)}`;
    let finalCode = code;
    const codeExists = await this.prisma.category.findUnique({
      where: { businessId_code: { businessId, code } },
    });
    if (codeExists) finalCode = `${code}${Date.now().toString().slice(-4)}`;

    return this.prisma.category.create({
      data: {
        businessId,
        parentId: body.categoryId,
        departmentId: parent.departmentId,
        name: body.name.trim(),
        code: finalCode,
        label: body.name.trim(),
        sortOrder: body.sortOrder ?? 0,
      },
      include: {
        parent:     { select: { id: true, name: true, label: true, code: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async updateSubCategory(businessId: string, id: string, body: {
    name?: string; sortOrder?: number; isActive?: boolean; categoryId?: string;
  }) {
    const cat = await this.prisma.category.findFirst({
      where: { id, businessId, parentId: { not: null } },
    });
    if (!cat) throw new NotFoundException('Sub-category not found');
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(body.name       !== undefined ? { name: body.name.trim(), label: body.name.trim() } : {}),
        ...(body.sortOrder  !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive   !== undefined ? { isActive: body.isActive } : {}),
        ...(body.categoryId !== undefined ? { parentId: body.categoryId || null } : {}),
      },
    });
  }

  async deleteSubCategory(businessId: string, id: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id, businessId, parentId: { not: null } },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) throw new NotFoundException('Sub-category not found');
    if (cat._count.products > 0) {
      throw new BadRequestException(`Cannot delete — sub-category has ${cat._count.products} products`);
    }
    await this.prisma.category.delete({ where: { id } });
    return { message: 'Sub-category deleted' };
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
          select:  { id: true, name: true, code: true, label: true, sortOrder: true },
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
        id: true, name: true, code: true, label: true, parentId: true, departmentId: true,
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

  async createProduct(businessId: string, dto: CreateProductDto, userId?: string) {
    if (dto.mrp < dto.sellingPrice) throw new BadRequestException('MRP must be ≥ selling price');
    if (dto.barcode) {
      const dup = await this.prisma.product.findUnique({ where: { businessId_barcode: { businessId, barcode: dto.barcode } } });
      if (dup) throw new ConflictException(`Barcode "${dto.barcode}" already in use`);
    }
    const tax = await this.prisma.tax.findUnique({ where: { id: dto.taxId } });
    if (!tax || tax.businessId !== businessId) throw new BadRequestException('Invalid tax ID');

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
          isForSale: dto.isForSale ?? true, isForPurchase: dto.isForPurchase ?? true,
          isRepackingItem: dto.isRepackingItem ?? false, isPerishable: dto.isPerishable ?? false,
          expiryTracking: dto.expiryTracking ?? false, availableOnline: dto.availableOnline ?? false,
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

    this.audit(userId ?? null, businessId, 'PRODUCT_CREATED', 'Product', product.id, undefined, { productCode: product.productCode, name: product.name });
    return product;
  }

  async getProducts(businessId: string, query: ProductQueryDto) {
    const page  = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;
    const order = (query.sortOrder === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

    const where: any = { businessId };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    else where.isActive = true;

    // Category filter: if subCategoryId given, use it; else expand main category to include children
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

    // Three-state status filter
    if (query.status === 'DISABLED')     where.isManuallyDisabled = true;
    if (query.status === 'OUT_OF_STOCK') where.autoInactiveReason = 'OUT_OF_STOCK';
    if (query.status === 'ACTIVE') {
      where.isManuallyDisabled = false;
      where.autoInactiveReason = null;
    }

    if (query.search) {
      where.OR = [
        { name:        { contains: query.search, mode: 'insensitive' } },
        { shortName:   { contains: query.search, mode: 'insensitive' } },
        { barcode:     { contains: query.search, mode: 'insensitive' } },
        { productCode: { contains: query.search } },
        { hsnCode:     { contains: query.search } },
      ];
    }

    // Build orderBy
    const sortFieldMap: Record<string, any> = {
      code: { productCode: order }, name: { name: order },
      mrp: { mrp: order }, sellingPrice: { sellingPrice: order },
      gstRatePercent: { gstRatePercent: order }, createdAt: { createdAt: order },
    };
    const sortByStock = query.sortBy === 'stock';
    const orderBy = sortByStock ? { productCode: 'asc' } : (sortFieldMap[query.sortBy ?? 'code'] ?? { productCode: 'asc' });

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

    let enriched = products.map((p) => ({
      ...p,
      currentStock: stockMap.get(p.id) ?? 0,
    }));

    // Stock status post-filter
    if (query.stockStatus === 'OUT_OF_STOCK') enriched = enriched.filter((p) => p.currentStock <= 0);
    if (query.stockStatus === 'IN_STOCK')     enriched = enriched.filter((p) => p.currentStock > 0);
    if (query.stockStatus === 'LOW_STOCK') {
      enriched = enriched.filter((p) => p.currentStock > 0 && p.currentStock <= Number(p.reorderLevel));
    }

    // Stock sort (computed field, done post-enrichment)
    if (sortByStock) {
      enriched.sort((a, b) => order === 'asc' ? a.currentStock - b.currentStock : b.currentStock - a.currentStock);
    }

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getProductById(businessId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, businessId },
      include: {
        category: {
          include: { parent: { select: { id: true, name: true, label: true, code: true } } },
        },
        brand: true, tax: true,
        barcodes: { where: { isActive: true } },
        prices:   { orderBy: { priceListType: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async updateProduct(businessId: string, id: string, dto: UpdateProductDto, userId?: string) {
    const product = await this.prisma.product.findFirst({ where: { id, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    const mrp    = dto.mrp    ?? Number(product.mrp);
    const sprice = dto.sellingPrice ?? Number(product.sellingPrice);
    if (mrp < sprice) throw new BadRequestException('MRP must be ≥ selling price');

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
        allowNegativeStock: dto.allowNegativeStock, isForSale: dto.isForSale,
        isForPurchase: dto.isForPurchase, isRepackingItem: dto.isRepackingItem,
        isPerishable: dto.isPerishable, expiryTracking: dto.expiryTracking,
        availableOnline: dto.availableOnline, aisle: dto.aisle, rackNumber: dto.rackNumber,
        shelfPosition: dto.shelfPosition, binCode, imageUrl: dto.imageUrl, isActive: dto.isActive,
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

    this.audit(userId ?? null, businessId, 'PRODUCT_UPDATED', 'Product', id,
      { name: product.name, mrp: product.mrp, sellingPrice: product.sellingPrice, isActive: product.isActive },
      { name: updated.name, mrp: updated.mrp, sellingPrice: updated.sellingPrice, isActive: updated.isActive },
    );

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

          await this.prisma.$transaction([
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
    this.audit(userId ?? null, businessId, `PRODUCT_${action}D`, 'Product', id, { isManuallyDisabled: product.isManuallyDisabled }, { isManuallyDisabled: updated.isManuallyDisabled });
    return updated;
  }

  // ─── INLINE TAX UPDATE (Feature 2) ──────────────────────────────────────────

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

    this.audit(userId ?? null, businessId, 'TAX_CHANGED', 'Product', id,
      { taxId: product.taxId, gstRatePercent: product.gstRatePercent },
      { taxId: updated.taxId, gstRatePercent: updated.gstRatePercent },
    );
    return updated;
  }

  // ─── SMART SEARCH ────────────────────────────────────────────────────────────

  async smartSearch(businessId: string, q: string, branchId?: string): Promise<ProductSearchResult[]> {
    if (!q?.trim()) return [];
    const term = q.trim();

    const stock = async (productId: string) => branchId ? this.getStockCount(productId, branchId) : 0;

    const fmt = (p: any, s: number): ProductSearchResult => {
      const cat    = p.category;
      const parent = cat?.parent;
      const catLabel = cat ? (parent ? `${cat.label} (${parent.label})` : cat.label) : '';
      return {
        id: p.id, productCode: p.productCode ?? '', name: p.name, shortName: p.shortName ?? null,
        categoryLabel: catLabel, categoryName: cat?.name ?? '',
        barcode: p.barcode ?? null, sellingPrice: Number(p.sellingPrice), mrp: Number(p.mrp),
        gstRatePercent: Number(p.gstRatePercent ?? p.tax?.taxRate ?? 0), taxId: p.taxId,
        unitOfMeasure: p.unitOfMeasure, currentStock: s, allowNegativeStock: p.allowNegativeStock,
        cessRate: Number((p as any).cessRate ?? 0),
      };
    };

    const include = {
      tax:      { select: { id: true, taxRate: true } },
      category: { select: { id: true, name: true, label: true, parent: { select: { id: true, name: true, label: true } } } },
    };

    // Base filter: never show manually disabled products in POS
    const posWhere = { businessId, isActive: true, isManuallyDisabled: false };

    // 1. Pure digit → productCode
    if (/^\d+$/.test(term)) {
      const padded = term.padStart(6, '0');
      const byCode = await this.prisma.product.findFirst({ where: { ...posWhere, productCode: padded }, include });
      if (byCode) {
        const s = await stock(byCode.id);
        if (s > 0 || byCode.allowNegativeStock) return [fmt(byCode, s)];
        return [];
      }
    }

    // 2. Exact barcode (new table)
    const byNewBarcode = await this.prisma.productBarcode.findFirst({
      where:   { businessId, barcodeValue: term, isActive: true },
      include: { product: { include: { ...include, category: include.category } } },
    });
    if (byNewBarcode?.product && !byNewBarcode.product.isManuallyDisabled) {
      const s = await stock(byNewBarcode.productId);
      if (s > 0 || byNewBarcode.product.allowNegativeStock) return [fmt(byNewBarcode.product, s)];
      return [];
    }

    // 3. Legacy barcode field
    const byBarcode = await this.prisma.product.findFirst({ where: { ...posWhere, barcode: term }, include });
    if (byBarcode) {
      const s = await stock(byBarcode.id);
      if (s > 0 || byBarcode.allowNegativeStock) return [fmt(byBarcode, s)];
      return [];
    }

    // 4. Category label (incl. sub-category children)
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
      const results = await Promise.all(byCat.map(async (p) => { const s = await stock(p.id); return { p, s }; }));
      const filtered = results.filter(({ p, s }) => s > 0 || p.allowNegativeStock).map(({ p, s }) => fmt(p, s));
      if (filtered.length > 0) return filtered;
    }

    // 5. Name / brand partial match
    const byName = await this.prisma.product.findMany({
      where: { ...posWhere, OR: [{ name: { contains: term, mode: 'insensitive' } }, { shortName: { contains: term, mode: 'insensitive' } }, { brand: { name: { contains: term, mode: 'insensitive' } } }] },
      take: 15, orderBy: { productCode: 'asc' },
      include: { ...include, brand: { select: { id: true, name: true } } },
    });
    const results = await Promise.all(byName.map(async (p) => { const s = await stock(p.id); return { p, s }; }));
    return results.filter(({ p, s }) => s > 0 || p.allowNegativeStock).map(({ p, s }) => fmt(p, s));
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
}
