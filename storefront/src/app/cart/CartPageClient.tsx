'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

const WA_NUMBER = '919382828484';

function fmtPrice(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function buildWaUrl(items: ReturnType<typeof useCart>['items']) {
  const lines = items.map(
    (it, i) => `${i + 1}. ${it.name} — ${it.packLabel} x${it.qty} — ₹${fmtPrice(it.sellingPrice * it.qty)}`,
  );
  const total = items.reduce((s, it) => s + it.sellingPrice * it.qty, 0);
  const text = [
    'Hello Srivani Stores, I would like to order:',
    ...lines,
    `Total (est.): ₹${fmtPrice(total)}`,
    'Please confirm and deliver. Thank you.',
  ].join('\n');
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}

export default function CartPageClient() {
  const { items, removeItem, updateQty, clearAll, totalItems, subtotal } = useCart();
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  function goToCheckout() {
    if (!isLoggedIn) {
      router.push('/login?redirect=/checkout');
    } else {
      router.push('/checkout');
    }
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (totalItems === 0) {
    return (
      <div className="wrap">
        <section className="sec" style={{ textAlign: 'center', paddingTop: '80px', paddingBottom: '80px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🛒</div>
          <h1 style={{ fontSize: '26px', marginBottom: '10px' }}>Your cart is empty</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: '15px', marginBottom: '32px' }}>
            Add products to your cart to proceed to checkout.
          </p>
          <Link
            href="/products"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '12px 28px', borderRadius: '12px',
              background: 'var(--saffron)', color: '#fff',
              fontWeight: 700, fontSize: '14px', textDecoration: 'none',
            }}
          >
            Browse Products
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '32px', paddingBottom: '60px' }}>

        {/* Page title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '24px' }}>
            Your Cart
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--ink-soft)', marginLeft: '10px' }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </span>
          </h1>
          <button
            onClick={clearAll}
            style={{ background: 'none', border: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: '13px', fontWeight: 600, padding: '6px 10px', borderRadius: '8px' }}
          >
            Clear cart
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '28px', alignItems: 'start' }}
          className="cart-grid">

          {/* ── Items list ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map(item => (
              <div
                key={item.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px',
                  background: 'var(--paper-2)',
                  borderRadius: '14px',
                  border: '1px solid var(--line)',
                }}
              >
                {/* Image */}
                <Link href={`/product/${item.code.split('-')[0]}`} style={{ flexShrink: 0 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '10px', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} width={64} height={64} style={{ objectFit: 'contain' }} unoptimized />
                    ) : (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    )}
                  </div>
                </Link>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                    {item.packLabel} · ₹{fmtPrice(item.sellingPrice)} each
                  </div>
                </div>

                {/* Qty controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => updateQty(item.code, item.qty - 1)}
                    aria-label={item.qty === 1 ? 'Remove item' : 'Decrease quantity'}
                    style={{ ...qtyBtn, color: item.qty === 1 ? '#ef4444' : 'var(--ink)', borderColor: item.qty === 1 ? '#fecaca' : 'var(--line)' }}
                  >
                    {item.qty === 1
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      : '−'
                    }
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '26px', textAlign: 'center', color: 'var(--ink)' }}>
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateQty(item.code, item.qty + 1)}
                    aria-label="Increase quantity"
                    style={qtyBtn}
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--ink)', flexShrink: 0, minWidth: '64px', textAlign: 'right' }}>
                  ₹{fmtPrice(item.sellingPrice * item.qty)}
                </div>
              </div>
            ))}

            <Link
              href="/products"
              style={{ fontSize: '13px', color: 'var(--saffron)', fontWeight: 600, textDecoration: 'none', marginTop: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              ← Continue shopping
            </Link>
          </div>

          {/* ── Order summary ─────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--paper-2)',
            borderRadius: '16px',
            border: '1px solid var(--line)',
            padding: '22px',
            position: 'sticky',
            top: '90px',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '18px', color: 'var(--ink)' }}>Order Summary</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft)' }}>
                <span>Subtotal ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>₹{fmtPrice(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft)' }}>
                <span>Delivery</span>
                <span style={{ color: 'var(--leaf)', fontWeight: 600 }}>Calculated at checkout</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>Total</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--ink)' }}>₹{fmtPrice(subtotal)}</span>
            </div>

            <button
              onClick={goToCheckout}
              title={isLoggedIn ? 'Proceed to checkout' : 'Sign in to proceed to checkout'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '14px 0',
                borderRadius: '12px', border: 'none',
                background: 'var(--saffron)', color: '#fff',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                marginBottom: '12px',
              }}
            >
              {isLoggedIn ? 'Proceed to Checkout' : 'Sign In to Checkout'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <a
              href={buildWaUrl(items)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                width: '100%', padding: '11px 0',
                borderRadius: '12px', border: '1.5px solid #25D366',
                background: 'transparent', color: '#16a34a',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#16a34a" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z"/></svg>
              Order via WhatsApp
            </a>

            <p style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '14px', textAlign: 'center', lineHeight: 1.5 }}>
              Free delivery on orders above ₹500 · COD available
            </p>
          </div>
        </div>
      </section>

      {/* Responsive cart grid */}
      <style>{`
        @media (max-width: 700px) {
          .cart-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const qtyBtn: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  border: '1.5px solid var(--line)',
  background: '#fff',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--ink)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};
