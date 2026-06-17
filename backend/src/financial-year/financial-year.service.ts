import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const n = (v: any) => parseFloat(String(v ?? 0)) || 0;

@Injectable()
export class FinancialYearService {
  constructor(private prisma: PrismaService) {}

  // ─── LIST ALL FYs ─────────────────────────────────────

  async listAll(businessId: string) {
    const fys = await this.prisma.financialYear.findMany({
      where:   { businessId },
      orderBy: { startDate: 'desc' },
      include: {
        billSeries: {
          where:  { isActive: true },
          select: { billType: true, seriesPrefix: true, currentNumber: true },
        },
        _count: { select: { salesBills: true } },
      },
    });

    // Attach purchase + payment counts per FY using date ranges
    const results = await Promise.all(fys.map(async fy => {
      const [purchaseCount, paymentCount] = await Promise.all([
        this.prisma.purchase.count({
          where: { businessId, status: 'APPROVED',
            invoiceDate: { gte: fy.startDate, lte: fy.endDate } },
        }),
        this.prisma.supplierPayment.count({
          where: { businessId,
            paymentDate: { gte: fy.startDate, lte: fy.endDate } },
        }),
      ]);
      return { ...fy, purchaseCount, paymentCount };
    }));

    return results;
  }

  // ─── ACTIVE FY ────────────────────────────────────────

  async getActive(businessId: string) {
    const fy = await this.prisma.financialYear.findFirst({
      where:   { businessId, isActive: true, isClosed: false },
      orderBy: { startDate: 'desc' },
      include: {
        billSeries: { where: { isActive: true } },
      },
    });
    if (!fy) throw new NotFoundException('No active financial year found');
    return fy;
  }

  // ─── YEAR-END PREVIEW ────────────────────────────────
  // Shows exactly what will happen before closing — no changes made

  async getClosePreview(businessId: string) {
    const fy = await this.prisma.financialYear.findFirst({
      where:   { businessId, isActive: true, isClosed: false },
      orderBy: { startDate: 'desc' },
    });
    if (!fy) throw new NotFoundException('No active financial year to close');

    const [
      salesAgg,
      purchaseAgg,
      supplierDues,
      bankAccounts,
      billSeries,
      topUnpaidSuppliers,
    ] = await Promise.all([
      // Total sales this FY
      this.prisma.salesBill.aggregate({
        where: { businessId, financialYearId: fy.id, status: 'FINAL' },
        _sum:  { grandTotal: true },
        _count: { id: true },
      }),

      // Total purchases this FY
      this.prisma.purchase.aggregate({
        where: { businessId, status: 'APPROVED',
          invoiceDate: { gte: fy.startDate, lte: fy.endDate } },
        _sum:  { grandTotal: true, balanceAmount: true },
        _count: { id: true },
      }),

      // Supplier dues (carry forward)
      this.prisma.purchase.aggregate({
        where: { businessId, status: 'APPROVED', balanceAmount: { gt: 0 } },
        _sum:  { balanceAmount: true },
        _count: { id: true },
      }),

      // Bank balances
      this.prisma.bankAccount.findMany({
        where:  { businessId, isActive: true },
        select: { id: true, accountName: true, bankName: true, currentBalance: true },
      }),

      // Bill series that will reset
      this.prisma.billSeries.findMany({
        where: { businessId, financialYearId: fy.id, isActive: true },
      }),

      // Top 5 suppliers with outstanding dues
      this.prisma.supplier.findMany({
        where: { businessId, isActive: true },
        select: {
          name: true,
          purchases: {
            where:  { status: 'APPROVED', balanceAmount: { gt: 0 } },
            select: { balanceAmount: true },
          },
        },
      }).then(sups =>
        sups
          .map(s => ({
            name: s.name,
            due:  s.purchases.reduce((sum, p) => sum + n(p.balanceAmount), 0),
          }))
          .filter(s => s.due > 0)
          .sort((a, b) => b.due - a.due)
          .slice(0, 5)
      ),
    ]);

    // Stock value snapshot
    const stockValue = await this.prisma.$queryRaw<{ total: string }[]>`
      SELECT COALESCE(SUM(sl.quantity * p."costPrice"), 0)::text AS total
      FROM stock_ledger sl
      JOIN product p ON p.id = sl."productId"
      WHERE sl."businessId" = ${businessId}
        AND sl."movementType" IN ('PURCHASE','OPENING','RETURN_IN','ADJUSTMENT_IN')
      MINUS
      /* can't do raw arithmetic easily — use app-level fallback */
    `.catch(() => [{ total: '0' }]);

    // Simpler stock value via aggregate
    const stockLedger = await this.prisma.stockLedger.groupBy({
      by:    ['productId'],
      where: { businessId },
      _sum:  { quantity: true },
    });

    // Get cost prices
    const products = await this.prisma.product.findMany({
      where:  { businessId },
      select: { id: true, costPrice: true },
    });
    const costMap = Object.fromEntries(products.map(p => [p.id, n(p.costPrice)]));
    const totalStockValue = stockLedger.reduce((sum, row) => {
      const qty  = n(row._sum.quantity);
      const cost = costMap[row.productId] ?? 0;
      return sum + qty * cost;
    }, 0);

    // Next FY
    const newFyYear  = fy.endDate.getFullYear();  // endDate is 31 Mar YYYY
    const newFyCode  = `${newFyYear}-${String(newFyYear + 1).slice(-2)}`;
    const newStart   = new Date(newFyYear, 3, 1);   // Apr 1
    const newEnd     = new Date(newFyYear + 1, 2, 31, 23, 59, 59);

    return {
      currentFy: {
        id:        fy.id,
        fyCode:    fy.fyCode,
        startDate: fy.startDate,
        endDate:   fy.endDate,
      },
      newFy: {
        fyCode:    newFyCode,
        startDate: newStart,
        endDate:   newEnd,
      },
      summary: {
        totalSales:       n(salesAgg._sum.grandTotal),
        totalSalesBills:  salesAgg._count.id,
        totalPurchases:   n(purchaseAgg._sum.grandTotal),
        totalGrns:        purchaseAgg._count.id,
        supplierDues:     n(supplierDues._sum.balanceAmount),
        supplierDuesCount: supplierDues._count.id,
        stockValue:       Math.round(totalStockValue),
        bankAccounts:     bankAccounts.map(a => ({
          name:    a.accountName,
          bank:    a.bankName,
          balance: n(a.currentBalance),
        })),
        totalBankBalance: bankAccounts.reduce((s, a) => s + n(a.currentBalance), 0),
      },
      billSeriesWillReset: billSeries.map(bs => ({
        billType:      bs.billType,
        prefix:        bs.seriesPrefix,
        currentNumber: bs.currentNumber,
        nextFyNumber:  1,
      })),
      topUnpaidSuppliers,
      warnings: [
        ...(n(supplierDues._sum.balanceAmount) > 0
          ? [`₹${Math.round(n(supplierDues._sum.balanceAmount)).toLocaleString('en-IN')} supplier dues will carry forward to next year`]
          : []),
        ...billSeries.map(bs =>
          `${bs.billType} series will reset — last number was ${bs.seriesPrefix}${String(bs.currentNumber).padStart(4,'0')}`
        ),
      ],
    };
  }

