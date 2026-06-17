'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Printer, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import toast from 'react-hot-toast';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

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

export default function DayBookPage() {
  const [data, setData]       = useState<DayBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate]       = useState(() => new Date().toISOString().split('T')[0]);

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

  const db = data?.dayBook;
  const cb = data?.cashBook;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Day Book & Cash Book" />
      <div className="max-w-6xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Day Book' }]} />
        <div className="flex items-center justify-between mt-2 mb-4">
          <BackButton />
          <div className="flex items-center gap-3">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]" />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e]">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
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
            <h2 className="text-sm font-semibold text-gray-800">Day Book — all transactions</h2>
            <div className="text-xs text-gray-500">
              In <span className="text-green-700 font-semibold">₹{inr(db?.totalIn ?? 0)}</span>
              {' · '}Out <span className="text-red-700 font-semibold">₹{inr(db?.totalOut ?? 0)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium">Time</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Reference</th>
                  <th className="px-4 py-2.5 text-left font-medium">Particulars</th>
                  <th className="px-4 py-2.5 text-left font-medium">Mode</th>
                  <th className="px-4 py-2.5 text-right font-medium">In</th>
                  <th className="px-4 py-2.5 text-right font-medium">Out</th>
                </tr>
              </thead>
              <tbody>
                {data?.entries.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtTime(e.time)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[e.type]}`}>{TYPE_LABEL[e.type]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{e.reference}</td>
                    <td className="px-4 py-2.5 text-gray-700">{e.particulars}</td>
                    <td className="px-4 py-2.5 text-gray-500">{e.mode}</td>
                    <td className="px-4 py-2.5 text-right text-green-700 font-medium">{e.moneyIn > 0 ? inr(e.moneyIn) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-red-700 font-medium">{e.moneyOut > 0 ? inr(e.moneyOut) : '—'}</td>
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
                    <td className="px-4 py-3 text-right text-green-700">₹{inr(db!.totalIn)}</td>
                    <td className="px-4 py-3 text-right text-red-700">₹{inr(db!.totalOut)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Day Book lists all money movements (sales, customer receipts, expenses, supplier payments).
          Cash Book reflects cash-only flow. Opening cash is the sum of shift opening floats for the day.
        </p>
      </div>
    </div>
  );
}
