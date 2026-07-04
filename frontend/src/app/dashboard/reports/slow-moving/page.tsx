'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import SortableTh from '@/components/reports/SortableTh';
import ColumnToggle from '@/components/reports/ColumnToggle';
import ExportBtn from '@/components/reports/ExportBtn';
import { useReportParams } from '@/hooks/useReportParams';
import { useSortable } from '@/hooks/useSortable';
import { useColumnToggle } from '@/hooks/useColumnToggle';
import { inr, inr0, fmtDate } from '@/lib/report-format';
import { LinkedProduct } from '@/components/linked/LinkedProduct';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

interface SlowProduct {
  id: string; productName: string; productCode: string | null;
  hsnCode: string | null; categoryName: string | null;
  unitOfMeasure: string; currentStock: number;
  lastSaleDate: string | null; daysSinceLastSale: number | null;
  stockValue: number; neverSold: boolean;
}
interface SlowData {
  products: SlowProduct[];
  summary: { count: number; neverSold: number; totalStockValue: number };
  days: number;
}

const COLUMNS = [
  { key: 'productName',      label: 'Product' },
  { key: 'categoryName',     label: 'Category' },
  { key: 'currentStock',     label: 'Stock' },
  { key: 'lastSaleDate',     label: 'Last Sale' },
  { key: 'daysSinceLastSale', label: 'Days Idle' },
  { key: 'stockValue',       label: 'Stock Value' },
];

const DAY_OPTIONS = [30, 60, 90, 180, 365];

export default function SlowMovingPage() {
  const params = useReportParams();
  const { isVisible, toggle, showAll } = useColumnToggle(COLUMNS.map(c => c.key));

  const [days,    setDays]    = useState(() => Number(params.get('days', '30')));
  const [data,    setData]    = useState<SlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<SlowData>('/reports/inventory/slow-moving', { params: { days } });
      setData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load slow-moving report'));
    } finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  function handleDays(d: number) { setDays(d); params.set({ days: String(d) }); }

  const filtered = (data?.products ?? []).filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.productName.toLowerCase().includes(q) || (p.categoryName ?? '').toLowerCase().includes(q);
  });

  const { sorted, sort, dir, handleSort } = useSortable(filtered, 'daysSinceLastSale', 'desc');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Slow-Moving Stock" />
      <div className="max-w-7xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Slow Moving' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">No sale in:</span>
            {DAY_OPTIONS.map(d => (
              <button key={d} onClick={() => handleDays(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  days === d ? 'bg-[#1B4F8A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4F8A]'
                }`}>
                {d}d
              </button>
            ))}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:border-[#1B4F8A]" />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ColumnToggle columns={COLUMNS} isVisible={isVisible} onToggle={toggle} onShowAll={showAll} />
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Slow-Moving SKUs</p>
            <p className="text-2xl font-bold text-amber-600">{data?.summary.count ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">No sale in {days} days, but in stock</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" /> Never Sold</p>
            <p className="text-2xl font-bold text-red-600">{data?.summary.neverSold ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">In stock but zero sales history</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Capital Locked</p>
            <p className="text-2xl font-bold text-gray-800">₹{inr(data?.summary.totalStockValue ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">At cost price</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{sorted.length} products</h2>
            <p className="text-xs text-gray-400">Products with stock {`>`} 0, no sale in last {days} days</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  {isVisible('productName')      && <SortableTh column="productName"      label="Product"     sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof SlowProduct)} />}
                  {isVisible('categoryName')     && <SortableTh column="categoryName"     label="Category"    sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof SlowProduct)} />}
                  {isVisible('currentStock')     && <SortableTh column="currentStock"     label="Stock"       sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof SlowProduct)} align="right" />}
                  {isVisible('lastSaleDate')     && <SortableTh column="lastSaleDate"     label="Last Sale"   sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof SlowProduct)} />}
                  {isVisible('daysSinceLastSale') && <SortableTh column="daysSinceLastSale" label="Days Idle" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof SlowProduct)} align="right" />}
                  {isVisible('stockValue')       && <SortableTh column="stockValue"       label="Stock Value" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof SlowProduct)} align="right" />}
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50 ${p.neverSold ? 'bg-red-50/30' : ''}`}>
                    {isVisible('productName') && (
                      <td className="px-4 py-2.5">
                        <LinkedProduct id={p.id} name={p.productName} className="font-medium" />
                        {p.productCode && <p className="text-xs text-gray-400 font-mono">{p.productCode}</p>}
                      </td>
                    )}
                    {isVisible('categoryName')    && <td className="px-4 py-2.5 text-xs text-gray-500">{p.categoryName ?? '—'}</td>}
                    {isVisible('currentStock')    && <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{inr0(p.currentStock)} <span className="text-xs font-normal text-gray-400">{p.unitOfMeasure}</span></td>}
                    {isVisible('lastSaleDate')    && <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{p.lastSaleDate ? fmtDate(p.lastSaleDate) : <span className="text-red-500 font-medium">Never sold</span>}</td>}
                    {isVisible('daysSinceLastSale') && (
                      <td className="px-4 py-2.5 text-right">
                        {p.neverSold
                          ? <span className="text-red-500 font-semibold">—</span>
                          : <span className={`font-semibold ${(p.daysSinceLastSale ?? 0) > 90 ? 'text-red-600' : 'text-amber-600'}`}>{p.daysSinceLastSale}d</span>
                        }
                      </td>
                    )}
                    {isVisible('stockValue') && <td className="px-4 py-2.5 text-right text-gray-700">₹{inr(p.stockValue)}</td>}
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">
                    No slow-moving products found — great inventory health!
                  </td></tr>
                )}
                {loading && <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Shows products currently in stock with no finalised sale in the chosen window.
          Red rows have never been sold. URL is shareable — bookmark for daily review.
        </p>
      </div>
    </div>
  );
}
