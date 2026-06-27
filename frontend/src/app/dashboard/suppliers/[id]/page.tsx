'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Phone, Mail, MapPin, Edit2, AlertTriangle,
  ChevronLeft, ChevronRight, RefreshCw, X, Tag, GitMerge, Plus,
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { EntityLink } from '@/components/shared/EntityLink';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Tabs } from '@/components/shared/Tabs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'grns' | 'payments' | 'products' | 'statement' | 'credit-notes';

const GRN_STATUSES = ['', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'];
const PAYMENT_MODES = ['CASH', 'CHEQUE', 'UPI', 'BANK_TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'OTHER'];

const STATUS_BADGE: Record<string, string> = {
  DRAFT:            'bg-gray-100 text-gray-600',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED:         'bg-green-100 text-green-700',
  REJECTED:         'bg-red-100 text-red-700',
  CANCELLED:        'bg-gray-100 text-gray-400',
};

const STMT_BADGE: Record<string, string> = {
  OPENING:     'bg-blue-50 text-blue-700',
  GRN:         'bg-orange-50 text-orange-700',
  PAYMENT:     'bg-green-50 text-green-700',
  CREDIT_NOTE: 'bg-purple-50 text-purple-700',
};

const EMPTY_PAY = {
  amount: '', paymentDate: todayISO(), paymentMode: 'CASH',
  referenceNumber: '', notes: '',
};

// ─── Pager ───────────────────────────────────────────────────────────────────

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs">Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();
  const { connected } = useWebSocket();

  const [activeTab, setActiveTab] = useState<Tab>('grns');
  const [grnPage,   setGrnPage]   = useState(1);
  const [payPage,   setPayPage]   = useState(1);
  const [cnPage,    setCnPage]    = useState(1);
  const [grnStatus, setGrnStatus] = useState('');
  const [stmtFrom,  setStmtFrom]  = useState('');
  const [stmtTo,    setStmtTo]    = useState('');
  const [showPay,      setShowPay]      = useState(false);
  const [payForm,      setPayForm]      = useState({ ...EMPTY_PAY });
  const [aliasInput,   setAliasInput]   = useState('');
  const [showMerge,    setShowMerge]    = useState(false);
  const [mergeSearch,  setMergeSearch]  = useState('');
  const [mergeTarget,  setMergeTarget]  = useState<{ id: string; name: string } | null>(null);

  useEscapeKey(() => setShowPay(false), showPay);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get(`/suppliers/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: grnsData, isLoading: grnsLoading } = useQuery({
    queryKey: ['supplier', id, 'grns', { page: grnPage, status: grnStatus }],
    queryFn: () => api.get(`/suppliers/${id}/grns`, {
      params: { page: grnPage, limit: 20, ...(grnStatus ? { status: grnStatus } : {}) },
    }).then(r => r.data),
    enabled: !!id && activeTab === 'grns',
    placeholderData: (prev: any) => prev,
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['supplier', id, 'payments', { page: payPage }],
    queryFn: () => api.get(`/suppliers/${id}/payments`, { params: { page: payPage, limit: 20 } }).then(r => r.data),
    enabled: !!id && activeTab === 'payments',
    placeholderData: (prev: any) => prev,
  });

  const { data: productsData = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ['supplier', id, 'products'],
    queryFn: () => api.get(`/suppliers/${id}/products`).then(r => r.data),
    enabled: !!id && activeTab === 'products',
  });

  const { data: statementData = [], isLoading: stmtLoading } = useQuery<any[]>({
    queryKey: ['supplier', id, 'statement', { stmtFrom, stmtTo }],
    queryFn: () => api.get(`/suppliers/${id}/statement`, {
      params: { ...(stmtFrom ? { dateFrom: stmtFrom } : {}), ...(stmtTo ? { dateTo: stmtTo } : {}) },
    }).then(r => r.data),
    enabled: !!id && activeTab === 'statement',
    placeholderData: (prev: any) => prev,
  });

  const { data: cnData, isLoading: cnLoading } = useQuery({
    queryKey: ['supplier', id, 'credit-notes', { page: cnPage }],
    queryFn: () => api.get(`/suppliers/${id}/credit-notes`, { params: { page: cnPage, limit: 20 } }).then(r => r.data),
    enabled: !!id && activeTab === 'credit-notes',
    placeholderData: (prev: any) => prev,
  });

  // ── Payment mutation ─────────────────────────────────────────────────────────

  const addPay = useMutation({
    mutationFn: (body: any) => api.post(`/suppliers/${id}/payments`, body),
    onSuccess: () => {
      toast.success('Payment recorded');
      setShowPay(false);
      setPayForm({ ...EMPTY_PAY });
      qc.invalidateQueries({ queryKey: ['supplier', id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to record payment'),
  });

  // ── Bank alias mutation ──────────────────────────────────────────────────────

  const addAlias = useMutation({
    mutationFn: (aliases: string[]) => api.patch(`/suppliers/${id}/bank-aliases`, { aliases }),
    onSuccess: () => { toast.success('Bank aliases saved'); qc.invalidateQueries({ queryKey: ['supplier', id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save aliases'),
  });

  // ── Merge supplier ───────────────────────────────────────────────────────────

  const { data: mergeResults = [] } = useQuery<any[]>({
    queryKey: ['suppliers-search', mergeSearch],
    queryFn: () => api.get('/suppliers', { params: { search: mergeSearch, limit: 8, isActive: 'all' } }).then(r => r.data.suppliers ?? []),
    enabled: showMerge && mergeSearch.length >= 2,
  });

  const mergeMut = useMutation({
    mutationFn: () => api.post(`/suppliers/${id}/merge-into/${mergeTarget!.id}`),
    onSuccess: (res) => {
      toast.success(`Merged into ${res.data.into}`);
      router.push('/dashboard/suppliers');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Merge failed'),
  });

  // ── Real-time ────────────────────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ['supplier', id] });
  useWebSocketEvent('grn.created',               invalidate);
  useWebSocketEvent('grn.approved',              invalidate);
  useWebSocketEvent('grn.updated',               invalidate);
  useWebSocketEvent('grn.rejected',              invalidate);
  useWebSocketEvent('grn.submitted',             invalidate);
  useWebSocketEvent('supplier.payment-recorded', invalidate);
  useWebSocketEvent('supplier.payment-deleted',  invalidate);
  useWebSocketEvent('credit-note.created',       invalidate);

  // ── Loading / error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Supplier" />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-gray-200 rounded" />
          <div className="h-28 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Supplier" />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-400">Supplier not found</div>
      </div>
    );
  }

  const stats       = supplier.stats ?? {};
  const outstanding = n(stats.outstandingBalance);
  const creditLimit = n(supplier.creditLimit);
  const available   = creditLimit > 0 ? Math.max(0, creditLimit - outstanding) : null;
  const overLimit   = creditLimit > 0 && outstanding > creditLimit;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Supplier" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Top nav */}
        <div className="flex items-center gap-3 flex-wrap">
          <BackButton fallbackHref="/dashboard/suppliers" />
          <span className="text-gray-300">|</span>
          <Breadcrumbs items={[
            { label: 'Suppliers', href: '/dashboard/suppliers' },
            { label: supplier.name },
          ]} />
          <span className="ml-auto text-xs text-gray-400 font-mono">
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>

        {/* Supplier header */}
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-gray-900">{supplier.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supplier.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {supplier.isActive ? 'Active' : 'Inactive'}
                </span>
                {!supplier.isGstRegistered && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Unregistered</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {supplier.phone   && <span className="flex items-center gap-1"><Phone  className="w-3.5 h-3.5" />{supplier.phone}</span>}
                {supplier.email   && <span className="flex items-center gap-1"><Mail   className="w-3.5 h-3.5" />{supplier.email}</span>}
                {supplier.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{supplier.address}</span>}
                {supplier.gstin   && <span className="font-mono text-xs bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">GSTIN: {supplier.gstin}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/dashboard/grn/new?supplierId=${supplier.id}`)}
                className="px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e] font-medium"
              >
                Create GRN
              </button>
              <button
                onClick={() => { setPayForm({ ...EMPTY_PAY }); setShowPay(true); }}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Record Payment
              </button>
              <button
                onClick={() => router.push(`/dashboard/suppliers?edit=${supplier.id}`)}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
                title="Edit supplier"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowMerge(true); setMergeSearch(''); setMergeTarget(null); }}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
                title="Merge duplicate supplier into another"
              >
                <GitMerge className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bank aliases */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-start gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-gray-400 mt-1 shrink-0">
                <Tag className="w-3 h-3" /> Bank names:
              </span>
              {(supplier.bankAliases ?? []).map((a: string) => (
                <span key={a} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">
                  {a}
                  <button
                    onClick={() => {
                      const next = (supplier.bankAliases as string[]).filter((x: string) => x !== a);
                      addAlias.mutate(next);
                    }}
                    className="ml-0.5 hover:text-red-500"
                    title="Remove alias"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <form
                className="flex items-center gap-1"
                onSubmit={e => {
                  e.preventDefault();
                  const val = aliasInput.trim().toUpperCase();
                  if (!val) return;
                  const current: string[] = supplier.bankAliases ?? [];
                  if (!current.includes(val)) addAlias.mutate([...current, val]);
                  setAliasInput('');
                }}
              >
                <input
                  value={aliasInput}
                  onChange={e => setAliasInput(e.target.value.toUpperCase())}
                  placeholder="Add bank name…"
                  className="text-xs border border-dashed border-gray-300 rounded-full px-2.5 py-0.5 w-36 focus:outline-none focus:border-blue-400 bg-transparent"
                />
                <button type="submit" className="text-blue-600 hover:text-blue-800" title="Add">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Type the supplier name exactly as it appears in your bank statement — future uploads will auto-match.
            </p>
          </div>
        </div>

        {/* Merge modal */}
        {showMerge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <GitMerge className="w-4 h-4" /> Merge Duplicate Supplier
                </h2>
                <button onClick={() => setShowMerge(false)}><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <p className="text-sm text-gray-600">
                This will move all GRNs, payments and advances from <strong>{supplier.name}</strong> into the selected supplier, then deactivate this record.
              </p>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Search target supplier</label>
                <input
                  value={mergeSearch}
                  onChange={e => { setMergeSearch(e.target.value); setMergeTarget(null); }}
                  placeholder="Type supplier name…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]"
                  autoFocus
                />
                {mergeResults.filter((s: any) => s.id !== id).length > 0 && !mergeTarget && (
                  <ul className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-auto">
                    {mergeResults.filter((s: any) => s.id !== id).map((s: any) => (
                      <li key={s.id}>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => { setMergeTarget(s); setMergeSearch(s.name); }}
                        >
                          <span className="font-medium">{s.name}</span>
                          {s.gstin && <span className="ml-2 text-xs text-gray-400 font-mono">{s.gstin}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {mergeTarget && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  All records will move to <strong>{mergeTarget.name}</strong>. This cannot be undone.
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowMerge(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button
                  disabled={!mergeTarget || mergeMut.isPending}
                  onClick={() => mergeMut.mutate()}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                >
                  {mergeMut.isPending ? 'Merging…' : 'Merge & Deactivate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6 Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className={`bg-white rounded-xl border px-5 py-4 ${outstanding > 0 ? 'border-red-200' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Outstanding</p>
            <p className={`text-xl font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-gray-700'}`}>Rs. {inr(outstanding)}</p>
            {overLimit && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />Over credit limit
              </p>
            )}
          </div>

          <div className={`bg-white rounded-xl border px-5 py-4 ${overLimit ? 'border-red-200' : 'border-gray-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Credit Limit</p>
            {creditLimit > 0 ? (
              <>
                <p className={`text-xl font-semibold ${overLimit ? 'text-red-600' : 'text-gray-700'}`}>Rs. {inr(creditLimit)}</p>
                <p className={`text-xs mt-1 ${overLimit ? 'text-red-500' : 'text-green-600'}`}>
                  {overLimit ? `Exceeded by Rs. ${inr(outstanding - creditLimit)}` : `Available: Rs. ${inr(available!)}`}
                </p>
              </>
            ) : (
              <p className="text-xl font-semibold text-gray-400">No limit</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Lifetime Purchases</p>
            <p className="text-xl font-semibold text-gray-700">Rs. {inr(n(stats.totalPurchased))}</p>
            <p className="text-xs text-gray-400 mt-1">{stats.totalOrders ?? 0} GRN(s)</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-xl font-semibold text-gray-700">Rs. {inr(n(stats.thisMonthPurchased))}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Last GRN</p>
            <p className="text-lg font-semibold text-gray-700">{fmtDate(stats.lastGrnDate)}</p>
            {stats.lastGrnNumber && <p className="text-xs text-gray-400 mt-1">#{stats.lastGrnNumber}</p>}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Last Payment</p>
            <p className="text-lg font-semibold text-gray-700">{fmtDate(stats.lastPaymentDate)}</p>
            {stats.lastPaymentAmount != null && (
              <p className="text-xs text-gray-400 mt-1">Rs. {inr(n(stats.lastPaymentAmount))} · {stats.lastPaymentMode}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Tabs */}
          <div className="flex-1 min-w-0">
            <Tabs
              tabs={[
                { key: 'grns', label: 'GRNs' },
                { key: 'payments', label: 'Payments' },
                { key: 'products', label: 'Products' },
                { key: 'statement', label: 'Statement' },
                { key: 'credit-notes', label: 'Credit Notes' },
              ]}
              active={activeTab}
              onChange={(t) => setActiveTab(t as Tab)}
              className="bg-white rounded-t-xl px-4 pt-3"
            />

            <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 overflow-hidden">

              {/* GRNs */}
              {activeTab === 'grns' && (
                <div>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                    <select value={grnStatus} onChange={e => { setGrnStatus(e.target.value); setGrnPage(1); }}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none">
                      {GRN_STATUSES.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
                    </select>
                    {grnsLoading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
                  </div>
                  {grnsData?.data?.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                              <th className="px-4 py-2.5 text-left font-medium">GRN #</th>
                              <th className="px-4 py-2.5 text-left font-medium">Invoice</th>
                              <th className="px-4 py-2.5 text-left font-medium">Date</th>
                              <th className="px-4 py-2.5 text-left font-medium">Branch</th>
                              <th className="px-4 py-2.5 text-right font-medium">Grand Total</th>
                              <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                              <th className="px-4 py-2.5 text-left font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grnsData.data.map((g: any) => (
                              <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-mono text-xs">
                                  <EntityLink type="grn" id={g.id}>{g.grnNumber ?? g.id.slice(-8)}</EntityLink>
                                </td>
                                <td className="px-4 py-2.5 text-gray-600">{g.invoiceNumber}</td>
                                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(g.invoiceDate)}</td>
                                <td className="px-4 py-2.5 text-gray-500">{g.branch?.name ?? '—'}</td>
                                <td className="px-4 py-2.5 text-right font-medium">Rs. {inr(n(g.grandTotal))}</td>
                                <td className="px-4 py-2.5 text-right text-green-600">Rs. {inr(n(g.paidAmount))}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[g.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {g.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pager page={grnPage} totalPages={grnsData.totalPages ?? 1} onPage={setGrnPage} />
                    </>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">No GRNs found</div>
                  )}
                </div>
              )}

              {/* Payments */}
              {activeTab === 'payments' && (
                <div>
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-600">{paymentsData?.meta?.total ?? 0} payment(s)</span>
                    <button onClick={() => { setPayForm({ ...EMPTY_PAY }); setShowPay(true); }}
                      className="px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e]">
                      Add Payment
                    </button>
                  </div>
                  {paymentsData?.data?.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                              <th className="px-4 py-2.5 text-left font-medium">Date</th>
                              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                              <th className="px-4 py-2.5 text-left font-medium">Mode</th>
                              <th className="px-4 py-2.5 text-left font-medium">Reference</th>
                              <th className="px-4 py-2.5 text-left font-medium">Against GRN</th>
                              <th className="px-4 py-2.5 text-left font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentsData.data.map((p: any) => (
                              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                                <td className="px-4 py-2.5 text-right font-semibold text-green-700">Rs. {inr(n(p.amount))}</td>
                                <td className="px-4 py-2.5 text-gray-600">{p.paymentMode}</td>
                                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.referenceNumber ?? '—'}</td>
                                <td className="px-4 py-2.5 font-mono text-xs">
                                  {p.purchase
                                    ? <EntityLink type="grn" id={p.purchase.id}>{p.purchase.grnNumber ?? p.purchase.invoiceNumber}</EntityLink>
                                    : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-gray-500 text-xs">{p.notes ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Pager page={payPage} totalPages={paymentsData.meta?.totalPages ?? 1} onPage={setPayPage} />
                    </>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">No payments recorded</div>
                  )}
                </div>
              )}

              {/* Products */}
              {activeTab === 'products' && (
                <div>
                  {productsLoading
                    ? <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                    : productsData.length > 0
                      ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                                <th className="px-4 py-2.5 text-left font-medium">Product</th>
                                <th className="px-4 py-2.5 text-right font-medium">Times Ordered</th>
                                <th className="px-4 py-2.5 text-right font-medium">Total Qty</th>
                                <th className="px-4 py-2.5 text-right font-medium">Last Cost</th>
                                <th className="px-4 py-2.5 text-left font-medium">Last Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productsData.map((p: any) => (
                                <tr key={p.productId} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2.5">
                                    <EntityLink type="product" id={p.productId}>{p.productName}</EntityLink>
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-600">{p.timesOrdered}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-600">
                                    {p.totalQty != null ? Number(p.totalQty).toFixed(2) : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    {p.lastUnitCost != null ? `Rs. ${inr(n(p.lastUnitCost))}` : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(p.lastOrderDate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                      : <div className="py-12 text-center text-gray-400 text-sm">No products found for this supplier</div>
                  }
                </div>
              )}

              {/* Statement */}
              {activeTab === 'statement' && (
                <div>
                  <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <label className="text-gray-500 text-xs">From</label>
                      <input type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <label className="text-gray-500 text-xs">To</label>
                      <input type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]" />
                    </div>
                    {(stmtFrom || stmtTo) && (
                      <button onClick={() => { setStmtFrom(''); setStmtTo(''); }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                    )}
                    {stmtLoading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
                  </div>
                  {statementData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                            <th className="px-4 py-2.5 text-left font-medium">Date</th>
                            <th className="px-4 py-2.5 text-left font-medium">Type</th>
                            <th className="px-4 py-2.5 text-left font-medium">Reference</th>
                            <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                            <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                            <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {statementData.map((e: any, i: number) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STMT_BADGE[e.type] ?? ''}`}>
                                  {e.type === 'CREDIT_NOTE' ? 'Credit Note' : e.type}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">
                                {e.type === 'GRN' && e.refId
                                  ? <EntityLink type="grn" id={e.refId}>{e.ref}</EntityLink>
                                  : e.ref}
                              </td>
                              <td className="px-4 py-2.5 text-right text-orange-700 font-medium">
                                {n(e.debit) > 0 ? `Rs. ${inr(n(e.debit))}` : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-green-700 font-medium">
                                {n(e.credit) > 0 ? `Rs. ${inr(n(e.credit))}` : '—'}
                              </td>
                              <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${n(e.runningBalance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                Rs. {inr(Math.abs(n(e.runningBalance)))}
                                {n(e.runningBalance) < 0 && <span className="text-xs ml-1 font-normal">(Cr)</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 text-sm">No transactions found</div>
                  )}
                </div>
              )}

              {/* Credit Notes */}
              {activeTab === 'credit-notes' && (
                <div>
                  {cnLoading
                    ? <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
                    : cnData?.data?.length > 0
                      ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                                  <th className="px-4 py-2.5 text-left font-medium">CN #</th>
                                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                                  <th className="px-4 py-2.5 text-left font-medium">Reason</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cnData.data.map((cn: any) => (
                                  <tr key={cn.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-2.5 font-mono text-xs">
                                      <EntityLink type="credit-note" id={cn.id}>{cn.scnNumber}</EntityLink>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(cn.cnDate)}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{cn.reason}</td>
                                    <td className="px-4 py-2.5 text-right font-medium">Rs. {inr(n(cn.totalAmount))}</td>
                                    <td className="px-4 py-2.5">
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cn.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {cn.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <Pager page={cnPage} totalPages={cnData.meta?.totalPages ?? 1} onPage={setCnPage} />
                        </>
                      )
                      : <div className="py-12 text-center text-gray-400 text-sm">No credit notes found</div>
                  }
                </div>
              )}

            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Supplier Details</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Payment Terms</dt>
                  <dd className="font-medium text-gray-800">
                    {supplier.paymentTermsDays ? `${supplier.paymentTermsDays} days` : 'Immediate'}
                  </dd>
                </div>
                {supplier.stateCode && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">State Code</dt>
                    <dd className="font-medium text-gray-800">{supplier.stateCode}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">GST Registration</dt>
                  <dd className="font-medium text-gray-800">{supplier.isGstRegistered ? 'Registered' : 'Unregistered'}</dd>
                </div>
                {n(supplier.openingBalance) !== 0 && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Opening Balance</dt>
                      <dd className="font-medium text-gray-800">
                        Rs. {inr(n(supplier.openingBalance))} ({supplier.openingBalanceType})
                      </dd>
                    </div>
                    {supplier.openingBalanceDate && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Opening Date</dt>
                        <dd className="text-gray-800">{fmtDate(supplier.openingBalanceDate)}</dd>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Since</dt>
                  <dd className="text-gray-800">{fmtDate(supplier.createdAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Summary</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total Orders</dt>
                  <dd className="font-medium text-gray-800">{stats.totalOrders ?? 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total Paid</dt>
                  <dd className="font-medium text-green-700">Rs. {inr(n(stats.totalPaid))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Outstanding</dt>
                  <dd className={`font-medium ${outstanding > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    Rs. {inr(outstanding)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

        </div>
      </div>

      {/* Payment modal */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPay(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Record Payment</h2>
              <button onClick={() => setShowPay(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {supplier.name} — Outstanding:{' '}
              <span className={`font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                Rs. {inr(outstanding)}
              </span>
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Amount *</label>
                  <input type="number" min="0.01" step="0.01" value={payForm.amount}
                    onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    placeholder="0.00" autoFocus />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Date *</label>
                  <input type="date" value={payForm.paymentDate}
                    onChange={e => setPayForm(f => ({ ...f, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Payment Mode *</label>
                <select value={payForm.paymentMode} onChange={e => setPayForm(f => ({ ...f, paymentMode: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Reference Number</label>
                <input type="text" value={payForm.referenceNumber}
                  onChange={e => setPayForm(f => ({ ...f, referenceNumber: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  placeholder="Cheque / UTR / Transaction ID" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <textarea rows={2} value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] resize-none"
                  placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowPay(false)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                disabled={!payForm.amount || Number(payForm.amount) <= 0 || addPay.isPending}
                onClick={() => addPay.mutate({
                  amount:          Number(payForm.amount),
                  paymentDate:     payForm.paymentDate,
                  paymentMode:     payForm.paymentMode,
                  referenceNumber: payForm.referenceNumber || undefined,
                  notes:           payForm.notes || undefined,
                })}
                className="flex-1 py-2 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e] disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {addPay.isPending ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
