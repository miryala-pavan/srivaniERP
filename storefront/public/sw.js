/* Srivani Stores — service worker v2 */
const CACHE = 'sv-v2';
const PRECACHE = ['/offline.html', '/logo.png', '/noimage.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  // Wipe ALL caches from previous versions (sv-v1, etc.)
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip: non-GET, cross-origin, API calls, Next.js dynamic routes
  if (
    request.method !== 'GET' ||
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.pathname.startsWith('/_next/image/')
  ) return;

  // Navigation (HTML): pure network-first, NO caching
  // Only falls back to offline page when network is completely unreachable
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .catch(() => caches.match('/offline.html').then(r => r ?? Response.error())),
    );
    return;
  }

  // Immutable hashed static assets (_next/static/*, /icons/*): cache-first
  // These filenames contain content hashes — a new build always produces new URLs,
  // so cached entries never go stale.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok && res.status === 200) {
            caches.open(CACHE).then(c => c.put(request, res.clone()));
          }
          return res;
        }).catch(() => Response.error());
      }),
    );
    return;
  }

  // Known public assets (pre-cached on install): cache-first
  if (PRECACHE.some(p => url.pathname === p)) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()));
          return res;
        }).catch(() => Response.error());
      }),
    );
    return;
  }

  // Everything else: pure passthrough — NO caching, NO stale fallback.
  // Caching dynamic responses (page data, search results, product listings)
  // caused stale loading-screen bug in sv-v1. Let the browser handle these.
});
