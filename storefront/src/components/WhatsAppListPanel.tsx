'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useWhatsAppList } from '@/context/WhatsAppListContext';

const WA_NUMBER = '919382828484';

function fmtPrice(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function buildWaUrl(items: ReturnType<typeof useWhatsAppList>['items']) {
  const lines = items.map(
    (it, i) =>
      `${i + 1}. ${it.name} (Code: ${it.code}) x${it.qty} — ₹${fmtPrice(it.sellingPrice * it.qty)}`,
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

export default function WhatsAppListPanel() {
  const { items, removeItem, updateQty, clearAll } = useWhatsAppList();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const count = items.length;
  const total = items.reduce((s, it) => s + it.sellingPrice * it.qty, 0);

  // Close on outside click
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

  function sendViaWhatsApp() {
    window.open(buildWaUrl(items), '_blank', 'noopener');
    clearAll();
    setOpen(false);
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }

  if (count === 0 && !toast) return null;

  return (
    <>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#16a34a',
          color: '#fff',
          padding: '10px 22px',
          borderRadius: '999px',
          fontSize: '13px',
          fontWeight: 600,
          zIndex: 10000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}>
          Order sent via WhatsApp ✓
        </div>
      )}

      {/* FAB */}
      {count > 0 && (
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={`Open order list (${count} items)`}
          style={{
            position: 'fixed',
            bottom: '76px',
            right: '16px',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: '#25D366',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
            zIndex: 9000,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z" />
          </svg>
          {/* Badge */}
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: '#ef4444',
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
            {count}
          </span>
        </button>
      )}

      {/* Panel */}
      {open && count > 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9500,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <div
            ref={panelRef}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#fff',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px 12px',
              borderBottom: '1px solid #f3f4f6',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                📋 Your Order List ({count} item{count !== 1 ? 's' : ''})
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '20px', lineHeight: 1, padding: '2px' }}>×</button>
            </div>

            {/* Items */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              {items.map(item => (
                <div key={item.code} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 18px',
                  borderBottom: '1px solid #f9fafb',
                }}>
                  {/* Thumbnail */}
                  <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" width={44} height={44} style={{ objectFit: 'contain' }} unoptimized />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    )}
                  </div>

                  {/* Name + pack */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{item.packLabel} · ₹{fmtPrice(item.sellingPrice)}</div>
                  </div>

                  {/* Qty controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => updateQty(item.code, item.qty - 1)} style={qtyBtnStyle}>−</button>
                    <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '22px', textAlign: 'center' }}>{item.qty}</span>
                    <button onClick={() => updateQty(item.code, item.qty + 1)} style={qtyBtnStyle}>+</button>
                    <button onClick={() => removeItem(item.code)} style={{ ...qtyBtnStyle, color: '#ef4444', marginLeft: '4px' }} aria-label="Remove">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>Est. Total</span>
                <span style={{ fontSize: '17px', fontWeight: 800, color: '#111827' }}>₹{fmtPrice(total)}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={clearAll}
                  style={{
                    flex: 1,
                    padding: '11px 0',
                    borderRadius: '10px',
                    border: '1.5px solid #e5e7eb',
                    background: '#fff',
                    color: '#6b7280',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
                <button
                  onClick={sendViaWhatsApp}
                  style={{
                    flex: 2,
                    padding: '11px 0',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#25D366',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z" />
                  </svg>
                  Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const qtyBtnStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  borderRadius: '6px',
  border: '1.5px solid #e5e7eb',
  background: '#f9fafb',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  color: '#374151',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};
