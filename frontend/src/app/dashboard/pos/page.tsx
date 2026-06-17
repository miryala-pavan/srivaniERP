'use client';

import {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Search, X, Plus, Minus, Trash2, User as UserIcon, ChevronDown,
  CreditCard, Smartphone, Banknote, Loader2, CheckCircle2,
  Store, Clock, Printer, FileText, Receipt, PauseCircle, MessageCircle,
  ListOrdered, AlertTriangle, RefreshCw, Lock, XCircle, CalendarOff, Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { getUser, getToken } from '@/lib/auth';
import type { User as UserType } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useERPBroadcast } from '@/hooks/useERPBroadcast';
import { openInNewWindow } from '@/lib/new-window';
import { toTitleCase, formatPhoneDisplay, validatePhone } from '@/lib/input-utils';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import { FieldHelp } from '@/components/ui/FieldHelp';
import { useEscapeKey } from '@/hooks/useEscapeKey';

// ─── Types ────────────────────────────────────────────────────────────────────

type PayMode   = 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'CREDIT';
type BillType  = 'TAX_INVOICE' | 'RETAIL_INVOICE' | 'ESTIMATE';

interface PluOption {
  pluCode: string; mrp: number; sellingPrice: number;
  stockOnHand: number; receivedDate: string; batchNumber: string | null;
}

interface BizInfo {
  name: string; address?: string | null; phone?: string | null;
  gstin?: string | null; fssaiLicense?: string | null; stateCode?: string;
}
interface Counter { id: string; name: string; code: string; branchId: string }
interface Shift {
  id: string; counterId: string; branchId: string;
  startTime: string;
  openingCash: number | string;
  totalBills: number;
  totalSales: number | string;
  totalCash: number | string;
  totalUpi: number | string;
  totalCard: number | string;
  counter: Counter; cashier: { fullName: string };
}
interface SearchProduct {
  id: string; name: string; barcode: string | null;
  sellingPrice: string; mrp: string;
  gstRatePercent: string; taxId: string;
  unitOfMeasure: string; allowNegativeStock: boolean;
  currentStock: number; cessRate: number;
}
interface CartItem {
  _key: string;
  productId: string; taxId: string;
  name: string; barcode: string | null;
  unitPrice: number; mrp: number;
  gstRatePercent: number; cessRate: number; unitOfMeasure: string;
  quantity: number; discountPercent: number;
  baseAmount: number; discountAmt: number;
  taxable: number; cgst: number; sgst: number; igst: number; cessAmount: number;
  totalAmount: number;
  allowNegativeStock: boolean; currentStock: number;
  isPriceOverridden?: boolean;
  originalPrice?: number;
  overrideReason?: string;
}
interface Customer {
  id: string; name: string; phone: string;
  gstin?: string; outstandingBalance: number;
  creditLimit?: number; isSystemDefault?: boolean;
  loyaltyPoints?: number;
}
interface LoyaltyPreview {
  enabled: boolean; availablePoints: number;
  minRedeemPoints: number; maxRedeemPoints: number;
  valuePerPoint: number; earnPer100: number; projectedEarned: number; canRedeem: boolean;
}
interface Receipt {
  billId?: string;
  billNumber: string; billDate: string; grandTotal: number; billType: BillType;
  isEstimate: boolean; validityDate?: string;
  items: Array<{
    name: string; hsnCode?: string; quantity: number; unitPrice: number; mrp: number;
    discountPercent: number; gstRatePercent: number;
    taxable: number; cgst: number; sgst: number; totalAmount: number;
    unitOfMeasure: string;
  }>;
  subtotalAmount: number; discountAmount: number; taxableAmount: number;
  cgstTotal: number; sgstTotal: number; cessTotal: number; mrpTotal: number; savings: number;
  payMode: PayMode; cashReceived?: number; changeAmount?: number;
  customerName?: string; customerPhone?: string; customerGstin?: string; isB2B: boolean;
  counterName: string; cashierName: string;
}
interface HeldBill {
  id: string; holdNumber: string; billType: string;
  customerName: string | null; customerPhone: string | null;
  customerId: string | null; customerGstin: string | null;
  isB2B: boolean; itemCount: number; grandTotal: number; subtotal: number;
  counterName: string; createdByName: string;
  heldAt: string; hoursHeld: number; ageStatus: 'FRESH' | 'AGING' | 'OLD';
  items: CartItem[];
}
interface SavedCart {
  userId: string; savedAt: number; billType: BillType;
  customer: Customer | null; items: CartItem[];
}
interface PosShortcuts {
  cash: string; upi: string; card: string; print: string; estimate: string;
  hold: string; heldbills: string; newbill: string; estimatemode: string;
}

const DEFAULT_SHORTCUTS: PosShortcuts = {
  cash: 'F5', upi: 'F6', card: 'F7', print: 'F8', estimate: 'F9',
  hold: 'Ctrl+H', heldbills: 'Ctrl+B', newbill: 'Ctrl+N', estimatemode: 'Ctrl+E',
};

