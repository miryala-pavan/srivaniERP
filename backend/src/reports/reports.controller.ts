import { Controller, Get, Query, Res, UseGuards, Request } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { CaExportService } from './ca-export.service';
import { DateRangeDto } from './dto/date-range.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { CashSummaryDto } from './dto/cash-summary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MANAGER_ROLES = [
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'ACCOUNTS_PERSON',
  'PURCHASE_CHECKER',
  'FLOOR_SUPERVISOR',
  'SALES_REP',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private caExportService: CaExportService,
  ) {}

  // ─── SALES ────────────────────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('sales/daily')
  getDailySales(@Request() req: any, @Query() query: DateRangeDto) {
    return this.reportsService.getDailySales(req.user.businessId, query);
  }

  // ─── INVENTORY ────────────────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('inventory/stock-summary')
  getStockSummary(@Request() req: any, @Query() query: StockQueryDto) {
    return this.reportsService.getStockSummary(req.user.businessId, query);
  }

  @Roles(...MANAGER_ROLES)
  @Get('inventory/low-stock')
  getLowStock(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.reportsService.getLowStock(req.user.businessId, branchId);
  }

  // ─── FINANCIAL ────────────────────────────────────────

  @Roles('SUPER_ADMIN', 'ACCOUNTS_PERSON', 'BRANCH_MANAGER')
  @Get('financial/profit')
  getProfitReport(@Request() req: any, @Query() query: DateRangeDto) {
    return this.reportsService.getProfitReport(req.user.businessId, query);
  }

  // ─── POS ──────────────────────────────────────────────
  // CASHIER allowed here — but scoped to their own shifts only (see service);
  // everyone else with an authenticated business role sees the full picture.

  @Get('pos/cash-summary')
  getCashSummary(@Request() req: any, @Query() query: CashSummaryDto) {
    const restrictToCashierId = req.user.role === 'CASHIER' ? req.user.userId : undefined;
    return this.reportsService.getCashSummary(req.user.businessId, query, restrictToCashierId);
  }

  // ─── PRODUCT SALES ────────────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('products/top-selling')
  getProductSalesReport(@Request() req: any, @Query() query: DateRangeDto & { limit?: string }) {
    return this.reportsService.getProductSalesReport(req.user.businessId, {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  // ─── RECEIVABLES AGEING ───────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('receivables/ageing')
  getReceivablesAgeing(@Request() req: any, @Query('asOf') asOf?: string) {
    return this.reportsService.getReceivablesAgeing(req.user.businessId, asOf);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('payables/ageing')
  getPayablesAgeing(@Request() req: any, @Query('asOf') asOf?: string) {
    return this.reportsService.getPayablesAgeing(req.user.businessId, asOf);
  }

  // ─── DAY BOOK / CASH BOOK ─────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('day-book')
  getDayBook(@Request() req: any, @Query('date') date?: string) {
    return this.reportsService.getDayBook(req.user.businessId, date);
  }

  // ─── DASHBOARD ────────────────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('dashboard/today')
  getDashboard(@Request() req: any) {
    return this.reportsService.getDashboard(req.user.businessId);
  }

  // ─── REORDER SUGGESTIONS ─────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('reorder-suggestions')
  getReorderSuggestions(@Request() req: any) {
    return this.reportsService.getReorderSuggestions(req.user.businessId);
  }

  // ─── SALES BY CATEGORY ────────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('sales/by-category')
  getSalesByCategory(@Request() req: any, @Query() query: DateRangeDto) {
    return this.reportsService.getSalesByCategory(req.user.businessId, query);
  }

  // ─── SALES BY PAYMENT MODE ────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('sales/by-payment-mode')
  getSalesByPaymentMode(@Request() req: any, @Query() query: DateRangeDto) {
    return this.reportsService.getSalesByPaymentMode(req.user.businessId, query);
  }

  // ─── PURCHASE REGISTER ────────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'PURCHASE_CHECKER')
  @Get('purchases')
  getPurchaseRegister(
    @Request() req: any,
    @Query() query: DateRangeDto & { supplierId?: string; status?: string },
  ) {
    return this.reportsService.getPurchaseRegister(req.user.businessId, query);
  }

  // ─── EXPENSE REPORT ───────────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('expenses')
  getExpenseReport(@Request() req: any, @Query() query: DateRangeDto) {
    return this.reportsService.getExpenseReport(req.user.businessId, query);
  }

  // ─── SLOW MOVING STOCK ────────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('inventory/slow-moving')
  getSlowMovingStock(@Request() req: any, @Query('days') days?: string) {
    return this.reportsService.getSlowMovingStock(req.user.businessId, days ? Number(days) : 30);
  }

  // ─── PRICE AUDIT ──────────────────────────────────────

  @Roles(...MANAGER_ROLES)
  @Get('price-audit')
  getPriceAudit(
    @Request() req: any,
    @Query() query: { startDate?: string; endDate?: string; source?: string },
  ) {
    return this.reportsService.getPriceAudit(req.user.businessId, query);
  }

  // ─── CA EXPORT ────────────────────────────────────────

  @Roles('SUPER_ADMIN', 'ACCOUNTS_PERSON', 'BRANCH_MANAGER', 'CA')
  @Get('ca-export')
  async caExport(
    @Request() req: any,
    @Query('fromDate') fromDate: string,
    @Query('toDate')   toDate:   string,
    @Res() res: Response,
  ) {
    const buffer = await this.caExportService.buildExport(req.user.businessId, fromDate, toDate);
    const from   = fromDate.replace(/-/g, '');
    const to     = toDate.replace(/-/g,   '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="CA_Export_${from}_${to}.xlsx"`);
    res.send(buffer);
  }
}
