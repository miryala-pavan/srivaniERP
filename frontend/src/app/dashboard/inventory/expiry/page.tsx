'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, AlertOctagon, Clock, Eye, PackageX,
  Trash2, Plus, Search, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Urgency = 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'WATCH' | 'UNKNOWN';

interface ExpiryBatch {
  id: string;
  batchNumber: string | null;
  expiryDate: string | null;
  daysLeft: number | null;
  urgency: Urgency;
  remainingQty: number;
  costPrice: number;
  rackLocation: string | null;
  product: {
    id: string;
    name: string;
    productCode: string | null;
    category: string | null;
    unitOfMeasure: string;
  };
}

interface Branch { id: string; name: string }

interface ProductSuggestion {
  id: string;
  name: string;
  productCode: string | null;
  unitOfMeasure: string;
  totalStock: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<Urgency, { label: string; bg: string; text: string; border: string; icon: any }> = {
  EXPIRED:  { label: 'Expired',         bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',    icon: PackageX },
  CRITICAL: { label: 'Critical (<7d)',  bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: AlertOctagon },
  WARNING:  { label: 'Warning (7-14d)', bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  icon: AlertTriangle },
  WATCH:    { label: 'Watch (14-30d)',  bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   icon: Eye },
  UNKNOWN:  { label: 'Unknown',         bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200',   icon: Clock },
};

const ADJUSTMENT_TYPES = [
  { value: 'EXPIRY',  label: 'Expired Stock',      desc: 'Remove goods past their expiry date',    negative: true  },
  { value: 'DAMAGE',  label: 'Damaged / Broken',   desc: 'Remove goods damaged and unsellable',    negative: true  },
  { value: 'LOSS',    label: 'Loss / Theft',        desc: 'Remove missing or stolen stock',         negative: true  },
  { value: 'FOUND',   label: 'Found / Surplus',     desc: 'Add extra stock found during counting',  negative: false },
  { value: 'RECOUNT', label: 'Recount Correction',  desc: 'Enter net change after physical count',  negative: null  },
] as const;

type AdjustmentTypeValue = typeof ADJUSTMENT_TYPES[number]['value'];

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

// ─── Write-Off / Adjustment Modal ─────────────────────────────────────────────

interface WriteOffModalProps {
  /** 'expiry' = pre-filled from a row; 'general' = product search */
  mode: 'expiry' | 'general';
  prefill?: { productId: string; productName: string; qty: number; unit: string };
  onClose: () => void;
}

function WriteOffModal({ mode, prefill, onClose }: WriteOffModalProps) {
  const qc = useQueryClient();

  // Branch
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  useEffect(() => {
    api.get('/branches').then(r => {
      const list: Branch[] = r.data?.branches ?? [];
      setBranches(list);
      if (list.length === 1) setBranchId(list[0].id);
    }).catch(() => {});
  }, []);

  // Form state
  const [adjType, setAdjType]   = useState<AdjustmentTypeValue>(mode === 'expiry' ? 'EXPIRY' : 'DAMAGE');
  const [qty, setQty]           = useState(prefill ? prefill.qty : 0);
  const [reason, setReason]     = useState('');

  // Product search (general mode only)
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductSuggestion | null>(null);
  const [showDropdown, setShowDropdown]     = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: suggestions = [] } = useQuery<ProductSuggestion[]>({
    queryKey: ['product-search', productSearch],
    queryFn: () => api.get('/grn/search-products', { params: { q: productSearch } }).then(r => r.data),
    enabled: mode === 'general' && productSearch.trim().length >= 2,
    staleTime: 10_000,
  });

  const typeDef = ADJUSTMENT_TYPES.find(t => t.value === adjType)!;

  // Derive the actual signed adjustedQuantity to send
  const signedQty = (() => {
    if (typeDef.negative === true)  return -Math.abs(qty);
    if (typeDef.negative === false) return  Math.abs(qty);
    return qty; // RECOUNT: raw net change (positive or negative)
  })();

  const productId   = mode === 'expiry' ? prefill!.productId : selectedProduct?.id ?? '';
  const productName = mode === 'expiry' ? prefill!.productName : selectedProduct?.name ?? '';
  const unit        = mode === 'expiry' ? prefill!.unit : selectedProduct?.unitOfMeasure ?? '';

  const adjust = useMutation({
    mutationFn: () => api.post('/inventory/adjust', {
      productId,
      branchId,
      adjustedQuantity: signedQty,
      type: adjType,
      reason: reason.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success(`Stock adjusted for ${productName}`);
      qc.invalidateQueries({ queryKey: ['inventory', 'expiry'] });
      onClose();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? 'Adjustment failed');
    },
  });

  const canSubmit = !!productId && !!branchId && qty !== 0 && !adjust.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4 text-red-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              {mode === 'expiry' ? 'Write Off Stock' : 'Record Adjustment'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Product (pre-filled or search) */}
          {mode === 'expiry' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
              <p className="text-sm font-semibold text-gray-800">{prefill!.productName}</p>
              <p className="text-xs text-gray-400">Available: {prefill!.qty} {prefill!.unit}</p>
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
              {selectedProduct ? (
                <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{selectedProduct.name}</p>
                    <p className="text-xs text-gray-400">Stock: {selectedProduct.totalStock} {selectedProduct.unitOfMeasure}</p>
                  </div>
                  <button onClick={() => { setSelectedProduct(null); setProductSearch(''); }} className="p-1 hover:bg-gray-200 rounded">
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    ref={searchRef}
                    value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search product name or code…"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                  />
                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedProduct(p); setProductSearch(''); setShowDropdown(false); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.productCode} · Stock: {p.totalStock} {p.unitOfMeasure}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Adjustment type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ADJUSTMENT_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setAdjType(t.value)}
                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                    adjType === t.value
                      ? 'border-[#1B4F8A] bg-blue-50 text-[#1B4F8A]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-semibold">{t.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {typeDef.negative === true  ? `Quantity to Remove${unit ? ` (${unit})` : ''}` :
               typeDef.negative === false ? `Quantity to Add${unit ? ` (${unit})` : ''}` :
               `Net Change${unit ? ` (${unit})` : ''} — positive to add, negative to remove`}
            </label>
            <input
              type="number"
              step="0.001"
              min={typeDef.negative === null ? undefined : 0}
              value={qty === 0 ? '' : qty}
              onChange={e => setQty(parseFloat(e.target.value) || 0)}
              placeholder={typeDef.negative === null ? 'e.g. -5 or +3' : '0'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            />
            {prefill && typeDef.negative !== false && (
              <button
                onClick={() => setQty(prefill.qty)}
                className="mt-1 text-xs text-[#1B4F8A] hover:underline"
              >
                Write off full quantity ({prefill.qty} {prefill.unit})
              </button>
            )}
          </div>

          {/* Branch */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
            {branches.length === 1 ? (
              <p className="text-sm text-gray-700">{branches[0].name}</p>
            ) : (
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
              >
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason / Notes <span className="text-gray-400">(optional)</span></label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={adjType === 'EXPIRY' ? 'e.g. Found expired during shelf check' : 'e.g. Fell from shelf, packaging broken'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
            />
          </div>

          {/* Summary */}
          {qty !== 0 && productId && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
              <span className="font-semibold">Summary: </span>
              {typeDef.negative === false ? 'Adding' : 'Removing'}{' '}
              <span className="font-semibold">{Math.abs(qty)} {unit}</span>
              {' '}of <span className="font-semibold">{productName}</span>
              {' '}as <span className="font-semibold">{typeDef.label}</span>.
              {' '}This will update the sellable stock and stock ledger immediately.
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => adjust.mutate()}
            disabled={!canSubmit}
            className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {adjust.isPending ? 'Saving…' : mode === 'expiry' ? 'Write Off' : 'Record Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpiryPage() {
  const [days, setDays]   = useState(30);
  const [filter, setFilter] = useState<Urgency | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const [writeOffBatch, setWriteOffBatch]       = useState<ExpiryBatch | null>(null);
  const [showGeneralAdjust, setShowGeneralAdjust] = useState(false);

  const { data = [], isLoading } = useQuery<ExpiryBatch[]>({
    queryKey: ['inventory', 'expiry', days],
    queryFn:  () => api.get('/inventory/expiry', { params: { days } }).then(r => r.data),
    staleTime: 60_000,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data.length, EXPIRED: 0, CRITICAL: 0, WARNING: 0, WATCH: 0 };
    for (const b of data) c[b.urgency] = (c[b.urgency] ?? 0) + 1;
    return c;
  }, [data]);

  const totalValue = useMemo(
    () => data.reduce((s, b) => s + b.remainingQty * b.costPrice, 0),
    [data],
  );

  const filtered = useMemo(() => {
    let rows = filter === 'ALL' ? data : data.filter(b => b.urgency === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(b =>
        b.product.name.toLowerCase().includes(q) ||
        (b.product.productCode?.toLowerCase().includes(q)) ||
        (b.batchNumber?.toLowerCase().includes(q)) ||
        (b.product.category?.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [data, filter, search]);

  return (
    <>
      <Header title="Expiry Tracker" />

      <main className="flex-1 p-6 space-y-5">
        {/* Top bar: filters + search + action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-gray-100 shadow-sm rounded-xl p-1">
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  days === d ? 'bg-[#1B4F8A] text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search product or batch…"
            className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
          />

          <div className="text-sm text-gray-500">
            At-risk value: <span className="font-semibold text-gray-800">₹{inr(totalValue)}</span>
          </div>

          <button
            onClick={() => setShowGeneralAdjust(true)}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Adjustment
          </button>
        </div>

        {/* Urgency tabs */}
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'EXPIRED', 'CRITICAL', 'WARNING', 'WATCH'] as const).map(u => {
            const cfg = u === 'ALL' ? null : URGENCY_CONFIG[u];
            const active = filter === u;
            return (
              <button
                key={u}
                onClick={() => setFilter(u)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  active
                    ? u === 'ALL'
                      ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                      : `${cfg!.bg} ${cfg!.text} ${cfg!.border}`
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {cfg && <cfg.icon className="w-3.5 h-3.5" />}
                {u === 'ALL' ? 'All' : cfg!.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-white/30' : 'bg-gray-100 text-gray-500'
                }`}>
                  {counts[u] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-sm">
                {data.length === 0
                  ? `No batches expiring within ${days} days`
                  : 'No items match your filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Batch #</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Expiry</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Value</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Rack</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(b => {
                    const cfg = URGENCY_CONFIG[b.urgency];
                    const Icon = cfg.icon;
                    const canWriteOff = b.urgency === 'EXPIRED' || b.urgency === 'CRITICAL' || b.urgency === 'WARNING';
                    return (
                      <tr key={b.id} className={`hover:bg-gray-50 transition-colors ${b.urgency === 'EXPIRED' ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{b.product.name}</p>
                          {b.product.productCode && (
                            <p className="text-xs text-gray-400 font-mono">{b.product.productCode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                          {b.product.category ?? '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-gray-500">
                          {b.batchNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <p className={`font-medium text-sm ${b.urgency === 'EXPIRED' ? 'text-red-600' : 'text-gray-800'}`}>
                            {fmtDate(b.expiryDate)}
                          </p>
                          <p className={`text-xs mt-0.5 ${
                            b.daysLeft === null ? 'text-gray-400'
                            : b.daysLeft <= 0  ? 'text-red-500 font-medium'
                            : b.daysLeft <= 7  ? 'text-orange-600'
                            : 'text-gray-400'
                          }`}>
                            {b.daysLeft === null ? '' : b.daysLeft <= 0 ? `${Math.abs(b.daysLeft)}d ago` : `${b.daysLeft}d left`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700 font-variant-numeric tabular-nums">
                          {b.remainingQty.toFixed(b.remainingQty % 1 === 0 ? 0 : 2)} {b.product.unitOfMeasure}
                        </td>
                        <td className="px-4 py-3 text-right hidden xl:table-cell text-gray-600 text-xs tabular-nums">
                          ₹{inr(b.remainingQty * b.costPrice)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                          {b.rackLocation ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canWriteOff && (
                            <button
                              onClick={() => setWriteOffBatch(b)}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors"
                              title="Write off this expired / near-expiry batch"
                            >
                              <Trash2 className="w-3 h-3" />
                              Write Off
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            Showing {filtered.length} batch{filtered.length !== 1 ? 'es' : ''} · Only batches with remaining stock are shown
          </p>
        )}
      </main>

      {/* Write-off modal (per-row) */}
      {writeOffBatch && (
        <WriteOffModal
          mode="expiry"
          prefill={{
            productId:   writeOffBatch.product.id,
            productName: writeOffBatch.product.name,
            qty:         writeOffBatch.remainingQty,
            unit:        writeOffBatch.product.unitOfMeasure,
          }}
          onClose={() => setWriteOffBatch(null)}
        />
      )}

      {/* General stock adjustment modal */}
      {showGeneralAdjust && (
        <WriteOffModal
          mode="general"
          onClose={() => setShowGeneralAdjust(false)}
        />
      )}
    </>
  );
}
