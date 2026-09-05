import api from './api';

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

// /geocoding/search and /geocoding/place/:id are public routes (no guard),
// so the staff JWT the shared `api` instance attaches is simply ignored —
// reused anyway for consistency with every other call in this app.
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!query.trim()) return [];
  const res = await api.get('/geocoding/search', { params: { q: query } });
  return res.data;
}

export async function resolvePlace(placeId: string, provider: 'ola' | 'google'): Promise<ResolvedPlace | null> {
  const res = await api.get(`/geocoding/place/${encodeURIComponent(placeId)}`, { params: { provider } });
  return res.data;
}

// A pasted Google Maps link — how customers actually share a location most
// of the time. Returns null on a bad/unparseable link rather than throwing,
// since this is typed by hand and a mistake shouldn't look like a crash.
export async function resolveMapsLink(url: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await api.get('/geocoding/resolve-maps-link', { params: { url } });
    return res.data;
  } catch {
    return null;
  }
}
