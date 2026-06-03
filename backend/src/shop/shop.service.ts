import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { wildcardFilter } from '../common/helpers/search.helper';

// ─── Whitelisted output types ─────────────────────────────────────────────────

export interface ShopCategoryItem {
  id: string;
  code: string;
  name: string;
  label: string;
  productCount: number;
  subcategories: {
    id: string;
    code: string;
    name: string;
    label: string;
    productCount: number;
  }[];
}

export interface ShopPack {
  pluBarcode: string;
  packLabel: string;
  unit: string;
  price: number;
  mrp: number | null;
  inStock: boolean;
  availableQty: number;    // effective online quantity (capped if onlineStockCap is set)
  onlineStockCap: number | null; // null = no cap
}

export interface ShopProduct {
  code: string;
  name: string;
  imageUrl: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  categoryCode: string | null;
  parentCategoryCode: string | null;
  deptCode: string | null;
  deptName: string | null;
  fromPrice: number;
  packs: ShopPack[];
  description?: string | null;
  keywords?: string | null;
}

export interface NavSubcategory {
  code: string;
  name: string;
  productCount: number;
}

export interface NavCategory {
  code: string;
  name: string;
  productCount: number;
  subcategories: NavSubcategory[];
}

export interface NavDepartment {
  code: string;
  name: string;
  productCount: number;
  categories: NavCategory[];
}

// ─── Shared filters & selects ─────────────────────────────────────────────────

// Any active PLU with availableOnline=true qualifies — isDefault is NOT required
const ONLINE_PLU_FILTER = {
  availableOnline: true,
  isActive: true,
  isArchived: false,
};

