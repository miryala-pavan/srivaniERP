'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
  SplitSquareHorizontal, Search, Package, ArrowRight, Plus, Trash2,
  History, AlertTriangle, CheckCircle2, X, Clock, User,
  Scale, Box, Undo2, AlertCircle, ChevronRight, Zap, Settings2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BundleInfo {
  id: string; type: string; conversionQty: number;
  bulkWeightG: number | null; unitWeightG: number | null;
  singlePlu: { id: string; pluCode: string; displayName: string | null; stockOnHand: number };
}

interface Plu {
  id: string; pluCode: string; displayName: string | null; stockOnHand: number; costPrice?: number | null;
  product: { name: string };
  asBulk?: BundleInfo[] | null;
  asSingle?: { unitWeightG: number | null }[];
  // UOM
  measureType?: string | null; unitSymbol?: string | null;
  unitSize?: number | null; baseUnitQty?: number | null;
}

interface OutputLine {
  key: string; targetPlu: Plu | null; qty: string;
  unitWeightG: string; notes: string; searchQ: string; results: Plu[];
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
  return { key: Math.random().toString(36).slice(2), targetPlu: null, qty: '', unitWeightG: '', notes: '', searchQ: '', results: [] };
}

// ─── API ─────────────────────────────────────────────────────────────────────

const searchAny    = (q: string) => api.get(`/repack/search/any?q=${encodeURIComponent(q)}`).then(r => r.data as Plu[]);
const searchTarget = (q: string, exclude: string) => api.get(`/repack/search/target?q=${encodeURIComponent(q)}&exclude=${exclude}`).then(r => r.data as Plu[]);
const fetchBundles = () => api.get('/repack/bundles').then(r => r.data);
const fetchSessions = () => api.get('/repack/sessions').then(r => r.data as RepackSession[]);
const fetchWastage  = (from?: string, to?: string) => api.get(`/repack/wastage-report${from ? `?from=${from}&to=${to ?? ''}` : ''}`).then(r => r.data);

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
          <h1 className="text-xl font-bold text-gray-900">Break Bulk / Repack</h1>
          <p className="text-sm text-gray-500">Open a box, split a bag, or repack by weight — all in one place</p>
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

// ─── NEW SESSION TAB ─────────────────────────────────────────────────────────

type Phase = 'search' | 'type-select' | 'setup' | 'execute-fixed' | 'execute-variable';

