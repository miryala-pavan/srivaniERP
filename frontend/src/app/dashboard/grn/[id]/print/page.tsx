'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrintItem {
  id: string;
  productId: string;
  productName: string;
  hsnCode?: string | null;
  unitOfMeasure: string;
  casesReceived?: number;
  looseQty?: number;
  freeCases?: number;
  freeLoose?: number;
  totalFreeQty?: number;
  totalReceivedQty?: number;
  totalQty?: number;
  basicCostPrice?: number;
  disc1Percent?: number;
  disc2Percent?: number;
  netCostPrice?: number;
  mrp?: number | null;
  sellingPrice?: number | null;
  gstRatePercent: number;
  cessRate?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  cessAmount?: number;
  totalAmount?: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  rejectedQty?: number;
  acceptedQty?: number;
  product?: { name: string; hsnCode?: string | null; productCode?: string | null };
  tax?: { taxRate: number; taxName: string };
}

interface PrintGrn {
  id: string;
  grnNumber: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  receivedDate?: string | null;
  taxType: string;
  itcEligibility: string;
  isInterState: boolean;
  placeOfSupply?: string | null;
  supplierName: string;
  supplierGstin?: string | null;
  status: string;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectedByName?: string | null;
  taxableAmount: number | string;
  totalTaxAmount: number | string;
  cgstTotal: number | string;
  sgstTotal: number | string;
  igstTotal: number | string;
  cessTotal: number | string;
  billDiscountPercent: number | string;
  billDiscountAmount: number | string;
  freightCharges: number | string;
  hamaliCharges: number | string;
  otherCharges: number | string;
  roundingAmount: number | string;
  grandTotal: number | string;
  invoiceControlTotal?: number | string | null;
  items: PrintItem[];
  supplier?: {
    name: string; gstin?: string | null; phone?: string | null;
    address?: string | null; stateCode?: string | null;
  };
  branch?: { name: string };
}

