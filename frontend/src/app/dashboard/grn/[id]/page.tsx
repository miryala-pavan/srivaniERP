'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Printer, CheckCircle2, XCircle, RotateCcw, ArrowLeft } from 'lucide-react';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type GrnStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface GrnDetail {
  id: string;
  grnNumber: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  status: GrnStatus;
  taxType: string;
  supplierName: string;
  supplierGstin?: string | null;
  branchId: string;
  taxableAmount: number | string;
  totalTaxAmount: number | string;
  cgstTotal?: number | string;
  sgstTotal?: number | string;
  igstTotal?: number | string;
  cessTotal?: number | string;
  grandTotal: number | string;
  billDiscountAmount?: number | string;
  billDiscountPercent?: number | string;
  freightCharges?: number | string;
  hamaliCharges?: number | string;
  otherCharges?: number | string;
  roundingAmount?: number | string;
  advanceAdjusted?: number | string;
  amountPayable?: number | string;
  paymentMode?: string | null;
  paymentDueDate?: string | null;
  notes?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectedByName?: string | null;
  createdAt: string;
  supplier: { id: string; name: string; phone?: string | null; gstin?: string | null };
  branch: { id: string; name: string };
  items: {
    id: string;
    productName: string;
    productCode?: string | null;
    hsnCode?: string | null;
    basicCostPrice?: number | string;
    disc1Percent?: number | string;
    disc2Percent?: number | string;
    disc3Percent?: number | string;
    netCostPrice?: number | string;
    unitPrice: number | string;
    casesReceived?: number | string;
    looseQty?: number | string;
    packSize?: number | string;
    freeCases?: number | string;
    freeLoose?: number | string;
    totalReceivedQty?: number | string;
    quantity: number | string;
    rejectedQty?: number | string;
    gstRatePercent: number | string;
    cgstAmount: number | string;
    sgstAmount: number | string;
    igstAmount?: number | string;
    cessAmount?: number | string;
    taxableAmount: number | string;
    lineTotal?: number | string;
    totalAmount: number | string;
    mrp?: number | string | null;
    sellingPrice?: number | string | null;
    batchNumber?: string | null;
    expiryDate?: string | null;
    product: { unitOfMeasure: string };
  }[];
}

const STATUS_BADGE: Record<GrnStatus, { label: string; color: string }> = {
  DRAFT:            { label: 'Draft',            color: 'bg-gray-100 text-gray-600'   },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700' },
  APPROVED:         { label: 'Approved',         color: 'bg-green-100 text-green-700' },
  REJECTED:         { label: 'Rejected',         color: 'bg-red-100 text-red-600'     },
  CANCELLED:        { label: 'Cancelled',        color: 'bg-gray-100 text-gray-500'   },
};

