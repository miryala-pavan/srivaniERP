/**
 * Single shared "is this origin allowed" check — used by both the HTTP CORS
 * config (main.ts) and the Socket.IO gateway's CORS config
 * (events/events.gateway.ts). Previously the WS gateway had its own,
 * narrower check (just `process.env.FRONTEND_URL`, i.e. only the ERP
 * dashboard's port) which silently rejected every other app's WebSocket
 * connections in the browser — a real bug this session's live testing
 * caught (a Node socket.io-client script isn't subject to CORS at all, so
 * that gap was invisible to the earlier Node-only WS verification).
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / curl / mobile apps / server-to-server
  const allowed = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()) ?? [];
  return (
    /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(4000|4002|4003)$/.test(origin) ||
    /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(origin) ||
    /^https:\/\/[\w-]+\.vercel\.app$/.test(origin) ||
    /^https:\/\/[\w-]+\.trycloudflare\.com$/.test(origin) ||
    /^https:\/\/[\w.-]+\.srivani\.com$/.test(origin) ||
    // Capacitor's WebView origin on Android/iOS (androidScheme/iosScheme
    // default to "https", host "localhost") — the rider app wrapped native.
    origin === 'capacitor://localhost' || origin === 'https://localhost' || origin === 'ionic://localhost' ||
    allowed.includes(origin)
  );
}
