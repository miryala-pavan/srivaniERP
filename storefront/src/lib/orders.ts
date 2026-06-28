const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

export type DeliveryType = 'HOME_DELIVERY' | 'STORE_PICKUP';
export type PaymentMethod = 'RAZORPAY' | 'COD';

export interface DeliveryAddress {
  line1: string;
  line2?: string;
  city: string;
  pincode: string;
  state?: string;
}

export interface OrderItem {
  pluBarcode: string;
  productCode: string;
  productName: string;
  packLabel: string;
  quantity: number;
  unitPrice: number;
  mrp?: number;
}

export interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: DeliveryType;
  deliveryAddress?: DeliveryAddress;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  customerNotes?: string;
}

export interface CreateOrderResponse {
  orderNumber: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  total: number;
  deliveryFee: number;
  subtotal: number;
  paymentMethod: PaymentMethod;
}

export interface OnlineOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryType: DeliveryType;
  deliveryAddress: DeliveryAddress | null;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  status:
    | 'PENDING_PAYMENT'
    | 'PENDING_COD'
    | 'CONFIRMED'
    | 'PROCESSING'
    | 'READY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'PAYMENT_FAILED';
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerNotes: string | null;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    packLabel: string;
    quantity: number;
    unitPrice: number;
    total: number;
    mrp: number | null;
  }[];
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<CreateOrderResponse> {
  const res = await fetch(`${API}/online-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Failed to create order');
    throw new Error(msg);
  }
  return res.json();
}

export async function verifyRazorpayPayment(data: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<{ success: boolean; orderNumber: string }> {
  const res = await fetch(`${API}/online-orders/verify-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? 'Payment verification failed');
  }
  return res.json();
}

export async function fetchOrder(orderNumber: string): Promise<OnlineOrder | null> {
  try {
    const res = await fetch(`${API}/online-orders/${orderNumber}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function cancelOrder(orderNumber: string, reason?: string): Promise<{ success: boolean; orderNumber: string }> {
  const res = await fetch(`${API}/online-orders/${orderNumber}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Failed to cancel order');
    throw new Error(msg);
  }
  return res.json();
}

export async function confirmDelivery(orderNumber: string): Promise<{ success: boolean; orderNumber: string; alreadyConfirmed?: boolean }> {
  const res = await fetch(`${API}/online-orders/${orderNumber}/confirm-delivery`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Array.isArray((err as any).message) ? (err as any).message.join(', ') : ((err as any).message ?? 'Failed to confirm delivery');
    throw new Error(msg);
  }
  return res.json();
}

export async function fetchMyOrders(phone: string, email?: string): Promise<OnlineOrder[]> {
  try {
    const params = new URLSearchParams();
    params.set('phone', phone);
    if (email) params.set('email', email);
    const res = await fetch(`${API}/online-orders?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
