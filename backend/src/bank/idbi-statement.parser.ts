/**
 * IDBI Bank Statement Parser
 * IDBI exports statements as PDF with a clean table structure.
 * We use pdfplumber (via a Python subprocess) OR parse the text extracted from the PDF.
 *
 * Since the backend is Node.js, we accept the pre-extracted text (caller uses
 * pdfplumber in a separate step) OR we handle the raw PDF buffer using pdf-parse.
 *
 * Format detected:
 *   Columns: S.No | Txn Date | Value Date | Description | Cheque No | Debit(Dr) | Credit(Cr) | Balance
 *   Date format: DD/MM/YYYY HH:MM:SS
 *   Statement is in DESCENDING order (newest first)
 */

import { ParsedStatement, ParsedTxn } from './sbi-statement.parser';

function parseIndianDate(raw: string): Date | null {
  // "04/06/2026 03:12:26" or "04/06/2026"
  const s = raw.trim().split(' ')[0];
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const d = new Date(`${yyyy}-${mm}-${dd}`);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(/,/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function categorizeIdbi(desc: string): string {
  const d = desc.toUpperCase();
  // Credits
  if (d.includes('GOOGLE') && d.includes('DIGITAL'))   return 'SALES_UPI';      // Google Pay merchant settlement
  if (d.includes('PHONEPE') || d.includes('PHONE PE')) return 'SALES_PHONEPE';
  if (d.includes('PINE LABS') || d.includes('PINELABS'))return 'SALES_PINELABS';
  if (d.includes('PAYTM'))                              return 'SALES_PAYTM';
  if (d.includes('RAZORPAY'))                           return 'SALES_RAZORPAY';
  // Inter-account transfer (SBI → IDBI)
  if (d.includes('SRI VANI STORES') && (d.includes('NEFT') || d.includes('IMPS'))) return 'INTER_ACCOUNT';
  // Debits
  if (d.includes('CRED') && d.includes('CLUB'))        return 'CREDIT_CARD_PAYMENT';
  if (d.includes('AIRTEL') || d.includes('JIO') || d.includes('VODAFONE')) return 'EXPENSE_OTHER';
  if (d.includes('AZIM PREMJI') || d.includes('FOUNDATION')) return 'EXPENSE_OTHER';
  if (d.includes('TRV_CHARGE') || d.includes('BANK CHARGE') || d.includes('SMS CHARGE')) return 'BANK_CHARGE';
  if (d.includes('JUMBOTAIL'))                         return 'SUPPLIER_PAYMENT';
  if (d.includes('SRIVEN CORPORATION') || d.includes('SATNAM ENTERPRISES') || d.includes('RENUKA KIRANAM')) return 'SUPPLIER_PAYMENT';
  // UPI debits are typically personal/expense
  if (d.startsWith('UPI/'))                            return 'UNCATEGORIZED';
  return 'UNCATEGORIZED';
}

/**
 * Parse IDBI statement from extracted text rows.
 * Each row is: [sno, txnDate, valueDate, description, chequeNo, debit, credit, balance]
 * Caller passes rows extracted from PDF (via pdfplumber or pdf-parse).
 */
export function parseIdbIStatementFromRows(
  rows: (string | null)[][],
  meta: { accountName: string; accountNumber: string; fromDate: string; toDate: string }
): ParsedStatement {
  const transactions: ParsedTxn[] = [];

  for (const row of rows) {
    if (!row || row.length < 7) continue;
    const [sno, txnDateRaw, valueDateRaw, desc, , debitRaw, creditRaw, balanceRaw] = row;

    // Skip header row
    if (!sno || sno.trim().toLowerCase() === 's.no' || !/^\d+$/.test(sno.trim())) continue;

    const txnDate = parseIndianDate(txnDateRaw ?? '');
    if (!txnDate) continue;

    const debitAmount  = parseAmount(debitRaw);
    const creditAmount = parseAmount(creditRaw);
    const balance      = parseAmount(balanceRaw);
    const description  = (desc ?? '').replace(/\n/g, ' ').trim();

    const txn: ParsedTxn = {
      txnDate,
      valueDate:    parseIndianDate(valueDateRaw ?? ''),
      description,
      refNumber:    '',
      branchCode:   '',
      debitAmount,
      creditAmount,
      balance,
      txnType:      categorizeIdbi(description),
      supplierId:   null,
    };
    transactions.push(txn);
  }

  // Reverse so transactions are in ascending order
  transactions.reverse();

  const totalCredits = transactions.reduce((s, t) => s + (t.creditAmount ?? 0), 0);
  const totalDebits  = transactions.reduce((s, t) => s + (t.debitAmount  ?? 0), 0);

  return {
    accountName:    meta.accountName,
    accountNumber:  meta.accountNumber,
    bankName:       'IDBI Bank',
    branchName:     'Sangareddy',
    ifscCode:       'IBKL0001723',
    fromDate:       new Date(meta.fromDate),
    toDate:         new Date(meta.toDate),
    openingBalance: 0, // will be inferred from first balance
    transactions,
  };
}
