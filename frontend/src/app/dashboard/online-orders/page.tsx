'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag, Search, RefreshCw, Eye,
  Clock, CheckCircle2, Truck, XCircle, Package, RotateCw, Printer, CalendarRange,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { Tabs } from '@/components/shared/Tabs';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type OrderStatus =
  | 'PENDING_PAYMENT' | 'PENDING_COD' | 'CONFIRMED'
  | 'PROCESSING' | 'READY' | 'DELIVERED' | 'CANCELLED' | 'PAYMENT_FAILED';

type Decimal = number | string;

interface OnlineOrderItem {
  id: string;
  productName: string;
  packLabel: string | null;
  quantity: Decimal;
  unitPrice: Decimal;
  total: Decimal;
}

interface DeliveryAddress {
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  state: string;
}

interface OnlineOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryType: 'HOME_DELIVERY' | 'STORE_PICKUP';
  deliveryAddress: DeliveryAddress | null;
  paymentMethod: 'COD' | 'RAZORPAY';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  status: OrderStatus;
  subtotal: Decimal;
  deliveryFee: Decimal;
  total: Decimal;
  customerNotes: string | null;
  createdAt: string;
  items: OnlineOrderItem[];
}

function toNum(v: Decimal): number {
  return typeof v === 'string' ? parseFloat(v) : v;
}

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PENDING_PAYMENT:  { label: 'Awaiting Payment', color: '#b45309', bg: '#fef3c7' },
  PENDING_COD:      { label: 'Pending COD',       color: '#b45309', bg: '#fef3c7' },
  CONFIRMED:        { label: 'Confirmed',          color: '#1d4ed8', bg: '#dbeafe' },
  PROCESSING:       { label: 'Processing',         color: '#6d28d9', bg: '#ede9fe' },
  READY:            { label: 'Ready',              color: '#0369a1', bg: '#e0f2fe' },
  DELIVERED:        { label: 'Delivered',          color: '#15803d', bg: '#dcfce7' },
  CANCELLED:        { label: 'Cancelled',          color: '#b91c1c', bg: '#fee2e2' },
  PAYMENT_FAILED:   { label: 'Payment Failed',     color: '#b91c1c', bg: '#fee2e2' },
};

const TABS = [
  { key: 'ALL',             label: 'All' },
  { key: 'PENDING_COD',     label: 'Pending COD' },
  { key: 'CONFIRMED',       label: 'Confirmed' },
  { key: 'PROCESSING',      label: 'Processing' },
  { key: 'DELIVERED',       label: 'Delivered' },
  { key: 'CANCELLED',       label: 'Cancelled' },
];

