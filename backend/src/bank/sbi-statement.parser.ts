/**
 * SBI Bank Statement Parser
 * Handles the tab-separated .xls format that SBI exports.
 * The file is NOT a real Excel file — it is plain text with \t separators.
 */

export interface ParsedStatement {
  accountName:    string;
  accountNumber:  string;
  bankName:       string;
  branchName:     string;
  ifscCode:       string;
  fromDate:       Date;
  toDate:         Date;
  openingBalance: number;
  transactions:   ParsedTxn[];
}

export interface ParsedTxn {
  txnDate:     Date;
  valueDate:   Date | null;
  description: string;
  refNumber:   string;
  branchCode:  string;
  debitAmount: number | null;
  creditAmount: number | null;
  balance:     number | null;
  // auto-categorized
  txnType:     string;
  supplierId:  string | null;  // filled later by matching
}

/** Parse amount strings like "1,09,712.00" or " " → number */
function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s || s === '-') return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

/** Parse "1 Jun 2026" → Date */
function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Auto-categorize based on description keywords */
function categorize(desc: string): string {
  const d = desc.toUpperCase();
  if (d.includes('PHONEPE') || d.includes('PHONE PE'))         return 'SALES_PHONEPE';
  if (d.includes('PINE LABS') || d.includes('PINELABS'))       return 'SALES_PINELABS';
  if (d.includes('PAYTM'))                                      return 'SALES_PAYTM';
  if (d.includes('CASH DEPOSIT'))                               return 'CASH_DEPOSIT';
  if (d.includes('RAZORPAY'))                                   return 'SALES_RAZORPAY';
  if (d.includes('IDIB') && d.includes('BY TRANSFER'))         return 'SALES_UPI';
  // Credits that look like individual UPI receipts
  if (d.includes('BY TRANSFER') && d.includes('UPI/CR'))       return 'SALES_UPI';
  if (d.includes('BY TRANSFER') && d.includes('IMPS'))         return 'SALES_UPI';
  // Debits
  if (d.includes('TO TRANSFER') || d.startsWith('   TO'))      return 'SUPPLIER_PAYMENT';
  return 'UNCATEGORIZED';
}

export function parseSbiStatement(content: string): ParsedStatement {
  const lines = content.split('\n').map(l => l.trimEnd());

  const header: Record<string, string> = {};
  let dataStart = -1;

  // Parse header key:value lines until we hit the column header row
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Txn Date')) {
      dataStart = i + 1;
      break;
    }
    const parts = line.split('\t');
    const key   = parts[0].replace(/\s+/g, ' ').replace(/:$/, '').trim();
    const value = (parts[1] || '').trim().replace(/^_/, ''); // strip leading _ from account numbers
    if (key) header[key] = value;
  }

  const openingBalanceKey = Object.keys(header).find(k => k.startsWith('Opening Balance'));
  const openingBalance    = parseAmount(openingBalanceKey ? header[openingBalanceKey] : '0') ?? 0;

  const transactions: ParsedTxn[] = [];

  if (dataStart > 0) {
    for (let i = dataStart; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('**')) continue;

      const cols = lines[i].split('\t');
      // Columns: TxnDate, ValueDate, Description, RefNo, BranchCode, Debit, Credit, Balance
      if (cols.length < 6) continue;

      const txnDate = parseDate(cols[0]);
      if (!txnDate) continue;

      const txn: ParsedTxn = {
        txnDate,
        valueDate:    parseDate(cols[1]),
        description:  cols[2]?.trim() ?? '',
        refNumber:    cols[3]?.trim() ?? '',
        branchCode:   cols[4]?.trim() ?? '',
        debitAmount:  parseAmount(cols[5] ?? ''),
        creditAmount: parseAmount(cols[6] ?? ''),
        balance:      parseAmount(cols[7] ?? ''),
        txnType:      '',
        supplierId:   null,
      };
      txn.txnType = categorize(txn.description);
      transactions.push(txn);
    }
  }

  return {
    accountName:    header['Account Name'] ?? '',
    accountNumber:  header['Account Number'] ?? '',
    bankName:       'State Bank of India',
    branchName:     header['Branch'] ?? '',
    ifscCode:       header['IFS Code'] ?? '',
    fromDate:       parseDate(header['Start Date'] ?? '') ?? new Date(),
    toDate:         parseDate(header['End Date'] ?? '') ?? new Date(),
    openingBalance,
    transactions,
  };
}
