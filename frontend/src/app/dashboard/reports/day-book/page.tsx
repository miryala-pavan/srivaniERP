'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import SortableTh from '@/components/reports/SortableTh';
import ColumnToggle from '@/components/reports/ColumnToggle';
import ExportBtn from '@/components/reports/ExportBtn';
import SavedViews from '@/components/reports/SavedViews';
import { useReportParams } from '@/hooks/useReportParams';
import { useSortable } from '@/hooks/useSortable';
import { useColumnToggle } from '@/hooks/useColumnToggle';
import { inr, fmtTime, fmtDate, today } from '@/lib/report-format';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import toast from 'react-hot-toast';

interface Entry {
  time: string; type: 'SALE' | 'RECEIPT' | 'EXPENSE' | 'SUPPLIER_PAYMENT';
  reference: string; particulars: string; mode: string;
  moneyIn: number; moneyOut: number; isCash: boolean;
}
interface DayBookData {
  date: string;
  entries: Entry[];
  dayBook: { totalIn: number; totalOut: number; salesTotal: number; receiptsTotal: number; expenseTotal: number; supplierTotal: number };
  cashBook: {
    openingCash: number; cashIn: number; cashInFromSales: number; cashInFromReceipts: number;
    cashOut: number; cashOutExpenses: number; cashOutSuppliers: number; expectedClosing: number;
  };
}

const TYPE_BADGE: Record<Entry['type'], string> = {
  SALE:             'bg-green-50 text-green-700',
  RECEIPT:          'bg-blue-50 text-blue-700',
  EXPENSE:          'bg-red-50 text-red-700',
  SUPPLIER_PAYMENT: 'bg-amber-50 text-amber-700',
};
const TYPE_LABEL: Record<Entry['type'], string> = {
  SALE: 'Sale', RECEIPT: 'Receipt', EXPENSE: 'Expense', SUPPLIER_PAYMENT: 'Supplier',
};

const COLUMNS = [
  { key: 'time',        label: 'Time' },
  { key: 'type',        label: 'Type' },
  { key: 'reference',   label: 'Reference' },
  { key: 'particulars', label: 'Particulars' },
  { key: 'mode',        label: 'Mode' },
  { key: 'moneyIn',     label: 'Money In' },
  { key: 'moneyOut',    label: 'Money Out' },
];