function buildWhatsAppMessage(r: Receipt, biz: BizInfo | null): string {
  const storeName = biz?.name ?? 'Srivani Kirana & General Stores';
  const dateStr = new Date(r.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const inrFmt = (n: number) => `Rs.${n.toFixed(2)}`;

  const lines: string[] = [
    `*${storeName}*`,
    biz?.address ? biz.address : 'New Bus Stand Area, Sangareddy',
    `Ph: ${biz?.phone ?? '9382828484'}`,
    '',
    `*${r.billNumber}*  |  ${dateStr}`,
    r.customerName ? `Customer: ${r.customerName}` : '',
    '',
    '*Items:*',
    ...r.items.map((it, i) =>
      `${i + 1}. ${it.name}\n   ${it.quantity} x ${inrFmt(it.unitPrice)} = *${inrFmt(it.totalAmount)}*`
    ),
    '',
    r.discountAmount > 0 ? `Discount: -${inrFmt(r.discountAmount)}` : '',
    r.savings > 0 ? `You saved: ${inrFmt(r.savings)} 🎉` : '',
    `*Total: ${inrFmt(r.grandTotal)}*`,
    r.payMode === 'CASH' && r.changeAmount !== undefined
      ? `Change: ${inrFmt(r.changeAmount)}`
      : '',
    '',
    '_Thank you for shopping with us!_',
  ].filter(l => l !== '');

  return lines.join('\n');
}

// ─── GST Math ─────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;

function calcItemTax(unitPrice: number, qty: number, discPct: number, gstRate: number, cessRate = 0) {
  const baseAmount  = r2(unitPrice * qty);
  const discountAmt = r2(baseAmount * discPct / 100);
  const inclusive   = r2(baseAmount - discountAmt);
  const taxable     = r2(inclusive / (1 + gstRate / 100));
  const taxAmt      = r2(inclusive - taxable);
  const cgst        = r2(taxAmt / 2);
  const sgst        = r2(taxAmt - cgst);
  const cessAmount  = r2(taxable * cessRate / 100);
  return { baseAmount, discountAmt, taxable, cgst, sgst, igst: 0, cessAmount, totalAmount: r2(inclusive + cessAmount) };
}

function buildCartItem(p: SearchProduct): CartItem {
  const unitPrice      = parseFloat(String(p.sellingPrice));
  const gstRatePercent = parseFloat(String(p.gstRatePercent ?? 0));
  const cessRate       = parseFloat(String(p.cessRate ?? 0));
  const calc           = calcItemTax(unitPrice, 1, 0, gstRatePercent, cessRate);
  return {
    _key: p.id, productId: p.id, taxId: p.taxId,
    name: p.name, barcode: p.barcode,
    unitPrice, mrp: parseFloat(String(p.mrp)),
    gstRatePercent, cessRate, unitOfMeasure: p.unitOfMeasure,
    quantity: 1, discountPercent: 0,
    allowNegativeStock: p.allowNegativeStock, currentStock: p.currentStock,
    ...calc,
  };
}

function recompute(item: CartItem): CartItem {
  return { ...item, ...calcItemTax(item.unitPrice, item.quantity, item.discountPercent, item.gstRatePercent, item.cessRate) };
}

// ─── Receipt builders ─────────────────────────────────────────────────────────

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

function buildThermalHtml(r: Receipt, biz: BizInfo | null, isDuplicate = false): string {
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
    itemsHtml += `<div style="font-size:7.5pt;color:#666;margin:3px 0 1px">── GST ${rate}% ──</div>`;
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
      <div style="font-size:8pt">Counter: ${r.counterName} · Cashier: ${r.cashierName}</div>
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

function buildA4Html(r: Receipt, biz: BizInfo | null, isDuplicate = false): string {
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

function openPrint(html: string, width = 800, height = 700) {
  const win = window.open('', '_blank', `width=${width},height=${height},toolbar=0,menubar=0,scrollbars=1`);
  if (!win) { alert('Popup blocked. Please allow popups for this site and try again.'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch {}
    setTimeout(() => { try { win.close(); } catch {} }, 800);
  }, 600);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  if (shortcut.startsWith('Ctrl+')) {
    const key = shortcut.replace('Ctrl+', '');
    return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === key.toLowerCase();
  }
  if (shortcut.startsWith('Alt+')) {
    const key = shortcut.replace('Alt+', '');
    return e.altKey && e.key.toLowerCase() === key.toLowerCase();
  }
  return e.key === shortcut;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inr = (n: number) => `Rs.${n.toFixed(2)}`;
const cls = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');

function Kbd({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 border border-gray-300">
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PosPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const queryClient = useQueryClient();
  const me = mounted ? getUser<UserType>() : null;
  const userId = me?.id ?? '';

  // Shift
  const [shift, setShift]             = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [counters, setCounters]       = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [shiftOpening, setShiftOpening] = useState(false);

  // Biz + shortcuts
  const [bizInfo, setBizInfo]         = useState<BizInfo | null>(null);
  const [shortcuts, setShortcuts]     = useState<PosShortcuts>(DEFAULT_SHORTCUTS);

  // Bill type
  const [billType, setBillType]       = useState<BillType>('TAX_INVOICE');
  const [showBillMenu, setShowBillMenu] = useState(false);
  const [estimateValidityDays, setEstimateValidityDays] = useState(3);
  const billMenuRef                   = useRef<HTMLDivElement>(null);

  // Cart
  const [cart, setCart]               = useState<CartItem[]>([]);

  // Cart recovery
  const [showRecovery, setShowRecovery] = useState(false);
  const [savedCart, setSavedCart]     = useState<SavedCart | null>(null);

  // Product search
  const [prodQuery, setProdQuery]     = useState('');
  const [prodResults, setProdResults] = useState<SearchProduct[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [showProdDrop, setShowProdDrop] = useState(false);
  const [prodActiveIdx, setProdActiveIdx] = useState(-1);
  const prodRef                       = useRef<HTMLInputElement>(null);
  const prodTimer                     = useRef<ReturnType<typeof setTimeout>>();

  // Customer
  const [custQuery, setCustQuery]     = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [custActiveIdx, setCustActiveIdx] = useState(-1);
  const [customer, setCustomer]       = useState<Customer | null>(null);

  // Loyalty
  const [loyaltyPreview, setLoyaltyPreview]   = useState<LoyaltyPreview | null>(null);
  const [loyaltyRedeemInput, setLoyaltyRedeemInput] = useState('');
  const [showLoyaltyPanel, setShowLoyaltyPanel] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName]     = useState('');
  const [quickPhone, setQuickPhone]   = useState('');
  const [quickGstin, setQuickGstin]   = useState('');
  const [quickPhoneError, setQuickPhoneError] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [onlineHint, setOnlineHint]   = useState<{ name: string; email?: string } | null>(null);
  const custTimer                     = useRef<ReturnType<typeof setTimeout>>();

  const onProdKeyDown = useKeyboardNav({
    count: prodResults.length,
    activeIndex: prodActiveIdx,
    setActiveIndex: setProdActiveIdx,
    onSelect: (i) => {
      if (pluPopupOpenRef.current) {
        playAlertBeeps();
        setPluFlash(true); setTimeout(() => setPluFlash(false), 600);
        setPluScanMsg('Please select a batch first');
        setTimeout(() => setPluScanMsg(''), 2500);
        return;
      }
      addToCart(prodResults[i]); setShowProdDrop(false); setProdActiveIdx(-1);
    },
    onClose: () => { setShowProdDrop(false); setProdQuery(''); setProdActiveIdx(-1); },
  });

  const onCustKeyDown = useKeyboardNav({
    count: custResults.length,
    activeIndex: custActiveIdx,
    setActiveIndex: setCustActiveIdx,
    onSelect: (i) => { selectCustomer(custResults[i]); setCustActiveIdx(-1); },
    onClose: () => { setShowCustDrop(false); setCustActiveIdx(-1); },
  });

  // Payment
  const [payMode, setPayMode]         = useState<PayMode>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [billing, setBilling]         = useState(false);

  // Credit sale
  const [creditPaidNow, setCreditPaidNow]     = useState('');
  const [creditSubMode, setCreditSubMode]     = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [showCreditModal, setShowCreditModal] = useState(false);

  // Success
  const [lastBill, setLastBill]       = useState<Receipt | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // F8 print choice
  const [showPrintChoice, setShowPrintChoice] = useState(false);
  const printChoiceTimer              = useRef<ReturnType<typeof setTimeout>>();

  // Hold bills
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holding, setHolding]         = useState(false);
  const [heldCount, setHeldCount]     = useState(0);

  const { data: heldBillsData, isLoading: holdLoading } = useQuery({
    queryKey: ['hold-bills'],
    queryFn:  async () => {
      const res = await api.get<HeldBill[]>('/pos/hold');
      return res.data ?? [];
    },
    enabled:   showHoldModal,
    staleTime: 0,
  });
  const heldBills = (heldBillsData ?? []) as HeldBill[];

  // Edit cell
  const [editingCell, setEditingCell] = useState<{ key: string; field: 'qty' | 'disc' } | null>(null);
  const [editValue, setEditValue]     = useState('');

  // Split payment
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi]   = useState('');
  const [splitCard, setSplitCard] = useState('');

  // Price override
  const [priceOverrideItem, setPriceOverrideItem] = useState<CartItem | null>(null);
  const [priceNewValue, setPriceNewValue]         = useState('');
  const [priceReason, setPriceReason]             = useState('');

  // PLU popup
  const [showPluPopup, setShowPluPopup]   = useState(false);
  const [pluOptions, setPluOptions]       = useState<PluOption[]>([]);
  const pluProductRef                     = useRef<SearchProduct | null>(null);
  const [pluProductName, setPluProductName] = useState('');
  const [pluFlash, setPluFlash]           = useState(false);
  const [pluScanMsg, setPluScanMsg]       = useState('');
  const pluPopupOpenRef                   = useRef(false);
  const scannerJustFiredRef               = useRef(false);
  const scanEnterIntentRef                = useRef('');
  const onScanSelectRef                   = useRef<((p: SearchProduct) => void) | null>(null);

  // Void from success modal
  const [voidingBill, setVoidingBill] = useState(false);
  const [voidReason, setVoidReason]   = useState('');

  // Insufficient stock error dialog
  const [stockErrorItems, setStockErrorItems] = useState<Array<{
    productName: string; currentStock: number; requestedQty: number;
  }>>([]);

  // Day status
  const [dayClosed, setDayClosed]       = useState(false);
  const [dayNotOpened, setDayNotOpened] = useState(false);

  // Single cashier mode
  const [singleCashierMode, setSingleCashierMode] = useState(true);

  // Close shift
  const [showCloseShift, setShowCloseShift]     = useState(false);
  const [closingCashInput, setClosingCashInput] = useState('');
  const [closeShiftNotes, setCloseShiftNotes]   = useState('');
  const [closingShift, setClosingShift]         = useState(false);

  // Close store (single cashier mode: closes shift + day together)
  const [showCloseStore, setShowCloseStore]     = useState(false);
  const [closingStore, setClosingStore]         = useState(false);

  // PWA
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt]       = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEscapeKey(closePluPopup, showPluPopup);
  useEscapeKey(() => setShowPayModal(false), showPayModal && !showPluPopup);
  useEscapeKey(() => setShowCreditModal(false), showCreditModal && !showPayModal && !showPluPopup);
  useEscapeKey(() => setShowHoldModal(false), showHoldModal && !showCreditModal && !showPayModal && !showPluPopup);
  useEscapeKey(() => setShowPrintChoice(false), showPrintChoice && !showSuccess);
  useEscapeKey(() => setShowQuickAdd(false), showQuickAdd);

  // ── Totals ──────────────────────────────────────────────
  const loyaltyPointsToRedeem = useMemo(() => {
    const v = parseInt(loyaltyRedeemInput, 10);
    if (!loyaltyPreview || !loyaltyPreview.enabled || isNaN(v) || v <= 0) return 0;
    return Math.min(v, loyaltyPreview.maxRedeemPoints);
  }, [loyaltyRedeemInput, loyaltyPreview]);

  const loyaltyDiscount = useMemo(() => {
    if (!loyaltyPreview || loyaltyPointsToRedeem <= 0) return 0;
    return r2(loyaltyPointsToRedeem * loyaltyPreview.valuePerPoint);
  }, [loyaltyPointsToRedeem, loyaltyPreview]);

  const totals = useMemo(() => {
    let subtotalAmount = 0, discountAmount = 0, taxableAmount = 0;
    let cgstTotal = 0, sgstTotal = 0, cessTotal = 0, grandTotal = 0, mrpTotal = 0;
    for (const item of cart) {
      subtotalAmount += item.baseAmount;
      discountAmount += item.discountAmt;
      taxableAmount  += item.taxable;
      cgstTotal      += item.cgst;
      sgstTotal      += item.sgst;
      cessTotal      += item.cessAmount ?? 0;
      grandTotal     += item.totalAmount;
      mrpTotal       += item.mrp * item.quantity;
    }
    const savings = r2(mrpTotal - grandTotal);
    return {
      subtotalAmount: r2(subtotalAmount), discountAmount: r2(discountAmount),
      taxableAmount:  r2(taxableAmount),  cgstTotal: r2(cgstTotal),
      sgstTotal:      r2(sgstTotal),      cessTotal: r2(cessTotal),
      grandTotal:     r2(grandTotal),
      mrpTotal:       r2(mrpTotal),       savings: Math.max(0, savings),
    };
  }, [cart]);

  const effectiveGrandTotal = useMemo(() => r2(totals.grandTotal - loyaltyDiscount), [totals.grandTotal, loyaltyDiscount]);

  const change = useMemo(() => {
    const recv = parseFloat(cashReceived) || 0;
    return r2(recv - effectiveGrandTotal);
  }, [cashReceived, effectiveGrandTotal]);

  const splitTotal = useMemo(() =>
    r2((parseFloat(splitCash) || 0) + (parseFloat(splitUpi) || 0) + (parseFloat(splitCard) || 0)),
    [splitCash, splitUpi, splitCard],
  );
  const splitBalance = useMemo(() => r2(effectiveGrandTotal - splitTotal), [effectiveGrandTotal, splitTotal]);

  // Auto-fill cash = grandTotal when split mode opens
  useEffect(() => {
    if (payMode === 'SPLIT') {
      setSplitCash(String(effectiveGrandTotal));
      setSplitUpi('0');
      setSplitCard('0');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMode]);

  const isB2B = !!(customer?.gstin || quickGstin);

  // B2B auto-lock to tax invoice
  useEffect(() => {
    if (isB2B && billType !== 'TAX_INVOICE') setBillType('TAX_INVOICE');
  }, [isB2B, billType]);

  // ── PWA: register service worker ─────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // ── ERP broadcast listener ───────────────────────────────
  useERPBroadcast((msg) => {
    if (msg.type === 'PRODUCT_ADDED') {
      toast(`${msg.name} added. Search to add to cart.`, { duration: 8000 });
    }
    if (msg.type === 'CUSTOMER_ADDED') {
      toast(`${msg.name} added as customer.`, { duration: 8000 });
    }
  });

  // ── PWA: capture install prompt ──────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Mount: load day status + shift + biz + shortcuts ────
  useEffect(() => {
    (async () => {
      setShiftLoading(true);
      try {
        const [shiftRes, bizRes, scRes, dayRes, posRes] = await Promise.allSettled([
          api.get<{ shift: Shift | null }>('/pos/shifts/current'),
          api.get<BizInfo>('/business/info'),
          api.get<PosShortcuts>('/settings/pos-shortcuts'),
          api.get<{ status: string | null }>('/day-closure/today'),
          api.get<Record<string, string>>('/settings/pos'),
        ]);

        // Check day status first
        let isDayClosed    = false;
        let isDayNotOpened = false;
        if (dayRes.status === 'fulfilled') {
          const s = dayRes.value.data?.status;
          if (s === 'COMPLETED') { isDayClosed = true; setDayClosed(true); }
          else if (!s)           { isDayNotOpened = true; setDayNotOpened(true); }
        }

        if (bizRes.status === 'fulfilled') setBizInfo(bizRes.value.data);
        if (scRes.status === 'fulfilled')  setShortcuts({ ...DEFAULT_SHORTCUTS, ...scRes.value.data });
        if (posRes.status === 'fulfilled') setSingleCashierMode(posRes.value.data.single_cashier_mode !== 'false');

        if (isDayClosed || isDayNotOpened) {
          // Don't prompt for shift if day is not operational
        } else if (shiftRes.status === 'fulfilled') {
          const { shift: s } = shiftRes.value.data;
          if (s) {
            setShift(s);
          } else {
            const ctrsRes = await api.get<Counter[]>('/pos/counters');
            setCounters(ctrsRes.data ?? []);
            setSelectedCounter(ctrsRes.data?.[0]?.id ?? '');
            setShowShiftModal(true);
          }
        } else {
          const ctrsRes = await api.get<Counter[]>('/pos/counters');
          setCounters(ctrsRes.data ?? []);
          setSelectedCounter(ctrsRes.data?.[0]?.id ?? '');
          setShowShiftModal(true);
        }
      } finally {
        setShiftLoading(false);
      }
    })();
  }, []);

  // ── Check for saved cart after userId is known ───────────
  useEffect(() => {
    if (!userId || !mounted) return;
    const key  = `srivani_cart_${userId}`;
    const raw  = localStorage.getItem(key);
    if (!raw) return;
    try {
      const data: SavedCart = JSON.parse(raw);
      if (data.items && data.items.length > 0 && data.userId === userId) {
        setSavedCart(data);
        setShowRecovery(true);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }, [userId, mounted]);

  // ── Fetch held bills count on load ───────────────────────
  useEffect(() => {
    if (!mounted) return;
    api.get<HeldBill[]>('/pos/hold')
      .then((r) => setHeldCount(r.data?.length ?? 0))
      .catch(() => {});
  }, [mounted]);

  // ── Cart auto-save every 10 seconds ─────────────────────
  useEffect(() => {
    if (!userId) return;
    const key = `srivani_cart_${userId}`;
    if (cart.length === 0) return;
    const interval = setInterval(() => {
      const data: SavedCart = {
        userId,
        savedAt: Date.now(),
        billType,
        customer,
        items: cart,
      };
      localStorage.setItem(key, JSON.stringify(data));
    }, 10000);
    return () => clearInterval(interval);
  }, [userId, cart, billType, customer]);

  function clearSavedCart() {
    if (userId) localStorage.removeItem(`srivani_cart_${userId}`);
  }

  function recoverCart() {
    if (!savedCart) return;
    setCart(savedCart.items);
    if (savedCart.customer) {
      setCustomer(savedCart.customer);
      setCustQuery(savedCart.customer.name + (savedCart.customer.phone ? ` (${savedCart.customer.phone})` : ''));
    }
    setBillType(savedCart.billType);
    setShowRecovery(false);
    setSavedCart(null);
  }

  function discardRecovery() {
    clearSavedCart();
    setShowRecovery(false);
    setSavedCart(null);
  }

  // Auto-focus product search
  useEffect(() => {
    if (shift && !showShiftModal) setTimeout(() => prodRef.current?.focus(), 100);
  }, [shift, showShiftModal]);

  // Close bill type menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (billMenuRef.current && !billMenuRef.current.contains(e.target as Node)) setShowBillMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // POS function keys must fire even when search input is focused
      const fnKeys = ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
      if (fnKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (matchesShortcut(e, shortcuts.cash))     { if (cart.length) { setPayMode('CASH'); setShowPayModal(true); } }
        if (matchesShortcut(e, shortcuts.upi))      { if (cart.length) pay('UPI'); }
        if (matchesShortcut(e, shortcuts.card))     { if (cart.length) pay('CARD'); }
        if (matchesShortcut(e, shortcuts.print)) {
          if (lastBill) {
            setShowPrintChoice(true);
            clearTimeout(printChoiceTimer.current);
            printChoiceTimer.current = setTimeout(() => setShowPrintChoice(false), 5000);
          } else {
            toast('No bill to print. Create a bill first.', { icon: 'i' });
          }
        }
        if (matchesShortcut(e, shortcuts.estimate)) { if (cart.length) saveEstimate(); }
        return;
      }

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (matchesShortcut(e, shortcuts.newbill)) { e.preventDefault(); newBill(); return; }
        if (matchesShortcut(e, shortcuts.estimatemode)) { e.preventDefault(); setBillType('ESTIMATE'); return; }
        if (matchesShortcut(e, shortcuts.hold)) { e.preventDefault(); holdBill(); return; }
        if (matchesShortcut(e, shortcuts.heldbills)) { e.preventDefault(); openHeldBills(); return; }
      }

      // Non-input shortcuts
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        setShowPayModal(false); setShowProdDrop(false); setShowCustDrop(false);
        setShowBillMenu(false); setShowPrintChoice(false); setShowHoldModal(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, lastBill, bizInfo, shortcuts]);

  // ── Real-time WS listeners ────────────────────────────────
  useWebSocketEvent('bill.held',      () => {
    queryClient.invalidateQueries({ queryKey: ['hold-bills'] });
    setHeldCount((c) => c + 1);
  });
  useWebSocketEvent('bill.retrieved', () => {
    queryClient.invalidateQueries({ queryKey: ['hold-bills'] });
    setHeldCount((c) => Math.max(0, c - 1));
  });
  useWebSocketEvent('shift.closed', (data: any) => {
    if (data?.cashierId === userId && data?.forceClose) {
      toast('Your shift was force-closed by a manager. Please reopen.', { icon: '⚠' });
      setShift(null);
      setShowShiftModal(true);
    }
  });
  useWebSocketEvent('day.closed', () => {
    setDayClosed(true);
    toast('Day has been closed by manager. Billing is disabled.', { icon: '⚠' });
  });
  useWebSocketEvent('day.opened', () => {
    setDayClosed(false);
    setDayNotOpened(false);
  });

  // ── Open shift ────────────────────────────────────────────
  async function openShift() {
    if (!selectedCounter) return toast.error('Select a counter');
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) return toast.error('Enter valid opening cash');
    setShiftOpening(true);
    try {
      const res = await api.post<{ shift: Shift; resumed: boolean }>('/pos/shifts/open', { counterId: selectedCounter, openingCash: cash });
      setShift(res.data.shift);
      setShowShiftModal(false);
      toast.success(res.data.resumed ? `Resumed shift on ${res.data.shift.counter.name}` : `Shift opened on ${res.data.shift.counter.name}`);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to open shift';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setShiftOpening(false);
    }
  }

  // ── Open store (single cashier mode: opens day + shift) ──────
  async function openStore() {
    if (!selectedCounter) return toast.error('Select a counter');
    const cash = parseFloat(openingCash);
    if (isNaN(cash) || cash < 0) return toast.error('Enter valid opening cash');
    setShiftOpening(true);
    try {
      if (dayNotOpened) {
        await api.post('/day-closure/open');
        setDayNotOpened(false);
      }
      const res = await api.post<{ shift: Shift; resumed: boolean }>('/pos/shifts/open', { counterId: selectedCounter, openingCash: cash });
      setShift(res.data.shift);
      setShowShiftModal(false);
      toast.success(res.data.resumed ? `Resumed shift on ${res.data.shift.counter.name}` : `Store opened on ${res.data.shift.counter.name}`);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to open store';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setShiftOpening(false);
    }
  }

  // ── Close store (single cashier mode: closes shift then day) ──
  async function closeStore() {
    if (!shift) return;
    const cash = parseFloat(closingCashInput);
    if (isNaN(cash) || cash < 0) return toast.error('Enter valid cash count');
    setClosingStore(true);
    try {
      await api.put(`/pos/shifts/${shift.id}/close`, {
        closingCash: cash,
        notes: closeShiftNotes.trim() || undefined,
      });
      await api.post('/day-closure/close', {
        actualCash: cash,
        notes: closeShiftNotes.trim() || undefined,
      });
      setShift(null);
      setShowCloseStore(false);
      setClosingCashInput('');
      setCloseShiftNotes('');
      setDayClosed(true);
      window.dispatchEvent(new CustomEvent('dayClosed'));
      toast.success('Store closed for the day');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to close store';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setClosingStore(false);
    }
  }

  // ── Close shift ───────────────────────────────────────────
  async function closeCurrentShift() {
    if (!shift) return;
    const cash = parseFloat(closingCashInput);
    if (isNaN(cash) || cash < 0) return toast.error('Enter valid closing cash');
    setClosingShift(true);
    try {
      await api.put(`/pos/shifts/${shift.id}/close`, {
        closingCash: cash,
        notes: closeShiftNotes.trim() || undefined,
      });
      setShift(null);
      setShowCloseShift(false);
      setClosingCashInput('');
      setCloseShiftNotes('');
      toast.success('Shift closed successfully');
      const ctrsRes = await api.get<Counter[]>('/pos/counters');
      setCounters(ctrsRes.data ?? []);
      setSelectedCounter(ctrsRes.data?.[0]?.id ?? '');
      setShowShiftModal(true);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to close shift';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setClosingShift(false);
    }
  }

  // ── Product search ────────────────────────────────────────
  const searchProducts = useCallback(async (q: string) => {
    if (!q.trim()) { setProdResults([]); setShowProdDrop(false); return; }
    setProdLoading(true);
    try {
      const res = await api.get<SearchProduct[]>('/pos/search', { params: { q } });
      const results = res.data ?? [];
      setProdResults(results);
      setShowProdDrop(results.length > 0);
      if (scanEnterIntentRef.current === q.trim() && results.length > 0) {
        scanEnterIntentRef.current = '';
        const exact = results.find(r => r.barcode === q.trim());
        const target = exact ?? (results.length === 1 ? results[0] : null);
        if (target) onScanSelectRef.current?.(target);
      }
    } catch { /* silent */ } finally { setProdLoading(false); }
  }, []);

  function onProdInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (pluPopupOpenRef.current) {
      playAlertBeeps();
      setPluFlash(true); setTimeout(() => setPluFlash(false), 600);
      setPluScanMsg('Please select a batch first');
      setTimeout(() => setPluScanMsg(''), 2500);
      return;
    }
    const val = e.target.value;
    setProdQuery(val);
    clearTimeout(prodTimer.current);
    prodTimer.current = setTimeout(() => searchProducts(val), 300);
  }

  // ── PLU helpers ───────────────────────────────────────────
  function playAlertBeeps() {
    try {
      const ctx  = new AudioContext();
      const beep = (startAt: number) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, startAt);
        gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.12);
        osc.start(startAt); osc.stop(startAt + 0.12);
      };
      beep(ctx.currentTime);
      beep(ctx.currentTime + 0.18);
    } catch { /* AudioContext not available */ }
  }

  async function addToCart(p: SearchProduct) {
    try {
      const res = await api.get<{
        productId: string; productName: string; barcode: string | null;
        taxId: string; unitOfMeasure: string; gstRatePercent: number;
        cessRate: number; allowNegativeStock: boolean;
        plus: PluOption[];
      }>(`/pos/product/${encodeURIComponent(p.barcode ?? p.id)}/plus`);

      const { plus } = res.data;
      if (plus.length === 0) {
        // No PLUs with stock — fall through to standard add (backend will enforce stock)
        doAddToCart(p, null);
      } else if (plus.length === 1) {
        doAddToCart(p, plus[0]);
      } else {
        // Multiple PLUs — show popup
        pluProductRef.current = p;
        setPluProductName(res.data.productName);
        setPluOptions(plus);
        setShowPluPopup(true);
        pluPopupOpenRef.current = true;
        scannerJustFiredRef.current = true;
        setTimeout(() => { scannerJustFiredRef.current = false; }, 500);
        playAlertBeeps();
        setProdQuery(''); setProdResults([]); setShowProdDrop(false);
      }
    } catch {
      // If PLU endpoint fails (e.g. product has no barcode registered), do standard add
      doAddToCart(p, null);
    }
  }

  function doAddToCart(p: SearchProduct, plu: PluOption | null) {
    const key        = plu ? plu.pluCode : p.id;
    const unitPrice  = plu ? plu.sellingPrice : parseFloat(String(p.sellingPrice));
    const mrp        = plu ? plu.mrp         : parseFloat(String(p.mrp));
    const gstRate    = parseFloat(String(p.gstRatePercent ?? 0));
    const cessRate   = parseFloat(String(p.cessRate ?? 0));
    const calc       = calcItemTax(unitPrice, 1, 0, gstRate, cessRate);
    const item: CartItem = {
      _key: key, productId: p.id, taxId: p.taxId,
      name: p.name, barcode: p.barcode,
      unitPrice, mrp, gstRatePercent: gstRate, cessRate, unitOfMeasure: p.unitOfMeasure,
      quantity: 1, discountPercent: 0,
      allowNegativeStock: p.allowNegativeStock, currentStock: p.currentStock,
      ...calc,
    };
    setCart((prev) => {
      const idx = prev.findIndex((c) => c._key === key);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = recompute({ ...updated[idx], quantity: updated[idx].quantity + 1 });
        return updated;
      }
      return [...prev, item];
    });
    setProdQuery(''); setProdResults([]); setShowProdDrop(false);
    prodRef.current?.focus();
  }

  function selectPlu(plu: PluOption) {
    const p = pluProductRef.current;
    if (!p) return;
    closePluPopup();
    doAddToCart(p, plu);
  }

  function closePluPopup() {
    setShowPluPopup(false);
    setPluOptions([]);
    setPluProductName('');
    setPluScanMsg('');
    pluPopupOpenRef.current = false;
    pluProductRef.current = null;
    setTimeout(() => prodRef.current?.focus(), 50);
  }

  // ── Cart ops ──────────────────────────────────────────────

  function removeItem(key: string) { setCart((prev) => prev.filter((c) => c._key !== key)); }

  function startEdit(key: string, field: 'qty' | 'disc', current: number) {
    setEditingCell({ key, field }); setEditValue(String(current));
  }

  function commitEdit(key: string, field: 'qty' | 'disc') {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      setCart((prev) => prev.map((c) => {
        if (c._key !== key) return c;
        const updated = field === 'qty'
          ? { ...c, quantity: Math.max(0.001, val) }
          : { ...c, discountPercent: Math.min(100, Math.max(0, val)) };
        return recompute(updated);
      }));
    }
    setEditingCell(null); setEditValue('');
  }

  // ── Customer search ───────────────────────────────────────
  function onCustInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustQuery(val); setCustomer(null); setOnlineHint(null);
    setLoyaltyPreview(null); setLoyaltyRedeemInput(''); setShowLoyaltyPanel(false);
    clearTimeout(custTimer.current);
    if (!val.trim()) { setCustResults([]); setShowCustDrop(false); return; }
    custTimer.current = setTimeout(async () => {
      setCustLoading(true);
      try {
        const res = await api.get<{ data: Customer[] }>('/customers', { params: { search: val } });
        const results = res.data.data ?? [];
        setCustResults(results);
        setShowCustDrop(true);

        // If no POS customer found and input looks like a phone → check online profile
        const digits = val.replace(/\D/g, '');
        if (results.length === 0 && /^[6-9]\d{9}$/.test(digits)) {
          const lookup = await api.get<{
            customer: Customer | null;
            profile:  { name: string; email: string } | null;
            source:   string;
          }>('/customers/profile-lookup', { params: { phone: digits } });
          if (lookup.data.source === 'online-profile' && lookup.data.profile) {
            setOnlineHint({ name: lookup.data.profile.name, email: lookup.data.profile.email });
            setShowQuickAdd(true);
            setQuickPhone(digits);
            setQuickName(lookup.data.profile.name);
          }
        }
      } catch { /* silent */ } finally { setCustLoading(false); }
    }, 300);
  }

  function selectCustomer(c: Customer) {
    setCustomer(c);
    setCustQuery(c.name + (c.phone ? ` (${c.phone})` : ''));
    setCustResults([]); setShowCustDrop(false);
    setShowQuickAdd(false); setOnlineHint(null);
    // Reset loyalty when customer changes
    setLoyaltyPreview(null);
    setLoyaltyRedeemInput('');
    setShowLoyaltyPanel(false);
    // Load loyalty preview if customer has points
    if ((c.loyaltyPoints ?? 0) > 0) {
      api.get<LoyaltyPreview>('/pos/loyalty/preview', { params: { customerId: c.id, billTotal: totals.grandTotal } })
        .then((r) => { if (r.data.enabled) setLoyaltyPreview(r.data); })
        .catch(() => {});
    }
  }

  async function saveQuickCustomer() {
    const phone = quickPhone.trim();
    if (!phone) return toast.error('Phone number required');
    setSavingCustomer(true);
    try {
      const res = await api.post<Customer>('/customers/pos-quick-add', {
        name:  quickName.trim() || `Customer ${phone}`,
        phone,
        gstin: quickGstin.trim() || undefined,
      });
      selectCustomer(res.data);
      setQuickName(''); setQuickPhone(''); setQuickGstin(''); setOnlineHint(null);
      toast.success(onlineHint ? `${res.data.name} (online customer) added to POS` : 'Customer saved');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to save customer';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingCustomer(false);
    }
  }

  // ── Price override ────────────────────────────────────────
  function openPriceOverride(item: CartItem) {
    setPriceOverrideItem(item);
    setPriceNewValue(String(item.unitPrice));
    setPriceReason(item.overrideReason ?? '');
  }

  function applyPriceOverride() {
    if (!priceOverrideItem) return;
    const newPrice = parseFloat(priceNewValue);
    if (isNaN(newPrice) || newPrice <= 0 || newPrice > priceOverrideItem.mrp) return;
    setCart(prev => prev.map(c => {
      if (c._key !== priceOverrideItem._key) return c;
      return recompute({
        ...c,
        unitPrice:         newPrice,
        isPriceOverridden: true,
        originalPrice:     c.isPriceOverridden ? (c.originalPrice ?? c.unitPrice) : c.unitPrice,
        overrideReason:    priceReason,
      });
    }));
    setPriceOverrideItem(null);
    setPriceNewValue('');
    setPriceReason('');
    toast.success('Price overridden');
  }

  // ── Void last bill ────────────────────────────────────────
  async function voidLastBill() {
    if (!lastBill?.billId || voidReason.length < 10) return;
    try {
      await api.post(`/pos/bills/${lastBill.billId}/void`, { reason: voidReason });
      toast.success('Bill voided');
      setVoidingBill(false);
      setVoidReason('');
      newBill();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to void bill');
    }
  }

  // ── New bill ──────────────────────────────────────────────
  function newBill() {
    clearSavedCart();
    setCart([]); setCustomer(null); setCustQuery(''); setProdQuery('');
    setCashReceived(''); setShowPayModal(false); setShowSuccess(false);
    setLastBill(null); setBillType('TAX_INVOICE'); setShowQuickAdd(false);
    setQuickName(''); setQuickPhone(''); setQuickGstin('');
    setShowPrintChoice(false); setVoidingBill(false); setVoidReason('');
    setSplitCash(''); setSplitUpi(''); setSplitCard('');
    setCreditPaidNow(''); setShowCreditModal(false);
    setLoyaltyPreview(null); setLoyaltyRedeemInput(''); setShowLoyaltyPanel(false);
    setTimeout(() => prodRef.current?.focus(), 50);
  }

  // ── Split payment handlers ────────────────────────────────
  function handleSplitCashChange(val: string) {
    setSplitCash(val);
    const cash = parseFloat(val) || 0;
    const remaining = r2(effectiveGrandTotal - cash);
    setSplitUpi(remaining > 0 ? String(remaining) : '0');
    setSplitCard('0');
  }

  function handleSplitUpiChange(val: string) {
    setSplitUpi(val);
    const cash = parseFloat(splitCash) || 0;
    const upi  = parseFloat(val) || 0;
    const remaining = r2(effectiveGrandTotal - cash - upi);
    setSplitCard(remaining > 0 ? String(remaining) : '0');
  }

  // ── Hold bill ─────────────────────────────────────────────
  async function holdBill() {
    if (cart.length === 0) { toast.error('Cart is empty. Nothing to hold.'); return; }
    if (!shift) { toast.error('No active shift'); return; }
    setHolding(true);
    try {
      const res = await api.post<{ id: string; holdNumber: string }>('/pos/hold', {
        billType,
        customerId:    customer?.id,
        customerName:  customer?.name,
        customerPhone: customer?.phone,
        customerGstin: customer?.gstin,
        isB2B,
        items: cart.map((c) => ({
          productId:      c.productId,
          taxId:          c.taxId,
          productName:    c.name,
          name:           c.name,
          barcode:        c.barcode ?? undefined,
          mrp:            c.mrp,
          unitOfMeasure:  c.unitOfMeasure,
          quantity:       c.quantity,
          unitPrice:      c.unitPrice,
          discountPercent: c.discountPercent,
          gstRatePercent: c.gstRatePercent,
          totalAmount:    c.totalAmount,
        })),
        subtotal:    totals.subtotalAmount,
        grandTotal:  totals.grandTotal,
        itemCount:   cart.length,
        counterName: shift.counter.name,
      });
      clearSavedCart();
      setCart([]); setCustomer(null); setCustQuery('');
      setHeldCount((c) => c + 1);
      queryClient.invalidateQueries({ queryKey: ['hold-bills'] });
      toast.success(`Bill held as ${res.data.holdNumber}`);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message ?? 'Failed to hold bill';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setHolding(false);
    }
  }

  function openHeldBills() {
    setShowHoldModal(true);
  }

  async function resumeHeld(held: HeldBill) {
    if (cart.length > 0) {
      if (!confirm(`Current cart has ${cart.length} item(s). Replace with ${held.holdNumber}? Current cart will be lost.`)) return;
    }
    // Mark as completed in background
    api.put(`/pos/hold/${held.id}/complete`).catch(() => {});
    // Load cart — held JSON uses `productName`; `name`/barcode/mrp/unitOfMeasure may also be present
    setCart(held.items.map((item: any, i: number) => recompute({
      ...item,
      _key:              String(Date.now() + i),
      name:              item.name ?? item.productName ?? 'Unknown Product',
      barcode:           item.barcode ?? null,
      mrp:               item.mrp ?? item.unitPrice ?? 0,
      unitOfMeasure:     item.unitOfMeasure ?? 'PCS',
      cessRate:          item.cessRate ?? 0,
      cessAmount:        item.cessAmount ?? 0,
      allowNegativeStock: item.allowNegativeStock ?? false,
      currentStock:      item.currentStock ?? 0,
    } as CartItem)));
    if (held.customerName) {
      const fakeCust: Customer = {
        id: held.customerId ?? '',
        name: held.customerName,
        phone: held.customerPhone ?? '',
        gstin: held.customerGstin ?? undefined,
        outstandingBalance: 0,
      };
      setCustomer(fakeCust);
      setCustQuery(held.customerName + (held.customerPhone ? ` (${held.customerPhone})` : ''));
    }
    setBillType(held.billType as BillType);
    setHeldCount((c) => Math.max(0, c - 1));
    queryClient.invalidateQueries({ queryKey: ['hold-bills'] });
    setShowHoldModal(false);
    toast.success(`Resumed ${held.holdNumber}`);
  }

  async function deleteHeld(held: HeldBill) {
    if (!confirm(`Delete ${held.holdNumber}? This cannot be undone.`)) return;
    try {
      await api.delete(`/pos/hold/${held.id}`);
      setHeldCount((c) => Math.max(0, c - 1));
      queryClient.invalidateQueries({ queryKey: ['hold-bills'] });
      toast.success(`${held.holdNumber} deleted`);
    } catch {
      toast.error('Failed to delete held bill');
    }
  }

  // ── PWA install ───────────────────────────────────────────
  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setShowInstallBanner(false); setInstallPrompt(null); }
  }

  // ── Save estimate ─────────────────────────────────────────
  async function saveEstimate() {
    if (!shift) return toast.error('No active shift');
    if (cart.length === 0) return toast.error('Cart is empty');
    setBilling(true);
    try {
      const payload: Record<string, unknown> = {
        shiftId: shift.id, counterId: shift.counterId,
        paymentMode: 'CASH', billType: 'ESTIMATE',
        estimateValidityDays,
        items: cart.map((c) => ({
          productId: c.productId, taxId: c.taxId,
          quantity: c.quantity, unitPrice: c.unitPrice, discountPercent: c.discountPercent,
        })),
      };
      if (customer) {
        payload.customerId = customer.id; payload.customerName = customer.name;
        payload.customerPhone = customer.phone;
        if (customer.gstin) payload.customerGstin = customer.gstin;
      }
      const res = await api.post<{ billNumber: string; id?: string }>('/pos/bills', payload);
      buildAndSetReceipt(res.data.billNumber, 'ESTIMATE', undefined, res.data.id);
      clearSavedCart();
      setShowSuccess(true);
      toast.success(`Estimate ${res.data.billNumber} saved!`);
    } catch (err: unknown) {
      const data = (err as any)?.response?.data;
      if (data?.error === 'INSUFFICIENT_STOCK') {
        setStockErrorItems([{
          productName:  data.productName,
          currentStock: data.currentStock,
          requestedQty: data.requestedQty,
        }]);
      } else {
        const msg = data?.message ?? 'Failed to save estimate';
        toast.error(Array.isArray(msg) ? msg[0] : msg);
      }
    } finally {
      setBilling(false);
    }
  }

  // ── Pay ───────────────────────────────────────────────────
  async function pay(mode: PayMode, cashAmt?: number) {
    if (mode === 'CREDIT') return; // credit handled by payCreditSale
    if (!shift) return toast.error('No active shift');
    if (cart.length === 0) return toast.error('Cart is empty');
    if (mode === 'CASH') {
      const recv = cashAmt ?? parseFloat(cashReceived);
      if (isNaN(recv) || recv < effectiveGrandTotal) {
        return toast.error(`Cash received must be >= Rs.${effectiveGrandTotal.toFixed(2)}`);
      }
    }
    if (mode === 'SPLIT' && splitBalance !== 0) {
      return toast.error('Split amounts must equal the grand total');
    }
    setBilling(true);
    try {
      const payload: Record<string, unknown> = {
        shiftId: shift.id, counterId: shift.counterId,
        paymentMode: mode, billType,
        items: cart.map((c) => ({
          productId: c.productId, taxId: c.taxId,
          quantity: c.quantity, unitPrice: c.unitPrice, discountPercent: c.discountPercent,
          isPriceOverridden: c.isPriceOverridden,
          originalPrice:     c.originalPrice,
          overrideReason:    c.overrideReason,
        })),
      };
      if (customer) {
        payload.customerId = customer.id; payload.customerName = customer.name;
        payload.customerPhone = customer.phone;
        if (customer.gstin) payload.customerGstin = customer.gstin;
      } else if (quickGstin) {
        payload.customerGstin = quickGstin;
      }
      if (loyaltyPointsToRedeem > 0) payload.loyaltyPointsRedeemed = loyaltyPointsToRedeem;
      if (mode === 'CASH')  payload.cashAmount = parseFloat(cashReceived) || effectiveGrandTotal;
      if (mode === 'SPLIT') {
        payload.cashAmount = parseFloat(splitCash) || 0;
        payload.upiAmount  = parseFloat(splitUpi)  || 0;
        payload.cardAmount = parseFloat(splitCard) || 0;
      }

      const res = await api.post<{ billNumber: string; id?: string }>('/pos/bills', payload);
      const recv = mode === 'CASH' ? (parseFloat(cashReceived) || effectiveGrandTotal) : undefined;
      buildAndSetReceipt(res.data.billNumber, billType, { mode, recv }, res.data.id);
      clearSavedCart();
      setShowPayModal(false); setShowSuccess(true);
      toast.success(`Bill ${res.data.billNumber} created!`);
    } catch (err: unknown) {
      const data = (err as any)?.response?.data;
      if (data?.error === 'INSUFFICIENT_STOCK') {
        setStockErrorItems([{
          productName:  data.productName,
          currentStock: data.currentStock,
          requestedQty: data.requestedQty,
        }]);
        setShowPayModal(false);
      } else {
        const msg = data?.message ?? 'Billing failed';
        toast.error(Array.isArray(msg) ? msg[0] : msg);
      }
    } finally {
      setBilling(false);
    }
  }

  // ── Pay on credit ─────────────────────────────────────────
  async function payCreditSale() {
    if (!shift) return toast.error('No active shift');
    if (cart.length === 0) return toast.error('Cart is empty');
    if (!customer) return toast.error('Select a customer for credit sale');
    if (customer.isSystemDefault) return toast.error('Credit sales require a named customer. Select or add a customer.');

    const paidNow      = Math.max(0, parseFloat(creditPaidNow) || 0);
    const creditAmount = r2(effectiveGrandTotal - paidNow);

    if (creditAmount > 0 && Number(customer.creditLimit) > 0) {
      const projected = r2(Number(customer.outstandingBalance) + creditAmount);
      if (projected > Number(customer.creditLimit)) {
        const ok = confirm(
          `Credit limit warning!\n${customer.name}'s outstanding will reach Rs.${projected.toFixed(2)}, exceeding the limit of Rs.${Number(customer.creditLimit).toFixed(2)}.\n\nProceed anyway?`,
        );
        if (!ok) return;
      }
    }

    setBilling(true);
    try {
      const payload: Record<string, unknown> = {
        shiftId: shift.id, counterId: shift.counterId,
        paymentMode: paidNow > 0 ? creditSubMode : 'CASH',
        paidAmount:  paidNow,
        billType,
        items: cart.map((c) => ({
          productId: c.productId, taxId: c.taxId,
          quantity: c.quantity, unitPrice: c.unitPrice, discountPercent: c.discountPercent,
          isPriceOverridden: c.isPriceOverridden,
          originalPrice:     c.originalPrice,
          overrideReason:    c.overrideReason,
        })),
        customerId:    customer.id,
        customerName:  customer.name,
        customerPhone: customer.phone,
      };
      if (customer.gstin) payload.customerGstin = customer.gstin;
      if (loyaltyPointsToRedeem > 0) payload.loyaltyPointsRedeemed = loyaltyPointsToRedeem;

      const res = await api.post<{ billNumber: string; id?: string }>('/pos/bills', payload);
      buildAndSetReceipt(
        res.data.billNumber, billType,
        { mode: (paidNow > 0 ? creditSubMode : 'CASH') as PayMode, recv: paidNow > 0 ? paidNow : undefined },
        res.data.id,
      );
      clearSavedCart();
      setShowCreditModal(false);
      setShowSuccess(true);
      toast.success(`Bill ${res.data.billNumber} — Rs.${creditAmount.toFixed(2)} on credit`);
    } catch (err: unknown) {
      const data = (err as any)?.response?.data;
      if (data?.error === 'INSUFFICIENT_STOCK') {
        setStockErrorItems([{
          productName:  data.productName,
          currentStock: data.currentStock,
          requestedQty: data.requestedQty,
        }]);
        setShowCreditModal(false);
      } else {
        const msg = data?.message ?? 'Billing failed';
        toast.error(Array.isArray(msg) ? msg[0] : msg);
      }
    } finally {
      setBilling(false);
    }
  }

  function buildAndSetReceipt(billNumber: string, bt: BillType, payInfo?: { mode: PayMode; recv?: number }, billId?: string) {
    const recv = payInfo?.recv;
    setLastBill({
      billId,
      billNumber, billDate: new Date().toISOString(),
      grandTotal: effectiveGrandTotal, billType: bt,
      isEstimate: bt === 'ESTIMATE',
      validityDate: bt === 'ESTIMATE' ? new Date(Date.now() + estimateValidityDays * 86400000).toISOString() : undefined,
      items: cart.map((c) => ({
        name: c.name, quantity: c.quantity, unitPrice: c.unitPrice, mrp: c.mrp,
        discountPercent: c.discountPercent, gstRatePercent: c.gstRatePercent,
        taxable: c.taxable, cgst: c.cgst, sgst: c.sgst, totalAmount: c.totalAmount,
        unitOfMeasure: c.unitOfMeasure,
      })),
      subtotalAmount: totals.subtotalAmount, discountAmount: totals.discountAmount,
      taxableAmount:  totals.taxableAmount,  cgstTotal: totals.cgstTotal,
      sgstTotal:      totals.sgstTotal,      cessTotal: totals.cessTotal,
      mrpTotal:       totals.mrpTotal,       savings:   totals.savings,
      payMode:        payInfo?.mode ?? 'CASH',
      cashReceived:   recv,
      changeAmount:   recv !== undefined ? r2(recv - effectiveGrandTotal) : undefined,
      customerName:   customer?.name,
      customerPhone:  customer?.phone ?? undefined,
      customerGstin:  customer?.gstin ?? (quickGstin || undefined),
      isB2B,
      counterName:    shift?.counter.name ?? '',
      cashierName:    me?.fullName ?? me?.username ?? '',
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (shiftLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const billTypeLabel: Record<BillType, string> = {
    TAX_INVOICE: 'Tax Invoice', RETAIL_INVOICE: 'Retail Invoice', ESTIMATE: 'Estimate',
  };

  const oldHeld = heldBills.filter((h) => h.ageStatus === 'OLD').length;

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden text-gray-900">

      {/* PWA install banner */}
      {showInstallBanner && (
        <div className="flex items-center justify-between bg-[#1B4F8A] text-white text-xs px-4 py-2 shrink-0">
          <span>Install Srivani POS as a desktop app for full-screen mode and keyboard shortcuts without browser interference.</span>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <button onClick={handleInstall} className="px-3 py-1 bg-white text-[#1B4F8A] font-semibold rounded hover:bg-gray-100">Install Now</button>
            <button onClick={() => setShowInstallBanner(false)} className="text-blue-200 hover:text-white">Dismiss</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="h-11 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Store className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-gray-900">Srivani Stores</span>
          {shift && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-xs text-gray-500">{shift.counter.name}</span>
            </>
          )}

          {/* Bill type selector */}
          <div ref={billMenuRef} className="relative ml-2 flex items-center gap-1">
            <button
              onClick={() => setShowBillMenu(!showBillMenu)}
              className={cls(
                'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors',
                billType === 'ESTIMATE'
                  ? 'bg-orange-50 border-orange-300 text-orange-600'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:border-gray-400'
              )}
            >
              <FileText className="w-3 h-3" />
              {billTypeLabel[billType]}
              <ChevronDown className="w-3 h-3" />
            </button>
            <FieldHelp
              title="Bill Type"
              description="TAX INVOICE: for business customers who give their GSTIN. RETAIL INVOICE: for regular walk-in customers. ESTIMATE: for quotations, not actual sales."
              hint="TAX INVOICE for B2B, RETAIL for walk-in customers"
            />
            {showBillMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                {(['TAX_INVOICE', 'RETAIL_INVOICE', 'ESTIMATE'] as BillType[]).map((bt) => (
                  <button
                    key={bt}
                    onClick={() => { setBillType(bt); setShowBillMenu(false); }}
                    disabled={isB2B && bt !== 'TAX_INVOICE'}
                    className={cls(
                      'w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors',
                      billType === bt ? 'text-blue-600 font-semibold' : 'text-gray-700',
                      isB2B && bt !== 'TAX_INVOICE' ? 'opacity-40 cursor-not-allowed' : ''
                    )}
                  >
                    {billType === bt && <Check className="w-3 h-3" />}
                    {billTypeLabel[bt]}
                  </button>
                ))}
                {billType === 'ESTIMATE' && (
                  <div className="px-3 py-2 border-t border-gray-100">
                    <label className="text-xs text-gray-500 block mb-1">Validity (days)</label>
                    <input
                      type="number" min={1} max={90}
                      value={estimateValidityDays}
                      onChange={(e) => setEstimateValidityDays(Number(e.target.value) || 3)}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {isB2B && (
            <span className="text-xs bg-blue-100 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">B2B</span>
          )}

          {/* Hold bill button */}
          <button
            onClick={heldCount > 0 ? openHeldBills : holdBill}
            disabled={holding}
            className={cls(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ml-1',
              heldCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
                : 'bg-gray-100 border-gray-200 text-gray-500 hover:border-gray-400'
            )}
            title={`Hold bill (${shortcuts.hold})`}
          >
            {holding ? <Loader2 className="w-3 h-3 animate-spin" /> : <PauseCircle className="w-3 h-3" />}
            {heldCount > 0 ? `Hold | ${heldCount} held` : 'Hold'}
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-600">
          {shift && (
            <>
              <span className="flex items-center gap-1 text-gray-500">
                <Clock className="w-3 h-3" />
                {me?.fullName ?? me?.username}
                <span className="text-gray-400 ml-1">
                  since {new Date(shift.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              {singleCashierMode ? (
                <button
                  onClick={() => { setClosingCashInput(''); setCloseShiftNotes(''); setShowCloseStore(true); }}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  Close Store
                </button>
              ) : (
                <button
                  onClick={() => { setClosingCashInput(''); setCloseShiftNotes(''); setShowCloseShift(true); }}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  End Shift
                </button>
              )}
            </>
          )}
          <span className="text-[10px] text-gray-500">
            <Kbd label={shortcuts.cash} /> Cash{' '}
            <Kbd label={shortcuts.upi} /> UPI{' '}
            <Kbd label={shortcuts.card} /> Card{' '}
            <Kbd label={shortcuts.print} /> Print{' '}
            <Kbd label={shortcuts.estimate} /> Est{' '}
            <Kbd label={shortcuts.hold} /> Hold{' '}
            <Kbd label={shortcuts.heldbills} /> Held
          </span>
        </div>
      </div>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL */}
        <div className="flex flex-col w-[60%] border-r border-gray-200 overflow-hidden">

          {/* Search bars */}
          <div className="p-3 space-y-2 border-b border-gray-200">

            {/* Customer search */}
            <div className="relative">
              <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={custQuery}
                onChange={onCustInput}
                onFocus={() => custResults.length && setShowCustDrop(true)}
                onKeyDown={onCustKeyDown}
                placeholder="Search customer by name or phone..."
                className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-20 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {custLoading && <Loader2 className="w-3.5 h-3.5 text-gray-500 animate-spin" />}
                {customer && (
                  <button onClick={() => { setCustomer(null); setCustQuery(''); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className="text-[10px] text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200"
                >
                  + Add
                </button>
              </div>
              {showCustDrop && custResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {custResults.map((c, i) => (
                    <button key={c.id} onClick={() => selectCustomer(c)}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between border-b border-gray-100 last:border-0 ${i === custActiveIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <div>
                        <p className="text-sm text-gray-800 font-medium">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                      {Number(c.outstandingBalance) > 0 && (
                        <span className="text-xs text-amber-400">Due: {inr(Number(c.outstandingBalance))}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New window: add customer when no search results */}
            {custQuery.trim() && !custLoading && !customer && custResults.length === 0 && (
              <div className="text-right -mt-1">
                <button
                  onClick={() => openInNewWindow('/dashboard/customers/new')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add Customer in New Window
                </button>
              </div>
            )}

            {/* Quick add customer panel */}
            {showQuickAdd && !customer && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                {onlineHint ? (
                  <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                    <span className="text-teal-600 text-sm">🌐</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-teal-800">Online customer found — {onlineHint.name}</p>
                      <p className="text-xs text-teal-600">Details pre-filled. Save to link this POS bill to their account.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 font-medium">Quick Add Customer</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input value={quickPhone} onChange={(e) => { setQuickPhone(formatPhoneDisplay(e.target.value)); setQuickPhoneError(''); }}
                      onBlur={() => setQuickPhoneError(quickPhone && !validatePhone(quickPhone) ? 'Invalid phone' : '')}
                      placeholder="Phone *" type="tel"
                      className={`w-full bg-white border rounded px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-500 ${quickPhoneError ? 'border-red-400' : 'border-gray-300'}`} />
                    {quickPhoneError && <p className="text-xs text-red-500 mt-0.5">{quickPhoneError}</p>}
                  </div>
                  <input value={quickName} onChange={(e) => setQuickName(e.target.value)}
                    onBlur={(e) => setQuickName(toTitleCase(e.target.value.trim()))}
                    placeholder="Name (optional)"
                    className="bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-500" />
                  <div>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      <span className="text-xs text-gray-500">GSTIN</span>
                      <FieldHelp
                        title="Customer GSTIN"
                        description="Enter the customer's GSTIN for B2B tax invoice. The system will auto-detect if interstate and apply IGST instead of CGST+SGST."
                      />
                    </div>
                    <input value={quickGstin} onChange={(e) => setQuickGstin(e.target.value.toUpperCase())}
                      placeholder="GSTIN (optional)" maxLength={15}
                      className={cls(
                        'w-full bg-white border rounded px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-500',
                        quickGstin && quickGstin.length !== 15 ? 'border-red-500' : 'border-gray-300'
                      )} />
                    <FieldHelp hint="Customer's GST number for B2B invoice" />
                  </div>
                </div>
                {quickGstin && quickGstin.length === 15 && (
                  <p className="text-xs text-blue-400">B2B detected -- Tax Invoice locked</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setShowQuickAdd(false); setQuickName(''); setQuickPhone(''); setQuickGstin(''); setQuickPhoneError(''); setOnlineHint(null); }}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                  <button onClick={saveQuickCustomer} disabled={savingCustomer}
                    className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 text-white rounded px-3 py-1.5 font-medium transition-colors flex items-center justify-center gap-1">
                    {savingCustomer && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save & Continue
                  </button>
                </div>
              </div>
            )}

            {/* Customer badge */}
            {customer && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                <UserIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-sm text-blue-700 font-medium">{customer.name}</span>
                {customer.phone && <span className="text-xs text-blue-500">{customer.phone}</span>}
                {isB2B && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">B2B</span>}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {(customer.loyaltyPoints ?? 0) > 0 && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full">
                      ⭐ {customer.loyaltyPoints} pts
                    </span>
                  )}
                  {Number(customer.outstandingBalance) > 0 && (
                    <span className="text-xs text-red-600 font-medium">Due: {inr(Number(customer.outstandingBalance))}</span>
                  )}
                  {Number(customer.creditLimit) > 0 && (
                    <span className="text-xs text-gray-500">Limit: {inr(Number(customer.creditLimit))}</span>
                  )}
                  {customer.gstin && <span className="text-xs text-blue-600 font-mono">{customer.gstin}</span>}
                </div>
              </div>
            )}

            {/* Loyalty redemption panel */}
            {loyaltyPreview?.canRedeem && customer && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-amber-800">⭐ Redeem Loyalty Points</span>
                  <span className="text-xs text-amber-600">{loyaltyPreview.availablePoints} pts available</span>
                </div>
                {showLoyaltyPanel ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={loyaltyPreview.maxRedeemPoints}
                      step={1}
                      value={loyaltyRedeemInput}
                      onChange={(e) => setLoyaltyRedeemInput(e.target.value)}
                      placeholder={`Max ${loyaltyPreview.maxRedeemPoints}`}
                      className="w-28 px-2 py-1.5 text-sm border border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-400 focus:outline-none bg-white"
                    />
                    <span className="text-xs text-amber-700">
                      = <strong>₹{loyaltyDiscount.toFixed(2)}</strong> off
                    </span>
                    <button
                      onClick={() => { setLoyaltyRedeemInput(''); setShowLoyaltyPanel(false); }}
                      className="ml-auto text-xs text-gray-500 hover:text-red-500"
                    >✕ Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLoyaltyPanel(true)}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
                  >
                    Apply points →
                  </button>
                )}
              </div>
            )}

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                ref={prodRef}
                value={prodQuery}
                onChange={onProdInput}
                onFocus={() => prodResults.length && setShowProdDrop(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pluPopupOpenRef.current) {
                    e.preventDefault();
                    if (!scannerJustFiredRef.current) {
                      playAlertBeeps();
                      setPluFlash(true); setTimeout(() => setPluFlash(false), 600);
                      setPluScanMsg('Please select a batch first');
                      setTimeout(() => setPluScanMsg(''), 2500);
                    }
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const q = prodQuery.trim();
                    if (!q) return;
                    if (prodResults.length > 0) {
                      const exact = prodResults.find(r => r.barcode === q);
                      const target = exact ?? (prodResults.length === 1 ? prodResults[0] : null);
                      if (target) { addToCart(target); setShowProdDrop(false); return; }
                      return; // multiple results, no exact match — user picks from dropdown
                    }
                    // Results not loaded yet (scanner fires Enter before debounce) — record intent and search immediately
                    scanEnterIntentRef.current = q;
                    onScanSelectRef.current = (p) => { addToCart(p); setProdResults([]); setShowProdDrop(false); setProdQuery(''); };
                    clearTimeout(prodTimer.current);
                    searchProducts(q);
                    return;
                  }
                  if (showProdDrop && prodResults.length > 0) { onProdKeyDown(e); return; }
                  if (e.key === 'Escape') { setShowProdDrop(false); setProdQuery(''); }
                }}
                placeholder="Scan barcode or search product..."
                className="w-full bg-white border border-gray-300 rounded-lg pl-8 pr-8 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-blue-500"
                autoComplete="off"
              />
              {prodLoading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 animate-spin" />}
              {showProdDrop && prodResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                  {prodResults.map((p, i) => (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between border-b border-gray-100 last:border-0 ${i === prodActiveIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.barcode ?? '--'} · {p.unitOfMeasure} · GST {p.gstRatePercent}%</p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-sm font-semibold text-green-400">{inr(parseFloat(String(p.sellingPrice)))}</p>
                        <p className={cls('text-xs', Number(p.currentStock) <= 0 ? 'text-red-400' : 'text-gray-500')}>
                          Stock: {p.currentStock}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* New window: add product when no search results */}
            {prodQuery.trim() && !prodLoading && prodResults.length === 0 && (
              <div className="text-right">
                <button
                  onClick={() => openInNewWindow('/dashboard/products/new')}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add Product in New Window
                </button>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-2">
                <Search className="w-8 h-8" />
                <p className="text-sm">Search or scan a product to add</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 w-6">#</th>
                    <th className="text-left px-2 py-2">Product</th>
                    <th className="text-right px-2 py-2 w-20">Rate</th>
                    <th className="text-center px-2 py-2 w-20">Qty</th>
                    <th className="text-center px-2 py-2 w-16">Disc%</th>
                    <th className="text-right px-2 py-2 w-16">Tax</th>
                    <th className="text-right px-2 py-2 w-20">Amount</th>
                    <th className="px-2 py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, i) => (
                    <tr key={item._key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-2 py-2">
                        <p className="text-gray-800 font-medium">{item.name}</p>
                        <p className="text-gray-400">{item.barcode ?? '--'} · GST {item.gstRatePercent}%
                          {item.allowNegativeStock && item.currentStock <= 0 && (
                            <span className="ml-1.5 text-[9px] font-semibold text-orange-500 bg-orange-50 border border-orange-200 rounded px-1">LOW STOCK</span>
                          )}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => openPriceOverride(item)}
                          title="Click to override price"
                          className={cls(
                            'text-xs hover:underline transition-colors',
                            item.isPriceOverridden ? 'text-amber-600' : 'text-gray-600 hover:text-blue-500',
                          )}
                        >
                          {inr(item.unitPrice)}
                          {item.isPriceOverridden && <span className="ml-0.5 text-[9px]">✎</span>}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {editingCell?.key === item._key && editingCell?.field === 'qty' ? (
                          <input autoFocus value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(item._key, 'qty')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') commitEdit(item._key, 'qty'); }}
                            className="w-16 bg-white border border-blue-500 rounded px-1 py-0.5 text-center text-gray-900 outline-none text-xs"
                          />
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => setCart(p => p.map(c => c._key === item._key ? recompute({ ...c, quantity: Math.max(0.001, c.quantity - 1) }) : c))}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span onClick={() => startEdit(item._key, 'qty', item.quantity)}
                              className="w-10 text-center text-gray-700 cursor-pointer hover:text-blue-500">
                              {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(3)}
                            </span>
                            <button onClick={() => setCart(p => p.map(c => c._key === item._key ? recompute({ ...c, quantity: c.quantity + 1 }) : c))}
                              className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {editingCell?.key === item._key && editingCell?.field === 'disc' ? (
                          <input autoFocus value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(item._key, 'disc')}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') commitEdit(item._key, 'disc'); }}
                            className="w-14 bg-white border border-blue-500 rounded px-1 py-0.5 text-center text-gray-900 outline-none text-xs"
                          />
                        ) : (
                          <span onClick={() => startEdit(item._key, 'disc', item.discountPercent)}
                            className={cls('cursor-pointer hover:text-blue-400 text-xs',
                              item.discountPercent > 0 ? 'text-amber-600' : 'text-gray-400')}>
                            {item.discountPercent > 0 ? `${item.discountPercent}%` : '--'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-400">
                        {item.cgst > 0 ? inr(item.cgst + item.sgst) : '--'}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-800">{inr(item.totalAmount)}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeItem(item._key)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-0.5">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[40%] flex flex-col bg-white">
          <div className="flex-1 p-4 space-y-1 overflow-auto">
            <Row label="Subtotal"  value={inr(totals.subtotalAmount)} />
            {totals.discountAmount > 0 && (
              <Row label="Discount" value={`- ${inr(totals.discountAmount)}`} valueClass="text-amber-400" />
            )}
            <Row label="Taxable"   value={inr(totals.taxableAmount)} />
            <div className="border-t border-gray-100 my-2" />
            <Row label="CGST"      value={inr(totals.cgstTotal)} />
            <Row label="SGST"      value={inr(totals.sgstTotal)} />
            {totals.cessTotal > 0 && (
              <Row label="CESS" value={inr(totals.cessTotal)} valueClass="text-orange-500" />
            )}
            <div className="border-t border-gray-200 my-3" />
            <div className="flex items-center justify-between py-3 px-3 bg-green-50 rounded-xl border border-green-200">
              <span className="text-sm text-green-500 font-medium">Grand Total</span>
              <div className="text-right">
                {loyaltyDiscount > 0 && (
                  <div className="text-xs text-amber-600 line-through">{inr(totals.grandTotal)}</div>
                )}
                <span className="text-3xl font-bold text-green-400">{inr(effectiveGrandTotal)}</span>
                {loyaltyDiscount > 0 && (
                  <div className="text-xs text-amber-700 font-medium">⭐ −{inr(loyaltyDiscount)} loyalty</div>
                )}
              </div>
            </div>
            {totals.savings > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg mt-2">
                <span className="text-xs text-amber-600">You save</span>
                <span className="text-sm font-bold text-amber-700">{inr(totals.savings)}</span>
              </div>
            )}
            <p className="text-xs text-gray-600 text-center pt-1">
              {cart.length} item{cart.length !== 1 ? 's' : ''} · {cart.reduce((s, c) => s + c.quantity, 0)} units
            </p>
          </div>

          {/* Payment mode */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Payment Mode</p>
            <div className="grid grid-cols-5 gap-1">
              {([
                ['CASH', 'Cash', Banknote, shortcuts.cash],
                ['UPI',  'UPI',  Smartphone, shortcuts.upi],
                ['CARD', 'Card', CreditCard, shortcuts.card],
              ] as const).map(([mode, label, Icon, key]) => (
                <button key={mode}
                  onClick={() => setPayMode(mode)}
                  className={cls(
                    'flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all',
                    payMode === mode
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                  )}>
                  <Icon className="w-4 h-4" />
                  {label}
                  <Kbd label={key} />
                </button>
              ))}
              <button
                onClick={() => setPayMode('SPLIT')}
                className={cls(
                  'flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all',
                  payMode === 'SPLIT'
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                )}>
                <span className="text-base leading-none">⊕</span>
                Split
              </button>
              <button
                onClick={() => setPayMode('CREDIT')}
                className={cls(
                  'flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all',
                  payMode === 'CREDIT'
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                )}>
                <Wallet className="w-4 h-4" />
                Khata
              </button>
            </div>

            {/* Split payment inputs */}
            {payMode === 'SPLIT' && (
              <div className="space-y-1.5 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-10">Cash</span>
                  <input
                    type="number" min={0} step={0.01}
                    value={splitCash}
                    onFocus={e => e.target.select()}
                    onChange={e => handleSplitCashChange(e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-purple-500 text-right"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-10">UPI</span>
                  <input
                    type="number" min={0} step={0.01}
                    value={splitUpi}
                    onFocus={e => e.target.select()}
                    onChange={e => handleSplitUpiChange(e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-purple-500 text-right"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-10">Card</span>
                  <input
                    type="number" min={0} step={0.01}
                    value={splitCard}
                    onFocus={e => e.target.select()}
                    onChange={e => setSplitCard(e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-purple-500 text-right"
                  />
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                  <span className="text-xs text-gray-500">Balance</span>
                  <span className={cls('text-sm font-bold', splitBalance === 0 ? 'text-green-600' : splitBalance > 0 ? 'text-amber-500' : 'text-red-500')}>
                    {splitBalance === 0
                      ? 'Balanced'
                      : splitBalance > 0
                      ? `${inr(splitBalance)} remaining`
                      : `${inr(-splitBalance)} change`}
                  </span>
                </div>
              </div>
            )}

            {billType === 'ESTIMATE' ? (
              <button
                disabled={cart.length === 0 || billing}
                onClick={saveEstimate}
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2">
                {billing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                {billing ? 'Saving...' : 'Save Estimate'}
              </button>
            ) : (
              <button
                disabled={
                  cart.length === 0 || billing ||
                  (payMode === 'SPLIT' && splitBalance !== 0) ||
                  (payMode === 'CREDIT' && (!customer || !!customer.isSystemDefault))
                }
                onClick={() => {
                  if (payMode === 'CASH') { setCashReceived(''); setShowPayModal(true); }
                  else if (payMode === 'CREDIT') {
                    if (!customer) { toast.error('Select a customer for credit sale'); return; }
                    if (customer.isSystemDefault) { toast.error('Credit sales require a named customer. Select or add a customer.'); return; }
                    setCreditPaidNow('');
                    setShowCreditModal(true);
                  }
                  else pay(payMode);
                }}
                className={cls(
                  'w-full py-3.5 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2',
                  payMode === 'CREDIT'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-green-600 hover:bg-green-500',
                )}>
                {billing ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {billing
                  ? 'Processing...'
                  : payMode === 'SPLIT' && splitBalance > 0
                  ? `${inr(splitBalance)} still unpaid`
                  : payMode === 'CREDIT' && !customer
                  ? 'Select a customer first'
                  : payMode === 'CREDIT' && customer?.isSystemDefault
                  ? 'Credit requires named customer'
                  : `Charge ${effectiveGrandTotal > 0 ? inr(effectiveGrandTotal) : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="h-9 bg-gray-50 border-t border-gray-200 flex items-center px-4 gap-4 shrink-0">
        <button onClick={newBill}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1">
          <X className="w-3 h-3" />New Bill <Kbd label={shortcuts.newbill} />
        </button>
        <button onClick={holdBill} disabled={cart.length === 0 || holding}
          className="text-xs text-gray-500 hover:text-amber-600 transition-colors flex items-center gap-1 disabled:opacity-40">
          <PauseCircle className="w-3 h-3" />Hold <Kbd label={shortcuts.hold} />
        </button>
        <button onClick={openHeldBills}
          className={cls(
            'text-xs transition-colors flex items-center gap-1',
            heldCount > 0 ? 'text-amber-600 hover:text-amber-700' : 'text-gray-500 hover:text-gray-700'
          )}>
          <ListOrdered className="w-3 h-3" />
          {heldCount > 0 ? `${heldCount} Held` : 'Held'} <Kbd label={shortcuts.heldbills} />
        </button>
        {lastBill && (
          <button
            onClick={() => {
              setShowPrintChoice(true);
              clearTimeout(printChoiceTimer.current);
              printChoiceTimer.current = setTimeout(() => setShowPrintChoice(false), 5000);
            }}
            className="text-xs text-gray-500 hover:text-blue-500 transition-colors flex items-center gap-1">
            <Printer className="w-3 h-3" />Reprint <Kbd label={shortcuts.print} />
          </button>
        )}
        <div className="flex-1" />
        {cart.length > 0 && (
          <button onClick={() => { setCart([]); clearSavedCart(); }}
            className="text-xs text-red-700 hover:text-red-500 transition-colors">
            Clear Cart
          </button>
        )}
      </div>

      {/* F8 Print Choice Popup */}
      {showPrintChoice && lastBill && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-xs text-gray-500">Print {lastBill.billNumber}:</span>
          <button
            onClick={() => { openPrint(buildThermalHtml(lastBill, bizInfo), 420, 750); setShowPrintChoice(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors">
            <Printer className="w-3.5 h-3.5" />Thermal
          </button>
          <button
            onClick={() => { openPrint(buildA4Html(lastBill, bizInfo)); setShowPrintChoice(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg font-medium transition-colors border border-gray-200">
            <Receipt className="w-3.5 h-3.5" />A4
          </button>
          <button onClick={() => setShowPrintChoice(false)} className="text-gray-400 hover:text-gray-600 ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-gray-400">auto-closes in 5s</span>
        </div>
      )}

      {/* ════════ MODALS ════════ */}

      {/* Cart Recovery Modal */}
      {showRecovery && savedCart && (
        <Modal>
          <div className="w-80">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-gray-900 font-semibold">Unsaved Cart Found</h2>
                <p className="text-gray-500 text-xs">
                  {Math.round((Date.now() - savedCart.savedAt) / 60000)} min ago
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-xs text-gray-500">
                {savedCart.items.length} items &middot; Total: {inr(savedCart.items.reduce((s, i) => s + i.totalAmount, 0))}
              </p>
              {savedCart.items.slice(0, 3).map((item, i) => (
                <p key={i} className="text-xs text-gray-700 truncate">· {item.name} x{item.quantity}</p>
              ))}
              {savedCart.items.length > 3 && (
                <p className="text-xs text-gray-400">...and {savedCart.items.length - 3} more</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={discardRecovery}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors border border-gray-200">
                Start Fresh
              </button>
              <button onClick={recoverCart}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-colors">
                Recover Cart
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Insufficient Stock Error Dialog */}
      {stockErrorItems.length > 0 && (
        <Modal>
          <div className="w-80">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-gray-900 font-semibold">Insufficient Stock</h2>
                <p className="text-gray-500 text-xs">Cart preserved — adjust quantities and retry</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 mb-4 space-y-2">
              {stockErrorItems.map((item, i) => (
                <div key={i} className="text-xs">
                  <p className="font-medium text-red-800 truncate">{item.productName}</p>
                  <p className="text-red-600">
                    Available: {item.currentStock} &nbsp;|&nbsp; Required: {item.requestedQty}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStockErrorItems([])}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              OK, Edit Cart
            </button>
          </div>
        </Modal>
      )}

      {/* Shift modal */}
      {/* Day Closed Overlay */}
      {dayClosed && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center w-80">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Lock className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-gray-900 font-bold text-xl mb-2">Store Day Closed</h2>
            <p className="text-gray-500 text-sm mb-1">Today's business day is closed.</p>
            <p className="text-gray-400 text-sm mb-7">No billing is allowed after day closure. Tomorrow: manager opens new day.</p>
            <button
              onClick={() => { window.location.href = '/dashboard/day-closure'; }}
              className="block w-full py-3 bg-[#1B4F8A] hover:bg-[#163d6e] text-white rounded-xl font-semibold text-sm transition-colors">
              View Day Summary
            </button>
          </div>
        </div>
      )}

      {/* Single cashier mode: combined Open Store overlay (day not opened OR no shift) */}
      {singleCashierMode && !dayClosed && (dayNotOpened || showShiftModal) && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="w-80">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Store className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-gray-900 font-bold text-xl mb-1">Open Store</h2>
              <p className="text-gray-500 text-sm">Enter opening cash to start today's billing.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Counter</label>
                {counters.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No counters found. Ask admin to create a POS counter first.
                  </p>
                ) : (
                  <div className="relative">
                    <select value={selectedCounter} onChange={(e) => setSelectedCounter(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500 appearance-none">
                      {counters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Opening Cash (Rs.)</label>
                <input
                  type="number" autoFocus
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openStore()}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-green-500"
                />
              </div>
              <button
                onClick={openStore}
                disabled={shiftOpening || counters.length === 0}
                className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {shiftOpening && <Loader2 className="w-4 h-4 animate-spin" />}
                {shiftOpening ? 'Opening...' : 'Open Store'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-cashier mode: day not opened overlay (links to manager page) */}
      {!singleCashierMode && dayNotOpened && !dayClosed && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center w-80">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CalendarOff className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-gray-900 font-bold text-xl mb-2">Store Not Opened</h2>
            <p className="text-gray-500 text-sm mb-7">Manager must open the store before billing can start.</p>
            <button
              onClick={() => { window.location.href = '/dashboard/day-closure'; }}
              className="block w-full py-3 bg-[#1B4F8A] hover:bg-[#163d6e] text-white rounded-xl font-semibold text-sm transition-colors">
              Go to Day Management
            </button>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShift && shift && (
        <Modal onClose={() => setShowCloseShift(false)}>
          <div className="w-80">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-gray-900 font-semibold">Close Shift</h2>
                <p className="text-gray-500 text-xs">{shift.counter.name}</p>
              </div>
            </div>

            {/* Shift summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Started</span>
                <span>{new Date(shift.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Bills</span>
                <span>{Number(shift.totalBills)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total Sales</span>
                <span className="font-semibold text-gray-800">Rs.{Number(shift.totalSales).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Cash Sales</span>
                <span>Rs.{Number(shift.totalCash).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>UPI Sales</span>
                <span>Rs.{Number(shift.totalUpi).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Card Sales</span>
                <span>Rs.{Number(shift.totalCard).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between text-gray-600">
                <span>Expected Cash</span>
                <span className="font-medium">
                  Rs.{(Number(shift.openingCash) + Number(shift.totalCash)).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">
                  Closing Cash Count (Rs.)
                </label>
                <input
                  type="number" autoFocus
                  value={closingCashInput}
                  onChange={(e) => setClosingCashInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && closeCurrentShift()}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-red-400"
                />
                {closingCashInput && !isNaN(parseFloat(closingCashInput)) && (() => {
                  const diff = parseFloat(closingCashInput) - (Number(shift.openingCash) + Number(shift.totalCash));
                  return (
                    <p className={`text-xs mt-1 font-medium ${Math.abs(diff) < 0.01 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      Variance: {diff >= 0 ? '+' : ''}Rs.{diff.toFixed(2)}
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Notes (optional)</label>
                <input
                  type="text"
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  placeholder="Any remarks..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCloseShift(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium border border-gray-200">
                  Cancel
                </button>
                <button
                  onClick={closeCurrentShift}
                  disabled={closingShift || !closingCashInput || isNaN(parseFloat(closingCashInput))}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                  {closingShift && <Loader2 className="w-4 h-4 animate-spin" />}
                  {closingShift ? 'Closing...' : 'Close Shift'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Close Store Modal (single cashier mode: closes shift + day) */}
      {showCloseStore && shift && (
        <Modal onClose={() => setShowCloseStore(false)}>
          <div className="w-80">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-gray-900 font-semibold">Close Store</h2>
                <p className="text-gray-500 text-xs">{shift.counter.name} — closes shift and day</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Started</span>
                <span>{new Date(shift.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Bills</span>
                <span>{Number(shift.totalBills)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Total Sales</span>
                <span className="font-semibold text-gray-800">Rs.{Number(shift.totalSales).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Cash Sales</span>
                <span>Rs.{Number(shift.totalCash).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between text-gray-600">
                <span>Expected in Drawer</span>
                <span className="font-medium">Rs.{(Number(shift.openingCash) + Number(shift.totalCash)).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Actual Cash Count (Rs.)</label>
                <input
                  type="number" autoFocus
                  value={closingCashInput}
                  onChange={(e) => setClosingCashInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && closeStore()}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-red-400"
                />
                {closingCashInput && !isNaN(parseFloat(closingCashInput)) && (() => {
                  const diff = parseFloat(closingCashInput) - (Number(shift.openingCash) + Number(shift.totalCash));
                  return (
                    <p className={`text-xs mt-1 font-medium ${Math.abs(diff) < 0.01 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                      Variance: {diff >= 0 ? '+' : ''}Rs.{diff.toFixed(2)}
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Notes (optional)</label>
                <input
                  type="text"
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  placeholder="Any remarks..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCloseStore(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium border border-gray-200">
                  Cancel
                </button>
                <button
                  onClick={closeStore}
                  disabled={closingStore || !closingCashInput || isNaN(parseFloat(closingCashInput))}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                  {closingStore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {closingStore ? 'Closing...' : 'Close Store'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {!singleCashierMode && showShiftModal && !dayClosed && !dayNotOpened && (
        <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
          <div className="w-80">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-gray-900 font-bold text-xl mb-1">Start Your Shift</h2>
              <p className="text-gray-500 text-sm">Enter opening cash to begin billing.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Counter</label>
                {counters.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No counters found. Ask admin to create a POS counter first.
                  </p>
                ) : (
                  <div className="relative">
                    <select value={selectedCounter} onChange={(e) => setSelectedCounter(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500 appearance-none">
                      {counters.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Opening Cash (Rs.)</label>
                <input
                  type="number" autoFocus
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openShift()}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={openShift}
                disabled={shiftOpening || counters.length === 0}
                className="w-full py-3 bg-[#1B4F8A] hover:bg-[#163d6e] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {shiftOpening && <Loader2 className="w-4 h-4 animate-spin" />}
                {shiftOpening ? 'Opening...' : 'Start Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash payment modal */}
      {showPayModal && (
        <Modal onClose={() => setShowPayModal(false)}>
          <div className="w-72">
            <h2 className="text-gray-900 font-semibold mb-1">Cash Payment</h2>
            <div className="text-green-400 text-3xl font-bold mb-5">{inr(effectiveGrandTotal)}</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Cash Received (Rs.)</label>
                <input autoFocus type="number" value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && pay('CASH')}
                  placeholder={effectiveGrandTotal.toFixed(2)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-800 outline-none focus:border-blue-500"
                />
              </div>
              {parseFloat(cashReceived) >= effectiveGrandTotal && (
                <div className="flex items-center justify-between px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-sm text-green-600">Change</span>
                  <span className="text-xl font-bold text-green-600">{inr(change)}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[effectiveGrandTotal, Math.ceil(effectiveGrandTotal / 10) * 10, Math.ceil(effectiveGrandTotal / 50) * 50, Math.ceil(effectiveGrandTotal / 100) * 100, 500, 1000]
                  .filter((v, i, a) => a.indexOf(v) === i && v >= effectiveGrandTotal)
                  .slice(0, 6)
                  .map((v) => (
                    <button key={v} onClick={() => setCashReceived(String(v))}
                      className={cls('py-2 rounded-lg text-xs font-medium transition-colors border',
                        String(v) === cashReceived
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300')}>
                      Rs.{v}
                    </button>
                  ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowPayModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors border border-gray-200">
                  Cancel
                </button>
                <button disabled={billing || parseFloat(cashReceived) < effectiveGrandTotal}
                  onClick={() => pay('CASH')}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                  {billing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {billing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Credit sale modal */}
      {showCreditModal && (
        <Modal onClose={() => setShowCreditModal(false)}>
          <div className="w-80">
            <h2 className="text-gray-900 font-semibold mb-1">Credit / Khata Sale</h2>
            {customer && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <UserIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-amber-700 font-medium truncate">{customer.name}</span>
                {Number(customer.outstandingBalance) > 0 && (
                  <span className="ml-auto text-red-600 shrink-0">Due: {inr(Number(customer.outstandingBalance))}</span>
                )}
              </div>
            )}
            <div className="text-green-400 text-3xl font-bold mb-4">{inr(effectiveGrandTotal)}</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Paid Now (Rs.) — leave 0 for full credit</label>
                <input
                  autoFocus type="number" min={0} max={effectiveGrandTotal} step={0.01}
                  value={creditPaidNow}
                  onChange={(e) => setCreditPaidNow(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && payCreditSale()}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-800 outline-none focus:border-blue-500"
                />
              </div>
              {parseFloat(creditPaidNow) > 0 && (
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Payment Mode for Partial</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
                      <button key={m} onClick={() => setCreditSubMode(m)}
                        className={cls('py-2 rounded-lg text-xs font-medium border transition-colors',
                          creditSubMode === m
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300')}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-sm text-red-600 font-medium">On Credit</span>
                <span className="text-xl font-bold text-red-600">
                  {inr(Math.max(0, r2(effectiveGrandTotal - (parseFloat(creditPaidNow) || 0))))}
                </span>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreditModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium border border-gray-200">
                  Cancel
                </button>
                <button
                  disabled={billing}
                  onClick={payCreditSale}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                  {billing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {billing ? 'Processing...' : 'Charge on Credit'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Success modal */}
      {showSuccess && lastBill && (
        <Modal>
          <div className="w-80 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-3" />
            <h2 className="text-gray-900 font-bold text-lg mb-1">
              {lastBill.isEstimate ? 'Estimate Saved!' : 'Bill Created!'}
            </h2>
            <p className="text-green-400 text-2xl font-bold mb-1">{lastBill.billNumber}</p>
            <p className="text-gray-500 text-sm mb-2">{inr(lastBill.grandTotal)}</p>
            {lastBill.savings > 0 && (
              <p className="text-amber-400 text-xs mb-4">Customer saved {inr(lastBill.savings)}!</p>
            )}
            {lastBill.isEstimate && lastBill.validityDate && (
              <p className="text-orange-400 text-xs mb-4">
                Valid until {new Date(lastBill.validityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => openPrint(buildThermalHtml(lastBill, bizInfo), 420, 750)}
                className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl font-semibold text-xs transition-colors flex flex-col items-center gap-1">
                <Printer className="w-4 h-4" />Thermal
              </button>
              <button onClick={() => openPrint(buildA4Html(lastBill, bizInfo))}
                className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl font-semibold text-xs transition-colors flex flex-col items-center gap-1">
                <Receipt className="w-4 h-4" />A4
              </button>
              <button
                onClick={() => {
                  const msg = encodeURIComponent(buildWhatsAppMessage(lastBill, bizInfo));
                  const phone = lastBill.customerPhone?.replace(/\D/g, '');
                  const url = phone
                    ? `https://wa.me/91${phone}?text=${msg}`
                    : `https://wa.me/?text=${msg}`;
                  window.open(url, '_blank');
                }}
                className="py-2.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-xl font-semibold text-xs transition-colors flex flex-col items-center gap-1">
                <MessageCircle className="w-4 h-4" />WhatsApp
              </button>
              <button onClick={newBill}
                className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs transition-colors flex flex-col items-center gap-1">
                <Plus className="w-4 h-4" />New Bill
              </button>
            </div>
            {lastBill.billId && !lastBill.isEstimate && (
              <div className="border-t border-gray-200 pt-3">
                {!voidingBill ? (
                  <button
                    onClick={() => setVoidingBill(true)}
                    className="w-full text-xs text-red-600 hover:text-red-400 transition-colors py-1"
                  >
                    Made a mistake? Void this bill
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Void reason (min 10 chars)..."
                      value={voidReason}
                      onChange={e => setVoidReason(e.target.value)}
                      className="w-full bg-white border border-red-300 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-red-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setVoidingBill(false); setVoidReason(''); }}
                        className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs border border-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={voidLastBill}
                        disabled={voidReason.length < 10}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium"
                      >
                        Confirm Void
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Held Bills Modal */}
      {showHoldModal && (
        <Modal onClose={() => setShowHoldModal(false)}>
          <div className="w-[640px] max-w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-gray-900 font-semibold text-lg">Bills on Hold</h2>
                <p className="text-gray-500 text-xs">{heldBills.length} bill{heldBills.length !== 1 ? 's' : ''} waiting</p>
              </div>
              <button onClick={() => setShowHoldModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {oldHeld > 0 && (
              <div className="flex items-center gap-2 mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-600">
                  Warning: {oldHeld} bill{oldHeld !== 1 ? 's' : ''} held over 4 hours. Please review.
                </p>
              </div>
            )}

            {holdLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading...
              </div>
            ) : heldBills.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <PauseCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No bills on hold</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {heldBills.map((held) => (
                  <div key={held.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3">
                    <div className={cls(
                      'w-2.5 h-2.5 rounded-full shrink-0',
                      held.ageStatus === 'FRESH' ? 'bg-green-400' :
                      held.ageStatus === 'AGING' ? 'bg-amber-400' : 'bg-red-400'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 font-mono">{held.holdNumber}</span>
                        <span className="text-xs text-gray-500">{held.billType === 'TAX_INVOICE' ? 'GST' : 'Retail'}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {held.customerName ?? 'Walk-in'} · {held.itemCount} items · {inr(held.grandTotal)}
                      </div>
                      <div className="text-xs text-gray-400">{timeAgo(held.heldAt)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => resumeHeld(held)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors">
                        Resume
                      </button>
                      <button onClick={() => deleteHeld(held)}
                        className="px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 text-xs rounded-lg transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
              <button onClick={holdBill} disabled={cart.length === 0 || holding}
                className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <PauseCircle className="w-4 h-4" />
                Hold Current Cart
              </button>
              <button onClick={() => setShowHoldModal(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Price Override Modal */}
      {priceOverrideItem && (
        <Modal onClose={() => setPriceOverrideItem(null)}>
          <div className="w-72">
            <h2 className="text-gray-900 font-semibold mb-1">Override Price</h2>
            <p className="text-gray-500 text-xs mb-4 truncate">{priceOverrideItem.name}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="text-gray-500">Current Price</div>
                  <div className="text-gray-800 font-semibold mt-0.5">{inr(priceOverrideItem.unitPrice)}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="text-gray-500">MRP (max)</div>
                  <div className="text-gray-800 font-semibold mt-0.5">{inr(priceOverrideItem.mrp)}</div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">New Price</label>
                <input
                  autoFocus type="number" min={0.01} step={0.01}
                  value={priceNewValue}
                  onChange={e => setPriceNewValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyPriceOverride(); }}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 outline-none focus:border-blue-500 text-base"
                />
                {parseFloat(priceNewValue) > priceOverrideItem.mrp && (
                  <p className="text-xs text-red-400 mt-1">Cannot exceed MRP of {inr(priceOverrideItem.mrp)}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Reason <span className="text-gray-400">(optional)</span></label>
                <select
                  value={priceReason}
                  onChange={e => setPriceReason(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 outline-none focus:border-blue-500 text-sm"
                >
                  <option value="">— skip for now —</option>
                  {['Festival/Sale Offer', 'Clearance Sale', 'Damaged/Dented Item', 'Negotiated Price', 'Manager Approval', 'Other'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setPriceOverrideItem(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm border border-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applyPriceOverride}
                  disabled={!priceNewValue || parseFloat(priceNewValue) <= 0 || parseFloat(priceNewValue) > priceOverrideItem.mrp}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* PLU Batch Selection Popup */}
      {showPluPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closePluPopup}>
          <div className={cls(
            'bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden transition-all',
            pluFlash ? 'ring-4 ring-orange-400 ring-offset-2' : 'ring-4 ring-orange-300',
            'animate-pulse-ring',
          )} onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{pluProductName}</h2>
                  <p className="text-sm text-orange-600 font-medium mt-0.5">Multiple batches found — select one to add</p>
                  {pluScanMsg && (
                    <p className="text-xs text-orange-500 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-2">
                      {pluScanMsg}
                    </p>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 rounded-full shrink-0">
                  FIFO Alert
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-3">PLU Code</th>
                    <th className="text-right px-4 py-3">MRP</th>
                    <th className="text-right px-4 py-3">Selling Price</th>
                    <th className="text-right px-4 py-3">Stock</th>
                    <th className="text-left px-4 py-3">Received</th>
                    <th className="text-left px-4 py-3">Batch #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pluOptions.map((plu, idx) => (
                    <tr
                      key={plu.pluCode}
                      onClick={() => selectPlu(plu)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-800 font-medium">{plu.pluCode}</span>
                          {idx === 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                              FIFO - Use First
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right px-4 py-3 text-gray-500">Rs.{plu.mrp.toFixed(2)}</td>
                      <td className="text-right px-4 py-3 font-semibold text-gray-900">Rs.{plu.sellingPrice.toFixed(2)}</td>
                      <td className="text-right px-4 py-3">
                        <span className={cls(
                          'font-medium',
                          plu.stockOnHand <= 5 ? 'text-red-600' : 'text-gray-800',
                        )}>
                          {plu.stockOnHand % 1 === 0 ? plu.stockOnHand : plu.stockOnHand.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {new Date(plu.receivedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{plu.batchNumber ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={closePluPopup}
                className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cls('text-sm font-medium text-gray-700', valueClass)}>{value}</span>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
