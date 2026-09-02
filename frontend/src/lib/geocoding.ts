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
