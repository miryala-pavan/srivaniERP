'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

const fmt  = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
const fmtL = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${fmt(n)}`;
};

interface FYData {
  fyCode: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  isActive: boolean;
  totalSales: number;
  totalBills: number;
  totalPurchases: number;
  totalGrns: number;
  totalPaymentsMade: number;
  totalExpenses: number;
  grossProfit: number;
  totalGstCollected: number;
  modeBreakdown: { mode: string; total: number; count: number }[];
  snapshot: {
    closingSupplierDues: number;
    closingStockValue: number;
    closingBankBalance: number;
  } | null;
}

function Trend({ curr, prev }: { curr: number; prev: number }) {
  if (!prev || prev === 0) return <span className="text-gray-400 text-xs">—</span>;
  const pct = ((curr - prev) / prev) * 100;
  const pos = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${pos ? 'text-green-600' : 'text-red-600'}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

function StatCard({ label, values, isCurrency = true }: {
  label: string;
  values: { fy: string; val: number; prev?: number }[];
  isCurrency?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 font-medium mb-3">{label}</p>
      <div className="space-y-3">
        {values.map((v, i) => (
          <div key={v.fy} className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">FY {v.fy}</p>
              <p className={`font-bold ${i === 0 ? 'text-lg text-gray-900' : 'text-sm text-gray-500'}`}>
                {isCurrency ? `₹${fmt(v.val)}` : fmt(v.val)}
              </p>
            </div>
            {i === 0 && v.prev !== undefined && (
              <Trend curr={v.val} prev={v.prev} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const MODE_COLORS: Record<string, string> = {
  CASH:  'bg-green-500',
  UPI:   'bg-purple-500',
  CARD:  'bg-blue-500',
};

export default function YearComparisonPage() {
  const [data,    setData]    = useState<FYData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/financial-year/comparison');
      setData(res.data);
    } catch {
      setError('Failed to load comparison data');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  );
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (data.length < 2) return (
    <div className="p-6 text-gray-500 text-center">
      <p className="font-semibold">Not enough data for comparison</p>
      <p className="text-sm mt-1">Year comparison is available once you have at least 2 financial years</p>
    </div>
  );

  const [curr, prev, prev2] = data;  // sorted most recent first

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Year-on-Year Comparison</h1>
          <p className="text-sm text-gray-500">
            Comparing FY {curr.fyCode} vs FY {prev.fyCode}{prev2 ? ` vs FY ${prev2.fyCode}` : ''}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sales" values={[
          { fy: curr.fyCode, val: curr.totalSales, prev: prev.totalSales },
          { fy: prev.fyCode, val: prev.totalSales },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.totalSales }] : []),
        ]} />

        <StatCard label="Total Purchases" values={[
          { fy: curr.fyCode, val: curr.totalPurchases, prev: prev.totalPurchases },
          { fy: prev.fyCode, val: prev.totalPurchases },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.totalPurchases }] : []),
        ]} />

        <StatCard label="Gross Profit" values={[
          { fy: curr.fyCode, val: curr.grossProfit, prev: prev.grossProfit },
          { fy: prev.fyCode, val: prev.grossProfit },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.grossProfit }] : []),
        ]} />

        <StatCard label="GST Collected" values={[
          { fy: curr.fyCode, val: curr.totalGstCollected, prev: prev.totalGstCollected },
          { fy: prev.fyCode, val: prev.totalGstCollected },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.totalGstCollected }] : []),
        ]} />

        <StatCard label="Total Bills" isCurrency={false} values={[
          { fy: curr.fyCode, val: curr.totalBills, prev: prev.totalBills },
          { fy: prev.fyCode, val: prev.totalBills },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.totalBills }] : []),
        ]} />

        <StatCard label="Total GRNs" isCurrency={false} values={[
          { fy: curr.fyCode, val: curr.totalGrns, prev: prev.totalGrns },
          { fy: prev.fyCode, val: prev.totalGrns },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.totalGrns }] : []),
        ]} />

        <StatCard label="Supplier Payments" values={[
          { fy: curr.fyCode, val: curr.totalPaymentsMade, prev: prev.totalPaymentsMade },
          { fy: prev.fyCode, val: prev.totalPaymentsMade },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.totalPaymentsMade }] : []),
        ]} />

        <StatCard label="Total Expenses" values={[
          { fy: curr.fyCode, val: curr.totalExpenses, prev: prev.totalExpenses },
          { fy: prev.fyCode, val: prev.totalExpenses },
          ...(prev2 ? [{ fy: prev2.fyCode, val: prev2.totalExpenses }] : []),
        ]} />
      </div>

      {/* Payment mode breakdown comparison */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Payment Mode Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[curr, prev].map(fy => {
            const total = fy.modeBreakdown.reduce((s, m) => s + m.total, 0);
            return (
              <div key={fy.fyCode}>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  FY {fy.fyCode}
                  {fy.isActive && !fy.isClosed && (
                    <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Active</span>
                  )}
                </p>
                <div className="space-y-2">
                  {fy.modeBreakdown.sort((a,b) => b.total - a.total).map(m => {
                    const pct = total > 0 ? (m.total / total) * 100 : 0;
                    return (
                      <div key={m.mode}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 font-medium">{m.mode}</span>
                          <span className="text-gray-500">{fmtL(m.total)} ({pct.toFixed(0)}%) · {m.count} bills</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${MODE_COLORS[m.mode] ?? 'bg-gray-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Closing snapshots for closed years */}
      {data.some(d => d.snapshot) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Closing Snapshots (closed years)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="px-4 py-2 text-left">Financial Year</th>
                  <th className="px-4 py-2 text-right">Supplier Dues C/F</th>
                  <th className="px-4 py-2 text-right">Closing Stock</th>
                  <th className="px-4 py-2 text-right">Bank Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.filter(d => d.snapshot).map(d => (
                  <tr key={d.fyCode} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold text-gray-800">FY {d.fyCode}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold">₹{fmt(d.snapshot!.closingSupplierDues)}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-semibold">₹{fmt(d.snapshot!.closingStockValue)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-semibold">₹{fmt(d.snapshot!.closingBankBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
