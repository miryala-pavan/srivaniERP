import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt, decrypt } from '../common/helpers/credential-encryption.util';

// DB key for the optional per-business Google Places fallback key. Ola's key
// is a pure global env var (OLA_MAPS_API_KEY) — one platform-wide key is the
// whole point of picking a generous-free-tier, no-setup default provider.
const GOOGLE_KEY_SETTING = 'geocoding.googlePlacesApiKey';

export type GeoProvider = 'ola' | 'google';

export interface PlaceSuggestion {
  placeId: string;
  provider: GeoProvider;
  description: string;
  mainText?: string;
  secondaryText?: string;
  // Present for Ola (its autocomplete response already includes coordinates)
  // — absent for Google, which requires a separate Place Details call.
  // Callers should skip resolvePlace() entirely when these are already set.
  lat?: number;
  lng?: number;
}

export interface ResolvedPlace {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Business resolution for the public (unauthenticated) search routes ──
  // Mirrors ShopService.getBusinessId() — this deployment is single-tenant
  // today, so "the one active business" is the correct resolution for a
  // route with no JWT to carry a businessId.
  async resolveActiveBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
    return biz?.id ?? '';
  }

  private olaEnabled(): boolean {
    return !!process.env.OLA_MAPS_API_KEY;
  }

  private async getGoogleKey(businessId: string): Promise<string | undefined> {
    if (!businessId) return undefined;
    const row = await this.prisma.systemSetting.findUnique({
      where: { businessId_key: { businessId, key: GOOGLE_KEY_SETTING } },
    });
    return row?.value ? decrypt(row.value) : undefined;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async autocomplete(query: string, businessId: string, location?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
    if (this.olaEnabled()) {
      const results = await this.olaAutocomplete(query, location);
      if (results.length) return results;
      this.logger.warn(`Ola autocomplete returned zero results for "${query}" — trying Google fallback if configured`);
    } else {
      this.logger.warn('OLA_MAPS_API_KEY not set — skipping Ola, trying Google fallback if configured');
    }
    const googleKey = await this.getGoogleKey(businessId);
    if (!googleKey) return [];
    return this.googleAutocomplete(query, googleKey, location);
  }

  async resolvePlace(placeId: string, provider: GeoProvider, businessId: string): Promise<ResolvedPlace | null> {
    if (provider === 'ola') return this.olaPlaceDetails(placeId);
    const googleKey = await this.getGoogleKey(businessId);
    if (!googleKey) return null;
    return this.googlePlaceDetails(placeId, googleKey);
  }

  async reverseGeocode(lat: number, lng: number, businessId: string): Promise<string | null> {
    if (this.olaEnabled()) {
      const label = await this.olaReverseGeocode(lat, lng);
      if (label) return label;
    }
    const googleKey = await this.getGoogleKey(businessId);
    if (!googleKey) return null;
    return this.googleReverseGeocode(lat, lng, googleKey);
  }

  // ── Settings (Google fallback key) ──────────────────────────────────────

  async getSettings(businessId: string) {
    const googleKey = await this.getGoogleKey(businessId);
    return { olaConfigured: this.olaEnabled(), googleConfigured: !!googleKey };
  }

  async updateSettings(businessId: string, googlePlacesApiKey?: string) {
    const trimmed = googlePlacesApiKey?.trim();
    if (trimmed) {
      await this.prisma.systemSetting.upsert({
        where: { businessId_key: { businessId, key: GOOGLE_KEY_SETTING } },
        update: { value: encrypt(trimmed) },
        create: { businessId, key: GOOGLE_KEY_SETTING, value: encrypt(trimmed) },
      });
    }
    return this.getSettings(businessId);
  }

  // ── Ola Maps ─────────────────────────────────────────────────────────────

  private async olaAutocomplete(query: string, location?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
    try {
      const params = new URLSearchParams({ input: query, api_key: process.env.OLA_MAPS_API_KEY! });
      if (location) params.set('location', `${location.lat},${location.lng}`);
      const res = await fetch(`https://api.olamaps.io/places/v1/autocomplete?${params}`);
      const data = (await res.json()) as any;
      if (!res.ok || data.status !== 'ok') {
        this.logger.warn(`Ola autocomplete non-ok (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
        return [];
      }
      return (data.predictions ?? []).map((p: any): PlaceSuggestion => ({
        placeId: p.place_id,
        provider: 'ola',
        description: p.description,
        mainText: p.structured_formatting?.main_text,
        secondaryText: p.structured_formatting?.secondary_text,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
      }));
    } catch (err) {
      this.logger.error(`Ola autocomplete failed: ${err}`);
      return [];
    }
  }

  private async olaPlaceDetails(placeId: string): Promise<ResolvedPlace | null> {
    try {
      const params = new URLSearchParams({ place_id: placeId, api_key: process.env.OLA_MAPS_API_KEY! });
      const res = await fetch(`https://api.olamaps.io/places/v1/details?${params}`);
      const data = (await res.json()) as any;
      if (!res.ok || data.status !== 'ok' || !data.result?.geometry?.location) return null;
      return {
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng,
        formattedAddress: data.result.formatted_address,
      };
    } catch (err) {
      this.logger.error(`Ola place details failed: ${err}`);
      return null;
    }
  }

  private async olaReverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const params = new URLSearchParams({ latlng: `${lat},${lng}`, api_key: process.env.OLA_MAPS_API_KEY! });
      const res = await fetch(`https://api.olamaps.io/places/v1/reverse-geocode?${params}`);
      const data = (await res.json()) as any;
      if (!res.ok) return null;
      // Defensive: exact reverse-geocode schema wasn't fully captured during
      // API research — accept either a Google-style `results[]` or Ola's own
      // Place-Details-style single `result`.
      const first = data.results?.[0] ?? data.result;
      return first?.formatted_address ?? null;
    } catch (err) {
      this.logger.error(`Ola reverse geocode failed: ${err}`);
      return null;
    }
  }

  // ── Google Places (optional per-business fallback) ──────────────────────

  private async googleAutocomplete(query: string, apiKey: string, location?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
    try {
      const params = new URLSearchParams({ input: query, key: apiKey });
      if (location) params.set('location', `${location.lat},${location.lng}`);
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
      const data = (await res.json()) as any;
      if (data.status !== 'OK') {
        if (data.status !== 'ZERO_RESULTS') this.logger.warn(`Google autocomplete status ${data.status}: ${data.error_message ?? ''}`);
        return [];
      }
      return (data.predictions ?? []).map((p: any): PlaceSuggestion => ({
        placeId: p.place_id,
        provider: 'google',
        description: p.description,
        mainText: p.structured_formatting?.main_text,
        secondaryText: p.structured_formatting?.secondary_text,
      }));
    } catch (err) {
      this.logger.error(`Google autocomplete failed: ${err}`);
      return [];
    }
  }

  private async googlePlaceDetails(placeId: string, apiKey: string): Promise<ResolvedPlace | null> {
    try {
      const params = new URLSearchParams({ place_id: placeId, key: apiKey, fields: 'geometry,formatted_address' });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
      const data = (await res.json()) as any;
      if (data.status !== 'OK' || !data.result?.geometry?.location) return null;
      return {
        lat: data.result.geometry.location.lat,
        lng: data.result.geometry.location.lng,
        formattedAddress: data.result.formatted_address,
      };
    } catch (err) {
      this.logger.error(`Google place details failed: ${err}`);
      return null;
    }
  }

  private async googleReverseGeocode(lat: number, lng: number, apiKey: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({ latlng: `${lat},${lng}`, key: apiKey });
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
      const data = (await res.json()) as any;
      if (data.status !== 'OK') return null;
      return data.results?.[0]?.formatted_address ?? null;
    } catch (err) {
      this.logger.error(`Google reverse geocode failed: ${err}`);
      return null;
    }
  }
}
