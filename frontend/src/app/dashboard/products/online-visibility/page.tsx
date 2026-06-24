'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Image, Tag, Barcode, Package, TrendingDown, DollarSign,
  ShoppingBag, Eye, EyeOff, Search, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditProduct {
  id: string;
  productCode: string;
  name: string;
  imageUrl: string | null;
  isOnline: boolean;
  shouldBlock: boolean;
  totalStock: number;
  selling: number;
  mrp: number;
  cost: number;
  gst: number;
  hasBarcode: boolean;
  category: string | null;
  packLabel: string | null;
  onlinePluCode: string | null;
  pluId: string | null;
  flags: string[];
}

interface Summary {
  total: number; online: number; offline: number; healthy: number;
  critical: number; zeroPrice: number; zeroMrp: number;
  sellingAboveMrp: number; belowCost: number; noCostPrice: number;
  noGst: number; noImage: number; noPackLabel: number;
  noBarcode: number; outOfStock: number; lowStock: number;
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'ALL',             label: 'All Products',     icon: Package,      color: 'gray'   },
  { key: 'ONLINE',          label: 'Online',           icon: Globe,        color: 'green'  },
  { key: 'HEALTHY',         label: 'Healthy',          icon: CheckCircle,  color: 'emerald'},
  { key: 'CRITICAL',        label: 'Critical Issues',  icon: XCircle,      color: 'red'    },
  { key: 'ZERO_PRICE',      label: 'Zero Price',       icon: DollarSign,   color: 'red'    },
  { key: 'ZERO_MRP',        label: 'Zero MRP',         icon: DollarSign,   color: 'red'    },
  { key: 'SELLING_ABOVE_MRP', label: 'Selling > MRP', icon: TrendingDown, color: 'red'    },
  { key: 'BELOW_COST',      label: 'Below Cost',       icon: TrendingDown, color: 'orange' },
  { key: 'NO_COST_PRICE',   label: 'No Cost Price',    icon: DollarSign,   color: 'orange' },
  { key: 'NO_GST',          label: 'No GST Rate',      icon: Tag,          color: 'orange' },
  { key: 'NO_IMAGE',        label: 'No Image',         icon: Image,        color: 'yellow' },
  { key: 'NO_PACK_LABEL',   label: 'No Pack Label',    icon: Tag,          color: 'yellow' },
  { key: 'NO_BARCODE',      label: 'No Barcode',       icon: Barcode,      color: 'yellow' },
  { key: 'OUT_OF_STOCK',    label: 'Out of Stock',     icon: Package,      color: 'red'    },
  { key: 'LOW_STOCK',       label: 'Low Stock',        icon: Package,      color: 'orange' },
  { key: 'OFFLINE',         label: 'Offline',          icon: EyeOff,       color: 'gray'   },
];

const FLAG_META: Record<string, { label: string; color: string }> = {
  NO_PLU:           { label: 'No PLU',          color: 'bg-red-100 text-red-700'     },
  ZERO_PRICE:       { label: 'Zero Price',       color: 'bg-red-100 text-red-700'     },
  ZERO_MRP:         { label: 'Zero MRP',         color: 'bg-red-100 text-red-700'     },
  SELLING_ABOVE_MRP:{ label: 'Selling > MRP',   color: 'bg-red-100 text-red-700'     },
  BELOW_COST:       { label: 'Below Cost',       color: 'bg-orange-100 text-orange-700'},
  NO_COST_PRICE:    { label: 'No Cost',          color: 'bg-orange-100 text-orange-700'},
  NO_GST:           { label: 'No GST',           color: 'bg-orange-100 text-orange-700'},
  NO_IMAGE:         { label: 'No Image',         color: 'bg-yellow-100 text-yellow-700'},
  NO_PACK_LABEL:    { label: 'No Label',         color: 'bg-yellow-100 text-yellow-700'},
  NO_BARCODE:       { label: 'No Barcode',       color: 'bg-yellow-100 text-yellow-700'},
  NO_CATEGORY:      { label: 'No Category',      color: 'bg-yellow-100 text-yellow-700'},
  MANUALLY_DISABLED:{ label: 'Disabled',         color: 'bg-gray-100 text-gray-600'   },
  OUT_OF_STOCK:     { label: 'Out of Stock',     color: 'bg-red-100 text-red-700'     },
  LOW_STOCK:        { label: 'Low Stock',        color: 'bg-orange-100 text-orange-700'},
};

