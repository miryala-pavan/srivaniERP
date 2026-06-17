'use client';

import { useState, useCallback } from 'react';
import {
  TrendingUp, Package, IndianRupee, AlertTriangle, Download,
  RefreshCw, Calendar, BarChart2, ShoppingCart, FileText,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const inr0 = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDay = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

function today()     { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
function monthStart() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
}
function lastMonthStart() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
}
function lastMonthEnd() {
  const d = new Date(); d.setDate(0);
  return d.toISOString().split('T')[0];
}

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'lastmonth' | 'custom';

function periodDates(p: Period, custom: { from: string; to: string }) {
  const t = today();
  switch (p) {
    case 'today':     return { startDate: t, endDate: t };
    case 'yesterday': return { startDate: daysAgo(1), endDate: daysAgo(1) };
    case 'week':      return { startDate: daysAgo(6), endDate: t };
    case 'month':     return { startDate: monthStart(), endDate: t };
    case 'lastmonth': return { startDate: lastMonthStart(), endDate: lastMonthEnd() };
    case 'custom':    return { startDate: custom.from, endDate: custom.to };
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    amber:  'bg-amber-50 text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
    red:    'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
    </div>
  );
}

function Empty({ msg = 'No data for this period' }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-gray-400">
      <BarChart2 className="w-8 h-8 mb-2" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today',     label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week',      label: 'Last 7 Days' },
  { id: 'month',     label: 'This Month' },
  { id: 'lastmonth', label: 'Last Month' },
  { id: 'custom',    label: 'Custom' },
];

