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
      ['Sr No','Invoice Date','Invoice No','Customer Name','Customer GSTIN',
       'Place of Supply','Inter-State','Taxable Amount','CGST','SGST','IGST','CESS','Invoice Value'],
      ...data.b2b.map((r: any, i: number) => [
        i + 1, fmtDate(r.billDate), r.billNumber, r.customerName, r.customerGstin,
        r.supplyStateCode, r.isInterState ? 'Yes' : 'No',
        fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), fmt(r.grandTotal),
      ]),
      ['','','','','','','TOTAL',
        fmt(data.b2b.reduce((s: number, r: any) => s + r.taxableAmount, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.cgst, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.sgst, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.igst, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.cess, 0)),
        fmt(data.b2b.reduce((s: number, r: any) => s + r.grandTotal, 0)),
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2bRows), 'B2B Invoices');

    // Sheet 2: B2C Large (inter-state > ₹2.5L, Table 5)
    const b2clFlat: any[][] = [
      ['Place of Supply','Invoice No','Invoice Date','Invoice Value','GST Rate %','Taxable','IGST','CESS'],
    ];
    for (const grp of (data.b2cl ?? [])) {
      for (const inv of grp.invoices) {
        for (const item of inv.itemsByRate) {
          b2clFlat.push([
            grp.pos, inv.inum, inv.idt, fmt(inv.val),
            `${item.rt}%`, fmt(item.txval),
            fmt(item.camt + item.samt + item.iamt), fmt(item.csamt),
          ]);
        }
      }
    }
    if (b2clFlat.length > 1) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2clFlat), 'B2C Large');
    }

    // Sheet 3: B2C Small Summary (Table 7)
    const b2csRows: any[][] = [
      ['Supply Type','Place of Supply','GST Rate %','Taxable Amount','CGST','SGST','IGST','CESS','No. of Invoices'],
      ...(data.b2cs ?? []).map((r: any) => [
        r.splyTp ?? r.stateCode, r.pos ?? r.stateCode, `${r.gstRate ?? r.rt}%`,
        fmt(r.taxableAmount), fmt(r.cgst ?? 0), fmt(r.sgst ?? 0), fmt(r.igst ?? 0), fmt(r.cess ?? r.csamt ?? 0),
        r.count ?? '',
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2csRows), 'B2C Small');

    // Sheet 4: HSN Summary
    const hsnRows: any[][] = [
      ['HSN Code','Description','UOM','GST Rate %','Total Qty','Taxable Value','CGST','SGST','IGST','CESS','Total Tax'],
      ...data.hsnSummary.map((r: any) => [
        r.hsnCode, r.description, r.uom, `${r.gstRate ?? r.gstRatePercent ?? 0}%`,
        r.totalQty, fmt(r.taxableAmount),
        fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), fmt(r.totalTax),
      ]),
      ['','','','','TOTAL',
        fmt(data.hsnSummary.reduce((s: number, r: any) => s + r.taxableAmount, 0)),
        fmt(data.hsnSummary.reduce((s: number, r: any) => s + r.cgst, 0)),
        fmt(data.hsnSummary.reduce((s: number, r: any) => s + r.sgst, 0)),
        fmt(data.hsnSummary.reduce((s: number, r: any) => s + r.igst, 0)),
        fmt(data.hsnSummary.reduce((s: number, r: any) => s + r.cess, 0)),
        fmt(data.hsnSummary.reduce((s: number, r: any) => s + r.totalTax, 0)),
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hsnRows), 'HSN Summary');

    // Sheet 5: Period Summary
    const summaryRows: any[][] = [
      ['Period',         data.period],
      ['Business State', data.bizStateCode ?? ''],
      [''],
      ['Total Bills',    data.totals.totalBills],
      ['B2B Invoices',   data.totals.b2bCount ?? ''],
      ['B2C Large',      data.totals.b2clCount ?? ''],
      ['B2C Small',      data.totals.b2csCount ?? ''],
      [''],
      ['Total Taxable',  fmt(data.totals.totalTaxable)],
      ['Total CGST',     fmt(data.totals.totalCgst)],
      ['Total SGST',     fmt(data.totals.totalSgst)],
      ['Total IGST',     fmt(data.totals.totalIgst)],
      ['Total Cess',     fmt(data.totals.totalCess)],
      ['Grand Total',    fmt(data.totals.totalGrandTotal)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  generatePurchaseRegisterExcel(data: any): Buffer {
    const wb = XLSX.utils.book_new();

    const purchaseRows: any[][] = [
      ['GRN No','GRN Date','Supplier','Supplier GSTIN',
       'Invoice No','Invoice Date','Inter-State','ITC Eligibility',
       'Taxable','CGST','SGST','IGST','CESS','Total','ITC Claimed'],
      ...data.purchases.map((r: any) => [
        r.grnNumber, fmtDate(r.grnDate), r.supplierName, r.supplierGstin,
        r.invoiceNumber, fmtDate(r.invoiceDate),
        r.isInterState ? 'Yes' : 'No', r.itcEligibility,
        fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess),
        fmt(r.totalAmount), r.itcEligibility === 'NOT_ELIGIBLE' ? 0 : fmt(r.itcClaimed),
      ]),
      ['TOTAL','','','','','','','',
        fmt(data.purchases.reduce((s: number, r: any) => s + r.taxableAmount, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.cgst, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.sgst, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.igst, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.cess, 0)),
        fmt(data.purchases.reduce((s: number, r: any) => s + r.totalAmount, 0)),
        fmt(data.summary.eligibleITC),
      ],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purchaseRows), 'Purchase Register');

    const itcRows: any[][] = [
      ['ITC Summary',       ''],
      ['Period',            data.period],
      ['Total Purchases',   data.summary.totalPurchases],
      ['Total Taxable',     fmt(data.summary.totalTaxable)],
      [''],
      ['Eligible ITC',      fmt(data.summary.eligibleITC)],
      ['  CGST ITC',        fmt(data.summary.cgstITC)],
      ['  SGST ITC',        fmt(data.summary.sgstITC)],
      ['  IGST ITC',        fmt(data.summary.igstITC)],
      ['  Cess ITC',        fmt(data.summary.cessITC)],
      [''],
      ['Ineligible ITC',    fmt(data.summary.ineligibleITC)],
      [''],
      ['NOTE: Cross-verify eligible ITC with GSTR-2B on GST portal before claiming.', ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itcRows), 'ITC Summary');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
