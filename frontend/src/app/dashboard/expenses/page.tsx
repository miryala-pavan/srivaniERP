'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Plus, X, Check, Search, Download, Wallet,
  Calendar, Filter, ChevronDown, Loader2, AlertCircle,
  IndianRupee, TrendingDown,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  expenseDate: string;
  category: string | null;
  amount: string | number;
  paymentMode: string;
  vendorName: string | null;
  referenceNo: string | null;
  description: string | null;
  remarks: string | null;
  createdAt: string;
}

interface ExpenseMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAmount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_MODES = ['CASH', 'UPI', 'CARD', 'CHEQUE', 'BANK'];
const PAYMENT_COLORS: Record<string, string> = {
  CASH:   'bg-green-100 text-green-700',
  UPI:    'bg-blue-100 text-blue-700',
  CARD:   'bg-purple-100 text-purple-700',
  CHEQUE: 'bg-amber-100 text-amber-700',
  BANK:   'bg-cyan-100 text-cyan-700',
};

const DATE_PRESETS = [
  { label: 'Today',       value: 'today' },
  { label: 'Yesterday',   value: 'yesterday' },
  { label: 'This Week',   value: 'week' },
  { label: 'This Month',  value: 'month' },
  { label: 'Last Month',  value: 'lastmonth' },
  { label: 'Custom',      value: 'custom' },
];

function getPresetDates(preset: string): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  if (preset === 'today') {
    const s = fmt(now);
    return { start: s, end: s };
  }
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const s = fmt(y); return { start: s, end: s };
  }
  if (preset === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay());
    return { start: fmt(d), end: fmt(now) };
  }
  if (preset === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmt(d), end: fmt(now) };
  }
  if (preset === 'lastmonth') {
    const s = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: fmt(s), end: fmt(e) };
  }
  return { start: '', end: '' };
}

