import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseInterceptors, UploadedFile, UseGuards, Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BankService } from './bank.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('bank')
export class BankController {
  constructor(private bank: BankService) {}

  // ─── BANK ACCOUNTS ───────────────────────────────────

  @Get('accounts')
  listAccounts(@Request() req: any) {
    return this.bank.listAccounts(req.user.businessId);
  }

  @Post('accounts')
  createAccount(@Request() req: any, @Body() dto: any) {
    return this.bank.createAccount(req.user.businessId, dto);
  }

  @Patch('accounts/:id')
  updateAccount(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.bank.updateAccount(id, req.user.businessId, dto);
  }

  // ─── STATEMENT IMPORT ────────────────────────────────

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importStatement(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('bankAccountId') bankAccountId: string,
  ) {
    if (!file) throw new Error('No file uploaded');
    return this.bank.importStatement(req.user.businessId, bankAccountId, file.buffer, file.originalname);
  }

  // ─── TRANSACTIONS ─────────────────────────────────────

  @Get('transactions')
  listTransactions(@Request() req: any, @Query() query: any) {
    return this.bank.listTransactions(req.user.businessId, query);
  }

  @Patch('transactions/:id')
  updateTransaction(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.bank.updateTransaction(id, req.user.businessId, dto);
  }

  // ─── AUTO RE-MATCH ────────────────────────────────────

  @Post('rematch/:bankAccountId')
  rematch(@Request() req: any, @Param('bankAccountId') bankAccountId: string) {
    return this.bank.autoMatchSupplierPayments(req.user.businessId, bankAccountId);
  }

  @Post('reconcile-cash/:bankAccountId')
  reconcileCash(@Request() req: any, @Param('bankAccountId') bankAccountId: string) {
    return this.bank.reconcileCashDeposits(req.user.businessId, bankAccountId);
  }

  // ─── SUPPLIER LEDGER ─────────────────────────────────

  @Get('supplier-ledger')
  supplierLedger(@Request() req: any, @Query('supplierId') supplierId?: string) {
    return this.bank.supplierLedger(req.user.businessId, supplierId);
  }

  // ─── MANUAL PAYMENT ──────────────────────────────────

  @Post('payments')
  recordPayment(@Request() req: any, @Body() dto: any) {
    return this.bank.recordPayment(req.user.businessId, dto);
  }

  // ─── MANUAL RECONCILE (match-group) ──────────────────

  @Get('open-payables')
  openPayables(@Request() req: any, @Query('supplierId') supplierId: string) {
    return this.bank.getOpenPayables(req.user.businessId, supplierId);
  }

  @Get('match-suggestions')
  matchSuggestions(@Request() req: any, @Query('supplierId') supplierId: string, @Query('amount') amount: string) {
    return this.bank.suggestBills(req.user.businessId, supplierId, Number(amount));
  }

  @Post('match-group')
  matchGroup(@Request() req: any, @Body() dto: any) {
    return this.bank.matchGroup(req.user.businessId, { ...dto, createdByName: req.user?.fullName ?? req.user?.name });
  }

  // ─── DASHBOARD SUMMARY ───────────────────────────────

  @Get('summary')
  summary(@Request() req: any) {
    return this.bank.bankSummary(req.user.businessId);
  }
}
