'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Package, User, MapPin, CreditCard,
  CheckCircle2, XCircle, Truck, RefreshCw, Clock, Printer,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type OrderStatus =
  | 'PENDING_PAYMENT' | 'PENDING_COD' | 'CONFIRMED'
  | 'PROCESSING' | 'READY' | 'DELIVERED' | 'CANCELLED' | 'PAYMENT_FAILED';

type Decimal = number | string;

interface OnlineOrderItem {
  id: string;
  productCode: string;
  productName: string;
  packLabel: string | null;
  pluBarcode: string | null;
  quantity: Decimal;
  unitPrice: Decimal;
  total: Decimal;
  mrp: Decimal | null;
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
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  subtotal: Decimal;
  deliveryFee: Decimal;
  total: Decimal;
  customerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OnlineOrderItem[];
}

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PENDING_PAYMENT:  { label: 'Awaiting Payment', color: '#b45309', bg: '#fef3c7' },
  PENDING_COD:      { label: 'Pending COD',       color: '#b45309', bg: '#fef3c7' },
  CONFIRMED:        { label: 'Confirmed',          color: '#1d4ed8', bg: '#dbeafe' },
  PROCESSING:       { label: 'Processing',         color: '#6d28d9', bg: '#ede9fe' },
  READY:            { label: 'Ready for Pickup',   color: '#0369a1', bg: '#e0f2fe' },
  DELIVERED:        { label: 'Delivered',          color: '#15803d', bg: '#dcfce7' },
  CANCELLED:        { label: 'Cancelled',          color: '#b91c1c', bg: '#fee2e2' },
  PAYMENT_FAILED:   { label: 'Payment Failed',     color: '#b91c1c', bg: '#fee2e2' },
};

type TransitionVariant = 'confirm' | 'danger' | 'info';

interface Transition {
  label: string;
  status: OrderStatus;
  variant: TransitionVariant;
  icon: React.ReactNode;
}

