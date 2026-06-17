'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Hash, CheckCircle2, AlertCircle, ChevronDown, ChevronRight,
  Search, Zap, RefreshCw, Info,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubcategoryStats {
  id: string;
  name: string;
  code: string;
  hsnCode: string | null;
  parentId: string;
  parent: {
    id: string; name: string; code: string;
    departmentId: string | null;
    department: { id: string; name: string; code: string } | null;
  } | null;
  _count: { products: number };
  stats: { matched: number; different: number; unset: number };
}

interface HsnSummary {
  totalSubcategories: number;
  subcatsWithHsn: number;
  subcatsWithoutHsn: number;
  totalProducts: number;
  coveredProducts: number;
  uncoveredProducts: number;
}

interface HsnStatsResponse {
  summary: HsnSummary;
  subcategories: SubcategoryStats[];
}

// ── Common Indian grocery HSN suggestions ─────────────────────────────────────

const HSN_SUGGESTIONS: Record<string, string> = {
  // Grains & Staples (8-digit)
  'rice': '10061090', 'wheat': '10019900', 'atta': '11010000', 'maida': '11010000',
  'rava': '11031100', 'suji': '11031100', 'semolina': '11031100',
  'poha': '10064000', 'oats': '11041200', 'barley': '10030090',
  'corn flour': '11022000', 'besan': '11061000', 'gram flour': '11061000',
  'sabudana': '11081400', 'sago': '11081400',
  // Dal & Pulses (8-digit)
  'toor dal': '07136000', 'toor': '07136000', 'pigeon pea': '07136000',
  'chana dal': '07132000', 'chana': '07132000', 'chickpea': '07132000',
  'moong dal': '07133200', 'moong': '07133200', 'green gram': '07133200',
  'urad dal': '07133100', 'urad': '07133100', 'black gram': '07133100',
  'masoor dal': '07134000', 'masoor': '07134000', 'lentil': '07134000',
  'rajma': '07133400', 'kidney bean': '07133400',
  'chhole': '07132000', 'kabuli chana': '07132000',
  'dal': '07139000', 'pulses': '07139000',
  // Oils (8-digit)
  'sunflower oil': '15121990', 'sunflower': '15121990',
  'groundnut oil': '15089091', 'groundnut': '15089091',
  'coconut oil': '15131910', 'coconut': '15131910',
  'mustard oil': '15149190', 'mustard': '15149190',
  'palm oil': '15119020', 'palm': '15119020',
  'sesame oil': '15159010', 'sesame': '15159010', 'til oil': '15159010',
  'soya oil': '15079010', 'soya': '15079010',
  'rice bran oil': '15179010',
  // Ghee & Dairy (8-digit)
  'ghee': '04059020', 'butter': '04051000',
  'cheese': '04061000', 'paneer': '04061000',
  'milk': '04012000', 'curd': '04031000', 'yogurt': '04031000',
  'dairy cream': '04011000', 'fresh cream': '04011000',
  'buttermilk': '04031000', 'khoa': '04029990', 'mava': '04029990',
  // Sugar, Salt & Sweeteners (8-digit)
  'sugar': '17019910', 'refined sugar': '17019910',
  'jaggery': '17011200', 'gur': '17011200',
  'brown sugar': '17019100',
  'salt': '25010020', 'iodised salt': '25010020',
  'honey': '04090000',
  // Spices (8-digit)
  'black pepper': '09041120', 'pepper': '09041120',
  'turmeric': '09103020', 'haldi': '09103020',
  'cumin': '09093100', 'jeera': '09093100',
  'coriander': '09092100', 'dhania': '09092100',
  'cardamom': '09083110', 'elaichi': '09083110',
  'cloves': '09071000', 'lavang': '09071000',
  'cinnamon': '09061100', 'dalchini': '09061100',
  'chilli': '09041210', 'red chilli': '09041210',
  'chili powder': '09042210', 'chilli powder': '09042210',
  'mustard seed': '12074010', 'rai': '12074010',
  'fenugreek': '09109110', 'methi': '09109110',
  'ajwain': '09099200', 'carom': '09099200',
  'masala': '09109990', 'mixed spice': '09109990',
  'garam masala': '09109990', 'sambar powder': '09109990',
  // Tea & Coffee (8-digit)
  'black tea': '09024090', 'tea': '09024090',
  'green tea': '09021000',
  'coffee': '09011190', 'instant coffee': '21011100',
  // Dry Fruits & Nuts (8-digit)
  'cashew': '08013200', 'kaju': '08013200',
  'almond': '08021200', 'badam': '08021200',
  'walnut': '08023200', 'akhrot': '08023200',
  'peanut': '12024200', 'groundnut seed': '12024200',
  'raisin': '08062010', 'kishmish': '08062010',
  'dates': '08041020', 'khajur': '08041020',
  'fig': '08042010', 'anjeer': '08042010',
  'pistachio': '08025200',
  'dry fruit': '08139040',
  // Snacks & Biscuits (8-digit)
  'biscuit': '19053100', 'cookie': '19053100',
  'cracker': '19053200',
  'chips': '20052000', 'potato chips': '20052000',
  'namkeen': '21069099', 'mixture': '21069099',
  'popcorn': '19049000',
  'wafer': '19053200',
  // Noodles & Pasta (8-digit)
  'noodle': '19021900', 'instant noodle': '19021900',
  'pasta': '19021900', 'vermicelli': '19021900',
  'macaroni': '19021900', 'spaghetti': '19021900',
  // Sauces & Condiments (8-digit)
  'tomato sauce': '21039010', 'ketchup': '21039010', 'sauce': '21039010',
  'pickle': '20011000', 'achaar': '20011000',
  'jam': '20071000', 'jelly': '20071000',
  'vinegar': '22090000',
  'mayonnaise': '21031000',
  // Beverages (8-digit)
  'fruit juice': '20094900', 'juice': '20094900',
  'cold drink': '22021090', 'soft drink': '22021090',
  'cola': '22021090', 'soda': '22021010',
  'packaged water': '22011010', 'water': '22011010',
  'energy drink': '22021090',
  // Personal Care (8-digit)
  'toilet soap': '34011110', 'soap': '34011110',
  'shampoo': '33051010',
  'conditioner': '33051090', 'hair conditioner': '33051090',
  'toothpaste': '33061010', 'toothgel': '33061010',
  'toothbrush': '96032100',
  'face wash': '33049900', 'face cream': '33049100',
  'moisturizer': '33049900', 'cream': '33049900',
  'body lotion': '33049900', 'lotion': '33049900',
  'talc': '33049100', 'talcum': '33049100',
  'deodorant': '33071000',
  'perfume': '33030010',
  'hair oil': '33059010',
  'hair color': '33059090', 'hair dye': '33059090',
  'lip balm': '33041000', 'lipstick': '33041000',
  'eye liner': '33042000',
  // Detergent & Homecare (8-digit)
  'detergent': '34022090', 'washing powder': '34022090',
  'dish wash': '34022090', 'dishwash': '34022090',
  'floor cleaner': '34029019', 'toilet cleaner': '34029019',
  'phenyl': '34029019', 'colin': '34029019',
  'air freshener': '33079090',
  'mosquito repellent': '38089190', 'good knight': '38089190',
  // Baby (8-digit)
  'diaper': '96190010', 'nappy': '96190010',
  'baby food': '19011000',
  'baby oil': '33049900', 'baby powder': '33049100',
  // Tobacco (8-digit)
  'cigarette': '24022090',
  'tobacco': '24039990',
  'pan masala': '21069020',
  'gutka': '24039910',
  // Pooja Items (8-digit)
  'agarbatti': '33074000', 'incense stick': '33074000',
  'dhoop': '33074000',
  'camphor': '29142910',
  'pooja oil': '15159090',
  // Stationery (8-digit)
  'pen': '96081000', 'ball pen': '96081000',
  'pencil': '96091000',
  'notebook': '48201000', 'exercise book': '48201000',
  'paper': '48021000',
  // Electrical (8-digit)
  'led bulb': '85393190', 'bulb': '85393190',
  'battery': '85061090', 'torch battery': '85061090',
  'wire': '85444290',
  // Footwear
  'chappal': '64019990', 'slipper': '64019990',
};

