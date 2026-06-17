'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Printer, Receipt, RefreshCw, Calendar,
  Phone, User, Hash, X, AlertCircle, Ban, RotateCcw,
  Check, ChevronRight, ChevronLeft, Minus, Plus,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { buildThermalHtml, buildA4Html, openPrint, fullBillToReceipt } from '@/lib/pos-print';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useEscapeKey } from '@/hooks/useEscapeKey';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchMode = 'billNumber' | 'date' | 'phone' | 'customerName';

interface BillItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  gstRatePercent: number;
  cgstAmount?: number;
  sgstAmount?: number;
  totalAmount: number;
  unitOfMeasure?: string;
  product?: { isReturnable: boolean; returnPeriodDays: number };
}

interface BillResult {
  id: string;
  billNumber: string | null;
  billDate: string;
  billType: string;
  customerName: string | null;
  customerPhone: string | null;
  grandTotal: number;
  itemCount: number;
  counterName: string;
  cashierName: string;
  paymentMode: string;
  isVoided: boolean;
  voidedAt?: string;
  voidReason?: string;
  createdById: string | null;
  shiftId: string | null;
  isB2B?: boolean;
}

interface FullBill {
  bill: {
    id: string;
    billNumber: string | null;
    billType: string;
    billDate: string;
    isVoided: boolean;
    voidedAt?: string;
    voidReason?: string;
    isB2B: boolean;
    customerName: string | null;
    customerPhone: string | null;
    customerGstin: string | null;
    grandTotal: number | string;
    subtotalAmount?: number | string;
    discountAmount?: number | string;
    taxableAmount?: number | string;
    cgstTotal?: number | string;
    sgstTotal?: number | string;
    paymentMode: string;
    cashAmount?: number | string | null;
    upiAmount?: number | string | null;
    cardAmount?: number | string | null;
    cashReceived?: number | string | null;
    changeAmount?: number | string | null;
    createdAt: string;
    items: BillItem[];
    posCounter?: { name: string };
    posShift?: { cashier?: { fullName: string } };
    createdBy?: { fullName: string };
    customer?: { name: string; phone?: string; gstin?: string } | null;
  };
  business: {
    name: string; address?: string; phone?: string; gstin?: string;
  };
}