function NewSessionTab({ qc }: { qc: any }) {
  const [phase, setPhase]           = useState<Phase>('search');
  const [sourcePlu, setSourcePlu]   = useState<Plu | null>(null);
  const [bundle, setBundle]         = useState<BundleInfo | null>(null);
  const [breakType, setBreakType]   = useState<'FIXED' | 'VARIABLE' | null>(null);

  // Search
  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState<Plu[]>([]);
  const [searching, setSearching]   = useState(false);
  const debounce = useRef<any>(null);

  // Inline setup (when no bundle configured)
  const [setupType, setSetupType]         = useState<'FIXED' | 'VARIABLE'>('FIXED');
  const [setupQty, setSetupQty]           = useState('1');
  const [setupWeightG, setSetupWeightG]   = useState('');
  const [setupUnitWG, setSetupUnitWG]     = useState('');
  const [setupSingle, setSetupSingle]     = useState<Plu | null>(null);
  const [setupSearch, setSetupSearch]     = useState('');
  const [setupResults, setSetupResults]   = useState<Plu[]>([]);
  const [setupSearching, setSetupSearching] = useState(false);
  const [savingSetup, setSavingSetup]     = useState(false);
  const setupDebounce = useRef<any>(null);

  // Fixed execute
  const [qty, setQty]                   = useState('1');
  const [wastageUnits, setWastageUnits] = useState('');
  const [wastageNote, setWastageNote]   = useState('');
  const [notes, setNotes]               = useState('');

  // Variable execute
  const [sourceQty, setSourceQty]     = useState('1');
  const [bulkWeightG, setBulkWeightG] = useState('');
  const [lines, setLines]             = useState<OutputLine[]>([newLine()]);
  const [wastageG, setWastageG]       = useState('');
  const [varWasteNote, setVarWasteNote] = useState('');
  const [varNotes, setVarNotes]       = useState('');

  const { data: allBundles = [] } = useQuery({ queryKey: ['repack-bundles'], queryFn: fetchBundles });

  // ── Search ─────────────────────────────────────────────────────────────────

  const doSearch = useCallback((q: string) => {
    clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchAny(q)); } finally { setSearching(false); }
    }, 250);
  }, []);

  const doSetupSearch = useCallback((q: string) => {
    clearTimeout(setupDebounce.current);
    setSetupSearch(q);
    if (!q.trim()) { setSetupResults([]); return; }
    setupDebounce.current = setTimeout(async () => {
      setSetupSearching(true);
      try { setSetupResults(await searchTarget(q, sourcePlu?.id ?? '')); }
      finally { setSetupSearching(false); }
    }, 250);
  }, [sourcePlu]);

  // ── Select PLU ─────────────────────────────────────────────────────────────

  function selectPlu(plu: Plu) {
    setSourcePlu(plu);
    setSearch('');
    setResults([]);
    const fixed    = (plu.asBulk ?? []).filter(b => b.type !== 'VARIABLE');
    const variable = (plu.asBulk ?? []).filter(b => b.type === 'VARIABLE');

    if (fixed.length === 1 && variable.length === 0) {
      // Only one fixed bundle — go straight to execute
      setBundle(fixed[0]);
      setBreakType('FIXED');
      setPhase('execute-fixed');
    } else if (variable.length === 1 && fixed.length === 0) {
      // Only one variable bundle — go straight to execute
      setBundle(variable[0]);
      setBreakType('VARIABLE');
      if (variable[0].bulkWeightG) setBulkWeightG(String(Number(variable[0].bulkWeightG)));
      setPhase('execute-variable');
    } else {
      // Multiple bundles or no bundle — let user pick type
      setPhase('type-select');
    }
  }

  function selectType(type: 'FIXED' | 'VARIABLE') {
    setBreakType(type);
    const match = (sourcePlu?.asBulk ?? []).find(b =>
      type === 'FIXED' ? b.type !== 'VARIABLE' : b.type === 'VARIABLE'
    );
    if (match) {
      setBundle(match);
      if (type === 'VARIABLE' && match.bulkWeightG) setBulkWeightG(String(Number(match.bulkWeightG)));
      setPhase(type === 'FIXED' ? 'execute-fixed' : 'execute-variable');
    } else {
      setSetupType(type);
      // Auto-fill bulk weight from PLU's stored baseUnitQty (e.g. 50kg bag → 50000g)
      if (type === 'VARIABLE' && sourcePlu?.baseUnitQty) {
        setSetupWeightG(String(Number(sourcePlu.baseUnitQty)));
      }
      setPhase('setup');
    }
  }

  function reset() {
    setPhase('search'); setSourcePlu(null); setBundle(null); setBreakType(null);
    setSearch(''); setResults([]);
    setSetupType('FIXED'); setSetupQty('1'); setSetupWeightG(''); setSetupUnitWG('');
    setSetupSingle(null); setSetupSearch(''); setSetupResults([]);
    setQty('1'); setWastageUnits(''); setWastageNote(''); setNotes('');
    setSourceQty('1'); setBulkWeightG(''); setLines([newLine()]);
    setWastageG(''); setVarWasteNote(''); setVarNotes('');
  }

  // ── Save inline bundle + proceed ───────────────────────────────────────────

  async function saveSetupAndContinue() {
    if (!sourcePlu) return;
    if (setupType === 'FIXED') {
      if (!setupSingle) { toast.error('Search and select the single unit PLU'); return; }
      if (!parseInt(setupQty) || parseInt(setupQty) < 1) { toast.error('Enter conversion quantity'); return; }
    } else {
      if (!parseFloat(setupWeightG)) { toast.error('Enter total weight of this bulk unit'); return; }
    }
    setSavingSetup(true);
    try {
      const payload: any = {
        bulkPluId: sourcePlu.id,
        singlePluId: setupSingle?.id ?? (setupType === 'VARIABLE' ? sourcePlu.id : ''),
        conversionQty: parseInt(setupQty) || 1,
        type: setupType,
      };
      if (setupType === 'VARIABLE') {
        payload.bulkWeightG = parseFloat(setupWeightG);
        if (setupUnitWG) payload.unitWeightG = parseFloat(setupUnitWG);
        payload.singlePluId = setupSingle?.id ?? sourcePlu.id; // fallback
      }
      const res = await api.post('/products/plu-bundles', payload);
      const savedBundle: BundleInfo = {
        id: res.data.id, type: setupType,
        conversionQty: parseInt(setupQty) || 1,
        bulkWeightG: setupType === 'VARIABLE' ? parseFloat(setupWeightG) : null,
        unitWeightG: setupType === 'VARIABLE' && setupUnitWG ? parseFloat(setupUnitWG) : null,
        singlePlu: setupSingle
          ? { id: setupSingle.id, pluCode: setupSingle.pluCode, displayName: setupSingle.displayName, stockOnHand: Number(setupSingle.stockOnHand) }
          : { id: sourcePlu.id, pluCode: sourcePlu.pluCode, displayName: sourcePlu.displayName, stockOnHand: Number(sourcePlu.stockOnHand) },
      };
      setBundle(savedBundle);
      qc.invalidateQueries({ queryKey: ['repack-bundles'] });
      toast.success('Bundle configured — ready to break');
      if (setupType === 'VARIABLE' && setupWeightG) setBulkWeightG(setupWeightG);
      setPhase(setupType === 'FIXED' ? 'execute-fixed' : 'execute-variable');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save bundle');
    } finally { setSavingSetup(false); }
  }

  // ── Fixed execute ──────────────────────────────────────────────────────────

  const qtyNum  = parseInt(qty) || 0;
  const wasteN  = parseInt(wastageUnits) || 0;
  const singlesOut = bundle ? Math.max(0, qtyNum * bundle.conversionQty - wasteN) : 0;

  const fixedMutation = useMutation({
    mutationFn: (body: any) => api.post('/repack/sessions', body).then(r => r.data),
    onSuccess: (res) => {
      toast.success(`Session ${res.sessionNo} done — ${singlesOut} units added`);
      qc.invalidateQueries({ queryKey: ['repack-bundles'] });
      qc.invalidateQueries({ queryKey: ['repack-sessions'] });
      reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  function commitFixed() {
    if (!sourcePlu || !bundle) return;
    if (qtyNum < 1) { toast.error('Enter quantity to break'); return; }
    if (qtyNum > Number(sourcePlu.stockOnHand)) { toast.error('Not enough stock'); return; }
    if (wasteN >= qtyNum * bundle.conversionQty) { toast.error('Wastage cannot exceed total output'); return; }
    fixedMutation.mutate({
      sourcePluId: sourcePlu.id,
      sourceQty: qtyNum,
      type: 'FIXED',
      lines: singlesOut > 0 ? [{ targetPluId: bundle.singlePlu.id, qty: singlesOut }] : [],
      wastageUnits: wasteN || undefined,
      wastageNotes: wastageNote || undefined,
      notes: notes || undefined,
    });
  }

  // ── Variable execute ───────────────────────────────────────────────────────

  const sourceQtyNum  = parseFloat(sourceQty) || 0;
  const bulkWeightNum = parseFloat(bulkWeightG) || 0;
  const totalInputG   = sourceQtyNum * bulkWeightNum;
  const totalOutputG  = lines.reduce((s, l) => s + (parseFloat(l.qty)||0) * (parseFloat(l.unitWeightG)||0), 0);
  const wastageGNum   = parseFloat(wastageG) || 0;
  const remainderG    = totalInputG - totalOutputG - wastageGNum;
  const isOverweight  = totalInputG > 0 && remainderG < -1;

  async function doLineSearch(key: string, q: string) {
    if (!sourcePlu) return;
    setLines(ls => ls.map(l => l.key === key ? { ...l, searchQ: q } : l));
    if (!q.trim()) { setLines(ls => ls.map(l => l.key === key ? { ...l, results: [] } : l)); return; }
    const res = await searchTarget(q, sourcePlu.id);
    setLines(ls => ls.map(l => l.key === key ? { ...l, results: res } : l));
  }

  function setLinePlu(key: string, plu: Plu) {
    const uw = plu.asSingle?.[0]?.unitWeightG ?? plu.baseUnitQty ?? null;
    setLines(ls => ls.map(l => l.key === key
      ? { ...l, targetPlu: plu, searchQ: '', results: [], unitWeightG: uw ? String(Number(uw)) : l.unitWeightG }
      : l));
  }

  const varMutation = useMutation({
    mutationFn: (body: any) => api.post('/repack/sessions', body).then(r => r.data),
    onSuccess: (res) => {
      toast.success(`Session ${res.sessionNo} committed`);
      qc.invalidateQueries({ queryKey: ['repack-sessions'] });
      reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  function commitVariable() {
    if (!sourcePlu) { toast.error('Select source item'); return; }
    if (sourceQtyNum <= 0) { toast.error('Enter quantity to open'); return; }
    if (isOverweight) { toast.error('Output exceeds input — reduce quantities'); return; }
    const validLines = lines.filter(l => l.targetPlu && parseFloat(l.qty) > 0);
    if (validLines.length === 0) { toast.error('Add at least one output line'); return; }
    varMutation.mutate({
      sourcePluId: sourcePlu.id,
      sourceQty: sourceQtyNum,
      type: 'VARIABLE',
      bulkWeightG: bulkWeightNum || undefined,
      lines: validLines.map(l => ({
        targetPluId: l.targetPlu!.id,
        qty: parseFloat(l.qty),
        unitWeightG: parseFloat(l.unitWeightG) || undefined,
        notes: l.notes || undefined,
      })),
      wastageG: wastageGNum || undefined,
      wastageNotes: varWasteNote || undefined,
      notes: varNotes || undefined,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Breadcrumb progress bar ── */}
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
          {phase === 'execute-fixed' && (
            <><ChevronRight className="w-3.5 h-3.5 text-gray-300" />
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">📦 Fixed Break</span></>
          )}
          {phase === 'execute-variable' && (
            <><ChevronRight className="w-3.5 h-3.5 text-gray-300" />
            <span className="text-xs font-medium text-gray-600 bg-amber-100 px-2 py-1 rounded-lg">⚖️ Variable Repack</span></>
          )}
        </div>
      )}

      {/* ══ PHASE: SEARCH ══════════════════════════════════════════════════════ */}
      {phase === 'search' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#1B4F8A]" /> What do you want to break or repack?
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input autoFocus value={search}
                onChange={e => { setSearch(e.target.value); doSearch(e.target.value); }}
                placeholder="Search by product name, PLU code or barcode…"
                className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {search && (
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {searching && <p className="p-3 text-sm text-gray-400">Searching…</p>}
                {!searching && results.length === 0 && <p className="p-3 text-sm text-gray-400">No products found</p>}
                {results.map(r => {
                  const fixed    = (r.asBulk ?? []).filter(b => b.type !== 'VARIABLE');
                  const variable = (r.asBulk ?? []).filter(b => b.type === 'VARIABLE');
                  const hasBundle = fixed.length > 0 || variable.length > 0;
                  return (
                    <button key={r.id} onClick={() => selectPlu(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.product.name}</p>
                        <p className="text-xs text-gray-500">{label(r)} · {r.pluCode}</p>
                        {hasBundle && (
                          <div className="flex gap-1 mt-1">
                            {fixed.length > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">📦 Fixed ×{fixed[0].conversionQty}</span>}
                            {variable.length > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">⚖️ Variable</span>}
                          </div>
                        )}
                        {!hasBundle && <span className="text-[10px] text-gray-400 mt-0.5 block">Not configured yet — set up on next step</span>}
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-3 ${Number(r.stockOnHand) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {Number(r.stockOnHand)} in stock
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick-pick: all configured bundles */}
          {!search && allBundles.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Pick — Configured Bundles
              </h3>
              <div className="divide-y max-h-72 overflow-y-auto">
                {allBundles.map((b: any) => (
                  <button key={b.id}
                    onClick={() => {
                      const plu: Plu = { ...b.bulkPlu, asBulk: [b] };
                      setSourcePlu(plu);
                      setBundle(b);
                      if (b.type === 'VARIABLE') {
                        setBreakType('VARIABLE');
                        if (b.bulkWeightG) setBulkWeightG(String(Number(b.bulkWeightG)));
                        setPhase('execute-variable');
                      } else {
                        setBreakType('FIXED');
                        setPhase('execute-fixed');
                      }
                    }}
                    className="w-full text-left px-2 py-2.5 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg ${b.type === 'VARIABLE' ? '' : ''}`}>
                        {b.type === 'VARIABLE' ? '⚖️' : '📦'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.bulkPlu.product.name}</p>
                        <p className="text-xs text-gray-500">
                          {label(b.bulkPlu)}
                          {b.type !== 'VARIABLE'
                            ? ` → ${b.conversionQty} × ${label(b.singlePlu)}`
                            : ` → variable (${b.bulkWeightG ? (Number(b.bulkWeightG)/1000).toFixed(1)+'kg' : 'any weight'})`
                          }
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${Number(b.bulkPlu.stockOnHand) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {Number(b.bulkPlu.stockOnHand)} bulk
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ PHASE: TYPE SELECT ════════════════════════════════════════════════ */}
      {phase === 'type-select' && sourcePlu && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">How do you want to break this?</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Fixed card */}
            <button onClick={() => selectType('FIXED')}
              className="p-4 rounded-xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 text-left transition-colors group">
              <div className="text-2xl mb-2">📦</div>
              <div className="font-bold text-gray-800 group-hover:text-blue-700">Fixed Carton / Box</div>
              <div className="text-xs text-gray-500 mt-1">Always the same number of units per box</div>
              <div className="text-xs text-blue-600 font-medium mt-2">e.g. 1 carton = 12 bottles</div>
              {(sourcePlu.asBulk ?? []).filter(b => b.type !== 'VARIABLE').length > 0 && (
                <div className="mt-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                  ✓ Already configured
                </div>
              )}
            </button>
            {/* Variable card */}
            <button onClick={() => selectType('VARIABLE')}
              className="p-4 rounded-xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 text-left transition-colors group">
              <div className="text-2xl mb-2">⚖️</div>
              <div className="font-bold text-gray-800 group-hover:text-amber-700">Variable / Weighable</div>
              <div className="text-xs text-gray-500 mt-1">Split into any mix of sizes at repack time</div>
              <div className="text-xs text-amber-600 font-medium mt-2">e.g. 50kg bag → 1kg, 500g, loose</div>
              {(sourcePlu.asBulk ?? []).filter(b => b.type === 'VARIABLE').length > 0 && (
                <div className="mt-2 text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
                  ✓ Already configured
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ══ PHASE: INLINE SETUP ═══════════════════════════════════════════════ */}
      {phase === 'setup' && sourcePlu && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="bg-gray-50 border-b px-4 py-3 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-700 text-sm">
              {setupType === 'FIXED' ? '📦 Set up Fixed Break' : '⚖️ Set up Variable Repack'}
            </span>
            <span className="text-xs text-gray-400 ml-1">— saves for future use</span>
          </div>
          <div className="p-4 space-y-4">
            {setupType === 'FIXED' ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  How many single units does 1 bulk item contain? This ratio will be used every time you break this item.
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm font-semibold text-orange-800 whitespace-nowrap">
                    1 × {label(sourcePlu)}
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                  <input type="number" min="1" value={setupQty}
                    onChange={e => setSetupQty(e.target.value)}
                    className="w-20 px-3 py-2 border rounded-lg text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="text-sm text-gray-600 whitespace-nowrap">singles</span>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Single unit PLU *</label>
                  {setupSingle ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-green-900">{productName(setupSingle)}</p>
                        <p className="text-xs text-green-600">{label(setupSingle)} · stock: {Number(setupSingle.stockOnHand)}</p>
                      </div>
                      <button onClick={() => { setSetupSingle(null); setSetupSearch(''); setSetupResults([]); }}>
                        <X className="w-4 h-4 text-green-400" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input autoFocus value={setupSearch}
                        onChange={e => doSetupSearch(e.target.value)}
                        placeholder="Search across all products…"
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {setupSearch && (
                        <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg divide-y max-h-44 overflow-y-auto">
                          {setupSearching && <p className="p-3 text-sm text-gray-400">Searching…</p>}
                          {!setupSearching && setupResults.length === 0 && <p className="p-3 text-sm text-gray-400">No PLUs found</p>}
                          {setupResults.map(r => (
                            <button key={r.id} onClick={() => { setSetupSingle(r); setSetupSearch(''); setSetupResults([]); }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50">
                              <p className="text-sm font-medium text-gray-900">{productName(r)}</p>
                              <p className="text-xs text-gray-500">{label(r)} · stock: {Number(r.stockOnHand)}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {setupQty && setupSingle && parseInt(setupQty) > 1 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                    ✓ Each break: 1 × {label(sourcePlu)} → {setupQty} × {label(setupSingle)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                  Enter the total weight of one bulk unit. At repack time, you'll decide how to split it.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Total weight of 1 bulk unit *</label>
                    <div className="relative">
                      <input type="number" min="1" value={setupWeightG}
                        onChange={e => setSetupWeightG(e.target.value)}
                        className="w-full pr-8 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="e.g. 50000" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
                    </div>
                    {setupWeightG && <p className="text-xs text-gray-400 mt-0.5">= {(parseFloat(setupWeightG)/1000).toFixed(2)} kg</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Default pack size (optional)</label>
                    <div className="relative">
                      <input type="number" min="1" value={setupUnitWG}
                        onChange={e => setSetupUnitWG(e.target.value)}
                        className="w-full pr-8 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="e.g. 1000" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
                    </div>
                    {setupUnitWG && setupWeightG && (
                      <p className="text-xs text-gray-400 mt-0.5">Max {Math.floor(parseFloat(setupWeightG)/parseFloat(setupUnitWG))} packs</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Default output PLU (optional)</label>
                  {setupSingle ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-green-900">{productName(setupSingle)}</p>
                        <p className="text-xs text-green-600">{label(setupSingle)}</p>
                      </div>
                      <button onClick={() => { setSetupSingle(null); setSetupSearch(''); setSetupResults([]); }}>
                        <X className="w-4 h-4 text-green-400" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={setupSearch}
                        onChange={e => doSetupSearch(e.target.value)}
                        placeholder="Optional — you can pick at repack time"
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      {setupSearch && setupResults.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg divide-y max-h-44 overflow-y-auto">
                          {setupResults.map(r => (
                            <button key={r.id} onClick={() => { setSetupSingle(r); setSetupSearch(''); setSetupResults([]); }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50">
                              <p className="text-sm font-medium text-gray-900">{productName(r)}</p>
                              <p className="text-xs text-gray-500">{label(r)}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">You can output to any PLU at repack time — this is just a default suggestion.</p>
                </div>
              </>
            )}
          </div>
          <div className="px-4 pb-4 flex gap-3">
            <button onClick={() => setPhase('type-select')}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">← Back</button>
            <button onClick={saveSetupAndContinue} disabled={savingSetup}
              className={`flex-1 py-2.5 text-sm text-white rounded-xl font-semibold disabled:opacity-60 ${setupType === 'FIXED' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
              {savingSetup ? 'Saving…' : 'Save & Start Breaking →'}
            </button>
          </div>
        </div>
      )}

      {/* ══ PHASE: EXECUTE FIXED ══════════════════════════════════════════════ */}
      {phase === 'execute-fixed' && sourcePlu && bundle && (
        <div className="space-y-3">
          {/* Conversion summary */}
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <p className="text-xs text-orange-500 font-medium mb-1">Bulk (deducted)</p>
                <p className="font-bold text-orange-900 text-sm truncate">{productName(sourcePlu)}</p>
                <p className="text-xs text-orange-600 mt-0.5 truncate">{label(sourcePlu)}</p>
                <p className="text-2xl font-bold text-orange-700 mt-2">{Number(sourcePlu.stockOnHand)}</p>
                <p className="text-xs text-orange-400">in stock</p>
              </div>
              <div className="text-center shrink-0">
                <ArrowRight className="w-5 h-5 text-gray-300 mx-auto" />
                <p className="text-xs font-bold text-gray-500 mt-1">×{bundle.conversionQty}</p>
              </div>
              <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-xs text-green-500 font-medium mb-1">Single (added)</p>
                <p className="font-bold text-green-900 text-sm truncate">{productName(bundle.singlePlu)}</p>
                <p className="text-xs text-green-600 mt-0.5 truncate">{label(bundle.singlePlu)}</p>
                <p className="text-2xl font-bold text-green-700 mt-2">{Number(bundle.singlePlu.stockOnHand)}</p>
                <p className="text-xs text-green-400">in stock</p>
              </div>
            </div>
          </div>

          {/* Break form */}
          <div className="bg-white rounded-xl border p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">How many bulk units to break?</label>
              <input type="number" min="1" max={Number(sourcePlu.stockOnHand)} value={qty}
                onChange={e => setQty(e.target.value)}
                className="w-full px-3 py-3 border rounded-xl text-center text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 mt-2">
                {[1, 2, 5, 10].filter(n => n <= Number(sourcePlu.stockOnHand)).map(n => (
                  <button key={n} onClick={() => setQty(String(n))}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${qty === String(n) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setQty(String(Math.floor(Number(sourcePlu.stockOnHand))))}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${qty === String(Math.floor(Number(sourcePlu.stockOnHand))) ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                  All
                </button>
              </div>
            </div>

            {qtyNum > 0 && qtyNum <= Number(sourcePlu.stockOnHand) && (
              <div className="bg-blue-50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Deduct from {label(sourcePlu)}</span>
                  <span className="font-semibold text-orange-700">−{qtyNum} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Add to {label(bundle.singlePlu)}</span>
                  <span className="font-semibold text-green-700">+{singlesOut} units</span>
                </div>
                {wasteN > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Wastage</span>
                    <span className="font-semibold text-red-600">{wasteN} units lost</span>
                  </div>
                )}
                {Number(sourcePlu.costPrice) > 0 && bundle.conversionQty > 0 && (
                  <div className="flex justify-between border-t border-blue-200 pt-1.5 mt-1">
                    <span className="text-gray-600">Cost per single will update to</span>
                    <span className="font-semibold text-blue-700">
                      ₹{(Number(sourcePlu.costPrice) / bundle.conversionQty).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Wastage units (optional)</label>
                <input type="number" min="0" value={wastageUnits} onChange={e => setWastageUnits(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Reason (optional)</label>
                <input value={wastageNote} onChange={e => setWastageNote(e.target.value)}
                  placeholder="e.g. Damaged"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Session notes (optional)</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={commitFixed}
              disabled={fixedMutation.isPending || !qtyNum || qtyNum > Number(sourcePlu.stockOnHand)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <SplitSquareHorizontal className="w-4 h-4" />
              {fixedMutation.isPending ? 'Processing…' : `Break ${qtyNum || '?'} × ${label(sourcePlu)} → ${singlesOut} singles`}
            </button>
          </div>
        </div>
      )}

      {/* ══ PHASE: EXECUTE VARIABLE ═══════════════════════════════════════════ */}
      {phase === 'execute-variable' && sourcePlu && (
        <div className="space-y-3">
          {/* Source + quantity */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-500" /> How much are you opening?
            </h2>
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Units to open</label>
                <input type="number" min="0.001" step="0.001" value={sourceQty}
                  onChange={e => setSourceQty(e.target.value)}
                  className="w-24 px-2 py-2 border rounded-lg text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                <p className="text-xs text-gray-400 mt-0.5">Stock: {Number(sourcePlu.stockOnHand)}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Weight per unit (g)</label>
                <input type="number" min="0" value={bulkWeightG}
                  onChange={e => setBulkWeightG(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-32 px-2 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                {bulkWeightG && <p className="text-xs text-gray-400 mt-0.5">= {(parseFloat(bulkWeightG)/1000).toFixed(2)} kg each</p>}
              </div>
              {totalInputG > 0 && (
                <div className="self-end pb-1 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
                  Total: {(totalInputG/1000).toFixed(2)} kg to account for
                </div>
              )}
            </div>
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
                      <p className="text-xs text-gray-500">{label(line.targetPlu)}</p>
                    </div>
                    <button onClick={() => setLines(ls => ls.map(l => l.key === line.key ? { ...l, targetPlu: null, searchQ: '' } : l))}>
                      <X className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input value={line.searchQ}
                      onChange={e => { setLines(ls => ls.map(l => l.key === line.key ? { ...l, searchQ: e.target.value } : l)); doLineSearch(line.key, e.target.value); }}
                      placeholder="Search output PLU…"
                      disabled={!sourcePlu}
                      className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100" />
                    {line.results.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg divide-y max-h-40 overflow-y-auto">
                        {line.results.map(r => (
                          <button key={r.id} onClick={() => setLinePlu(line.key, r)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                            <span className="font-medium text-gray-900">{productName(r)}</span>
                            <span className="text-gray-500 ml-2">{label(r)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-0.5">Qty produced</label>
                    <input type="number" min="0" value={line.qty}
                      onChange={e => setLines(ls => ls.map(l => l.key === line.key ? { ...l, qty: e.target.value } : l))}
                      placeholder="0"
                      className="w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-0.5">Unit weight (g)</label>
                    <input type="number" min="0" value={line.unitWeightG}
                      onChange={e => setLines(ls => ls.map(l => l.key === line.key ? { ...l, unitWeightG: e.target.value } : l))}
                      placeholder="e.g. 1000"
                      className="w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  {parseFloat(line.qty) > 0 && parseFloat(line.unitWeightG) > 0 && (
                    <div className="self-end pb-1.5 text-xs text-gray-500 whitespace-nowrap">
                      = {((parseFloat(line.qty)*parseFloat(line.unitWeightG))/1000).toFixed(2)} kg
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Wastage */}
            <div className="border-t pt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-red-500 block mb-1">Wastage (g)</label>
                <input type="number" min="0" value={wastageG} onChange={e => setWastageG(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-red-500 block mb-1">Reason</label>
                <input value={varWasteNote} onChange={e => setVarWasteNote(e.target.value)}
                  placeholder="e.g. Spillage"
                  className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
            </div>
          </div>

          {/* Weight balance */}
          {totalInputG > 0 && (
            <div className={`rounded-xl border p-4 space-y-3 ${isOverweight ? 'bg-red-50 border-red-300' : 'bg-white'}`}>
              <h2 className="font-semibold text-gray-800 text-sm">Weight Balance</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-600 font-medium">Opened</p>
                  <p className="font-bold text-amber-900">{(totalInputG/1000).toFixed(2)} kg</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-medium">Packed</p>
                  <p className="font-bold text-blue-900">{(totalOutputG/1000).toFixed(2)} kg</p>
                </div>
                <div className={`rounded-xl p-3 ${Math.abs(remainderG) < 1 ? 'bg-green-50' : isOverweight ? 'bg-red-100' : 'bg-gray-50'}`}>
                  <p className={`text-xs font-medium ${Math.abs(remainderG) < 1 ? 'text-green-600' : isOverweight ? 'text-red-700' : 'text-gray-600'}`}>
                    {Math.abs(remainderG) < 1 ? '✓ Balanced' : isOverweight ? '✗ OVER' : 'Remaining'}
                  </p>
                  <p className={`font-bold ${isOverweight ? 'text-red-700' : 'text-gray-700'}`}>
                    {(Math.abs(remainderG)/1000).toFixed(2)} kg
                  </p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div className="h-full bg-blue-400 transition-all" style={{ width: `${Math.min(100, (totalOutputG/totalInputG)*100)}%` }} />
                  <div className="h-full bg-red-400 transition-all" style={{ width: `${Math.min(100-(totalOutputG/totalInputG)*100, (wastageGNum/totalInputG)*100)}%` }} />
                </div>
              </div>
              {isOverweight && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-100 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Output exceeds input by <strong>{(Math.abs(remainderG)/1000).toFixed(2)} kg</strong> — reduce pack quantities.</span>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Session notes (optional)</label>
              <input value={varNotes} onChange={e => setVarNotes(e.target.value)} placeholder="Optional"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={commitVariable}
              disabled={varMutation.isPending || !sourcePlu || sourceQtyNum <= 0 || isOverweight}
              className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Scale className="w-4 h-4" />
              {varMutation.isPending ? 'Processing…' : 'Commit Repack Session'}
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
                      {s.type === 'FIXED' ? '📦 FIXED' : '⚖️ VARIABLE'}
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
