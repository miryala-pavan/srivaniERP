import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { wildcardFilter, hasWildcard } from '../common/helpers/search.helper';
import { ShopCacheService } from './shop-cache.service';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import { SettingsService } from '../settings/settings.service';
import { pickCurrentPlu } from '../common/helpers/plu-resolution.util';

// Must match the static-serve mount in main.ts (imagesDir <-> /uploads/products).
const PRODUCT_IMAGES_DIR = process.env.PRODUCT_IMAGES_DIR
  ?? path.join(process.cwd(), '..', 'storage', 'product-images');

// Used to build absolute image_link URLs for the Meta catalog feed — Meta's
// crawler fetches this server-to-server and can't resolve a relative path or
// localhost, so this must be a real public HTTPS origin in production.
const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? 'http://localhost:4001').replace(/\/$/, '');
const FEED_TOKEN_KEY = 'meta.catalog_feed_token';
function productImageExists(imageUrl: string): boolean {
  if (!imageUrl.startsWith('/uploads/products/')) return false;
  const relative = imageUrl.slice('/uploads/products/'.length);
  try {
    return fs.existsSync(path.join(PRODUCT_IMAGES_DIR, relative));
  } catch {
    return false;
  }
}

// ─── Whitelisted output types ─────────────────────────────────────────────────

export interface ShopCategoryItem {
  id: string;
  code: string;
  name: string;
  label: string;
  productCount: number;
  sampleImages: string[];
  subcategories: {
    id: string;
    code: string;
    name: string;
    label: string;
    productCount: number;
    sampleImages: string[];
  }[];
}

export interface VolumeTier {
  minQty: number;
  price: number;
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
  volumeTiers: VolumeTier[];
}

