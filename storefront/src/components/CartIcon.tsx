'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';

export default function CartIcon() {
  const { totalItems } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Cart${totalItems > 0 ? ` — ${totalItems} item${totalItems !== 1 ? 's' : ''}` : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        border: '1.5px solid var(--line)',
        background: totalItems > 0 ? 'var(--saffron)' : 'transparent',
        color: totalItems > 0 ? '#fff' : 'var(--ink)',
        transition: 'all 0.2s',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
      {totalItems > 0 && (
        <span style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
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
          border: '2px solid var(--paper)',
        }}>
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </Link>
  );
}
