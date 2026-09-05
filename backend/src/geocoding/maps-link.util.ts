// Google Maps link parsing — pasted links are the most common way customers
// actually share a location (far more than WhatsApp's native "share
// location" button). Google's own "Share" button usually produces a
// shortened link (maps.app.goo.gl / goo.gl) with no coordinates in the URL
// itself — those only appear after following the redirect, which is why
// GeocodingService.resolveMapsLink() needs a real HTTP request for those,
// while a long-form URL can be parsed from the string alone.

const ALLOWED_HOSTS = new Set([
  'google.com', 'www.google.com',
  'maps.google.com',
  'goo.gl',
  'maps.app.goo.gl',
]);

const SHORT_LINK_HOSTS = new Set(['goo.gl', 'maps.app.goo.gl']);

/**
 * SSRF guard — must be checked before ever issuing a request for this URL.
 * Anything outside Google's own domains is rejected with no network call.
 */
export function isAllowedMapsHost(url: string): boolean {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isShortMapsLink(url: string): boolean {
  try {
    return SHORT_LINK_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Tried in order of precision: the `!3d..!4d..` pair is the actual pinned
 * marker on a "place" URL (most accurate when present); `@lat,lng` is the
 * viewport center (present on almost every Maps URL, slightly less precise
 * for a place link than !3d/!4d); `?q=lat,lng` covers the older share format.
 */
export function parseCoordsFromMapsUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}
