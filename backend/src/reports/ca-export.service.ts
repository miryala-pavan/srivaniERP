import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

const r2  = (v: any) => Math.round(parseFloat(String(v ?? 0)) * 100) / 100;
const n   = (v: any) => parseFloat(String(v ?? 0)) || 0;
const dt  = (d: any) => {
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2,'0')}-${String(x.getMonth()+1).padStart(2,'0')}-${x.getFullYear()}`;
};
const INR = (v: number) => r2(v);

// Bold + fill header style helper (applied via sheet['!cols'] width; actual style needs xlsx-style but we keep it simple)
function hdr(row: any[]): any[] { return row; }

@Injectable()
export class CaExportService {
  constructor(private prisma: PrismaService) {}

  async buildExport(businessId: string, fromDate: string, toDate: string): Promise<Buffer> {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to   = new Date(toDate);   to.setHours(23, 59, 59, 999);

    const [
      business,
      purchases,
      sales,
      bankTxns,
      bankAccounts,
      suppliers,
      stockLedger,
    ] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId } }),

      // ── Purchase Register ──────────────────────────────────────────
      this.prisma.purchase.findMany({
        where:   { businessId, status: 'APPROVED', invoiceDate: { gte: from, lte: to } },
        orderBy: { invoiceDate: 'asc' },
      }),

      // ── Sales Register ─────────────────────────────────────────────
      this.prisma.salesBill.findMany({
        where:   { businessId, status: 'FINAL', billDate: { gte: from, lte: to } },
        select: {
          billNumber: true, billDate: true, grandTotal: true,
          taxableAmount: true, cgstTotal: true, sgstTotal: true, igstTotal: true,
          discountAmount: true, paymentMode: true,
          customer: { select: { name: true, gstin: true } },
        },
        orderBy: { billDate: 'asc' },
      }),

      // ── Bank Transactions ──────────────────────────────────────────
      this.prisma.bankTransaction.findMany({
        where:   { businessId, txnDate: { gte: from, lte: to } },
        include: {
          bankAccount:     { select: { accountName: true, bankName: true } },
          supplierPayment: { include: { supplier: { select: { name: true } } } },
        },
        orderBy: { txnDate: 'asc' },
      }),

      this.prisma.bankAccount.findMany({ where: { businessId } }),

      // ── Supplier Outstanding ───────────────────────────────────────
      this.prisma.supplier.findMany({
        where: { businessId, isActive: true },
        include: {
          purchases: {
            where:  { status: 'APPROVED' },
            select: { grnNumber: true, invoiceDate: true, invoiceNumber: true,
                      amountPayable: true, paidAmount: true, balanceAmount: true },
          },
        },
        orderBy: { name: 'asc' },
      }),

      // ── Stock Ledger summary ───────────────────────────────────────
      this.prisma.stockLedger.findMany({
        where:   { businessId, createdAt: { gte: from, lte: to } },
        include: { product: { select: { name: true, hsnCode: true, costPrice: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const wb = XLSX.utils.book_new();
    const period = `${dt(from)} to ${dt(to)}`;
    const bizName = (business as any)?.name ?? 'Business';

    // ────────────────────────────────────────────────────────────────
    // SHEET 1 — COVER / SUMMARY
    // ────────────────────────────────────────────────────────────────
    const totalPurchases  = purchases.reduce((s, p) => s + n(p.grandTotal), 0);
    const totalPurchaseTax= purchases.reduce((s, p) => s + n((p as any).cgstAmount) + n((p as any).sgstAmount) + n((p as any).igstAmount), 0);
    const totalSales      = sales.reduce((s, b) => s + n(b.grandTotal), 0);
    const totalSalesTax   = sales.reduce((s, b) => s + n(b.cgstTotal) + n(b.sgstTotal) + n(b.igstTotal), 0);
    const totalCredits    = bankTxns.reduce((s, t) => s + n(t.creditAmount), 0);
    const totalDebits     = bankTxns.reduce((s, t) => s + n(t.debitAmount),  0);
    const supplierDues    = suppliers.reduce((s, sup) =>
      s + sup.purchases.reduce((ss, p) => ss + n(p.balanceAmount), 0), 0);

    const coverRows = [
      ['CA EXPORT PACKAGE'],
      [bizName],
      [`Period: ${period}`],
      [],
      ['SUMMARY', ''],
      ['Total Purchases (incl. GST)',  INR(totalPurchases)],
      ['Total Purchase GST',           INR(totalPurchaseTax)],
      ['Total Sales (incl. GST)',      INR(totalSales)],
      ['Total Sales GST collected',    INR(totalSalesTax)],
      ['Net GST Liability (Output-Input)', INR(totalSalesTax - totalPurchaseTax)],
      [],
      ['Total Bank Credits',           INR(totalCredits)],
      ['Total Bank Debits',            INR(totalDebits)],
      [],
      ['Supplier Outstanding (as of today)', INR(supplierDues)],
      [],
      ['Sheets included:', ''],
      ['1. Purchase Register',  `${purchases.length} GRNs`],
      ['2. Sales Register',     `${sales.length} bills`],
      ['3. Bank Transactions',  `${bankTxns.length} entries`],
      ['4. Bank Reconciliation','Per account summary'],
      ['5. Expense Summary',    'Month-wise by category'],
      ['6. Supplier Outstanding','Creditors list'],
      ['7. Stock Register',     `${stockLedger.length} movements`],
    ];
    const coverWs = XLSX.utils.aoa_to_sheet(coverRows);
    coverWs['!cols'] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, coverWs, '0. Summary');

    // ────────────────────────────────────────────────────────────────
    // SHEET 2 — PURCHASE REGISTER
    // ────────────────────────────────────────────────────────────────
    const purchaseRows: any[][] = [
      hdr(['Sr', 'GRN No', 'Invoice Date', 'Invoice No', 'Supplier Name', 'Supplier GSTIN',
           'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Grand Total',
           'Paid Amount', 'Balance Due']),
    ];
    let pTaxable = 0, pCgst = 0, pSgst = 0, pIgst = 0, pTotal = 0, pPaid = 0, pBal = 0;
    purchases.forEach((p, i) => {
      const taxable = n(p.taxableAmount);
      const cgst    = n(p.cgstTotal);
      const sgst    = n(p.sgstTotal);
      const igst    = n(p.igstTotal);
      const tax     = cgst + sgst + igst;
      const total   = n(p.grandTotal);
      const paid    = n(p.paidAmount);
      const bal     = n(p.balanceAmount);
      pTaxable += taxable; pCgst += cgst; pSgst += sgst; pIgst += igst;
      pTotal += total; pPaid += paid; pBal += bal;
      purchaseRows.push([
        i + 1,
        p.grnNumber ?? '',
        dt(p.invoiceDate),
        p.invoiceNumber ?? '',
        p.supplierName,
        p.supplierGstin ?? '',
        INR(taxable), INR(cgst), INR(sgst), INR(igst), INR(tax), INR(total), INR(paid), INR(bal),
      ]);
    });
    purchaseRows.push(['', '', '', '', 'TOTAL', '',
      INR(pTaxable), INR(pCgst), INR(pSgst), INR(pIgst), INR(pCgst+pSgst+pIgst),
      INR(pTotal), INR(pPaid), INR(pBal)]);
    const purWs = XLSX.utils.aoa_to_sheet(purchaseRows);
    purWs['!cols'] = [4,14,14,16,28,18,14,12,12,12,12,14,14,14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, purWs, '1. Purchase Register');

    // ────────────────────────────────────────────────────────────────
    // SHEET 3 — SALES REGISTER
    // ────────────────────────────────────────────────────────────────
    const salesRows: any[][] = [
      hdr(['Sr', 'Bill No', 'Bill Date', 'Customer', 'GSTIN',
           'Taxable Amount', 'CGST', 'SGST', 'IGST', 'Total Tax',
           'Discount', 'Grand Total', 'Payment Mode']),
    ];
    let sTaxable = 0, sCgst = 0, sSgst = 0, sIgst = 0, sTotal = 0, sDisc = 0;
    sales.forEach((b, i) => {
      const taxable = n(b.taxableAmount);
      const cgst    = n(b.cgstTotal);
      const sgst    = n(b.sgstTotal);
      const igst    = n(b.igstTotal);
      const total   = n(b.grandTotal);
      const disc    = n(b.discountAmount);
      sTaxable += taxable; sCgst += cgst; sSgst += sgst; sIgst += igst; sTotal += total; sDisc += disc;
      salesRows.push([
        i + 1,
        b.billNumber ?? '',
        dt(b.billDate),
        (b.customer as any)?.name ?? 'Walk-in',
        (b.customer as any)?.gstin ?? '',
        INR(taxable), INR(cgst), INR(sgst), INR(igst), INR(cgst+sgst+igst),
        INR(disc), INR(total), b.paymentMode,
      ]);
    });
    salesRows.push(['', '', '', 'TOTAL', '',
      INR(sTaxable), INR(sCgst), INR(sSgst), INR(sIgst), INR(sCgst+sSgst+sIgst),
      INR(sDisc), INR(sTotal), '']);

    // Payment mode split summary
    salesRows.push([], ['PAYMENT MODE SUMMARY', '']);
    const modes: Record<string, number> = {};
    sales.forEach(b => { modes[b.paymentMode] = (modes[b.paymentMode] ?? 0) + n(b.grandTotal); });
    Object.entries(modes).forEach(([mode, amt]) => salesRows.push([mode, INR(amt)]));

    const salWs = XLSX.utils.aoa_to_sheet(salesRows);
    salWs['!cols'] = [4,14,12,24,18,14,12,12,12,12,12,14,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, salWs, '2. Sales Register');

    // ────────────────────────────────────────────────────────────────
    // SHEET 4 — BANK TRANSACTIONS (full ledger)
    // ────────────────────────────────────────────────────────────────
    const bankRows: any[][] = [
      hdr(['Date', 'Account', 'Description', 'Type', 'Ref / UTR',
           'Debit', 'Credit', 'Balance', 'Match Status', 'Supplier / Notes']),
    ];
    bankTxns.forEach(t => {
      bankRows.push([
        dt(t.txnDate),
        t.bankAccount.accountName,
        t.description,
        t.txnType,
        t.refNumber ?? '',
        t.debitAmount  ? INR(n(t.debitAmount))  : '',
        t.creditAmount ? INR(n(t.creditAmount)) : '',
        t.balance      ? INR(n(t.balance))      : '',
        t.matchStatus,
        t.supplierPayment?.supplier?.name ?? t.notes ?? '',
      ]);
    });
    const bankWs = XLSX.utils.aoa_to_sheet(bankRows);
    bankWs['!cols'] = [12,16,36,18,18,14,14,14,12,24].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, bankWs, '3. Bank Transactions');

    // ────────────────────────────────────────────────────────────────
    // SHEET 5 — BANK RECONCILIATION (per account summary)
    // ────────────────────────────────────────────────────────────────
    const reconRows: any[][] = [
      hdr(['Account', 'Bank', 'Opening Balance', 'Total Credits', 'Total Debits',
           'Closing Balance', 'Matched Txns', 'Unmatched Txns', 'Ignored Txns']),
    ];
    for (const acct of bankAccounts) {
      const acTxns   = bankTxns.filter(t => t.bankAccountId === acct.id);
      const credits  = acTxns.reduce((s, t) => s + n(t.creditAmount), 0);
      const debits   = acTxns.reduce((s, t) => s + n(t.debitAmount),  0);
      const matched  = acTxns.filter(t => t.matchStatus === 'MATCHED').length;
      const unmatched= acTxns.filter(t => t.matchStatus === 'UNMATCHED').length;
      const ignored  = acTxns.filter(t => t.matchStatus === 'IGNORED').length;
      reconRows.push([
        acct.accountName, acct.bankName,
        INR(n(acct.openingBalance)),
        INR(credits), INR(debits),
        INR(n(acct.currentBalance)),
        matched, unmatched, ignored,
      ]);
    }

    // Unmatched transactions detail
    reconRows.push([], ['UNMATCHED TRANSACTIONS — needs attention', '']);
    reconRows.push(['Date', 'Account', 'Description', 'Type', 'Debit', 'Credit']);
    bankTxns
      .filter(t => t.matchStatus === 'UNMATCHED' && t.txnType === 'SUPPLIER_PAYMENT')
      .forEach(t => reconRows.push([
        dt(t.txnDate), t.bankAccount.accountName, t.description, t.txnType,
        t.debitAmount  ? INR(n(t.debitAmount))  : '',
        t.creditAmount ? INR(n(t.creditAmount)) : '',
      ]));

    const reconWs = XLSX.utils.aoa_to_sheet(reconRows);
    reconWs['!cols'] = [20,12,14,14,14,16,12,14,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, reconWs, '4. Bank Reconciliation');

    // ────────────────────────────────────────────────────────────────
    // SHEET 6 — EXPENSE SUMMARY (month-wise)
    // ────────────────────────────────────────────────────────────────
    const expenseTypes = ['EXPENSE_RENT', 'EXPENSE_OTHER', 'BANK_CHARGE', 'CREDIT_CARD_PAYMENT'];
    const expenseTxns  = bankTxns.filter(t => expenseTypes.includes(t.txnType));

    // Group by month + type
    const expMap: Record<string, Record<string, number>> = {};
    expenseTxns.forEach(t => {
      const d = new Date(t.txnDate);
      const mo = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!expMap[mo]) expMap[mo] = {};
      expMap[mo][t.txnType] = (expMap[mo][t.txnType] ?? 0) + n(t.debitAmount);
    });

    const allTypes = [...new Set(expenseTxns.map(t => t.txnType))];
    const expRows: any[][] = [
      hdr(['Month', ...allTypes, 'Monthly Total']),
    ];
    const colTotals: Record<string, number> = {};
    Object.entries(expMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([mo, byType]) => {
      const row: any[] = [mo];
      let rowTotal = 0;
      allTypes.forEach(type => {
        const v = byType[type] ?? 0;
        row.push(INR(v));
        rowTotal += v;
        colTotals[type] = (colTotals[type] ?? 0) + v;
      });
      row.push(INR(rowTotal));
      expRows.push(row);
    });
    // Grand total row
    const grandTotal = Object.values(colTotals).reduce((s, v) => s + v, 0);
    expRows.push(['TOTAL', ...allTypes.map(t => INR(colTotals[t] ?? 0)), INR(grandTotal)]);

    // Full expense transaction list
    expRows.push([], ['EXPENSE TRANSACTIONS DETAIL', '']);
    expRows.push(['Date', 'Account', 'Description', 'Category', 'Amount', 'Notes']);
    expenseTxns.forEach(t => expRows.push([
      dt(t.txnDate), t.bankAccount.accountName, t.description,
      t.txnType.replace('EXPENSE_', '').replace('_', ' '),
      INR(n(t.debitAmount)), t.notes ?? '',
    ]));

    const expWs = XLSX.utils.aoa_to_sheet(expRows);
    expWs['!cols'] = [12, ...allTypes.map(() => 16), 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, expWs, '5. Expense Summary');

    // ────────────────────────────────────────────────────────────────
    // SHEET 7 — SUPPLIER OUTSTANDING (Creditors List)
    // ────────────────────────────────────────────────────────────────
    const supRows: any[][] = [
      hdr(['Supplier', 'GSTIN', 'Phone', 'GRN No', 'Invoice No', 'Invoice Date',
           'Bill Amount', 'Paid Amount', 'Balance Due', 'Ageing (days)']),
    ];
    const today = new Date();
    let totalBilled = 0, totalPaid2 = 0, totalBal2 = 0;

    suppliers.forEach(sup => {
      const openGrns = sup.purchases.filter(p => n(p.balanceAmount) > 0);
      if (openGrns.length === 0) return;

      openGrns.forEach(p => {
        const age = Math.floor((today.getTime() - new Date(p.invoiceDate).getTime()) / 86400000);
        const bill = n(p.amountPayable);
        const paid = n(p.paidAmount);
        const bal  = n(p.balanceAmount);
        totalBilled += bill; totalPaid2 += paid; totalBal2 += bal;
        supRows.push([
          sup.name,
          (sup as any).gstin ?? '',
          (sup as any).phone ?? '',
          p.grnNumber ?? '',
          p.invoiceNumber ?? '',
          dt(p.invoiceDate),
          INR(bill), INR(paid), INR(bal), age,
        ]);
      });
    });
    supRows.push(['TOTAL', '', '', '', '', '',
      INR(totalBilled), INR(totalPaid2), INR(totalBal2), '']);

    // Ageing buckets summary
    supRows.push([], ['AGEING SUMMARY', '']);
    supRows.push(['Bucket', 'Amount Due']);
    const buckets: Record<string, number> = { '0-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
    suppliers.forEach(sup => {
      sup.purchases.filter(p => n(p.balanceAmount) > 0).forEach(p => {
        const age = Math.floor((today.getTime() - new Date(p.invoiceDate).getTime()) / 86400000);
        const bal = n(p.balanceAmount);
        if      (age <= 30)  buckets['0-30 days']  += bal;
        else if (age <= 60)  buckets['31-60 days'] += bal;
        else if (age <= 90)  buckets['61-90 days'] += bal;
        else                 buckets['90+ days']   += bal;
      });
    });
    Object.entries(buckets).forEach(([k, v]) => supRows.push([k, INR(v)]));

    const supWs = XLSX.utils.aoa_to_sheet(supRows);
    supWs['!cols'] = [28,18,14,14,16,14,14,14,14,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, supWs, '6. Supplier Outstanding');

    // ────────────────────────────────────────────────────────────────
    // SHEET 8 — STOCK REGISTER (movements)
    // ────────────────────────────────────────────────────────────────
    const stockRows: any[][] = [
      hdr(['Date', 'Product', 'HSN Code', 'Movement Type', 'Qty', 'Cost Price', 'Value', 'Reference']),
    ];
    let stockInQty = 0, stockOutQty = 0, stockInVal = 0, stockOutVal = 0;
    stockLedger.forEach(sl => {
      const qty  = n(sl.quantity);
      const cost = n(sl.product?.costPrice ?? 0);
      const val  = qty * cost;
      const isIn = ['PURCHASE', 'RETURN_IN', 'OPENING'].includes(sl.movementType);
      if (isIn)  { stockInQty  += qty; stockInVal  += val; }
      else       { stockOutQty += qty; stockOutVal += val; }
      stockRows.push([
        dt(sl.createdAt),
        sl.product?.name ?? '',
        sl.product?.hsnCode ?? '',
        sl.movementType,
        qty,
        INR(cost),
        INR(val),
        sl.referenceType ?? '',
      ]);
    });
    stockRows.push([], ['STOCK SUMMARY', '']);
    stockRows.push(['Total Stock In (qty)',  stockInQty]);
    stockRows.push(['Total Stock In (value)', INR(stockInVal)]);
    stockRows.push(['Total Stock Out (qty)',  stockOutQty]);
    stockRows.push(['Total Stock Out (value)', INR(stockOutVal)]);
    stockRows.push(['Net Stock Value',         INR(stockInVal - stockOutVal)]);

    const stWs = XLSX.utils.aoa_to_sheet(stockRows);
    stWs['!cols'] = [12,32,12,18,10,12,14,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, stWs, '7. Stock Register');

    // ────────────────────────────────────────────────────────────────
    // SHEET 9 — GST SUMMARY (for CA to file returns)
    // ────────────────────────────────────────────────────────────────
    // Group by month
    const gstMap: Record<string, {
      salesTaxable: number; salesCgst: number; salesSgst: number; salesIgst: number;
      purTaxable: number;   purCgst: number;   purSgst: number;   purIgst: number;
    }> = {};
    const getGstMo = (d: any) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`;
    };
    sales.forEach(b => {
      const mo = getGstMo(b.billDate);
      if (!gstMap[mo]) gstMap[mo] = { salesTaxable:0,salesCgst:0,salesSgst:0,salesIgst:0,purTaxable:0,purCgst:0,purSgst:0,purIgst:0 };
      gstMap[mo].salesTaxable += n(b.taxableAmount);
      gstMap[mo].salesCgst    += n(b.cgstTotal);
      gstMap[mo].salesSgst    += n(b.sgstTotal);
      gstMap[mo].salesIgst    += n(b.igstTotal);
    });
    purchases.forEach(p => {
      const mo = getGstMo(p.invoiceDate);
      if (!gstMap[mo]) gstMap[mo] = { salesTaxable:0,salesCgst:0,salesSgst:0,salesIgst:0,purTaxable:0,purCgst:0,purSgst:0,purIgst:0 };
      gstMap[mo].purTaxable += n(p.taxableAmount);
      gstMap[mo].purCgst    += n(p.cgstTotal);
      gstMap[mo].purSgst    += n(p.sgstTotal);
      gstMap[mo].purIgst    += n(p.igstTotal);
    });

    const gstRows: any[][] = [
      hdr(['Month',
           'Sales Taxable', 'Output CGST', 'Output SGST', 'Output IGST', 'Total Output',
           'Purchase Taxable', 'Input CGST', 'Input SGST', 'Input IGST', 'Total Input',
           'Net GST Payable']),
    ];
    let totST=0,totSC=0,totSS=0,totSI=0,totPT=0,totPC=0,totPS=0,totPI=0;
    Object.entries(gstMap).sort(([a],[b]) => a.localeCompare(b)).forEach(([mo, g]) => {
      const outTotal = g.salesCgst + g.salesSgst + g.salesIgst;
      const inTotal  = g.purCgst   + g.purSgst   + g.purIgst;
      totST+=g.salesTaxable; totSC+=g.salesCgst; totSS+=g.salesSgst; totSI+=g.salesIgst;
      totPT+=g.purTaxable;   totPC+=g.purCgst;   totPS+=g.purSgst;   totPI+=g.purIgst;
      gstRows.push([
        mo,
        INR(g.salesTaxable), INR(g.salesCgst), INR(g.salesSgst), INR(g.salesIgst), INR(outTotal),
        INR(g.purTaxable),   INR(g.purCgst),   INR(g.purSgst),   INR(g.purIgst),   INR(inTotal),
        INR(outTotal - inTotal),
      ]);
    });
    gstRows.push(['TOTAL',
      INR(totST), INR(totSC), INR(totSS), INR(totSI), INR(totSC+totSS+totSI),
      INR(totPT), INR(totPC), INR(totPS), INR(totPI), INR(totPC+totPS+totPI),
      INR((totSC+totSS+totSI)-(totPC+totPS+totPI)),
    ]);

    const gstWs = XLSX.utils.aoa_to_sheet(gstRows);
    gstWs['!cols'] = [12,16,14,14,14,14,16,14,14,14,14,16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, gstWs, '8. GST Summary');

    // Write workbook to buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf as Buffer;
  }
}
