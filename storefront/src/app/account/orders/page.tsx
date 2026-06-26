'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';
import { fetchMyOrders, type OnlineOrder } from '@/lib/orders';

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting Payment',
  PENDING_COD:     'Pending Confirmation',
  CONFIRMED:       'Confirmed',
  PROCESSING:      'Processing',
  READY:           'Ready for Pickup',
  DELIVERED:       'Delivered',
  CANCELLED:       'Cancelled',
  PAYMENT_FAILED:  'Payment Failed',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  PENDING_PAYMENT: { bg: 'rgba(234,179,8,0.12)',   text: '#92400e' },
  PENDING_COD:     { bg: 'rgba(59,130,246,0.12)',  text: '#1d4ed8' },
  CONFIRMED:       { bg: 'rgba(34,197,94,0.12)',   text: '#166534' },
  PROCESSING:      { bg: 'rgba(59,130,246,0.12)',  text: '#1d4ed8' },
  READY:           { bg: 'rgba(20,184,166,0.12)',  text: '#0f766e' },
  DELIVERED:       { bg: 'rgba(34,197,94,0.12)',   text: '#166534' },
  CANCELLED:       { bg: 'rgba(239,68,68,0.12)',   text: '#b91c1c' },
  PAYMENT_FAILED:  { bg: 'rgba(239,68,68,0.12)',   text: '#b91c1c' },
};

function fmt(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function OrdersPage() {
  const { user, isLoggedIn, isLoading } = useAuth();
  const { verifiedPhone, phoneReady } = useVerifiedPhone();
  const router = useRouter();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.replace('/login?redirect=/account/orders');
  }, [isLoggedIn, isLoading, router]);

  useEffect(() => {
    if (!phoneReady) return;
    if (!verifiedPhone && !user?.email) { setFetching(false); return; }
    fetchMyOrders(verifiedPhone ?? '', user?.email)
      .then(setOrders)
      .finally(() => setFetching(false));
  }, [verifiedPhone, phoneReady, user]);

  if (isLoading || !phoneReady || fetching) return (
    <div className="wrap">
      <section className="sec" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" strokeWidth="2"
          style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    </div>
  );

  if (!isLoggedIn) return null;

  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '28px', paddingBottom: '80px', maxWidth: '600px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <Link href="/account" title="Back to account"
            style={{ color: 'var(--ink-soft)', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </Link>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>My Orders</h1>
        </div>

        {/* No phone verified */}
        {!verifiedPhone && (
          <div style={{
            padding: '32px 24px', textAlign: 'center',
            background: 'var(--paper-2)', border: '1.5px solid var(--line)',
            borderRadius: '16px',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📱</div>
            <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Verify your mobile number</p>
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '20px' }}>
              Your orders are linked to your verified phone number.
            </p>
            <Link href="/verify-phone?redirect=/account/orders" style={{
              display: 'inline-block', padding: '10px 24px',
              background: 'var(--saffron)', color: '#fff',
              borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            }}>
              Verify Phone
            </Link>
          </div>
        )}

        {/* Empty orders */}
        {verifiedPhone && orders.length === 0 && (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            background: 'var(--paper-2)', border: '1.5px solid var(--line)',
            borderRadius: '16px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</div>
            <p style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>No orders yet</p>
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '24px' }}>
              Your order history will appear here.
            </p>
            <Link href="/products" style={{
              display: 'inline-block', padding: '10px 24px',
              background: 'var(--saffron)', color: '#fff',
              borderRadius: '10px', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            }}>
              Start Shopping
            </Link>
          </div>
        )}

        {/* Orders list */}
        {orders.map((order) => {
          const color = STATUS_COLOR[order.status] ?? STATUS_COLOR.CONFIRMED;
          return (
            <Link
              key={order.id}
              href={`/order/${order.orderNumber}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: 'var(--paper-2)',
                border: '1.5px solid var(--line)',
                borderRadius: '16px',
                padding: '18px 20px',
                marginBottom: '12px',
                cursor: 'pointer',
              }}>
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ink)', marginBottom: '3px' }}>
                      {order.orderNumber}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{fmtDate(order.createdAt)}</div>
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 700,
                    padding: '4px 10px', borderRadius: '20px',
                    background: color.bg, color: color.text,
                    whiteSpace: 'nowrap',
                  }}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>

                {/* Items preview */}
                <div style={{ fontSize: '13px', color: 'var(--ink-soft)', marginBottom: '10px', lineHeight: 1.5 }}>
                  {order.items.slice(0, 2).map(it =>
                    `${it.productName} × ${it.quantity}`
                  ).join(' · ')}
                  {order.items.length > 2 && ` + ${order.items.length - 2} more`}
                </div>

                {/* Bottom row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                    {order.deliveryType === 'STORE_PICKUP' ? 'Store Pickup' : 'Home Delivery'}
                    {' · '}
                    {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid Online'}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                    ₹{fmt(order.total)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </section>
    </div>
  );
}