const fmt = (v: number | string | null | undefined, dec = 2) =>
  v == null ? '—' : new Intl.NumberFormat('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Number(v));

const n = (v: number | string | null | undefined) => Number(v ?? 0);

export default function GrnViewPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const autoPrint = searchParams.get('print') === '1';

  const [grn, setGrn]           = useState<GrnDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen]       = useState(false);
  const [rejectReason, setRejectReason]   = useState('');
  const printTriggered = useRef(false);

  useEffect(() => {
    api.get(`/grn/${id}`)
      .then((r) => setGrn(r.data))
      .catch(() => { toast.error('GRN not found'); router.push('/dashboard/grn'); })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (grn && autoPrint && !printTriggered.current) {
      printTriggered.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [grn, autoPrint]);

  async function handleApprove() {
    if (!confirm('Approve this GRN and update stock?')) return;
    setActionLoading('approve');
    try {
      await api.post(`/grn/${id}/approve`, {});
      toast.success('GRN approved — stock updated');
      const r = await api.get(`/grn/${id}`);
      setGrn(r.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Enter rejection reason'); return; }
    setActionLoading('reject');
    try {
      await api.post(`/grn/${id}/reject`, { reason: rejectReason });
      toast.success('GRN rejected');
      setRejectOpen(false);
      setRejectReason('');
      const r = await api.get(`/grn/${id}`);
      setGrn(r.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevert() {
    if (!confirm('Revert this GRN to Draft for re-editing?')) return;
    setActionLoading('revert');
    try {
      await api.post(`/grn/${id}/revert`, {});
      toast.success('GRN reverted to Draft');
      router.push(`/dashboard/grn/v2?id=${id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Revert failed');
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!grn) return null;

  const badge = STATUS_BADGE[grn.status] ?? STATUS_BADGE.DRAFT;
  const isInterState = n(grn.igstTotal) > 0;

  return (
    <>
      <div className="min-h-screen bg-gray-50 print:bg-white">

        {/* Top bar — hidden on print */}
        <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => router.push('/dashboard/grn')}
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> GRN List
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Breadcrumbs items={[
                { label: 'GRN', href: '/dashboard/grn' },
                { label: grn.grnNumber ?? 'Draft GRN' },
              ]} />
              {/* GRN Number — large and prominent so it can be noted */}
              {grn.grnNumber && (
                <span className="font-mono font-bold text-base text-[#1B4F8A] bg-blue-50 border border-blue-200 px-3 py-0.5 rounded-lg tracking-wide select-all">
                  {grn.grnNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {grn.supplier.name} &middot; Invoice {grn.invoiceNumber} &middot; {grn.branch.name}
            </p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge.color}`}>
            {badge.label}
          </span>

          {/* Action buttons */}
          {grn.status === 'PENDING_APPROVAL' && (
            <>
              {rejectOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason…"
                    autoFocus
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-400 w-52"
                  />
                  <button
                    onClick={() => { setRejectOpen(false); setRejectReason(''); }}
                    className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!!actionLoading}
                    className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                  >
                    {actionLoading === 'reject' ? 'Rejecting…' : 'Confirm'}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setRejectOpen(true)}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {actionLoading === 'approve' ? 'Approving…' : 'Approve'}
                  </button>
                </>
              )}
            </>
          )}

          {grn.status === 'REJECTED' && (
            <button
              onClick={handleRevert}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 text-sm px-4 py-2 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-60 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {actionLoading === 'revert' ? 'Reverting…' : 'Revert to Draft'}
            </button>
          )}

          {grn.status === 'APPROVED' && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-sm px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          )}
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto p-6 space-y-6">

          {/* Header card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">GRN Number</p>
                <p className="font-mono font-semibold text-gray-800">{grn.grnNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Invoice No.</p>
                <p className="font-semibold text-gray-800">{grn.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Invoice Date</p>
                <p className="text-gray-700">{new Date(grn.invoiceDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Branch</p>
                <p className="text-gray-700">{grn.branch.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Supplier</p>
                <p className="font-semibold text-gray-800">{grn.supplier.name}</p>
                {grn.supplier.gstin && (
                  <p className="text-xs text-gray-400 font-mono">{grn.supplier.gstin}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Tax Type</p>
                <p className="text-gray-700">{grn.taxType === 'TAX_INCLUSIVE' ? 'Tax Inclusive' : 'Tax Exclusive'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Created</p>
                <p className="text-gray-700">{new Date(grn.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
              {grn.approvedByName && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Approved By</p>
                  <p className="text-gray-700">{grn.approvedByName}</p>
                </div>
              )}
              {grn.rejectedByName && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Rejected By</p>
                  <p className="text-red-600">{grn.rejectedByName}</p>
                </div>
              )}
              {grn.notes && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                  <p className="text-gray-700">{grn.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Items ({grn.items.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">#</th>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-500">Product</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500">Basic Cost</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500">Net Cost</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500">Recv Qty</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500">GST%</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-500">Taxable</th>
                    {isInterState
                      ? <th className="text-right px-3 py-2.5 font-medium text-gray-500">IGST</th>
                      : <>
                          <th className="text-right px-3 py-2.5 font-medium text-gray-500">CGST</th>
                          <th className="text-right px-3 py-2.5 font-medium text-gray-500">SGST</th>
                        </>
                    }
                    <th className="text-right px-4 py-2.5 font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grn.items.map((item, idx) => {
                    const received = n(item.totalReceivedQty ?? item.quantity);
                    const free = n(item.freeCases) * n(item.packSize) + n(item.freeLoose);
                    const netCost = n(item.netCostPrice ?? item.unitPrice);
                    const lineTotal = n(item.lineTotal ?? item.totalAmount);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800">{item.productName}</p>
                          <p className="text-gray-400">
                            {item.product.unitOfMeasure}
                            {item.hsnCode ? ` · HSN ${item.hsnCode}` : ''}
                            {item.batchNumber ? ` · Batch ${item.batchNumber}` : ''}
                            {item.expiryDate ? ` · Exp ${new Date(item.expiryDate).toLocaleDateString('en-IN')}` : ''}
                            {free > 0 ? ` · Free: ${free}` : ''}
                            {n(item.rejectedQty) > 0 ? ` · Rej: ${item.rejectedQty}` : ''}
                          </p>
                          {(n(item.disc1Percent) > 0 || n(item.disc2Percent) > 0 || n(item.disc3Percent) > 0) && (
                            <p className="text-gray-400">
                              Disc: {n(item.disc1Percent)}% + {n(item.disc2Percent)}% + {n(item.disc3Percent)}%
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">
                          {n(item.basicCostPrice) > 0 ? fmt(item.basicCostPrice) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                          {fmt(netCost)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-700">
                          {received}
                          {item.casesReceived && n(item.casesReceived) > 0
                            ? <span className="text-gray-400 block">{n(item.casesReceived)}cs × {n(item.packSize)}</span>
                            : null}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600">{n(item.gstRatePercent)}%</td>
                        <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.taxableAmount)}</td>
                        {isInterState ? (
                          <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.igstAmount)}</td>
                        ) : (
                          <>
                            <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.cgstAmount)}</td>
                            <td className="px-3 py-2.5 text-right text-gray-700">{fmt(item.sgstAmount)}</td>
                          </>
                        )}
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmt(lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="max-w-xs ml-auto space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Taxable Amount</span>
                <span>Rs.{fmt(grn.taxableAmount)}</span>
              </div>
              {isInterState ? (
                <div className="flex justify-between text-gray-600">
                  <span>IGST</span>
                  <span>Rs.{fmt(grn.igstTotal)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>CGST</span>
                    <span>Rs.{fmt(grn.cgstTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>SGST</span>
                    <span>Rs.{fmt(grn.sgstTotal)}</span>
                  </div>
                </>
              )}
              {n(grn.cessTotal) > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>CESS</span>
                  <span>Rs.{fmt(grn.cessTotal)}</span>
                </div>
              )}
              {n(grn.billDiscountAmount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Bill Discount ({n(grn.billDiscountPercent)}%)</span>
                  <span>-Rs.{fmt(grn.billDiscountAmount)}</span>
                </div>
              )}
              {n(grn.freightCharges) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Freight</span>
                  <span>Rs.{fmt(grn.freightCharges)}</span>
                </div>
              )}
              {n(grn.hamaliCharges) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Hamali</span>
                  <span>Rs.{fmt(grn.hamaliCharges)}</span>
                </div>
              )}
              {n(grn.otherCharges) > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Other Charges</span>
                  <span>Rs.{fmt(grn.otherCharges)}</span>
                </div>
              )}
              {n(grn.roundingAmount) !== 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Rounding</span>
                  <span>{n(grn.roundingAmount) >= 0 ? '+' : ''}Rs.{fmt(grn.roundingAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-800 text-base pt-2 border-t border-gray-200">
                <span>Grand Total</span>
                <span>Rs.{fmt(grn.grandTotal)}</span>
              </div>
              {n(grn.advanceAdjusted) > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Advance Adjusted</span>
                  <span>-Rs.{fmt(grn.advanceAdjusted)}</span>
                </div>
              )}
              {grn.amountPayable != null && n(grn.advanceAdjusted) > 0 && (
                <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-100">
                  <span>Amount Payable</span>
                  <span>Rs.{fmt(grn.amountPayable)}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
