'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Ruler, CheckCircle, XCircle, RefreshCw, Package, Scale,
  Search, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { BarcodeScannerInput } from '@/components/shared/BarcodeScannerInput';
import { UNIT_DEFINITIONS } from '@/lib/units';
import { SetUnitModal } from '@/components/shared/SetUnitModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditPlu {
  pluId: string;
  productId: string;
  productCode: string;
  productName: string;
  pluCode: string;
  displayName: string | null;
  stockOnHand: number;
  measureType: string | null;
  unitSymbol: string | null;
  unitSize: number | null;
  baseUnitQty: number | null;
  gstUqc: string | null;
  flags: string[];
}

interface Summary {
  total: number; noUnitInfo: number; hasUnitInfo: number;
  weight: number; volume: number; length: number; area: number; count: number;
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'ALL',           label: 'All PLUs',       icon: Package,      color: 'gray'   },
  { key: 'NO_UNIT_INFO',  label: 'Missing Units',  icon: XCircle,      color: 'red'    },
  { key: 'HAS_UNIT_INFO', label: 'Has Units',      icon: CheckCircle,  color: 'green'  },
  { key: 'WEIGHT',        label: 'Weight',         icon: Scale,        color: 'gray'   },
  { key: 'VOLUME',        label: 'Volume',         icon: Scale,        color: 'gray'   },
  { key: 'LENGTH',        label: 'Length',         icon: Scale,        color: 'gray'   },
  { key: 'AREA',          label: 'Area',           icon: Scale,        color: 'gray'   },
  { key: 'COUNT',         label: 'Count',          icon: Scale,        color: 'gray'   },
];

function colorClass(color: string) {
  const map: Record<string, string> = {
    gray:  'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    red:   'bg-red-100 text-red-700 border-red-200',
  };
  return map[color] ?? map.gray;
}

function label(p: { displayName: string | null; pluCode: string }) {
  return p.displayName ?? p.pluCode;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UnitManagementPage() {
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [plus, setPlus]         = useState<AuditPlu[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('ALL');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [unitModalIds, setUnitModalIds] = useState<string[] | null>(null);

  const load = useCallback(async (f = filter, s = search) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams();
      if (f && f !== 'ALL') params.set('filter', f);
      if (s.trim()) params.set('search', s.trim());
      const res = await api.get(`/products/unit-audit?${params}`);
      setSummary(res.data.summary);
      setPlus(res.data.data);
    } catch {
      toast.error('Failed to load unit audit');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilter(f: string) { setFilter(f); load(f, search); }
  function applySearch(s: string) { setSearch(s); load(filter, s); }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(selected.size === plus.length ? new Set() : new Set(plus.map(p => p.pluId)));
  }

  const summaryCards = summary ? [
    { label: 'Total PLUs',      value: summary.total,       color: 'bg-gray-50 border-gray-200',   text: 'text-gray-800'  },
    { label: 'Missing Units',   value: summary.noUnitInfo,  color: 'bg-red-50 border-red-200',     text: 'text-red-700'   },
    { label: 'Has Units',       value: summary.hasUnitInfo, color: 'bg-green-50 border-green-200', text: 'text-green-700' },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-indigo-600" />
            Unit Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Set pack sizes (e.g. "50kg", "1kg", "12 pieces") so Break Bulk and reports can track quantities and wastage automatically
          </p>
        </div>
        <button onClick={() => load()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Unit Definitions — fixed, universal conversions the whole system relies on.
          Sourced from the official GST UQC code list (CBIC/GSTN) — not invented per catalog. */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Unit Definitions</h2>
        <p className="text-xs text-gray-400 mb-3">
          Official GST UQC conversions — constants true for every product, not something you set per item.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
          {UNIT_DEFINITIONS.map(d => (
            <div key={d.symbol} className="bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-mono font-semibold">1 {d.symbol}</span>
              <span className="text-[10px] text-gray-400 ml-1">({d.uqc})</span>
              <span> = {d.equals}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {summaryCards.map(c => (
            <div key={c.label} className={`border rounded-xl p-3 ${c.color}`}>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-2xl font-black mt-0.5 ${c.text}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 mb-2">
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => {
              const count = summary ? ({
                ALL: summary.total, NO_UNIT_INFO: summary.noUnitInfo, HAS_UNIT_INFO: summary.hasUnitInfo,
                WEIGHT: summary.weight, VOLUME: summary.volume, LENGTH: summary.length, AREA: summary.area, COUNT: summary.count,
              } as Record<string, number>)[f.key] ?? 0 : 0;
              const isActive = filter === f.key;
              return (
                <button key={f.key} onClick={() => applyFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    isActive ? colorClass(f.color) + ' ring-2 ring-offset-1 ring-current' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}>
                  <f.icon className="w-3.5 h-3.5" />
                  {f.label}
                  {count > 0 && <span className="ml-1 bg-white/60 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <BarcodeScannerInput
          placeholder="Search product name, code or PLU…"
          value={search} onChange={setSearch}
          onKeyDown={e => e.key === 'Enter' && applySearch(search)}
          className="flex-1 min-w-[200px] max-w-sm"
          inputClassName="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button onClick={() => applySearch(search)}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
          Search
        </button>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600 font-medium">{selected.size} selected</span>
            <button onClick={() => setUnitModalIds(Array.from(selected))}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">
              <Ruler className="w-3.5 h-3.5" /> Set Unit for Selected
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : plus.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
            <p className="font-semibold">No PLUs match this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-8">
                    <input type="checkbox" checked={selected.size === plus.length && plus.length > 0}
                      onChange={toggleAll} className="rounded accent-indigo-600" />
                  </th>
                  <th className="px-4 py-3 text-left text-gray-600 font-semibold">Product</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Stock</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-semibold">Unit</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plus.map(p => {
                  const hasUnit = p.flags.includes('HAS_UNIT_INFO');
                  return (
                    <tr key={p.pluId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(p.pluId)}
                          onChange={() => toggleSelect(p.pluId)} className="rounded accent-indigo-600" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800 text-xs leading-tight">{p.productName}</p>
                        <p className="text-[11px] text-gray-400">{label(p)} · {p.productCode}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-700">{p.stockOnHand}</td>
                      <td className="px-4 py-3">
                        {hasUnit ? (
                          <span className="text-[11px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                            {p.unitSize} {p.unitSymbol}
                          </span>
                        ) : (
                          <span className="text-[11px] bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                            Not set
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setUnitModalIds([p.pluId])}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold whitespace-nowrap">
                          Fix individually →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              Showing {plus.length} PLUs
            </div>
          </div>
        )}
      </div>

      {unitModalIds && (
        <SetUnitModal
          target={{ mode: 'plu', ids: unitModalIds }}
          onClose={() => setUnitModalIds(null)}
          onSaved={() => { setUnitModalIds(null); load(); }}
        />
      )}
    </div>
  );
}
