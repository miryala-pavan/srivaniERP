'use client';

import { useCart } from '@/context/CartContext';

interface Props {
  code: string;
  name: string;
  packLabel: string;
  sellingPrice: number;
  imageUrl?: string | null;
  disabled?: boolean;
}

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

export default function AddToListButton({
  code, name, packLabel, sellingPrice, imageUrl, disabled,
}: Props) {
  const { has, addItem, updateQty, items } = useCart();
  const inCart = has(code);
  const qty = items.find(i => i.code === code)?.qty ?? 0;

  if (disabled) {
    return (
      <button
        disabled
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '6px 12px', borderRadius: '8px',
          border: '1.5px solid var(--line)',
          background: 'var(--paper-2)',
          color: '#d1d5db',
          fontSize: '12px', fontWeight: 700,
          cursor: 'not-allowed', whiteSpace: 'nowrap',
        }}
      >
        Out of Stock
      </button>
    );
  }

  if (!inCart) {
    return (
      <button
        type="button"
        onClick={() => addItem({ code, name, packLabel, sellingPrice, imageUrl })}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '6px 12px', borderRadius: '8px',
          border: '1.5px solid var(--saffron)',
          background: 'transparent',
          color: 'var(--saffron)',
          fontSize: '12px', fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        + Cart
      </button>
    );
  }

  // In cart → inline stepper
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      border: '1.5px solid var(--saffron)',
      borderRadius: '8px',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      <button
        type="button"
        onClick={() => updateQty(code, qty - 1)}
        aria-label={qty === 1 ? 'Remove from cart' : 'Decrease quantity'}
        style={{
          width: '30px', height: '30px',
          background: qty === 1 ? 'rgba(239,68,68,0.08)' : 'var(--saffron)',
          border: 'none',
          color: qty === 1 ? '#ef4444' : '#fff',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 700, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {qty === 1 ? <TrashIcon /> : '−'}
      </button>

      <span style={{
        minWidth: '28px', textAlign: 'center',
        fontSize: '13px', fontWeight: 800,
        color: 'var(--saffron)',
        padding: '0 4px',
        userSelect: 'none',
      }}>
        {qty}
      </span>

      <button
        type="button"
        onClick={() => updateQty(code, qty + 1)}
        aria-label="Increase quantity"
        style={{
          width: '30px', height: '30px',
          background: 'var(--saffron)',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 700, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        +
      </button>
    </div>
  );
}
