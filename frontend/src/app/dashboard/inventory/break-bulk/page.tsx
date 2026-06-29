'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  SplitSquareHorizontal, Search, Package, ArrowRight, History,
  AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp,
  Barcode, X, Clock, User,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PluBundle {
  id: string;
  bulkPluId: string;
  singlePluId: string;
  conversionQty: number;
  notes: string | null;
  bulkPlu: { id: string; pluCode: string; packLabel: string; stockOnHand: number; product: { name: string } };
  singlePlu: { id: string; pluCode: string; packLabel: string; stockOnHand: number; product: { name: string } };
}

interface BreakBulkLog {
  id: string;
  bulkQtyBroken: number;
  singlesCreated: number;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  bulkPluId: string;
  singlePluId: string;
}

interface SuggestedBreak {
  bundle: PluBundle;
  singlesStock: number;
  bulkStock: number;
  urgency: 'critical' | 'low';
}

// ─── API helpers ───────────────────────────────────────────────────────────────

async function fetchAllBundles(): Promise<PluBundle[]> {
  const { data } = await api.get('/products/plu-bundles/all');
  return data;
}

async function fetchHistory(pluId?: string): Promise<BreakBulkLog[]> {
  const url = pluId
    ? `/products/plu-bundles/${pluId}/history`
    : '/products/plu-bundles/history';
  const { data } = await api.get(url);
  return data;
}

async function doBreakBulk(payload: {
  bulkPluId: string; bulkQty: number;
  targets: { bundleId: string; singlesQty: number }[];
  notes?: string;
}) {
  const { data } = await api.post('/products/plu-bundles/break-bulk-multi', payload);
  return data;
}

// ─── Suggestion engine ─────────────────────────────────────────────────────────

