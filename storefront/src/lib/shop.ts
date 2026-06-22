const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShopSubcategory {
  id: string;
  code: string;
  name: string;
  label: string;
  productCount: number;
}

export interface ShopCategory {
  id: string;
  code: string;
  name: string;
  label: string;
  productCount: number;
  subcategories: ShopSubcategory[];
}

export interface ShopDepartment {
  code: string;
  name: string;
  productCount: number;
}

export interface ShopPack {
  pluBarcode: string;
  packLabel: string;
  unit: string;
  price: number;
  mrp: number | null;
  inStock: boolean;
  availableQty: number;
  onlineStockCap: number | null;
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
}

export interface NavSubcategory { code: string; name: string; productCount: number; }
export interface NavCategory    { code: string; name: string; productCount: number; subcategories: NavSubcategory[]; }
export interface NavDepartment  { code: string; name: string; productCount: number; categories: NavCategory[]; }

export interface ProductsResult {
  data: ShopProduct[];
  total: number;
  page: number;
  totalPages: number;
}

export type SortOption = 'nameAsc' | 'priceAsc' | 'priceDesc' | 'savings';

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<ShopCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/shop/categories`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getDepartments(): Promise<ShopDepartment[]> {
  try {
    const res = await fetch(`${API_BASE}/shop/departments`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getNavTree(): Promise<NavDepartment[]> {
  try {
    const res = await fetch(`${API_BASE}/shop/nav-tree`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getProducts(params?: {
  categoryCode?: string;
  subCategoryCode?: string;
  deptCode?: string;
  search?: string;
  inStock?: boolean;
  dealsOnly?: boolean;
  sort?: SortOption;
  page?: number;
  limit?: number;
}): Promise<ProductsResult> {
  try {
    const url = new URL(`${API_BASE}/shop/products`);
    if (params?.categoryCode)    url.searchParams.set('categoryCode', params.categoryCode);
    if (params?.subCategoryCode) url.searchParams.set('subCategoryCode', params.subCategoryCode);
    if (params?.deptCode)        url.searchParams.set('deptCode', params.deptCode);
    if (params?.search)          url.searchParams.set('search', params.search);
    if (params?.sort)            url.searchParams.set('sort', params.sort);
    if (params?.inStock)         url.searchParams.set('inStock', 'true');
    if (params?.dealsOnly)       url.searchParams.set('dealsOnly', 'true');
    if (params?.page)            url.searchParams.set('page', String(params.page));
    if (params?.limit)           url.searchParams.set('limit', String(params.limit));

    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    if (!res.ok) return { data: [], total: 0, page: 1, totalPages: 0 };
    return res.json();
  } catch {
    return { data: [], total: 0, page: 1, totalPages: 0 };
  }
}

export async function getProduct(code: string): Promise<ShopProduct | null> {
  try {
    const res = await fetch(`${API_BASE}/shop/products/${code}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface SuggestProduct {
  code: string;
  name: string;
  sellingPrice: number;
  iconUrl: string | null;
  subcategory: string | null;
}

export interface SuggestCategory {
  code: string;
  name: string;
  department: string | null;
}

export interface SuggestResult {
  products: SuggestProduct[];
  categories: SuggestCategory[];
}

export async function getProductSuggestions(q: string, limit = 6): Promise<SuggestResult> {
  const empty: SuggestResult = { products: [], categories: [] };
  if (!q || q.trim().length < 2) return empty;
  try {
    const url = new URL(`${API_BASE}/shop/products/suggest`);
    url.searchParams.set('q', q.trim());
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return empty;
    return res.json();
  } catch {
    return empty;
  }
}