const TRANSITIONS: Partial<Record<OrderStatus, Transition[]>> = {
  PENDING_PAYMENT: [
    { label: 'Cancel Order', status: 'CANCELLED', variant: 'danger', icon: <XCircle className="w-4 h-4" /> },
  ],
  PAYMENT_FAILED: [
    { label: 'Cancel Order', status: 'CANCELLED', variant: 'danger', icon: <XCircle className="w-4 h-4" /> },
  ],
  PENDING_COD: [
    { label: 'Confirm Order', status: 'CONFIRMED', variant: 'confirm', icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Cancel Order', status: 'CANCELLED', variant: 'danger', icon: <XCircle className="w-4 h-4" /> },
  ],
  CONFIRMED: [
    { label: 'Mark Processing', status: 'PROCESSING', variant: 'info', icon: <RefreshCw className="w-4 h-4" /> },
    { label: 'Mark Delivered', status: 'DELIVERED', variant: 'confirm', icon: <Truck className="w-4 h-4" /> },
    { label: 'Cancel Order', status: 'CANCELLED', variant: 'danger', icon: <XCircle className="w-4 h-4" /> },
  ],
  PROCESSING: [
    { label: 'Mark Delivered', status: 'DELIVERED', variant: 'confirm', icon: <Truck className="w-4 h-4" /> },
    { label: 'Cancel Order', status: 'CANCELLED', variant: 'danger', icon: <XCircle className="w-4 h-4" /> },
  ],
  READY: [
    { label: 'Mark Delivered', status: 'DELIVERED', variant: 'confirm', icon: <Truck className="w-4 h-4" /> },
  ],
};

const VARIANT_CLASSES: Record<TransitionVariant, string> = {
  confirm: 'bg-green-600 hover:bg-green-700 text-white',
  danger:  'bg-red-500 hover:bg-red-600 text-white',
  info:    'bg-[#1B4F8A] hover:bg-[#163f6f] text-white',
};

function toNum(v: Decimal): number {
  return typeof v === 'string' ? parseFloat(v) : v;
}

function fmt(n: Decimal) {
  return '₹' + toNum(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function OnlineOrderDetailPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const { orderNumber } = params;
  const router = useRouter();
  const qc = useQueryClient();

  const { data: order, isLoading, isError } = useQuery<OnlineOrder>({
    queryKey: ['online-order', orderNumber],
    queryFn: async () => {
      const { data } = await api.get(`/online-orders/${orderNumber}`);
      return data;
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error('Order not found');
      router.push('/dashboard/online-orders');
    }
  }, [isError, router]);

  const { mutate: resendWhatsApp, isPending: sending } = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/online-orders/${orderNumber}/notify`);
      return data;
    },
    onSuccess: (res: { sent: boolean; to: string | null }) =>
      res.sent
        ? toast.success(`WhatsApp sent to ${res.to}`)
        : toast.error('No phone number on this order'),
    onError: () => toast.error('Failed to send WhatsApp'),
  });

  const { mutate: updateStatus, isPending: updating } = useMutation({
    mutationFn: async (status: OrderStatus) => {
      const { data } = await api.patch(`/online-orders/${orderNumber}/status`, { status });
      return data;
    },
    onSuccess: (updated: OnlineOrder) => {
      toast.success(`Order marked as ${STATUS_META[updated.status].label}`);
      qc.setQueryData(['online-order', orderNumber], updated);
      qc.invalidateQueries({ queryKey: ['online-orders-admin'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <Header title="Order Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  const meta = STATUS_META[order.status];
  const actions = TRANSITIONS[order.status] ?? [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title={order.orderNumber} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

        {/* Back + Status bar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/online-orders')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1B4F8A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Online Orders
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => resendWhatsApp()}
              disabled={sending}
              title="Re-send WhatsApp notification to customer with current order status"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-green-200 rounded-lg text-green-700 hover:bg-green-50 transition-colors disabled:opacity-60"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#16a34a" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z"/>
              </svg>
              {sending ? 'Sending…' : 'WhatsApp'}
            </button>
            <button
              onClick={() => {
                const addr = order.deliveryAddress as any;
                const addrLine = addr
                  ? `${addr.line1}${addr.line2 ? ', ' + addr.line2 : ''}, ${addr.city} - ${addr.pincode}, ${addr.state}`
                  : 'Store Pickup';
                const html = `<!DOCTYPE html><html><head><title>Order ${order.orderNumber}</title>
                <style>body{font-family:monospace;font-size:13px;padding:16px;max-width:320px;margin:0 auto}h2{text-align:center;font-size:15px;margin:0 0 4px}.center{text-align:center}.line{border-top:1px dashed #999;margin:8px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}.right{text-align:right}.bold{font-weight:bold}.small{font-size:11px}</style>
                </head><body>
                <h2>Srivani Stores</h2><p class="center small">Online Order Slip</p><div class="line"></div>
                <table><tr><td>Order #</td><td class="right bold">${order.orderNumber}</td></tr>
                <tr><td>Customer</td><td class="right">${order.customerName}</td></tr>
                <tr><td>Phone</td><td class="right">${order.customerPhone}</td></tr>
                <tr><td>Payment</td><td class="right">${order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid Online'}</td></tr>
                <tr><td>Delivery</td><td class="right">${order.deliveryType === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}</td></tr></table>
                <div class="line"></div><p class="small"><b>Address:</b> ${addrLine}</p>
                ${order.customerNotes ? `<p class="small"><b>Notes:</b> ${order.customerNotes}</p>` : ''}
                <div class="line"></div>
                <table><tr><td class="bold">Item</td><td class="right bold">Qty</td><td class="right bold">Total</td></tr>
                ${order.items.map((i: any) => `<tr><td>${i.productName}${i.packLabel ? ' (' + i.packLabel + ')' : ''}</td><td class="right">${i.quantity}</td><td class="right">₹${Number(i.total).toFixed(2)}</td></tr>`).join('')}
                </table><div class="line"></div>
                <table><tr><td>Subtotal</td><td class="right">₹${Number(order.subtotal).toFixed(2)}</td></tr>
                <tr><td>Delivery Fee</td><td class="right">${Number(order.deliveryFee) === 0 ? 'FREE' : '₹' + Number(order.deliveryFee).toFixed(2)}</td></tr>
                <tr><td class="bold">TOTAL</td><td class="right bold">₹${Number(order.total).toFixed(2)}</td></tr></table>
                <div class="line"></div><p class="center small">Thank you for shopping with us!</p>
                </body></html>`;
                const w = window.open('', '_blank', 'width=400,height=600');
                if (!w) return;
                w.document.write(html);
                w.document.close();
                w.focus();
                setTimeout(() => { w.print(); w.close(); }, 300);
              }}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-4 h-4" /> Print Slip
            </button>
            <span
              className="text-sm px-3 py-1 rounded-full font-semibold"
              style={{ color: meta.color, background: meta.bg }}
            >
              {meta.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left column: Status + Customer + Notes */}
          <div className="lg:col-span-1 space-y-4">

            {/* Status management */}
            {actions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Update Status
                </h3>
                <div className="flex flex-col gap-2">
                  {actions.map(action => (
                    <button
                      key={action.status}
                      onClick={() => updateStatus(action.status)}
                      disabled={updating}
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${VARIANT_CLASSES[action.variant]}`}
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customer info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                Customer
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Name</span>
                  <p className="font-semibold text-gray-900">{order.customerName}</p>
                </div>
                <div>
                  <span className="text-gray-500">Phone</span>
                  <p className="font-semibold text-gray-900">{order.customerPhone}</p>
                </div>
                {order.customerEmail && (
                  <div>
                    <span className="text-gray-500">Email</span>
                    <p className="font-medium text-gray-700 break-all">{order.customerEmail}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                Delivery
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Type</span>
                  <p className="font-semibold text-gray-900">
                    {order.deliveryType === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup'}
                  </p>
                </div>
                {order.deliveryAddress && (
                  <div>
                    <span className="text-gray-500">Address</span>
                    <p className="font-medium text-gray-700 leading-relaxed">
                      {order.deliveryAddress.line1}
                      {order.deliveryAddress.line2 && <>, {order.deliveryAddress.line2}</>}
                      <br />
                      {order.deliveryAddress.city}, {order.deliveryAddress.pincode}
                      <br />
                      {order.deliveryAddress.state}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                Payment
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Method</span>
                  <span className="font-semibold">{order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Razorpay)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-semibold ${
                    order.paymentStatus === 'PAID' ? 'text-green-700' :
                    order.paymentStatus === 'FAILED' ? 'text-red-600' : 'text-amber-700'
                  }`}>
                    {order.paymentStatus === 'PAID' ? 'Paid' :
                     order.paymentStatus === 'FAILED' ? 'Failed' : 'Pending'}
                  </span>
                </div>
                {order.razorpayPaymentId && (
                  <div>
                    <span className="text-gray-500 block">Payment ID</span>
                    <span className="font-mono text-xs text-gray-700 break-all">{order.razorpayPaymentId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Customer notes */}
            {order.customerNotes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">Customer Notes</h3>
                <p className="text-sm text-amber-700">{order.customerNotes}</p>
              </div>
            )}
          </div>

          {/* Right column: Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">
                  Order Items ({order.items.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {order.items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.productName}</div>
                          {item.packLabel && (
                            <div className="text-xs text-gray-400">{item.packLabel}</div>
                          )}
                          {item.pluBarcode && (
                            <div className="text-xs text-gray-400 font-mono">{item.pluBarcode}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-medium text-gray-700">{item.quantity}</td>
                        <td className="px-3 py-3 text-right text-gray-600">{fmt(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{fmt(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery Fee</span>
                  <span>{toNum(order.deliveryFee) === 0 ? <span className="text-green-600 font-medium">Free</span> : fmt(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total</span>
                  <span>{fmt(order.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
