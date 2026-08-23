import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JournalService } from '../platform/ledger/journal.service';
import { ChartOfAccountsService } from '../platform/ledger/chart-of-accounts.service';
import { FiscalPeriodService } from '../platform/ledger/fiscal-period.service';
import { PrismaService } from '../prisma/prisma.service';

const LEDGER_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'];

/** Account type groupings for financial statements */
const ASSET_TYPES = ['ASSET', 'CURRENT_ASSET', 'FIXED_ASSET', 'BANK', 'CASH'];
const LIABILITY_TYPES = ['LIABILITY', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY'];
const EQUITY_TYPES = ['EQUITY', 'CAPITAL', 'RESERVE'];
const REVENUE_TYPES = ['REVENUE', 'INCOME', 'OTHER_INCOME'];
const EXPENSE_TYPES = ['EXPENSE', 'COGS', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'];

// Was JwtAuthGuard only — any authenticated user of any role could post or
// reverse arbitrary journal entries directly against the general ledger,
// bypassing every business-logic check the rest of the app goes through.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...LEDGER_ROLES)
@Controller('ledger')
export class LedgerApiController {
  constructor(
    private readonly journalSvc: JournalService,
    private readonly coaSvc: ChartOfAccountsService,
    private readonly fiscalSvc: FiscalPeriodService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('help')
  help() {
    return {
      module: 'ledger',
      endpoints: [
        'POST /api/ledger/journals — Post a balanced journal entry',
        'GET  /api/ledger/journals — List journals (?fiscalPeriodId= &reference= &limit=50)',
        'GET  /api/ledger/journals/:id — Get journal with lines',
        'POST /api/ledger/journals/:id/reverse — Reverse a posted journal',
        'GET  /api/ledger/trial-balance — Trial balance (?fiscalPeriodId=)',
        'GET  /api/ledger/profit-loss — P&L (?fiscalPeriodId=)',
        'GET  /api/ledger/balance-sheet — Balance Sheet (?asAt=YYYY-MM-DD)',
        'GET  /api/ledger/fiscal-periods — List fiscal periods',
        'POST /api/ledger/fiscal-periods — Create fiscal year (?year=2025)',
        'GET  /api/ledger/accounts — Chart of accounts (?groupCode=)',
      ],
    };
  }

  // ── Journals ──────────────────────────────────────────────────────────────

  @Post('journals')
  async postJournal(
    @Request() req: any,
    @Body()
    body: {
      fiscalPeriodId: string;
      reference?: string;
      narration: string;
      lines: Array<{
        accountCode: string;
        debit?: number;
        credit?: number;
        narration?: string;
      }>;
    },
  ) {
    const businessId: string = req.user.businessId;

    // A negative debit/credit can still satisfy the balance check (it's just
    // arithmetic) while producing an effect opposite to what the sign
    // implies — e.g. a "negative debit" to an asset account is really a
    // credit in disguise. Reject rather than let that through as a manual
    // journal.
    for (const l of body.lines) {
      if ((l.debit ?? 0) < 0 || (l.credit ?? 0) < 0) {
        throw new BadRequestException('debit and credit amounts must not be negative');
      }
    }

    // Resolve account codes → IDs
    const lines = await Promise.all(
      body.lines.map(async (l) => {
        const account = await this.coaSvc.findByCode(businessId, l.accountCode);
        if (!account)
          throw new NotFoundException(`Account code ${l.accountCode} not found`);
        return {
          accountId: account.id,
          debitAmount: l.debit ?? 0,
          creditAmount: l.credit ?? 0,
          narration: l.narration,
        };
      }),
    );

    return this.journalSvc.post({
      businessId,
      fiscalPeriodId: body.fiscalPeriodId,
      reference: body.reference,
      narration: body.narration,
      lines,
      createdByUserId: req.user.sub,
    });
  }

  @Get('journals')
  async listJournals(
    @Request() req: any,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
    @Query('reference') reference?: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.journal.findMany({
      where: {
        businessId: req.user.businessId,
        ...(fiscalPeriodId ? { fiscalPeriodId } : {}),
        ...(reference ? { reference: { contains: reference } } : {}),
      },
      include: { lines: { include: { account: true } } },
      orderBy: { postedAt: 'desc' },
      take: limit ? Math.min(Number(limit), 200) : 50,
    });
  }

  @Get('journals/:id')
  async getJournal(@Request() req: any, @Param('id') id: string) {
    const j = await this.prisma.journal.findFirst({
      where: { id, businessId: req.user.businessId },
      include: { lines: { include: { account: true } }, fiscalPeriod: true },
    });
    if (!j) throw new NotFoundException('Journal not found');
    return j;
  }

  @Post('journals/:id/reverse')
  async reverseJournal(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason: string },
  ) {
    return this.journalSvc.reverse(id, body.reason ?? 'Manual reversal', req.user.sub, req.user.businessId);
  }

  // ── Trial Balance ─────────────────────────────────────────────────────────

  @Get('trial-balance')
  async trialBalance(@Request() req: any, @Query('fiscalPeriodId') fiscalPeriodId?: string) {
    const businessId: string = req.user.businessId;
    let periodId = fiscalPeriodId;

    if (!periodId) {
      const open = await this.fiscalSvc.getOpen(businessId);
      periodId = open.id;
    }

    const rows = await this.coaSvc.trialBalance(businessId, periodId);
    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    return {
      fiscalPeriodId: periodId,
      rows,
      totals: { debit: round4(totalDebit), credit: round4(totalCredit) },
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  // ── P&L ──────────────────────────────────────────────────────────────────

  @Get('profit-loss')
  async profitLoss(@Request() req: any, @Query('fiscalPeriodId') fiscalPeriodId?: string) {
    const businessId: string = req.user.businessId;
    let periodId = fiscalPeriodId;

    if (!periodId) {
      const open = await this.fiscalSvc.getOpen(businessId);
      periodId = open.id;
    }

    const lines = await this.prisma.journalLine.findMany({
      where: { journal: { businessId, fiscalPeriodId: periodId, status: 'POSTED' } },
      include: { account: { include: { accountGroup: true } } },
    });

    let revenue = 0, expenses = 0;
    const revenueAccounts: Record<string, number> = {};
    const expenseAccounts: Record<string, number> = {};

    for (const line of lines) {
      const groupType = line.account.accountGroup?.type ?? '';
      const net = Number(line.creditAmount) - Number(line.debitAmount);

      if (REVENUE_TYPES.includes(groupType)) {
        revenue += net;
        revenueAccounts[line.account.name] = (revenueAccounts[line.account.name] ?? 0) + net;
      } else if (EXPENSE_TYPES.includes(groupType)) {
        expenses += -net;
        expenseAccounts[line.account.name] = (expenseAccounts[line.account.name] ?? 0) + (-net);
      }
    }

    const netProfit = round4(revenue - expenses);

    return {
      fiscalPeriodId: periodId,
      revenue: round4(revenue),
      expenses: round4(expenses),
      netProfit,
      revenueBreakdown: revenueAccounts,
      expenseBreakdown: expenseAccounts,
    };
  }

  // ── Balance Sheet ─────────────────────────────────────────────────────────

  @Get('balance-sheet')
  async balanceSheet(@Request() req: any, @Query('asAt') asAt?: string) {
    const businessId: string = req.user.businessId;
    const asAtDate = asAt ? new Date(asAt) : new Date();

    const lines = await this.prisma.journalLine.findMany({
      where: {
        journal: {
          businessId,
          status: 'POSTED',
          postedAt: { lte: asAtDate },
        },
      },
      include: { account: { include: { accountGroup: true } } },
    });

    let assets = 0, liabilities = 0, equity = 0;
    const assetAccounts: Record<string, number> = {};
    const liabilityAccounts: Record<string, number> = {};
    const equityAccounts: Record<string, number> = {};

    for (const line of lines) {
      const groupType = line.account.accountGroup?.type ?? '';
      const debitNet = Number(line.debitAmount) - Number(line.creditAmount);

      if (ASSET_TYPES.includes(groupType)) {
        assets += debitNet;
        assetAccounts[line.account.name] = (assetAccounts[line.account.name] ?? 0) + debitNet;
      } else if (LIABILITY_TYPES.includes(groupType)) {
        liabilities += -debitNet;
        liabilityAccounts[line.account.name] =
          (liabilityAccounts[line.account.name] ?? 0) + (-debitNet);
      } else if (EQUITY_TYPES.includes(groupType)) {
        equity += -debitNet;
        equityAccounts[line.account.name] = (equityAccounts[line.account.name] ?? 0) + (-debitNet);
      }
    }

    const totalLiabilitiesAndEquity = round4(liabilities + equity);
    const balances = Math.abs(round4(assets) - totalLiabilitiesAndEquity) < 1;

    return {
      asAt: asAtDate.toISOString(),
      assets: round4(assets),
      liabilities: round4(liabilities),
      equity: round4(equity),
      totalLiabilitiesAndEquity,
      balances,
      assetBreakdown: assetAccounts,
      liabilityBreakdown: liabilityAccounts,
      equityBreakdown: equityAccounts,
    };
  }

  // ── Fiscal Periods ────────────────────────────────────────────────────────

  @Get('fiscal-periods')
  listFiscalPeriods(@Request() req: any) {
    return this.prisma.fiscalPeriod.findMany({
      where: { businessId: req.user.businessId },
      orderBy: { startDate: 'desc' },
    });
  }

  @Post('fiscal-periods')
  createFiscalYear(@Request() req: any, @Body() body: { year: number }) {
    return this.fiscalSvc.createFiscalYear(req.user.businessId, body.year);
  }

  // ── Chart of Accounts ─────────────────────────────────────────────────────

  @Get('accounts')
  async listAccounts(@Request() req: any, @Query('groupCode') groupCode?: string) {
    return this.prisma.account.findMany({
      where: {
        businessId: req.user.businessId,
        ...(groupCode
          ? { accountGroup: { name: { contains: groupCode } } }
          : {}),
      },
      include: { accountGroup: true },
      orderBy: { code: 'asc' },
    });
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