const PLU_SELECT = {
  pluCode: true,
  displayName: true,
  eanCode: true,
  sellingPrice: true,
  mrp: true,
  onlinePrice: true,
  stockOnHand: true,
  onlineStockCap: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDecimal(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

type PluRow = {
  pluCode: string;
  displayName: string | null;
  eanCode: string | null;
  sellingPrice: unknown;
  mrp: unknown;
  onlinePrice: unknown;
  stockOnHand: unknown;
  onlineStockCap: unknown;
};

// totalStock = sum of ALL PLU stockOnHand (maintained by GRN approval + sales).
// We use it as the authoritative in-stock signal because the GRN approval updates
// the GRN PLU's stockOnHand but not the "availableOnline" PLU's stockOnHand.
// Without this, a product with 160 units received via GRN shows as Out-of-Stock
// on the storefront because the online-flagged PLU still has stockOnHand=0.
function mapPacks(plusList: PluRow[], unit: string, allowNegativeStock: boolean, totalStock = 0): ShopPack[] {
  const packs = plusList.map((plu): ShopPack => {
    const storePrice = toDecimal(plu.sellingPrice);
    const price = plu.onlinePrice !== null && plu.onlinePrice !== undefined
      ? toDecimal(plu.onlinePrice)
      : storePrice;

    // Cap: how many units this PLU is allowed to sell online
    // null = no cap → use totalStock (shared physical stock)
    const cap = plu.onlineStockCap !== null && plu.onlineStockCap !== undefined
      ? Number(plu.onlineStockCap)
      : null;

    // Effective online quantity = min(totalStock, cap) if cap set, else totalStock
    const availableQty = cap !== null ? Math.min(totalStock, cap) : totalStock;

    return {
      pluBarcode:     plu.pluCode,
      packLabel:      plu.displayName ?? unit ?? plu.pluCode,
      unit,
      price,
      mrp:            plu.mrp !== null && plu.mrp !== undefined ? toDecimal(plu.mrp) : null,
      inStock:        availableQty > 0 || allowNegativeStock,
      availableQty,
      onlineStockCap: cap,
    };
  });
  // Cheapest first
  packs.sort((a, b) => a.price - b.price);
  return packs;
}

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}

  private async getBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  // ─── Categories ────────────────────────────────────────────────────────────

  async getCategories(): Promise<ShopCategoryItem[]> {
    const businessId = await this.getBusinessId();

    const mainCats = await this.prisma.category.findMany({
      where: { businessId, parentId: null, isActive: true },
      select: { id: true, code: true, name: true, label: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });

    const subCats = await this.prisma.category.findMany({
      where: { businessId, parentId: { not: null }, isActive: true },
      select: { id: true, code: true, name: true, label: true, parentId: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });

    const onlineCounts = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: {
        businessId,
        isActive: true,
        isManuallyDisabled: false,
        plusList: { some: ONLINE_PLU_FILTER },
      },
      _count: { id: true },
    });
    const countMap = new Map<string, number>(
      onlineCounts.map(r => [r.categoryId as string, r._count.id]),
    );

    const subCatMap = new Map<string, typeof subCats[number][]>();
    for (const sc of subCats) {
      if (!sc.parentId) continue;
      const arr = subCatMap.get(sc.parentId) ?? [];
      arr.push(sc);
      subCatMap.set(sc.parentId, arr);
    }

    const result: ShopCategoryItem[] = [];
    for (const mc of mainCats) {
      const children = subCatMap.get(mc.id) ?? [];
      const subs = children.map(sc => ({
        id: sc.id,
        code: sc.code,
        name: sc.name,
        label: sc.label,
        productCount: countMap.get(sc.id) ?? 0,
      }));
      const totalCount = subs.reduce((s, sc) => s + sc.productCount, 0);
      if (totalCount === 0) continue;
      result.push({
        id: mc.id,
        code: mc.code,
        name: mc.name,
        label: mc.label,
        productCount: totalCount,
        subcategories: subs.filter(s => s.productCount > 0),
      });
    }
    return result;
  }

  // ─── Departments (for browse page sidebar) ─────────────────────────────────

  async getDepartments(): Promise<{ code: string; name: string; productCount: number }[]> {
    const businessId = await this.getBusinessId();

    const depts = await this.prisma.department.findMany({
      where: { businessId, isActive: true },
      select: { id: true, code: true, name: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });

    const counts = await this.prisma.product.groupBy({
      by: ['departmentId'],
      where: {
        businessId,
        isActive: true,
        isManuallyDisabled: false,
        departmentId: { not: null },
        plusList: { some: ONLINE_PLU_FILTER },
      },
      _count: { id: true },
    });
    const countMap = new Map<string, number>(
      counts.map(r => [r.departmentId as string, r._count.id]),
    );

    return depts
      .filter(d => (countMap.get(d.id) ?? 0) > 0)
      .map(d => ({ code: d.code, name: d.name, productCount: countMap.get(d.id) ?? 0 }));
  }

  // ─── Products list ──────────────────────────────────────────────────────────

  async getProducts(query: {
    categoryCode?: string;
    subCategoryCode?: string;
    deptCode?: string;
    search?: string;
    inStock?: boolean;
    dealsOnly?: boolean;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ShopProduct[]; total: number; page: number; totalPages: number }> {
    const businessId = await this.getBusinessId();
    const page  = Math.max(1, query.page ?? 1);
    const limit = Math.min(200, Math.max(1, query.limit ?? 24));
    const skip  = (page - 1) * limit;

    // PLU filter — always use online PLU filter
    const pluFilter = ONLINE_PLU_FILTER;

    const where: any = {
      businessId,
      isActive: true,
      isManuallyDisabled: false,
      plusList: { some: pluFilter },
    };

    // In-stock filter uses product.totalStock (sum across all PLUs),
    // not PLU.stockOnHand, because stocked PLUs may not be the online ones.
    if (query.inStock) {
      where.totalStock = { gt: 0 };
    }

    // Department filter
    if (query.deptCode) {
      const dept = await this.prisma.department.findFirst({
        where: { businessId, code: query.deptCode, isActive: true },
        select: { id: true },
      });
      if (dept) where.departmentId = dept.id;
    }

    // Category / subcategory filter
    if (query.subCategoryCode) {
      const sc = await this.prisma.category.findFirst({
        where: { businessId, code: query.subCategoryCode, isActive: true },
        select: { id: true },
      });
      if (sc) where.categoryId = sc.id;
    } else if (query.categoryCode) {
      const mc = await this.prisma.category.findFirst({
        where: { businessId, code: query.categoryCode, isActive: true },
        select: { id: true, children: { select: { id: true } } },
      });
      if (mc) {
        const ids = [mc.id, ...mc.children.map(c => c.id)];
        where.categoryId = { in: ids };
      }
    }

    // Deals only — products with a non-zero MRP (savings sort will rank highest % first)
    if (query.dealsOnly) {
      where.mrp = { gt: 0 };
    }

    // Search — supports * wildcard
    if (query.search?.trim()) {
      const q = query.search.trim();
      const wf = wildcardFilter(q);
      where.OR = [
        { name:        wf },
        { productCode: wf },
        { keywords:    wf },
      ];
    }

    // Sort — OOS always last at DB level using totalStock DESC as primary key.
    // totalStock > 0  → ranks first (in-stock)
    // totalStock = 0  → ranks last  (OOS)
    // Within each group, the chosen sort applies as secondary.
    // This works at pagination level so page 1 always shows in-stock products first.
    let orderBy: any = [{ totalStock: 'desc' }, { name: 'asc' }];
    if (query.sort === 'priceAsc')  orderBy = [{ totalStock: 'desc' }, { sellingPrice: 'asc'  }, { name: 'asc' }];
    if (query.sort === 'priceDesc') orderBy = [{ totalStock: 'desc' }, { sellingPrice: 'desc' }, { name: 'asc' }];
    if (query.sort === 'savings')   orderBy = [{ totalStock: 'desc' }, { mrp: 'desc' }, { sellingPrice: 'asc' }];

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          productCode: true,
          name: true,
          unitOfMeasure: true,
          imageUrl: true,
          allowNegativeStock: true,
          totalStock: true,
          category: {
            select: {
              name: true,
              label: true,
              parent: { select: { name: true, label: true } },
            },
          },
          plusList: {
            where: pluFilter,
            select: PLU_SELECT,
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const data: ShopProduct[] = products
      .map((p): ShopProduct | null => {
        const totalStock = Number((p as any).totalStock ?? 0);
        const packs = mapPacks(p.plusList, p.unitOfMeasure, p.allowNegativeStock, totalStock);
        if (packs.length === 0) return null;
        const cat = p.category;
        return {
          code:               p.productCode ?? '',
          name:               p.name,
          imageUrl:           p.imageUrl ?? null,
          categoryName:       cat?.parent?.label ?? cat?.label ?? null,
          subcategoryName:    cat?.parent ? (cat.label ?? null) : null,
          categoryCode:       null,
          parentCategoryCode: null,
          deptCode:           null,
          deptName:           null,
          fromPrice:          Math.min(...packs.map(pk => pk.price)),
          packs,
        };
      })
      .filter((p): p is ShopProduct => p !== null);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Single product ─────────────────────────────────────────────────────────

  async getProductByCode(code: string): Promise<ShopProduct> {
    const businessId = await this.getBusinessId();

    const product = await this.prisma.product.findFirst({
      where: {
        businessId,
        productCode: code,
        isActive: true,
        isManuallyDisabled: false,
        plusList: { some: ONLINE_PLU_FILTER },
      },
      select: {
        productCode: true,
        name: true,
        unitOfMeasure: true,
        imageUrl: true,
        allowNegativeStock: true,
        totalStock: true,
        description: true,
        keywords: true,
        category: {
          select: {
            code: true,
            name: true,
            label: true,
            parent: {
              select: {
                code: true,
                name: true,
                label: true,
                department: { select: { code: true, name: true } },
              },
            },
          },
        },
        plusList: {
          where: ONLINE_PLU_FILTER,
          select: PLU_SELECT,
        },
      },
    });

    if (!product || product.plusList.length === 0) {
      throw new NotFoundException('Product not found or not available online');
    }

    const packs = mapPacks(product.plusList, product.unitOfMeasure, product.allowNegativeStock, Number((product as any).totalStock ?? 0));
    const cat = product.category;
    const dept = cat?.parent?.department;

    return {
      code:               product.productCode ?? '',
      name:               product.name,
      imageUrl:           product.imageUrl ?? null,
      categoryName:       cat?.parent?.label ?? cat?.label ?? null,
      subcategoryName:    cat?.parent ? (cat.label ?? null) : null,
      categoryCode:       cat?.code ?? null,
      parentCategoryCode: cat?.parent?.code ?? null,
      deptCode:           dept?.code ?? null,
      deptName:           dept?.name ?? null,
      fromPrice:          Math.min(...packs.map(pk => pk.price)),
      packs,
      description:        product.description ?? null,
      keywords:           product.keywords ?? null,
    };
  }

  // ─── Autocomplete suggest ────────────────────────────────────────────────────

  async suggest(q: string, limit = 6): Promise<{
    products: { code: string; name: string; sellingPrice: number; iconUrl: string | null; subcategory: string | null }[];
    categories: { code: string; name: string; department: string | null }[];
  }> {
    const businessId = await this.getBusinessId();
    const term = q.trim();

    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          businessId,
          isActive: true,
          isManuallyDisabled: false,
          name: { contains: term, mode: 'insensitive' },
          plusList: { some: ONLINE_PLU_FILTER },
        },
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          productCode: true,
          name: true,
          imageUrl: true,
          category: {
            select: {
              label: true,
              name: true,
              parent: { select: { label: true, name: true } },
            },
          },
          plusList: {
            where: ONLINE_PLU_FILTER,
            select: { sellingPrice: true, onlinePrice: true },
            orderBy: { sellingPrice: 'asc' },
            take: 1,
          },
        },
      }),
      this.prisma.category.findMany({
        where: {
          businessId,
          isActive: true,
          parentId: { not: null },
          name: { contains: term, mode: 'insensitive' },
        },
        take: 3,
        orderBy: { name: 'asc' },
        select: {
          code: true,
          name: true,
          label: true,
          parent: {
            select: {
              name: true,
              label: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      products: products.map(p => {
        const plu = p.plusList[0];
        const price = plu
          ? toDecimal(plu.onlinePrice ?? plu.sellingPrice)
          : 0;
        const cat = p.category;
        const subLabel = cat?.parent ? (cat.label || cat.name) : null;
        return {
          code: p.productCode ?? '',
          name: p.name,
          sellingPrice: price,
          iconUrl: p.imageUrl ?? null,
          subcategory: subLabel,
        };
      }),
      categories: categories.map(c => ({
        code: c.code,
        name: c.label || c.name,
        department: c.parent?.department?.name ?? c.parent?.label ?? c.parent?.name ?? null,
      })),
    };
  }

  // ─── Navigation tree (mega-menu) ─────────────────────────────────────────────

  async getNavTree(): Promise<NavDepartment[]> {
    const businessId = await this.getBusinessId();

    const [depts, cats, subs, counts] = await Promise.all([
      this.prisma.department.findMany({
        where: { businessId, isActive: true },
        select: { id: true, code: true, name: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.category.findMany({
        where: { businessId, parentId: null, isActive: true },
        select: { id: true, code: true, name: true, label: true, departmentId: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.category.findMany({
        where: { businessId, parentId: { not: null }, isActive: true },
        select: { id: true, code: true, name: true, label: true, parentId: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.product.groupBy({
        by: ['categoryId', 'departmentId'],
        where: {
          businessId,
          isActive: true,
          isManuallyDisabled: false,
          plusList: { some: ONLINE_PLU_FILTER },
        },
        _count: { id: true },
      }),
    ]);

    const catCountMap = new Map<string, number>(
      counts.map(c => [c.categoryId as string, c._count.id]),
    );
    const deptCountMap = new Map<string, number>();
    for (const c of counts) {
      if (c.departmentId) {
        deptCountMap.set(c.departmentId, (deptCountMap.get(c.departmentId) ?? 0) + c._count.id);
      }
    }

    const subsByParent = new Map<string, typeof subs[number][]>();
    for (const s of subs) {
      if (!s.parentId) continue;
      const arr = subsByParent.get(s.parentId) ?? [];
      arr.push(s);
      subsByParent.set(s.parentId, arr);
    }

    const catsByDept = new Map<string, typeof cats[number][]>();
    for (const c of cats) {
      if (!c.departmentId) continue;
      const arr = catsByDept.get(c.departmentId) ?? [];
      arr.push(c);
      catsByDept.set(c.departmentId, arr);
    }

    return depts
      .filter(d => (deptCountMap.get(d.id) ?? 0) > 0)
      .map(d => {
        const deptCats = (catsByDept.get(d.id) ?? [])
          .map(c => {
            const catSubs = (subsByParent.get(c.id) ?? [])
              .filter(sc => (catCountMap.get(sc.id) ?? 0) > 0)
              .map(sc => ({
                code: sc.code,
                name: sc.label || sc.name,
                productCount: catCountMap.get(sc.id) ?? 0,
              }));
            const catCount = catSubs.reduce((s, sc) => s + sc.productCount, 0);
            return { code: c.code, name: c.label || c.name, productCount: catCount, subcategories: catSubs };
          })
          .filter(c => c.productCount > 0 || c.subcategories.length > 0);

        return {
          code:         d.code,
          name:         d.name,
          productCount: deptCountMap.get(d.id) ?? 0,
          categories:   deptCats,
        };
      });
  }
}
