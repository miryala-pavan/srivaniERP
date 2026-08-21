'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

// Browser Push API wants the VAPID public key as a raw Uint8Array, not the
// base64url string it's normally shared as.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    if (!isSupported) { setPermission('unsupported'); return; }
    setPermission(Notification.permission);
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    setLastError(null);
    if (!isSupported) { setLastError('This browser does not support push notifications'); return false; }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) { setLastError('Push notifications are not configured on this server (missing VAPID key)'); return false; }

    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
          });
        } catch (err) {
          // A stale subscription created under a different VAPID key (e.g. an
          // earlier deploy) makes the browser reject any new subscribe() call
          // until the old one is dropped — retry once after unsubscribing.
          const stale = await reg.pushManager.getSubscription();
          if (stale) {
            await stale.unsubscribe();
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
            });
          } else {
            throw err;
          }
        }
      }
      await api.post('/notifications/push/subscribe', sub.toJSON());
      setSubscribed(true);
      return true;
    } catch (err: any) {
      const detail = err?.response?.status === 403
        ? "Your account doesn't have permission to enable notifications"
        : err?.response?.data?.message ?? err?.message ?? String(err);
      console.error('[push] subscribe failed:', err);
      setLastError(detail);
      return false;
    } finally {
      setBusy(false);
    }
  }, [isSupported]);

  return { isSupported, permission, subscribed, busy, lastError, subscribe };
}