export interface ShopGroupVariant {
  label: string;
  code: string;
  name: string;
  imageUrl: string | null;
  fromPrice: number;
  inStock: boolean;
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
  groupVariants?: ShopGroupVariant[];
  // Real social-proof signals (frontend decides whether to show, by threshold)
  unitsSold?: number;   // times purchased in the last 90 days (real)
  stockLeft?: number;   // effective online quantity available now
  avgRating?: number | null; // average of published ProductReview.rating, null if no reviews
  reviewCount?: number;
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

// Used only as a cheap EXISTENCE filter — "does this product have at least
// one sellable batch" — for count/pagination queries (category counts, nav
// tree, autocomplete/related-product candidate lists) where fetching and
// resolving every product's true current PLU up front would be wasted work.
// It must NOT be used to decide what price/batch to actually display — that
// is resolveOnlineCurrentPlu() below, which is the single source of truth
// for "the one current PLU" the business wants shown online (see
// common/helpers/plu-resolution.util.ts). sellingPrice > 0 and mrp > 0 guard
// against zero-price products appearing on the storefront.
const ONLINE_PLU_FILTER = {
  availableOnline: true,
  isActive: true,
  isArchived: false,
  sellingPrice: { gt: 0 },
  mrp: { gt: 0 },
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

// Superset of PLU_SELECT carrying the extra fields pickCurrentPlu() needs to
// resolve "the current batch" (isDefault/expiryDate/receivedDate) plus the
// availableOnline flag needed to gate that batch for online display. Used
// everywhere a query needs to resolve one real current PLU rather than list
// every online-eligible one.
const RESOLUTION_PLU_SELECT = {
  ...PLU_SELECT,
  isDefault: true,
  expiryDate: true,
  receivedDate: true,
  availableOnline: true,
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

type ResolutionPluRow = PluRow & {
  isDefault: boolean;
  expiryDate: Date | null;
  receivedDate: Date;
  availableOnline: boolean;
};

// The storefront shows exactly ONE pack per product — its currently resolved
// batch (manual pin, else FEFO, else most-recently-received; see
// pickCurrentPlu) — never "every batch that happens to have stock". If that
// resolved batch isn't actually online-eligible (not flagged availableOnline,
// or missing a valid price/MRP), the product is treated as unavailable
// online rather than silently substituting some other, less current batch.
function resolveOnlineCurrentPlu(activePlus: ResolutionPluRow[], expiryTracking: boolean): ResolutionPluRow | null {
  const current = pickCurrentPlu(activePlus, expiryTracking);
  if (!current) return null;
  if (!current.availableOnline) return null;
  if (toDecimal(current.sellingPrice) <= 0 || toDecimal(current.mrp) <= 0) return null;
  return current;
}

// totalStock = sum of ALL PLU stockOnHand across the product.
// Used as the inStock signal because stock lives on whichever PLU received the GRN,
// which is often different from the online-flagged PLU. This ensures a product with
// physical inventory is never incorrectly shown as out-of-stock on the storefront.
function mapPacks(plusList: PluRow[], unit: string, allowNegativeStock: boolean, totalStock = 0): ShopPack[] {
  const packs = plusList.map((plu): ShopPack => {
    const storePrice = toDecimal(plu.sellingPrice);
    const price = plu.onlinePrice !== null && plu.onlinePrice !== undefined
      ? toDecimal(plu.onlinePrice)
      : storePrice;

    const cap = plu.onlineStockCap !== null && plu.onlineStockCap !== undefined
      ? Number(plu.onlineStockCap)
      : null;

    // Effective online quantity = this PLU's own stockOnHand, capped if onlineStockCap is set.
    // Since all stocked PLUs are now individually marked availableOnline, each pack shows
    // its own accurate stock count (e.g. "MRP ₹22 — 3 left", "MRP ₹24 — 30 available").
    const pluStock     = toDecimal(plu.stockOnHand);
    const availableQty = cap !== null ? Math.min(pluStock, cap) : pluStock;

    return {
      pluBarcode:     plu.pluCode,
      packLabel:      plu.displayName ?? unit ?? plu.pluCode,
      unit,
      price,
      mrp:            plu.mrp !== null && plu.mrp !== undefined ? toDecimal(plu.mrp) : null,
      inStock:        pluStock > 0 || allowNegativeStock,
      availableQty,
      onlineStockCap: cap,
      volumeTiers:    [],
    };
  });
  // Cheapest first
  packs.sort((a, b) => a.price - b.price);
  return packs;
}

const CACHE_TTL = {
  navTree:    300,
  categories: 300,
  departments: 300,
  product:    120,
} as const;

@Injectable()
export class ShopService {
  constructor(
    private prisma: PrismaService,
    private cache: ShopCacheService,
    private servicePincodes: ServiceablePincodesService,
    private settings: SettingsService,
  ) {}

  // Public — the storefront reads this at load to decide whether to show
  // prices and shopping actions, or run as a browse-only visual catalogue.
  async getStoreConfig(): Promise<{ catalogueMode: boolean }> {
    return { catalogueMode: await this.isCatalogueMode() };
  }

  /** Server-side source of truth for catalogue mode — used by every price/order-blocking check. */
  private async isCatalogueMode(): Promise<boolean> {
    const businessId = await this.getBusinessId();
    const { features } = await this.settings.getFeatures(businessId);
    return !!features.catalogueModeEnabled;
  }

  /**
   * Zeroes out every price field on a ShopProduct — used when catalogue
   * mode is on. Returns a new object; never mutates the input, since callers
   * may pass a cached object that must stay real-priced for when the mode
   * is later turned off.
   */
  private redactProductPrices(p: ShopProduct): ShopProduct {
    return {
      ...p,
      fromPrice: 0,
      packs: p.packs.map(pk => ({ ...pk, price: 0, mrp: null, volumeTiers: [] })),
      ...(p.groupVariants ? { groupVariants: p.groupVariants.map(v => ({ ...v, fromPrice: 0 })) } : {}),
    };
  }

  private async redactIfCatalogueMode(data: ShopProduct[]): Promise<ShopProduct[]>;
  private async redactIfCatalogueMode(data: ShopProduct): Promise<ShopProduct>;
  private async redactIfCatalogueMode(data: ShopProduct | ShopProduct[]): Promise<ShopProduct | ShopProduct[]> {
    if (!(await this.isCatalogueMode())) return data;
    return Array.isArray(data)
      ? data.map(p => this.redactProductPrices(p))
      : this.redactProductPrices(data);
  }

  // Public — used by storefront checkout before an order is placed.
  async checkPincode(pincode: string): Promise<{ serviceable: boolean }> {
    const businessId = await this.getBusinessId();
    const serviceable = await this.servicePincodes.isServiceable(businessId, pincode);
    return { serviceable };
  }

  // Public — used by storefront checkout to offer a delivery window.
  // Fixed daily windows, today + tomorrow only. A "today" slot whose end
  // time has already passed is marked unavailable (no capacity limits).
  async getDeliverySlots(date: 'today' | 'tomorrow'): Promise<{ id: string; label: string; timeRange: string; available: boolean }[]> {
    const businessId = await this.getBusinessId();
    const slots = await this.settings.getDeliverySlots(businessId);
    const nowHour = new Date().getHours();
    const fmt = (h: number) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12} ${period}`;
    };
    return slots.map(s => ({
      id: s.id,
      label: s.label,
      timeRange: `${fmt(s.startHour)} - ${fmt(s.endHour)}`,
      available: date === 'tomorrow' || nowHour < s.endHour,
    }));
  }

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
    const cached = await this.cache.get<ShopCategoryItem[]>('shop:categories');
    if (cached) return cached;

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

    // Sample a few product photos per category to build a "basket" mosaic
    // tile on the storefront — no dedicated category image exists yet.
    const imageProducts = await this.prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        isManuallyDisabled: false,
        imageUrl: { not: null },
        plusList: { some: ONLINE_PLU_FILTER },
      },
      select: { categoryId: true, imageUrl: true },
      orderBy: { updatedAt: 'desc' },
    });
    const SAMPLE_IMAGES_PER_CATEGORY = 4;
    const imagesMap = new Map<string, string[]>();
    for (const p of imageProducts) {
      if (!p.categoryId || !p.imageUrl) continue;
      const arr = imagesMap.get(p.categoryId) ?? [];
      if (arr.length < SAMPLE_IMAGES_PER_CATEGORY && productImageExists(p.imageUrl)) {
        arr.push(p.imageUrl);
        imagesMap.set(p.categoryId, arr);
      }
    }

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
        sampleImages: imagesMap.get(sc.id) ?? [],
      }));
      const totalCount = subs.reduce((s, sc) => s + sc.productCount, 0);
      if (totalCount === 0) continue;
      // Products are assigned to subcategories, not the parent — pull the
      // tile mosaic from across its children, same source as the count sum.
      const mainSampleImages = [
        ...(imagesMap.get(mc.id) ?? []),
        ...subs.flatMap(sc => sc.sampleImages),
      ].slice(0, SAMPLE_IMAGES_PER_CATEGORY);
      result.push({
        id: mc.id,
        code: mc.code,
        name: mc.name,
        label: mc.label,
        productCount: totalCount,
        sampleImages: mainSampleImages,
        subcategories: subs.filter(s => s.productCount > 0).sort((a, b) => b.productCount - a.productCount),
      });
    }
    // Highest-stock categories first — matches how customers actually shop
    // (Blinkit/BigBasket-style), rather than the manually-curated sortOrder.
    result.sort((a, b) => b.productCount - a.productCount);
    await this.cache.set('shop:categories', result, CACHE_TTL.categories);
    return result;
  }

  // ─── Departments (for browse page sidebar) ─────────────────────────────────

  async getDepartments(): Promise<{ code: string; name: string; productCount: number }[]> {
    const cached = await this.cache.get<{ code: string; name: string; productCount: number }[]>('shop:departments');
    if (cached) return cached;

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

    const result = depts
      .filter(d => (countMap.get(d.id) ?? 0) > 0)
      .map(d => ({ code: d.code, name: d.name, productCount: countMap.get(d.id) ?? 0 }));
    await this.cache.set('shop:departments', result, CACHE_TTL.departments);
    return result;
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
    minPrice?: number;
    maxPrice?: number;
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

    // Price range filter
    if (query.minPrice != null || query.maxPrice != null) {
      where.sellingPrice = {
        ...(query.minPrice != null ? { gte: query.minPrice } : {}),
        ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
      };
    }

    // Search — supports * wildcard
    const searchTerm = query.search?.trim();
    if (searchTerm) {
      const wf = wildcardFilter(searchTerm);
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

    const productSelect = {
      productCode: true,
      name: true,
      unitOfMeasure: true,
      imageUrl: true,
      allowNegativeStock: true,
      totalStock: true,
      expiryTracking: true,
      category: {
        select: {
          name: true,
          label: true,
          parent: { select: { name: true, label: true } },
        },
      },
      // Fetch every active batch (not just online-eligible ones) so the
      // resolver below can correctly pick the true current one — the true
      // current batch may not even be the one flagged availableOnline.
      plusList: {
        where: { isActive: true, isArchived: false },
        select: RESOLUTION_PLU_SELECT,
      },
    };

    let [products, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take: limit, orderBy, select: productSelect }),
      this.prisma.product.count({ where }),
    ]);

    // Typo-tolerant fallback: only kicks in when the exact/substring search above
    // found nothing and the user didn't type an explicit wildcard pattern. Uses
    // word_similarity (not plain similarity) because product names are multi-word
    // ("MAGGI MASALA NOODLES 560 G") — plain similarity() dilutes a typo on the
    // first word across the whole string, while word_similarity finds the best-
    // matching substring so "magee"/"magi" still surfaces "Maggi ...".
    if (total === 0 && searchTerm && !hasWildcard(searchTerm)) {
      const fuzzyMatches = await this.prisma.$queryRaw<{ productCode: string }[]>`
        SELECT "productCode" FROM product
        WHERE "businessId" = ${businessId}
          AND "isActive" = true
          AND "isManuallyDisabled" = false
          AND "productCode" IS NOT NULL
          AND word_similarity(${searchTerm}, name) > 0.35
        ORDER BY word_similarity(${searchTerm}, name) DESC
        LIMIT 100`;
      const fuzzyCodes = fuzzyMatches.map(m => m.productCode);
      if (fuzzyCodes.length > 0) {
        const fuzzyWhere = { ...where, OR: undefined, productCode: { in: fuzzyCodes } };
        [products, total] = await Promise.all([
          this.prisma.product.findMany({ where: fuzzyWhere, skip, take: limit, orderBy, select: productSelect }),
          this.prisma.product.count({ where: fuzzyWhere }),
        ]);
      }
    }

    const data: ShopProduct[] = products
      .map((p): ShopProduct | null => {
        const currentPlu = resolveOnlineCurrentPlu(p.plusList as any, !!(p as any).expiryTracking);
        const packs = currentPlu
          ? mapPacks([currentPlu], p.unitOfMeasure, p.allowNegativeStock, Number((p as any).totalStock ?? 0))
          : [];
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

    await this.attachRatings(businessId, data);

    return { data: await this.redactIfCatalogueMode(data), total, page, totalPages: Math.ceil(total / limit) };
  }

  // Batch-fetches average rating + review count for a page of products in one
  // query and merges them in place — avoids an N+1 query per grid card.
  private async attachRatings(businessId: string, data: ShopProduct[]): Promise<void> {
    const codes = data.map(p => p.code).filter(Boolean);
    if (codes.length === 0) return;
    const agg = await this.prisma.productReview.groupBy({
      by: ['productCode'],
      where: { businessId, productCode: { in: codes }, isPublished: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const ratingMap = new Map(agg.map(r => [r.productCode, {
      avg: r._avg.rating !== null ? Math.round(r._avg.rating * 10) / 10 : null,
      count: r._count.rating,
    }]));
    for (const p of data) {
      const r = ratingMap.get(p.code);
      p.avgRating = r?.avg ?? null;
      p.reviewCount = r?.count ?? 0;
    }
  }

  // ─── Single product ─────────────────────────────────────────────────────────

  async getProductByCode(code: string): Promise<ShopProduct> {
    const cacheKey = `shop:product:${code}`;
    const cached = await this.cache.get<ShopProduct>(cacheKey);
    if (cached) return this.redactIfCatalogueMode(cached);

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
        id: true,
        productCode: true,
        name: true,
        unitOfMeasure: true,
        imageUrl: true,
        allowNegativeStock: true,
        totalStock: true,
        description: true,
        keywords: true,
        expiryTracking: true,
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
        // All active batches, not just online-eligible ones — resolveOnlineCurrentPlu
        // below needs the full picture to correctly pick the true current one.
        plusList: {
          where: { isActive: true, isArchived: false },
          select: RESOLUTION_PLU_SELECT,
        },
      },
    });

    const currentPlu = product ? resolveOnlineCurrentPlu(product.plusList as any, !!(product as any).expiryTracking) : null;
    if (!product || !currentPlu) {
      throw new NotFoundException('Product not found or not available online');
    }

    const packs = mapPacks([currentPlu], product.unitOfMeasure, product.allowNegativeStock, Number((product as any).totalStock ?? 0));

    // Attach volume pricing tiers to each pack
    const pluCodes = packs.map(pk => pk.pluBarcode);
    const volTiers = await this.prisma.volumePricingTier.findMany({
      where: { businessId, pluBarcode: { in: pluCodes } },
      orderBy: { minQty: 'asc' },
      select: { pluBarcode: true, minQty: true, price: true },
    });
    const tierMap = new Map<string, VolumeTier[]>();
    for (const t of volTiers) {
      const arr = tierMap.get(t.pluBarcode) ?? [];
      arr.push({ minQty: t.minQty, price: Number(t.price) });
      tierMap.set(t.pluBarcode, arr);
    }
    for (const pack of packs) {
      pack.volumeTiers = tierMap.get(pack.pluBarcode) ?? [];
    }

    const cat = product.category;
    const dept = cat?.parent?.department;

    // ── Group variants (size picker) ──────────────────────────────────────────
    const membership = await this.prisma.productGroupMember.findFirst({
      where: { product: { productCode: product.productCode ?? '', businessId } },
      select: { groupId: true },
    });
    let groupVariants: ShopGroupVariant[] | undefined;
    if (membership) {
      const siblings = await this.prisma.productGroupMember.findMany({
        where: { groupId: membership.groupId },
        orderBy: { sortOrder: 'asc' },
        select: {
          displayLabel: true,
          product: {
            select: {
              productCode:        true,
              name:               true,
              imageUrl:           true,
              allowNegativeStock: true,
              totalStock:         true,
              unitOfMeasure:      true,
              expiryTracking:     true,
              plusList: { where: { isActive: true, isArchived: false }, select: RESOLUTION_PLU_SELECT },
            },
          },
        },
      });
      groupVariants = siblings.map(s => {
        const totalStk = Number((s.product as any).totalStock ?? 0);
        const currentPlu = resolveOnlineCurrentPlu(s.product.plusList as any, !!(s.product as any).expiryTracking);
        const fromPrice = currentPlu
          ? (currentPlu.onlinePrice !== null && currentPlu.onlinePrice !== undefined
              ? toDecimal(currentPlu.onlinePrice) : toDecimal(currentPlu.sellingPrice))
          : 0;
        const inStock = totalStk > 0 || s.product.allowNegativeStock;
        return {
          label:     s.displayLabel,
          code:      s.product.productCode ?? '',
          name:      s.product.name,
          imageUrl:  s.product.imageUrl ?? null,
          fromPrice,
          inStock,
        };
      });
    }

    // ── Real social-proof signals ─────────────────────────────────────────────
    // unitsSold = times this product was purchased in the last 90 days (FINAL,
    // non-voided bills). stockLeft = highest effective online qty across packs.
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const unitsSold = await this.prisma.salesItem.count({
      where: {
        productId: (product as any).id,
        bill: { businessId, status: 'FINAL' as any, isVoided: false, billDate: { gte: since } },
      },
    });
    const stockLeft = packs.length > 0 ? Math.max(...packs.map(pk => pk.availableQty)) : 0;

    const result: ShopProduct = {
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
      unitsSold,
      stockLeft,
      ...(groupVariants ? { groupVariants } : {}),
    };
    await this.attachRatings(businessId, [result]);
    await this.cache.set(cacheKey, result, CACHE_TTL.product);
    return this.redactIfCatalogueMode(result);
  }

  // ─── Autocomplete suggest ────────────────────────────────────────────────────

  async suggest(q: string, limit = 6): Promise<{
    products: { code: string; name: string; sellingPrice: number; iconUrl: string | null; subcategory: string | null }[];
    categories: { code: string; name: string; department: string | null }[];
  }> {
    limit = Math.min(20, Math.max(1, limit || 6)); // autocomplete dropdown, not a full listing
    const businessId = await this.getBusinessId();
    const term = q.trim();
    const catalogueMode = await this.isCatalogueMode();

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
          expiryTracking: true,
          category: {
            select: {
              label: true,
              name: true,
              parent: { select: { label: true, name: true } },
            },
          },
          plusList: {
            where: { isActive: true, isArchived: false },
            select: RESOLUTION_PLU_SELECT,
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
        const plu = resolveOnlineCurrentPlu(p.plusList as any, !!(p as any).expiryTracking);
        const price = plu
          ? toDecimal(plu.onlinePrice ?? plu.sellingPrice)
          : 0;
        const cat = p.category;
        const subLabel = cat?.parent ? (cat.label || cat.name) : null;
        return {
          code: p.productCode ?? '',
          name: p.name,
          sellingPrice: catalogueMode ? 0 : price,
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
    const cached = await this.cache.get<NavDepartment[]>('shop:nav-tree');
    if (cached) return cached;

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

    const result = depts
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
    await this.cache.set('shop:nav-tree', result, CACHE_TTL.navTree);
    return result;
  }

  // ─── Frequently bought together ──────────────────────────────────────────────

  async getFrequentlyBoughtWith(pluBarcode: string, limit = 4): Promise<ShopProduct[]> {
    const businessId = await this.getBusinessId();

    // Find orders that contained this PLU
    const orderLinks = await this.prisma.onlineOrderItem.findMany({
      where: { pluBarcode, order: { businessId } },
      select: { orderId: true },
      distinct: ['orderId'],
      take: 200,
    });
    if (!orderLinks.length) return [];

    const orderIds = orderLinks.map(o => o.orderId);

    // Find other product codes frequently co-ordered
    const coItems = await this.prisma.onlineOrderItem.groupBy({
      by: ['productCode'],
      where: { orderId: { in: orderIds }, pluBarcode: { not: pluBarcode } },
      _count: { orderId: true },
      orderBy: { _count: { orderId: 'desc' } },
      take: limit * 3,
    });

    const codes = coItems.map(c => c.productCode).filter(Boolean) as string[];
    if (!codes.length) return [];

    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        productCode: { in: codes },
        isActive: true,
        isManuallyDisabled: false,
        plusList: { some: ONLINE_PLU_FILTER },
      },
      select: {
        productCode: true,
        name: true,
        imageUrl: true,
        unitOfMeasure: true,
        allowNegativeStock: true,
        totalStock: true,
        expiryTracking: true,
        plusList: {
          where: { isActive: true, isArchived: false },
          select: RESOLUTION_PLU_SELECT,
        },
      },
    });

    const shopProducts: ShopProduct[] = products
      .map((p): ShopProduct | null => {
        const currentPlu = resolveOnlineCurrentPlu(p.plusList as any, !!(p as any).expiryTracking);
        const packs = currentPlu
          ? mapPacks([currentPlu], p.unitOfMeasure, p.allowNegativeStock, Number((p as any).totalStock ?? 0))
          : [];
        if (!packs.length) return null;
        return {
          code: p.productCode ?? '',
          name: p.name,
          imageUrl: p.imageUrl ?? null,
          categoryName: null,
          subcategoryName: null,
          categoryCode: null,
          parentCategoryCode: null,
          deptCode: null,
          deptName: null,
          fromPrice: Math.min(...packs.map(pk => pk.price)),
          packs,
        };
      })
      .filter((p): p is ShopProduct => p !== null);

    // Return in co-occurrence order
    const rankMap = new Map(codes.map((c, i) => [c, i]));
    const ranked = shopProducts
      .sort((a, b) => (rankMap.get(a.code) ?? 999) - (rankMap.get(b.code) ?? 999))
      .slice(0, limit);
    return this.redactIfCatalogueMode(ranked);
  }

  // ─── Meta (Facebook/Instagram) Commerce Catalog data feed ───────────────────
  // A token-gated CSV Meta's own crawler polls on a schedule the store owner
  // configures in Commerce Manager — no Graph API credentials needed on our
  // side. One row per PRODUCT, priced from its resolved current batch (see
  // resolveOnlineCurrentPlu) — matching how the storefront itself now shows
  // exactly one pack per product, not one row per historical batch.

  async getOrCreateFeedToken(businessId: string): Promise<string> {
    const existing = await this.prisma.systemSetting.findUnique({
      where: { businessId_key: { businessId, key: FEED_TOKEN_KEY } },
    });
    if (existing) return existing.value;

    const token = randomBytes(16).toString('hex');
    await this.prisma.systemSetting.create({
      data: { businessId, key: FEED_TOKEN_KEY, value: token },
    });
    return token;
  }

  async regenerateFeedToken(businessId: string): Promise<string> {
    const token = randomBytes(16).toString('hex');
    await this.prisma.systemSetting.upsert({
      where:  { businessId_key: { businessId, key: FEED_TOKEN_KEY } },
      update: { value: token },
      create: { businessId, key: FEED_TOKEN_KEY, value: token },
    });
    return token;
  }

  private buildFeedUrl(token: string): string {
    return `${API_PUBLIC_URL}/api/shop/meta-catalog-feed.csv?token=${token}`;
  }

  async getFeedSettings(businessId: string): Promise<{ url: string }> {
    const token = await this.getOrCreateFeedToken(businessId);
    return { url: this.buildFeedUrl(token) };
  }

  async getFeedUrlAfterRegenerate(businessId: string): Promise<{ url: string }> {
    const token = await this.regenerateFeedToken(businessId);
    return { url: this.buildFeedUrl(token) };
  }

  private static readonly FEED_COLUMNS = [
    'id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price',
    'link', 'image_link', 'brand', 'item_group_id', 'gtin', 'identifier_exists',
  ] as const;

  private csvEscape(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  private toCsvRow(fields: Record<string, string>): string {
    return ShopService.FEED_COLUMNS.map(col => this.csvEscape(fields[col] ?? '')).join(',');
  }

  async generateCatalogFeedCsv(token: string): Promise<string> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { key: FEED_TOKEN_KEY, value: token },
      select: { businessId: true },
    });
    if (!setting) throw new ForbiddenException('Invalid or expired feed token');
    const businessId = setting.businessId;

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });

    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        isManuallyDisabled: false,
        plusList: { some: ONLINE_PLU_FILTER },
      },
      select: {
        productCode: true, name: true, description: true, imageUrl: true,
        allowNegativeStock: true, brandName: true, expiryTracking: true,
        brand: { select: { name: true } },
        // All active batches — resolveOnlineCurrentPlu needs the full
        // picture to correctly pick the true current one.
        plusList: { where: { isActive: true, isArchived: false }, select: RESOLUTION_PLU_SELECT },
      },
    });

    const shopUrl = (process.env.SHOP_URL ?? 'https://shop.srivani.com').replace(/\/$/, '');
    const rows: string[] = [ShopService.FEED_COLUMNS.join(',')];

    for (const product of products) {
      if (!product.imageUrl || !productImageExists(product.imageUrl)) continue; // dead image = Meta rejects the whole item anyway

      // Syndicate only the product's actual current batch — if it isn't
      // online-eligible (unflagged, or an invalid price/MRP), skip the
      // product rather than substitute some other, less current batch.
      const plu = resolveOnlineCurrentPlu(product.plusList as any, !!(product as any).expiryTracking);
      if (!plu) continue;

      const pluStock = toDecimal(plu.stockOnHand);
      const available = pluStock > 0 || product.allowNegativeStock;

      const mrp = toDecimal(plu.mrp);
      const effectivePrice = plu.onlinePrice !== null && plu.onlinePrice !== undefined
        ? toDecimal(plu.onlinePrice)
        : toDecimal(plu.sellingPrice);

      const brand = product.brand?.name ?? product.brandName ?? business?.name ?? '';

      const fields: Record<string, string> = {
        id:            plu.pluCode,
        title:         product.name + (plu.displayName ? ` - ${plu.displayName}` : ''),
        description:   product.description ?? product.name,
        availability:  available ? 'in stock' : 'out of stock',
        condition:     'new',
        price:         `${mrp.toFixed(2)} INR`,
        link:          `${shopUrl}/product/${product.productCode ?? ''}`,
        image_link:    `${API_PUBLIC_URL}${product.imageUrl}`,
        brand,
        item_group_id: product.productCode ?? '',
        gtin:          plu.eanCode ?? '',
      };
      if (effectivePrice < mrp) fields.sale_price = `${effectivePrice.toFixed(2)} INR`;
      if (!plu.eanCode) fields.identifier_exists = 'no';

      rows.push(this.toCsvRow(fields));
    }

    return rows.join('\n');
  }
}
