/**
 * JournalBridgeService
 *
 * Auto-posts double-entry journal entries when transactions occur in
 * the existing production modules (POS, GRN, Expenses).
 *
 * Safety contract:
 *  - NEVER called inside an existing $transaction — always called after commit.
 *  - All methods are fire-and-forget: callers wrap in try/catch and ignore failures.
 *  - If CoA or FiscalPeriod not seeded for a business, logs a warning and skips.
 *  - Zero risk to existing production flow.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ChartOfAccountsService } from '../ledger/chart-of-accounts.service';
import { JournalService } from '../ledger/journal.service';
import { FiscalPeriodService } from '../ledger/fiscal-period.service';

// ── Account code → journal role mapping ──────────────────────────────────────
// Matches the India CoA seeded by OnboardingService

const ACC = {
  CASH:             '1001',
  BANK:             '1010',
  RECEIVABLES:      '1100',
  STOCK:            '1200',
  ITC_CGST:         '1300',
  ITC_SGST:         '1301',
  ITC_IGST:         '1302',
  PAYABLES:         '2002',
  PAYABLES_MSME:    '2001',
  CGST_PAYABLE:     '2100',
  SGST_PAYABLE:     '2101',
  IGST_PAYABLE:     '2102',
  SALES:            '4001',
  // Expense accounts by category
  EXPENSE_RENT:     '6100',
  EXPENSE_ELEC:     '6101',
  EXPENSE_PHONE:    '6102',
  EXPENSE_OFFICE:   '6103',
  EXPENSE_PACK:     '6104',
  EXPENSE_REPAIRS:  '6105',
  EXPENSE_MKTG:     '6107',
  EXPENSE_FREIGHT:  '6108',
  EXPENSE_BANK:     '6109',
  EXPENSE_PROF:     '6110',
  EXPENSE_MISC:     '6114',
  EXPENSE_SALARY:   '6001',
  EXPENSE_WAGES:    '6001',
};

const EXPENSE_CATEGORY_MAP: Record<string, string> = {
  'rent':                    ACC.EXPENSE_RENT,
  'electricity':             ACC.EXPENSE_ELEC,
  'water':                   ACC.EXPENSE_ELEC,
  'telephone':               ACC.EXPENSE_PHONE,
  'internet':                ACC.EXPENSE_PHONE,
  'office supplies':         ACC.EXPENSE_OFFICE,
  'stationery':              ACC.EXPENSE_OFFICE,
  'packaging material':      ACC.EXPENSE_PACK,
  'repairs & maintenance':   ACC.EXPENSE_REPAIRS,
  'repairs':                 ACC.EXPENSE_REPAIRS,
  'transport':               ACC.EXPENSE_FREIGHT,
  'marketing':               ACC.EXPENSE_MKTG,
  'advertisement':           ACC.EXPENSE_MKTG,
  'bank charges':            ACC.EXPENSE_BANK,
  'professional fees':       ACC.EXPENSE_PROF,
  'salary':                  ACC.EXPENSE_SALARY,
  'wages':                   ACC.EXPENSE_WAGES,
  'miscellaneous':           ACC.EXPENSE_MISC,
};

export interface PosBillSummary {
  id: string;
  businessId: string;
  billNumber: string;
  grandTotal: number | string;
  taxableAmount: number | string;
  cgstTotal: number | string;
  sgstTotal: number | string;
  igstTotal: number | string;
  paymentMode: string;   // CASH | UPI | CARD | SPLIT | CREDIT
  saleType: string;      // CASH | CREDIT
  paidAmount: number | string;
  balanceAmount: number | string;
  cashAmount?: number | string | null;
  upiAmount?: number | string | null;
  cardAmount?: number | string | null;
}

export interface GrnSummary {
  id: string;
  businessId: string;
  grnNumber?: string | null;
  grandTotal: number | string;
  taxableAmount: number | string;
  cgstTotal: number | string;
  sgstTotal: number | string;
  igstTotal: number | string;
  isMsmeSupplier?: boolean;
}

export interface ExpenseSummary {
  id: string;
  businessId: string;
  amount: number | string;
  category?: string | null;
  paymentMode?: string | null;
}

@Injectable()
export class JournalBridgeService {
  private readonly logger = new Logger(JournalBridgeService.name);

  constructor(
    private readonly coa: ChartOfAccountsService,
    private readonly journals: JournalService,
    private readonly fiscalPeriods: FiscalPeriodService,
  ) {}

  // ── POS Sale ───────────────────────────────────────────────────────────────

  async postSaleJournal(bill: PosBillSummary): Promise<void> {
    const { businessId } = bill;

    const fiscalPeriodId = await this.getOpenPeriodId(businessId);
    if (!fiscalPeriodId) return;

    const grand    = n(bill.grandTotal);
    const taxable  = n(bill.taxableAmount);
    const cgst     = n(bill.cgstTotal);
    const sgst     = n(bill.sgstTotal);
    const igst     = n(bill.igstTotal);
    const paid     = n(bill.paidAmount);
    const balance  = n(bill.balanceAmount);
    const cash     = n(bill.cashAmount ?? 0);
    const upi      = n(bill.upiAmount ?? 0);
    const card     = n(bill.cardAmount ?? 0);

    if (grand <= 0) return;

    const lines: Array<{ code: string; debit: number; credit: number; narration?: string }> = [];

    // Debit side — where money comes from
    if (bill.paymentMode === 'SPLIT') {
      if (cash > 0)      lines.push({ code: ACC.CASH, debit: cash,  credit: 0, narration: 'Cash received' });
      if (upi + card > 0) lines.push({ code: ACC.BANK, debit: upi + card, credit: 0, narration: 'UPI/Card received' });
    } else if (bill.paymentMode === 'CASH') {
      lines.push({ code: ACC.CASH, debit: paid, credit: 0, narration: 'Cash received' });
    } else {
      // UPI, CARD, ONLINE → Bank
      lines.push({ code: ACC.BANK, debit: paid, credit: 0, narration: `${bill.paymentMode} received` });
    }

    // Credit balance → Trade Receivables
    if (balance > 0.009) {
      lines.push({ code: ACC.RECEIVABLES, debit: balance, credit: 0, narration: 'Credit sale balance' });
    }

    // Credit side — revenue + tax
    lines.push({ code: ACC.SALES, debit: 0, credit: taxable, narration: 'Sales revenue' });
    if (cgst > 0.009) lines.push({ code: ACC.CGST_PAYABLE, debit: 0, credit: cgst, narration: 'CGST collected' });
    if (sgst > 0.009) lines.push({ code: ACC.SGST_PAYABLE, debit: 0, credit: sgst, narration: 'SGST collected' });
    if (igst > 0.009) lines.push({ code: ACC.IGST_PAYABLE, debit: 0, credit: igst, narration: 'IGST collected' });

    // Rounding difference adjustment to Sales
    const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    const diff = round4(totalDebit - totalCredit);
    if (Math.abs(diff) > 0.009) {
      lines.push({ code: ACC.SALES, debit: diff > 0 ? 0 : Math.abs(diff), credit: diff > 0 ? diff : 0, narration: 'Rounding' });
    }

    await this.postLines(businessId, fiscalPeriodId, `POS-${bill.billNumber}`, `POS Sale ${bill.billNumber}`, lines);
  }

  // ── GRN / Purchase ─────────────────────────────────────────────────────────

  async postGrnJournal(grn: GrnSummary): Promise<void> {
    const { businessId } = grn;

    const fiscalPeriodId = await this.getOpenPeriodId(businessId);
    if (!fiscalPeriodId) return;

    const grand   = n(grn.grandTotal);
    const taxable = n(grn.taxableAmount);
    const cgst    = n(grn.cgstTotal);
    const sgst    = n(grn.sgstTotal);
    const igst    = n(grn.igstTotal);

    if (grand <= 0) return;

    const payablesCode = grn.isMsmeSupplier ? ACC.PAYABLES_MSME : ACC.PAYABLES;

    const lines = [
      { code: ACC.STOCK,    debit: taxable, credit: 0,     narration: 'Stock received' },
      { code: ACC.ITC_CGST, debit: cgst,    credit: 0,     narration: 'CGST input credit' },
      { code: ACC.ITC_SGST, debit: sgst,    credit: 0,     narration: 'SGST input credit' },
      { code: ACC.ITC_IGST, debit: igst,    credit: 0,     narration: 'IGST input credit' },
      { code: payablesCode, debit: 0,        credit: grand, narration: 'Payable to supplier' },
    ].filter((l) => l.debit > 0.009 || l.credit > 0.009);

    const ref = grn.grnNumber ?? grn.id;
    await this.postLines(businessId, fiscalPeriodId, `GRN-${ref}`, `Purchase GRN ${ref}`, lines);
  }

  // ── Expense ────────────────────────────────────────────────────────────────

  async postExpenseJournal(expense: ExpenseSummary): Promise<void> {
    const { businessId } = expense;

    const fiscalPeriodId = await this.getOpenPeriodId(businessId);
    if (!fiscalPeriodId) return;

    const amount = n(expense.amount);
    if (amount <= 0) return;

    const expenseCode = this.resolveExpenseAccount(expense.category);
    const creditCode  = (expense.paymentMode ?? 'CASH').toUpperCase() === 'CASH'
      ? ACC.CASH
      : ACC.BANK;

    const lines = [
      { code: expenseCode, debit: amount, credit: 0,      narration: expense.category ?? 'Expense' },
      { code: creditCode,  debit: 0,      credit: amount, narration: `Paid via ${expense.paymentMode ?? 'CASH'}` },
    ];

    await this.postLines(businessId, fiscalPeriodId, `EXP-${expense.id}`, `Expense: ${expense.category ?? 'Misc'}`, lines);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getOpenPeriodId(businessId: string): Promise<string | null> {
    try {
      const period = await this.fiscalPeriods.getOpen(businessId);
      return period.id;
    } catch {
      this.logger.warn(`No open fiscal period for ${businessId} — journal not posted. Run onboarding or create a fiscal period.`);
      return null;
    }
  }

  private resolveExpenseAccount(category?: string | null): string {
    if (!category) return ACC.EXPENSE_MISC;
    const key = category.toLowerCase().trim();
    return EXPENSE_CATEGORY_MAP[key] ?? ACC.EXPENSE_MISC;
  }

  private async postLines(
    businessId: string,
    fiscalPeriodId: string,
    reference: string,
    narration: string,
    lines: Array<{ code: string; debit: number; credit: number; narration?: string }>,
  ): Promise<void> {
    // Resolve account codes → IDs
    const resolvedLines: Array<{ accountId: string; debitAmount: number; creditAmount: number; narration?: string }> = [];

    for (const line of lines) {
      if (line.debit < 0.009 && line.credit < 0.009) continue;
      const account = await this.coa.findByCode(businessId, line.code);
      if (!account) {
        this.logger.warn(`Account ${line.code} not found for business ${businessId} — skipping journal line`);
        continue;
      }
      resolvedLines.push({
        accountId:    account.id,
        debitAmount:  round4(line.debit),
        creditAmount: round4(line.credit),
        narration:    line.narration,
      });
    }

    if (resolvedLines.length < 2) {
      this.logger.warn(`Not enough account lines resolved for journal ${reference} — skipping`);
      return;
    }

    try {
      await this.journals.post({
        businessId,
        fiscalPeriodId,
        reference,
        narration,
        lines: resolvedLines,
      });
      this.logger.debug(`Journal posted: ${reference}`);
    } catch (err: any) {
      this.logger.error(`Journal post failed for ${reference}: ${err?.message}`);
    }
  }
}

function n(v: number | string | null | undefined): number {
  return Math.round(Number(v ?? 0) * 10000) / 10000;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