function suggestHsn(subcatName: string): string {
  const lower = subcatName.toLowerCase();
  for (const [keyword, hsn] of Object.entries(HSN_SUGGESTIONS)) {
    if (lower.includes(keyword)) return hsn;
  }
  return '';
}

// ── HSN input cell ────────────────────────────────────────────────────────────

function HsnCell({
  sub,
  localHsn,
  onChange,
  onApply,
  applying,
}: {
  sub: SubcategoryStats;
  localHsn: string;
  onChange: (val: string) => void;
  onApply: (mode: 'ALL' | 'UNSET_ONLY') => void;
  applying: boolean;
}) {
  const suggestion = suggestHsn(sub.name);
  const hasHsn = !!localHsn;
  const isValid = /^\d{2,8}$/.test(localHsn);
  const changed = localHsn !== (sub.hsnCode ?? '');

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          value={localHsn}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder={suggestion ? `e.g. ${suggestion}` : 'HSN code'}
          className={`w-32 border rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-[#1B4F8A] ${
            hasHsn && isValid ? 'border-green-400 bg-green-50' :
            hasHsn && !isValid ? 'border-red-400 bg-red-50' :
            'border-gray-200'
          }`}
        />
        {suggestion && !localHsn && (
          <button
            onClick={() => onChange(suggestion)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-blue-500 bg-blue-50 px-1 py-0.5 rounded hover:bg-blue-100"
            title={`Suggest: ${suggestion}`}
          >
            {suggestion}
          </button>
        )}
      </div>

      {changed && isValid && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onApply('UNSET_ONLY')}
            disabled={applying}
            className="text-xs bg-[#1B4F8A] text-white px-2 py-1.5 rounded-lg hover:bg-[#163d6d] disabled:opacity-50 whitespace-nowrap"
          >
            {applying ? '…' : 'Apply'}
          </button>
          <button
            onClick={() => onApply('ALL')}
            disabled={applying}
            className="text-xs bg-orange-500 text-white px-2 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 whitespace-nowrap"
            title="Override ALL products — even those with a different HSN"
          >
            {applying ? '…' : 'Override All'}
          </button>
        </div>
      )}

      {!changed && hasHsn && (
        <span className="text-xs text-gray-400">
          {sub._count.products}p
          {sub.stats.unset > 0 && (
            <span className="text-amber-500 ml-1">({sub.stats.unset} unset)</span>
          )}
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HsnPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [localHsns, setLocalHsns] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [bulkApplying, setBulkApplying] = useState(false);
  const [showOnlyUnset, setShowOnlyUnset] = useState(false);

  const { data, isLoading, refetch } = useQuery<HsnStatsResponse>({
    queryKey: ['hsn-stats'],
    queryFn: () => api.get('/products/hsn/stats').then((r) => r.data),
  });

  // Seed local HSN state from DB on first load
  useEffect(() => {
    if (!data) return;
    setLocalHsns((prev) => {
      const next: Record<string, string> = {};
      for (const s of data.subcategories) {
        // Only set from DB if user hasn't typed anything yet
        next[s.id] = prev[s.id] !== undefined ? prev[s.id] : (s.hsnCode ?? '');
      }
      return next;
    });
  }, [data]);

  const localHsn = (id: string) => localHsns[id] ?? '';
  const setHsn = (id: string, val: string) => setLocalHsns((p) => ({ ...p, [id]: val }));

  const handleApply = useCallback(async (sub: SubcategoryStats, mode: 'ALL' | 'UNSET_ONLY') => {
    const hsn = localHsns[sub.id] ?? '';
    if (!/^\d{4,8}$/.test(hsn) || ![4, 6, 8].includes(hsn.length)) { toast.error('Enter a valid HSN (4, 6, or 8 digits)'); return; }
    setApplying((p) => ({ ...p, [sub.id]: true }));
    try {
      const res = await api.post(`/products/hsn/apply/${sub.id}`, { hsnCode: hsn, mode });
      toast.success(`HSN ${hsn} applied to ${res.data.updated} products`);
      queryClient.invalidateQueries({ queryKey: ['hsn-stats'] });
    } catch {
      toast.error('Failed to apply HSN');
    } finally {
      setApplying((p) => ({ ...p, [sub.id]: false }));
    }
  }, [localHsns, queryClient]);

  const handleBulkApply = useCallback(async () => {
    if (!data) return;
    const entries = data.subcategories
      .map((s) => ({ subcategoryId: s.id, hsnCode: localHsns[s.id] ?? '' }))
      .filter((e) => /^\d{2,8}$/.test(e.hsnCode));

    if (entries.length === 0) { toast.error('No valid HSN codes to apply'); return; }
    if (!confirm(`Apply HSN to ${entries.length} subcategories (unset products only)?`)) return;

    setBulkApplying(true);
    try {
      const res = await api.post('/products/hsn/bulk-apply', { entries, mode: 'UNSET_ONLY' });
      toast.success(`Updated ${res.data.totalProductsUpdated} products across ${res.data.entriesProcessed} subcategories`);
      queryClient.invalidateQueries({ queryKey: ['hsn-stats'] });
    } catch {
      toast.error('Bulk apply failed');
    } finally {
      setBulkApplying(false);
    }
  }, [data, localHsns, queryClient]);

  // ── Group by dept → category ──────────────────────────────────────────────

  const grouped = useMemo(() => {
    if (!data) return [];
    const subs = data.subcategories.filter((s) => {
      if (showOnlyUnset && s.hsnCode) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (s.hsnCode ?? '').includes(q);
      }
      return true;
    });

    const deptMap = new Map<string, {
      dept: { id: string; name: string; code: string };
      categories: Map<string, { cat: SubcategoryStats['parent']; subs: SubcategoryStats[] }>;
    }>();

    for (const sub of subs) {
      const dept = sub.parent?.department;
      if (!dept) continue;
      if (!deptMap.has(dept.id)) deptMap.set(dept.id, { dept, categories: new Map() });
      const deptEntry = deptMap.get(dept.id)!;
      const catId = sub.parentId;
      if (!deptEntry.categories.has(catId)) deptEntry.categories.set(catId, { cat: sub.parent, subs: [] });
      deptEntry.categories.get(catId)!.subs.push(sub);
    }

    return Array.from(deptMap.values());
  }, [data, search, showOnlyUnset]);

  const toggleDept = (id: string) => setExpandedDepts((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleCat = (id: string) => setExpandedCats((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const expandAll = () => {
    if (!data) return;
    setExpandedDepts(new Set(grouped.map((g) => g.dept.id)));
    setExpandedCats(new Set(data.subcategories.map((s) => s.parentId)));
  };

  const s = data?.summary;
  const pct = s ? Math.round((s.subcatsWithHsn / s.totalSubcategories) * 100) : 0;
  const prodPct = s ? Math.round((s.coveredProducts / s.totalProducts) * 100) : 0;

  const pendingCount = data?.subcategories.filter((s) =>
    localHsns[s.id] && localHsns[s.id] !== (s.hsnCode ?? '') && /^\d{2,8}$/.test(localHsns[s.id])
  ).length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="HSN Codes" />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <Breadcrumbs items={[{ label: 'Inventory' }, { label: 'HSN Codes' }]} />

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Hash className="w-5 h-5 text-[#1B4F8A]" />
              HSN Code Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Set one HSN per subcategory → auto-applies to all products in it
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            {pendingCount > 0 && (
              <button
                onClick={handleBulkApply}
                disabled={bulkApplying}
                className="flex items-center gap-1.5 bg-[#1B4F8A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#163d6d] disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {bulkApplying ? 'Applying…' : `Apply All (${pendingCount})`}
              </button>
            )}
          </div>
        </div>

        {/* ── Progress cards ── */}
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{s.subcatsWithHsn}<span className="text-gray-400 text-base font-normal">/{s.totalSubcategories}</span></div>
              <div className="text-xs text-gray-500 mt-1">Subcategories with HSN</div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-[#1B4F8A] rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
              <div className="text-xs text-[#1B4F8A] mt-1 font-medium">{pct}% done</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{s.coveredProducts}<span className="text-gray-400 text-base font-normal">/{s.totalProducts}</span></div>
              <div className="text-xs text-gray-500 mt-1">Products with correct HSN</div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${prodPct}%` }} /></div>
              <div className="text-xs text-green-600 mt-1 font-medium">{prodPct}% covered</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-amber-600">{s.subcatsWithoutHsn}</div>
              <div className="text-xs text-gray-500 mt-1">Subcategories still need HSN</div>
              <div className="text-xs text-amber-600 mt-3 font-medium">Fill below to fix</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-red-500">{s.uncoveredProducts}</div>
              <div className="text-xs text-gray-500 mt-1">Products still on "0000"</div>
              <div className="text-xs text-red-500 mt-3 font-medium">Will fix after Apply All</div>
            </div>
          </div>
        )}

        {/* ── Info banner ── */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>How it works:</strong> Enter HSN for each subcategory → click <strong>Apply</strong> (fills products with HSN "0000") or <strong>Override All</strong> (replaces every product's HSN). Blue suggestions are auto-detected from the name — click to accept.
          </div>
        </div>

        {/* ── Search & filters ── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subcategory or HSN…"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#1B4F8A]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyUnset}
              onChange={(e) => setShowOnlyUnset(e.target.checked)}
              className="rounded"
            />
            Show only unset
          </label>
          <button onClick={expandAll} className="text-sm text-[#1B4F8A] hover:underline">
            Expand all
          </button>
        </div>

        {/* ── Tree ── */}
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-2">
            {grouped.map(({ dept, categories }) => (
              <div key={dept.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Dept header */}
                <button
                  onClick={() => toggleDept(dept.id)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 text-left"
                >
                  {expandedDepts.has(dept.id)
                    ? <ChevronDown className="w-4 h-4 text-gray-500" />
                    : <ChevronRight className="w-4 h-4 text-gray-500" />
                  }
                  <span className="font-semibold text-gray-800 text-sm">{dept.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{dept.code}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {Array.from(categories.values()).reduce((n, c) => n + c.subs.length, 0)} subcategories
                  </span>
                </button>

                {expandedDepts.has(dept.id) && (
                  <div className="divide-y divide-gray-50">
                    {Array.from(categories.values()).map(({ cat, subs }) => {
                      if (!cat) return null;
                      const catSetCount = subs.filter((s) => s.hsnCode).length;
                      return (
                        <div key={cat.id}>
                          {/* Category row */}
                          <button
                            onClick={() => toggleCat(cat.id)}
                            className="w-full flex items-center gap-2 px-6 py-2.5 bg-gray-50/50 hover:bg-gray-50 text-left"
                          >
                            {expandedCats.has(cat.id)
                              ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                              : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                            }
                            <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                            <span className="text-xs text-gray-400 font-mono">{cat.code}</span>
                            <span className="ml-auto text-xs text-gray-400">
                              {catSetCount}/{subs.length} HSN set
                              {catSetCount === subs.length && (
                                <CheckCircle2 className="inline w-3.5 h-3.5 text-green-500 ml-1.5" />
                              )}
                              {catSetCount < subs.length && (
                                <AlertCircle className="inline w-3.5 h-3.5 text-amber-400 ml-1.5" />
                              )}
                            </span>
                          </button>

                          {/* Subcategory rows */}
                          {expandedCats.has(cat.id) && (
                            <table className="w-full text-sm">
                              <tbody>
                                {subs.map((sub) => (
                                  <tr key={sub.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-10 py-2.5 text-gray-700 w-64">
                                      {sub.name}
                                      <span className="text-xs text-gray-400 font-mono ml-1.5">{sub.code}</span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <HsnCell
                                        sub={sub}
                                        localHsn={localHsn(sub.id)}
                                        onChange={(v) => setHsn(sub.id, v)}
                                        onApply={(mode) => handleApply(sub, mode)}
                                        applying={applying[sub.id] ?? false}
                                      />
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-xs text-gray-400 w-32">
                                      {sub._count.products} products
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {grouped.length === 0 && !isLoading && (
              <div className="text-center py-16 text-gray-400">
                {showOnlyUnset ? 'All subcategories have HSN set! 🎉' : 'No subcategories found'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
