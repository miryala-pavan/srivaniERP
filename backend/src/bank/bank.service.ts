import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseSbiStatement, ParsedStatement } from './sbi-statement.parser';
import { parseIdbIStatementFromRows } from './idbi-statement.parser';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

/**
 * Extract a bank UTR / transaction reference from a statement narration.
 *
 * Indian payment references follow fixed formats (bank-agnostic):
 *   • NEFT UTR  = 16 chars: 4-letter IFSC bank code + 12 alphanumerics
 *                 (SBI verified: "SBIN326162622837")
 *   • RTGS UTR  = 22 chars: 4-letter bank code + 18 alphanumerics
 *   • IMPS/UPI RRN = 12 digits
 * The most reliable signal is an explicit "UTR NO:" / "RRN:" label, so that is
 * tried first; length-based patterns are the fallback. Any miss can be fixed
 * manually in the payment-details drawer.
 */
export function extractUtr(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.toUpperCase();

  // 1. Labelled — most reliable, works for every bank that prints a UTR label
  const labelled = t.match(/\b(?:UTR|RRN|UTR\s*NO|REF(?:ERENCE)?)\s*(?:NO|NUMBER)?\s*[:.#\-]?\s*([A-Z0-9]{12,22})\b/);
  if (labelled) return labelled[1];

  // 2. RTGS UTR — 22 chars, bank-code prefixed
  const rtgs = t.match(/\b[A-Z]{4}[A-Z0-9]{18}\b/);
  if (rtgs) return rtgs[0];

  // 3. NEFT UTR — 16 chars, bank-code prefixed (e.g. SBIN326162622837, HDFCxxxxxxxxxxxx)
  const neft = t.match(/\b[A-Z]{4}[A-Z0-9]{12}\b/);
  if (neft) return neft[0];

  // 4. IMPS / UPI RRN — bare 12-digit reference
  const rrn = t.match(/\b\d{12}\b/);
  if (rrn) return rrn[0];

  return null;
}

@Injectable()
export class BankService {
  constructor(private prisma: PrismaService) {}

  // ─── BANK ACCOUNTS ───────────────────────────────────

  async listAccounts(businessId: string) {
    return this.prisma.bankAccount.findMany({
      where:   { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAccount(businessId: string, dto: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    accountType?: string;
    ifscCode?: string;
    branchName?: string;
    openingBalance?: number;
  }) {
    return this.prisma.bankAccount.create({
      data: {
        businessId,
        accountName:    dto.accountName,
        bankName:       dto.bankName,
        accountNumber:  dto.accountNumber,
        accountType:    dto.accountType ?? 'CURRENT',
        ifscCode:       dto.ifscCode,
        branchName:     dto.branchName,
        openingBalance: dto.openingBalance ?? 0,
        currentBalance: dto.openingBalance ?? 0,
      },
    });
  }

  async updateAccount(id: string, businessId: string, dto: Partial<{
    accountName: string;
    bankName: string;
    ifscCode: string;
    branchName: string;
    isActive: boolean;
  }>) {
    return this.prisma.bankAccount.update({
      where: { id },
      data: dto,
    });
  }

  // ─── STATEMENT IMPORT ────────────────────────────────

  /** Auto-detect bank format and parse statement from raw file buffer */
  private async parseAnyStatement(fileBuffer: Buffer, fileName: string): Promise<ParsedStatement> {
    const lowerName = fileName.toLowerCase();

    // PDF files → IDBI (or other PDF-based banks)
    if (lowerName.endsWith('.pdf') || fileBuffer[0] === 0x25 /* '%' = PDF magic */) {
      const data = await pdfParse(fileBuffer);
      const text = data.text as string;

      // Detect IDBI
      if (text.includes('IDBI') || text.includes('IBKL')) {
        // Extract rows from text using line-based parsing
        const rows = this.extractIdbIRows(text);
        // Extract meta from text
        const acNoMatch  = text.match(/Account No\s*:\s*(\d+)/);
        const fromMatch  = text.match(/Transaction Date From\s+([\d-A-Za-z]+)\s+to\s+([\d-A-Za-z]+)/);
        const acName     = text.match(/Account Holder Name\s*:\s*([A-Z ]+)/)?.[1]?.trim() ?? '';
        return parseIdbIStatementFromRows(rows, {
          accountName:   acName,
          accountNumber: acNoMatch?.[1] ?? '',
          fromDate:      fromMatch?.[1] ?? '',
          toDate:        fromMatch?.[2] ?? '',
        });
      }

      throw new BadRequestException('Unrecognised PDF bank statement format');
    }

    // Text/XLS files → SBI (tab-separated text)
    const content = fileBuffer.toString('utf-8');
    if (content.includes('SBI') || content.includes('SBIN') || content.startsWith('Account Name')) {
      return parseSbiStatement(content);
    }
    // Try SBI anyway (generic text format)
    if (!lowerName.endsWith('.pdf')) {
      return parseSbiStatement(content);
    }

    throw new BadRequestException('Unrecognised bank statement format. Supported: SBI (.xls) and IDBI (.pdf)');
  }

  /**
   * Extract table rows from IDBI PDF text.
   * Each transaction row starts with a number, followed by date/time.
   */
  private extractIdbIRows(text: string): (string | null)[][] {
    const lines   = text.split('\n');
    const rows: (string | null)[][] = [];
    const txnRe   = /^(\d+)\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)/;
    const amtRe   = /^([\d,]+\.\d{2})$/;

    let current: (string | null)[] | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const m = line.match(txnRe);
      if (m) {
        if (current) rows.push(current);

        // Remaining part after value-date contains: description [cheque] [debit] [credit] [balance]
        const rest     = m[4].trim();
        const amounts  = this.extractAmountsFromEnd(rest);
        const desc     = rest.replace(/[\d,]+\.\d{2}/g, '').trim();

        current = [
          m[1],           // S.No
          m[2],           // Txn Date+time
          m[3],           // Value Date
          desc,           // Description
          null,           // Cheque No
          amounts.debit,  // Debit
          amounts.credit, // Credit
          amounts.balance,// Balance
        ];
        continue;
      }

      // Continuation line for description
      if (current && !amtRe.test(line) && !/^Page \d+ of \d+/.test(line) && !/^IDBI Bank/.test(line)) {
        if (current[3] !== null) {
          current[3] = (current[3] + ' ' + line).trim();
        }
      }
    }
    if (current) rows.push(current);
    return rows;
  }

  /**
   * From a string like "NEFT... 580.00 10932.58" extract debit/credit/balance.
   * IDBI columns: the last amount is always balance, second-to-last is debit or credit.
   * We disambiguate by comparing to the previous balance (not easily available here),
   * so we rely on x-position info. As a fallback: we store both amounts and let the
   * categorizer figure it out from the description direction.
   *
   * Actually: from the PDF word analysis, debit col x≈392, credit col x≈453.
   * Since we can't rely on column position in plain text, we parse the amounts
   * and use the running balance direction to assign debit/credit.
   */
  private extractAmountsFromEnd(s: string): { debit: string | null; credit: string | null; balance: string | null } {
    const matches = [...s.matchAll(/([\d,]+\.\d{2})/g)];
    if (matches.length === 0) return { debit: null, credit: null, balance: null };
    if (matches.length === 1) return { debit: null, credit: null, balance: matches[0][1] };

    const balance = matches[matches.length - 1][1];
    const amount  = matches[matches.length - 2][1];

    // We can't determine debit vs credit without previous balance here.
    // Store in a special way: put amount in a temp field and resolve later.
    // Convention: put in debit, credit stays null — fixup happens post-parse with balance diff.
    return { debit: amount, credit: null, balance };
  }

  /** Use running balance differences to assign debit vs credit when both were unknown */
  private fixDebitCreditFromBalance(parsed: ParsedStatement) {
    for (let i = 1; i < parsed.transactions.length; i++) {
      const prev = parsed.transactions[i - 1];
      const curr = parsed.transactions[i];
      if (curr.balance == null || prev.balance == null) continue;
      // If we already have one of debit/credit, skip
      if (curr.creditAmount != null || (curr.debitAmount == null)) continue;

      const diff = curr.balance - prev.balance;
      const amt  = curr.debitAmount; // stored in debit as temp
      if (amt == null) continue;

      if (diff > 0) {
        // Balance went up → credit
        curr.creditAmount = amt;
        curr.debitAmount  = null;
      }
      // else: debit stays as-is
    }
  }

  async importStatement(businessId: string, bankAccountId: string, fileBuffer: Buffer, fileName: string) {
    // Verify bank account belongs to business
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, businessId },
    });
    if (!account) throw new NotFoundException('Bank account not found');

    const parsed = await this.parseAnyStatement(fileBuffer, fileName);

    // Fix debit/credit assignment using running balance for PDF statements
    this.fixDebitCreditFromBalance(parsed);

    // Check for duplicate import (same period)
    const existing = await this.prisma.bankStatementImport.findFirst({
      where: {
        bankAccountId,
        fromDate: parsed.fromDate,
        toDate:   parsed.toDate,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Statement for ${parsed.fromDate.toDateString()} – ${parsed.toDate.toDateString()} already imported`
      );
    }

    const totalCredits = parsed.transactions.reduce((s, t) => s + (t.creditAmount ?? 0), 0);
    const totalDebits  = parsed.transactions.reduce((s, t) => s + (t.debitAmount  ?? 0), 0);
    const lastBalance  = parsed.transactions.at(-1)?.balance ?? parsed.openingBalance;

    // Load all suppliers with bank details for auto-matching
    const suppliers = await this.prisma.supplier.findMany({
      where:  { businessId, isActive: true },
      select: { id: true, name: true, bankAccountNumber: true, bankIfscCode: true },
    });

    // Build import batch + transactions in one transaction
    const importBatch = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.bankStatementImport.create({
        data: {
          businessId,
          bankAccountId,
          fileName,
          fromDate:       parsed.fromDate,
          toDate:         parsed.toDate,
          openingBalance: parsed.openingBalance,
          closingBalance: lastBalance,
          totalCredits,
          totalDebits,
          txnCount: parsed.transactions.length,
        },
      });

      // Create transactions with auto-match
      for (const t of parsed.transactions) {
        let supplierId: string | null = null;

        // Try to match supplier for SUPPLIER_PAYMENT debits
        if (t.txnType === 'SUPPLIER_PAYMENT' && t.debitAmount) {
          supplierId = this.matchSupplier(t.description + ' ' + (t.refNumber ?? ''), suppliers);
        }

        await tx.bankTransaction.create({
          data: {
            businessId,
            bankAccountId,
            importId:     batch.id,
            txnDate:      t.txnDate,
            valueDate:    t.valueDate,
            description:  t.description,
            refNumber:    t.refNumber,
            branchCode:   t.branchCode,
            debitAmount:  t.debitAmount,
            creditAmount: t.creditAmount,
            balance:      t.balance,
            txnType:      t.txnType,
            supplierId,
            matchStatus:  'UNMATCHED',
          },
        });
      }

      // Update account's current balance
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data:  { currentBalance: lastBalance },
      });

      return batch;
    });

    // After import, run auto-match for supplier payments
    await this.autoMatchSupplierPayments(businessId, bankAccountId);

    return {
      importId:     importBatch.id,
      period:       `${parsed.fromDate.toDateString()} – ${parsed.toDate.toDateString()}`,
      txnCount:     parsed.transactions.length,
      totalCredits,
      totalDebits,
      closingBalance: lastBalance,
    };
  }

  /**
   * Match a supplier from bank transaction text.
   * Priority:
   *   1. Exact bank account number in description/ref  → highest confidence
   *   2. IFSC code in description/ref                  → high confidence
   *   3. Fuzzy name token match (≥60% tokens)          → fallback
   */
  private matchSupplier(
    text: string,
    suppliers: { id: string; name: string; bankAccountNumber?: string | null; bankIfscCode?: string | null }[],
  ): string | null {
    const t = text.toUpperCase().replace(/\s+/g, ' ');

    // ── 1. Account number exact match ─────────────────────
    for (const s of suppliers) {
      if (s.bankAccountNumber && s.bankAccountNumber.trim().length >= 6) {
        if (t.includes(s.bankAccountNumber.trim().toUpperCase())) {
          return s.id;
        }
      }
    }

    // ── 2. IFSC code match ────────────────────────────────
    for (const s of suppliers) {
      if (s.bankIfscCode && s.bankIfscCode.trim().length === 11) {
        if (t.includes(s.bankIfscCode.trim().toUpperCase())) {
          return s.id;
        }
      }
    }

    // ── 3. Fuzzy name token match (fallback) ─────────────
    let best: { id: string; score: number } | null = null;

    for (const s of suppliers) {
      const sName = s.name.toUpperCase()
        .replace(/\bPVT\b|\bLTD\b|\bPRIVATE\b|\bLIMITED\b|\bENTERPRISES?\b|\bTRADERS?\b|\bAGENCIES\b|\bAGENCY\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (sName.length < 3) continue;

      const tokens  = sName.split(' ').filter(w => w.length >= 3);
      const matched = tokens.filter(tok => t.includes(tok));
      const score   = tokens.length > 0 ? matched.length / tokens.length : 0;

      if (score >= 0.6 && (!best || score > best.score)) {
        best = { id: s.id, score };
      }
    }

    return best?.id ?? null;
  }

  /** Auto-match unmatched SUPPLIER_PAYMENT transactions against open GRN payables */
  async autoMatchSupplierPayments(businessId: string, bankAccountId: string) {
    // Load suppliers with bank details for re-identification pass
    const allSuppliers = await this.prisma.supplier.findMany({
      where:  { businessId, isActive: true },
      select: { id: true, name: true, bankAccountNumber: true, bankIfscCode: true },
    });

    // First pass: try to identify supplier for transactions that have supplierId=null
    const unidentified = await this.prisma.bankTransaction.findMany({
      where: {
        businessId,
        bankAccountId,
        txnType:     'SUPPLIER_PAYMENT',
        matchStatus: 'UNMATCHED',
        supplierId:  null,
        debitAmount: { not: null },
      },
    });

    for (const txn of unidentified) {
      const sid = this.matchSupplier(
        txn.description + ' ' + (txn.refNumber ?? ''),
        allSuppliers,
      );
      if (sid) {
        await this.prisma.bankTransaction.update({
          where: { id: txn.id },
          data:  { supplierId: sid },
        });
      }
    }

    // Second pass: match transactions that now have a supplierId
    const unmatched = await this.prisma.bankTransaction.findMany({
      where: {
        businessId,
        bankAccountId,
        txnType:    'SUPPLIER_PAYMENT',
        matchStatus: 'UNMATCHED',
        supplierId:  { not: null },
        debitAmount: { not: null },
      },
    });

    for (const txn of unmatched) {
      if (!txn.supplierId || !txn.debitAmount) continue;

      // Find unpaid/partially-paid approved GRNs for this supplier
      const openGrns = await this.prisma.purchase.findMany({
        where: {
          businessId,
          supplierId: txn.supplierId,
          status:     'APPROVED',
          balanceAmount: { gt: 0 },
        },
        orderBy: { invoiceDate: 'asc' },
      });

      if (openGrns.length === 0) continue;

      // Tolerance: ±₹5 to handle minor rounding differences in real payments
      const TOLERANCE = 5;

      // ── Single GRN match ──────────────────────────────
      const exactMatch = openGrns.find(
        g => Math.abs(Number(g.balanceAmount) - Number(txn.debitAmount)) <= TOLERANCE
      );
      if (exactMatch) {
        // Allocate the actual transaction amount (within tolerance) to close the GRN
        await this.applyPaymentMatch(businessId, bankAccountId, txn, [exactMatch], [Number(txn.debitAmount)]);
        continue;
      }

      // ── Multi-GRN subset-sum match ─────────────────────
      // Cap at 20 GRNs (2^20 = ~1M ops, fast enough; real cases rarely exceed 10)
      const grnsForSubset = openGrns.slice(0, 20);
      const comboIdx = this.findSubsetSum(
        grnsForSubset.map(g => Number(g.balanceAmount)),
        Number(txn.debitAmount),
        TOLERANCE,
      );
      if (comboIdx && comboIdx.length > 0) {
        const combo   = comboIdx.map(i => grnsForSubset[i]);
        // Distribute the actual payment amount proportionally across matched GRNs
        // to handle the ±₹5 difference cleanly
        const totalGrnBalance = combo.reduce((s, g) => s + Number(g.balanceAmount), 0);
        const txnAmt          = Number(txn.debitAmount);
        const diff            = txnAmt - totalGrnBalance; // small ±₹5 difference
        const amounts         = combo.map((g, idx) => {
          // Apply the rounding difference to the first GRN
          const base = Number(g.balanceAmount);
          return idx === 0 ? base + diff : base;
        });
        await this.applyPaymentMatch(businessId, bankAccountId, txn, combo, amounts);
      }
    }
  }

  /**
   * Subset-sum: given an array of amounts, find indices of a subset that sums to `target` (±tolerance).
   * Returns the chosen indices, or null if none found.
   * Input array is sorted descending internally for faster pruning.
   */
  private findSubsetSum(amounts: number[], target: number, tolerance: number): number[] | null {
    // Build index-paired sorted array
    const indexed = amounts.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const chosen: number[] = [];  // stores original indices

    const search = (pos: number, remaining: number): boolean => {
      if (Math.abs(remaining) <= tolerance) return true;
      if (pos >= indexed.length || remaining < -tolerance) return false;

      // Include current
      chosen.push(indexed[pos].i);
      if (search(pos + 1, remaining - indexed[pos].v)) return true;
      chosen.pop();

      // Skip current
      return search(pos + 1, remaining);
    };

    return search(0, target) ? chosen : null;
  }

  /** Open (unpaid/partly-paid) approved bills for a supplier — for the manual reconcile picker. */
  async getOpenPayables(businessId: string, supplierId: string) {
    const grns = await this.prisma.purchase.findMany({
      where: { businessId, supplierId, status: 'APPROVED' },
      orderBy: { invoiceDate: 'asc' },
      select: {
        id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true,
        grandTotal: true, paidAmount: true, balanceAmount: true, amountPayable: true,
      },
    });
    return grns
      .map((g) => ({
        ...g,
        grandTotal:  Number(g.grandTotal),
        paidAmount:  Number(g.paidAmount ?? 0),
        balance:     Number(g.balanceAmount ?? (Number(g.amountPayable ?? g.grandTotal) - Number(g.paidAmount ?? 0))),
      }))
      .filter((g) => g.balance > 0.01);
  }

  /**
   * Smart suggestion: given a target amount (the bank payment total) and a supplier,
   * propose which open bills add up to it (exact first, then within tolerance).
   */
  async suggestBills(businessId: string, supplierId: string, targetAmount: number) {
    const open = await this.getOpenPayables(businessId, supplierId);
    if (open.length === 0) return { suggestion: null, openCount: 0 };

    const amounts = open.map((b) => b.balance);

    // Try a few tolerances, tightest first, so an exact match wins
    for (const tol of [0.01, 1, 5, 20, 50]) {
      const idx = this.findSubsetSum(amounts, targetAmount, tol);
      if (idx && idx.length > 0) {
        const chosen = idx.map((i) => open[i]);
        const billsTotal = Math.round(chosen.reduce((s, b) => s + b.balance, 0) * 100) / 100;
        const difference = Math.round((targetAmount - billsTotal) * 100) / 100;
        return {
          suggestion: {
            grnIds: chosen.map((b) => b.id),
            bills: chosen,
            billsTotal,
            difference,
            suggestedReason: Math.abs(difference) <= 0.01 ? null
              : difference > 0 ? 'BANK_CHARGE' : 'TDS',
            exact: Math.abs(difference) <= 0.01,
          },
          openCount: open.length,
        };
      }
    }
    return { suggestion: null, openCount: open.length };
  }

  /**
   * Manual reconciliation: settle a group of selected bank debits against a group of
   * selected bills, posting the difference to a reason code (bank charge / TDS / discount …).
   * Invariant:  Σ bank debits  =  Σ bill balances cleared  +  adjustment.
   */
  async matchGroup(businessId: string, dto: {
    bankTransactionIds: string[];
    grnIds: string[];
    adjustmentReason?: string | null;
    notes?: string | null;
    createdByName?: string;
  }) {
    if (!dto.bankTransactionIds?.length) throw new BadRequestException('Select at least one bank transaction');
    if (!dto.grnIds?.length) throw new BadRequestException('Select at least one bill');

    const txns = await this.prisma.bankTransaction.findMany({
      where: { id: { in: dto.bankTransactionIds }, businessId },
    });
    if (txns.length !== dto.bankTransactionIds.length) throw new BadRequestException('Some bank transactions not found');
    for (const t of txns) {
      if (t.matchStatus === 'MATCHED') throw new BadRequestException('A selected transaction is already matched');
      if (!t.debitAmount || Number(t.debitAmount) <= 0) throw new BadRequestException('Only debit (payment) transactions can be matched');
    }

    const grns = await this.prisma.purchase.findMany({
      where: { id: { in: dto.grnIds }, businessId, status: 'APPROVED' },
      select: { id: true, supplierId: true, grnNumber: true, grandTotal: true, paidAmount: true, balanceAmount: true, amountPayable: true },
    });
    if (grns.length !== dto.grnIds.length) throw new BadRequestException('Some bills not found or not approved');

    // All bills must belong to one supplier
    const supplierIds = [...new Set(grns.map((g) => g.supplierId))];
    if (supplierIds.length > 1) throw new BadRequestException('All selected bills must belong to the same supplier');
    const supplierId = supplierIds[0];

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const bankTotal  = r2(txns.reduce((s, t) => s + Number(t.debitAmount ?? 0), 0));
    const billBalances = grns.map((g) => ({
      id: g.id,
      balance: r2(Number(g.balanceAmount ?? (Number(g.amountPayable ?? g.grandTotal) - Number(g.paidAmount ?? 0)))),
      paidAmount: Number(g.paidAmount ?? 0),
      amountPayable: Number(g.amountPayable ?? g.grandTotal),
    }));
    const billsTotal = r2(billBalances.reduce((s, b) => s + b.balance, 0));
    const adjustment = r2(bankTotal - billsTotal);

    // A non-zero gap must be explained
    if (Math.abs(adjustment) > 0.01 && !dto.adjustmentReason) {
      throw new BadRequestException(
        `Bank total ₹${bankTotal} differs from bills total ₹${billsTotal} by ₹${adjustment}. Choose a reason for the difference.`,
      );
    }

    const utr = extractUtr(txns[0].description) ?? extractUtr(txns[0].refNumber);

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierPayment.create({
        data: {
          businessId,
          supplierId,
          purchaseId:           grns[0].id,
          paymentDate:          txns[0].txnDate,
          amount:               bankTotal,
          paymentMode:          'NEFT',
          referenceNumber:      txns[0].refNumber,
          utrNumber:            utr,
          bankAccountId:        txns[0].bankAccountId,
          bankTransactionId:    txns[0].id,
          matchedFromStatement: true,
          adjustmentAmount:     adjustment,
          adjustmentReason:     Math.abs(adjustment) > 0.01 ? (dto.adjustmentReason ?? null) : null,
          notes:                dto.notes ?? `Manually reconciled: ${txns.length} payment(s) → ${grns.length} bill(s)`,
          createdByName:        dto.createdByName ?? 'Reconciled',
        },
      });

      // Allocate each bill's full balance (invoices cleared fully; gap is the adjustment)
      for (const b of billBalances) {
        await tx.paymentAllocation.create({
          data: { paymentId: created.id, purchaseId: b.id, allocatedAmount: b.balance },
        });
        await tx.purchase.update({
          where: { id: b.id },
          data: { paidAmount: r2(b.paidAmount + b.balance), balanceAmount: 0 },
        });
      }

      // Link every selected bank txn to this payment
      await tx.bankTransaction.updateMany({
        where: { id: { in: dto.bankTransactionIds } },
        data: { matchStatus: 'MATCHED', supplierPaymentId: created.id, supplierId, matchedBySystem: false },
      });

      return created;
    });

    return {
      paymentId: payment.id,
      bankTotal, billsTotal, adjustment,
      billsSettled: grns.length, txnsMatched: txns.length,
    };
  }

  /**
   * Create a SupplierPayment + allocations for one or more GRNs, then mark the bank transaction matched.
   */
  private async applyPaymentMatch(
    businessId: string,
    bankAccountId: string,
    txn: { id: string; supplierId: string | null; debitAmount: any; txnDate: Date; refNumber: string | null; description: string },
    grns: Array<{ id: string; paidAmount: any; amountPayable: any }>,
    amounts: number[],
  ) {
    const totalAmount = amounts.reduce((s, a) => s + a, 0);

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          businessId,
          supplierId:           txn.supplierId!,
          purchaseId:           grns[0].id,   // primary GRN
          paymentDate:          txn.txnDate,
          amount:               totalAmount,
          paymentMode:          'NEFT',
          referenceNumber:      txn.refNumber,
          utrNumber:            extractUtr(txn.description) ?? extractUtr(txn.refNumber),
          bankAccountId,
          bankTransactionId:    txn.id,
          matchedFromStatement: true,
          createdByName:        'Auto-matched',
          notes: grns.length > 1
            ? `Auto-matched ${grns.length} GRNs from bank statement: ${txn.description.trim()}`
            : `Auto-matched from bank statement: ${txn.description.trim()}`,
        },
      });

      for (let i = 0; i < grns.length; i++) {
        const grn = grns[i];
        const amt = amounts[i];

        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, purchaseId: grn.id, allocatedAmount: amt },
        });

        const newPaid    = Number(grn.paidAmount) + amt;
        const newBalance = Math.max(0, Number(grn.amountPayable) - newPaid);
        await tx.purchase.update({
          where: { id: grn.id },
          data:  { paidAmount: newPaid, balanceAmount: newBalance },
        });
      }

      await tx.bankTransaction.update({
        where: { id: txn.id },
        data: {
          matchStatus:       'MATCHED',
          supplierPaymentId: payment.id,
          matchedBySystem:   true,
        },
      });
    });
  }

  /**
   * Called when a new GRN is approved — tries to match any SUPPLIER_PAYMENT bank
   * transactions for this supplier that were sitting UNMATCHED (payment arrived
   * before the GRN was entered in the system).
   * Fire-and-forget safe — errors are swallowed by caller.
   */
  async tryMatchPendingForSupplier(businessId: string, supplierId: string) {
    // Find all UNMATCHED SUPPLIER_PAYMENT transactions for this supplier across all accounts
    const unmatched = await this.prisma.bankTransaction.findMany({
      where: {
        businessId,
        supplierId,
        txnType:     'SUPPLIER_PAYMENT',
        matchStatus: 'UNMATCHED',
        debitAmount: { not: null },
      },
    });

    if (unmatched.length === 0) return;

    // Get open GRNs for this supplier
    const openGrns = await this.prisma.purchase.findMany({
      where: {
        businessId,
        supplierId,
        status:        'APPROVED',
        balanceAmount: { gt: 0 },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    if (openGrns.length === 0) return;

    const TOLERANCE = 5;

    for (const txn of unmatched) {
      if (!txn.debitAmount) continue;

      // Re-fetch open GRNs each iteration (previous txn may have paid some)
      const stillOpen = openGrns.filter(g => Number(g.balanceAmount) > 0);

      // Single GRN match
      const single = stillOpen.find(
        g => Math.abs(Number(g.balanceAmount) - Number(txn.debitAmount)) <= TOLERANCE
      );
      if (single) {
        await this.applyPaymentMatch(businessId, txn.bankAccountId, txn, [single], [Number(txn.debitAmount)]);
        // Update local cache
        single.balanceAmount = 0 as any;
        continue;
      }

      // Multi-GRN subset-sum
      const amounts  = stillOpen.slice(0, 20).map(g => Number(g.balanceAmount));
      const comboIdx = this.findSubsetSum(amounts, Number(txn.debitAmount), TOLERANCE);
      if (comboIdx && comboIdx.length > 0) {
        const combo       = comboIdx.map(i => stillOpen[i]);
        const totalBal    = combo.reduce((s, g) => s + Number(g.balanceAmount), 0);
        const diff        = Number(txn.debitAmount) - totalBal;
        const allocAmts   = combo.map((g, idx) => idx === 0 ? Number(g.balanceAmount) + diff : Number(g.balanceAmount));
        await this.applyPaymentMatch(businessId, txn.bankAccountId, txn, combo, allocAmts);
        combo.forEach(g => { g.balanceAmount = 0 as any; });
      }
    }
  }

  // ─── TRANSACTIONS LIST ────────────────────────────────

  async listTransactions(businessId: string, query: {
    bankAccountId?: string;
    fromDate?: string;
    toDate?: string;
    txnType?: string;
    matchStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = Number(query.page)  || 1;
    const limit = Number(query.limit) || 50;
    const skip  = (page - 1) * limit;

    const where: any = { businessId };
    if (query.bankAccountId) where.bankAccountId = query.bankAccountId;
    if (query.fromDate)      where.txnDate = { gte: new Date(query.fromDate) };
    if (query.toDate)        where.txnDate = { ...(where.txnDate ?? {}), lte: new Date(query.toDate) };
    if (query.txnType)       where.txnType = query.txnType;
    if (query.matchStatus)   where.matchStatus = query.matchStatus;

    const [items, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        orderBy: { txnDate: 'desc' },
        skip,
        take: limit,
        include: {
          bankAccount: { select: { accountName: true, bankName: true } },
          supplierPayment: {
            include: {
              supplier: { select: { name: true } },
              allocations: {
                include: {
                  purchase: {
                    select: {
                      id: true,
                      grnNumber: true,
                      invoiceNumber: true,
                      invoiceDate: true,
                      amountPayable: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async updateTransaction(id: string, businessId: string, dto: {
    txnType?:   string;
    matchStatus?: string;
    supplierId?: string;
    notes?:     string;
  }) {
    return this.prisma.bankTransaction.update({
      where: { id },
      data:  dto,
    });
  }

  // ─── SUPPLIER LEDGER ─────────────────────────────────

  async supplierLedger(businessId: string, supplierId?: string) {
    const where: any = { businessId, isActive: true };
    if (supplierId) where.id = supplierId;

    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        purchases: {
          where:  { status: 'APPROVED' },
          select: { id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true,
                    grandTotal: true, amountPayable: true, paidAmount: true, balanceAmount: true },
          orderBy: { invoiceDate: 'desc' },
        },
        payments: {
          select: { id: true, paymentDate: true, amount: true, paymentMode: true,
                    referenceNumber: true, matchedFromStatement: true, purchaseId: true },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    return suppliers.map(s => {
      const totalBilled    = s.purchases.reduce((sum, p) => sum + Number(p.amountPayable), 0);
      const totalPaid      = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalOutstanding = s.purchases.reduce((sum, p) => sum + Number(p.balanceAmount), 0);
      return {
        id:             s.id,
        name:           s.name,
        phone:          s.phone,
        totalBilled,
        totalPaid,
        totalOutstanding,
        purchases:      s.purchases,
        payments:       s.payments,
      };
    });
  }

  // ─── MANUAL PAYMENT ENTRY ────────────────────────────

  async recordPayment(businessId: string, dto: {
    supplierId:      string;
    purchaseIds:     string[];   // GRNs being paid
    amounts:         number[];   // amount for each GRN
    paymentDate:     string;
    paymentMode:     string;
    referenceNumber?: string;
    utrNumber?:       string;
    bankAccountId?:   string;
    notes?:           string;
  }) {
    const totalAmount = dto.amounts.reduce((s, a) => s + a, 0);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          businessId,
          supplierId:      dto.supplierId,
          purchaseId:      dto.purchaseIds[0],   // primary
          paymentDate:     new Date(dto.paymentDate),
          amount:          totalAmount,
          paymentMode:     dto.paymentMode,
          referenceNumber: dto.referenceNumber,
          utrNumber:       dto.utrNumber,
          bankAccountId:   dto.bankAccountId,
          notes:           dto.notes,
          createdByName:   'Manual Entry',
        },
      });

      for (let i = 0; i < dto.purchaseIds.length; i++) {
        const pid = dto.purchaseIds[i];
        const amt = dto.amounts[i];

        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, purchaseId: pid, allocatedAmount: amt },
        });

        const grn = await tx.purchase.findUnique({ where: { id: pid } });
        if (grn) {
          const newPaid    = Number(grn.paidAmount) + Number(amt);
          const newBalance = Math.max(0, Number(grn.amountPayable) - newPaid);
          await tx.purchase.update({
            where: { id: pid },
            data:  { paidAmount: newPaid, balanceAmount: newBalance },
          });
        }
      }

      return payment;
    });
  }

  // ─── SUMMARY DASHBOARD ───────────────────────────────

  async bankSummary(businessId: string) {
    const [accounts, recentTxns, outstandingSuppliers] = await Promise.all([
      this.prisma.bankAccount.findMany({
        where: { businessId, isActive: true },
      }),
      this.prisma.bankTransaction.findMany({
        where:   { businessId },
        orderBy: { txnDate: 'desc' },
        take:    10,
        include: { bankAccount: { select: { accountName: true } } },
      }),
      this.prisma.supplier.findMany({
        where: { businessId, isActive: true },
        select: {
          id:   true,
          name: true,
          purchases: {
            where:  { status: 'APPROVED', balanceAmount: { gt: 0 } },
            select: { balanceAmount: true },
          },
        },
      }),
    ]);

    const supplierOutstanding = outstandingSuppliers
      .map(s => ({
        id:          s.id,
        name:        s.name,
        outstanding: s.purchases.reduce((sum, p) => sum + Number(p.balanceAmount), 0),
      }))
      .filter(s => s.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 10);

    // Cash sales summary (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const cashSalesSummary = await this.prisma.salesBill.groupBy({
      by:     ['billDate'],
      where:  {
        businessId,
        status:      'FINAL',
        paymentMode: 'CASH',
        billDate:    { gte: sevenDaysAgo },
      },
      _sum: { grandTotal: true },
      orderBy: { billDate: 'desc' },
    }).catch(() => []); // graceful fallback if sales table empty

    return { accounts, recentTxns, supplierOutstanding, cashSalesSummary };
  }

  // ─── CASH SALES RECONCILIATION ───────────────────────
  // Match bank CASH_DEPOSIT entries against sum of daily cash POS sales

  async reconcileCashDeposits(businessId: string, bankAccountId: string) {
    const unmatched = await this.prisma.bankTransaction.findMany({
      where: {
        businessId,
        bankAccountId,
        txnType:    'CASH_DEPOSIT',
        matchStatus: 'UNMATCHED',
        creditAmount: { not: null },
      },
    });

    for (const txn of unmatched) {
      if (!txn.creditAmount) continue;

      // Check sum of cash POS bills in ±2 day window
      const from = new Date(txn.txnDate);
      from.setDate(from.getDate() - 2);
      const to = new Date(txn.txnDate);
      to.setDate(to.getDate() + 1);

      const cashTotal = await this.prisma.salesBill.aggregate({
        where: {
          businessId,
          status:      'FINAL',
          paymentMode: 'CASH',
          billDate:    { gte: from, lte: to },
        },
        _sum: { grandTotal: true },
      });

      const total = Number(cashTotal._sum.grandTotal ?? 0);
      if (total > 0 && Math.abs(total - Number(txn.creditAmount)) < 100) {
        // Close enough — mark as matched
        await this.prisma.bankTransaction.update({
          where: { id: txn.id },
          data:  { matchStatus: 'MATCHED', notes: `Matched to cash sales: ₹${total.toFixed(2)}` },
        });
      }
    }
  }
}
