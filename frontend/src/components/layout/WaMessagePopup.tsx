'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import api from '@/lib/api';

interface MessageAlert {
  id: string;
  phone: string | null; // null for a reminder covering multiple conversations
  bodyPreview: string | null;
  messageType: string | null;
  isReminder: boolean;
}

const AUTO_DISMISS_MS = 12000;
const REMINDER_INTERVAL_MS = 5 * 60 * 1000;

// A large, hard-to-miss in-app alert for every inbound WhatsApp message —
// deliberately bigger and more central than OnlineOrderAlert's quiet corner
// card, since a staff member glancing at any dashboard page should notice
// this without having to look for it. Complements (doesn't replace)
// WaSoundAlert's beep and the native OS push notification sw.js shows when
// the tab isn't focused — sw.js's own push handler explicitly skips the OS
// notification while a tab is visible, expecting an in-app alert like this
// one to cover that case.
//
// The initial popup auto-dismisses after a few seconds (easy to miss if
// staff step away), but that alone isn't enough — it should keep nagging
// until someone actually reads the message, not just until the toast times
// out. So it also polls the real "unread" state (WaMessage.readByStaffAt,
// already tracked server-side for the inbox badge count) every 5 minutes
// and re-surfaces a reminder for as long as any inbound message is still
// unread — which naturally stops the moment staff actually open that
// conversation in PaVa Connect (the thing that sets readByStaffAt), not
// just because a toast happened to time out unseen.
export default function WaMessagePopup() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<MessageAlert[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function dismiss(id: string) {
    const t = timersRef.current.get(id);
    if (t) { clearTimeout(t); timersRef.current.delete(id); }
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  function pushAlert(alert: MessageAlert) {
    setAlerts(prev => [alert, ...prev].slice(0, 3)); // max 3 stacked
    const t = setTimeout(() => dismiss(alert.id), AUTO_DISMISS_MS);
    timersRef.current.set(alert.id, t);
  }

  const handleMessage = useCallback((data: { direction?: string; phone: string; bodyPreview: string | null; messageType: string }) => {
    if (data?.direction !== 'INBOUND') return;
    pushAlert({
      id: Math.random().toString(36).slice(2),
      phone: data.phone,
      bodyPreview: data.bodyPreview,
      messageType: data.messageType,
      isReminder: false,
    });
  }, []);

  useWebSocketEvent('wa.message.received', handleMessage);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get('/notifications/whatsapp/conversations/unread-count');
        const count: number = data?.count ?? 0;
        if (count > 0) {
          pushAlert({
            id: Math.random().toString(36).slice(2),
            phone: null,
            bodyPreview: `${count} unread WhatsApp message${count === 1 ? '' : 's'} waiting`,
            messageType: null,
            isReminder: true,
          });
        }
      } catch {}
    }, REMINDER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function view(alert: MessageAlert) {
    router.push(alert.phone ? `/dashboard/notifications/whatsapp?phone=${alert.phone}` : '/dashboard/notifications/whatsapp');
    dismiss(alert.id);
  }

  if (alerts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '24px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '10px',
      width: 'min(420px, calc(100vw - 48px))',
    }}>
      {alerts.map(alert => (
        <div
          key={alert.id}
          onClick={() => view(alert)}
          style={{
            background: '#1B4F8A',
            borderRadius: '16px',
            padding: '16px 18px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            color: '#fff',
            cursor: 'pointer',
            animation: 'waPopupSlideDown 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '12px', padding: '10px', flexShrink: 0 }}>
              <MessageCircle size={22} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', opacity: 0.8, textTransform: 'uppercase', marginBottom: '3px' }}>
                {alert.isReminder ? '⏰ Still Unread' : '💬 New WhatsApp Message'}
              </div>
              {alert.phone && <div style={{ fontSize: '15px', fontWeight: 700 }}>+{alert.phone}</div>}
              <div style={{
                fontSize: '14px', opacity: 0.92, marginTop: '4px',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {alert.bodyPreview || (alert.messageType ? `[${alert.messageType}]` : '')}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: '2px', flexShrink: 0 }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{
            marginTop: '10px', width: '100%', textAlign: 'center',
            background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.3)',
            borderRadius: '9px', padding: '8px', fontWeight: 600, fontSize: '13px',
          }}>
            View in PaVa Connect →
          </div>
        </div>
      ))}

      <style>{`
        @keyframes waPopupSlideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
