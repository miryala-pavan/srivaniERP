'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  SplitSquareHorizontal, Search, Package, ArrowRight, Plus, Trash2,
  History, AlertTriangle, CheckCircle2, RefreshCw, X, Clock, User,
  Scale, Box, Layers, ChevronDown, ChevronUp, Settings,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Plu {
  id: string; pluCode: string; displayName: string | null; stockOnHand: number;
  product: { name: string };
  asBulk?: {
    id: string; type: string; conversionQty: number;
    bulkWeightG: number | null; unitWeightG: number | null;
    singlePlu: { id: string; pluCode: string; displayName: string | null; stockOnHand: number };
  } | null;
  asSingle?: { unitWeightG: number | null }[];
}

interface OutputLine {
  key: string;
  targetPlu: Plu | null;
  qty: string;
  unitWeightG: string;
  notes: string;
  searching: boolean;
  searchQ: string;
  results: Plu[];
}

interface RepackSession {
  id: string; sessionNo: string; sourcePluId: string; sourceQty: number;
  type: string; wastageG: number; wastageNotes: string | null;
  notes: string | null; createdByName: string | null; createdAt: string;
  lines: { id: string; targetPluId: string; qty: number; unitWeightG: number | null; totalWeightG: number | null }[];
}

function pluLabel(p: { displayName: string | null; pluCode: string }) {
  return p.displayName ?? p.pluCode;
}

function newLine(): OutputLine {
  return { key: Math.random().toString(36).slice(2), targetPlu: null, qty: '', unitWeightG: '', notes: '', searching: false, searchQ: '', results: [] };
}

// ─── API ─────────────────────────────────────────────────────────────────────

const searchSource = (q: string) => api.get(`/repack/search/source?q=${encodeURIComponent(q)}`).then(r => r.data as Plu[]);
const searchTarget = (q: string, exclude: string) => api.get(`/repack/search/target?q=${encodeURIComponent(q)}&exclude=${exclude}`).then(r => r.data as Plu[]);
const fetchBundles = () => api.get('/repack/bundles').then(r => r.data);
const fetchSessions = (sourcePluId?: string) => api.get(`/repack/sessions${sourcePluId ? `?sourcePluId=${sourcePluId}` : ''}`).then(r => r.data as RepackSession[]);
const fetchWastage = (from?: string, to?: string) => api.get(`/repack/wastage-report${from ? `?from=${from}&to=${to ?? ''}` : ''}`).then(r => r.data);

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function BreakBulkPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'fixed' | 'variable' | 'history' | 'wastage'>('fixed');

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <SplitSquareHorizontal className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Repack / Break Bulk</h1>
          <p className="text-sm text-gray-500">Convert bulk units into packs — fixed cartons or variable weighable goods</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {[
          { key: 'fixed',    label: 'Fixed Break',     icon: Box },
          { key: 'variable', label: 'Variable Repack',  icon: Scale },
          { key: 'history',  label: 'History',          icon: History },
          { key: 'wastage',  label: 'Wastage Report',   icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'fixed'    && <FixedBreakTab qc={qc} />}
      {tab === 'variable' && <VariableRepackTab qc={qc} />}
      {tab === 'history'  && <HistoryTab />}
      {tab === 'wastage'  && <WastageTab />}
    </div>
  );
}

// ─── FIXED BREAK TAB ─────────────────────────────────────────────────────────

