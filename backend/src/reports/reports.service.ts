import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DateRangeDto } from './dto/date-range.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { CashSummaryDto } from './dto/cash-summary.dto';

// Convert any DB numeric/bigint value to JS number safely
const n = (v: any): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'bigint') return Number(v);
  return parseFloat(String(v)) || 0;
};

const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd   = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ─── 1. DAILY SALES REPORT ────────────────────────────

  async getDailySales(businessId: string, query: DateRangeDto) {
    const end   = query.endDate   ? new Date(query.endDate)   : new Date();
    const start = query.startDate ? new Date(query.startDate) : new Date(end.getTime() - 29 * 86400000);

    const conds: Prisma.Sql[] = [
      Prisma.sql`sb."businessId" = ${businessId}`,
      Prisma.sql`sb.status = 'FINAL'`,
      Prisma.sql`sb."billDate" >= ${dayStart(start)}`,
      Prisma.sql`sb."billDate" <= ${dayEnd(end)}`,
    ];
    if (query.branchId) conds.push(Prisma.sql`sb."branchId" = ${query.branchId}`);

    type DayRow = {
      date: Date;
      total_bills: bigint;
      total_customers: bigint;
      subtotal_amount: string;
      discount_amount: string;
      taxable_amount: string;
      total_tax: string;
      grand_total: string;
      paid_amount: string;
      balance_amount: string;
    };

    const rows = await this.prisma.$queryRaw<DayRow[]>(Prisma.sql`
      SELECT
        DATE(sb."billDate")                                           AS date,
        COUNT(*)                                                      AS total_bills,
        COUNT(DISTINCT sb."customerId")                               AS total_customers,
        COALESCE(SUM(sb."subtotalAmount"), 0)::text                   AS subtotal_amount,
        COALESCE(SUM(sb."discountAmount"), 0)::text                   AS discount_amount,
        COALESCE(SUM(sb."taxableAmount"),  0)::text                   AS taxable_amount,
        COALESCE(SUM(sb."cgstTotal" + sb."sgstTotal" + sb."igstTotal"), 0)::text AS total_tax,
        COALESCE(SUM(sb."grandTotal"),   0)::text                    AS grand_total,
        COALESCE(SUM(sb."paidAmount"),   0)::text                    AS paid_amount,
        COALESCE(SUM(sb."balanceAmount"), 0)::text                   AS balance_amount
      FROM sales_bill sb
      WHERE ${Prisma.join(conds, ' AND ')}
      GROUP BY DATE(sb."billDate")
      ORDER BY DATE(sb."billDate")
    `);

    const daily = rows.map((r) => ({
      date:            r.date,
      totalBills:      n(r.total_bills),
      totalCustomers:  n(r.total_customers),
      subtotalAmount:  n(r.subtotal_amount),
      discountAmount:  n(r.discount_amount),
      taxableAmount:   n(r.taxable_amount),
      totalTax:        n(r.total_tax),
      grandTotal:      n(r.grand_total),
      paidAmount:      n(r.paid_amount),
      balanceAmount:   n(r.balance_amount),
    }));

    const summary = {
      totalBills:     daily.reduce((s, d) => s + d.totalBills,     0),
      totalCustomers: daily.reduce((s, d) => s + d.totalCustomers, 0),
      subtotalAmount: daily.reduce((s, d) => s + d.subtotalAmount, 0),
      discountAmount: daily.reduce((s, d) => s + d.discountAmount, 0),
      taxableAmount:  daily.reduce((s, d) => s + d.taxableAmount,  0),
      totalTax:       daily.reduce((s, d) => s + d.totalTax,       0),
      grandTotal:     daily.reduce((s, d) => s + d.grandTotal,     0),
      paidAmount:     daily.reduce((s, d) => s + d.paidAmount,     0),
      balanceAmount:  daily.reduce((s, d) => s + d.balanceAmount,  0),
    };

    return { daily, summary, dateRange: { startDate: start, endDate: end } };
  }

  // ─── 2. STOCK SUMMARY REPORT ──────────────────────────

  async getStockSummary(businessId: string, query: StockQueryDto) {
    const conds: Prisma.Sql[] = [
      Prisma.sql`p."businessId" = ${businessId}`,
      Prisma.sql`p."isActive" = true`,
    ];
    if (query.categoryId) conds.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    if (query.search) {
      const like = `%${query.search}%`;
      conds.push(Prisma.sql`(p.name ILIKE ${like} OR p.barcode ILIKE ${like})`);
    }

    const branchFilter = query.branchId
      ? Prisma.sql`AND sl."branchId" = ${query.branchId}`
      : Prisma.sql``;

    type StockRow = {
      id: string;
      product_name: string;
      barcode: string | null;
      hsn_code: string;
      unit_of_measure: string;
      cost_price: string | null;
      selling_price: string;
      reorder_level: string;
      category_name: string | null;
      brand_name: string | null;
      current_stock: string;
    };

    const rows = await this.prisma.$queryRaw<StockRow[]>(Prisma.sql`
      SELECT
        p.id,
        p.name                               AS product_name,
        p.barcode,
        p."hsnCode"                          AS hsn_code,
        p."unitOfMeasure"                    AS unit_of_measure,
        p."costPrice"::text                  AS cost_price,
        p."sellingPrice"::text               AS selling_price,
        p."reorderLevel"::text               AS reorder_level,
        c.name                               AS category_name,
        b.name                               AS brand_name,
        COALESCE(SUM(sl.quantity), 0)::text  AS current_stock
      FROM product p
      LEFT JOIN category c ON p."categoryId" = c.id
      LEFT JOIN brand    b ON p."brandId"    = b.id
      LEFT JOIN stock_ledger sl ON sl."productId" = p.id ${branchFilter}
      WHERE ${Prisma.join(conds, ' AND ')}
      GROUP BY p.id, p.name, p.barcode, p."hsnCode",
               p."unitOfMeasure", p."costPrice", p."sellingPrice",
               p."reorderLevel", c.name, b.name
      ORDER BY p.name
    `);

    const products = rows.map((r) => {
      const stock    = n(r.current_stock);
      const reorder  = n(r.reorder_level);
      const cost     = n(r.cost_price);
      const selling  = n(r.selling_price);

      const status = stock <= 0       ? 'OUT_OF_STOCK'
                   : stock <= reorder ? 'LOW_STOCK'
                                      : 'IN_STOCK';

      return {
        id:            r.id,
        productName:   r.product_name,
        barcode:       r.barcode,
        hsnCode:       r.hsn_code,
        unitOfMeasure: r.unit_of_measure,
        categoryName:  r.category_name,
        brandName:     r.brand_name,
        currentStock:  stock,
        reorderLevel:  reorder,
        costPrice:     cost,
        sellingPrice:  selling,
        stockValue:    Math.max(0, stock) * cost,
        sellingValue:  Math.max(0, stock) * selling,
        status,
      };
    });

    const summary = {
      totalProducts:   products.length,
      outOfStock:      products.filter((p) => p.status === 'OUT_OF_STOCK').length,
      lowStock:        products.filter((p) => p.status === 'LOW_STOCK').length,
      inStock:         products.filter((p) => p.status === 'IN_STOCK').length,
      totalStockValue: products.reduce((s, p) => s + p.stockValue,   0),
      totalSellValue:  products.reduce((s, p) => s + p.sellingValue, 0),
    };

    return { products, summary };
  }

  // ─── 3. LOW STOCK ALERT ───────────────────────────────

  async getLowStock(businessId: string, branchId?: string) {
    const branchFilter = branchId
      ? Prisma.sql`AND sl."branchId" = ${branchId}`
      : Prisma.sql``;

    type LowRow = {
      id: string;
      product_name: string;
      barcode: string | null;
      hsn_code: string;
      unit_of_measure: string;
      reorder_level: string;
      category_name: string | null;
      current_stock: string;
    };

    const rows = await this.prisma.$queryRaw<LowRow[]>(Prisma.sql`
      SELECT
        p.id,
        p.name                               AS product_name,
        p.barcode,
        p."hsnCode"                          AS hsn_code,
        p."unitOfMeasure"                    AS unit_of_measure,
        p."reorderLevel"::text               AS reorder_level,
        c.name                               AS category_name,
        COALESCE(SUM(sl.quantity), 0)::text  AS current_stock
      FROM product p
      LEFT JOIN category c    ON p."categoryId" = c.id
      LEFT JOIN stock_ledger sl ON sl."productId" = p.id ${branchFilter}
      WHERE p."businessId" = ${businessId}
        AND p."isActive"    = true
        AND p."reorderLevel" > 0
      GROUP BY p.id, p.name, p.barcode, p."hsnCode",
               p."unitOfMeasure", p."reorderLevel", c.name
      HAVING COALESCE(SUM(sl.quantity), 0) <= p."reorderLevel"
      ORDER BY (p."reorderLevel" - COALESCE(SUM(sl.quantity), 0)) DESC
    `);

    return rows.map((r) => {
      const stock   = n(r.current_stock);
      const reorder = n(r.reorder_level);
      return {
        id:            r.id,
        productName:   r.product_name,
        barcode:       r.barcode,
        hsnCode:       r.hsn_code,
        unitOfMeasure: r.unit_of_measure,
        categoryName:  r.category_name,
        currentStock:  stock,
        reorderLevel:  reorder,
        shortageQty:   reorder - stock,
        severity:      stock <= 0 ? 'CRITICAL' : 'WARNING',
      };
    });
  }

  // ─── 4. PROFIT REPORT ─────────────────────────────────

  async getProfitReport(businessId: string, query: DateRangeDto) {
    const end   = query.endDate   ? new Date(query.endDate)   : new Date();
    const start = query.startDate ? new Date(query.startDate) : new Date(end.getFullYear(), end.getMonth(), 1);

    const salesAgg = await this.prisma.salesBill.aggregate({
      where: {
        businessId,
        status: 'FINAL',
        billDate: { gte: dayStart(start), lte: dayEnd(end) },
      },
      _sum: {
        grandTotal:     true,
        discountAmount: true,
        cgstTotal:      true,
        sgstTotal:      true,
        igstTotal:      true,
      },
    });

    const purchaseAgg = await this.prisma.purchase.aggregate({
      where: {
        businessId,
        status: 'APPROVED',
        createdAt: { gte: dayStart(start), lte: dayEnd(end) },
      },
      _sum: {
        grandTotal: true,
        cgstTotal:  true,
        sgstTotal:  true,
        igstTotal:  true,
      },
    });

    const totalSales        = n(salesAgg._sum.grandTotal);
    const totalDiscount     = n(salesAgg._sum.discountAmount);
    const totalTaxCollected = n(salesAgg._sum.cgstTotal) + n(salesAgg._sum.sgstTotal) + n(salesAgg._sum.igstTotal);

    const totalPurchases    = n(purchaseAgg._sum.grandTotal);
    const totalTaxPaid      = n(purchaseAgg._sum.cgstTotal) + n(purchaseAgg._sum.sgstTotal) + n(purchaseAgg._sum.igstTotal);

    const grossProfit    = parseFloat((totalSales - totalPurchases).toFixed(2));
    const netTaxPayable  = parseFloat((totalTaxCollected - totalTaxPaid).toFixed(2));

    return {
      period:         { startDate: start, endDate: end },
      totalSales,
      totalPurchases,
      grossProfit,
      totalDiscount,
      tax: {
        totalTaxCollected: parseFloat(totalTaxCollected.toFixed(2)),
        totalTaxPaid:      parseFloat(totalTaxPaid.toFixed(2)),
        netTaxPayable,
      },
    };
  }

  // ─── 5. CASH vs SYSTEM (POS SHIFT SUMMARY) ────────────

  async getCashSummary(businessId: string, query: CashSummaryDto) {
    const targetDate = query.date ? new Date(query.date) : new Date();

    const conds: Prisma.Sql[] = [
      Prisma.sql`pc."businessId" = ${businessId}`,
      Prisma.sql`ps."shiftDate" >= ${dayStart(targetDate)}`,
      Prisma.sql`ps."shiftDate" <= ${dayEnd(targetDate)}`,
    ];
    if (query.branchId) conds.push(Prisma.sql`ps."branchId" = ${query.branchId}`);

    type ShiftRow = {
      shift_id: string;
      shift_date: Date;
      status: string;
      counter_name: string;
      counter_code: string;
      cashier_name: string;
      opening_cash: string;
      closing_cash: string | null;
      expected_cash: string | null;
      cash_diff: string | null;
      total_bills: number;
      total_sales: string;
      total_cash: string;
      total_upi: string;
      total_card: string;
      start_time: Date;
      end_time: Date | null;
    };

    const rows = await this.prisma.$queryRaw<ShiftRow[]>(Prisma.sql`
      SELECT
        ps.id                    AS shift_id,
        ps."shiftDate"           AS shift_date,
        ps.status,
        pc.name                  AS counter_name,
        pc.code                  AS counter_code,
        u."fullName"             AS cashier_name,
        ps."openingCash"::text   AS opening_cash,
        ps."closingCash"::text   AS closing_cash,
        ps."expectedCash"::text  AS expected_cash,
        ps."cashDiff"::text      AS cash_diff,
        ps."totalBills"          AS total_bills,
        ps."totalSales"::text    AS total_sales,
        ps."totalCash"::text     AS total_cash,
        ps."totalUpi"::text      AS total_upi,
        ps."totalCard"::text     AS total_card,
        ps."startTime"           AS start_time,
        ps."endTime"             AS end_time
      FROM pos_shift   ps
      JOIN pos_counter pc ON ps."counterId" = pc.id
      JOIN "user"      u  ON ps."cashierId" = u.id
      WHERE ${Prisma.join(conds, ' AND ')}
      ORDER BY ps."startTime"
    `);

    const shifts = rows.map((r) => {
      const diff        = n(r.cash_diff);
      const hasMismatch = r.status === 'CLOSED' && Math.abs(diff) > 0.01;
      return {
        shiftId:     r.shift_id,
        shiftDate:   r.shift_date,
        status:      r.status,
        counterName: r.counter_name,
        counterCode: r.counter_code,
        cashierName: r.cashier_name,
        openingCash:  n(r.opening_cash),
        closingCash:  r.closing_cash  !== null ? n(r.closing_cash)  : null,
        expectedCash: r.expected_cash !== null ? n(r.expected_cash) : null,
        cashDifference: r.cash_diff   !== null ? diff               : null,
        totalBills:   n(r.total_bills),
        totalSales:   n(r.total_sales),
        paymentBreakdown: {
          cash: n(r.total_cash),
          upi:  n(r.total_upi),
          card: n(r.total_card),
        },
        startTime:    r.start_time,
        endTime:      r.end_time,
        hasMismatch,
        mismatchFlag: hasMismatch
          ? (diff > 0 ? `EXCESS ₹${diff.toFixed(2)}` : `SHORT ₹${Math.abs(diff).toFixed(2)}`)
          : null,
      };
    });

    const summary = {
      totalShifts:  shifts.length,
      openShifts:   shifts.filter((s) => s.status === 'OPEN').length,
      closedShifts: shifts.filter((s) => s.status === 'CLOSED').length,
      mismatchCount: shifts.filter((s) => s.hasMismatch).length,
      totalSales:   shifts.reduce((s, sh) => s + sh.totalSales, 0),
      totalCash:    shifts.reduce((s, sh) => s + sh.paymentBreakdown.cash, 0),
      totalUpi:     shifts.reduce((s, sh) => s + sh.paymentBreakdown.upi,  0),
      totalCard:    shifts.reduce((s, sh) => s + sh.paymentBreakdown.card, 0),
    };

    return { date: targetDate, shifts, summary };
  }

  // ─── 6. OWNER DASHBOARD (TODAY) ───────────────────────

  async getDashboard(businessId: string) {
    const now       = new Date();
    const todayS    = dayStart(now);
    const todayE    = dayEnd(now);
    const yesterday = new Date(now.getTime() - 86400000);
    const yS        = dayStart(yesterday);
    const yE        = dayEnd(yesterday);

    const [
      todayAgg,
      yesterdayAgg,
      cashMismatchRows,
      lowStockRows,
      pendingGRNs,
      pendingPaymentSuppliers,
      topProductRows,
    ] = await Promise.all([
      this.prisma.salesBill.aggregate({
        where: { businessId, status: 'FINAL', billDate: { gte: todayS, lte: todayE } },
        _sum:   { grandTotal: true },
        _count: { id: true },
      }),

      this.prisma.salesBill.aggregate({
        where: { businessId, status: 'FINAL', billDate: { gte: yS, lte: yE } },
        _sum:   { grandTotal: true },
        _count: { id: true },
      }),

      this.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM pos_shift ps
        JOIN pos_counter pc ON ps."counterId" = pc.id
        WHERE pc."businessId" = ${businessId}
          AND ps.status       = 'CLOSED'
          AND ps."shiftDate" >= ${todayS}
          AND ps."shiftDate" <= ${todayE}
          AND ps."cashDiff"  IS NOT NULL
          AND ABS(ps."cashDiff") > 0.01
      `),

      this.prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM product p
        WHERE p."businessId"  = ${businessId}
          AND p."isActive"    = true
          AND p."reorderLevel" > 0
          AND COALESCE((
            SELECT SUM(sl.quantity)
            FROM stock_ledger sl
            WHERE sl."productId" = p.id
          ), 0) <= p."reorderLevel"
      `),

      this.prisma.purchase.count({
        where: { businessId, status: 'PENDING_APPROVAL' },
      }),

      this.prisma.supplier.count({
        where: { businessId, outstandingBalance: { gt: 0 }, isActive: true },
      }),

      this.prisma.$queryRaw<Array<{
        product_id: string;
        product_name: string;
        barcode: string | null;
        total_qty: string;
        total_revenue: string;
      }>>(Prisma.sql`
        SELECT
          p.id             AS product_id,
          p.name           AS product_name,
          p.barcode,
          SUM(si.quantity)::text       AS total_qty,
          SUM(si."totalAmount")::text  AS total_revenue
        FROM sales_item   si
        JOIN sales_bill   sb ON si."billId"    = sb.id
        JOIN product       p ON si."productId" = p.id
        WHERE sb."businessId" = ${businessId}
          AND sb.status       = 'FINAL'
          AND sb."billDate"  >= ${todayS}
          AND sb."billDate"  <= ${todayE}
        GROUP BY p.id, p.name, p.barcode
        ORDER BY SUM(si."totalAmount") DESC
        LIMIT 5
      `),
    ]);

    const todaySales     = n(todayAgg._sum.grandTotal);
    const yesterdaySales = n(yesterdayAgg._sum.grandTotal);
    const salesGrowth    = yesterdaySales > 0
      ? parseFloat((((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(1))
      : null;

    return {
      generatedAt: now,
      sales: {
        todaySales,
        yesterdaySales,
        salesGrowth,
        todayBills:     todayAgg._count.id,
        yesterdayBills: yesterdayAgg._count.id,
      },
      alerts: {
        cashMismatch:    n(cashMismatchRows[0]?.count),
        lowStockCount:   n(lowStockRows[0]?.count),
        pendingGRNs,
        pendingPayments: pendingPaymentSuppliers,
      },
      topSellingProducts: topProductRows.map((r) => ({
        productId:    r.product_id,
        productName:  r.product_name,
        barcode:      r.barcode,
        totalQty:     n(r.total_qty),
        totalRevenue: n(r.total_revenue),
      })),
      onlineOrdersPending: 0,
    };
  }
}