const CRITICAL_FLAGS = ['NO_PLU','ZERO_PRICE','ZERO_MRP','SELLING_ABOVE_MRP','BELOW_COST','MANUALLY_DISABLED'];

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function colorClass(color: string) {
  const map: Record<string, string> = {
    gray:    'bg-gray-100 text-gray-700 border-gray-200',
    green:   'bg-green-100 text-green-700 border-green-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    red:     'bg-red-100 text-red-700 border-red-200',
    orange:  'bg-orange-100 text-orange-700 border-orange-200',
    yellow:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  };
  return map[color] ?? map.gray;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnlineVisibilityPage() {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [products, setProducts] = useState<AuditProduct[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('ALL');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async (f = filter, s = search) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const params = new URLSearchParams();
      if (f && f !== 'ALL') params.set('filter', f);
      if (s.trim()) params.set('search', s.trim());
      const res = await api.get(`/products/online-audit?${params}`);
      setSummary(res.data.summary);
      setProducts(res.data.data);
    } catch {
      toast.error('Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => { load(); }, []);

  function applyFilter(f: string) {
    setFilter(f);
    load(f, search);
  }

  function applySearch(s: string) {
    setSearch(s);
    load(filter, s);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map(p => p.id)));
    }
  }

  async function bulkTakeOffline() {
    if (!selected.size) return;
    setBulkLoading(true);
    try {
      await api.patch('/products/online-audit/bulk-offline', { productIds: Array.from(selected) });
      toast.success(`${selected.size} product(s) taken offline`);
      load(filter, search);
    } catch {
      toast.error('Failed to take offline');
    } finally {
      setBulkLoading(false);
    }
  }

  const summaryCards = summary ? [
    { label: 'Total Products',   value: summary.total,    color: 'bg-gray-50   border-gray-200',    text: 'text-gray-800'   },
    { label: 'Online',           value: summary.online,   color: 'bg-green-50  border-green-200',   text: 'text-green-700'  },
    { label: 'Healthy Online',   value: summary.healthy,  color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700'},
    { label: 'Critical Issues',  value: summary.critical, color: 'bg-red-50    border-red-200',     text: 'text-red-700'    },
    { label: 'No Image',         value: summary.noImage,  color: 'bg-yellow-50 border-yellow-200',  text: 'text-yellow-700' },
    { label: 'Low Stock',        value: summary.lowStock, color: 'bg-orange-50 border-orange-200',  text: 'text-orange-700' },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Online Visibility Audit
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and fix issues affecting what customers see on the storefront
          </p>
        </div>
        <button onClick={() => load()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 mb-2"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => {
              const count = summary ? (() => {
                const map: Record<string, number> = {
                  ALL: summary.total, ONLINE: summary.online, HEALTHY: summary.healthy,
                  CRITICAL: summary.critical, ZERO_PRICE: summary.zeroPrice,
                  ZERO_MRP: summary.zeroMrp, SELLING_ABOVE_MRP: summary.sellingAboveMrp,
                  BELOW_COST: summary.belowCost, NO_COST_PRICE: summary.noCostPrice,
                  NO_GST: summary.noGst, NO_IMAGE: summary.noImage,
                  NO_PACK_LABEL: summary.noPackLabel, NO_BARCODE: summary.noBarcode,
                  OUT_OF_STOCK: summary.outOfStock, LOW_STOCK: summary.lowStock,
                  OFFLINE: summary.offline,
                };
                return map[f.key] ?? 0;
              })() : 0;
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
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search product name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applySearch(search)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <button onClick={() => applySearch(search)}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
          Search
        </button>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600 font-medium">{selected.size} selected</span>
            <button onClick={bulkTakeOffline} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 font-semibold">
              {bulkLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
              Take Offline
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
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
            <p className="font-semibold">No products match this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-8">
                    <input type="checkbox" checked={selected.size === products.length && products.length > 0}
                      onChange={toggleAll} className="rounded accent-indigo-600" />
                  </th>
                  <th className="px-4 py-3 text-left text-gray-600 font-semibold">Product</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Selling</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">MRP</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Cost</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">GST</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Stock</th>
                  <th className="px-4 py-3 text-left text-gray-600 font-semibold">Issues</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => {
                  const hasCritical = p.flags.some(f => CRITICAL_FLAGS.includes(f));
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${hasCritical && p.isOnline ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)} className="rounded accent-indigo-600" />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover border border-gray-200 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                              <Image className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800 text-xs leading-tight">{p.name}</p>
                            <p className="text-[11px] text-gray-400">{p.productCode} · {p.category ?? 'No category'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {p.isOnline ? (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                            <Eye className="w-3 h-3" /> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                            <EyeOff className="w-3 h-3" /> Offline
                          </span>
                        )}
                      </td>

                      <td className={`px-4 py-3 text-right font-semibold text-xs ${p.selling === 0 ? 'text-red-600' : 'text-gray-800'}`}>
                        {p.selling === 0 ? '—' : fmt(p.selling)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold text-xs ${p.mrp === 0 ? 'text-red-600' : p.selling > p.mrp ? 'text-red-600' : 'text-gray-800'}`}>
                        {p.mrp === 0 ? '—' : fmt(p.mrp)}
                      </td>
                      <td className={`px-4 py-3 text-right text-xs ${p.cost === 0 ? 'text-gray-400' : p.selling < p.cost ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {p.cost === 0 ? '—' : fmt(p.cost)}
                      </td>
                      <td className={`px-4 py-3 text-right text-xs ${p.gst === 0 ? 'text-orange-500' : 'text-gray-600'}`}>
                        {p.gst === 0 ? '—' : `${p.gst}%`}
                      </td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold ${p.totalStock <= 0 ? 'text-red-500' : p.totalStock <= 5 ? 'text-orange-500' : 'text-gray-700'}`}>
                        {p.totalStock}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.flags.length === 0 ? (
                            <span className="text-[11px] text-emerald-600 font-semibold">✓ Healthy</span>
                          ) : (
                            p.flags.map(f => {
                              const m = FLAG_META[f];
                              return m ? (
                                <span key={f} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${m.color}`}>
                                  {m.label}
                                </span>
                              ) : null;
                            })
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Link href={`/dashboard/products/${p.id}/plu`}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold whitespace-nowrap">
                          Fix PLU →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              Showing {products.length} products
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