function FixedBreakTab({ qc }: { qc: any }) {
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState<Plu[]>([]);
  const [selected, setSelected]     = useState<Plu | null>(null);
  const [qty, setQty]               = useState('1');
  const [wastageQty, setWastageQty] = useState('');
  const [wastageNote, setWastageNote] = useState('');
  const [notes, setNotes]           = useState('');
  const [searching, setSearching]   = useState(false);
  const debounceRef = useRef<any>(null);

  const { data: allBundles = [] } = useQuery({ queryKey: ['repack-bundles'], queryFn: fetchBundles });
  const bundlesWithFixed = allBundles.filter((b: any) => b.type !== 'VARIABLE');

  const doSearch = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchSource(q)); } finally { setSearching(false); }
    }, 250);
  }, []);

  const bundle = selected?.asBulk;
  const qtyNum = parseInt(qty) || 0;
  const singlesWillAdd = bundle ? qtyNum * bundle.conversionQty : 0;
  const wastageNum = parseInt(wastageQty) || 0;

  const mutation = useMutation({
    mutationFn: (body: any) => api.post('/repack/sessions', body).then(r => r.data),
    onSuccess: (res) => {
      toast.success(`Session ${res.sessionNo} committed — ${singlesWillAdd} units added`);
      qc.invalidateQueries({ queryKey: ['repack-bundles'] });
      qc.invalidateQueries({ queryKey: ['repack-sessions'] });
      setSelected(null); setSearch(''); setQty('1'); setWastageQty(''); setNotes('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  function handleCommit() {
    if (!selected || !bundle) return;
    if (qtyNum < 1) { toast.error('Enter quantity'); return; }
    if (qtyNum > Number(selected.stockOnHand)) { toast.error('Not enough stock'); return; }
    mutation.mutate({
      sourcePluId: selected.id,
      sourceQty: qtyNum,
      type: 'FIXED',
      lines: [{ targetPluId: bundle.singlePlu.id, qty: singlesWillAdd - wastageNum }],
      wastageG: wastageNum,
      wastageNotes: wastageNote || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: search */}
      <div className="space-y-3">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-500" /> Select Item to Break
          </h2>
          {selected ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between">
              <div>
                <p className="font-semibold text-blue-900">{selected.product.name}</p>
                <p className="text-sm text-blue-600">{pluLabel(selected)} · {selected.pluCode}</p>
                <p className="text-xs text-blue-400 mt-0.5">Stock: {Number(selected.stockOnHand)} units</p>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-4 h-4 text-blue-400" /></button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input autoFocus value={search}
                  onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }}
                  placeholder="Search by name, PLU code or barcode…"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {search && (
                <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                  {searching && <p className="text-sm text-gray-400 p-3">Searching…</p>}
                  {!searching && results.length === 0 && <p className="text-sm text-gray-400 p-3">No items found</p>}
                  {results.filter(r => r.asBulk).map(r => (
                    <button key={r.id} onClick={() => { setSelected(r); setSearch(''); setResults([]); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50">
                      <div className="flex justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.product.name}</p>
                          <p className="text-xs text-gray-500">{pluLabel(r)} → {pluLabel(r.asBulk!.singlePlu)} · ×{r.asBulk!.conversionQty}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full self-center ${Number(r.stockOnHand) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {Number(r.stockOnHand)} in stock
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* All configured bundles */}
        {!selected && !search && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" /> Configured Fixed Bundles ({bundlesWithFixed.length})
            </h3>
            <div className="divide-y max-h-64 overflow-y-auto">
              {bundlesWithFixed.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">No fixed bundles set up yet.<br/>Go to a product PLU and configure a bundle.</p>
              )}
              {bundlesWithFixed.map((b: any) => (
                <button key={b.id}
                  onClick={() => setSelected({ ...b.bulkPlu, asBulk: { ...b, singlePlu: b.singlePlu } })}
                  className="w-full text-left px-2 py-2.5 hover:bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.bulkPlu.product.name}</p>
                      <p className="text-xs text-gray-500">{pluLabel(b.bulkPlu)} → {pluLabel(b.singlePlu)} · 1 = {b.conversionQty} pcs</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${Number(b.bulkPlu.stockOnHand) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {Number(b.bulkPlu.stockOnHand)} bulk
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: break form */}
      <div className="space-y-3">
        {selected && bundle ? (
          <>
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold text-gray-800">Conversion</h2>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-500 font-medium mb-1">Bulk (open)</p>
                  <p className="font-bold text-orange-900 truncate">{pluLabel(selected)}</p>
                  <p className="text-lg font-bold text-orange-700 mt-1">{Number(selected.stockOnHand)}</p>
                  <p className="text-xs text-orange-400">in stock</p>
                </div>
                <div className="text-center">
                  <ArrowRight className="w-5 h-5 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-400 font-bold mt-0.5">×{bundle.conversionQty}</p>
                </div>
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-500 font-medium mb-1">Single (adds)</p>
                  <p className="font-bold text-green-900 truncate">{pluLabel(bundle.singlePlu)}</p>
                  <p className="text-lg font-bold text-green-700 mt-1">{Number(bundle.singlePlu.stockOnHand)}</p>
                  <p className="text-xs text-green-400">in stock</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Qty to break</label>
                <input type="number" min="1" max={Number(selected.stockOnHand)} value={qty}
                  onChange={e => setQty(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="flex gap-2 mt-2">
                  {[1,2,5,10].filter(n => n <= Number(selected.stockOnHand)).map(n => (
                    <button key={n} onClick={() => setQty(String(n))}
                      className={`flex-1 py-1 text-xs rounded-md border transition-colors ${qty === String(n) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setQty(String(Number(selected.stockOnHand)))}
                    className={`flex-1 py-1 text-xs rounded-md border transition-colors ${qty === String(Number(selected.stockOnHand)) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                    All
                  </button>
                </div>
              </div>

              {qtyNum > 0 && qtyNum <= Number(selected.stockOnHand) && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Will deduct</span>
                    <span className="font-semibold text-orange-700">{qtyNum} × {pluLabel(selected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Will add</span>
                    <span className="font-semibold text-green-700">{singlesWillAdd - wastageNum} × {pluLabel(bundle.singlePlu)}</span>
                  </div>
                  {wastageNum > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Wastage</span>
                      <span className="font-semibold text-red-600">{wastageNum} units lost</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Wastage (units)</label>
                  <input type="number" min="0" value={wastageQty} onChange={e => setWastageQty(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Wastage reason</label>
                  <input value={wastageNote} onChange={e => setWastageNote(e.target.value)}
                    placeholder="e.g. Damaged"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Session notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <button onClick={handleCommit}
                disabled={mutation.isPending || !qtyNum || qtyNum > Number(selected.stockOnHand)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <SplitSquareHorizontal className="w-4 h-4" />
                {mutation.isPending ? 'Committing…' : `Break ${qtyNum} × ${pluLabel(selected)}`}
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400 min-h-[200px] flex flex-col items-center justify-center">
            <Box className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Select an item on the left</p>
            <p className="text-sm mt-1">Fixed bundles have pre-set conversion ratios</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── VARIABLE REPACK TAB ──────────────────────────────────────────────────────

function VariableRepackTab({ qc }: { qc: any }) {
  const [sourceSearch, setSourceSearch]   = useState('');
  const [sourceResults, setSourceResults] = useState<Plu[]>([]);
  const [sourcePlu, setSourcePlu]         = useState<Plu | null>(null);
  const [sourceQty, setSourceQty]         = useState('1');
  const [bulkWeightG, setBulkWeightG]     = useState('');
  const [lines, setLines]                 = useState<OutputLine[]>([newLine()]);
  const [wastageG, setWastageG]           = useState('');
  const [wastageNote, setWastageNote]     = useState('');
  const [notes, setNotes]                 = useState('');
  const [searching, setSearching]         = useState(false);
  const debounceRef = useRef<any>(null);

  const sourceQtyNum  = parseFloat(sourceQty) || 0;
  const bulkWeightNum = parseFloat(bulkWeightG) || 0;
  const totalInputG   = sourceQtyNum * bulkWeightNum;
  const totalOutputG  = lines.reduce((s, l) => {
    const q = parseFloat(l.qty) || 0;
    const w = parseFloat(l.unitWeightG) || 0;
    return s + q * w;
  }, 0);
  const wastageNum    = parseFloat(wastageG) || 0;
  const remainderG    = totalInputG - totalOutputG - wastageNum;
  const balancePct    = totalInputG > 0 ? Math.min(100, ((totalOutputG + wastageNum) / totalInputG) * 100) : 0;

  const doSourceSearch = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setSourceResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setSourceResults(await searchSource(q)); } finally { setSearching(false); }
    }, 250);
  }, []);

  async function doLineSearch(key: string, q: string) {
    if (!sourcePlu) return;
    setLines(ls => ls.map(l => l.key === key ? { ...l, searchQ: q, searching: true } : l));
    const res = await searchTarget(q, sourcePlu.id);
    setLines(ls => ls.map(l => l.key === key ? { ...l, results: res, searching: false } : l));
  }

  function setLinePlu(key: string, plu: Plu) {
    // Auto-fill unitWeightG from bundle config if available
    const uw = plu.asSingle?.[0]?.unitWeightG;
    setLines(ls => ls.map(l => l.key === key
      ? { ...l, targetPlu: plu, searchQ: '', results: [], unitWeightG: uw ? String(Number(uw)) : l.unitWeightG }
      : l));
  }

  function updateLine(key: string, field: keyof OutputLine, value: any) {
    setLines(ls => ls.map(l => l.key === key ? { ...l, [field]: value } : l));
  }

  function removeLine(key: string) {
    setLines(ls => ls.length > 1 ? ls.filter(l => l.key !== key) : ls);
  }

  const mutation = useMutation({
    mutationFn: (body: any) => api.post('/repack/sessions', body).then(r => r.data),
    onSuccess: (res) => {
      toast.success(`Session ${res.sessionNo} committed`);
      qc.invalidateQueries({ queryKey: ['repack-sessions'] });
      setSourcePlu(null); setSourceSearch(''); setSourceQty('1');
      setBulkWeightG(''); setLines([newLine()]); setWastageG(''); setNotes('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  function handleCommit() {
    if (!sourcePlu) { toast.error('Select source item'); return; }
    if (sourceQtyNum < 1) { toast.error('Enter quantity to open'); return; }
    const validLines = lines.filter(l => l.targetPlu && parseFloat(l.qty) > 0);
    if (validLines.length === 0) { toast.error('Add at least one output line'); return; }
    mutation.mutate({
      sourcePluId: sourcePlu.id,
      sourceQty: sourceQtyNum,
      type: 'VARIABLE',
      lines: validLines.map(l => ({
        targetPluId: l.targetPlu!.id,
        qty: parseFloat(l.qty),
        unitWeightG: parseFloat(l.unitWeightG) || undefined,
        notes: l.notes || undefined,
      })),
      wastageG: wastageNum || undefined,
      wastageNotes: wastageNote || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <div className="space-y-4">
      {/* Source selection */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Scale className="w-4 h-4 text-amber-500" /> Source (Bulk Item)
        </h2>
        {sourcePlu ? (
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-3 flex justify-between">
              <div>
                <p className="font-semibold text-amber-900">{sourcePlu.product.name}</p>
                <p className="text-sm text-amber-600">{pluLabel(sourcePlu)} · {sourcePlu.pluCode}</p>
                <p className="text-xs text-amber-400 mt-0.5">Stock: {Number(sourcePlu.stockOnHand)} units</p>
              </div>
              <button onClick={() => setSourcePlu(null)}><X className="w-4 h-4 text-amber-400" /></button>
            </div>
            <div className="flex gap-2 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Units to open</label>
                <input type="number" min="1" value={sourceQty} onChange={e => setSourceQty(e.target.value)}
                  className="w-24 px-2 py-2 border rounded-lg text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Unit weight (g)</label>
                <input type="number" min="0" value={bulkWeightG} onChange={e => setBulkWeightG(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-28 px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input autoFocus value={sourceSearch}
                onChange={e => { setSourceSearch(e.target.value); doSourceSearch(e.target.value); }}
                placeholder="Search bulk item (e.g. Sugar 50kg Bag)…"
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            {sourceSearch && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {searching && <p className="p-3 text-sm text-gray-400">Searching…</p>}
                {!searching && sourceResults.length === 0 && <p className="p-3 text-sm text-gray-400">No items found</p>}
                {sourceResults.map(r => (
                  <button key={r.id} onClick={() => { setSourcePlu(r); setSourceSearch(''); setSourceResults([]); setBulkWeightG(r.asBulk?.bulkWeightG ? String(Number(r.asBulk.bulkWeightG)) : ''); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.product.name}</p>
                        <p className="text-xs text-gray-500">{pluLabel(r)} · {r.pluCode}</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 self-center">{Number(r.stockOnHand)} in stock</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {totalInputG > 0 && (
          <div className="mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700 font-medium">
            Total to account for: {(totalInputG / 1000).toFixed(3)} kg ({totalInputG.toFixed(0)}g)
          </div>
        )}
      </div>

      {/* Output lines */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Output Packs</h2>
          <button onClick={() => setLines(ls => [...ls, newLine()])}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Add pack size
          </button>
        </div>

        {lines.map((line, idx) => (
          <div key={line.key} className="border rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Pack {idx + 1}</span>
              {lines.length > 1 && (
                <button onClick={() => removeLine(line.key)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                </button>
              )}
            </div>

            {/* PLU picker */}
            {line.targetPlu ? (
              <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{line.targetPlu.product.name}</p>
                  <p className="text-xs text-gray-500">{pluLabel(line.targetPlu)}</p>
                </div>
                <button onClick={() => updateLine(line.key, 'targetPlu', null)}>
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input value={line.searchQ}
                  onChange={e => { updateLine(line.key, 'searchQ', e.target.value); doLineSearch(line.key, e.target.value); }}
                  placeholder="Search pack PLU…"
                  disabled={!sourcePlu}
                  className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100" />
                {line.results.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg divide-y max-h-40 overflow-y-auto">
                    {line.results.map(r => (
                      <button key={r.id} onClick={() => setLinePlu(line.key, r)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                        <span className="font-medium text-gray-900">{r.product.name}</span>
                        <span className="text-gray-500 ml-2">{pluLabel(r)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-0.5">Qty produced</label>
                <input type="number" min="0" value={line.qty} onChange={e => updateLine(line.key, 'qty', e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-0.5">Unit weight (g)</label>
                <input type="number" min="0" value={line.unitWeightG} onChange={e => updateLine(line.key, 'unitWeightG', e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {totalInputG > 0 && parseFloat(line.qty) > 0 && parseFloat(line.unitWeightG) > 0 && (
                <div className="self-end pb-1.5 text-xs text-gray-500 whitespace-nowrap">
                  = {((parseFloat(line.qty) * parseFloat(line.unitWeightG)) / 1000).toFixed(2)}kg
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Wastage */}
        <div className="border-t pt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-red-600 block mb-1">Wastage (g)</label>
            <input type="number" min="0" value={wastageG} onChange={e => setWastageG(e.target.value)}
              placeholder="0"
              className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
          <div>
            <label className="text-xs font-medium text-red-600 block mb-1">Wastage reason</label>
            <input value={wastageNote} onChange={e => setWastageNote(e.target.value)}
              placeholder="e.g. Spillage, moisture"
              className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
          </div>
        </div>
      </div>

      {/* Weight balance */}
      {totalInputG > 0 && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">Weight Balance</h2>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-xs text-amber-600 font-medium">Opened</p>
              <p className="font-bold text-amber-900">{(totalInputG / 1000).toFixed(3)} kg</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-xs text-blue-600 font-medium">Packed</p>
              <p className="font-bold text-blue-900">{(totalOutputG / 1000).toFixed(3)} kg</p>
            </div>
            <div className={`rounded-lg p-2 ${Math.abs(remainderG) < 1 ? 'bg-green-50' : remainderG < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <p className={`text-xs font-medium ${Math.abs(remainderG) < 1 ? 'text-green-600' : remainderG < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {Math.abs(remainderG) < 1 ? '✓ Balanced' : remainderG < 0 ? '⚠ Over' : 'Unaccounted'}
              </p>
              <p className={`font-bold ${remainderG < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                {(Math.abs(remainderG) / 1000).toFixed(3)} kg
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div className="h-full bg-blue-400 transition-all" style={{ width: `${Math.min(100, (totalOutputG / totalInputG) * 100)}%` }} />
              <div className="h-full bg-red-400 transition-all" style={{ width: `${Math.min(100 - (totalOutputG / totalInputG) * 100, (wastageNum / totalInputG) * 100)}%` }} />
            </div>
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span><span className="inline-block w-2 h-2 bg-blue-400 rounded-sm mr-1" />Packed {balancePct.toFixed(0)}%</span>
            {wastageNum > 0 && <span><span className="inline-block w-2 h-2 bg-red-400 rounded-sm mr-1" />Wastage {((wastageNum / totalInputG) * 100).toFixed(1)}%</span>}
          </div>

          {remainderG < -1 && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
              ⚠ Output exceeds input by {(Math.abs(remainderG) / 1000).toFixed(3)}kg — reduce quantities or check unit weights
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Session notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={handleCommit}
          disabled={mutation.isPending || !sourcePlu || sourceQtyNum < 1}
          className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
          <Scale className="w-4 h-4" />
          {mutation.isPending ? 'Committing…' : 'Commit Repack Session'}
        </button>
      </div>
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['repack-sessions'],
    queryFn: () => fetchSessions(),
  });

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <History className="w-4 h-4 text-gray-500" />
        <h2 className="font-semibold text-gray-800">All Repack Sessions</h2>
      </div>
      {isLoading ? (
        <p className="p-8 text-center text-gray-400">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No sessions yet</p>
        </div>
      ) : (
        <div className="divide-y">
          {sessions.map((s: RepackSession) => (
            <div key={s.id} className="px-4 py-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-900">{s.sessionNo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.type === 'FIXED' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.type}
                    </span>
                    {Number(s.wastageG) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
                        Wastage: {Number(s.wastageG) >= 1000 ? `${(Number(s.wastageG) / 1000).toFixed(2)}kg` : `${Number(s.wastageG)}g`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Opened {Number(s.sourceQty)} units → {s.lines.length} output line{s.lines.length !== 1 ? 's' : ''}</p>
                  {s.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{s.notes}"</p>}
                </div>
                <div className="text-right text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(s.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {s.createdByName && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" />{s.createdByName}
                    </div>
                  )}
                </div>
              </div>
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

  const totalWastageG = report.reduce((s: number, r: any) => s + r.totalWastageG, 0);

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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Filter
        </button>
        {totalWastageG > 0 && (
          <div className="ml-auto bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-red-500 font-medium">Total Wastage</p>
            <p className="text-lg font-bold text-red-700">{(totalWastageG / 1000).toFixed(3)} kg</p>
          </div>
        )}
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
            <p>No wastage recorded in this period</p>
          </div>
        ) : (
          <div className="divide-y">
            {report.map((r: any) => (
              <div key={r.sourcePluId} className="px-4 py-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-800">PLU: {r.sourcePluId}</p>
                  <span className="text-sm font-bold text-red-600">
                    {r.totalWastageG >= 1000 ? `${(r.totalWastageG / 1000).toFixed(3)} kg` : `${r.totalWastageG} g`}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{r.sessions.length} session{r.sessions.length !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
