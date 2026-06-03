import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
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
  constructor(private reportsService: ReportsService) {}

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
  // CASHIER allowed here — they need to see their own shift summary

  @Get('pos/cash-summary')
  getCashSummary(@Request() req: any, @Query() query: CashSummaryDto) {
    return this.reportsService.getCashSummary(req.user.businessId, query);
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
}
