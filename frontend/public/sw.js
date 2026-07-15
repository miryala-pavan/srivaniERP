const CACHE_NAME = 'srivani-shell-v2';
const STATIC_ASSETS = ['/dashboard/pos', '/dashboard/notifications/whatsapp'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { return; }

  event.waitUntil((async () => {
    // Don't pop a native notification over a tab that's already open and
    // focused — the in-app toast (wa.message.received listener) already
    // covers that case. This only checks "is the app visible at all", not
    // which conversation is open, so a different-conversation case still
    // gets a native popup too — an accepted v1 gap.
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appIsVisible = clientList.some((c) => c.visibilityState === 'visible');
    if (appIsVisible) return;

    await self.registration.showNotification(data.title || 'New WhatsApp message', {
      body: data.body || '',
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      tag: `wa-${data.phone}`,
      data: { phone: data.phone },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const phone = event.notification.data?.phone;
  const url = phone
    ? `/dashboard/notifications/whatsapp?phone=${phone}`
    : '/dashboard/notifications/whatsapp';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clientList.find((c) => c.url.includes('/dashboard/notifications/whatsapp'));
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(url);
    } else {
      await self.clients.openWindow(url);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  // Never intercept API calls — always go to network
  if (event.request.url.includes('/api/')) return;

  // Network-first strategy: try network, fall back to cache.
  // Only GET responses are cacheable — the Cache API throws on POST/PUT/etc.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (event.request.method === 'GET') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached ?? new Response(
            'Offline — check your connection.',
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' },
            }
          )
        )
      )
  );
});