const fmt = (n: number | string) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(n));

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  expenseDate: todayIso(),
  category: '',
  customCategory: '',
  amount: '',
  paymentMode: 'CASH',
  vendorName: '',
  referenceNo: '',
  description: '',
  remarks: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  // Filters
  const [datePreset, setDatePreset]   = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [filterCat, setFilterCat]     = useState('');
  const [filterMode, setFilterMode]   = useState('');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);

  // Panel
  const [showPanel, setShowPanel]   = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [saving, setSaving]         = useState(false);

  useEscapeKey(() => setShowPanel(false), showPanel);

  // Resolved date range
  const { start: resolvedStart, end: resolvedEnd } = useMemo(() => {
    if (datePreset === 'custom') return { start: customStart, end: customEnd };
    return getPresetDates(datePreset);
  }, [datePreset, customStart, customEnd]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: expenseData, isLoading, isError } = useQuery({
    queryKey: ['expenses', { page, start: resolvedStart, end: resolvedEnd, category: filterCat }],
    queryFn: () => api.get('/expenses', {
      params: {
        page, limit: 20,
        startDate: resolvedStart || undefined,
        endDate:   resolvedEnd   || undefined,
        category:  filterCat     || undefined,
      },
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: catData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories').then(r => r.data),
    staleTime: 60_000,
  });

  // Summary for current period (all expenses, no pagination)
  const { data: summaryData } = useQuery({
    queryKey: ['expenses-summary', { start: resolvedStart, end: resolvedEnd }],
    queryFn: () => api.get('/expenses', {
      params: { page: 1, limit: 1000, startDate: resolvedStart || undefined, endDate: resolvedEnd || undefined },
    }).then(r => r.data),
    staleTime: 30_000,
  });

  const expenses  = (expenseData?.data  ?? []) as Expense[];
  const meta      = (expenseData?.meta  ?? { total: 0, totalPages: 1, totalAmount: 0 }) as ExpenseMeta;
  const categories = (catData?.categories ?? []) as string[];
  const allForPeriod = (summaryData?.data ?? []) as Expense[];

  // Client-side search + payment mode filter
  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (filterMode && e.paymentMode !== filterMode) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (e.category ?? '').toLowerCase().includes(q) ||
          (e.vendorName ?? '').toLowerCase().includes(q) ||
          (e.description ?? '').toLowerCase().includes(q) ||
          (e.referenceNo ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, filterMode, search]);

  // Summary breakdown
  const summary = useMemo(() => {
    const total   = allForPeriod.reduce((s, e) => s + Number(e.amount), 0);
    const byCat   = allForPeriod.reduce((acc, e) => {
      const k = e.category ?? 'Uncategorised';
      acc[k] = (acc[k] ?? 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    const byMode  = allForPeriod.reduce((acc, e) => {
      acc[e.paymentMode] = (acc[e.paymentMode] ?? 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);
    const topCat  = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    return { total, byCat, byMode, topCat };
  }, [allForPeriod]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) => api.post('/expenses', data),
    onSuccess: () => {
      toast.success('Expense recorded');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      setShowPanel(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const cat = form.category === '__custom__' ? form.customCategory.trim() : form.category;
    if (!cat)            { toast.error('Category required'); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)
                         { toast.error('Enter a valid amount'); return; }
    createMutation.mutate({
      expenseDate: form.expenseDate,
      category:    cat,
      amount:      parseFloat(form.amount),
      paymentMode: form.paymentMode,
      vendorName:  form.vendorName.trim()  || undefined,
      referenceNo: form.referenceNo.trim() || undefined,
      description: form.description.trim() || undefined,
      remarks:     form.remarks.trim()     || undefined,
    });
  }, [form, createMutation]);

  function exportCsv() {
    const headers = ['Date', 'Category', 'Amount', 'Payment Mode', 'Vendor', 'Ref No', 'Description'];
    const rows = allForPeriod.map(e => [
      fmtDate(e.expenseDate), e.category ?? '', fmt(e.amount),
      e.paymentMode, e.vendorName ?? '', e.referenceNo ?? '', e.description ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `expenses-${resolvedStart}-${resolvedEnd}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Expenses" />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <Breadcrumbs items={[{ label: 'Finance' }, { label: 'Expenses' }]} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#1B4F8A]" />
              Expenses
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Track daily business expenses</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => { setForm({ ...EMPTY_FORM }); setShowPanel(true); }}
              className="flex items-center gap-1.5 bg-[#1B4F8A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#163d6d]"
            >
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          </div>
        </div>

        {/* ── Date range bar ── */}
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex items-center gap-1 flex-wrap">
            {DATE_PRESETS.map(p => (
              <button key={p.value} onClick={() => { setDatePreset(p.value); setPage(1); }}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                  datePreset === p.value
                    ? 'bg-[#1B4F8A] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#1B4F8A]" />
              <span className="text-gray-400">to</span>
              <input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setPage(1); }}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#1B4F8A]" />
            </div>
          )}
          {resolvedStart && resolvedEnd && (
            <span className="text-xs text-gray-400 ml-auto">
              {fmtDate(resolvedStart)} — {fmtDate(resolvedEnd)}
            </span>
          )}
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500">Total Expenses</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">₹{fmt(summary.total)}</div>
            <div className="text-xs text-gray-400 mt-1">{allForPeriod.length} transactions</div>
          </div>
          {PAYMENT_MODES.filter(m => summary.byMode[m]).map(mode => (
            <div key={mode} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[mode]}`}>{mode}</span>
              </div>
              <div className="text-lg font-bold text-gray-900">₹{fmt(summary.byMode[mode])}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {Math.round((summary.byMode[mode] / summary.total) * 100)}% of total
              </div>
            </div>
          ))}
        </div>

        {/* ── Top categories breakdown ── */}
        {Object.keys(summary.byCat).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Category</h3>
            <div className="space-y-2">
              {Object.entries(summary.byCat)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([cat, amt]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-gray-600 shrink-0 truncate">{cat}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-full bg-[#1B4F8A] rounded-full"
                        style={{ width: `${Math.min(100, (amt / summary.total) * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs font-semibold text-gray-700 w-20 text-right">₹{fmt(amt)}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor, category, description…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
          </div>
          <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B4F8A]">
            <option value="">All Payment Modes</option>
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {(filterCat || filterMode || search) && (
            <button onClick={() => { setFilterCat(''); setFilterMode(''); setSearch(''); }}
              className="text-xs text-red-500 hover:text-red-700">Clear</button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{meta.total} records · ₹{fmt(meta.totalAmount)}</span>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center gap-2 py-16 text-red-500">
              <AlertCircle className="w-4 h-4" /> Failed to load expenses
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No expenses found</p>
              <p className="text-xs text-gray-400 mt-1">
                {search || filterCat || filterMode ? 'Try clearing filters' : 'Add your first expense for this period'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Vendor / Description</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Mode</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Ref No</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(e.expenseDate)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                        {e.category ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.vendorName && <div className="font-medium text-gray-800">{e.vendorName}</div>}
                      {e.description && <div className="text-xs text-gray-400">{e.description}</div>}
                      {!e.vendorName && !e.description && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{fmt(e.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[e.paymentMode] ?? 'bg-gray-100 text-gray-600'}`}>
                        {e.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono hidden md:table-cell">
                      {e.referenceNo ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer total */}
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">
                    {datePreset !== 'custom' ? DATE_PRESETS.find(p => p.value === datePreset)?.label : 'Period'} Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">₹{fmt(meta.totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">← Prev</button>
            <span className="text-sm text-gray-500">Page {page} of {meta.totalPages}</span>
            <button onClick={() => setPage(p => Math.min(meta.totalPages, p+1))} disabled={page === meta.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Next →</button>
          </div>
        )}
      </div>

      {/* ── Add Expense Panel ── */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowPanel(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Add Expense</h2>
              <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-4">
              {/* Date */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Date *</label>
                <input type="date" value={form.expenseDate}
                  onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
                  className="inp" />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Category *</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="inp">
                  <option value="">— Select category —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Add new category…</option>
                </select>
                {form.category === '__custom__' && (
                  <input
                    autoFocus
                    value={form.customCategory}
                    onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                    placeholder="Type new category name"
                    className="inp mt-2"
                  />
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Amount (₹) *</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input type="number" step="0.01" min="0" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="inp pl-8" placeholder="0.00" />
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Payment Mode *</label>
                <div className="flex gap-2 flex-wrap">
                  {PAYMENT_MODES.map(m => (
                    <button key={m} type="button"
                      onClick={() => setForm(f => ({ ...f, paymentMode: m }))}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors ${
                        form.paymentMode === m
                          ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#1B4F8A]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vendor */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Vendor / Paid To</label>
                <input value={form.vendorName} onChange={e => setForm(f => ({ ...f, vendorName: e.target.value }))}
                  className="inp" placeholder="e.g. TSECL, Landlord, ABC Traders" />
              </div>

              {/* Reference No */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Reference No</label>
                <input value={form.referenceNo} onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))}
                  className="inp" placeholder="Invoice / receipt / transaction no" />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="inp" placeholder="Brief description" />
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Remarks</label>
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  rows={2} className="inp resize-none" placeholder="Any additional notes" />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowPanel(false)}
                className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={createMutation.isPending}
                className="flex-1 py-2.5 text-sm bg-[#1B4F8A] text-white rounded-xl hover:bg-[#163d6d] disabled:opacity-60 font-medium flex items-center justify-center gap-1.5">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {createMutation.isPending ? 'Saving…' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .inp { width:100%; padding:0.5rem 0.75rem; font-size:0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; background:white; }
        .inp:focus { border-color:#1B4F8A; }
      `}</style>
    </div>
  );
}
