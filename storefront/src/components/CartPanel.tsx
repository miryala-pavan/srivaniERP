'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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

export default function CartPanel() {
  const { items, removeItem, updateQty, clearAll, totalItems, subtotal } = useCart();
  const { isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function goToCheckout() {
    setOpen(false);
    if (!isLoggedIn) {
      router.push('/login?redirect=/checkout');
    } else {
      router.push('/checkout');
    }
  }

  useEffect(() => {
    if (!open) return;
    function handle(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handle);
    return () => document.removeEventListener('pointerdown', handle);
  }, [open]);

  // Close panel on route change
  useEffect(() => { setOpen(false); }, []);

  if (totalItems === 0) return null;

  return (
    <>
      {/* FAB — saffron cart */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`Open cart (${totalItems} item${totalItems !== 1 ? 's' : ''})`}
        style={{
          position: 'fixed',
          bottom: '76px',
          right: '16px',
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'var(--saffron)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(217,131,36,0.45)',
          zIndex: 9000,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span style={{
          position: 'absolute',
          top: '2px',
          right: '2px',
          background: 'var(--saffron-deep)',
          color: '#fff',
          fontSize: '10px',
          fontWeight: 800,
          borderRadius: '999px',
          minWidth: '18px',
          height: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          lineHeight: 1,
        }}>
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9500,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          background: 'rgba(44,27,16,0.3)',
        }}>
          <div
            ref={panelRef}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--paper)',
              borderRadius: '18px 18px 0 0',
              boxShadow: '0 -8px 40px rgba(44,27,16,0.18)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '82vh',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px 12px',
              borderBottom: '1px solid var(--line)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="var(--saffron)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
                  Cart · {totalItems} item{totalItems !== 1 ? 's' : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  onClick={clearAll}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: '12px', padding: '2px 6px' }}
                >
                  Clear all
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close cart"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: '22px', lineHeight: 1, padding: '0 4px' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Items */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
              {items.map(item => (
                <div key={item.code} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 18px',
                  borderBottom: '1px solid var(--line-2)',
                }}>
                  <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" width={44} height={44} style={{ objectFit: 'contain' }} unoptimized />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>
                      {item.packLabel} · ₹{fmtPrice(item.sellingPrice)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => updateQty(item.code, item.qty - 1)}
                      aria-label={item.qty === 1 ? 'Remove item' : 'Decrease quantity'}
                      style={{
                        ...qtyBtn,
                        color: item.qty === 1 ? '#ef4444' : 'var(--ink)',
                        borderColor: item.qty === 1 ? '#fecaca' : 'var(--line)',
                      }}
                    >
                      {item.qty === 1
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        : '−'
                      }
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '22px', textAlign: 'center', color: 'var(--ink)' }}>
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

                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)', flexShrink: 0, minWidth: '52px', textAlign: 'right' }}>
                    ₹{fmtPrice(item.sellingPrice * item.qty)}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 18px 20px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>Subtotal</span>
                <span style={{ fontSize: '19px', fontWeight: 800, color: 'var(--ink)' }}>₹{fmtPrice(subtotal)}</span>
              </div>

              <button
                onClick={goToCheckout}
                title={isLoggedIn ? 'Proceed to checkout' : 'Sign in to proceed to checkout'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '13px 0',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--saffron)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: '10px',
                }}
              >
                {isLoggedIn ? 'Proceed to Checkout' : 'Sign In to Checkout'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  href="/cart"
                  onClick={() => setOpen(false)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: '10px', border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-soft)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  View Cart
                </Link>
                <a
                  href={buildWaUrl(items)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, padding: '9px 0', borderRadius: '10px', border: '1.5px solid #25D366', background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#16a34a" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z"/></svg>
                  Via WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const qtyBtn: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '7px',
  border: '1.5px solid var(--line)',
  background: 'var(--paper-2)',
  cursor: 'pointer',
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--ink)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};
