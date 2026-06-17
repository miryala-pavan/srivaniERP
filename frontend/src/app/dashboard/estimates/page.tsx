'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  RefreshCw,
  Printer,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useLastUpdated } from '@/hooks/useLastUpdated';
import { RefreshBar } from '@/components/ui/RefreshBar';

interface EstimateItem {
  id: string;
  productName: string;
  qty: number;
  rate: number;
  taxPct: number;
  amount: number;
}

interface Estimate {
  id: string;
  billNumber: string;
  createdAt: string;
  validityDate: string | null;
  estimateStatus: string;
  grandTotal: number;
  customerName: string | null;
  customerPhone: string | null;
  items: EstimateItem[];
}

interface PaginatedEstimates {
  data: Estimate[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  OPEN: {
    label: 'Open',
    className: 'bg-emerald-100 text-emerald-700',
    icon: <Clock className="w-3 h-3" />,
  },
  EXPIRING: {
    label: 'Expiring Soon',
    className: 'bg-amber-100 text-amber-700',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-red-100 text-red-700',
    icon: <Ban className="w-3 h-3" />,
  },
  CONVERTED: {
    label: 'Converted',
    className: 'bg-blue-100 text-blue-700',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-500',
    icon: <XCircle className="w-3 h-3" />,
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function computeDisplayStatus(estimate: Estimate): string {
  if (estimate.estimateStatus !== 'OPEN') return estimate.estimateStatus;
  const days = daysUntil(estimate.validityDate);
  if (days !== null && days <= 1) return 'EXPIRING';
  return 'OPEN';
}

function buildThermalEstimateHtml(est: Estimate): string {
  const itemRows = est.items.map(it => `
    <tr>
      <td style="padding:1px 2px;">${it.productName}</td>
      <td style="padding:1px 2px;text-align:right;">${it.qty}</td>
      <td style="padding:1px 2px;text-align:right;">₹${it.rate.toFixed(2)}</td>
      <td style="padding:1px 2px;text-align:right;">₹${it.amount.toFixed(2)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Estimate ${est.billNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:monospace;font-size:10px;width:80mm;padding:4mm}
    h2{font-size:13px;text-align:center;margin-bottom:2px}
    .sub{font-size:9px;text-align:center;color:#555;margin-bottom:4px}
    .divider{border-top:1px dashed #333;margin:4px 0}
    table{width:100%;border-collapse:collapse}
    th{font-size:8px;text-align:left;border-bottom:1px solid #333;padding:1px 2px}
    td{font-size:9px;vertical-align:top}
    .total-row td{font-weight:bold;border-top:1px solid #333;padding-top:3px}
    .watermark{text-align:center;font-size:18px;color:#ccc;letter-spacing:4px;margin:6px 0}
    @media print{@page{size:80mm auto;margin:0}body{padding:2mm}}
  </style></head><body>
  <h2>SRIVANI STORES</h2>
  <div class="sub">Estimate</div>
  <div class="divider"></div>
  <div style="font-size:9px">
    <div><b>EST No:</b> ${est.billNumber}</div>
    <div><b>Date:</b> ${fmtDate(est.createdAt)}</div>
    ${est.validityDate ? `<div><b>Valid Until:</b> ${fmtDate(est.validityDate)}</div>` : ''}
    ${est.customerName ? `<div><b>Customer:</b> ${est.customerName}</div>` : ''}
    ${est.customerPhone ? `<div><b>Phone:</b> ${est.customerPhone}</div>` : ''}
  </div>
  <div class="divider"></div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead>
    <tbody>${itemRows}</tbody>
    <tbody><tr class="total-row"><td colspan="3">Grand Total</td><td style="text-align:right">₹${est.grandTotal.toFixed(2)}</td></tr></tbody>
  </table>
  <div class="watermark">ESTIMATE</div>
  <div class="divider"></div>
  <div style="text-align:center;font-size:8px;margin-top:4px">This is not a tax invoice. Subject to availability.</div>
  </body></html>`;
}

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const { label: updatedLabel, markUpdated } = useLastUpdated();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQ, setSearchQ] = useState('');
  const [converting, setConverting] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const limit = 15;

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const { data } = await api.get<PaginatedEstimates>('/pos/estimates', { params: { page: p, limit } });
      setEstimates(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
      markUpdated();
    } catch {
      toast.error('Failed to load estimates');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConvert = async (est: Estimate, targetBillType: string) => {
    setConverting(est.id);
    try {
      await api.post(`/pos/estimates/${est.id}/convert`, { targetBillType });
      toast.success(`Converted to ${targetBillType === 'TAX_INVOICE' ? 'Tax Invoice' : 'Retail Invoice'}`);
      load(page);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message || 'Conversion failed');
    } finally {
      setConverting(null);
    }
  };

  const handleCancel = async (est: Estimate) => {
    if (!confirm(`Cancel estimate ${est.billNumber}?`)) return;
    setCancelling(est.id);
    try {
      await api.put(`/pos/estimates/${est.id}/cancel`);
      toast.success('Estimate cancelled');
      load(page);
    } catch {
      toast.error('Failed to cancel estimate');
    } finally {
      setCancelling(null);
    }
  };

  const handlePrint = (est: Estimate) => {
    const html = buildThermalEstimateHtml(est);
    const w = window.open('', '_blank', 'width=420,height=750,toolbar=0,menubar=0,scrollbars=1');
    if (!w) { alert('Popup blocked. Allow popups for this site.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      try { w.print(); } catch {}
      setTimeout(() => { try { w.close(); } catch {} }, 800);
    }, 600);
  };

  const filtered = estimates.filter(est => {
    const displayStatus = computeDisplayStatus(est);
    if (statusFilter !== 'ALL' && displayStatus !== statusFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (
        est.billNumber.toLowerCase().includes(q) ||
        (est.customerName?.toLowerCase().includes(q) ?? false) ||
        (est.customerPhone?.includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Estimates
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total estimates</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshBar label={updatedLabel} loading={loading} onRefresh={() => load(1)} />
          <button
            onClick={() => router.push('/dashboard/pos')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            New Estimate
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by number or customer..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {['ALL', 'OPEN', 'EXPIRING', 'EXPIRED', 'CONVERTED', 'CANCELLED'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading estimates...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No estimates found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">EST No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valid Until</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(est => {
                const displayStatus = computeDisplayStatus(est);
                const cfg = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.OPEN;
                const days = daysUntil(est.validityDate);
                const isActive = est.estimateStatus === 'OPEN';
                const busy = converting === est.id || cancelling === est.id;

                return (
                  <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-blue-700">{est.billNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(est.createdAt)}</td>
                    <td className="px-4 py-3">
                      {est.customerName ? (
                        <div>
                          <div className="font-medium text-gray-900">{est.customerName}</div>
                          {est.customerPhone && <div className="text-xs text-gray-500">{est.customerPhone}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Walk-in</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtCurrency(est.grandTotal)}</td>
                    <td className="px-4 py-3">
                      {est.validityDate ? (
                        <div>
                          <div className="text-gray-700">{fmtDate(est.validityDate)}</div>
                          {days !== null && isActive && (
                            <div className={`text-xs ${days <= 0 ? 'text-red-500' : days <= 1 ? 'text-amber-500' : 'text-gray-400'}`}>
                              {days <= 0 ? 'Expired' : `${days}d left`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handlePrint(est)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="Print Estimate"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isActive && (
                          <>
                            <div className="relative group">
                              <button
                                disabled={busy}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                              >
                                {converting === est.id ? 'Converting...' : 'Convert'}
                              </button>
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 hidden group-hover:block">
                                <button
                                  onClick={() => handleConvert(est, 'TAX_INVOICE')}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded-t-lg"
                                >
                                  → Tax Invoice
                                </button>
                                <button
                                  onClick={() => handleConvert(est, 'RETAIL_INVOICE')}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded-b-lg"
                                >
                                  → Retail Invoice
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => handleCancel(est)}
                              disabled={busy}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                              title="Cancel Estimate"
                            >
                              {cancelling === est.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {totalPages} · {total} estimates</span>
          <div className="flex gap-2">
            <button
              onClick={() => { const p = page - 1; setPage(p); load(p); }}
              disabled={page <= 1}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => { const p = page + 1; setPage(p); load(p); }}
              disabled={page >= totalPages}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
