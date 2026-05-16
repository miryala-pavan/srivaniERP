import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { PosService } from './pos.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateBillDto } from './dto/create-bill.dto';
import { BillQueryDto } from './dto/bill-query.dto';
import { CreateHoldDto } from './dto/create-hold.dto';
import { VoidBillDto } from './dto/void-bill.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pos')
export class PosController {
  constructor(private posService: PosService) {}

  // ─── COUNTERS ─────────────────────────────────────────

  @Post('counters')
  createCounter(@Request() req: any, @Body() dto: CreateCounterDto) {
    return this.posService.createCounter(req.user.businessId, dto);
  }

  @Get('counters')
  getCounters(@Request() req: any) {
    return this.posService.getCounters(req.user.businessId);
  }

  // ─── SHIFTS ───────────────────────────────────────────

  @Post('shifts/open')
  openShift(@Request() req: any, @Body() dto: OpenShiftDto) {
    return this.posService.openShift(req.user.businessId, req.user.userId, dto);
  }

  @Get('shifts/my-shift')
  getMyShift(@Request() req: any) {
    return this.posService.getMyShift(req.user.userId);
  }

  @Get('shifts/current')
  getCurrentShift(@Request() req: any) {
    return this.posService.getCurrentShift(req.user.userId, req.user.businessId);
  }

  @Get('shifts/today')
  getTodayShifts(@Request() req: any, @Query('date') date?: string) {
    return this.posService.getTodayShifts(req.user.businessId, date);
  }

  @Put('shifts/:id/force-close')
  forceCloseShift(@Request() req: any, @Param('id') id: string) {
    const user = req.user;
    return this.posService.forceCloseShift(user.businessId, id, user.fullName ?? user.username ?? 'Manager');
  }

  @Put('shifts/:id/close')
  closeShift(@Request() req: any, @Param('id') id: string, @Body() dto: CloseShiftDto) {
    return this.posService.closeShift(req.user.businessId, req.user.userId, id, dto);
  }

  // ─── HOLD BILLS ───────────────────────────────────────

  @Post('hold')
  createHold(@Request() req: any, @Body() dto: CreateHoldDto) {
    const user = req.user;
    return this.posService.createHold(user.userId, user.fullName ?? user.username, user.businessId, dto);
  }

  @Get('hold')
  getHeldBills(@Request() req: any) {
    return this.posService.getHeldBills(req.user.businessId);
  }

  @Delete('hold/:id')
  deleteHold(@Request() req: any, @Param('id') id: string) {
    return this.posService.deleteHold(id, req.user.businessId);
  }

  @Put('hold/:id/complete')
  completeHold(@Request() req: any, @Param('id') id: string) {
    return this.posService.completeHold(id, req.user.businessId);
  }

  // ─── BILLS ────────────────────────────────────────────
  // Static routes BEFORE :id param

  @Post('bills')
  createBill(@Request() req: any, @Body() dto: CreateBillDto) {
    return this.posService.createBill(req.user.businessId, req.user.userId, dto);
  }

  @Get('bills')
  getBills(@Request() req: any, @Query() query: BillQueryDto) {
    return this.posService.getBills(req.user.businessId, query);
  }

  @Get('bills/search')
  searchBills(
    @Request() req: any,
    @Query('billNumber') billNumber?: string,
    @Query('phone') phone?: string,
    @Query('customerName') customerName?: string,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.posService.searchBills(req.user.businessId, {
      billNumber, phone, customerName, date,
      limit:  limit  ? Number(limit)  : 20,
      offset: offset ? Number(offset) : 0,
    });
  }

  // ─── POS UTILITIES ────────────────────────────────────

  @Get('search')
  search(@Request() req: any, @Query('q') q: string) {
    return this.posService.searchProducts(req.user.businessId, q ?? '');
  }

  @Get('stock/:productId')
  getStock(@Request() req: any, @Param('productId') productId: string) {
    return this.posService.getStock(req.user.businessId, productId);
  }

