'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowLeftRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import SortableTh from '@/components/reports/SortableTh';
import ExportBtn from '@/components/reports/ExportBtn';
import PeriodFilter from '@/components/reports/PeriodFilter';
import SavedViews from '@/components/reports/SavedViews';
import DeltaBadge from '@/components/reports/DeltaBadge';
import { useReportParams } from '@/hooks/useReportParams';
import { useSortable } from '@/hooks/useSortable';
import { inr, inr0, today, monthStart, periodDates, prevRange, pctDelta, type Period, type DateRange } from '@/lib/report-format';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

interface CategoryRow {
  categoryName: string; billCount: number;
  totalQty: number; totalRevenue: number; revenuePct: number;
}
interface CategoryData {
  categories: CategoryRow[];
  summary: { totalRevenue: number; categoryCount: number };
}

const COLORS = ['#1B4F8A', '#C6853A', '#2E7D32', '#6A1B9A', '#0277BD', '#C62828', '#00695C', '#4527A0'];

export default function SalesByCategoryPage() {
  const params = useReportParams();
  const [period, setPeriod] = useState<Period>(() => (params.get('period', 'month') as Period));
  const [range,  setRange]  = useState<DateRange>({ from: params.get('from', monthStart()), to: params.get('to', today()) });
  const [cmp,    setCmp]    = useState(() => params.get('cmp') === '1');
  const [data,   setData]   = useState<CategoryData | null>(null);
  const [prev,   setPrev]   = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from: startDate, to: endDate } = periodDates(period, range);
    try {
      const res = await api.get<CategoryData>('/reports/sales/by-category', { params: { startDate, endDate } });
      setData(res.data);
      if (cmp) {
        const pr = prevRange({ from: startDate, to: endDate });
        const prevRes = await api.get<CategoryData>('/reports/sales/by-category', { params: { startDate: pr.from, endDate: pr.to } });
        setPrev(prevRes.data);
      } else setPrev(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load category sales'));
    } finally { setLoading(false); }
  }, [period, range, cmp]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(p: Period, r: DateRange) {
    setPeriod(p); setRange(r);
    params.set({ period: p, from: r.from, to: r.to });
  }
  function toggleCmp() {
    const v = !cmp; setCmp(v);
    params.set({ cmp: v ? '1' : null });
  }

  // Per-category previous revenue for the table delta column (compare mode)
  const prevByCat: Record<string, number> = {};
  if (cmp && prev) for (const c of prev.categories) prevByCat[c.categoryName] = c.totalRevenue;

  const { sorted, sort, dir, handleSort } = useSortable(data?.categories ?? [], 'totalRevenue', 'desc');
  const top10 = (data?.categories ?? []).slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Sales by Category" />
      <div className="max-w-6xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Sales by Category' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter period={period} from={range.from} to={range.to} onChange={handlePeriod} />
            <button onClick={toggleCmp}
              title="Compare with the previous period of equal length — deltas appear on cards and per category"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${cmp ? 'bg-[#1B4F8A] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Compare
            </button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <SavedViews />
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-[#1B4F8A]">
              ₹{inr(data?.summary.totalRevenue ?? 0)}
              {cmp && prev && <span className="ml-2 align-middle"><DeltaBadge delta={pctDelta(data?.summary.totalRevenue ?? 0, prev.summary.totalRevenue)} /></span>}
            </p>
            {cmp && prev && <p className="text-[10px] text-gray-400 mt-0.5">prev: ₹{inr(prev.summary.totalRevenue)}</p>}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Categories</p>
            <p className="text-2xl font-bold text-gray-800">
              {data?.summary.categoryCount ?? 0}
              {cmp && prev && <span className="ml-2 align-middle"><DeltaBadge delta={pctDelta(data?.summary.categoryCount ?? 0, prev.summary.categoryCount)} /></span>}
            </p>
          </div>
        </div>

        {/* Bar chart */}
        {top10.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Category</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top10.map(c => ({
                name: c.categoryName.length > 18 ? c.categoryName.slice(0, 18) + '…' : c.categoryName,
                revenue: Math.round(c.totalRevenue),
              }))} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} tickLine={false} />
                <Tooltip formatter={(v: any) => [`₹${inr(Number(v))}`, 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                  {top10.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">All Categories</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium w-8">#</th>
                  <SortableTh column="categoryName" label="Category"  sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof CategoryRow)} />
                  <SortableTh column="billCount"    label="Bills"     sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof CategoryRow)} align="right" />
                  <SortableTh column="totalQty"     label="Qty Sold"  sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof CategoryRow)} align="right" />
                  <SortableTh column="totalRevenue" label="Revenue"   sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof CategoryRow)} align="right" />
                  {cmp && <th className="px-4 py-2.5 text-right font-medium" title="Change vs previous period of equal length">vs Prev</th>}
                  <SortableTh column="revenuePct"   label="% Share"   sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof CategoryRow)} align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => (
                  <tr key={c.categoryName} className={`border-b border-gray-50 hover:bg-gray-50 ${i < 3 ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{c.categoryName}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{inr0(c.billCount)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{inr0(c.totalQty)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#1B4F8A]">₹{inr(c.totalRevenue)}</td>
                    {cmp && (
                      <td className="px-4 py-2.5 text-right">
                        <DeltaBadge delta={pctDelta(c.totalRevenue, prevByCat[c.categoryName])} />
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-[#1B4F8A] h-1.5 rounded-full" style={{ width: `${Math.min(c.revenuePct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{c.revenuePct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">No sales in this period</td></tr>
                )}
                {loading && <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Based on finalised bills. Uncategorized products are grouped together. URL is shareable.</p>
      </div>
    </div>
  );
}
