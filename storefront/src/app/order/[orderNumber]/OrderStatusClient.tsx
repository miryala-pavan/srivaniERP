'use client';

import Link from 'next/link';
import type { OnlineOrder } from '@/lib/orders';

const WA = '919382828484';

const STATUS_LABELS: Record<string, { label: string; color: string; desc: string; icon: string }> = {
  PENDING_PAYMENT: { label: 'Payment Pending', color: '#f59e0b', desc: 'Waiting for payment confirmation.', icon: '⏳' },
  PENDING_COD: { label: 'Order Received', color: '#3b82f6', desc: 'We received your order. Our team will call to confirm.', icon: '📞' },
  CONFIRMED: { label: 'Confirmed', color: '#10b981', desc: 'Your order is confirmed and being prepared.', icon: '✅' },
  PROCESSING: { label: 'Being Packed', color: '#8b5cf6', desc: 'Your order is being packed.', icon: '📦' },
  READY: { label: 'Ready', color: '#10b981', desc: 'Your order is ready! Out for delivery or awaiting pickup.', icon: '🚀' },
  DELIVERED: { label: 'Delivered', color: '#10b981', desc: 'Your order has been delivered. Thank you!', icon: '🎉' },
  CANCELLED: { label: 'Cancelled', color: '#ef4444', desc: 'This order has been cancelled.', icon: '❌' },
  PAYMENT_FAILED: { label: 'Payment Failed', color: '#ef4444', desc: 'Payment was not completed. Please try again.', icon: '⚠️' },
};

function fmt(n: number | string) {
  const v = Number(n);
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderStatusClient({
  order,
  orderNumber,
}: {
  order: OnlineOrder | null;
  orderNumber: string;
}) {
  if (!order) {
    return (
      <div className="wrap">
        <section className="sec" style={{ textAlign: 'center', paddingTop: '80px', paddingBottom: '80px' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔍</div>
          <h1 style={{ fontSize: '22px', marginBottom: '10px' }}>Order Not Found</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: '14px', marginBottom: '28px' }}>
            We couldn't find order <strong>{orderNumber}</strong>.
            Please check the number or contact us.
          </p>
          <a
            href={`https://wa.me/${WA}?text=${encodeURIComponent(`Hi, I'm looking for my order: ${orderNumber}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px',
              background: '#25D366', color: '#fff',
              fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            }}
          >
            Contact Us on WhatsApp
          </a>
        </section>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[order.status] ?? {
    label: order.status,
    color: 'var(--ink-soft)',
    desc: '',
    icon: '📋',
  };

  const isSuccess = ['PENDING_COD', 'CONFIRMED', 'PROCESSING', 'READY', 'DELIVERED'].includes(order.status);

  const waMsg = encodeURIComponent(
    `Hi Srivani Stores, I'd like to inquire about my order ${order.orderNumber}.`,
  );

  return (
    <div className="wrap">
      <section className="sec" style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '40px', paddingBottom: '80px' }}>

        {/* Hero */}
        <div style={{
          textAlign: 'center',
          padding: '36px 24px',
          background: isSuccess ? 'rgba(16,185,129,0.05)' : 'var(--paper-2)',
          border: `2px solid ${isSuccess ? '#6ee7b7' : 'var(--line)'}`,
          borderRadius: '20px',
          marginBottom: '20px',
        }}>
          <div style={{ fontSize: '52px', marginBottom: '10px' }}>{statusInfo.icon}</div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>
            {isSuccess ? 'Order Placed!' : statusInfo.label}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--ink-soft)', marginBottom: '14px' }}>
            {statusInfo.desc}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'var(--paper)',
            border: '1.5px solid var(--line)',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '14px',
          }}>
            <span style={{ color: 'var(--ink-soft)' }}>Order</span>
            <strong style={{ fontFamily: 'monospace', letterSpacing: '0.05em', color: 'var(--ink)' }}>
              {order.orderNumber}
            </strong>
            <span style={{
              background: statusInfo.color,
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              padding: '2px 7px',
            }}>
              {statusInfo.label}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '10px' }}>
            {formatDate(order.createdAt)}
          </p>
        </div>

        {/* Items */}
        <div style={{
          background: 'var(--paper-2)',
          border: '1.5px solid var(--line)',
          borderRadius: '16px',
          overflow: 'hidden',
          marginBottom: '14px',
        }}>
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--line)',
            fontSize: '12px',
            fontWeight: 800,
            color: 'var(--ink-soft)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Items Ordered
          </div>
          {order.items.map((item) => (
            <div key={item.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 18px',
              borderBottom: '1px solid var(--line-2)',
              gap: '10px',
              fontSize: '13px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.productName}</div>
                <div style={{ color: 'var(--ink-soft)', fontSize: '11px' }}>
                  {item.packLabel} × {item.quantity} · ₹{fmt(item.unitPrice)} each
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>
                ₹{fmt(item.total)}
              </div>
            </div>
          ))}
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--ink-soft)' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>₹{fmt(order.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--ink-soft)' }}>
              <span>Delivery</span>
              <span style={{ fontWeight: 600, color: Number(order.deliveryFee) === 0 ? 'var(--leaf)' : 'var(--ink)' }}>
                {Number(order.deliveryFee) === 0 ? 'FREE' : `₹${fmt(order.deliveryFee)}`}
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              borderTop: '1px solid var(--line)', paddingTop: '10px',
              fontSize: '16px', fontWeight: 800,
            }}>
              <span>Total Paid</span>
              <span>₹{fmt(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Delivery & Payment info */}
        <div style={{
          background: 'var(--paper-2)',
          border: '1.5px solid var(--line)',
          borderRadius: '16px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '20px',
          fontSize: '13px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Delivery</span>
            <span style={{ textAlign: 'right', color: 'var(--ink)' }}>
              {order.deliveryType === 'STORE_PICKUP'
                ? 'Store Pickup · Shop No. 12, Main Road, Sangareddy'
                : order.deliveryAddress
                  ? [
                      (order.deliveryAddress as { line1?: string }).line1,
                      (order.deliveryAddress as { line2?: string }).line2,
                      (order.deliveryAddress as { city?: string }).city,
                      (order.deliveryAddress as { pincode?: string }).pincode,
                    ].filter(Boolean).join(', ')
                  : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Payment</span>
            <span style={{ color: 'var(--ink)' }}>
              {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Razorpay)'}
              {' · '}
              <span style={{ color: order.paymentStatus === 'PAID' ? 'var(--leaf)' : order.paymentStatus === 'FAILED' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                {order.paymentStatus === 'PAID' ? 'Paid' : order.paymentStatus === 'FAILED' ? 'Failed' : 'Pending'}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Phone</span>
            <span style={{ color: 'var(--ink)' }}>{order.customerPhone}</span>
          </div>
          {order.customerNotes && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Notes</span>
              <span style={{ color: 'var(--ink)', textAlign: 'right' }}>{order.customerNotes}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href={`https://wa.me/${WA}?text=${waMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Track or inquire about your order on WhatsApp"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '13px 0', borderRadius: '12px',
              border: '1.5px solid #25D366',
              background: 'transparent', color: '#16a34a',
              fontSize: '14px', fontWeight: 700, textDecoration: 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z"/></svg>
            Track Order on WhatsApp
          </a>

          <Link
            href="/products"
            title="Continue shopping at Srivani Stores"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '13px 0', borderRadius: '12px',
              background: 'var(--saffron)', color: '#fff',
              fontSize: '14px', fontWeight: 700, textDecoration: 'none',
            }}
          >
            Continue Shopping
          </Link>
        </div>
      </section>
    </div>
  );
}