export default function DayBookPage() {
  const params = useReportParams();
  const { isVisible, toggle, showAll } = useColumnToggle(COLUMNS.map(c => c.key));

  const [data,    setData]    = useState<DayBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [date,    setDate]    = useState(() => params.get('date', today()));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DayBookData>('/reports/day-book', { params: { date } });
      setData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load day book'));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  function handleDate(val: string) {
    setDate(val);
    params.set({ date: val });
  }

  const { sorted, sort, dir, handleSort } = useSortable(data?.entries ?? [], 'time', 'asc');

  const db = data?.dayBook;
  const cb = data?.cashBook;

  // ── Anomaly detection ──
  // Flags entries whose amount is unusually large versus the rest of the same
  // type today (mean + 2 standard deviations, min 5 entries of that type).
  // Helps spot fat-finger amounts, unusual expenses, or oversized bills at a glance.
  const anomalyThresholds = useMemo(() => {
    const byType: Record<string, number[]> = {};
    for (const e of data?.entries ?? []) {
      const amt = e.moneyIn > 0 ? e.moneyIn : e.moneyOut;
      if (amt <= 0) continue;
      (byType[e.type] ??= []).push(amt);
    }
    const thresholds: Record<string, number> = {};
    for (const [type, amounts] of Object.entries(byType)) {
      if (amounts.length < 5) continue;
      const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
      const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
      const sd = Math.sqrt(variance);
      // Floor at 2× mean so near-uniform amounts (tiny σ) don't false-flag
      thresholds[type] = Math.max(mean + 2 * sd, mean * 2);
    }
    return thresholds;
  }, [data]);

  const isAnomaly = (e: Entry) => {
    const amt = e.moneyIn > 0 ? e.moneyIn : e.moneyOut;
    const t = anomalyThresholds[e.type];
    return t !== undefined && amt > t;
  };
  const anomalyCount = sorted.filter(isAnomaly).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Day Book & Cash Book" />
      <div className="max-w-6xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Day Book' }]} />

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date" value={date} onChange={e => handleDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]"
            />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ColumnToggle columns={COLUMNS} isVisible={isVisible} onToggle={toggle} onShowAll={showAll} />
            <SavedViews />
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* ── Cash Book summary ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Wallet className="w-4 h-4 text-[#1B4F8A]" /> Cash Book — {data ? fmtDate(data.date) : '—'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Opening Cash</p>
              <p className="text-base font-bold text-gray-800">₹{inr(cb?.openingCash ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-xs text-green-700 flex items-center gap-1"><ArrowDownCircle className="w-3 h-3" /> Cash In</p>
              <p className="text-base font-bold text-green-700">₹{inr(cb?.cashIn ?? 0)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Sales ₹{inr(cb?.cashInFromSales ?? 0)} · Receipts ₹{inr(cb?.cashInFromReceipts ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xs text-red-700 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3" /> Cash Out</p>
              <p className="text-base font-bold text-red-700">₹{inr(cb?.cashOut ?? 0)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Expenses ₹{inr(cb?.cashOutExpenses ?? 0)} · Suppliers ₹{inr(cb?.cashOutSuppliers ?? 0)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs text-blue-700">Expected Closing</p>
              <p className="text-base font-bold text-blue-700">₹{inr(cb?.expectedClosing ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* ── Day Book entries ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              Day Book — {sorted.length} transactions
              {anomalyCount > 0 && (
                <span title="Entries flagged amber are unusually large versus today's other entries of the same type (statistical outliers) — worth a second look for typos or unusual activity"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> {anomalyCount} unusual
                </span>
              )}
            </h2>
            <div className="text-xs text-gray-500">
              In <span className="text-green-700 font-semibold">₹{inr(db?.totalIn ?? 0)}</span>
              {' · '}Out <span className="text-red-700 font-semibold">₹{inr(db?.totalOut ?? 0)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  {isVisible('time')        && <SortableTh column="time"        label="Time"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Entry)} />}
                  {isVisible('type')        && <SortableTh column="type"        label="Type"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Entry)} />}
                  {isVisible('reference')   && <SortableTh column="reference"   label="Reference"   sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Entry)} />}
                  {isVisible('particulars') && <SortableTh column="particulars" label="Particulars" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Entry)} />}
                  {isVisible('mode')        && <SortableTh column="mode"        label="Mode"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Entry)} />}
                  {isVisible('moneyIn')     && <SortableTh column="moneyIn"     label="In ₹"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Entry)} align="right" />}
                  {isVisible('moneyOut')    && <SortableTh column="moneyOut"    label="Out ₹"       sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Entry)} align="right" />}
                </tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${isAnomaly(e) ? 'bg-amber-50/60' : ''}`}>
                    {isVisible('time')        && <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtTime(e.time)}</td>}
                    {isVisible('type')        && (
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[e.type]}`}>{TYPE_LABEL[e.type]}</span>
                      </td>
                    )}
                    {isVisible('reference')   && <td className="px-4 py-2.5 text-gray-600">{e.reference}</td>}
                    {isVisible('particulars') && (
                      <td className="px-4 py-2.5 text-gray-700">
                        {e.particulars}
                        {isAnomaly(e) && (
                          <span title={`Unusually large ${TYPE_LABEL[e.type].toLowerCase()} versus today's average — verify the amount is correct`}
                            className="ml-1.5 inline-flex align-middle text-amber-500">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    )}
                    {isVisible('mode')        && <td className="px-4 py-2.5 text-gray-500">{e.mode}</td>}
                    {isVisible('moneyIn')     && <td className="px-4 py-2.5 text-right text-green-700 font-medium">{e.moneyIn > 0 ? inr(e.moneyIn) : '—'}</td>}
                    {isVisible('moneyOut')    && <td className="px-4 py-2.5 text-right text-red-700 font-medium">{e.moneyOut > 0 ? inr(e.moneyOut) : '—'}</td>}
                  </tr>
                ))}
                {data && data.entries.length === 0 && !loading && (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">No transactions on this day</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400 text-sm">Loading…</td></tr>
                )}
              </tbody>
              {data && data.entries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
                    <td className="px-4 py-3" colSpan={5}>Total</td>
                    {isVisible('moneyIn')  && <td className="px-4 py-3 text-right text-green-700">₹{inr(db!.totalIn)}</td>}
                    {isVisible('moneyOut') && <td className="px-4 py-3 text-right text-red-700">₹{inr(db!.totalOut)}</td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Day Book lists all money movements. Cash Book reflects cash-only flow.
          Opening cash is the sum of shift opening floats. Amber rows are statistical outliers —
          unusually large versus today&apos;s other entries of the same type (needs at least 5 entries of
          that type to compare). URL is shareable — paste it to open the same date.
        </p>
      </div>
    </div>
  );
}