  // ─── EXECUTE YEAR CLOSE ───────────────────────────────

  async closeYear(businessId: string) {
    const fy = await this.prisma.financialYear.findFirst({
      where:   { businessId, isActive: true, isClosed: false },
      orderBy: { startDate: 'desc' },
      include: { billSeries: { where: { isActive: true } } },
    });
    if (!fy) throw new BadRequestException('No active financial year to close');

    // Build closing snapshot
    const [salesAgg, purchaseAgg, supplierDues, bankAccounts] = await Promise.all([
      this.prisma.salesBill.aggregate({
        where: { businessId, financialYearId: fy.id, status: 'FINAL' },
        _sum:  { grandTotal: true },
      }),
      this.prisma.purchase.aggregate({
        where: { businessId, status: 'APPROVED',
          invoiceDate: { gte: fy.startDate, lte: fy.endDate } },
        _sum:  { grandTotal: true },
      }),
      this.prisma.purchase.aggregate({
        where: { businessId, status: 'APPROVED', balanceAmount: { gt: 0 } },
        _sum:  { balanceAmount: true },
      }),
      this.prisma.bankAccount.findMany({
        where:  { businessId, isActive: true },
        select: { currentBalance: true },
      }),
    ]);

    // Stock value
    const stockLedger = await this.prisma.stockLedger.groupBy({
      by:    ['productId'],
      where: { businessId },
      _sum:  { quantity: true },
    });
    const products = await this.prisma.product.findMany({
      where:  { businessId },
      select: { id: true, costPrice: true },
    });
    const costMap = Object.fromEntries(products.map(p => [p.id, n(p.costPrice)]));
    const totalStockValue = stockLedger.reduce((sum, row) => {
      return sum + n(row._sum.quantity) * (costMap[row.productId] ?? 0);
    }, 0);

    const totalBankBalance = bankAccounts.reduce((s, a) => s + n(a.currentBalance), 0);

    // New FY dates
    const newFyYear = fy.endDate.getFullYear();
    const newFyCode = `${newFyYear}-${String(newFyYear + 1).slice(-2)}`;
    const newStart  = new Date(newFyYear, 3, 1);
    const newEnd    = new Date(newFyYear + 1, 2, 31, 23, 59, 59);

    // Check new FY doesn't already exist
    const existing = await this.prisma.financialYear.findFirst({
      where: { businessId, fyCode: newFyCode },
    });
    if (existing) throw new BadRequestException(`FY ${newFyCode} already exists`);

    await this.prisma.$transaction(async (tx) => {
      // 1. Close current FY
      await tx.financialYear.update({
        where: { id: fy.id },
        data: {
          isClosed:               true,
          isActive:               false,
          closedAt:               new Date(),
          closingTotalSales:      n(salesAgg._sum.grandTotal),
          closingTotalPurchases:  n(purchaseAgg._sum.grandTotal),
          closingSupplierDues:    n(supplierDues._sum.balanceAmount),
          closingStockValue:      Math.round(totalStockValue),
          closingBankBalance:     totalBankBalance,
        },
      });

      // 2. Create new FY
      const newFy = await tx.financialYear.create({
        data: {
          businessId,
          fyCode:    newFyCode,
          startDate: newStart,
          endDate:   newEnd,
          isActive:  true,
          isClosed:  false,
        },
      });

      // 3. Clone bill series into new FY — reset currentNumber to 0
      for (const bs of fy.billSeries) {
        await tx.billSeries.create({
          data: {
            businessId,
            financialYearId: newFy.id,
            billType:        bs.billType,
            seriesPrefix:    bs.seriesPrefix,
            currentNumber:   0,
            numberFormat:    bs.numberFormat,
            isActive:        true,
          },
        });
      }
    });

    return {
      message:   `FY ${fy.fyCode} closed successfully. FY ${newFyCode} is now active.`,
      closedFy:  fy.fyCode,
      newFy:     newFyCode,
    };
  }