function buildSuggestions(bundles: PluBundle[]): SuggestedBreak[] {
  return bundles
    .filter(b => b.bulkPlu.stockOnHand > 0)
    .map(b => ({
      bundle: b,
      singlesStock: b.singlePlu.stockOnHand,
      bulkStock: b.bulkPlu.stockOnHand,
      urgency: (b.singlePlu.stockOnHand === 0 ? 'critical' : 'low') as 'critical' | 'low',
    }))
    .filter(s => s.singlesStock < s.bundle.conversionQty * 2)
    .sort((a, b) => (a.urgency === 'critical' ? -1 : 1));
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function BreakBulkPage() {
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<PluBundle | null>(null);
  const [qty, setQty]             = useState('1');
  const [notes, setNotes]         = useState('');
  const [tab, setTab]             = useState<'break' | 'history' | 'suggestions'>('break');
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: bundles = [], isLoading: loadingBundles } = useQuery({
    queryKey: ['plu-bundles-all'],
    queryFn: fetchAllBundles,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['break-bulk-history', selected?.bulkPluId],
    queryFn: () => fetchHistory(selected?.bulkPluId),
    enabled: tab === 'history' || historyOpen,
  });

  const suggestions = buildSuggestions(bundles);

  const mutation = useMutation({
    mutationFn: doBreakBulk,
    onSuccess: (result) => {
      toast.success(`Broken ${result.bulkQtyBroken} bulk → ${result.singlesCreated} singles`);
      qc.invalidateQueries({ queryKey: ['plu-bundles-all'] });
      qc.invalidateQueries({ queryKey: ['break-bulk-history'] });
      setQty('1');
      setNotes('');
      setSelected(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to break bulk'),
  });

  // Filter bundles by search
  const filtered = bundles.filter(b => {
    const q = search.toLowerCase();
    return (
      b.bulkPlu.product.name.toLowerCase().includes(q) ||
      b.bulkPlu.pluCode.includes(q) ||
      b.bulkPlu.packLabel.toLowerCase().includes(q) ||
      b.singlePlu.pluCode.includes(q)
    );
  });

  function handleSelect(bundle: PluBundle) {
    setSelected(bundle);
    setSearch('');
    setQty('1');
    setNotes('');
  }

  function handleBreak() {
    if (!selected) return;
    const bulkQty = parseInt(qty);
    if (!bulkQty || bulkQty < 1) { toast.error('Enter a valid quantity'); return; }
    if (bulkQty > selected.bulkPlu.stockOnHand) {
      toast.error(`Only ${selected.bulkPlu.stockOnHand} in stock`);
      return;
    }
    mutation.mutate({
      bulkPluId: selected.bulkPluId,
      bulkQty,
      targets: [{ bundleId: selected.id, singlesQty: bulkQty * selected.conversionQty }],
      notes: notes.trim() || undefined,
    });
  }

  const singlesAfter = selected
    ? selected.singlePlu.stockOnHand + (parseInt(qty) || 0) * selected.conversionQty
    : 0;
  const bulkAfter = selected
    ? selected.bulkPlu.stockOnHand - (parseInt(qty) || 0)
    : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <SplitSquareHorizontal className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Break Bulk</h1>
            <p className="text-sm text-gray-500">Convert cases / bulk units into individual pieces</p>
          </div>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['plu-bundles-all'] })}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['break', 'history', 'suggestions'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'suggestions' ? `Suggestions${suggestions.length ? ` (${suggestions.length})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── BREAK TAB ── */}
      {tab === 'break' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: search + select */}
          <div className="space-y-3">
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Barcode className="w-4 h-4 text-gray-500" />
                Select Bulk Item
              </h2>

              {selected ? (
                <div className="flex items-start justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div>
                    <p className="font-semibold text-blue-900">{selected.bulkPlu.product.name}</p>
                    <p className="text-sm text-blue-600">{selected.bulkPlu.packLabel} · {selected.bulkPlu.pluCode}</p>
                    <p className="text-xs text-blue-500 mt-0.5">Stock: <strong>{selected.bulkPlu.stockOnHand}</strong> bulk units</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 text-blue-400 hover:text-blue-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, PLU code or scan barcode…"
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              )}

              {!selected && search.length > 0 && (
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                  {loadingBundles && (
                    <p className="text-sm text-gray-400 p-3">Loading…</p>
                  )}
                  {!loadingBundles && filtered.length === 0 && (
                    <p className="text-sm text-gray-400 p-3">No bulk items found</p>
                  )}
                  {filtered.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleSelect(b)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{b.bulkPlu.product.name}</p>
                          <p className="text-xs text-gray-500">{b.bulkPlu.packLabel} → {b.singlePlu.packLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-700">{b.bulkPlu.stockOnHand} bulk</p>
                          <p className="text-xs text-gray-400">×{b.conversionQty}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!selected && search.length === 0 && (
                <div className="text-center py-6 text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Search or scan a bulk item to get started</p>
                </div>
              )}
            </div>

            {/* All bundles quick list */}
            {!selected && search.length === 0 && (
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">All Bulk Items ({bundles.length})</h3>
                <div className="divide-y max-h-64 overflow-y-auto">
                  {bundles.map(b => (
                    <button
                      key={b.id}
                      onClick={() => handleSelect(b)}
                      className="w-full text-left px-2 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{b.bulkPlu.product.name}</p>
                          <p className="text-xs text-gray-500">{b.bulkPlu.packLabel} → {b.singlePlu.packLabel} · 1 = {b.conversionQty} pcs</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            b.bulkPlu.stockOnHand === 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {b.bulkPlu.stockOnHand} bulk
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {bundles.length === 0 && !loadingBundles && (
                    <p className="text-sm text-gray-400 py-4 text-center">No bulk bundles configured</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: break form */}
          <div className="space-y-3">
            {selected ? (
              <>
                {/* Conversion summary */}
                <div className="bg-white rounded-xl border p-4 space-y-4">
                  <h2 className="font-semibold text-gray-800">Conversion Details</h2>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-orange-600 font-medium mb-1">Bulk (source)</p>
                      <p className="font-bold text-orange-900">{selected.bulkPlu.packLabel}</p>
                      <p className="text-xs text-orange-500">{selected.bulkPlu.pluCode}</p>
                      <p className="text-lg font-bold text-orange-700 mt-1">{selected.bulkPlu.stockOnHand}</p>
                      <p className="text-xs text-orange-500">in stock</p>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-400 font-medium">×{selected.conversionQty}</span>
                    </div>

                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-600 font-medium mb-1">Singles (result)</p>
                      <p className="font-bold text-green-900">{selected.singlePlu.packLabel}</p>
                      <p className="text-xs text-green-500">{selected.singlePlu.pluCode}</p>
                      <p className="text-lg font-bold text-green-700 mt-1">{selected.singlePlu.stockOnHand}</p>
                      <p className="text-xs text-green-500">in stock</p>
                    </div>
                  </div>

                  {selected.notes && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{selected.notes}</p>
                  )}
                </div>

                {/* Break form */}
                <div className="bg-white rounded-xl border p-4 space-y-4">
                  <h2 className="font-semibold text-gray-800">Break Quantity</h2>

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">
                      How many bulk units to break?
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selected.bulkPlu.stockOnHand}
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
                    />
                    <div className="flex gap-2 mt-2">
                      {[1, 2, 5, 10].filter(n => n <= selected.bulkPlu.stockOnHand).map(n => (
                        <button
                          key={n}
                          onClick={() => setQty(String(n))}
                          className={`flex-1 py-1 text-xs rounded-md border transition-colors ${
                            qty === String(n)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setQty(String(selected.bulkPlu.stockOnHand))}
                        className={`flex-1 py-1 text-xs rounded-md border transition-colors ${
                          qty === String(selected.bulkPlu.stockOnHand)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        All
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  {parseInt(qty) > 0 && parseInt(qty) <= selected.bulkPlu.stockOnHand && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-700">After breaking {qty} unit{parseInt(qty) > 1 ? 's' : ''}:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Bulk stock</p>
                          <p className="text-sm font-bold text-gray-700">
                            {selected.bulkPlu.stockOnHand} → <span className={bulkAfter === 0 ? 'text-red-600' : 'text-gray-900'}>{bulkAfter}</span>
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Singles stock</p>
                          <p className="text-sm font-bold text-gray-700">
                            {selected.singlePlu.stockOnHand} → <span className="text-green-600">{singlesAfter}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 text-center">
                        +{(parseInt(qty) || 0) * selected.conversionQty} singles will be added
                      </p>
                    </div>
                  )}

                  {parseInt(qty) > selected.bulkPlu.stockOnHand && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p className="text-xs">Only {selected.bulkPlu.stockOnHand} bulk units available</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Notes (optional)</label>
                    <input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Opened for shelf stocking"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={handleBreak}
                    disabled={mutation.isPending || !parseInt(qty) || parseInt(qty) > selected.bulkPlu.stockOnHand}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <SplitSquareHorizontal className="w-4 h-4" />
                    {mutation.isPending ? 'Breaking…' : `Break ${qty || '0'} × ${selected.bulkPlu.packLabel}`}
                  </button>
                </div>

                {/* Per-item history toggle */}
                <div className="bg-white rounded-xl border">
                  <button
                    onClick={() => setHistoryOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                  >
                    <span className="flex items-center gap-2"><History className="w-4 h-4" /> History for this item</span>
                    {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {historyOpen && (
                    <div className="border-t divide-y max-h-48 overflow-y-auto">
                      {loadingHistory && <p className="text-sm text-gray-400 p-3">Loading…</p>}
                      {!loadingHistory && history.length === 0 && (
                        <p className="text-sm text-gray-400 p-3 text-center">No history yet</p>
                      )}
                      {history.map(h => (
                        <div key={h.id} className="px-4 py-2.5 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {h.bulkQtyBroken} bulk → {h.singlesCreated} singles
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {h.createdByName && <><User className="w-3 h-3 ml-1" />{h.createdByName}</>}
                            </div>
                            {h.notes && <p className="text-xs text-gray-400 italic">{h.notes}</p>}
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border p-8 flex flex-col items-center justify-center text-center text-gray-400 h-full min-h-[200px]">
                <SplitSquareHorizontal className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium">Select a bulk item to break</p>
                <p className="text-sm mt-1">Search by name or scan barcode on the left</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <History className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-800">All Break Bulk Operations</h2>
          </div>
          {loadingHistory ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No break bulk operations yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {history.map(h => (
                <div key={h.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {h.bulkQtyBroken} bulk units → {h.singlesCreated} singles
                    </p>
                    {h.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{h.notes}"</p>}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {new Date(h.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {h.createdByName && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <User className="w-3 h-3" />
                          {h.createdByName}
                        </span>
                      )}
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUGGESTIONS TAB ── */}
      {tab === 'suggestions' && (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <p className="font-medium text-gray-600">All singles are well stocked</p>
              <p className="text-sm mt-1">No urgent breaks needed right now</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                These items have bulk stock available but singles are running low.
              </p>
              {suggestions.map(s => (
                <div
                  key={s.bundle.id}
                  className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-4 ${
                    s.urgency === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {s.urgency === 'critical' ? (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">OUT OF SINGLES</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">LOW SINGLES</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{s.bundle.bulkPlu.product.name}</p>
                    <p className="text-xs text-gray-500">
                      {s.bundle.bulkPlu.packLabel} → {s.bundle.singlePlu.packLabel} · 1 = {s.bundle.conversionQty} pcs
                    </p>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-gray-600">Bulk stock: <strong>{s.bulkStock}</strong></span>
                      <span className={s.singlesStock === 0 ? 'text-red-600 font-bold' : 'text-gray-600'}>
                        Singles: <strong>{s.singlesStock}</strong>
                      </span>
                      <span className="text-green-600">Break 1 → +{s.bundle.conversionQty} singles</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { handleSelect(s.bundle); setTab('break'); }}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      s.urgency === 'critical'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                  >
                    Break Now
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
