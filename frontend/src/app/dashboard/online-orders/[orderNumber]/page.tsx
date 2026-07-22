'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Package, User, MapPin, CreditCard,
  CheckCircle2, XCircle, Truck, RefreshCw, Clock, Printer,
  Plus, Minus, Trash2, Search, Phone, Wallet, History,
  Pencil, MessageSquare,
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
  quantity: number;
  unitPrice: Decimal;
  total: Decimal;
  mrp: Decimal | null;
  aisle: string | null;
  rackNumber: string | null;
  binCode: string | null;
  category: string | null;
}

interface StaffUser {
  id: string;
  fullName: string;
  status: string;
}

interface OrderEvent {
  id: string;
  type: string;
  description: string;
  userName: string | null;
  createdAt: string;
}

interface Settlement {
  amountPaid: number;
  walletCredited: number;
  dueAmount: number;
  isEditable: boolean;
}

interface PackResult {
  pluBarcode: string;
  productName: string;
  packLabel: string;
  price: number;
  mrp: number | null;
  stockOnHand: number;
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
  deliverySlot: string | null;
  assignedToName: string | null;
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
  events: OrderEvent[];
  settlement: Settlement;
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

const EVENT_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  STATUS_CHANGE: { icon: <RefreshCw className="w-3 h-3" />,   color: 'bg-blue-50 text-blue-600' },
  ITEM_ADDED:    { icon: <Plus className="w-3 h-3" />,        color: 'bg-green-50 text-green-600' },
  ITEM_UPDATED:  { icon: <Pencil className="w-3 h-3" />,      color: 'bg-amber-50 text-amber-600' },
  ITEM_REMOVED:  { icon: <Trash2 className="w-3 h-3" />,      color: 'bg-red-50 text-red-600' },
  WALLET_CREDIT: { icon: <Wallet className="w-3 h-3" />,      color: 'bg-purple-50 text-purple-600' },
  ASSIGNED:      { icon: <User className="w-3 h-3" />,        color: 'bg-blue-50 text-blue-600' },
  SLOT_CHANGED:  { icon: <Clock className="w-3 h-3" />,       color: 'bg-blue-50 text-blue-600' },
  NOTE:          { icon: <MessageSquare className="w-3 h-3" />, color: 'bg-gray-100 text-gray-500' },
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

/**
 * Picking list: items sorted by shelf location (bin code → aisle+rack →
 * category → name) so the packer walks the store in one pass, with a
 * tick-box per line.
 */
function printPickingList(order: OnlineOrder) {
  const locKey = (i: OnlineOrderItem) =>
    i.binCode ?? [i.aisle, i.rackNumber].filter(Boolean).join('-') ?? '';
  const sorted = [...order.items].sort((a, b) => {
    const la = locKey(a), lb = locKey(b);
    if (la && lb && la !== lb) return la.localeCompare(lb, undefined, { numeric: true });
    if (la && !lb) return -1;
    if (!la && lb) return 1;
    const ca = a.category ?? '', cb = b.category ?? '';
    if (ca !== cb) return ca.localeCompare(cb);
    return a.productName.localeCompare(b.productName);
  });
  const html = `<!DOCTYPE html><html><head><title>Picking List ${order.orderNumber}</title>
  <style>
    body{font-family:monospace;font-size:13px;padding:16px;max-width:360px;margin:0 auto}
    h2{text-align:center;font-size:15px;margin:0 0 4px}
    .center{text-align:center}.line{border-top:1px dashed #999;margin:8px 0}
    table{width:100%;border-collapse:collapse}td,th{padding:4px 2px;text-align:left;vertical-align:top}
    .right{text-align:right}.bold{font-weight:bold}.small{font-size:11px}
    .box{display:inline-block;width:14px;height:14px;border:1.5px solid #333;vertical-align:middle}
    .loc{font-size:11px;color:#555}
  </style></head><body>
  <h2>PICKING LIST</h2>
  <p class="center small">Order ${order.orderNumber} · ${order.customerName}</p>
  <p class="center small">${order.deliveryType === 'HOME_DELIVERY' ? 'HOME DELIVERY' : 'STORE PICKUP'}${order.deliverySlot ? ' · ' + order.deliverySlot : ''}${order.assignedToName ? ' · Packer: ' + order.assignedToName : ''}</p>
  <div class="line"></div>
  <table>
    <tr><th></th><th>Item</th><th class="right">Qty</th></tr>
    ${sorted.map(i => `<tr>
      <td><span class="box"></span></td>
      <td>${i.productName}${i.packLabel ? ' (' + i.packLabel + ')' : ''}
        ${locKey(i) ? `<br><span class="loc">📍 ${locKey(i)}</span>` : i.category ? `<br><span class="loc">${i.category}</span>` : ''}
      </td>
      <td class="right bold">${i.quantity}</td>
    </tr>`).join('')}
  </table>
  <div class="line"></div>
  <p class="small">${order.items.length} line(s) · ${order.items.reduce((s, i) => s + i.quantity, 0)} unit(s)</p>
  ${order.customerNotes ? `<p class="small"><b>Notes:</b> ${order.customerNotes}</p>` : ''}
  </body></html>`;
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 300);
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
    queryKey: ['online-order-admin', orderNumber],
    queryFn: async () => {
      const { data } = await api.get(`/online-orders/admin/${orderNumber}`);
      return data;
    },
  });

  useEffect(() => {
    if (isError) {
      toast.error('Order not found');
      router.push('/dashboard/online-orders');
    }
  }, [isError, router]);

  // ── Item editing state ──────────────────────────────────────────────────
  const [showAddItem, setShowAddItem]   = useState(false);
  const [packSearch, setPackSearch]     = useState('');
  const [selectedPack, setSelectedPack] = useState<PackResult | null>(null);
  const [addQty, setAddQty]             = useState(1);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: packResults = [] } = useQuery<PackResult[]>({
    queryKey: ['order-pack-search', packSearch],
    queryFn: () => api.get('/online-orders/admin/search-packs', { params: { q: packSearch } }).then(r => r.data),
    enabled: showAddItem && packSearch.trim().length >= 2 && !selectedPack,
    staleTime: 10_000,
  });

  function onEditSuccess(updated: OnlineOrder, action: string) {
    const prevCredited = order?.settlement.walletCredited ?? 0;
    const newCredit = updated.settlement.walletCredited - prevCredited;
    qc.setQueryData(['online-order-admin', orderNumber], updated);
    qc.invalidateQueries({ queryKey: ['online-orders-admin'] });
    if (newCredit > 0.009) {
      toast.success(`${action} — ₹${newCredit.toFixed(0)} credited to customer's wallet`, { duration: 5000 });
    } else {
      toast.success(action);
    }
  }

  function editError(e: any) {
    toast.error(e?.response?.data?.message ?? 'Edit failed');
  }

  const addItem = useMutation({
    mutationFn: () => api.post(`/online-orders/admin/${orderNumber}/items`, {
      pluBarcode: selectedPack!.pluBarcode,
      quantity: addQty,
    }).then(r => r.data),
    onSuccess: (updated: OnlineOrder) => {
      onEditSuccess(updated, `Added ${selectedPack?.productName}`);
      setShowAddItem(false);
      setSelectedPack(null);
      setPackSearch('');
      setAddQty(1);
    },
    onError: editError,
  });

  const updateQty = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.patch(`/online-orders/admin/${orderNumber}/items/${itemId}`, { quantity }).then(r => r.data),
    onSuccess: (updated: OnlineOrder) => onEditSuccess(updated, 'Quantity updated'),
    onError: editError,
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      api.delete(`/online-orders/admin/${orderNumber}/items/${itemId}`).then(r => r.data),
    onSuccess: (updated: OnlineOrder) => onEditSuccess(updated, 'Item removed'),
    onError: editError,
  });

  function handleRemoveClick(itemId: string) {
    if (confirmRemoveId === itemId) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmRemoveId(null);
      removeItem.mutate(itemId);
    } else {
      setConfirmRemoveId(itemId);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmRemoveId(null), 3000);
    }
  }

  // ── Assign staff + delivery slot ────────────────────────────────────────
  const [editingSlot, setEditingSlot] = useState(false);
  const [slotDraft, setSlotDraft]     = useState('');

  const { data: staff = [] } = useQuery<StaffUser[]>({
    queryKey: ['users-for-assign'],
    queryFn: () => api.get('/users').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const updateMeta = useMutation({
    mutationFn: (body: { assignedToName?: string | null; deliverySlot?: string | null }) =>
      api.patch(`/online-orders/admin/${orderNumber}/meta`, body).then(r => r.data),
    onSuccess: (updated: OnlineOrder) => {
      qc.setQueryData(['online-order-admin', orderNumber], updated);
      qc.invalidateQueries({ queryKey: ['online-orders-admin'] });
      setEditingSlot(false);
      toast.success('Order updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

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
    onSuccess: (updated: { status: OrderStatus }) => {
      toast.success(`Order marked as ${STATUS_META[updated.status].label}`);
      qc.invalidateQueries({ queryKey: ['online-order-admin', orderNumber] });
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
  const editable = order.settlement.isEditable;
  const editBusy = addItem.isPending || updateQty.isPending || removeItem.isPending;

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
                <tr><td class="bold">TOTAL</td><td class="right bold">₹${Number(order.total).toFixed(2)}</td></tr>
                ${order.settlement.dueAmount > 0 && order.paymentStatus === 'PAID' ? `<tr><td class="bold">COLLECT</td><td class="right bold">₹${order.settlement.dueAmount.toFixed(2)}</td></tr>` : ''}
                </table>
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
            <button
              onClick={() => printPickingList(order)}
              title="Print a pick-and-pack checklist sorted by shelf location"
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Package className="w-4 h-4" /> Picking List
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

          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">

            {/* Status management */}
            {actions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
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
                <div className="flex gap-2 pt-1">
                  <a
                    href={`tel:${order.customerPhone}`}
                    title="Call the customer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                  <button
                    onClick={() => router.push(`/dashboard/notifications/whatsapp?phone=${order.customerPhone}`)}
                    title="Open this customer's chat in PaVa Connect"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-green-200 rounded-lg text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
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
                <div>
                  <span className="text-gray-500 flex items-center gap-1">
                    Slot
                    {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && !editingSlot && (
                      <button
                        onClick={() => { setSlotDraft(order.deliverySlot ?? ''); setEditingSlot(true); }}
                        title="Reschedule the delivery slot — customer asked for a different time"
                        className="p-0.5 text-gray-300 hover:text-[#1B4F8A] transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                  {editingSlot ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        autoFocus
                        value={slotDraft}
                        onChange={e => setSlotDraft(e.target.value)}
                        placeholder="e.g. Today · Evening (4 PM - 8 PM)"
                        className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                      />
                      <button
                        onClick={() => updateMeta.mutate({ deliverySlot: slotDraft })}
                        disabled={updateMeta.isPending}
                        className="px-2 py-1 text-xs font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6f] disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingSlot(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-medium text-gray-700">{order.deliverySlot ?? '—'}</p>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">Assigned to</span>
                  {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? (
                    <select
                      value={order.assignedToName ?? ''}
                      onChange={e => updateMeta.mutate({ assignedToName: e.target.value || null })}
                      disabled={updateMeta.isPending}
                      title="Who is packing / delivering this order — shows on the picking list"
                      className="w-full mt-0.5 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A] bg-white disabled:opacity-60"
                    >
                      <option value="">Unassigned</option>
                      {staff.filter(u => u.status === 'ACTIVE').map(u => (
                        <option key={u.id} value={u.fullName}>{u.fullName}</option>
                      ))}
                      {order.assignedToName && !staff.some(u => u.fullName === order.assignedToName) && (
                        <option value={order.assignedToName}>{order.assignedToName}</option>
                      )}
                    </select>
                  ) : (
                    <p className="font-medium text-gray-700">{order.assignedToName ?? '—'}</p>
                  )}
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

            {/* Payment + settlement */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
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
                {order.paymentStatus === 'PAID' && (
                  <div className="flex justify-between" title="Amount actually collected from the customer when they paid">
                    <span className="text-gray-500">Amount paid</span>
                    <span className="font-semibold text-gray-900">{fmt(order.settlement.amountPaid)}</span>
                  </div>
                )}
                {order.settlement.walletCredited > 0 && (
                  <div className="flex justify-between" title="Refunded to the customer's store wallet after order edits reduced the total">
                    <span className="text-gray-500 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Wallet credited</span>
                    <span className="font-semibold text-purple-700">{fmt(order.settlement.walletCredited)}</span>
                  </div>
                )}
                {order.settlement.dueAmount > 0 && (order.paymentStatus === 'PAID' || order.paymentMethod === 'COD') && (
                  <div
                    className="flex justify-between items-center mt-1 px-2.5 py-1.5 bg-amber-50 border border-amber-100 rounded-lg"
                    title="Amount still to be collected from the customer at delivery/pickup"
                  >
                    <span className="text-amber-800 font-medium text-xs">Collect at delivery</span>
                    <span className="font-bold text-amber-800">{fmt(order.settlement.dueAmount)}</span>
                  </div>
                )}
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
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-amber-800 mb-1">Customer Notes</h3>
                <p className="text-sm text-amber-700">{order.customerNotes}</p>
              </div>
            )}

            {/* Timeline */}
            {order.events.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-400" />
                  History
                </h3>
                <div className="space-y-3">
                  {[...order.events].reverse().map(ev => {
                    const evMeta = EVENT_ICONS[ev.type] ?? EVENT_ICONS.NOTE;
                    return (
                      <div key={ev.id} className="flex gap-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${evMeta.color}`}>
                          {evMeta.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-700 leading-snug">{ev.description}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {fmtDate(ev.createdAt)}{ev.userName ? ` · ${ev.userName}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">
                  Order Items ({order.items.length})
                </h3>
                {editable && (
                  <button
                    onClick={() => { setShowAddItem(v => !v); setSelectedPack(null); setPackSearch(''); }}
                    className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#1B4F8A] bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
                    title="Add another product to this order — customer asked for something extra"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                )}
              </div>

              {/* Add item row */}
              {showAddItem && editable && (
                <div className="px-4 py-3 bg-blue-50/40 border-b border-blue-100 space-y-2">
                  {selectedPack ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{selectedPack.productName} <span className="text-gray-400">({selectedPack.packLabel})</span></p>
                        <p className="text-xs text-gray-500">₹{selectedPack.price.toFixed(2)} · Stock: {selectedPack.stockOnHand}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <button onClick={() => setAddQty(q => Math.max(1, q - 1))} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg bg-white hover:bg-gray-50"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-8 text-center text-sm font-semibold">{addQty}</span>
                        <button onClick={() => setAddQty(q => q + 1)} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg bg-white hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <button
                        onClick={() => addItem.mutate()}
                        disabled={addItem.isPending}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6f] disabled:opacity-50 transition-colors"
                      >
                        {addItem.isPending ? 'Adding…' : `Add ₹${(selectedPack.price * addQty).toFixed(0)}`}
                      </button>
                      <button onClick={() => { setSelectedPack(null); setPackSearch(''); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><XCircle className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        autoFocus
                        value={packSearch}
                        onChange={e => setPackSearch(e.target.value)}
                        placeholder="Search product name, code, or scan barcode…"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#1B4F8A]"
                      />
                      {packResults.length > 0 && (
                        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                          {packResults.map(p => (
                            <button
                              key={p.pluBarcode}
                              onClick={() => setSelectedPack(p)}
                              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{p.productName} <span className="text-gray-400">({p.packLabel})</span></p>
                                <p className="text-xs text-gray-400">Stock: {p.stockOnHand}</p>
                              </div>
                              <span className="text-sm font-semibold text-gray-700 shrink-0">₹{p.price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500">
                    Prices are today&apos;s online prices. Existing items keep the price agreed when the order was placed.
                    {order.paymentStatus === 'PAID' && ' If the total goes above what was paid, the difference shows as "Collect at delivery".'}
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      {editable && <th className="px-3 py-2.5" />}
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
                        <td className="px-3 py-3 text-center">
                          {editable ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => item.quantity > 1 && updateQty.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                                disabled={editBusy || item.quantity <= 1}
                                title={item.quantity <= 1 ? 'Use the remove button to take this item off the order' : 'Reduce quantity by 1'}
                                className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-40 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-semibold text-gray-800 tabular-nums">{item.quantity}</span>
                              <button
                                onClick={() => updateQty.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                                disabled={editBusy}
                                title="Increase quantity by 1 (stock is checked automatically)"
                                className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-40 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-medium text-gray-700">{item.quantity}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">{fmt(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(item.total)}</td>
                        {editable && (
                          <td className="px-3 py-3 text-right">
                            <button
                              onClick={() => handleRemoveClick(item.id)}
                              disabled={editBusy || order.items.length <= 1}
                              title={order.items.length <= 1 ? 'The last item cannot be removed — cancel the order instead' : 'Remove this item from the order (stock is returned automatically)'}
                              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-40 ${
                                confirmRemoveId === item.id
                                  ? 'bg-red-600 text-white'
                                  : 'text-red-500 hover:bg-red-50'
                              }`}
                            >
                              {confirmRemoveId === item.id ? 'Confirm?' : <Trash2 className="w-4 h-4" />}
                            </button>
                          </td>
                        )}
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
                {order.settlement.walletCredited > 0 && (
                  <div className="flex justify-between text-xs text-purple-700">
                    <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Credited to customer&apos;s wallet</span>
                    <span className="font-semibold">{fmt(order.settlement.walletCredited)}</span>
                  </div>
                )}
                {order.settlement.dueAmount > 0 && order.paymentStatus === 'PAID' && (
                  <div className="flex justify-between text-xs text-amber-700">
                    <span>To collect at delivery</span>
                    <span className="font-semibold">{fmt(order.settlement.dueAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            {!editable && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
              <p className="text-xs text-gray-400 mt-2 px-1">
                Items can be edited once the order is confirmed (and until it is delivered).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