type CnStep = 'items' | 'reason' | 'refund' | 'confirm';
interface CnItemState { selected: boolean; quantity: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToday(dateStr: string) {
  const d = new Date(dateStr), t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const fmtRs = (n: number | string | null | undefined) => `Rs.${Number(n ?? 0).toFixed(2)}`;

const MODES: { id: SearchMode; label: string; icon: typeof Hash; placeholder: string; inputType: string }[] = [
  { id: 'billNumber',   label: 'Bill Number',   icon: Hash,     placeholder: 'e.g. GST/0025',         inputType: 'text' },
  { id: 'date',         label: 'Date',          icon: Calendar, placeholder: 'Pick a date',            inputType: 'date' },
  { id: 'phone',        label: 'Phone',         icon: Phone,    placeholder: '10-digit mobile number', inputType: 'tel'  },
  { id: 'customerName', label: 'Customer Name', icon: User,     placeholder: 'Customer name',          inputType: 'text' },
];

const MANAGER_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillsPage() {
  const user      = getUser<{ role: string; userId: string; id: string }>();
  const userRole  = user?.role ?? '';
  const userId    = (user as any)?.userId ?? (user as any)?.id ?? '';
  const isManager = MANAGER_ROLES.includes(userRole);

  // Search
  const [mode, setMode]   = useState<SearchMode>('date');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Results + pagination
  const [results, setResults]         = useState<BillResult[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [totalCount, setTotalCount]   = useState(0);
  const [offset, setOffset]           = useState(0);
  const [searched, setSearched]       = useState(false);
  const [todayLabel, setTodayLabel]   = useState(false);

  // Current active search (for infinite scroll)
  const activeSearch = useRef<{ mode: SearchMode; query: string } | null>(null);

  // Sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Preview panel
  const [selectedBillId, setSelectedBillId]   = useState<string | null>(null);
  const [previewData, setPreviewData]         = useState<FullBill | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [printing, setPrinting]               = useState<string | null>(null);

  // Void state
  const [voidBill, setVoidBill]     = useState<BillResult | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Credit note state
  const [cnBill, setCnBill]             = useState<BillResult | null>(null);
  const [cnFullItems, setCnFullItems]   = useState<BillItem[]>([]);
  const [cnLoadingFull, setCnLoadingFull] = useState(false);
  const [cnStep, setCnStep]             = useState<CnStep>('items');
  const [cnItems, setCnItems]           = useState<Record<string, CnItemState>>({});
  const [cnReason, setCnReason]         = useState('');
  const [cnRefundMode, setCnRefundMode] = useState<'CASH' | 'STORE_CREDIT'>('CASH');
  const [cnSubmitting, setCnSubmitting] = useState(false);

  useEscapeKey(closeVoidModal, !!voidBill);
  useEscapeKey(closeCnModal, !!cnBill && !voidBill);
  useEscapeKey(closePreview, !!selectedBillId && !voidBill && !cnBill);

  // ─── Fetch bills ─────────────────────────────────────────────────────────

  const doFetch = useCallback(async (
    searchMode: SearchMode, searchQuery: string, fetchOffset: number, append: boolean,
  ) => {
    if (append) setLoadingMore(true);
    else { setLoading(true); setResults([]); setOffset(0); setHasMore(false); }
    try {
      const params: Record<string, string | number> = { limit: 20, offset: fetchOffset };
      if (searchQuery) params[searchMode] = searchQuery;
      const { data } = await api.get('/pos/bills/search', { params });
      if (append) {
        setResults(prev => [...prev, ...data.bills]);
      } else {
        setResults(data.bills);
      }
      setHasMore(data.hasMore);
      setTotalCount(data.total);
      setOffset(fetchOffset + data.bills.length);
      setSearched(true);
      activeSearch.current = { mode: searchMode, query: searchQuery };
    } catch {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load today's bills on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setMode('date');
    setQuery(today);
    setTodayLabel(true);
    doFetch('date', today, 0, false);
  }, [doFetch]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore && !loading && activeSearch.current) {
        doFetch(activeSearch.current.mode, activeSearch.current.query, offset, true);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, offset, doFetch]);

  // Live WebSocket — re-run current search when bills are created or voided
  const { connected } = useWebSocket();
  const refetchActive = useCallback(() => {
    if (activeSearch.current) {
      doFetch(activeSearch.current.mode, activeSearch.current.query, 0, false);
    }
  }, [doFetch]);
  useWebSocketEvent('bill.created', refetchActive);
  useWebSocketEvent('bill.voided',  refetchActive);

  const voidMutation = useMutation({
    mutationFn: async ({ billId, reason }: { billId: string; reason: string; billNumber: string | null }) => {
      await api.post(`/pos/bills/${billId}/void`, { reason });
    },
    onSuccess: (_, { billId, reason, billNumber }) => {
      toast.success(`Bill ${billNumber ?? ''} voided`);
      const patch = { isVoided: true, voidReason: reason, voidedAt: new Date().toISOString() };
      setResults(prev => prev.map(b => b.id === billId ? { ...b, ...patch } : b));
      setPreviewData(prev => prev?.bill.id === billId ? { ...prev, bill: { ...prev.bill, ...patch } } : prev);
      closeVoidModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to void bill');
    },
  });

  function handleSearch() {
    if (!query && mode !== 'date') { toast.error('Enter a search term'); return; }
    setTodayLabel(false);
    doFetch(mode, query, 0, false);
  }

  function changeMode(m: SearchMode) {
    setMode(m); setQuery(''); setResults([]); setSearched(false); setTodayLabel(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ─── Preview panel ────────────────────────────────────────────────────────

  async function openPreview(bill: BillResult) {
    if (selectedBillId === bill.id) { setSelectedBillId(null); setPreviewData(null); return; }
    setSelectedBillId(bill.id);
    setPreviewData(null);
    setPreviewLoading(true);
    try {
      const { data } = await api.get<FullBill>(`/pos/bills/${bill.id}/full`);
      setPreviewData(data);
    } catch {
      toast.error('Failed to load bill details');
      setSelectedBillId(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() { setSelectedBillId(null); setPreviewData(null); }

  // ─── Print ───────────────────────────────────────────────────────────────

  async function printBill(billId: string, format: 'THERMAL' | 'A4') {
    if (printing) return;
    setPrinting(billId + format);
    try {
      await api.post(`/pos/bills/${billId}/duplicate-print`);
      const { data } = await api.get<FullBill>(`/pos/bills/${billId}/full`);
      const receipt = fullBillToReceipt(data.bill);
      const html = format === 'THERMAL'
        ? buildThermalHtml(receipt, data.business, true)
        : buildA4Html(receipt, data.business, true);
      openPrint(html, format === 'THERMAL' ? 420 : 820);
    } catch {
      toast.error('Failed to open print');
    } finally {
      setPrinting(null);
    }
  }

  // ─── Void ────────────────────────────────────────────────────────────────

  function canVoid(bill: BillResult | null) {
    if (!bill || bill.isVoided) return false;
    if (!isToday(bill.billDate)) return false;
    if (isManager) return true;
    return bill.createdById === userId;
  }

  function openVoidModal(bill: BillResult) { setVoidBill(bill); setVoidReason(''); }
  function closeVoidModal() { setVoidBill(null); setVoidReason(''); }

  function submitVoid() {
    if (!voidBill) return;
    if (voidReason.trim().length < 10) { toast.error('Reason must be at least 10 characters'); return; }
    voidMutation.mutate({ billId: voidBill.id, reason: voidReason.trim(), billNumber: voidBill.billNumber });
  }

  // ─── Credit Note ─────────────────────────────────────────────────────────

  async function openCnModal(bill: BillResult) {
    setCnBill(bill); setCnStep('items'); setCnReason(''); setCnRefundMode('CASH'); setCnItems({});
    setCnLoadingFull(true);
    try {
      const { data } = await api.get<FullBill>(`/pos/bills/${bill.id}/full`);
      const items = data.bill.items ?? [];
      setCnFullItems(items);
      const init: Record<string, CnItemState> = {};
      items.forEach(it => { init[it.productId] = { selected: false, quantity: 1 }; });
      setCnItems(init);
    } catch {
      toast.error('Failed to load bill items'); closeCnModal();
    } finally {
      setCnLoadingFull(false);
    }
  }

  function closeCnModal() {
    setCnBill(null); setCnFullItems([]); setCnItems({}); setCnStep('items');
    setCnReason(''); setCnRefundMode('CASH');
  }

  function canReturnItem(item: BillItem, billDate: string) {
    if (item.product?.isReturnable === false) return false;
    const period = item.product?.returnPeriodDays ?? 7;
    return (Date.now() - new Date(billDate).getTime()) / 86400000 <= period;
  }

  function cnSelectedItems() { return cnFullItems.filter(it => cnItems[it.productId]?.selected); }

  function cnTotal() {
    return cnSelectedItems().reduce((sum, it) => {
      const qty = cnItems[it.productId]?.quantity ?? 1;
      return sum + (Number(it.totalAmount) / Number(it.quantity)) * qty;
    }, 0);
  }

  function cnItemQtyChange(productId: string, delta: number) {
    setCnItems(prev => {
      const item = cnFullItems.find(i => i.productId === productId);
      if (!item) return prev;
      const max = Number(item.quantity);
      const next = Math.max(1, Math.min(max, (prev[productId]?.quantity ?? 1) + delta));
      return { ...prev, [productId]: { ...prev[productId], quantity: next } };
    });
  }

  function cnToggleItem(productId: string) {
    setCnItems(prev => ({ ...prev, [productId]: { ...prev[productId], selected: !prev[productId]?.selected } }));
  }

  async function submitCreditNote() {
    if (!cnBill) return;
    const selected = cnSelectedItems();
    if (selected.length === 0) { toast.error('Select at least one item'); return; }
    if (cnReason.trim().length < 5) { toast.error('Enter a reason'); return; }
    setCnSubmitting(true);
    try {
      const { data } = await api.post('/pos/credit-notes', {
        originalBillId: cnBill.id,
        reason: cnReason.trim(),
        items: selected.map(it => ({ productId: it.productId, quantity: cnItems[it.productId].quantity, unitPrice: Number(it.unitPrice) })),
        refundMode: cnRefundMode,
      });
      toast.success(`Credit note ${data.creditNoteNumber} created`);
      closeCnModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create credit note');
    } finally {
      setCnSubmitting(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const previewBill = previewData ? results.find(r => r.id === selectedBillId) ?? null : null;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── MAIN CONTENT ── */}
      <div className={`flex-1 overflow-y-auto p-6 transition-all duration-200 ${selectedBillId ? 'opacity-40 pointer-events-none select-none' : ''}`}>

        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Receipt className="w-6 h-6 text-blue-600" />
                Bills
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {todayLabel ? 'Showing today\'s bills' : 'Search and manage bills'}
              </p>
            </div>
            <span className={`text-xs font-medium mt-1 ${connected ? 'text-green-600' : 'text-gray-400'}`}>
              {connected ? '● Live' : '○ Offline'}
            </span>
          </div>

          {/* Search Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 flex-wrap">
              {MODES.map(m => {
                const Icon = m.icon;
                return (
                  <button key={m.id} onClick={() => changeMode(m.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      mode === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{m.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type={MODES.find(m => m.id === mode)?.inputType ?? 'text'}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setTodayLabel(false); }}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder={MODES.find(m => m.id === mode)?.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-8"
                />
                {query && (
                  <button onClick={() => { setQuery(''); setResults([]); setSearched(false); setTodayLabel(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button onClick={handleSearch} disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium min-w-[100px] justify-center">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? 'Loading...' : 'Search'}
              </button>
            </div>
            <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Only finalized bills (Tax Invoice &amp; Retail Invoice) are shown.</span>
            </div>
          </div>

          {/* Results header */}
          {searched && !loading && (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm text-gray-600">
                {totalCount} bill{totalCount !== 1 ? 's' : ''} found
              </span>
              <span className="text-xs text-gray-400">Click a row to view details</span>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-gray-100 flex items-center gap-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-28 flex-1" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && searched && results.length === 0 && (
            <div className="text-center py-20">
              <Search className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <div className="text-gray-500 font-medium">No bills found</div>
              <div className="text-gray-400 text-sm mt-1">Try a different search term or date</div>
            </div>
          )}

          {!loading && !searched && (
            <div className="text-center py-20">
              <Receipt className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <div className="text-gray-400 text-sm">Loading today&apos;s bills...</div>
            </div>
          )}

          {/* Results table */}
          {!loading && results.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Bill #</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Date &amp; Time</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Cashier</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Mode</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="px-3 py-3 font-semibold text-gray-500 uppercase tracking-wide text-xs w-56">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map(bill => (
                    <tr
                      key={bill.id}
                      onClick={() => openPreview(bill)}
                      className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                        bill.isVoided ? 'opacity-50' : ''
                      } ${selectedBillId === bill.id ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-blue-700">{bill.billNumber ?? '--'}</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                            bill.billType === 'TAX_INVOICE' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {bill.billType === 'TAX_INVOICE' ? 'GST' : 'Retail'}
                          </span>
                          {bill.isB2B && <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">B2B</span>}
                          {bill.isVoided && <span className="inline-flex px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-700 font-medium">VOIDED</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{fmtDate(bill.billDate)}</div>
                        <div className="text-xs text-gray-400">{fmtTime(bill.billDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-800">
                        <div>{bill.customerName ?? <span className="text-gray-400 italic text-xs">Walk-in</span>}</div>
                        {bill.customerPhone && <div className="text-xs text-gray-400 font-mono">{bill.customerPhone}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        <div>{bill.cashierName || '--'}</div>
                        <div className="text-gray-400">{bill.counterName || '--'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          bill.paymentMode === 'CASH' ? 'bg-green-50 text-green-700' :
                          bill.paymentMode === 'UPI'  ? 'bg-purple-50 text-purple-700' :
                          bill.paymentMode === 'CARD' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {bill.paymentMode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {fmtRs(bill.grandTotal)}
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end flex-nowrap">
                          <button
                            onClick={() => printBill(bill.id, 'THERMAL')}
                            disabled={!!printing}
                            className="px-2 py-1 text-xs font-medium rounded bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40 whitespace-nowrap"
                          >
                            {printing === bill.id + 'THERMAL' ? '…' : 'Thermal'}
                          </button>
                          <button
                            onClick={() => printBill(bill.id, 'A4')}
                            disabled={!!printing}
                            className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                          >
                            {printing === bill.id + 'A4' ? '…' : 'A4'}
                          </button>
                          {canVoid(bill) && (
                            <button
                              onClick={() => openVoidModal(bill)}
                              className="px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 whitespace-nowrap"
                            >
                              Void
                            </button>
                          )}
                          {isManager && !bill.isVoided && (
                            <button
                              onClick={() => openCnModal(bill)}
                              className="px-2 py-1 text-xs font-medium rounded bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 whitespace-nowrap"
                            >
                              Return
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="py-3 flex items-center justify-center border-t border-gray-100">
                {loadingMore && (
                  <span className="flex items-center gap-2 text-xs text-gray-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading more...
                  </span>
                )}
                {!loadingMore && !hasMore && results.length > 0 && (
                  <span className="text-xs text-gray-400">All {totalCount} bills loaded</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PREVIEW PANEL OVERLAY ── */}
      {selectedBillId && (
        <div
          className="fixed inset-0 bg-black/10 z-30"
          onClick={closePreview}
        />
      )}

      {/* ── PREVIEW PANEL ── */}
      {selectedBillId && (
        <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl z-40 flex flex-col border-l border-gray-200">
          {previewLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Loading...
            </div>
          ) : previewData ? (
            <PreviewPanel
              data={previewData}
              listBill={previewBill}
              isManager={isManager}
              userId={userId}
              printing={printing}
              onClose={closePreview}
              onPrint={printBill}
              onVoid={bill => openVoidModal(bill)}
              onReturn={bill => openCnModal(bill)}
              canVoid={canVoid}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <span className="text-sm">Failed to load</span>
            </div>
          )}
        </div>
      )}

      {/* ── VOID MODAL ── */}
      {voidBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeVoidModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-500" /> Void Bill
              </h2>
              <button onClick={closeVoidModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                <p className="font-semibold">You are about to void:</p>
                <p className="mt-1">{voidBill.billNumber} — {fmtRs(Number(voidBill.grandTotal))}</p>
                <p className="text-xs mt-1 text-red-500">This will reverse all stock movements and cannot be undone.</p>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Void Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                rows={3}
                placeholder="Explain why this bill is being voided (min 10 characters)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 text-sm resize-none"
                autoFocus
              />
              <p className={`text-xs mt-1 ${voidReason.length < 10 ? 'text-gray-400' : 'text-green-600'}`}>
                {voidReason.length} / 10 minimum
              </p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeVoidModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={submitVoid} disabled={voidMutation.isPending || voidReason.trim().length < 10}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {voidMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREDIT NOTE MODAL ── */}
      {cnBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeCnModal}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-600" />
                Create Credit Note — {cnBill.billNumber}
              </h2>
              <button onClick={closeCnModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-gray-100 shrink-0">
              {(['items', 'reason', 'refund', 'confirm'] as CnStep[]).map((s, i) => {
                const labels = ['1. Items', '2. Reason', '3. Refund', '4. Confirm'];
                const active = s === cnStep;
                const done = (['items', 'reason', 'refund', 'confirm'] as CnStep[]).indexOf(cnStep) > i;
                return (
                  <div key={s} className={`flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors ${
                    active ? 'border-purple-500 text-purple-700' : done ? 'border-green-400 text-green-600' : 'border-transparent text-gray-400'
                  }`}>
                    {labels[i]}
                  </div>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {cnLoadingFull && (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading items...
                </div>
              )}

              {!cnLoadingFull && cnStep === 'items' && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-3">Select items to return. Non-returnable or expired items are disabled.</p>
                  {cnFullItems.map(item => {
                    const returnable = canReturnItem(item, cnBill.billDate);
                    const notReturnableReason = item.product?.isReturnable === false
                      ? 'Non-returnable product'
                      : !returnable ? `Return period (${item.product?.returnPeriodDays ?? 7} days) expired` : '';
                    const state = cnItems[item.productId] ?? { selected: false, quantity: 1 };
                    return (
                      <div key={item.productId}
                        className={`border rounded-lg p-3 flex items-center gap-3 transition-colors ${
                          !returnable ? 'bg-gray-50 opacity-60' : state.selected ? 'border-purple-300 bg-purple-50' : 'border-gray-200'
                        }`}>
                        <input type="checkbox" checked={state.selected} disabled={!returnable}
                          onChange={() => cnToggleItem(item.productId)}
                          className="w-4 h-4 accent-purple-600" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{item.productName}</div>
                          {notReturnableReason && <div className="text-xs text-red-500">{notReturnableReason}</div>}
                          <div className="text-xs text-gray-500">
                            Qty: {Number(item.quantity)} x {fmtRs(Number(item.unitPrice))} = {fmtRs(Number(item.totalAmount))}
                          </div>
                        </div>
                        {state.selected && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => cnItemQtyChange(item.productId, -1)}
                              className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-medium">{state.quantity}</span>
                            <button onClick={() => cnItemQtyChange(item.productId, 1)}
                              className="w-6 h-6 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cnSelectedItems().length > 0 && (
                    <div className="mt-3 text-right text-sm font-semibold text-gray-800">
                      Return Total: {fmtRs(cnTotal())}
                    </div>
                  )}
                </div>
              )}

              {cnStep === 'reason' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Return Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea value={cnReason} onChange={e => setCnReason(e.target.value)} rows={4}
                    placeholder="Describe the reason for the return..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm resize-none"
                    autoFocus />
                </div>
              )}

              {cnStep === 'refund' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">How will the customer receive their refund?</p>
                  {(['CASH', 'STORE_CREDIT'] as const).map(mode => (
                    <button key={mode} onClick={() => setCnRefundMode(mode)}
                      className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl transition-colors ${
                        cnRefundMode === mode ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${cnRefundMode === mode ? 'bg-purple-100' : 'bg-gray-100'}`}>
                        {mode === 'CASH' ? '💵' : '🎫'}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{mode === 'CASH' ? 'Cash Refund' : 'Store Credit'}</div>
                        <div className="text-xs text-gray-500">
                          {mode === 'CASH' ? `Return ${fmtRs(cnTotal())} in cash` : `Add ${fmtRs(cnTotal())} to customer account`}
                        </div>
                      </div>
                      {cnRefundMode === mode && <Check className="w-5 h-5 text-purple-600 ml-auto" />}
                    </button>
                  ))}
                </div>
              )}

              {cnStep === 'confirm' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items to Return</div>
                    {cnSelectedItems().map(it => (
                      <div key={it.productId} className="flex justify-between text-sm py-1">
                        <span className="text-gray-700">{it.productName} x {cnItems[it.productId].quantity}</span>
                        <span className="font-medium">{fmtRs((Number(it.totalAmount) / Number(it.quantity)) * cnItems[it.productId].quantity)}</span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold text-gray-900">
                      <span>Total Refund</span>
                      <span>{fmtRs(cnTotal())}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Reason:</span>
                      <p className="font-medium text-gray-900 mt-0.5">{cnReason}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Refund Mode:</span>
                      <p className="font-medium text-gray-900 mt-0.5">{cnRefundMode === 'CASH' ? 'Cash' : 'Store Credit'}</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    Stock will be credited back and a credit note will be issued. This cannot be undone.
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              {cnStep !== 'items' && (
                <button
                  onClick={() => {
                    const steps: CnStep[] = ['items', 'reason', 'refund', 'confirm'];
                    setCnStep(steps[steps.indexOf(cnStep) - 1]);
                  }}
                  className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button onClick={closeCnModal} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <div className="flex-1" />
              {cnStep !== 'confirm' ? (
                <button
                  onClick={() => {
                    if (cnStep === 'items' && cnSelectedItems().length === 0) { toast.error('Select at least one item'); return; }
                    if (cnStep === 'reason' && cnReason.trim().length < 5) { toast.error('Enter a reason'); return; }
                    const steps: CnStep[] = ['items', 'reason', 'refund', 'confirm'];
                    setCnStep(steps[steps.indexOf(cnStep) + 1]);
                  }}
                  className="flex items-center gap-1 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={submitCreditNote} disabled={cnSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                  {cnSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <Check className="w-4 h-4" /> Confirm &amp; Issue
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview Panel Component ──────────────────────────────────────────────────

function PreviewPanel({
  data, listBill, isManager, userId, printing,
  onClose, onPrint, onVoid, onReturn, canVoid,
}: {
  data: FullBill;
  listBill: BillResult | null;
  isManager: boolean;
  userId: string;
  printing: string | null;
  onClose: () => void;
  onPrint: (id: string, format: 'THERMAL' | 'A4') => void;
  onVoid: (bill: BillResult) => void;
  onReturn: (bill: BillResult) => void;
  canVoid: (bill: BillResult | null) => boolean;
}) {
  const { bill, business } = data;
  const n = (v: any) => Number(v ?? 0);

  const billTypeLabel = bill.billType === 'TAX_INVOICE' ? 'Tax Invoice' : 'Retail Invoice';

  return (
    <>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-gray-900 text-sm">{bill.billNumber ?? '--'}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            bill.billType === 'TAX_INVOICE' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
          }`}>{billTypeLabel}</span>
          {bill.isB2B && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">B2B</span>}
          {bill.isVoided && <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-medium">VOIDED</span>}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">

        {/* Date / cashier / counter */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Date: <span className="text-gray-800 font-medium">{fmtDate(bill.billDate)}</span></span>
          <span>Time: <span className="text-gray-800 font-medium">{fmtTime(bill.billDate)}</span></span>
          <span>Cashier: <span className="text-gray-800 font-medium">{bill.createdBy?.fullName ?? bill.posShift?.cashier?.fullName ?? '--'}</span></span>
          <span>Counter: <span className="text-gray-800 font-medium">{bill.posCounter?.name ?? '--'}</span></span>
        </div>

        {/* Customer */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-0.5 text-xs">
          <div className="font-semibold text-gray-600 mb-1 uppercase tracking-wide">Customer</div>
          <div><span className="text-gray-500">Name: </span><span className="text-gray-800 font-medium">{bill.customerName ?? 'Walk-in'}</span></div>
          <div><span className="text-gray-500">Phone: </span><span className="text-gray-800">{bill.customerPhone ?? '--'}</span></div>
          {bill.customerGstin && <div><span className="text-gray-500">GSTIN: </span><span className="text-gray-800 font-mono">{bill.customerGstin}</span></div>}
        </div>

        {/* Items */}
        <div>
          <div className="font-semibold text-xs text-gray-600 uppercase tracking-wide mb-2">Items</div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Product</th>
                  <th className="text-right px-2 py-1.5 font-medium w-10">Qty</th>
                  <th className="text-right px-2 py-1.5 font-medium w-16">Rate</th>
                  <th className="text-right px-2 py-1.5 font-medium w-12">GST%</th>
                  <th className="text-right px-2 py-1.5 font-medium w-16">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bill.items.map((item, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <div className="text-gray-800 font-medium truncate max-w-[140px]">{item.productName}</div>
                      {item.discountPercent > 0 && (
                        <div className="text-amber-600">{item.discountPercent}% off</div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{n(item.quantity)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtRs(item.unitPrice)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-500">{n(item.gstRatePercent)}%</td>
                    <td className="px-2 py-1.5 text-right font-medium text-gray-800">{fmtRs(item.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-1 text-xs">
          <div className="font-semibold text-gray-600 uppercase tracking-wide mb-1">Totals</div>
          {n(bill.subtotalAmount) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{fmtRs(bill.subtotalAmount)}</span>
            </div>
          )}
          {n(bill.discountAmount) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Discount</span><span>- {fmtRs(bill.discountAmount)}</span>
            </div>
          )}
          {n(bill.taxableAmount) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Taxable</span><span>{fmtRs(bill.taxableAmount)}</span>
            </div>
          )}
          {n(bill.cgstTotal) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>CGST</span><span>{fmtRs(bill.cgstTotal)}</span>
            </div>
          )}
          {n(bill.sgstTotal) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>SGST</span><span>{fmtRs(bill.sgstTotal)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-sm border-t border-gray-200 pt-1.5 mt-1">
            <span>Grand Total</span><span>{fmtRs(bill.grandTotal)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
          <div className="font-semibold text-gray-600 uppercase tracking-wide mb-1">Payment</div>
          <div className="flex justify-between">
            <span className="text-gray-500">Mode</span>
            <span className={`font-medium ${
              bill.paymentMode === 'CASH' ? 'text-green-700' :
              bill.paymentMode === 'UPI'  ? 'text-purple-700' :
              bill.paymentMode === 'CARD' ? 'text-blue-700' : 'text-gray-700'
            }`}>{bill.paymentMode}</span>
          </div>
          {bill.paymentMode === 'SPLIT' && (
            <>
              {n(bill.cashAmount) > 0 && <div className="flex justify-between text-gray-600"><span>Cash</span><span>{fmtRs(bill.cashAmount)}</span></div>}
              {n(bill.upiAmount)  > 0 && <div className="flex justify-between text-gray-600"><span>UPI</span><span>{fmtRs(bill.upiAmount)}</span></div>}
              {n(bill.cardAmount) > 0 && <div className="flex justify-between text-gray-600"><span>Card</span><span>{fmtRs(bill.cardAmount)}</span></div>}
            </>
          )}
          {bill.paymentMode === 'CASH' && n(bill.cashReceived) > 0 && (
            <>
              <div className="flex justify-between text-gray-600"><span>Received</span><span>{fmtRs(bill.cashReceived)}</span></div>
              <div className="flex justify-between text-green-600 font-medium"><span>Change</span><span>{fmtRs(bill.changeAmount)}</span></div>
            </>
          )}
        </div>

        {/* Voided info */}
        {bill.isVoided && bill.voidedAt && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
            <div className="font-semibold text-red-700 mb-0.5">Bill Voided</div>
            <div className="text-red-600">{fmtDate(bill.voidedAt)} {fmtTime(bill.voidedAt)}</div>
            {bill.voidReason && <div className="text-red-600 mt-0.5">Reason: {bill.voidReason}</div>}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="shrink-0 border-t border-gray-200 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onPrint(bill.id, 'THERMAL')}
            disabled={!!printing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50">
            {printing === bill.id + 'THERMAL' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            Thermal
          </button>
          <button
            onClick={() => onPrint(bill.id, 'A4')}
            disabled={!!printing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {printing === bill.id + 'A4' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            A4
          </button>
        </div>
        {listBill && canVoid(listBill) && (
          <button
            onClick={() => onVoid(listBill)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-lg hover:bg-red-100">
            <Ban className="w-3.5 h-3.5" /> Void Bill
          </button>
        )}
        {isManager && listBill && !listBill.isVoided && (
          <button
            onClick={() => onReturn(listBill)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium rounded-lg hover:bg-purple-100">
            <RotateCcw className="w-3.5 h-3.5" /> Create Credit Note
          </button>
        )}
      </div>
    </>
  );
}