interface Business {
  name: string;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
  stateName?: string | null;
  stateCode?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (v: number | string | null | undefined) => Number(v ?? 0);
const inr = (v: number | string | null | undefined) => n(v).toFixed(2);
const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function gstSummary(items: PrintItem[], isInterState: boolean) {
  const map = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; cess: number }>();
  for (const item of items) {
    const rate = n(item.gstRatePercent);
    if (!map.has(rate)) map.set(rate, { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 });
    const row = map.get(rate)!;
    row.taxable += n(item.taxableAmount);
    row.cess    += n(item.cessAmount);
    if (isInterState) {
      row.igst += n(item.igstAmount);
    } else {
      row.cgst += n(item.cgstAmount);
      row.sgst += n(item.sgstAmount);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => ({ rate, ...v }));
}

// ─── Print Page ───────────────────────────────────────────────────────────────

export default function GrnPrintPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [grn, setGrn]       = useState<PrintGrn | null>(null);
  const [biz, setBiz]       = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!id) return;
    api.get(`/grn/${id}/print-data`)
      .then((res) => {
        setGrn(res.data.purchase);
        setBiz(res.data.business);
      })
      .catch(() => setError('Failed to load GRN data.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading…
      </div>
    );
  }

  if (error || !grn) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        {error || 'GRN not found.'}
      </div>
    );
  }

  const isInterState = grn.isInterState;
  const summary = gstSummary(grn.items, isInterState);

  const totTaxable = summary.reduce((s, r) => s + r.taxable, 0);
  const totCgst    = summary.reduce((s, r) => s + r.cgst, 0);
  const totSgst    = summary.reduce((s, r) => s + r.sgst, 0);
  const totIgst    = summary.reduce((s, r) => s + r.igst, 0);
  const totCess    = summary.reduce((s, r) => s + r.cess, 0);

  const gt  = n(grn.grandTotal);
  const ict = n(grn.invoiceControlTotal ?? 0);
  const diff = ict > 0 ? gt - ict : null;

  const supplier = grn.supplier;

  return (
    <>
      {/* Print controls — hidden in actual print */}
      <div className="no-print fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="text-sm font-medium text-gray-700">
          GRN Print — {grn.grnNumber ?? 'Draft'} &nbsp;|&nbsp; {grn.supplierName}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.close()}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={() => window.print()}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e]"
          >
            Print A4
          </button>
        </div>
      </div>

      {/* A4 document */}
      <div className="print-body">

        {/* ── HEADER ── */}
        <div className="header-row">
          <div className="biz-block">
            <div className="biz-name">{biz?.name ?? 'Srivani Stores'}</div>
            {biz?.address && <div className="biz-addr">{biz.address}</div>}
            {biz?.phone && <div className="biz-meta">Phone: {biz.phone}</div>}
            {biz?.gstin && <div className="biz-meta">GSTIN: {biz.gstin}</div>}
            {biz?.stateName && <div className="biz-meta">State: {biz.stateName}</div>}
          </div>
          <div className="doc-block">
            <div className="doc-title">GOODS RECEIPT NOTE</div>
            <table className="doc-info-table">
              <tbody>
                <tr><td>GRN #:</td><td><strong>{grn.grnNumber ?? 'DRAFT'}</strong></td></tr>
                <tr><td>GRN Date:</td><td>{fmtDate(grn.receivedDate ?? grn.invoiceDate)}</td></tr>
                <tr><td>Status:</td><td><strong>{grn.status.replace('_', ' ')}</strong></td></tr>
                {grn.branch && <tr><td>Branch:</td><td>{grn.branch.name}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <hr className="divider" />

        {/* ── SUPPLIER + INVOICE DETAILS ── */}
        <div className="two-col">
          <div className="info-box">
            <div className="section-label">Supplier Details</div>
            <table className="info-table">
              <tbody>
                <tr><td>Name:</td><td><strong>{supplier?.name ?? grn.supplierName}</strong></td></tr>
                {supplier?.address && <tr><td>Address:</td><td>{supplier.address}</td></tr>}
                {supplier?.gstin && <tr><td>GSTIN:</td><td>{supplier.gstin}</td></tr>}
                {supplier?.phone && <tr><td>Phone:</td><td>{supplier.phone}</td></tr>}
                {supplier?.stateCode && <tr><td>State Code:</td><td>{supplier.stateCode}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="info-box">
            <div className="section-label">Invoice Details</div>
            <table className="info-table">
              <tbody>
                <tr><td>Invoice #:</td><td><strong>{grn.invoiceNumber}</strong></td></tr>
                <tr><td>Invoice Date:</td><td>{fmtDate(grn.invoiceDate)}</td></tr>
                <tr><td>Received Date:</td><td>{fmtDate(grn.receivedDate)}</td></tr>
                <tr><td>Tax Type:</td><td>{(grn.taxType ?? 'TAX_EXCLUSIVE').replace('_', ' ')}</td></tr>
                <tr><td>ITC Eligibility:</td><td>{grn.itcEligibility ?? 'ELIGIBLE'}</td></tr>
                <tr><td>Transaction Type:</td><td>{isInterState ? 'INTERSTATE' : 'INTRASTATE'}</td></tr>
                {grn.placeOfSupply && <tr><td>Place of Supply:</td><td>{grn.placeOfSupply}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <hr className="divider" />

        {/* ── ITEMS TABLE ── */}
        <div className="section-label" style={{ marginBottom: 6 }}>Items</div>
        <table className="items-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>HSN</th>
              <th>UOM</th>
              <th>Cases</th>
              <th>Loose</th>
              <th>Free</th>
              <th>Rcvd Qty</th>
              <th>Basic CP</th>
              <th>Disc1%</th>
              <th>Disc2%</th>
              <th>Net CP</th>
              <th>MRP</th>
              <th>Sell</th>
              <th>GST%</th>
              <th>Taxable</th>
              {isInterState ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}
              {summary.some(r => r.cess > 0) && <th>CESS</th>}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {grn.items.map((item, i) => {
              const hasCess = summary.some(r => r.cess > 0);
              return (
                <tr key={item.id ?? i} className={i % 2 === 0 ? 'row-white' : 'row-gray'}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>
                    <div>{item.product?.name ?? item.productName}</div>
                    {item.batchNumber && <div className="sub-text">Batch: {item.batchNumber}</div>}
                    {item.expiryDate && <div className="sub-text">Exp: {fmtDate(item.expiryDate)}</div>}
                    {n(item.rejectedQty) > 0 && <div className="sub-text reject-text">Rejected: {n(item.rejectedQty)}</div>}
                  </td>
                  <td>{item.product?.hsnCode ?? item.hsnCode ?? '—'}</td>
                  <td>{item.unitOfMeasure}</td>
                  <td style={{ textAlign: 'right' }}>{n(item.casesReceived)}</td>
                  <td style={{ textAlign: 'right' }}>{n(item.looseQty)}</td>
                  <td style={{ textAlign: 'right' }}>{n(item.totalFreeQty)}</td>
                  <td style={{ textAlign: 'right' }}>{n(item.totalReceivedQty ?? item.totalQty)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(item.basicCostPrice)}</td>
                  <td style={{ textAlign: 'right' }}>{n(item.disc1Percent)}%</td>
                  <td style={{ textAlign: 'right' }}>{n(item.disc2Percent)}%</td>
                  <td style={{ textAlign: 'right' }}>{inr(item.netCostPrice)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(item.mrp)}</td>
                  <td style={{ textAlign: 'right' }}>{item.sellingPrice != null ? inr(item.sellingPrice) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{n(item.gstRatePercent)}%</td>
                  <td style={{ textAlign: 'right' }}>{inr(item.taxableAmount)}</td>
                  {isInterState
                    ? <td style={{ textAlign: 'right' }}>{inr(item.igstAmount)}</td>
                    : <><td style={{ textAlign: 'right' }}>{inr(item.cgstAmount)}</td><td style={{ textAlign: 'right' }}>{inr(item.sgstAmount)}</td></>}
                  {hasCess && <td style={{ textAlign: 'right' }}>{inr(item.cessAmount)}</td>}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(item.totalAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── TOTALS + GST SUMMARY ── */}
        <div className="two-col" style={{ marginTop: 16, alignItems: 'flex-start' }}>

          {/* GST Summary */}
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>GST Summary</div>
            <table className="gst-table">
              <thead>
                <tr>
                  <th>Tax Rate</th>
                  <th>Taxable</th>
                  {isInterState ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}
                  {totCess > 0 && <th>CESS</th>}
                  <th>Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.rate}>
                    <td>{row.rate}%</td>
                    <td style={{ textAlign: 'right' }}>{inr(row.taxable)}</td>
                    {isInterState
                      ? <td style={{ textAlign: 'right' }}>{inr(row.igst)}</td>
                      : <><td style={{ textAlign: 'right' }}>{inr(row.cgst)}</td><td style={{ textAlign: 'right' }}>{inr(row.sgst)}</td></>}
                    {totCess > 0 && <td style={{ textAlign: 'right' }}>{inr(row.cess)}</td>}
                    <td style={{ textAlign: 'right' }}>{inr(isInterState ? row.igst : row.cgst + row.sgst)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{inr(totTaxable)}</td>
                  {isInterState
                    ? <td style={{ textAlign: 'right' }}>{inr(totIgst)}</td>
                    : <><td style={{ textAlign: 'right' }}>{inr(totCgst)}</td><td style={{ textAlign: 'right' }}>{inr(totSgst)}</td></>}
                  {totCess > 0 && <td style={{ textAlign: 'right' }}>{inr(totCess)}</td>}
                  <td style={{ textAlign: 'right' }}>{inr(isInterState ? totIgst : totCgst + totSgst)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ marginLeft: 'auto' }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Totals</div>
            <table className="totals-table">
              <tbody>
                <tr><td>Subtotal</td><td>Rs.{inr(grn.taxableAmount)}</td></tr>
                {n(grn.billDiscountAmount) > 0 && (
                  <tr><td>Bill Discount ({n(grn.billDiscountPercent)}%)</td><td>- Rs.{inr(grn.billDiscountAmount)}</td></tr>
                )}
                {!isInterState && n(grn.cgstTotal) > 0 && (
                  <tr><td>CGST</td><td>Rs.{inr(grn.cgstTotal)}</td></tr>
                )}
                {!isInterState && n(grn.sgstTotal) > 0 && (
                  <tr><td>SGST</td><td>Rs.{inr(grn.sgstTotal)}</td></tr>
                )}
                {isInterState && n(grn.igstTotal) > 0 && (
                  <tr><td>IGST</td><td>Rs.{inr(grn.igstTotal)}</td></tr>
                )}
                {n(grn.cessTotal) > 0 && (
                  <tr><td>CESS</td><td>Rs.{inr(grn.cessTotal)}</td></tr>
                )}
                {n(grn.freightCharges) > 0 && (
                  <tr><td>Freight</td><td>Rs.{inr(grn.freightCharges)}</td></tr>
                )}
                {n(grn.hamaliCharges) > 0 && (
                  <tr><td>Hamali</td><td>Rs.{inr(grn.hamaliCharges)}</td></tr>
                )}
                {n(grn.otherCharges) > 0 && (
                  <tr><td>Other Charges</td><td>Rs.{inr(grn.otherCharges)}</td></tr>
                )}
                {n(grn.roundingAmount) !== 0 && (
                  <tr><td>Rounding</td><td>{n(grn.roundingAmount) > 0 ? '+' : ''}Rs.{inr(grn.roundingAmount)}</td></tr>
                )}
                <tr className="grand-total-row">
                  <td>Grand Total</td>
                  <td>Rs.{inr(grn.grandTotal)}</td>
                </tr>
                {ict > 0 && (
                  <>
                    <tr><td>Invoice Control Total</td><td>Rs.{inr(ict)}</td></tr>
                    <tr className={diff !== null && Math.abs(diff) > 5 ? 'diff-row' : ''}>
                      <td>Difference</td>
                      <td>{diff !== null ? (diff >= 0 ? '+' : '') + 'Rs.' + inr(diff) : '—'}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <hr className="divider" style={{ marginTop: 20 }} />

        {/* ── FOOTER ── */}
        <div className="two-col footer-section">
          <div>
            <div className="sig-line">Received by: ________________________</div>
            <div className="sig-line">Date: ________________________</div>
            <div className="sig-line">Signature: ________________________</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {grn.approvedByName && (
              <div className="sig-line">Approved by: <strong>{grn.approvedByName}</strong></div>
            )}
            {grn.approvedAt && (
              <div className="sig-line">Approved on: {fmtDate(grn.approvedAt)}</div>
            )}
            <div className="sig-line" style={{ color: '#888', marginTop: 8 }}>System: Srivani Stores ERP</div>
          </div>
        </div>

      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #f5f5f5; font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; }

        .no-print { }

        .print-body {
          background: #fff;
          width: 210mm;
          min-height: 297mm;
          margin: 80px auto 40px;
          padding: 15mm;
          box-shadow: 0 0 20px rgba(0,0,0,0.15);
        }

        /* ── Header ── */
        .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .biz-block { flex: 1; }
        .biz-name { font-size: 16pt; font-weight: 700; color: #1B4F8A; margin-bottom: 4px; }
        .biz-addr { font-size: 9pt; color: #555; margin-bottom: 2px; }
        .biz-meta { font-size: 8.5pt; color: #555; margin-bottom: 1px; }
        .doc-block { text-align: right; min-width: 200px; }
        .doc-title { font-size: 14pt; font-weight: 700; color: #1B4F8A; margin-bottom: 6px; }
        .doc-info-table { margin-left: auto; font-size: 8.5pt; border-collapse: collapse; }
        .doc-info-table td { padding: 1px 4px; }
        .doc-info-table td:first-child { color: #888; text-align: right; }
        .doc-info-table td:last-child { font-weight: 500; text-align: left; padding-left: 8px; }

        /* ── Divider ── */
        .divider { border: none; border-top: 1.5px solid #1B4F8A; margin: 10px 0; }

        /* ── Two column ── */
        .two-col { display: flex; gap: 16px; }
        .info-box { flex: 1; }
        .section-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; color: #1B4F8A; letter-spacing: 0.5px; margin-bottom: 4px; }
        .info-table { font-size: 8.5pt; border-collapse: collapse; width: 100%; }
        .info-table td { padding: 2px 4px; vertical-align: top; }
        .info-table td:first-child { color: #888; width: 100px; }

        /* ── Items table ── */
        .items-table { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 8px; }
        .items-table th {
          background: #1B4F8A; color: #fff; font-weight: 600;
          padding: 4px 3px; text-align: right; white-space: nowrap;
        }
        .items-table th:first-child,
        .items-table th:nth-child(2) { text-align: left; }
        .items-table td { padding: 3px; vertical-align: top; border-bottom: 1px solid #eee; }
        .row-white { background: #fff; }
        .row-gray { background: #f8f9fa; }
        .sub-text { font-size: 7pt; color: #888; }
        .reject-text { color: #c00; }

        /* ── GST summary ── */
        .gst-table { border-collapse: collapse; font-size: 8pt; min-width: 280px; }
        .gst-table th { background: #e8eef6; color: #1B4F8A; font-weight: 600; padding: 3px 6px; text-align: right; }
        .gst-table th:first-child { text-align: left; }
        .gst-table td { padding: 3px 6px; border-bottom: 1px solid #eee; }
        .gst-table .total-row { background: #e8eef6; font-weight: 700; }

        /* ── Totals ── */
        .totals-table { border-collapse: collapse; font-size: 8.5pt; min-width: 220px; }
        .totals-table td { padding: 3px 8px; }
        .totals-table td:first-child { color: #555; text-align: right; }
        .totals-table td:last-child { text-align: right; font-weight: 500; min-width: 80px; }
        .grand-total-row td { font-size: 11pt; font-weight: 700; border-top: 2px solid #1B4F8A; border-bottom: 2px solid #1B4F8A; padding: 5px 8px; color: #1B4F8A; }
        .diff-row td { color: #c05000; font-weight: 600; }

        /* ── Footer ── */
        .footer-section { margin-top: 16px; align-items: flex-end; }
        .sig-line { font-size: 8.5pt; margin-bottom: 10px; color: #444; }

        /* ── Print media ── */
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #fff; }
          .no-print { display: none !important; }
          .print-body {
            margin: 0;
            padding: 15mm;
            box-shadow: none;
            width: 100%;
            min-height: unset;
          }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </>
  );
}
