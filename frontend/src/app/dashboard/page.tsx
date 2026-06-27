'use client';

import Link from 'next/link';
import {
  IndianRupee, ShoppingBag, AlertTriangle,
  PackageCheck, TrendingUp, TrendingDown, Minus,
  CalendarRange, Wallet, Smartphone, CreditCard, Globe, Clock, ChevronRight,
  BarChart2, Tag,
} from 'lucide-react';
import { getUser } from '@/lib/auth';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Header from '@/components/layout/Header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useWebSocket } from '@/providers/WebSocketProvider';
import api from '@/lib/api';
import type { DashboardData } from '@/types';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  trend?: number | null;
}

function StatCard({ title, value, subtitle, icon: Icon, iconBg, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`${iconBg} w-11 h-11 rounded-xl flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400'
          }`}>
            {trend > 0
              ? <TrendingUp className="w-3 h-3" />
              : trend < 0
              ? <TrendingDown className="w-3 h-3" />
              : <Minus className="w-3 h-3" />}
            {trend > 0 ? '+' : ''}{trend}% vs yesterday
          </div>
        )}
        {subtitle && !trend && (
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(n);
}

interface MarginStats {
  totalProducts: number;
  withCostPrice: number;
  zeroCostCount: number;
  negativeCount: number;
  suspectCount: number;
  avgMargin: number;
  topCategories: { name: string; avgMargin: number; count: number }[];
  bottomCategories: { name: string; avgMargin: number; count: number }[];
  negativeMarginProducts: { id: string; name: string; sellingPrice: number; costPrice: number; margin: number }[];
}

function MarginCard({ stats }: { stats: MarginStats }) {
  const marginColor = stats.avgMargin >= 20 ? 'text-green-600' : stats.avgMargin >= 10 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">Product Margin Overview</h3>
        </div>
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">Owner only</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-indigo-50 rounded-lg p-3 text-center">
          <p className={`text-2xl font-bold ${marginColor}`}>{stats.avgMargin}%</p>
          <p className="text-xs text-gray-500 mt-0.5">Gross margin</p>
          {stats.suspectCount > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">({stats.suspectCount} outliers excluded)</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-800">{stats.withCostPrice}</p>
          <p className="text-xs text-gray-500 mt-0.5">With cost price</p>
        </div>
        <div className={`${stats.zeroCostCount > 0 ? 'bg-amber-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
          <p className={`text-2xl font-bold ${stats.zeroCostCount > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{stats.zeroCostCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">No cost price</p>
        </div>
        <div className={`${stats.negativeCount > 0 ? 'bg-red-50' : 'bg-gray-50'} rounded-lg p-3 text-center`}>
          <p className={`text-2xl font-bold ${stats.negativeCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>{stats.negativeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Below cost</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Highest margin categories</p>
          <div className="space-y-1.5">
            {stats.topCategories.map(c => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate max-w-[60%]">{c.name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-green-200 w-16">
                    <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${Math.min(c.avgMargin / 70 * 100, 100)}%` }} />
                  </div>
                  <span className="font-semibold text-green-700 w-12 text-right">{c.avgMargin}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lowest margin categories</p>
          <div className="space-y-1.5">
            {stats.bottomCategories.map(c => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate max-w-[60%]">{c.name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-red-100 w-16">
                    <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(Math.abs(c.avgMargin) / 70 * 100, 100)}%` }} />
                  </div>
                  <span className={`font-semibold w-12 text-right ${c.avgMargin < 0 ? 'text-red-600' : 'text-amber-600'}`}>{c.avgMargin}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Negative margin alert */}
      {stats.negativeCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {stats.negativeCount} products priced below cost — likely unit mismatch (bulk cost vs unit price)
          </p>
          <div className="space-y-1">
            {stats.negativeMarginProducts.slice(0, 5).map(p => (
              <Link key={p.id} href={`/dashboard/products/${p.id}`} className="flex items-center justify-between text-xs hover:underline">
                <span className="text-red-700 truncate max-w-[60%]">{p.name}</span>
                <span className="text-red-600 font-medium">Cost ₹{p.costPrice.toFixed(0)} / Sell ₹{p.sellingPrice.toFixed(0)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {stats.zeroCostCount > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          <Tag className="w-3 h-3 inline mr-1" />
          {stats.zeroCostCount} products have no cost price — margin is understated. Add cost prices in product catalogue.
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const queryClient    = useQueryClient();
  const { connected }  = useWebSocket();
  const user = getUser<{ role: string }>();

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<DashboardData>('/reports/dashboard/today');
      return res.data;
    },
    staleTime: 60_000,
  });

  const isOwner = user?.role === 'SUPER_ADMIN';
  const { data: marginStats } = useQuery<MarginStats>({
    queryKey: ['margin-stats'],
    queryFn: async () => {
      const res = await api.get<MarginStats>('/products/margin-stats');
      return res.data;
    },
    enabled: isOwner,
    staleTime: 300_000,
  });

  // ── Granular WS invalidation ──────────────────────────
  useWebSocketEvent('bill.created',    () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('bill.voided',     () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('shift.opened',    () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('shift.closed',    () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('day.opened',      () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('day.closed',      () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('product.updated', () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('grn.approved',             () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('inventory.stock-adjusted', () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('online-order.created',     () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));
  useWebSocketEvent('online-order.updated',     () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }));

  const chartData = data
    ? [
        { day: 'Yesterday', sales: data.sales.yesterdaySales, bills: data.sales.yesterdayBills },
        { day: 'Today',     sales: data.sales.todaySales,     bills: data.sales.todayBills },
      ]
    : [];

  return (
    <>
      <Header
        title="Control Tower"
        actions={
          <div className="flex items-center gap-3">
            {data && (
              <span className="text-xs text-gray-400">
                {new Date(data.generatedAt).toLocaleTimeString('en-IN')}
              </span>
            )}
            <span className={`text-xs font-medium ${connected ? 'text-green-600' : 'text-gray-400'}`}>
              {connected ? '● Live' : '○ Offline'}
            </span>
          </div>
        }
      />

      <main className="flex-1 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Today&apos;s Overview</h2>
        </div>

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            Could not load dashboard data. Is the backend running?
          </div>
        )}

        {isLoading && !data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-24 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
                <div className="h-7 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Today's Sales"
                value={`₹${fmt(data.sales.todaySales)}`}
                icon={IndianRupee}
                iconBg="bg-[#1B4F8A]"
                trend={data.sales.salesGrowth}
              />
              <StatCard
                title="Total Bills"
                value={String(data.sales.todayBills)}
                subtitle={`Yesterday: ${data.sales.yesterdayBills} bills`}
                icon={ShoppingBag}
                iconBg="bg-emerald-500"
              />
              <StatCard
                title="Low Stock Alerts"
                value={String(data.alerts.lowStockCount)}
                subtitle="Products below reorder level"
                icon={AlertTriangle}
                iconBg={data.alerts.lowStockCount > 0 ? 'bg-amber-500' : 'bg-gray-400'}
              />
              <StatCard
                title="Pending GRNs"
                value={String(data.alerts.pendingGRNs)}
                subtitle="Awaiting approval"
                icon={PackageCheck}
                iconBg={data.alerts.pendingGRNs > 0 ? 'bg-orange-500' : 'bg-gray-400'}
              />
            </div>

            {/* Second row — month, avg basket, payment split, online orders */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="This Month"
                value={`₹${fmt(data.thisMonth.revenue)}`}
                subtitle={`${data.thisMonth.bills} bills MTD`}
                icon={CalendarRange}
                iconBg="bg-indigo-500"
              />
              <StatCard
                title="Avg Basket"
                value={`₹${fmt(data.avgBasket.today)}`}
                icon={ShoppingBag}
                iconBg="bg-teal-500"
                trend={data.avgBasket.growth}
              />
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Payments Today</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Cash
                    </span>
                    <span className="font-semibold text-gray-800">₹{fmt(data.paymentBreakdown.cash)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600">
                      <Smartphone className="w-3.5 h-3.5 text-violet-600" /> UPI
                    </span>
                    <span className="font-semibold text-gray-800">₹{fmt(data.paymentBreakdown.upi)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-gray-600">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Card
                    </span>
                    <span className="font-semibold text-gray-800">₹{fmt(data.paymentBreakdown.card)}</span>
                  </div>
                </div>
              </div>
              <Link
                href="/dashboard/online-orders"
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#1B4F8A] hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Online Orders</p>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B4F8A] transition-colors" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-9 h-9 rounded-lg flex items-center justify-center">
                    <Globe className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900 leading-tight">{data.onlineOrders.todayCount}</p>
                    <p className="text-xs text-gray-400">orders today</p>
                  </div>
                </div>
                <div className="text-xs text-gray-600 flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    <span className="font-semibold text-amber-700">{data.onlineOrders.pendingCount}</span> pending
                  </span>
                  <span className="font-semibold text-gray-700">₹{fmt(data.onlineOrders.todayRevenue)}</span>
                </div>
              </Link>
            </div>

            {/* Charts + Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Sales chart */}
              <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Sales Comparison</h3>
                {chartData[0].sales === 0 && chartData[1].sales === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                    No sales data yet for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `₹${fmt(v)}`}
                      />
                      <Tooltip
                        formatter={(v) => [`₹${fmt(Number(v))}`, 'Sales']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="sales" fill="#1B4F8A" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Top products */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Products Today</h3>
                {data.topSellingProducts.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                    No sales recorded today
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.topSellingProducts.map((p, i) => (
                      <div key={p.productId} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.productName}</p>
                          <p className="text-xs text-gray-400">Qty: {p.totalQty}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 shrink-0">
                          ₹{fmt(p.totalRevenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Alerts row */}
            {(data.alerts.cashMismatch > 0 || data.alerts.pendingPayments > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.alerts.cashMismatch > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Cash Mismatch</p>
                      <p className="text-xs text-red-500">{data.alerts.cashMismatch} shift(s) with cash discrepancy</p>
                    </div>
                  </div>
                )}
                {data.alerts.pendingPayments > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                    <IndianRupee className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700">Supplier Payments Due</p>
                      <p className="text-xs text-amber-600">{data.alerts.pendingPayments} supplier(s) with outstanding balance</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Margin card — owner only */}
            {isOwner && marginStats && (
              <MarginCard stats={marginStats} />
            )}
          </>
        )}
      </main>
    </>
  );
}
