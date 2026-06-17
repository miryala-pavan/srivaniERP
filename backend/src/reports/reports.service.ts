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

const r2 = (v: number) => Math.round(v * 100) / 100;
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

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayAgg,
      yesterdayAgg,
      cashMismatchRows,
      lowStockRows,
      pendingGRNs,
      pendingPaymentSuppliers,
      topProductRows,
      mtdAgg,
      paymentBreakdownRows,
      onlinePendingCount,
      onlineTodayAgg,
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

      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT s.id)::bigint AS count
        FROM supplier s
        WHERE s."businessId" = ${businessId}
          AND s."isActive" = true
          AND (
            COALESCE(s."openingBalance", 0) * CASE WHEN s."openingBalanceType" = 'DEBIT' THEN 1 ELSE -1 END
            + COALESCE((
                SELECT SUM(p."grandTotal")
                FROM purchase p
                WHERE p."supplierId" = s.id AND p."businessId" = ${businessId} AND p.status = 'APPROVED'
              ), 0)
            - COALESCE((
                SELECT SUM(sp.amount)
                FROM supplier_payment sp
                WHERE sp."supplierId" = s.id AND sp."businessId" = ${businessId}
              ), 0)
            - COALESCE((
                SELECT SUM(cn."totalAmount")
                FROM supplier_credit_note cn
                WHERE cn."supplierId" = s.id AND cn."businessId" = ${businessId} AND cn.status = 'ACTIVE'
              ), 0)
          ) > 0
      `),

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

      this.prisma.salesBill.aggregate({
        where: { businessId, status: 'FINAL', billDate: { gte: monthStart, lte: todayE } },
        _sum:   { grandTotal: true },
        _count: { id: true },
      }),

      this.prisma.$queryRaw<Array<{
        cash: string; upi: string; card: string;
      }>>(Prisma.sql`
        SELECT
          COALESCE(SUM("cashAmount"), 0)::text AS cash,
          COALESCE(SUM("upiAmount"),  0)::text AS upi,
          COALESCE(SUM("cardAmount"), 0)::text AS card
        FROM sales_bill
        WHERE "businessId" = ${businessId}
          AND status       = 'FINAL'
          AND "billDate"  >= ${todayS}
          AND "billDate"  <= ${todayE}
      `),

      this.prisma.onlineOrder.count({
        where: {
          businessId,
          status: { in: ['PENDING_COD', 'CONFIRMED', 'PROCESSING'] },
        },
      }),

      this.prisma.onlineOrder.aggregate({
        where: {
          businessId,
          createdAt: { gte: todayS, lte: todayE },
          status: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] },
        },
        _sum:   { total: true },
        _count: { id: true },
      }),
    ]);

    const todaySales     = n(todayAgg._sum.grandTotal);
    const yesterdaySales = n(yesterdayAgg._sum.grandTotal);
    const salesGrowth    = yesterdaySales > 0
      ? parseFloat((((todaySales - yesterdaySales) / yesterdaySales) * 100).toFixed(1))
      : null;

    const todayBills     = todayAgg._count.id;
    const yesterdayBills = yesterdayAgg._count.id;
    const avgBasketToday     = todayBills > 0     ? r2(todaySales / todayBills)         : 0;
    const avgBasketYesterday = yesterdayBills > 0 ? r2(yesterdaySales / yesterdayBills) : 0;
    const basketGrowth = avgBasketYesterday > 0
      ? parseFloat((((avgBasketToday - avgBasketYesterday) / avgBasketYesterday) * 100).toFixed(1))
      : null;

    const pb = paymentBreakdownRows[0] ?? { cash: '0', upi: '0', card: '0' };

    return {
      generatedAt: now,
      sales: {
        todaySales,
        yesterdaySales,
        salesGrowth,
        todayBills,
        yesterdayBills,
      },
      thisMonth: {
        revenue: n(mtdAgg._sum.grandTotal),
        bills:   mtdAgg._count.id,
      },
      avgBasket: {
        today:     avgBasketToday,
        yesterday: avgBasketYesterday,
        growth:    basketGrowth,
      },
      paymentBreakdown: {
        cash: n(pb.cash),
        upi:  n(pb.upi),
        card: n(pb.card),
      },
      onlineOrders: {
        pendingCount: onlinePendingCount,
        todayCount:   onlineTodayAgg._count.id,
        todayRevenue: n(onlineTodayAgg._sum.total),
      },
      alerts: {
        cashMismatch:    n(cashMismatchRows[0]?.count),
        lowStockCount:   n(lowStockRows[0]?.count),
        pendingGRNs,
        pendingPayments: n(pendingPaymentSuppliers[0]?.count),
      },
      topSellingProducts: topProductRows.map((r) => ({
        productId:    r.product_id,
        productName:  r.product_name,
        barcode:      r.barcode,
        totalQty:     n(r.total_qty),
        totalRevenue: n(r.total_revenue),
      })),
      onlineOrdersPending: onlinePendingCount,
    };
  }

  // ─── 7. REORDER SUGGESTIONS ──────────────────────────

  async getReorderSuggestions(businessId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    type Row = {
      product_id: string;
      product_name: string;
      product_code: string | null;
      uom: string;
      reorder_level: string;
      category_name: string | null;
      current_stock: string;
      avg_daily_qty: string;
      days_remaining: string | null;
      suggested_qty: string;
    };

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      WITH stock AS (
        SELECT "productId", COALESCE(SUM(quantity), 0) AS current_stock
        FROM stock_ledger
        WHERE "businessId" = ${businessId}
        GROUP BY "productId"
      ),
      sales AS (
        SELECT si."productId",
               COALESCE(SUM(si.quantity), 0) / 30.0 AS avg_daily_qty
        FROM sales_item si
        JOIN sales_bill sb ON sb.id = si."billId"
        WHERE sb."businessId" = ${businessId}
          AND sb.status       = 'FINAL'
          AND sb."billDate"  >= ${thirtyDaysAgo}
        GROUP BY si."productId"
      )
      SELECT
        p.id                                                          AS product_id,
        p.name                                                        AS product_name,
        p."productCode"                                               AS product_code,
        p."unitOfMeasure"                                             AS uom,
        p."reorderLevel"::text                                        AS reorder_level,
        c.label                                                       AS category_name,
        COALESCE(s.current_stock, 0)::text                           AS current_stock,
        COALESCE(sa.avg_daily_qty, 0)::text                          AS avg_daily_qty,
        CASE
          WHEN COALESCE(sa.avg_daily_qty, 0) > 0
          THEN (COALESCE(s.current_stock, 0) / sa.avg_daily_qty)::text
          ELSE NULL
        END                                                           AS days_remaining,
        GREATEST(
          p."reorderLevel",
          CASE
            WHEN COALESCE(sa.avg_daily_qty, 0) > 0
            THEN CEIL(sa.avg_daily_qty * 14 - COALESCE(s.current_stock, 0))
            ELSE p."reorderLevel" * 2
          END
        )::text                                                       AS suggested_qty
      FROM product p
      LEFT JOIN category c  ON c.id = p."categoryId"
      LEFT JOIN stock s     ON s."productId" = p.id
      LEFT JOIN sales sa    ON sa."productId" = p.id
      WHERE p."businessId" = ${businessId}
        AND p."isActive"   = true
        AND (
          COALESCE(s.current_stock, 0) <= 0
          OR COALESCE(s.current_stock, 0) <= p."reorderLevel"
          OR (
            COALESCE(sa.avg_daily_qty, 0) > 0
            AND (COALESCE(s.current_stock, 0) / sa.avg_daily_qty) <= 14
          )
        )
      ORDER BY
        CASE
          WHEN COALESCE(s.current_stock, 0) <= 0 THEN 0
          WHEN COALESCE(sa.avg_daily_qty, 0) > 0
           AND (COALESCE(s.current_stock, 0) / sa.avg_daily_qty) <= 3 THEN 1
          WHEN COALESCE(s.current_stock, 0) <= p."reorderLevel" THEN 2
          ELSE 3
        END,
        COALESCE(s.current_stock, 0) / NULLIF(sa.avg_daily_qty, 0) ASC NULLS FIRST
    `);

    return rows.map((r) => {
      const currentStock   = n(r.current_stock);
      const avgDaily       = n(r.avg_daily_qty);
      const daysRemaining  = r.days_remaining !== null ? n(r.days_remaining) : null;
      const suggestedQty   = n(r.suggested_qty);

      let urgency: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'WATCH';
      if (currentStock <= 0)                                          urgency = 'OUT_OF_STOCK';
      else if (daysRemaining !== null && daysRemaining <= 3)         urgency = 'CRITICAL';
      else if (daysRemaining !== null && daysRemaining <= 7)         urgency = 'LOW';
      else                                                            urgency = 'WATCH';

      return {
        productId:    r.product_id,
        productName:  r.product_name,
        productCode:  r.product_code,
        uom:          r.uom,
        reorderLevel: n(r.reorder_level),
        categoryName: r.category_name,
        currentStock: r2(currentStock),
        avgDailyQty:  parseFloat(avgDaily.toFixed(2)),
        daysRemaining: daysRemaining !== null
          ? parseFloat(daysRemaining.toFixed(1))
          : null,
        suggestedQty: Math.max(1, Math.ceil(suggestedQty)),
        urgency,
      };
    });
  }

  // ─── 8. PRODUCT-WISE SALES ────────────────────────────

  async getProductSalesReport(businessId: string, query: DateRangeDto & { limit?: number }) {
    const end   = query.endDate   ? new Date(query.endDate)   : new Date();
    const start = query.startDate ? new Date(query.startDate) : new Date(end.getFullYear(), end.getMonth(), 1);
    const limit = Math.min(query.limit ?? 100, 500);

    type Row = {
      product_id: string; product_name: string; product_code: string | null;
      category_name: string | null; unit_of_measure: string;
      total_qty: string; total_revenue: string; taxable_amount: string;
      bill_count: bigint; avg_price: string;
    };

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT
        si."productId"                                    AS product_id,
        p.name                                            AS product_name,
        p."productCode"                                   AS product_code,
        c.label                                           AS category_name,
        p."unitOfMeasure"                                 AS unit_of_measure,
        COALESCE(SUM(si.quantity),        0)::text        AS total_qty,
        COALESCE(SUM(si."totalAmount"),   0)::text        AS total_revenue,
        COALESCE(SUM(si."taxableAmount"), 0)::text        AS taxable_amount,
        COUNT(DISTINCT si."billId")                       AS bill_count,
        CASE WHEN SUM(si.quantity) > 0
             THEN (SUM(si."totalAmount") / SUM(si.quantity))::text
             ELSE '0' END                                 AS avg_price
      FROM sales_item si
      JOIN sales_bill sb  ON sb.id = si."billId"
      JOIN product    p   ON p.id  = si."productId"
      LEFT JOIN category c ON c.id = p."categoryId"
      WHERE sb."businessId" = ${businessId}
        AND sb.status        = 'FINAL'
        AND sb."billDate"   >= ${dayStart(start)}
        AND sb."billDate"   <= ${dayEnd(end)}
        AND p."isActive"     = true
      GROUP BY si."productId", p.name, p."productCode", c.label, p."unitOfMeasure"
      ORDER BY SUM(si."totalAmount") DESC
      LIMIT ${limit}
    `);

    const totalRevenue = rows.reduce((s, r) => s + n(r.total_revenue), 0);

    const products = rows.map((r) => ({
      productId:     r.product_id,
      productName:   r.product_name,
      productCode:   r.product_code,
      categoryName:  r.category_name,
      unitOfMeasure: r.unit_of_measure,
      totalQty:      n(r.total_qty),
      totalRevenue:  n(r.total_revenue),
      taxableAmount: n(r.taxable_amount),
      billCount:     n(r.bill_count),
      avgPrice:      n(r.avg_price),
      revenuePct:    totalRevenue > 0 ? parseFloat(((n(r.total_revenue) / totalRevenue) * 100).toFixed(1)) : 0,
    }));

    return {
      period:       { startDate: start, endDate: end },
      products,
      summary: {
        totalProducts: products.length,
        totalRevenue,
        totalQty: products.reduce((s, p) => s + p.totalQty, 0),
      },
    };
  }

  // ─── RECEIVABLES AGEING ───────────────────────────────
  // Outstanding credit bills bucketed by age: 0-30 / 31-60 / 61-90 / 90+ days.

  async getReceivablesAgeing(businessId: string, asOf?: string) {
    const today = asOf ? dayEnd(new Date(asOf)) : new Date();

    // Unpaid / partially-paid credit bills
    const bills = await this.prisma.salesBill.findMany({
      where: {
        businessId,
        status:        'FINAL' as any,
        isVoided:      false,
        saleType:      'CREDIT' as any,
        balanceAmount: { gt: 0 },
      },
      select: {
        id: true, billNumber: true, billDate: true, balanceAmount: true,
        customerId: true, customerName: true, customerPhone: true,
      },
      orderBy: { billDate: 'asc' },
    });

    type Cust = {
      customerId: string | null; customerName: string; customerPhone: string | null;
      b0_30: number; b31_60: number; b61_90: number; b90_plus: number;
      total: number; billCount: number; oldestDays: number;
    };
    const map = new Map<string, Cust>();

    for (const b of bills) {
      const bal  = n(b.balanceAmount);
      const days = Math.max(0, Math.floor((today.getTime() - new Date(b.billDate).getTime()) / 86400000));
      const key  = b.customerId ?? `walkin:${b.customerName ?? 'Unknown'}`;

      const c = map.get(key) ?? {
        customerId: b.customerId, customerName: b.customerName ?? 'Walk-in',
        customerPhone: b.customerPhone ?? null,
        b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0,
        total: 0, billCount: 0, oldestDays: 0,
      };

      if      (days <= 30) c.b0_30    = r2(c.b0_30    + bal);
      else if (days <= 60) c.b31_60   = r2(c.b31_60   + bal);
      else if (days <= 90) c.b61_90   = r2(c.b61_90   + bal);
      else                 c.b90_plus = r2(c.b90_plus + bal);

      c.total      = r2(c.total + bal);
      c.billCount += 1;
      c.oldestDays = Math.max(c.oldestDays, days);
      map.set(key, c);
    }

    const customers = [...map.values()].sort((a, b) => b.total - a.total);

    const totals = customers.reduce(
      (acc, c) => ({
        b0_30:    r2(acc.b0_30    + c.b0_30),
        b31_60:   r2(acc.b31_60   + c.b31_60),
        b61_90:   r2(acc.b61_90   + c.b61_90),
        b90_plus: r2(acc.b90_plus + c.b90_plus),
        total:    r2(acc.total    + c.total),
      }),
      { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 },
    );

    return {
      asOf:     today.toISOString(),
      customers,
      totals,
      summary: {
        customerCount:  customers.length,
        billCount:      bills.length,
        totalOutstanding: totals.total,
      },
    };
  }

  // ─── DAY BOOK + CASH BOOK ─────────────────────────────
  // Day Book: chronological list of the day's money movements (all modes).
  // Cash Book: cash-only opening / receipts / payments / closing.

  async getDayBook(businessId: string, dateStr?: string) {
    const date  = dateStr ? new Date(dateStr) : new Date();
    const start = dayStart(date);
    const end   = dayEnd(date);

    const [bills, custPayments, expenses, supplierPayments, shifts] = await Promise.all([
      this.prisma.salesBill.findMany({
        where: {
          businessId, status: 'FINAL' as any, isVoided: false,
          billType: { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
          billDate: { gte: start, lte: end },
        },
        select: {
          id: true, billNumber: true, billDate: true, grandTotal: true,
          paymentMode: true, saleType: true, customerName: true,
          cashAmount: true, upiAmount: true, cardAmount: true, paidAmount: true,
        },
        orderBy: { billDate: 'asc' },
      }),
      this.prisma.customerPayment.findMany({
        where: { businessId, paymentDate: { gte: start, lte: end } },
        select: { id: true, paymentDate: true, amount: true, paymentMode: true, reference: true,
          customer: { select: { name: true } } },
        orderBy: { paymentDate: 'asc' },
      }),
      this.prisma.expense.findMany({
        where: { businessId, expenseDate: { gte: start, lte: end } },
        select: { id: true, expenseDate: true, amount: true, paymentMode: true,
          category: true, vendorName: true, description: true },
        orderBy: { expenseDate: 'asc' },
      }),
      this.prisma.supplierAdvance.findMany({
        where: { businessId, paymentDate: { gte: start, lte: end } },
        select: { id: true, paymentDate: true, amount: true, paymentMode: true, referenceNo: true,
          supplier: { select: { name: true } } },
        orderBy: { paymentDate: 'asc' },
      }),
      this.prisma.posShift.findMany({
        where: { counter: { businessId }, startTime: { gte: start, lte: end } },
        select: { openingCash: true },
      }),
    ]);

    const isCash = (m?: string | null) => (m ?? '').toUpperCase() === 'CASH';

    type Entry = {
      time: string; type: 'SALE' | 'RECEIPT' | 'EXPENSE' | 'SUPPLIER_PAYMENT';
      reference: string; particulars: string; mode: string;
      moneyIn: number; moneyOut: number; isCash: boolean;
    };
    const entries: Entry[] = [];

    for (const b of bills) {
      entries.push({
        time: b.billDate.toISOString(), type: 'SALE',
        reference: b.billNumber ?? b.id,
        particulars: b.customerName ?? 'Walk-in',
        mode: b.paymentMode ?? 'CASH',
        moneyIn: n(b.paidAmount), moneyOut: 0,
        // SPLIT bills may carry a partial cash component
        isCash: isCash(b.paymentMode) || n(b.cashAmount) > 0,
      });
    }
    for (const p of custPayments) {
      entries.push({
        time: p.paymentDate.toISOString(), type: 'RECEIPT',
        reference: p.reference ?? '—',
        particulars: `${p.customer?.name ?? 'Customer'} (payment)`,
        mode: p.paymentMode, moneyIn: n(p.amount), moneyOut: 0, isCash: isCash(p.paymentMode),
      });
    }
    for (const e of expenses) {
      entries.push({
        time: e.expenseDate.toISOString(), type: 'EXPENSE',
        reference: e.category ?? 'Expense',
        particulars: e.vendorName ?? e.description ?? 'Expense',
        mode: e.paymentMode, moneyIn: 0, moneyOut: n(e.amount), isCash: isCash(e.paymentMode),
      });
    }
    for (const s of supplierPayments) {
      entries.push({
        time: s.paymentDate.toISOString(), type: 'SUPPLIER_PAYMENT',
        reference: s.referenceNo ?? '—',
        particulars: `${s.supplier?.name ?? 'Supplier'} (payment)`,
        mode: s.paymentMode, moneyIn: 0, moneyOut: n(s.amount), isCash: isCash(s.paymentMode),
      });
    }

    entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Cash component for SPLIT/cash sales uses cashAmount when present
    const cashInFromSales = bills.reduce((sum, b) =>
      sum + (n(b.cashAmount) > 0 ? n(b.cashAmount) : (isCash(b.paymentMode) ? n(b.paidAmount) : 0)), 0);
    const cashInFromReceipts = custPayments.filter(p => isCash(p.paymentMode)).reduce((s, p) => s + n(p.amount), 0);
    const cashOutExpenses    = expenses.filter(e => isCash(e.paymentMode)).reduce((s, e) => s + n(e.amount), 0);
    const cashOutSuppliers   = supplierPayments.filter(s => isCash(s.paymentMode)).reduce((s, x) => s + n(x.amount), 0);
    const openingCash        = shifts.reduce((s, sh) => s + n(sh.openingCash), 0);

    const cashIn  = r2(cashInFromSales + cashInFromReceipts);
    const cashOut = r2(cashOutExpenses + cashOutSuppliers);

    const dayBook = {
      totalIn:  r2(entries.reduce((s, e) => s + e.moneyIn, 0)),
      totalOut: r2(entries.reduce((s, e) => s + e.moneyOut, 0)),
      salesTotal:    r2(bills.reduce((s, b) => s + n(b.paidAmount), 0)),
      receiptsTotal: r2(custPayments.reduce((s, p) => s + n(p.amount), 0)),
      expenseTotal:  r2(expenses.reduce((s, e) => s + n(e.amount), 0)),
      supplierTotal: r2(supplierPayments.reduce((s, x) => s + n(x.amount), 0)),
    };

    const cashBook = {
      openingCash:  r2(openingCash),
      cashIn,
      cashInFromSales:    r2(cashInFromSales),
      cashInFromReceipts: r2(cashInFromReceipts),
      cashOut,
      cashOutExpenses:  r2(cashOutExpenses),
      cashOutSuppliers: r2(cashOutSuppliers),
      expectedClosing: r2(openingCash + cashIn - cashOut),
    };

    return { date: start.toISOString(), entries, dayBook, cashBook };
  }
}
