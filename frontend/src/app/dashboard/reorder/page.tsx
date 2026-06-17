'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  PackageSearch, AlertTriangle, AlertCircle, Eye, TrendingDown, Printer,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────

type Urgency = 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'WATCH';

interface ReorderItem {
  productId:    string;
  productName:  string;
  productCode:  string | null;
  uom:          string;
  reorderLevel: number;
  categoryName: string | null;
  currentStock: number;
  avgDailyQty:  number;
  daysRemaining: number | null;
  suggestedQty: number;
  urgency:      Urgency;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const URGENCY_META: Record<Urgency, { label: string; bg: string; text: string; dot: string }> = {
  OUT_OF_STOCK: { label: 'Out of Stock', bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  CRITICAL:     { label: 'Critical',     bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  LOW:          { label: 'Low',          bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  WATCH:        { label: 'Watch',        bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400' },
};

const TAB_FILTERS: { key: Urgency | 'ALL'; label: string }[] = [
  { key: 'ALL',          label: 'All' },
  { key: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { key: 'CRITICAL',     label: 'Critical (≤3d)' },
  { key: 'LOW',          label: 'Low (≤7d)' },
  { key: 'WATCH',        label: 'Watch (≤14d)' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ReorderPage() {
  const [tab,    setTab]    = useState<Urgency | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery<ReorderItem[]>({
    queryKey: ['reorder-suggestions'],
    queryFn: async () => {
      const res = await api.get<ReorderItem[]>('/reports/reorder-suggestions');
      return res.data;
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (isError) toast.error('Could not load reorder suggestions');
  }, [isError]);

  const counts = useMemo(() => {
    if (!data) return { ALL: 0, OUT_OF_STOCK: 0, CRITICAL: 0, LOW: 0, WATCH: 0 };
    return {
      ALL:          data.length,
      OUT_OF_STOCK: data.filter(r => r.urgency === 'OUT_OF_STOCK').length,
      CRITICAL:     data.filter(r => r.urgency === 'CRITICAL').length,
      LOW:          data.filter(r => r.urgency === 'LOW').length,
      WATCH:        data.filter(r => r.urgency === 'WATCH').length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = tab === 'ALL' ? data : data.filter(r => r.urgency === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.productName.toLowerCase().includes(q) ||
        (r.productCode?.toLowerCase().includes(q)) ||
        (r.categoryName?.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [data, tab, search]);

  function toggleAll() {
    if (checked.size === filtered.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(filtered.map(r => r.productId)));
    }
  }

  function toggleOne(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handlePrint() {
    const toPrint = checked.size > 0
      ? filtered.filter(r => checked.has(r.productId))
      : filtered;
    if (!toPrint.length) { toast.error('No items to print'); return; }

    const rows = toPrint.map(r => `
      <tr>
        <td>${r.productCode ?? '-'}</td>
        <td>${r.productName}</td>
        <td>${r.categoryName ?? '-'}</td>
        <td>${fmt(r.currentStock)} ${r.uom}</td>
        <td>${r.daysRemaining !== null ? r.daysRemaining.toFixed(1) + 'd' : '—'}</td>
        <td><strong>${r.suggestedQty} ${r.uom}</strong></td>
        <td>${URGENCY_META[r.urgency].label}</td>
      </tr>
    `).join('');

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Reorder Order List</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        h2 { margin-bottom: 4px; }
        p { margin: 0 0 12px; color: #666; font-size: 11px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        tr:nth-child(even) { background: #fafafa; }
        @media print { @page { size: A4 landscape; margin: 15mm; } }
      </style>
      </head><body>
      <h2>Reorder Order List</h2>
      <p>Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; ${toPrint.length} item(s)</p>
      <table>
        <thead><tr>
          <th>Code</th><th>Product</th><th>Category</th>
          <th>Current Stock</th><th>Days Left</th><th>Suggested Qty</th><th>Urgency</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  const outCount      = counts.OUT_OF_STOCK;
  const criticalCount = counts.CRITICAL;

  return (
    <>
      <Header
        title="Smart Reorder Guide"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs bg-[#1B4F8A] text-white px-3 py-1.5 rounded-lg hover:bg-[#163f6f] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Order List
            </button>
          </div>
        }
      />

      <main className="flex-1 p-6 space-y-5">

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Alerts',  value: counts.ALL,          icon: PackageSearch, bg: 'bg-gray-700' },
            { label: 'Out of Stock',  value: counts.OUT_OF_STOCK, icon: AlertCircle,   bg: 'bg-red-500' },
            { label: 'Critical (≤3d)',value: counts.CRITICAL,     icon: AlertTriangle, bg: 'bg-orange-500' },
            { label: 'Low (≤7d)',     value: counts.LOW,          icon: TrendingDown,  bg: 'bg-yellow-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`${s.bg} w-9 h-9 rounded-lg flex items-center justify-center shrink-0`}>
                <s.icon className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{isLoading ? '—' : s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Alert banner */}
        {!isLoading && (outCount > 0 || criticalCount > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-red-700 font-medium">
              {outCount > 0 && `${outCount} product${outCount > 1 ? 's' : ''} out of stock. `}
              {criticalCount > 0 && `${criticalCount} product${criticalCount > 1 ? 's' : ''} will run out in ≤3 days.`}
            </span>
            <span className="text-red-500 text-xs ml-auto">Order immediately</span>
          </div>
        )}

        {/* Tabs + search */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
            <div className="flex gap-1 flex-wrap">
              {TAB_FILTERS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-[#1B4F8A] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                  {data && (
                    <span className={`ml-1 ${tab === t.key ? 'text-blue-200' : 'text-gray-400'}`}>
                      ({counts[t.key]})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {checked.size > 0 && (
                <span className="text-xs text-gray-500">{checked.size} selected</span>
              )}
              <input
                type="search"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 w-48"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading suggestions…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Eye className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">
                {data?.length === 0 ? 'All products are well-stocked!' : 'No products match your search.'}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {data?.length === 0 && 'Check back when stock levels drop below reorder levels.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={checked.size > 0 && checked.size === filtered.length}
                        ref={el => { if (el) el.indeterminate = checked.size > 0 && checked.size < filtered.length; }}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Reorder Lvl</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg/Day</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Left</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggest Qty</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const meta = URGENCY_META[r.urgency];
                    const isChecked = checked.has(r.productId);
                    return (
                      <tr
                        key={r.productId}
                        onClick={() => toggleOne(r.productId)}
                        className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                          isChecked ? 'bg-blue-50 hover:bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(r.productId)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 leading-tight">{r.productName}</p>
                          {r.productCode && (
                            <p className="text-xs text-gray-400 mt-0.5">{r.productCode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.categoryName ?? '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${r.currentStock <= 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {fmt(r.currentStock)}
                          <span className="text-gray-400 font-normal ml-1">{r.uom}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {fmt(r.reorderLevel)} <span className="text-gray-400">{r.uom}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {r.avgDailyQty > 0 ? fmt(r.avgDailyQty) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.daysRemaining !== null ? (
                            <span className={`font-semibold ${
                              r.daysRemaining <= 3 ? 'text-red-600' :
                              r.daysRemaining <= 7 ? 'text-orange-500' :
                              'text-yellow-600'
                            }`}>
                              {r.daysRemaining.toFixed(1)}d
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-[#1B4F8A] text-base">
                            {r.suggestedQty}
                          </span>
                          <span className="text-gray-400 font-normal ml-1 text-xs">{r.uom}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.bg} ${meta.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
              {checked.size > 0 && (
                <button
                  onClick={handlePrint}
                  className="text-[#1B4F8A] font-medium hover:underline"
                >
                  Print selected ({checked.size})
                </button>
              )}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="font-semibold text-gray-600 mb-1">How suggestions are calculated</p>
          <p>• <strong>Days left</strong> = current stock ÷ average daily sales (last 30 days)</p>
          <p>• <strong>Suggested qty</strong> = covers 14 days of demand, floored at your reorder level</p>
          <p>• Products with zero movement use <em>2× reorder level</em> as the suggestion</p>
          <p>• Only active products at or below reorder level (or &lt;14 days remaining) are shown</p>
        </div>

      </main>
    </>
  );
}
