// Shared print utilities for POS and duplicate bill printing

export interface BizInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  fssaiLicense?: string | null;
  stateCode?: string | null;
}

export interface ReceiptItem {
  name: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  mrp: number;
  discountPercent: number;
  gstRatePercent: number;
  taxable: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  unitOfMeasure: string;
}

export interface PrintReceipt {
  billId?: string;
  billNumber: string;
  billDate: string;
  grandTotal: number;
  billType: string;
  isEstimate: boolean;
  validityDate?: string | null;
  items: ReceiptItem[];
  subtotalAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  cessTotal: number;
  mrpTotal: number;
  savings: number;
  payMode: string;
  cashReceived?: number;
  changeAmount?: number;
  customerName?: string | null;
  customerGstin?: string | null;
  isB2B: boolean;
  counterName: string;
  cashierName: string;
}

export function fullBillToReceipt(bill: any): PrintReceipt {
  const items: ReceiptItem[] = (bill.items ?? []).map((item: any) => ({
    name: item.productName ?? item.product?.name ?? '',
    hsnCode: item.hsnCode ?? item.product?.hsnCode ?? undefined,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    mrp: Number(item.unitPrice),
    discountPercent: Number(item.discountPercent ?? 0),
    gstRatePercent: Number(item.gstRatePercent ?? 0),
    taxable: Number(item.taxableAmount ?? 0),
    cgst: Number(item.cgstAmount ?? 0),
    sgst: Number(item.sgstAmount ?? 0),
    totalAmount: Number(item.totalAmount ?? 0),
    unitOfMeasure: item.unitOfMeasure ?? item.product?.unitOfMeasure ?? 'PCS',
  }));

  return {
    billId: bill.id,
    billNumber: bill.billNumber ?? '',
    billDate: bill.billDate ?? new Date().toISOString(),
    grandTotal: Number(bill.grandTotal ?? 0),
    billType: bill.billType ?? 'TAX_INVOICE',
    isEstimate: bill.billType === 'ESTIMATE',
    validityDate: bill.validityDate ?? null,
    items,
    subtotalAmount: Number(bill.subtotalAmount ?? 0),
    discountAmount: Number(bill.discountAmount ?? 0),
    taxableAmount: Number(bill.taxableAmount ?? 0),
    cgstTotal: Number(bill.cgstTotal ?? 0),
    sgstTotal: Number(bill.sgstTotal ?? 0),
    cessTotal: Number((bill as any).cessTotal ?? 0),
    mrpTotal: Number(bill.grandTotal ?? 0),
    savings: 0,
    payMode: bill.paymentMode ?? 'CASH',
    customerName: bill.customerName ?? bill.customer?.name ?? null,
    customerGstin: bill.customerGstin ?? bill.customer?.gstin ?? null,
    isB2B: bill.isB2B ?? false,
    counterName: bill.posCounter?.name ?? '',
    cashierName: bill.posShift?.cashier?.fullName ?? bill.createdBy?.fullName ?? '',
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function group(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + group(n % 100);
  }

  const rupees = Math.floor(amount);
  const paise  = Math.round((amount - rupees) * 100);
  let words = '';
  const cr = Math.floor(rupees / 10000000);
  const lk = Math.floor((rupees % 10000000) / 100000);
  const th = Math.floor((rupees % 100000) / 1000);
  const hn = rupees % 1000;
  if (cr) words += group(cr) + 'Crore ';
  if (lk) words += group(lk) + 'Lakh ';
  if (th) words += group(th) + 'Thousand ';
  words += group(hn);
  words = words.trim() || 'Zero';
  let result = words + ' Rupees';
  if (paise > 0) result += ' and ' + group(paise).trim() + ' Paise';
  return result + ' Only';
}

export function buildThermalHtml(r: PrintReceipt, biz: BizInfo | null, isDuplicate = false): string {
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const inr  = (n: number) => n.toFixed(2);

  const groups = new Map<number, typeof r.items>();
  for (const item of r.items) {
    const rate = item.gstRatePercent;
    if (!groups.has(rate)) groups.set(rate, []);
    groups.get(rate)!.push(item);
  }

  const taxSummary: Array<{ rate: number; taxable: number; cgst: number; sgst: number; total: number }> = [];
  let tsTaxable = 0, tsCgst = 0, tsSgst = 0, tsTotal = 0;
  for (const [rate, items] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
    const taxable = r2(items.reduce((s, i) => s + i.taxable, 0));
    const cgst    = r2(items.reduce((s, i) => s + i.cgst, 0));
    const sgst    = r2(items.reduce((s, i) => s + i.sgst, 0));
    const total   = r2(taxable + cgst + sgst);
    taxSummary.push({ rate, taxable, cgst, sgst, total });
    tsTaxable += taxable; tsCgst += cgst; tsSgst += sgst; tsTotal += total;
  }

  let itemsHtml = '';
  for (const [rate, items] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
    itemsHtml += `<div style="font-size:7.5pt;color:#666;margin:3px 0 1px">-- GST ${rate}% --</div>`;
    for (const item of items) {
      const disc = item.discountPercent > 0 ? ` Disc:${item.discountPercent}%` : '';
      itemsHtml += `
        <div style="margin-bottom:4px">
          <div style="font-weight:bold">${item.name}</div>
          <div style="display:flex;justify-content:space-between;font-size:8.5pt">
            <span>${item.unitOfMeasure} ${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)} x Rs.${inr(item.unitPrice)}${disc}</span>
            <span>Rs.${inr(item.totalAmount)}</span>
          </div>
        </div>`;
    }
  }

  const header = r.isEstimate ? 'ESTIMATE / QUOTATION' : (r.billType === 'TAX_INVOICE' ? 'TAX INVOICE' : 'RETAIL INVOICE');
  const dupBanner = isDuplicate ? `
    <div style="border:1px dashed #c00;padding:2px;text-align:center;font-size:8pt;font-weight:bold;color:#c00;margin:4px 0">
      ** DUPLICATE COPY **<br>
      Originally Issued: ${fmtD(r.billDate)} ${fmtT(r.billDate)}
    </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${r.billNumber}${isDuplicate ? ' (Duplicate)' : ''}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 9.5pt; width: 80mm; margin: 0; padding: 4mm; color: #000; }
      @page { size: 80mm auto; margin: 0; }
      @media print { body { padding: 2mm; } }
    </style></head><body>
    <div style="text-align:center;margin-bottom:6px">
      <div style="font-weight:bold;font-size:14pt">${biz?.name ?? 'Srivani Stores'}</div>
      ${biz?.address ? `<div style="font-size:8pt">${biz.address}</div>` : ''}
      ${biz?.phone ? `<div style="font-size:8pt">Ph: ${biz.phone}</div>` : ''}
      ${biz?.gstin ? `<div style="font-size:8pt">GSTIN: ${biz.gstin}</div>` : ''}
      ${biz?.fssaiLicense ? `<div style="font-size:8pt">FSSAI: ${biz.fssaiLicense}</div>` : ''}
    </div>
    <div style="border-top:2px solid #000;border-bottom:1px solid #000;padding:2px 0;margin-bottom:4px">
      <div style="font-weight:bold;font-size:10pt">${header}</div>
      <div style="font-size:8pt">Bill: <b>${r.billNumber}</b></div>
      <div style="font-size:8pt">Date: ${fmtD(r.billDate)} ${fmtT(r.billDate)}</div>
      <div style="font-size:8pt">Counter: ${r.counterName} . Cashier: ${r.cashierName}</div>
      ${r.isEstimate && r.validityDate ? `<div style="font-size:8pt;color:#c00">Valid Until: ${fmtD(r.validityDate)}</div>` : ''}
      ${r.customerName ? `<div style="font-size:8pt;margin-top:2px"><b>Bill To:</b> ${r.customerName}</div>` : ''}
      ${r.customerGstin ? `<div style="font-size:8pt">GSTIN: ${r.customerGstin}</div>` : ''}
    </div>
    ${dupBanner}
    <div style="font-size:8pt;display:flex;font-weight:bold;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:3px">
      <span style="flex:1">Item</span><span style="width:32px;text-align:right">Qty</span>
      <span style="width:45px;text-align:right">Rate</span><span style="width:50px;text-align:right">Amt</span>
    </div>
    ${itemsHtml}
    <div style="border-top:1px solid #000;margin-top:4px;padding-top:4px;font-size:8.5pt">
      ${r.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>Rs.${inr(r.subtotalAmount)}</span></div>` : ''}
      ${r.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>-Rs.${inr(r.discountAmount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between"><span>Taxable</span><span>Rs.${inr(r.taxableAmount)}</span></div>
      ${r.cgstTotal > 0 ? `<div style="display:flex;justify-content:space-between"><span>CGST</span><span>Rs.${inr(r.cgstTotal)}</span></div>` : ''}
      ${r.sgstTotal > 0 ? `<div style="display:flex;justify-content:space-between"><span>SGST</span><span>Rs.${inr(r.sgstTotal)}</span></div>` : ''}
      ${r.cessTotal > 0 ? `<div style="display:flex;justify-content:space-between"><span>CESS</span><span>Rs.${inr(r.cessTotal)}</span></div>` : ''}
    </div>
    <div style="border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin:4px 0;display:flex;justify-content:space-between;font-weight:bold;font-size:12pt">
      <span>TOTAL</span><span>Rs.${inr(r.grandTotal)}</span>
    </div>
    <div style="font-size:8pt;margin-bottom:4px">
      <div style="display:flex;justify-content:space-between"><span>Payment</span><span>${r.isEstimate ? 'ESTIMATE' : r.payMode}</span></div>
      ${r.cashReceived !== undefined ? `<div style="display:flex;justify-content:space-between"><span>Cash Received</span><span>Rs.${inr(r.cashReceived)}</span></div>` : ''}
      ${r.changeAmount !== undefined && r.changeAmount > 0 ? `<div style="display:flex;justify-content:space-between"><span>Change</span><span>Rs.${inr(r.changeAmount)}</span></div>` : ''}
    </div>
    ${r.savings > 0 ? `<div style="text-align:center;border:1px dashed #333;padding:2px;font-size:8pt;margin-bottom:4px">** YOU SAVED Rs.${inr(r.savings)} on this bill **</div>` : ''}
    <div style="border-top:1px solid #000;padding-top:4px;font-size:7.5pt">
      <div style="font-weight:bold;margin-bottom:2px">TAX SUMMARY:</div>
      <table style="width:100%;font-size:7.5pt;border-collapse:collapse">
        <tr style="border-bottom:1px solid #ccc"><th style="text-align:left">GST%</th><th style="text-align:right">Taxable</th><th style="text-align:right">CGST</th><th style="text-align:right">SGST</th><th style="text-align:right">Total</th></tr>
        ${taxSummary.map(ts => `<tr><td>${ts.rate}%</td><td style="text-align:right">${inr(ts.taxable)}</td><td style="text-align:right">${inr(ts.cgst)}</td><td style="text-align:right">${inr(ts.sgst)}</td><td style="text-align:right">${inr(ts.total)}</td></tr>`).join('')}
        <tr style="border-top:1px solid #000;font-weight:bold"><td>TOT</td><td style="text-align:right">${inr(r2(tsTaxable))}</td><td style="text-align:right">${inr(r2(tsCgst))}</td><td style="text-align:right">${inr(r2(tsSgst))}</td><td style="text-align:right">${inr(r2(tsTotal))}</td></tr>
      </table>
    </div>
    <div style="font-size:7.5pt;margin-top:4px"><b>Amount in Words:</b> ${amountInWords(r.grandTotal)}</div>
    <div style="text-align:center;margin-top:8px;font-size:8pt">
      <div>Thank you -- Visit Again!</div>
      <div style="font-size:7pt">* Goods once sold not returned *</div>
      ${isDuplicate ? `<div style="font-size:7pt;color:#c00;margin-top:4px">This is a duplicate copy of the original bill.</div>` : ''}
      ${r.isEstimate ? `<div style="font-size:7pt;color:#c00;margin-top:4px">NOT A TAX INVOICE</div>` : ''}
    </div>
  </body></html>`;
}

export function buildA4Html(r: PrintReceipt, biz: BizInfo | null, isDuplicate = false): string {
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmtT = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const inr  = (n: number) => n.toFixed(2);
  const header = r.isEstimate ? 'ESTIMATE / QUOTATION' : (r.billType === 'TAX_INVOICE' ? 'TAX INVOICE' : 'RETAIL INVOICE');

  const groups = new Map<number, typeof r.items>();
  for (const item of r.items) {
    if (!groups.has(item.gstRatePercent)) groups.set(item.gstRatePercent, []);
    groups.get(item.gstRatePercent)!.push(item);
  }

  let itemRows = '';
  let slno = 0;
  for (const [rate, items] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
    itemRows += `<tr style="background:#eef;"><td colspan="8" style="font-size:9pt;padding:2px 6px;font-style:italic">GST ${rate}%</td></tr>`;
    for (const item of items) {
      slno++;
      itemRows += `<tr style="border-bottom:1px solid #eee">
        <td style="padding:4px 6px;text-align:center">${slno}</td>
        <td style="padding:4px 6px">${item.name}</td>
        <td style="padding:4px 6px;text-align:center">${item.unitOfMeasure}</td>
        <td style="padding:4px 6px;text-align:right">${item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)}</td>
        <td style="padding:4px 6px;text-align:right">${inr(item.unitPrice)}</td>
        <td style="padding:4px 6px;text-align:right">${item.discountPercent > 0 ? item.discountPercent + '%' : '--'}</td>
        <td style="padding:4px 6px;text-align:right">${inr(item.cgst + item.sgst)}</td>
        <td style="padding:4px 6px;text-align:right;font-weight:bold">${inr(item.totalAmount)}</td>
      </tr>`;
    }
  }

  const dupBanner = isDuplicate ? `
    <div style="border:3px solid #c00;padding:8px;text-align:center;margin-bottom:12px">
      <div style="font-size:14pt;font-weight:bold;color:#c00">** DUPLICATE COPY **</div>
      <div style="font-size:10pt;color:#c00">Originally Issued: ${fmtD(r.billDate)} at ${fmtT(r.billDate)}</div>
    </div>` : '';

  const watermark = isDuplicate
    ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72pt;color:rgba(200,0,0,0.07);font-weight:bold;pointer-events:none;z-index:0">DUPLICATE</div>`
    : (r.isEstimate ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72pt;color:rgba(0,0,0,0.06);font-weight:bold;pointer-events:none;z-index:0">ESTIMATE</div>` : '');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${r.billNumber}${isDuplicate ? ' (Duplicate)' : ''}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; margin: 0; padding: 10mm; color: #222; }
    @page { size: A4; margin: 10mm; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #1B4F8A; color: #fff; padding: 6px 8px; }
  </style></head><body>
  ${watermark}
  ${dupBanner}
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
    <div>
      <div style="font-size:18pt;font-weight:bold;color:#1B4F8A">${biz?.name ?? 'Srivani Stores'}</div>
      ${biz?.address ? `<div>${biz.address}</div>` : ''}
      ${biz?.phone ? `<div>Phone: ${biz.phone}</div>` : ''}
      ${biz?.gstin ? `<div>GSTIN: ${biz.gstin}</div>` : ''}
      ${biz?.fssaiLicense ? `<div>FSSAI: ${biz.fssaiLicense}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div style="font-size:16pt;font-weight:bold;color:#1B4F8A">${header}</div>
      <div><b>Bill No:</b> ${r.billNumber}</div>
      <div><b>Date:</b> ${fmtD(r.billDate)}</div>
      <div><b>Time:</b> ${fmtT(r.billDate)}</div>
      ${r.isEstimate && r.validityDate ? `<div style="color:#c00"><b>Valid Until:</b> ${fmtD(r.validityDate)}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;gap:16px;margin-bottom:12px">
    <div style="flex:1;border:1px solid #ddd;padding:8px;border-radius:4px">
      <div style="font-size:8pt;text-transform:uppercase;color:#888;margin-bottom:4px">Bill To</div>
      <div style="font-weight:bold">${r.customerName ?? 'Walk-in Customer'}</div>
      ${r.customerGstin ? `<div>GSTIN: ${r.customerGstin}</div>` : ''}
      ${r.isB2B ? `<div style="display:inline-block;background:#1B4F8A;color:#fff;font-size:8pt;padding:1px 6px;border-radius:3px;margin-top:2px">B2B</div>` : ''}
    </div>
    <div style="flex:1;border:1px solid #ddd;padding:8px;border-radius:4px">
      <div style="font-size:8pt;text-transform:uppercase;color:#888;margin-bottom:4px">Details</div>
      <div>Counter: ${r.counterName}</div>
      <div>Cashier: ${r.cashierName}</div>
      <div>Payment: ${r.isEstimate ? 'ESTIMATE' : r.payMode}</div>
    </div>
  </div>
  <table style="margin-bottom:12px">
    <thead><tr>
      <th style="width:30px">#</th><th style="text-align:left">Product</th>
      <th style="width:50px">UOM</th><th style="width:50px">Qty</th>
      <th style="width:70px">Rate</th><th style="width:60px">Disc%</th>
      <th style="width:70px">Tax</th><th style="width:80px">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr><td colspan="8" style="border-top:2px solid #1B4F8A;padding:4px 0"></td></tr>
      ${r.discountAmount > 0 ? `<tr><td colspan="7" style="text-align:right;padding:2px 6px">Subtotal</td><td style="text-align:right;padding:2px 6px">${inr(r.subtotalAmount)}</td></tr>` : ''}
      ${r.discountAmount > 0 ? `<tr><td colspan="7" style="text-align:right;padding:2px 6px">Discount</td><td style="text-align:right;padding:2px 6px">- ${inr(r.discountAmount)}</td></tr>` : ''}
      <tr><td colspan="7" style="text-align:right;padding:2px 6px">Taxable Amount</td><td style="text-align:right;padding:2px 6px">${inr(r.taxableAmount)}</td></tr>
      ${r.cgstTotal > 0 ? `<tr><td colspan="7" style="text-align:right;padding:2px 6px">CGST</td><td style="text-align:right;padding:2px 6px">${inr(r.cgstTotal)}</td></tr>` : ''}
      ${r.sgstTotal > 0 ? `<tr><td colspan="7" style="text-align:right;padding:2px 6px">SGST</td><td style="text-align:right;padding:2px 6px">${inr(r.sgstTotal)}</td></tr>` : ''}
      ${r.cessTotal > 0 ? `<tr><td colspan="7" style="text-align:right;padding:2px 6px">CESS</td><td style="text-align:right;padding:2px 6px">${inr(r.cessTotal)}</td></tr>` : ''}
      <tr style="background:#1B4F8A;color:#fff"><td colspan="7" style="text-align:right;padding:6px 8px;font-weight:bold;font-size:12pt">GRAND TOTAL</td><td style="text-align:right;padding:6px 8px;font-weight:bold;font-size:12pt">Rs.${inr(r.grandTotal)}</td></tr>
    </tfoot>
  </table>
  ${r.savings > 0 ? `<div style="background:#e8f5e9;border:1px solid #4caf50;padding:8px;border-radius:4px;margin-bottom:12px;font-weight:bold;color:#2e7d32">Customer saved Rs.${inr(r.savings)} on this invoice!</div>` : ''}
  <div style="margin-bottom:12px;font-style:italic;font-size:9pt"><b>Amount in Words:</b> ${amountInWords(r.grandTotal)}</div>
  ${r.isEstimate ? `<div style="border:2px solid #c00;padding:8px;text-align:center;color:#c00;font-weight:bold;margin-bottom:12px">NOT A TAX INVOICE -- This is an estimate only</div>` : ''}
  ${isDuplicate ? `<div style="border-top:1px dashed #c00;padding-top:8px;text-align:center;font-size:8pt;color:#c00">This is a duplicate copy of the original bill. Original date: ${fmtD(r.billDate)}</div>` : ''}
  <div style="border-top:1px solid #ddd;padding-top:8px;font-size:8pt;color:#666;text-align:center">
    <div>Thank you for your business!</div>
    ${r.isEstimate ? '' : '<div>Goods once sold are not taken back. Subject to local jurisdiction.</div>'}
  </div>
  </body></html>`;
}

export function openPrint(html: string, width = 800, height = 700) {
  const win = window.open('', '_blank', `width=${width},height=${height},toolbar=0,menubar=0,scrollbars=1`);
  if (!win) { alert('Popup blocked. Please allow popups for this site and try again.'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch { /* ignore */ }
    setTimeout(() => { try { win.close(); } catch { /* ignore */ } }, 800);
  }, 600);
}