function fmt(n: Decimal) {
  return '₹' + toNum(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function printOrderSlip(order: OnlineOrder) {
  const addr = order.deliveryAddress;
  const addrLine = addr
    ? `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city} - ${addr.pincode}, ${addr.state}`
    : 'Store Pickup';
  const html = `<!DOCTYPE html><html><head><title>Order ${order.orderNumber}</title>
  <style>
    body{font-family:monospace;font-size:13px;padding:16px;max-width:320px;margin:0 auto}
    h2{text-align:center;font-size:15px;margin:0 0 4px}
    .center{text-align:center} .line{border-top:1px dashed #999;margin:8px 0}
    table{width:100%;border-collapse:collapse} td{padding:2px 0}
    .right{text-align:right} .bold{font-weight:bold} .small{font-size:11px}
  </style></head><body>
  <h2>Srivani Stores</h2>
  <p class="center small">Online Order Slip</p>
  <div class="line"></div>
  <table><tr><td>Order #</td><td class="right bold">${order.orderNumber}</td></tr>
  <tr><td>Date</td><td class="right">${fmtDate(order.createdAt)}</td></tr>
  <tr><td>Customer</td><td class="right">${order.customerName}</td></tr>
  <tr><td>Phone</td><td class="right">${order.customerPhone}</td></tr>
  <tr><td>Payment</td><td class="right">${order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid Online'}</td></tr>
  <tr><td>Delivery</td><td class="right">${order.deliveryType === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}</td></tr>
  </table>
  <div class="line"></div>
  <p class="small"><b>Address:</b> ${addrLine}</p>
  ${order.customerNotes ? `<p class="small"><b>Notes:</b> ${order.customerNotes}</p>` : ''}
  <div class="line"></div>
  <table>
    <tr><td class="bold">Item</td><td class="right bold">Qty</td><td class="right bold">Total</td></tr>
    ${order.items.map(i => `<tr><td>${i.productName}${i.packLabel ? ' (' + i.packLabel + ')' : ''}</td><td class="right">${i.quantity}</td><td class="right">₹${toNum(i.total).toFixed(2)}</td></tr>`).join('')}
  </table>
  <div class="line"></div>
  <table>
    <tr><td>Subtotal</td><td class="right">₹${toNum(order.subtotal).toFixed(2)}</td></tr>
    <tr><td>Delivery Fee</td><td class="right">${toNum(order.deliveryFee) === 0 ? 'FREE' : '₹' + toNum(order.deliveryFee).toFixed(2)}</td></tr>
    <tr><td class="bold">TOTAL</td><td class="right bold">₹${toNum(order.total).toFixed(2)}</td></tr>
  </table>
  <div class="line"></div>
  <p class="center small">Thank you for shopping with us!</p>
  </body></html>`;
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
}

export default function OnlineOrdersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab]       = useState('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const { data: orders = [], isLoading, isError, refetch } = useQuery<OnlineOrder[]>({
    queryKey: ['online-orders-admin', dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo)   params.dateTo   = dateTo;
      const { data } = await api.get('/online-orders/admin', { params });
      return data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load orders');
  }, [isError]);

  const { mutate: updateStatus } = useMutation({
    mutationFn: async ({ orderNumber, status }: { orderNumber: string; status: OrderStatus }) => {
      const { data } = await api.patch(`/online-orders/${orderNumber}/status`, { status });
      return data;
    },
    onMutate: ({ orderNumber }) => setBusyId(orderNumber),
    onSuccess: (updated: OnlineOrder) => {
      toast.success(`Order ${updated.orderNumber} → ${STATUS_META[updated.status].label}`);
      qc.invalidateQueries({ queryKey: ['online-orders-admin'] });
      qc.invalidateQueries({ queryKey: ['online-order', updated.orderNumber] });
    },
    onError: () => toast.error('Failed to update status'),
    onSettled: () => setBusyId(null),
  });

  function quickAction(e: React.MouseEvent, orderNumber: string, status: OrderStatus, confirmMsg?: string) {
    e.stopPropagation();
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    updateStatus({ orderNumber, status });
  }

  const stats = useMemo(() => {
    const todayOrders = orders.filter(o => isToday(o.createdAt));
    const pendingCod = orders.filter(o => o.status === 'PENDING_COD').length;
    const confirmed = orders.filter(o => o.status === 'CONFIRMED').length;
    const todayRevenue = todayOrders
      .filter(o => o.status !== 'CANCELLED' && o.status !== 'PAYMENT_FAILED')
      .reduce((s, o) => s + toNum(o.total), 0);
    return { todayCount: todayOrders.length, pendingCod, confirmed, todayRevenue };
  }, [orders]);

  const tabsWithCounts = useMemo(() =>
    TABS.map(t => ({
      ...t,
      count: t.key === 'ALL' ? orders.length : orders.filter(o => o.status === t.key).length,
    })), [orders]);

  const filtered = useMemo(() => {
    let list = orders;
    if (tab !== 'ALL') list = list.filter(o => o.status === tab);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(o =>
        o.orderNumber.toLowerCase().includes(s) ||
        o.customerName.toLowerCase().includes(s) ||
        o.customerPhone.includes(s),
      );
    }
    return list;
  }, [orders, tab, search]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Online Orders" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<ShoppingBag className="w-5 h-5 text-[#1B4F8A]" />} label="Today's Orders" value={String(stats.todayCount)} bg="#eff6ff" />
          <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} label="Pending COD" value={String(stats.pendingCod)} bg="#fef3c7" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5 text-blue-600" />} label="Confirmed" value={String(stats.confirmed)} bg="#dbeafe" />
          <StatCard icon={<Truck className="w-5 h-5 text-green-700" />} label="Today's Revenue" value={fmt(stats.todayRevenue)} bg="#dcfce7" />
        </div>

        {/* Tabs + Search + Date filter */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} variant="pill" />
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {/* Date range */}
                <div className="flex items-center gap-1.5">
                  <CalendarRange className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="py-1.5 px-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(''); setDateTo(''); }}
                      className="text-xs text-gray-400 hover:text-red-500 px-1"
                    >✕</button>
                  )}
                </div>
                {/* Quick filters */}
                <button onClick={() => { setDateFrom(todayStr()); setDateTo(todayStr()); }}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                  Today
                </button>
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Order#, name, phone…"
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 w-44"
                  />
                </div>
                <button
                  onClick={() => refetch()}
                  className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? 'No orders match your search' : 'No orders yet'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Delivery</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Payment</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(order => {
                    const meta = STATUS_META[order.status];
                    const isBusy = busyId === order.orderNumber;
                    const canConfirm = order.status === 'PENDING_COD';
                    const canProcess = order.status === 'CONFIRMED';
                    const canDeliver = order.status === 'CONFIRMED' || order.status === 'PROCESSING' || order.status === 'READY';
                    const canCancel = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
                    return (
                      <tr
                        key={order.id}
                        onClick={() => router.push(`/dashboard/online-orders/${order.orderNumber}`)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#1B4F8A]">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{order.customerName}</div>
                          <div className="text-xs text-gray-400 md:hidden">{order.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{order.customerPhone}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            order.deliveryType === 'HOME_DELIVERY'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {order.deliveryType === 'HOME_DELIVERY' ? 'Home' : 'Pickup'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            order.paymentMethod === 'COD'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-green-50 text-green-700'
                          }`}>
                            {order.paymentMethod === 'COD' ? 'COD' : 'Online'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {fmt(order.total)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap"
                            style={{ color: meta.color, background: meta.bg }}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap">
                          {fmtDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            {canConfirm && (
                              <button
                                onClick={(e) => quickAction(e, order.orderNumber, 'CONFIRMED')}
                                disabled={isBusy}
                                className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                title="Confirm order"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                              </button>
                            )}
                            {canProcess && (
                              <button
                                onClick={(e) => quickAction(e, order.orderNumber, 'PROCESSING')}
                                disabled={isBusy}
                                className="px-2.5 py-1 text-xs font-semibold bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                title="Mark processing"
                              >
                                <RotateCw className="w-3.5 h-3.5" /> Process
                              </button>
                            )}
                            {canDeliver && (
                              <button
                                onClick={(e) => quickAction(e, order.orderNumber, 'DELIVERED', `Mark ${order.orderNumber} as delivered?`)}
                                disabled={isBusy}
                                className="px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                                title="Mark delivered"
                              >
                                <Truck className="w-3.5 h-3.5" /> Deliver
                              </button>
                            )}
                            {canCancel && (
                              <button
                                onClick={(e) => quickAction(e, order.orderNumber, 'CANCELLED', `Cancel order ${order.orderNumber}?`)}
                                disabled={isBusy}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md disabled:opacity-50 transition-colors"
                                title="Cancel order"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); printOrderSlip(order); }}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                              title="Print order slip"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/online-orders/${order.orderNumber}`); }}
                              className="p-1.5 text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50 rounded-md transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string; bg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}
