'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  SplitSquareHorizontal, Search, Package, Plus, Trash2,
  History, AlertTriangle, CheckCircle2, X, Clock, User,
  Undo2, AlertCircle, ChevronRight, Zap,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Plu {
  id: string; pluCode: string; displayName: string | null; stockOnHand: number; costPrice?: number | null;
  product: { id: string; name: string };
  // UOM
  measureType?: string | null; unitSymbol?: string | null;
  unitSize?: number | null; baseUnitQty?: number | null;
}

interface OutputLine {
  key: string; targetPlu: Plu | null; qty: string; notes: string;
}

interface RepackSession {
  id: string; sessionNo: string; sourcePluId: string; sourceQty: number;
  type: string; wastageG: number; wastageUnits: number; wastageNotes: string | null;
  notes: string | null; reversed: boolean; reversedAt: string | null;
  reversedByName: string | null; createdByName: string | null; createdAt: string;
  sourcePlu?: { id: string; pluCode: string; displayName: string | null; product: { name: string } } | null;
  lines: { id: string; targetPluId: string; qty: number; totalWeightG: number | null;
    targetPlu?: { id: string; pluCode: string; displayName: string | null; product: { name: string } } | null }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function label(p: { displayName?: string | null; pluCode: string } | null | undefined) {
  if (!p) return '—';
  return p.displayName ?? p.pluCode;
}
function productName(p: { displayName?: string | null; pluCode: string; product?: { name: string } } | null | undefined) {
  return (p as any)?.product?.name ?? label(p);
}
function newLine(): OutputLine {
  return { key: Math.random().toString(36).slice(2), targetPlu: null, qty: '', notes: '' };
}
// Formats a base-unit quantity (grams/ml/pieces) using the PLU's own measure — no hardcoded kg/g assumption.
function fmtBase(v: number, plu: Plu | null | undefined) {
  if (!plu) return String(v);
  if (plu.measureType === 'WEIGHT' || plu.measureType === 'VOLUME') {
    const smallUnit = plu.measureType === 'WEIGHT' ? 'g' : 'ml';
    const bigUnit    = plu.measureType === 'WEIGHT' ? 'kg' : 'L';
    return v >= 1000 ? `${(v / 1000).toFixed(2)} ${bigUnit}` : `${v.toFixed(0)} ${smallUnit}`;
  }
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)} ${plu.unitSymbol ?? 'pcs'}`;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const searchAny        = (q: string) => api.get(`/repack/search/any?q=${encodeURIComponent(q)}`).then(r => r.data as Plu[]);
const searchTarget     = (q: string, exclude: string) => api.get(`/repack/search/target?q=${encodeURIComponent(q)}&exclude=${exclude}`).then(r => r.data as Plu[]);
const fetchRecentPairs = () => api.get('/repack/recent-pairs').then(r => r.data as { sourcePlu: Plu; targetPlu: Plu }[]);
const fetchSessions    = () => api.get('/repack/sessions').then(r => r.data as RepackSession[]);
const fetchWastage     = (from?: string, to?: string) => api.get(`/repack/wastage-report${from ? `?from=${from}&to=${to ?? ''}` : ''}`).then(r => r.data);

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BreakBulkPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'session' | 'history' | 'wastage'>('session');

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <SplitSquareHorizontal className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Break Bulk</h1>
          <p className="text-sm text-gray-500">Open a bulk item and split it into the pack sizes you sell</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { key: 'session', label: 'New Session',     icon: Zap },
          { key: 'history', label: 'History',         icon: History },
          { key: 'wastage', label: 'Wastage Report',  icon: AlertTriangle },
        ] as const).map(({ key, label: l, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />{l}
          </button>
        ))}
      </div>

      {tab === 'session' && <NewSessionTab qc={qc} />}
      {tab === 'history' && <HistoryTab qc={qc} />}
      {tab === 'wastage' && <WastageTab />}
    </div>
  );
}

// ─── Reusable PLU search box (source picker + each output line's target picker) ──

function PluSearchBox({ placeholder, searchFn, onSelect, autoFocus }: {
  placeholder: string;
  searchFn: (q: string) => Promise<Plu[]>;
  onSelect: (plu: Plu) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState<Plu[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<any>(null);

  function onChange(v: string) {
    setQ(v);
    clearTimeout(debounce.current);
    if (!v.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchFn(v)); } finally { setSearching(false); }
    }, 250);
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input autoFocus={autoFocus} value={q}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {q && (
        <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg divide-y max-h-60 overflow-y-auto">
          {searching && <p className="p-3 text-sm text-gray-400">Searching…</p>}
          {!searching && results.length === 0 && <p className="p-3 text-sm text-gray-400">No products found</p>}
          {results.map(r => (
            <button key={r.id} onClick={() => { onSelect(r); setQ(''); setResults([]); }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">{productName(r)}</p>
                <p className="text-xs text-gray-500">{label(r)} · {r.pluCode}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-3 shrink-0 ${Number(r.stockOnHand) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {Number(r.stockOnHand)} in stock
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NEW SESSION TAB — one flow for every kind of break: pick source, pick packs, confirm ──

type Phase = 'search' | 'lines' | 'confirm';

function NewSessionTab({ qc }: { qc: any }) {
  const [phase, setPhase]         = useState<Phase>('search');
  const [sourcePlu, setSourcePlu] = useState<Plu | null>(null);
  const [sourceQty, setSourceQty] = useState('1');
  const [lines, setLines]         = useState<OutputLine[]>([newLine()]);
  const [wastageNote, setWastageNote] = useState('');
  const [notes, setNotes]         = useState('');

  const { data: recentPairs = [] } = useQuery({ queryKey: ['repack-recent-pairs'], queryFn: fetchRecentPairs });

  function reset() {
    setPhase('search'); setSourcePlu(null); setSourceQty('1'); setLines([newLine()]);
    setWastageNote(''); setNotes('');
  }

  function selectSource(plu: Plu) {
    setSourcePlu(plu);
    setPhase('lines');
  }

  function pickRecentPair(pair: { sourcePlu: Plu; targetPlu: Plu }) {
    setSourcePlu(pair.sourcePlu);
    setLines([{ ...newLine(), targetPlu: pair.targetPlu }]);
    setPhase('lines');
  }

  // ── Base-unit math — the same computation whether it's a carton of bottles or a bag of loose weight ──
  const sourceQtyNum   = parseFloat(sourceQty) || 0;
  const sourceBase     = sourcePlu?.baseUnitQty ? Number(sourcePlu.baseUnitQty) : null;
  const totalInputBase = sourceBase !== null ? sourceQtyNum * sourceBase : null;

  function lineBaseQty(l: OutputLine) {
    const t = l.targetPlu;
    if (!t?.baseUnitQty || t.measureType !== sourcePlu?.measureType) return null;
    return (parseFloat(l.qty) || 0) * Number(t.baseUnitQty);
  }

  function remainingBase(excludeKey: string) {
    if (totalInputBase === null) return null;
    const used = lines.filter(l => l.key !== excludeKey).reduce((s, l) => s + (lineBaseQty(l) ?? 0), 0);
    return totalInputBase - used;
  }

  function setLinePlu(key: string, plu: Plu) {
    setLines(ls => ls.map(l => {
      if (l.key !== key) return l;
      let qty = l.qty;
      // Suggest a quantity from the remaining balance — always editable, never forced.
      if (!qty && plu.baseUnitQty && plu.measureType === sourcePlu?.measureType) {
        const remain = remainingBase(key);
        if (remain !== null && remain > 0) {
          const suggested = Math.floor(remain / Number(plu.baseUnitQty));
          if (suggested > 0) qty = String(suggested);
        }
      }
      return { ...l, targetPlu: plu, qty };
    }));
  }

  const totalOutputBase = lines.reduce((s, l) => s + (lineBaseQty(l) ?? 0), 0);
  const unitTrackable    = sourceBase !== null && lines.some(l => l.targetPlu) &&
    lines.filter(l => l.targetPlu).every(l => l.targetPlu?.baseUnitQty && l.targetPlu.measureType === sourcePlu?.measureType);
  const wastageBase = unitTrackable && totalInputBase !== null ? Math.max(0, totalInputBase - totalOutputBase) : null;
  const tolerance    = totalInputBase ? Math.max(1, totalInputBase * 0.001) : 0;
  const isOverInput  = unitTrackable && totalInputBase !== null && totalOutputBase > totalInputBase + tolerance;

  const validLines = lines.filter(l => l.targetPlu && parseFloat(l.qty) > 0);

  const commitMutation = useMutation({
    mutationFn: (body: any) => api.post('/repack/sessions', body).then(r => r.data),
    onSuccess: (res) => {
      toast.success(`Session ${res.sessionNo} committed`);
      qc.invalidateQueries({ queryKey: ['repack-sessions'] });
      qc.invalidateQueries({ queryKey: ['repack-recent-pairs'] });
      reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  function commit() {
    if (!sourcePlu) return;
    if (validLines.length === 0) { toast.error('Add at least one output line'); return; }
    commitMutation.mutate({
      sourcePluId: sourcePlu.id,
      sourceQty: sourceQtyNum,
      lines: validLines.map(l => ({ targetPluId: l.targetPlu!.id, qty: parseFloat(l.qty), notes: l.notes || undefined })),
      wastageNotes: wastageNote || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <div className="space-y-4">

      {/* ── Breadcrumb ── */}
      {phase !== 'search' && sourcePlu && (
        <div className="bg-white rounded-xl border px-4 py-3 flex items-center gap-2 flex-wrap">
          <button onClick={reset} className="text-xs text-[#1B4F8A] hover:underline font-medium">← New search</button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <div>
              <span className="text-sm font-semibold text-blue-900">{productName(sourcePlu)}</span>
              <span className="text-xs text-blue-500 ml-2">{label(sourcePlu)} · {Number(sourcePlu.stockOnHand)} in stock</span>
            </div>
            <button onClick={reset} className="ml-2 text-blue-300 hover:text-blue-600"><X className="w-3.5 h-3.5" /></button>
          </div>
          {phase === 'confirm' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              <button onClick={() => setPhase('lines')} className="text-xs text-[#1B4F8A] hover:underline font-medium">← Back to edit</button>
            </>
          )}
        </div>
      )}

      {/* ══ STEP 1: SEARCH — pick the bulk item ══════════════════════════════ */}
      {phase === 'search' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#1B4F8A]" /> What are you breaking open?
            </h2>
            <PluSearchBox
              placeholder="Search by product name, PLU code or barcode…"
              searchFn={searchAny}
              onSelect={selectSource}
              autoFocus
            />
          </div>

          {recentPairs.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Pick — Recent Repacks
              </h3>
              <div className="divide-y max-h-72 overflow-y-auto">
                {recentPairs.map((p, i) => (
                  <button key={i} onClick={() => pickRecentPair(p)}
                    className="w-full text-left px-2 py-2.5 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{productName(p.sourcePlu)}</p>
                        <p className="text-xs text-gray-500 truncate">{label(p.sourcePlu)} → {label(p.targetPlu)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${Number(p.sourcePlu.stockOnHand) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {Number(p.sourcePlu.stockOnHand)} bulk
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 2: LINES — how many bulk units, and what packs came out ═════ */}
      {phase === 'lines' && sourcePlu && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <label className="text-sm font-medium text-gray-700 block">How many {label(sourcePlu)} are you opening?</label>
            <input type="number" min="0.001" step="0.001" value={sourceQty}
              onChange={e => setSourceQty(e.target.value)}
              className="w-32 px-3 py-2.5 border rounded-lg text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400">Stock available: {Number(sourcePlu.stockOnHand)}. This amount will be deducted.</p>
          </div>

          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">What packs did you produce?</h2>
              <button onClick={() => setLines(ls => [...ls, newLine()])}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <Plus className="w-4 h-4" /> Add pack size
              </button>
            </div>
            <p className="text-xs text-gray-400">Pick each pack product you already sell, and enter how many you got — the quantity is suggested automatically when unit sizes are known, but always editable.</p>

            {lines.map((line, idx) => (
              <div key={line.key} className="border rounded-xl p-3 space-y-2 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Pack {idx + 1}</span>
                  {lines.length > 1 && (
                    <button onClick={() => setLines(ls => ls.filter(l => l.key !== line.key))}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                    </button>
                  )}
                </div>
                {line.targetPlu ? (
                  <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{productName(line.targetPlu)}</p>
                      <p className="text-xs text-gray-500">
                        {label(line.targetPlu)}
                        {line.targetPlu.baseUnitQty ? ` · ${fmtBase(Number(line.targetPlu.baseUnitQty), line.targetPlu)} each` : ''}
                      </p>
                    </div>
                    <button onClick={() => setLines(ls => ls.map(l => l.key === line.key ? { ...l, targetPlu: null } : l))}>
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <PluSearchBox
                    placeholder="Search output pack PLU…"
                    searchFn={(q) => searchTarget(q, sourcePlu.id)}
                    onSelect={(plu) => setLinePlu(line.key, plu)}
                  />
                )}
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Qty produced</label>
                  <input type="number" min="0" value={line.qty}
                    onChange={e => setLines(ls => ls.map(l => l.key === line.key ? { ...l, qty: e.target.value } : l))}
                    placeholder="0"
                    className="w-32 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => setPhase('confirm')}
            disabled={sourceQtyNum <= 0 || validLines.length === 0}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50">
            Review →
          </button>
        </div>
      )}

      {/* ══ STEP 3: CONFIRM — see the balance, commit ════════════════════════ */}
      {phase === 'confirm' && sourcePlu && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 space-y-2">
            <h2 className="font-semibold text-gray-800 text-sm">Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Deduct from {label(sourcePlu)}</span>
              <span className="font-semibold text-orange-700">−{sourceQtyNum} {sourcePlu.unitSymbol ?? 'units'}</span>
            </div>
            {validLines.map(l => (
              <div key={l.key} className="flex justify-between text-sm">
                <span className="text-gray-600">Add to {label(l.targetPlu)}</span>
                <span className="font-semibold text-green-700">+{parseFloat(l.qty)} {l.targetPlu?.unitSymbol ?? 'units'}</span>
              </div>
            ))}
          </div>

          {unitTrackable && totalInputBase !== null ? (
            <div className={`rounded-xl border p-4 space-y-3 ${isOverInput ? 'bg-red-50 border-red-300' : 'bg-white'}`}>
              <h2 className="font-semibold text-gray-800 text-sm">Balance</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-600 font-medium">Opened</p>
                  <p className="font-bold text-amber-900">{fmtBase(totalInputBase, sourcePlu)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-medium">Packed</p>
                  <p className="font-bold text-blue-900">{fmtBase(totalOutputBase, sourcePlu)}</p>
                </div>
                <div className={`rounded-xl p-3 ${isOverInput ? 'bg-red-100' : 'bg-gray-50'}`}>
                  <p className={`text-xs font-medium ${isOverInput ? 'text-red-700' : 'text-gray-600'}`}>
                    {isOverInput ? '✗ OVER' : 'Wastage'}
                  </p>
                  <p className={`font-bold ${isOverInput ? 'text-red-700' : 'text-gray-700'}`}>
                    {fmtBase(wastageBase ?? 0, sourcePlu)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">Wastage is computed automatically as what's left over — spillage, breakage, or short weight. No need to balance it by hand.</p>
              {isOverInput && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-100 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Output exceeds what was opened — reduce a pack quantity.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs text-amber-700">
                Unit size isn't set on one of these products, so wastage can't be tracked automatically for this session — you can still commit.
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Map(
                    [sourcePlu, ...validLines.map(l => l.targetPlu)]
                      .filter((p): p is Plu => !!p && !p.baseUnitQty)
                      .map(p => [p.id, p]),
                  ).values(),
                ).map(p => (
                  <Link key={p.id} href={`/dashboard/products/${p.product.id}/plu`}
                    className="text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-full px-2.5 py-1">
                    Fix unit for {productName(p)} →
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Wastage reason (optional)</label>
              <input value={wastageNote} onChange={e => setWastageNote(e.target.value)}
                placeholder="e.g. Spillage, damaged in transit"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Session notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={commit}
              disabled={commitMutation.isPending || isOverInput}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <SplitSquareHorizontal className="w-4 h-4" />
              {commitMutation.isPending ? 'Processing…' : 'Commit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────

function HistoryTab({ qc }: { qc: any }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['repack-sessions'],
    queryFn: fetchSessions,
  });

  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/repack/sessions/${id}/reverse`, { reason }).then(r => r.data),
    onSuccess: (res) => {
      toast.success(`Session reversed — ${res.reversalSessionNo} created`);
      qc.invalidateQueries({ queryKey: ['repack-sessions'] });
      setReversingId(null); setReverseReason('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Reversal failed'),
  });

  if (isLoading) return <p className="p-8 text-center text-gray-400">Loading…</p>;

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <History className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold text-gray-800">All Repack Sessions</h2>
        <span className="ml-auto text-xs text-gray-400">{sessions.length} sessions</span>
      </div>
      {sessions.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No sessions yet</p>
        </div>
      ) : (
        <div className="divide-y">
          {sessions.map((s: RepackSession) => (
            <div key={s.id} className={`px-4 py-3 ${s.reversed ? 'opacity-60 bg-gray-50' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-gray-900">{s.sessionNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.type === 'FIXED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.type === 'FIXED' ? 'By Count' : 'By Weight'}
                    </span>
                    {s.reversed && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">REVERSED</span>}
                    {s.type === 'FIXED' && Number(s.wastageUnits) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">{Number(s.wastageUnits)} units waste</span>
                    )}
                    {s.type === 'VARIABLE' && Number(s.wastageG) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                        {Number(s.wastageG) >= 1000 ? `${(Number(s.wastageG)/1000).toFixed(2)}kg` : `${Number(s.wastageG)}g`} waste
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-1">
                    {s.sourcePlu ? `${productName(s.sourcePlu)} — ${label(s.sourcePlu)}` : s.sourcePluId}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Opened {Number(s.sourceQty)} units → {s.lines.length} output line{s.lines.length !== 1 ? 's' : ''}
                  </p>
                  {s.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{s.notes}"</p>}
                </div>
                <div className="text-right text-xs text-gray-400 shrink-0 ml-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    {new Date(s.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {s.createdByName && (
                    <div className="flex items-center gap-1 mt-0.5 justify-end">
                      <User className="w-3 h-3" />{s.createdByName}
                    </div>
                  )}
                  <div className="flex gap-1 mt-2 justify-end">
                    <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                      className="text-xs text-blue-600 hover:underline">
                      {expandedId === s.id ? 'Hide' : 'Details'}
                    </button>
                    {!s.reversed && (
                      <button onClick={() => setReversingId(s.id)}
                        className="text-xs text-red-500 hover:underline ml-2 flex items-center gap-0.5">
                        <Undo2 className="w-3 h-3" /> Reverse
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="mt-3 border-t pt-3 space-y-1">
                  {s.lines.map(l => (
                    <div key={l.id} className="flex justify-between text-xs text-gray-600">
                      <span>→ {l.targetPlu ? `${productName(l.targetPlu)} (${label(l.targetPlu)})` : l.targetPluId}</span>
                      <span className="font-medium">
                        {Number(l.qty)} units{l.totalWeightG ? ` · ${(Number(l.totalWeightG)/1000).toFixed(3)} kg` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {reversingId === s.id && (
                <div className="mt-3 border border-red-200 bg-red-50 rounded-xl p-3 space-y-2">
                  <p className="text-sm font-semibold text-red-700">Reverse session {s.sessionNo}?</p>
                  <p className="text-xs text-red-600">This will restore source stock and deduct output stock.</p>
                  <input value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full px-2 py-1.5 border border-red-300 rounded-lg text-sm focus:outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => reverseMutation.mutate({ id: s.id, reason: reverseReason })}
                      disabled={reverseMutation.isPending}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                      {reverseMutation.isPending ? 'Reversing…' : 'Confirm Reverse'}
                    </button>
                    <button onClick={() => { setReversingId(null); setReverseReason(''); }}
                      className="px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-100">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WASTAGE REPORT TAB ───────────────────────────────────────────────────────

function WastageTab() {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  const { data: report = [], isLoading, refetch } = useQuery({
    queryKey: ['repack-wastage', from, to],
    queryFn: () => fetchWastage(from || undefined, to || undefined),
  });

  const totalWastageG     = report.reduce((s: number, r: any) => s + r.totalWastageG, 0);
  const totalWastageUnits = report.reduce((s: number, r: any) => s + r.totalWastageUnits, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4 flex gap-3 items-end flex-wrap">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Filter</button>
        <div className="ml-auto flex gap-3">
          {totalWastageG > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-red-500 font-medium">Variable Wastage</p>
              <p className="text-lg font-bold text-red-700">{(totalWastageG/1000).toFixed(3)} kg</p>
            </div>
          )}
          {totalWastageUnits > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-orange-500 font-medium">Fixed Wastage</p>
              <p className="text-lg font-bold text-orange-700">{totalWastageUnits} units</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="font-semibold text-gray-800">Wastage by Source Item</h2>
        </div>
        {isLoading ? (
          <p className="p-8 text-center text-gray-400">Loading…</p>
        ) : report.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p>No wastage in this period</p>
          </div>
        ) : (
          <div className="divide-y">
            {report.map((r: any) => (
              <div key={r.sourcePluId} className="px-4 py-3 flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {r.sourcePlu ? `${productName(r.sourcePlu)} — ${label(r.sourcePlu)}` : r.sourcePluId}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.sessions.length} session{r.sessions.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right space-y-1">
                  {r.totalWastageG > 0 && (
                    <p className="text-sm font-bold text-red-600">
                      {r.totalWastageG >= 1000 ? `${(r.totalWastageG/1000).toFixed(3)} kg` : `${r.totalWastageG}g`} (variable)
                    </p>
                  )}
                  {r.totalWastageUnits > 0 && (
                    <p className="text-sm font-bold text-orange-600">{r.totalWastageUnits} units (fixed)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
