import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toSqlLike, hasWildcard, wildcardFilter } from '../common/helpers/search.helper';

export type SearchResultType = 'product' | 'customer' | 'supplier' | 'grn' | 'bill';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel?: string;
  meta?: string;  // extra info (price, phone, etc.)
}

export interface UniversalSearchResponse {
  products:  SearchResult[];
  customers: SearchResult[];
  suppliers: SearchResult[];
  grns:      SearchResult[];
  bills:     SearchResult[];
  total:     number;
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(
    businessId: string,
    q: string,
    limit = 5,
  ): Promise<UniversalSearchResponse> {
    const query = q.trim();
    if (!query) return { products: [], customers: [], suppliers: [], grns: [], bills: [], total: 0 };

    const take   = Math.min(Math.max(Number(limit) || 5, 1), 20);
    const isWild = hasWildcard(query);
    const pat    = toSqlLike(query);          // for raw ILIKE
    const pf     = wildcardFilter(query);     // for Prisma filter

    let products:  any[] = [];
    let customers: any[] = [];
    let suppliers: any[] = [];
    let grns:      any[] = [];
    let bills:     any[] = [];

    if (isWild) {
      // ── Raw ILIKE queries for wildcard patterns ─────────────────────────────

      products = await this.prisma.$queryRaw<any[]>`
        SELECT id, name, "productCode", "hsnCode", "sellingPrice"
        FROM product
        WHERE "businessId" = ${businessId}
          AND "isActive" = true
          AND (
            LOWER(name)          LIKE ${pat} OR
            LOWER("productCode") LIKE ${pat} OR
            LOWER("hsnCode")     LIKE ${pat} OR
            LOWER(COALESCE(barcode,'')) LIKE ${pat}
          )
        ORDER BY name ASC
        LIMIT ${take}`;

      customers = await this.prisma.$queryRaw<any[]>`
        SELECT id, name, phone, "customerCode"
        FROM customer
        WHERE "businessId" = ${businessId}
          AND "isActive" = true
          AND (
            LOWER(name)                       LIKE ${pat} OR
            LOWER(COALESCE(phone,''))         LIKE ${pat} OR
            LOWER(COALESCE("customerCode",'')) LIKE ${pat}
          )
        ORDER BY name ASC
        LIMIT ${take}`;

      suppliers = await this.prisma.$queryRaw<any[]>`
        SELECT id, name, phone, gstin
        FROM supplier
        WHERE "businessId" = ${businessId}
          AND "isActive" = true
          AND (
            LOWER(name)                LIKE ${pat} OR
            LOWER(COALESCE(phone,''))  LIKE ${pat} OR
            LOWER(COALESCE(gstin,''))  LIKE ${pat}
          )
        ORDER BY name ASC
        LIMIT ${take}`;

      grns = await this.prisma.$queryRaw<any[]>`
        SELECT id, "grnNumber", "invoiceNumber", "supplierName", "grandTotal", status
        FROM purchase
        WHERE "businessId" = ${businessId}
          AND (
            LOWER(COALESCE("grnNumber",''))    LIKE ${pat} OR
            LOWER("invoiceNumber")             LIKE ${pat} OR
            LOWER("supplierName")              LIKE ${pat}
          )
        ORDER BY "createdAt" DESC
        LIMIT ${take}`;

      bills = await this.prisma.$queryRaw<any[]>`
        SELECT id, "billNumber", "customerName", "grandTotal", "billDate"
        FROM sales_bill
        WHERE "businessId" = ${businessId}
          AND "isVoided" = false
          AND (
            LOWER(COALESCE("billNumber",''))   LIKE ${pat} OR
            LOWER(COALESCE("customerName",'')) LIKE ${pat}
          )
        ORDER BY "billDate" DESC
        LIMIT ${take}`;

    } else {
      // ── Standard Prisma contains queries ───────────────────────────────────
      const mode = 'insensitive' as const;

      [products, customers, suppliers, grns, bills] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            businessId, isActive: true,
            OR: [
              { name:        { contains: query, mode } },
              { productCode: { contains: query, mode } },
              { barcode:     { contains: query, mode } },
              { hsnCode:     { contains: query } },
            ],
          },
          select: { id: true, name: true, productCode: true, sellingPrice: true },
          orderBy: { name: 'asc' },
          take,
        }),
        this.prisma.customer.findMany({
          where: {
            businessId, isActive: true,
            OR: [
              { name:         { contains: query, mode } },
              { phone:        { contains: query } },
              { customerCode: { contains: query, mode } },
            ],
          },
          select: { id: true, name: true, phone: true, customerCode: true },
          orderBy: { name: 'asc' },
          take,
        }),
        this.prisma.supplier.findMany({
          where: {
            businessId, isActive: true,
            OR: [
              { name:  { contains: query, mode } },
              { gstin: { contains: query } },
              { phone: { contains: query } },
            ],
          },
          select: { id: true, name: true, gstin: true, phone: true },
          orderBy: { name: 'asc' },
          take,
        }),
        this.prisma.purchase.findMany({
          where: {
            businessId,
            OR: [
              { grnNumber:     { contains: query, mode } },
              { invoiceNumber: { contains: query, mode } },
              { supplierName:  { contains: query, mode } },
            ],
          },
          select: { id: true, grnNumber: true, supplierName: true, invoiceNumber: true, grandTotal: true, status: true },
          orderBy: { createdAt: 'desc' },
          take,
        }),
        this.prisma.salesBill.findMany({
          where: {
            businessId, isVoided: false,
            OR: [
              { billNumber:   { contains: query, mode } },
              { customerName: { contains: query, mode } },
            ],
          },
          select: { id: true, billNumber: true, customerName: true, grandTotal: true, billDate: true },
          orderBy: { billDate: 'desc' },
          take,
        }),
      ]);
    }

    const fmt = (n: any) =>
      n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : undefined;

    const result: UniversalSearchResponse = {
      products: products.map((p: any) => ({
        type: 'product' as const,
        id:       p.id,
        label:    p.name,
        sublabel: p.productCode ?? undefined,
        meta:     fmt(p.sellingPrice),
      })),
      customers: customers.map((c: any) => ({
        type: 'customer' as const,
        id:       c.id,
        label:    c.name,
        sublabel: c.phone ?? c.customerCode ?? undefined,
      })),
      suppliers: suppliers.map((s: any) => ({
        type: 'supplier' as const,
        id:       s.id,
        label:    s.name,
        sublabel: s.gstin ?? s.phone ?? undefined,
      })),
      grns: grns.map((g: any) => ({
        type: 'grn' as const,
        id:       g.id,
        label:    g.grnNumber ?? `INV/${g.invoiceNumber}`,
        sublabel: g.supplierName,
        meta:     fmt(g.grandTotal),
      })),
      bills: bills.map((b: any) => ({
        type: 'bill' as const,
        id:       b.id,
        label:    b.billNumber ?? 'Draft Bill',
        sublabel: b.customerName ?? undefined,
        meta:     fmt(b.grandTotal),
      })),
      total: 0,
    };

    result.total =
      result.products.length + result.customers.length +
      result.suppliers.length + result.grns.length + result.bills.length;

    return result;
  }
}
