'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, X, Volume2, VolumeX } from 'lucide-react';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import { useQueryClient } from '@tanstack/react-query';

interface OrderAlert {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paymentMethod: string;
  deliveryType: string;
  itemCount: number;
  at: number;
}

function beep(ctx: AudioContext) {
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
}

export default function OnlineOrderAlert() {
  const router      = useRouter();
  const qc          = useQueryClient();
  const [alerts, setAlerts]   = useState<OrderAlert[]>([]);
  const [muted, setMuted]     = useState(false);
  const audioRef    = useRef<AudioContext | null>(null);

  function getCtx() {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioRef.current;
  }

  const handleNewOrder = useCallback((payload: Omit<OrderAlert, 'id' | 'at'>) => {
    const alert: OrderAlert = { ...payload, id: Math.random().toString(36).slice(2), at: Date.now() };
    setAlerts(prev => [alert, ...prev].slice(0, 5)); // max 5 stacked
    qc.invalidateQueries({ queryKey: ['online-orders-admin'] });
    if (!muted) {
      try {
        const ctx = getCtx();
        // Three quick beeps
        [0, 0.5, 1.0].forEach(delay => setTimeout(() => beep(ctx), delay * 500));
      } catch {}
    }
  }, [muted, qc]);

  useWebSocketEvent('online.order.placed', handleNewOrder);

  // Also invalidate when status changes
  useWebSocketEvent('online.order.status_changed', () => {
    qc.invalidateQueries({ queryKey: ['online-orders-admin'] });
  });

  function dismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  function dismissAll() {
    setAlerts([]);
  }

  if (alerts.length === 0) return null;

  return (
    <div style={{
      position:  'fixed',
      bottom:    '24px',
      right:     '24px',
      zIndex:    9999,
      display:   'flex',
      flexDirection: 'column',
      gap:       '10px',
      maxWidth:  '360px',
      width:     'calc(100vw - 48px)',
    }}>
      {/* Controls row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          onClick={() => setMuted(m => !m)}
          style={{
            background: 'rgba(0,0,0,0.6)',
            border: 'none',
            borderRadius: '8px',
            padding: '4px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#fff',
            fontSize: '11px',
          }}
        >
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          {muted ? 'Unmute' : 'Mute'}
        </button>
        {alerts.length > 1 && (
          <button
            onClick={dismissAll}
            style={{
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 10px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '11px',
            }}
          >
            Dismiss all
          </button>
        )}
      </div>

      {/* Alert cards */}
      {alerts.map(alert => (
        <div key={alert.id} style={{
          background:   '#1B4F8A',
          borderRadius: '14px',
          padding:      '14px 16px',
          boxShadow:    '0 8px 32px rgba(0,0,0,0.25)',
          color:        '#fff',
          animation:    'slideUp 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{
              background:   'rgba(255,255,255,0.15)',
              borderRadius: '10px',
              padding:      '8px',
              flexShrink:   0,
            }}>
              <ShoppingBag size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', opacity: 0.75, textTransform: 'uppercase', marginBottom: '2px' }}>
                🛒 New Online Order
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>{alert.orderNumber}</div>
              <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px' }}>
                {alert.customerName} · {alert.customerPhone}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  ₹{alert.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', borderRadius: '6px', padding: '1px 7px', alignSelf: 'center' }}>
                  {alert.paymentMethod === 'COD' ? 'COD' : 'Paid Online'}
                </span>
                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', borderRadius: '6px', padding: '1px 7px', alignSelf: 'center' }}>
                  {alert.deliveryType === 'HOME_DELIVERY' ? '🏠 Delivery' : '🏪 Pickup'}
                </span>
              </div>
            </div>
            <button
              onClick={() => dismiss(alert.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '2px', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>
          <button
            onClick={() => { router.push(`/dashboard/online-orders/${alert.orderNumber}`); dismiss(alert.id); }}
            style={{
              marginTop:    '10px',
              width:        '100%',
              background:   'rgba(255,255,255,0.18)',
              border:       '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding:      '7px',
              color:        '#fff',
              fontWeight:   600,
              fontSize:     '13px',
              cursor:       'pointer',
            }}
          >
            View Order →
          </button>
        </div>
      ))}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
