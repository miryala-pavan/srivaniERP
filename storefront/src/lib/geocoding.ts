import { authHeader } from './storefront-auth';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4001/api';

export interface PlaceSuggestion {
  placeId: string;
  provider: 'ola' | 'google';
  description: string;
  mainText?: string;
  secondaryText?: string;
  // Present for Ola results — skip resolvePlace() and use these directly.
  lat?: number;
  lng?: number;
}

export interface ResolvedPlace {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

export interface RecentPlace {
  id: string;
  lat: number;
  lng: number;
  label: string | null;
  useCount: number;
  lastUsedAt: string;
}

// Public endpoints — no auth header needed (place search returns no
// sensitive data), matches how storefront's product search already works.
export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ q: query });
  if (near) { params.set('lat', String(near.lat)); params.set('lng', String(near.lng)); }
  const res = await fetch(`${API}/geocoding/search?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function resolvePlace(placeId: string, provider: 'ola' | 'google'): Promise<ResolvedPlace | null> {
  const res = await fetch(`${API}/geocoding/place/${encodeURIComponent(placeId)}?provider=${provider}`);
  if (!res.ok) return null;
  return res.json();
}

// Requires a verified phone (StorefrontJwtGuard) — returns [] silently if
// not signed in yet rather than throwing, since recent-places is a nice-to-
// have quick-pick, not something checkout should ever block on.
export async function fetchRecentPlaces(): Promise<RecentPlace[]> {
  const res = await fetch(`${API}/geocoding/recent-places`, { headers: { ...authHeader() } });
  if (!res.ok) return [];
  return res.json();
}