function PeriodBar({ active, onChange, custom, onCustom }: {
  active: Period;
  onChange: (p: Period) => void;
  custom: { from: string; to: string };
  onCustom: (v: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            active === p.id
              ? 'bg-[#1B4F8A] text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4F8A]'
          }`}
        >
          {p.label}
        </button>
      ))}
      {active === 'custom' && (
        <div className="flex items-center gap-1.5 ml-1">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <input type="date" value={custom.from} max={custom.to}
            onChange={(e) => onCustom({ ...custom, from: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1B4F8A]" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={custom.to} min={custom.from} max={today()}
            onChange={(e) => onCustom({ ...custom, to: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1B4F8A]" />
        </div>
      )}
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'products' | 'inventory' | 'profit' | 'gst' | 'receivables' | 'daybook';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'sales',       label: 'Sales',        icon: TrendingUp },
  { id: 'products',    label: 'Top Products', icon: ShoppingCart },
  { id: 'inventory',   label: 'Inventory',    icon: Package },
  { id: 'profit',      label: 'Profit',       icon: IndianRupee },
  { id: 'daybook',     label: 'Day Book',     icon: BarChart2 },
  { id: 'receivables', label: 'Receivables',  icon: AlertTriangle },
  { id: 'gst',         label: 'GST Reports',  icon: FileText },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router                = useRouter();
  const [tab, setTab]         = useState<Tab>('sales');
  const [period, setPeriod]   = useState<Period>('month');
  const [custom, setCustom]   = useState({ from: monthStart(), to: today() });
  const [loading, setLoading] = useState(false);
  const [data, setData]       = useState<any>(null);

  const dates = periodDates(period, custom);

  const load = useCallback(async (t: Tab, d: typeof dates) => {
    setLoading(true);
    setData(null);
    try {
      let res: any;
      if (t === 'sales')     res = await api.get('/reports/sales/daily', { params: d });
      if (t === 'products')  res = await api.get('/reports/products/top-selling', { params: { ...d, limit: 50 } });
      if (t === 'inventory') res = await api.get('/reports/inventory/stock-summary');
      if (t === 'profit')    res = await api.get('/reports/financial/profit', { params: d });
      if (t === 'gst')       return; // handled by navigation
      setData(res?.data ?? null);
    } catch {
      setData({ _error: 'Failed to load report' });
    } finally {
      setLoading(false);
    }
  }, []);

  function handleTab(t: Tab) {
    if (t === 'receivables') { router.push('/dashboard/reports/ageing'); return; }
    if (t === 'daybook')     { router.push('/dashboard/reports/day-book'); return; }
    setTab(t);
    if (t !== 'gst') load(t, dates);
  }

  function handlePeriod(p: Period) {
    setPeriod(p);
    if (tab !== 'gst' && tab !== 'inventory') {
      load(tab, periodDates(p, custom));
    }
  }

  function handleCustom(c: typeof custom) {
    setCustom(c);
    if (tab !== 'gst' && tab !== 'inventory') {
      load(tab, periodDates('custom', c));
    }
  }

  function refresh() {
    if (tab !== 'gst') load(tab, dates);
  }

  // Initial load
  useState(() => { load('sales', dates); });

  const showPeriod = tab !== 'inventory' && tab !== 'gst';

  return (
    <>
      <Header title="Reports" />
      <main className="flex-1 p-6 space-y-4">

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === id ? 'bg-[#1B4F8A] text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Period selector + refresh */}
        {showPeriod && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <PeriodBar active={period} onChange={handlePeriod} custom={custom} onCustom={handleCustom} />
            <button onClick={refresh} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1B4F8A] border border-gray-200 px-3 py-1.5 rounded-lg hover:border-[#1B4F8A] transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        )}

        {/* ── GST tab — just link ── */}
        {tab === 'gst' && <GstTab />}

        {/* ── Other tabs ── */}
        {tab !== 'gst' && (
          <>
            {loading && <Spinner />}
            {!loading && data?._error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{data._error}</div>
            )}
            {!loading && data && !data._error && (
              <>
                {tab === 'sales'     && <SalesTab data={data} dates={dates} />}
                {tab === 'products'  && <ProductsTab data={data} />}
                {tab === 'inventory' && <InventoryTab data={data} />}
                {tab === 'profit'    && <ProfitTab data={data} />}
              </>
            )}
            {!loading && !data && <Empty />}
          </>
        )}

      </main>
    </>
  );
}

// ── Sales Tab ─────────────────────────────────────────────────────────────────

function SalesTab({ data, dates }: { data: any; dates: any }) {
  const { daily = [], summary = {} } = data;

  if (!daily.length) return <Empty />;

  const chartData = daily.map((d: any) => ({
    date:  fmtDay(d.date),
    sales: Math.round(d.grandTotal),
  }));

  const avgBill = summary.totalBills > 0
    ? summary.grandTotal / summary.totalBills
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue"   value={`₹${inr(summary.grandTotal ?? 0)}`}    color="blue" />
        <StatCard label="Total Bills"     value={inr0(summary.totalBills ?? 0)}          color="green" />
        <StatCard label="Avg Bill Value"  value={`₹${inr(avgBill)}`}                     color="purple" />
        <StatCard label="Total Discount"  value={`₹${inr(summary.discountAmount ?? 0)}`} color="amber" />
      </div>

      {/* Bar chart */}
      {daily.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Sales</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={daily.length > 14 ? 8 : 24}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => [`₹${inr(Number(v))}`, 'Sales']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="sales" fill="#1B4F8A" radius={[4, 4, 0, 0]}>
                {chartData.map((_: any, i: number) => (
                  <Cell key={i} fill={i === chartData.length - 1 ? '#C6853A' : '#1B4F8A'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            Day-wise Breakdown ({fmtDate(dates.startDate)} – {fmtDate(dates.endDate)})
          </h3>
          <span className="text-xs text-gray-400">{daily.length} day{daily.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-right px-4 py-2.5">Bills</th>
                <th className="text-right px-4 py-2.5">Subtotal</th>
                <th className="text-right px-4 py-2.5">Discount</th>
                <th className="text-right px-4 py-2.5">Tax</th>
                <th className="text-right px-4 py-2.5 font-bold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...daily].reverse().map((d: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-700">{fmtDate(d.date)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{d.totalBills}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(d.subtotalAmount)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-600">
                    {d.discountAmount > 0 ? `−₹${inr(d.discountAmount)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(d.totalTax)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#1B4F8A]">₹{inr(d.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr className="font-semibold text-sm">
                <td className="px-4 py-2.5 text-gray-700">Total</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{summary.totalBills}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">₹{inr(summary.subtotalAmount)}</td>
                <td className="px-4 py-2.5 text-right text-amber-700">
                  {summary.discountAmount > 0 ? `−₹${inr(summary.discountAmount)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700">₹{inr(summary.totalTax)}</td>
                <td className="px-4 py-2.5 text-right text-[#1B4F8A]">₹{inr(summary.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────────

function ProductsTab({ data }: { data: any }) {
  const { products = [], summary = {} } = data;
  if (!products.length) return <Empty msg="No sales data for this period" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Products Sold" value={inr0(summary.totalProducts)} color="blue" />
        <StatCard label="Total Revenue" value={`₹${inr(summary.totalRevenue)}`} color="green" />
        <StatCard label="Total Qty Sold" value={inr0(summary.totalQty)} color="purple" />
      </div>

      {/* Top 10 bar chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 10 Products by Revenue</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={products.slice(0, 10).map((p: any) => ({
            name: p.productName.length > 18 ? p.productName.slice(0, 18) + '…' : p.productName,
            revenue: Math.round(p.totalRevenue),
          }))} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} tickLine={false} />
            <Tooltip formatter={(v: any) => [`₹${inr(Number(v))}`, 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="revenue" fill="#1B4F8A" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">All Products — by Revenue</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 w-8">#</th>
                <th className="text-left px-4 py-2.5">Product</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Category</th>
                <th className="text-right px-4 py-2.5">Qty</th>
                <th className="text-right px-4 py-2.5">Avg Price</th>
                <th className="text-right px-4 py-2.5">Revenue</th>
                <th className="text-right px-4 py-2.5 hidden lg:table-cell">% Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p: any, i: number) => (
                <tr key={p.productId} className={`hover:bg-gray-50 ${i < 3 ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800">{p.productName}</p>
                    {p.productCode && <p className="text-xs text-gray-400 font-mono">{p.productCode}</p>}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-500">{p.categoryName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{inr0(p.totalQty)} {p.unitOfMeasure}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(p.avgPrice)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#1B4F8A]">₹{inr(p.totalRevenue)}</td>
                  <td className="px-4 py-2.5 text-right hidden lg:table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-[#1B4F8A] h-1.5 rounded-full" style={{ width: `${Math.min(p.revenuePct, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{p.revenuePct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab({ data }: { data: any }) {
  const { products = [], summary = {} } = data;
  const [filter, setFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = products.filter((p: any) => {
    if (filter !== 'ALL' && p.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.productName.toLowerCase().includes(q) || (p.hsnCode ?? '').includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Products" value={inr0(summary.totalProducts ?? 0)} color="blue" />
        <StatCard label="In Stock"       value={inr0(summary.inStock ?? 0)}       color="green" />
        <StatCard label="Low Stock"      value={inr0(summary.lowStock ?? 0)}      color="amber"
          sub="Below reorder level" />
        <StatCard label="Out of Stock"   value={inr0(summary.outOfStock ?? 0)}    color="red" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Stock Value (Cost)"    value={`₹${inr(summary.totalStockValue ?? 0)}`}  color="purple"
          sub="Capital tied up in inventory" />
        <StatCard label="Total Stock Value (Selling)" value={`₹${inr(summary.totalSellValue ?? 0)}`}  color="green"
          sub="Potential revenue if all sold" />
      </div>

      {/* Filter + search */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['ALL', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f ? 'bg-[#1B4F8A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4F8A]'
            }`}>
            {f === 'ALL' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product or HSN…"
          className="ml-auto text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:border-[#1B4F8A]" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Stock Status</h3>
          <span className="text-xs text-gray-400">{filtered.length} products</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Product</th>
                <th className="text-left px-4 py-2.5 hidden md:table-cell">Category</th>
                <th className="text-center px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Stock</th>
                <th className="text-right px-4 py-2.5">Reorder</th>
                <th className="text-right px-4 py-2.5 hidden lg:table-cell">Stock Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.slice(0, 200).map((p: any) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.status === 'OUT_OF_STOCK' ? 'bg-red-50/30' : p.status === 'LOW_STOCK' ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800 text-xs leading-tight">{p.productName}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{p.hsnCode}</p>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-500">{p.categoryName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      p.status === 'IN_STOCK'     ? 'bg-green-100 text-green-700' :
                      p.status === 'LOW_STOCK'    ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                    }`}>
                      {p.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold text-sm ${
                    p.currentStock <= 0 ? 'text-red-600' : p.currentStock <= p.reorderLevel ? 'text-amber-600' : 'text-green-700'
                  }`}>
                    {inr0(p.currentStock)} <span className="text-xs font-normal text-gray-400">{p.unitOfMeasure}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-500">{inr0(p.reorderLevel)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-gray-600 hidden lg:table-cell">
                    {p.stockValue > 0 ? `₹${inr(p.stockValue)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
              Showing first 200 of {filtered.length} — use search to narrow down
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Profit Tab ────────────────────────────────────────────────────────────────

function ProfitTab({ data }: { data: any }) {
  if (!data) return <Empty />;

  const { totalSales = 0, totalPurchases = 0, grossProfit = 0, totalDiscount = 0, tax = {} } = data;
  const margin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total Sales Revenue" value={`₹${inr(totalSales)}`}      color="blue" />
        <StatCard label="Total Purchases"      value={`₹${inr(totalPurchases)}`}  color="amber" />
        <StatCard label="Gross Profit"         value={`₹${inr(grossProfit)}`}
          sub={`${margin}% margin`}
          color={grossProfit >= 0 ? 'green' : 'red'} />
        <StatCard label="Total Discount Given" value={`₹${inr(totalDiscount)}`}  color="purple" />
        <StatCard label="GST Collected"        value={`₹${inr(tax.totalTaxCollected ?? 0)}`} color="blue" />
        <StatCard label="GST Paid (ITC)"       value={`₹${inr(tax.totalTaxPaid ?? 0)}`}     color="amber" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Summary</h3>
        {[
          { label: 'Sales Revenue',        value: totalSales,           color: 'text-blue-700' },
          { label: '− Total Purchases',    value: -totalPurchases,      color: 'text-amber-600', minus: true },
          { label: '= Gross Profit',       value: grossProfit,          color: grossProfit >= 0 ? 'text-green-700' : 'text-red-700', border: true },
          { label: 'GST Collected',        value: tax.totalTaxCollected ?? 0, color: 'text-gray-600' },
          { label: '− ITC (GST Paid)',     value: -(tax.totalTaxPaid ?? 0),   color: 'text-gray-600', minus: true },
          { label: '= Net Tax Payable',    value: tax.netTaxPayable ?? 0,     color: (tax.netTaxPayable ?? 0) >= 0 ? 'text-red-600' : 'text-green-600', border: true },
        ].map(({ label, value, color, border }, i) => (
          <div key={i} className={`flex items-center justify-between py-1.5 ${border ? 'border-t border-gray-200 pt-2.5 mt-1' : ''}`}>
            <span className="text-sm text-gray-600">{label}</span>
            <span className={`text-sm font-semibold ${color}`}>
              ₹{inr(Math.abs(value))}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        <p className="font-semibold mb-1">💡 Note on Gross Profit</p>
        <p>This is based on GRN purchase totals vs sales totals. For accurate per-product margin, ensure all GRN cost prices are entered correctly.</p>
      </div>
    </div>
  );
}

// ── GST Tab ───────────────────────────────────────────────────────────────────

function GstTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        { title: 'Sales Register',    desc: 'B2B, B2C sales with GST breakdown. Excel export.', href: '/dashboard/reports/gst' },
        { title: 'Purchase Register', desc: 'GRN-wise ITC details and eligibility.', href: '/dashboard/reports/gst' },
        { title: 'GSTR-3B Summary',   desc: 'Monthly net tax payable calculation.', href: '/dashboard/reports/gst' },
        { title: 'HSN Summary',       desc: 'HSN-wise taxable value and tax amounts.', href: '/dashboard/reports/gst' },
        { title: 'GSTR-1 JSON',       desc: 'Downloadable JSON for GSTN portal upload.', href: '/dashboard/reports/gst' },
      ].map(({ title, desc, href }) => (
        <Link key={title} href={href}
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-[#1B4F8A] hover:shadow-sm transition-all flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
