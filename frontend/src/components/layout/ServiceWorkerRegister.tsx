'use client';

import { useEffect } from 'react';

// Registers the app's single service worker once, globally, for every
// authenticated route — not just POS. Previously this only happened inside
// pos/page.tsx, so any other page (e.g. PaVa Connect) got no install/offline
// support and no eligibility for push notifications.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return null;
}
