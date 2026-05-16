import { ReportsService } from './reports.service';
import { DateRangeDto } from './dto/date-range.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { CashSummaryDto } from './dto/cash-summary.dto';
export declare class ReportsController {
    private reportsService;
    constructor(reportsService: ReportsService);
    getDailySales(req: any, query: DateRangeDto): Promise<{
        daily: {
            date: Date;
            totalBills: number;
            totalCustomers: number;
            subtotalAmount: number;
            discountAmount: number;
            taxableAmount: number;
            totalTax: number;
            grandTotal: number;
            paidAmount: number;
            balanceAmount: number;
        }[];
        summary: {
            totalBills: number;
            totalCustomers: number;
            subtotalAmount: number;
            discountAmount: number;
            taxableAmount: number;
            totalTax: number;
            grandTotal: number;
            paidAmount: number;
            balanceAmount: number;
        };
        dateRange: {
            startDate: Date;
            endDate: Date;
        };
    }>;
    getStockSummary(req: any, query: StockQueryDto): Promise<{
        products: {
            id: string;
            productName: string;
            barcode: string | null;
            hsnCode: string;
            unitOfMeasure: string;
            categoryName: string | null;
            brandName: string | null;
            currentStock: number;
            reorderLevel: number;
            costPrice: number;
            sellingPrice: number;
            stockValue: number;
            sellingValue: number;
            status: string;
        }[];
        summary: {
            totalProducts: number;
            outOfStock: number;
            lowStock: number;
            inStock: number;
            totalStockValue: number;
            totalSellValue: number;
        };
    }>;
    getLowStock(req: any, branchId?: string): Promise<{
        id: string;
        productName: string;
        barcode: string | null;
        hsnCode: string;
        unitOfMeasure: string;
        categoryName: string | null;
        currentStock: number;
        reorderLevel: number;
        shortageQty: number;
        severity: string;
    }[]>;
    getProfitReport(req: any, query: DateRangeDto): Promise<{
        period: {
            startDate: Date;
            endDate: Date;
        };
        totalSales: number;
        totalPurchases: number;
        grossProfit: number;
        totalDiscount: number;
        tax: {
            totalTaxCollected: number;
            totalTaxPaid: number;
            netTaxPayable: number;
        };
    }>;
    getCashSummary(req: any, query: CashSummaryDto): Promise<{
        date: Date;
        shifts: {
            shiftId: string;
            shiftDate: Date;
            status: string;
            counterName: string;
            counterCode: string;
            cashierName: string;
            openingCash: number;
            closingCash: number | null;
            expectedCash: number | null;
            cashDifference: number | null;
            totalBills: number;
            totalSales: number;
            paymentBreakdown: {
                cash: number;
                upi: number;
                card: number;
            };
            startTime: Date;
            endTime: Date | null;
            hasMismatch: boolean;
            mismatchFlag: string | null;
        }[];
        summary: {
            totalShifts: number;
            openShifts: number;
            closedShifts: number;
            mismatchCount: number;
            totalSales: number;
            totalCash: number;
            totalUpi: number;
            totalCard: number;
        };
    }>;
    getDashboard(req: any): Promise<{
        generatedAt: Date;
        sales: {
            todaySales: number;
            yesterdaySales: number;
            salesGrowth: number | null;
            todayBills: number;
            yesterdayBills: number;
        };
        alerts: {
            cashMismatch: number;
            lowStockCount: number;
            pendingGRNs: number;
            pendingPayments: number;
        };
        topSellingProducts: {
            productId: string;
            productName: string;
            barcode: string | null;
            totalQty: number;
            totalRevenue: number;
        }[];
        onlineOrdersPending: number;
    }>;
}