  // ─── YEAR COMPARISON ─────────────────────────────────

  async getYearComparison(businessId: string) {
    const allFys = await this.prisma.financialYear.findMany({
      where:   { businessId },
      orderBy: { startDate: 'desc' },
      take:    3,   // last 3 years
    });

    const results = await Promise.all(allFys.map(async fy => {
      const [salesAgg, purchaseAgg, paymentAgg, expenseAgg] = await Promise.all([
        this.prisma.salesBill.aggregate({
          where: { businessId, financialYearId: fy.id, status: 'FINAL' },
          _sum:  { grandTotal: true, taxableAmount: true,
                   cgstTotal: true, sgstTotal: true },
          _count: { id: true },
        }),
        this.prisma.purchase.aggregate({
          where: { businessId, status: 'APPROVED',
            invoiceDate: { gte: fy.startDate, lte: fy.endDate } },
          _sum:  { grandTotal: true },
          _count: { id: true },
        }),
        this.prisma.supplierPayment.aggregate({
          where: { businessId,
            paymentDate: { gte: fy.startDate, lte: fy.endDate } },
          _sum:  { amount: true },
        }),
        // Bank expenses
        this.prisma.bankTransaction.aggregate({
          where: {
            businessId,
            txnType: { in: ['EXPENSE_RENT','EXPENSE_OTHER','BANK_CHARGE'] },
            txnDate: { gte: fy.startDate, lte: fy.endDate },
          },
          _sum: { debitAmount: true },
        }),
      ]);

      // Payment mode breakdown for sales
      const modeBreakdown = await this.prisma.salesBill.groupBy({
        by:    ['paymentMode'],
        where: { businessId, financialYearId: fy.id, status: 'FINAL' },
        _sum:  { grandTotal: true },
        _count: { id: true },
      });

      const totalSales     = n(salesAgg._sum.grandTotal);
      const totalPurchases = n(purchaseAgg._sum.grandTotal);
      const grossProfit    = n(salesAgg._sum.taxableAmount) - totalPurchases;
      const totalTax       = n(salesAgg._sum.cgstTotal) + n(salesAgg._sum.sgstTotal);
      const totalExpenses  = n(expenseAgg._sum.debitAmount);

      // Use snapshot if FY is closed
      return {
        fyCode:       fy.fyCode,
        startDate:    fy.startDate,
        endDate:      fy.endDate,
        isClosed:     fy.isClosed,
        isActive:     fy.isActive,
        totalSales,
        totalBills:   salesAgg._count.id,
        totalPurchases,
        totalGrns:    purchaseAgg._count.id,
        totalPaymentsMade: n(paymentAgg._sum.amount),
        totalExpenses,
        grossProfit,
        totalGstCollected: totalTax,
        modeBreakdown: modeBreakdown.map(m => ({
          mode:  m.paymentMode,
          total: n(m._sum.grandTotal),
          count: m._count.id,
        })),
        // Closing snapshot (for closed FYs)
        snapshot: fy.isClosed ? {
          closingSupplierDues:  n(fy.closingSupplierDues),
          closingStockValue:    n(fy.closingStockValue),
          closingBankBalance:   n(fy.closingBankBalance),
        } : null,
      };
    }));

    return results;
  }

  // ─── GET FY BY ID (for switching) ────────────────────

  async getById(businessId: string, id: string) {
    const fy = await this.prisma.financialYear.findFirst({
      where:   { id, businessId },
      include: { billSeries: { where: { isActive: true } } },
    });
    if (!fy) throw new NotFoundException('Financial year not found');
    return fy;
  }
}
