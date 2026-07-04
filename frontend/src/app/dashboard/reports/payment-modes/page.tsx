'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Banknote, Smartphone, CreditCard, Building } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import ExportBtn from '@/components/reports/ExportBtn';
import PeriodFilter from '@/components/reports/PeriodFilter';
import { useReportParams } from '@/hooks/useReportParams';
import { inr, inr0, today, monthStart, periodDates, type Period, type DateRange } from '@/lib/report-format';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

interface ModeRow {
  paymentMode: string; billCount: number; totalAmount: number; pct: number;
}
interface ModeData {
  modes: ModeRow[];
  summary: { totalAmount: number; totalBills: number };
}

const MODE_ICON: Record<string, React.ReactNode> = {
  CASH: <Banknote className="w-4 h-4" />,
  UPI:  <Smartphone className="w-4 h-4" />,
  CARD: <CreditCard className="w-4 h-4" />,
  BANK_TRANSFER: <Building className="w-4 h-4" />,
  NEFT: <Building className="w-4 h-4" />,
  RTGS: <Building className="w-4 h-4" />,
  IMPS: <Building className="w-4 h-4" />,
  CHEQUE: <Building className="w-4 h-4" />,
  CREDIT: <CreditCard className="w-4 h-4" />,
  SPLIT: <CreditCard className="w-4 h-4" />,
};

const COLORS = ['#1B4F8A', '#C6853A', '#2E7D32', '#6A1B9A', '#0277BD', '#C62828', '#00695C', '#4527A0'];

export default function PaymentModesPage() {
  const params = useReportParams();
  const [period, setPeriod] = useState<Period>(() => (params.get('period', 'month') as Period));
  const [range,  setRange]  = useState<DateRange>({ from: params.get('from', monthStart()), to: params.get('to', today()) });
  const [data,   setData]   = useState<ModeData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from: startDate, to: endDate } = periodDates(period, range);
    try {
      const res = await api.get<ModeData>('/reports/sales/by-payment-mode', { params: { startDate, endDate } });
      setData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load payment mode report'));
    } finally { setLoading(false); }
  }, [period, range]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(p: Period, r: DateRange) {
    setPeriod(p); setRange(r);
    params.set({ period: p, from: r.from, to: r.to });
  }

  const modes = data?.modes ?? [];
  const pieData = modes.map(m => ({ name: m.paymentMode, value: Math.round(m.totalAmount) }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Payment Mode Report" />
      <div className="max-w-5xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Payment Modes' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter period={period} from={range.from} to={range.to} onChange={handlePeriod} />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total Collected</p>
            <p className="text-2xl font-bold text-[#1B4F8A]">₹{inr(data?.summary.totalAmount ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total Bills</p>
            <p className="text-2xl font-bold text-gray-800">{inr0(data?.summary.totalBills ?? 0)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue Split</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `₹${inr(Number(v))}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend formatter={(v) => v} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Mode cards */}
          <div className="space-y-3">
            {modes.map((m, i) => (
              <div key={m.paymentMode} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length] }}>
                  {MODE_ICON[m.paymentMode] ?? <CreditCard className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{m.paymentMode}</p>
                  <p className="text-xs text-gray-400">{inr0(m.billCount)} bills</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-gray-800">₹{inr(m.totalAmount)}</p>
                  <p className="text-xs text-gray-400">{m.pct}%</p>
                </div>
                <div className="w-16">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(m.pct, 100)}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              </div>
            ))}
            {!loading && modes.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">No sales in this period</div>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400">Based on finalised bills. SPLIT bills count at their primary mode. URL is shareable.</p>
      </div>
    </div>
  );
}