  @Get('product/:barcode/plus')
  getProductPlus(@Request() req: any, @Param('barcode') barcode: string) {
    return this.posService.getProductPlus(barcode, req.user.businessId);
  }

  // ─── BILL DETAIL (param routes last) ──────────────────

  @Get('bills/:id/full')
  getFullBill(@Request() req: any, @Param('id') id: string) {
    return this.posService.getFullBillForPrint(id, req.user.businessId);
  }

  @Post('bills/:id/duplicate-print')
  logDuplicatePrint(@Request() req: any, @Param('id') id: string) {
    const user = req.user;
    return this.posService.logDuplicatePrint(id, user.businessId, user.userId, user.fullName ?? user.username, 'POS');
  }

  @Post('bills/:id/void')
  voidBill(@Request() req: any, @Param('id') id: string, @Body() dto: VoidBillDto) {
    const user = req.user;
    return this.posService.voidBill(
      user.businessId, user.userId, user.role,
      user.shiftId ?? null, id, dto.reason,
      user.fullName ?? user.username,
    );
  }

  @Get('bills/:id')
  getBillById(@Request() req: any, @Param('id') id: string) {
    return this.posService.getBillById(req.user.businessId, id);
  }

  // ─── CREDIT NOTES ─────────────────────────────────────

  @Post('credit-notes')
  createCreditNote(@Request() req: any, @Body() dto: CreateCreditNoteDto) {
    const user = req.user;
    return this.posService.createCreditNote(
      user.businessId, user.userId, user.fullName ?? user.username, dto,
    );
  }

  @Get('credit-notes')
  getCreditNotes(
    @Request() req: any,
    @Query('date') date?: string,
    @Query('originalBillId') originalBillId?: string,
    @Query('customerName') customerName?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posService.getCreditNotes(req.user.businessId, {
      date, originalBillId, customerName,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('credit-notes/:id')
  getCreditNoteById(@Request() req: any, @Param('id') id: string) {
    return this.posService.getCreditNoteById(req.user.businessId, id);
  }

  // ─── ESTIMATES ────────────────────────────────────────

  @Get('estimates')
  getEstimates(@Request() req: any, @Query('page') page: string, @Query('limit') limit: string) {
    return this.posService.getEstimates(req.user.businessId, Number(page) || 1, Number(limit) || 20);
  }

  @Post('estimates/:id/convert')
  convertEstimate(
    @Request() req: any,
    @Param('id') id: string,
    @Body('targetBillType') targetBillType: string,
  ) {
    return this.posService.convertEstimate(req.user.businessId, req.user.userId, id, targetBillType ?? 'TAX_INVOICE');
  }

  @Put('estimates/:id/cancel')
  cancelEstimate(@Request() req: any, @Param('id') id: string) {
    return this.posService.cancelEstimate(req.user.businessId, id);
  }

  // ─── HISTORICAL BILLS ─────────────────────────────────

  @Post('historical-bill')
  createHistoricalBill(@Request() req: any, @Body() dto: any) {
    const user = req.user;
    if (!['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user.role)) {
      throw new ForbiddenException();
    }
    return this.posService.createHistoricalBill(user.businessId, user.userId, dto);
  }

  @Post('historical-bills-bulk')
  createHistoricalBillsBulk(@Request() req: any, @Body() body: { bills: any[] }) {
    const user = req.user;
    if (!['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user.role)) {
      throw new ForbiddenException();
    }
    return this.posService.createHistoricalBillsBulk(user.businessId, user.userId, body.bills ?? []);
  }

  @Get('historical-bills')
  getHistoricalBills(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.posService.getHistoricalBills(req.user.businessId, {
      type,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Delete('historical-bills/:id')
  deleteHistoricalBill(@Request() req: any, @Param('id') id: string) {
    const user = req.user;
    if (!['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user.role)) {
      throw new ForbiddenException();
    }
    return this.posService.deleteHistoricalBill(user.businessId, id);
  }
}
