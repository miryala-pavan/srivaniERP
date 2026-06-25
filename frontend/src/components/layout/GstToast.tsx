'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, X, AlertTriangle } from 'lucide-react';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';

interface Toast {
  id: string;
  type: 'GST_CRITICAL' | 'GST_HIGH';
  title: string;
  actionUrl?: string;
}

export function GstToast() {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Listen for any notification created via WebSocket
  useWebSocketEvent('notification.created', (payload: any) => {
    if (payload?.type !== 'GST_CRITICAL' && payload?.type !== 'GST_HIGH') return;
    const toast: Toast = {
      id:        payload.notificationId ?? String(Date.now()),
      type:      payload.type,
      title:     payload.title ?? 'GST Issue Detected',
      actionUrl: '/dashboard/reports/gst-health',
    };
    setToasts(prev => {
      // cap at 3 visible at once
      const next = [toast, ...prev].slice(0, 3);
      return next;
    });
    // Auto-dismiss after 8 seconds
    setTimeout(() => remove(toast.id), 8000);
  });

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => {
        const isCritical = t.type === 'GST_CRITICAL';
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm text-white animate-in slide-in-from-bottom-2 duration-300 ${
              isCritical
                ? 'bg-red-600 border-red-700'
                : 'bg-orange-500 border-orange-600'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {isCritical
                ? <ShieldAlert className="w-4 h-4" />
                : <AlertTriangle className="w-4 h-4" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs uppercase tracking-wide mb-0.5">
                {isCritical ? '🚨 GST Critical Issue' : '⚠️ GST High Risk'}
              </p>
              <p className="text-xs opacity-90 line-clamp-2">{t.title}</p>
              <button
                onClick={() => { remove(t.id); router.push('/dashboard/reports/gst-health'); }}
                className="mt-1.5 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
              >
                View GST Health Dashboard →
              </button>
            </div>
            <button onClick={() => remove(t.id)} className="flex-shrink-0 hover:opacity-70 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
