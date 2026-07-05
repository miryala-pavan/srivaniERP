'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowLeftRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import SortableTh from '@/components/reports/SortableTh';
import ColumnToggle from '@/components/reports/ColumnToggle';
import ExportBtn from '@/components/reports/ExportBtn';
import PeriodFilter from '@/components/reports/PeriodFilter';
import SavedViews from '@/components/reports/SavedViews';
import DeltaBadge from '@/components/reports/DeltaBadge';
import { useReportParams } from '@/hooks/useReportParams';
import { useSortable } from '@/hooks/useSortable';
import { useColumnToggle } from '@/hooks/useColumnToggle';
import { inr, fmtDate, today, monthStart, periodDates, prevRange, pctDelta, type Period, type DateRange } from '@/lib/report-format';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

interface Expense {
  id: string; expenseDate: string; category: string;
  vendor: string | null; description: string | null;
  amount: number; paymentMode: string;
}
interface CatSummary { category: string; total: number; }
interface ExpenseData {
  expenses: Expense[];
  byCategory: CatSummary[];
  summary: { totalAmount: number; count: number };
}

const COLUMNS = [
  { key: 'expenseDate',  label: 'Date' },
  { key: 'category',    label: 'Category' },
  { key: 'vendor',      label: 'Vendor' },
  { key: 'description', label: 'Description' },
  { key: 'paymentMode', label: 'Mode' },
  { key: 'amount',      label: 'Amount' },
];

const COLORS = ['#1B4F8A', '#C6853A', '#2E7D32', '#6A1B9A', '#0277BD', '#C62828'];

export default function ExpenseReportPage() {
  const params = useReportParams();
  const { isVisible, toggle, showAll } = useColumnToggle(COLUMNS.map(c => c.key));

  const [period, setPeriod] = useState<Period>(() => (params.get('period', 'month') as Period));
  const [range,  setRange]  = useState<DateRange>({ from: params.get('from', monthStart()), to: params.get('to', today()) });
  const [cmp,    setCmp]    = useState(() => params.get('cmp') === '1');
  const [data,   setData]   = useState<ExpenseData | null>(null);
  const [prev,   setPrev]   = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from: startDate, to: endDate } = periodDates(period, range);
    try {
      const res = await api.get<ExpenseData>('/reports/expenses', { params: { startDate, endDate } });
      setData(res.data);
      if (cmp) {
        const pr = prevRange({ from: startDate, to: endDate });
        const prevRes = await api.get<ExpenseData>('/reports/expenses', { params: { startDate: pr.from, endDate: pr.to } });
        setPrev(prevRes.data);
      } else setPrev(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load expense report'));
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

  const { sorted, sort, dir, handleSort } = useSortable(data?.expenses ?? [], 'expenseDate', 'desc');

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Expense Report" />
      <div className="max-w-6xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Expenses' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter period={period} from={range.from} to={range.to} onChange={handlePeriod} />
            <button onClick={toggleCmp}
              title="Compare with the previous period of equal length — deltas appear on the summary cards"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${cmp ? 'bg-[#1B4F8A] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Compare
            </button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ColumnToggle columns={COLUMNS} isVisible={isVisible} onToggle={toggle} onShowAll={showAll} />
            <SavedViews />
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-red-600">
              ₹{inr(data?.summary.totalAmount ?? 0)}
              {cmp && prev && <span className="ml-2 align-middle"><DeltaBadge delta={pctDelta(data?.summary.totalAmount ?? 0, prev.summary.totalAmount)} goodWhenUp={false} /></span>}
            </p>
            {cmp && prev && <p className="text-[10px] text-gray-400 mt-0.5">prev: ₹{inr(prev.summary.totalAmount)}</p>}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Transactions</p>
            <p className="text-2xl font-bold text-gray-800">
              {data?.summary.count ?? 0}
              {cmp && prev && <span className="ml-2 align-middle"><DeltaBadge delta={pctDelta(data?.summary.count ?? 0, prev.summary.count)} goodWhenUp={false} /></span>}
            </p>
            {cmp && prev && <p className="text-[10px] text-gray-400 mt-0.5">prev: {prev.summary.count}</p>}
          </div>
        </div>

        {/* Category chart */}
        {(data?.byCategory.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">By Category</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data!.byCategory.map(c => ({ name: c.category, total: Math.round(c.total) }))} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} tickLine={false} />
                <Tooltip formatter={(v: any) => [`₹${inr(Number(v))}`, 'Total']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {data!.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">{sorted.length} transactions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  {isVisible('expenseDate')  && <SortableTh column="expenseDate"  label="Date"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Expense)} />}
                  {isVisible('category')     && <SortableTh column="category"     label="Category"    sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Expense)} />}
                  {isVisible('vendor')       && <SortableTh column="vendor"       label="Vendor"      sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Expense)} />}
                  {isVisible('description')  && <SortableTh column="description"  label="Description" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Expense)} />}
                  {isVisible('paymentMode')  && <SortableTh column="paymentMode"  label="Mode"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Expense)} />}
                  {isVisible('amount')       && <SortableTh column="amount"       label="Amount"      sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Expense)} align="right" />}
                </tr>
              </thead>
              <tbody>
                {sorted.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {isVisible('expenseDate')  && <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(e.expenseDate)}</td>}
                    {isVisible('category')     && <td className="px-4 py-2.5"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{e.category}</span></td>}
                    {isVisible('vendor')       && <td className="px-4 py-2.5 text-gray-600">{e.vendor ?? '—'}</td>}
                    {isVisible('description')  && <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{e.description ?? '—'}</td>}
                    {isVisible('paymentMode')  && <td className="px-4 py-2.5 text-gray-500">{e.paymentMode}</td>}
                    {isVisible('amount')       && <td className="px-4 py-2.5 text-right font-semibold text-red-600">₹{inr(e.amount)}</td>}
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400">No expenses in this period</td></tr>
                )}
                {loading && <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading…</td></tr>}
              </tbody>
              {data && data.expenses.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-4 py-3" colSpan={5}>Total</td>
                    <td className="px-4 py-3 text-right text-red-600">₹{inr(data.summary.totalAmount)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Expenses by date range. URL is shareable.</p>
      </div>
    </div>
  );
}
