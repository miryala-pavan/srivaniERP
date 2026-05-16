import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

const fmt = (n: number) => Math.round(n * 100) / 100;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

@Injectable()
export class ExcelExportService {

  generateSalesRegisterExcel(data: any): Buffer {
    const wb = XLSX.utils.book_new();

    // Sheet 1: B2B Invoices
    const b2bRows: any[][] = [
      ['Sr No', 'Invoice Date', 'Invoice No', 'Customer Name', 'Customer GSTIN',
       'Taxable Amount', 'CGST', 'SGST', 'IGST', 'CESS', 'Invoice Value'],
      ...data.b2b.map((r: any, i: number) => [
        i + 1, fmtDate(r.billDate), r.billNumber, r.customerName, r.customerGstin,
        fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), fmt(r.grandTotal),
      ]),
      ['', '', '', '', 'TOTAL',
        fmt(data.b2b.reduce((s: number, r: any) => s + r.taxableAmount, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.cgst, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.sgst, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.igst, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.cess, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.grandTotal, 0)),
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2bRows), 'B2B Invoices');

    // Sheet 2: B2C Summary
    const b2cRows: any[][] = [
      ['State Code', 'GST Rate %', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'CESS', 'No. of Invoices'],
      ...data.b2c.map((r: any) => [
        r.stateCode, r.gstRate,
        fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), r.count,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2cRows), 'B2C Summary');

    // Sheet 3: HSN Summary
    const hsnRows: any[][] = [
      ['HSN Code', 'Description', 'UOM', 'Total Qty', 'Taxable Value',
       'CGST', 'SGST', 'IGST', 'CESS', 'Total Tax'],
      ...data.hsnSummary.map((r: any) => [
        r.hsnCode, r.description, r.uom, r.totalQty,
        fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), fmt(r.totalTax),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hsnRows), 'HSN Summary');

    // Sheet 4: Summary
    const summaryRows: any[][] = [
      ['Period',          data.period],
      ['Total Bills',     data.totals.totalBills],
      ['Total Taxable',   fmt(data.totals.totalTaxable)],
      ['Total CGST',      fmt(data.totals.totalCgst)],
      ['Total SGST',      fmt(data.totals.totalSgst)],
      ['Total IGST',      fmt(data.totals.totalIgst)],
      ['Total Cess',      fmt(data.totals.totalCess)],
      ['Grand Total',     fmt(data.totals.totalGrandTotal)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  generatePurchaseRegisterExcel(data: any): Buffer {
    const wb = XLSX.utils.book_new();

    const purchaseRows: any[][] = [
      ['GRN No', 'GRN Date', 'Supplier', 'Supplier GSTIN',
       'Invoice No', 'Invoice Date', 'Taxable', 'CGST', 'SGST', 'IGST', 'CESS', 'Total', 'ITC Eligible'],
      ...data.purchases.map((r: any) => [
        r.grnNumber, fmtDate(r.grnDate), r.supplierName, r.supplierGstin,
        r.invoiceNumber, fmtDate(r.invoiceDate),
        fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess),
        fmt(r.totalAmount), r.itcEligibility,
      ]),
      ['TOTAL', '', '', '', '', '',
        fmt(data.purchases.reduce((s: number, r: any) => s + r.taxableAmount, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.cgst, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.sgst, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.igst, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.cess, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.totalAmount, 0)),
        '',
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purchaseRows), 'Purchase Register');

    const itcRows: any[][] = [
      ['ITC Summary',       ''],
      ['Total Purchases',   data.summary.totalPurchases],
      ['Eligible ITC',      fmt(data.summary.eligibleITC)],
      ['Ineligible ITC',    fmt(data.summary.ineligibleITC)],
      ['CGST ITC',          fmt(data.summary.cgstITC)],
      ['SGST ITC',          fmt(data.summary.sgstITC)],
      ['IGST ITC',          fmt(data.summary.igstITC)],
      ['CESS ITC',          fmt(data.summary.cessITC)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itcRows), 'ITC Summary');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
