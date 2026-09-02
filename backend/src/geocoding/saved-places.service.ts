import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeocodingService } from './geocoding.service';

@Injectable()
export class SavedPlacesService {
  private readonly logger = new Logger(SavedPlacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
  ) {}

  /**
   * Records that `phone` used this pin, bumping useCount/lastUsedAt if it's
   * already been used before (same businessId+phone+lat+lng). Called from
   * existing write paths (address save, order placement, staff dispatch) —
   * never a direct client-facing "save" action, which is what makes "save
   * every place a user uses" automatic. Fire-and-forget: a geocoding hiccup
   * here must never fail the address/order/delivery write it's attached to.
   */
  async recordUse(businessId: string, phone: string, lat: number, lng: number, source: string, label?: string) {
    try {
      let resolvedLabel = label;
      if (!resolvedLabel) {
        // No label yet (GPS fix or manual drag, not a search selection) —
        // reverse-geocode so the recent-places chip still has real text.
        resolvedLabel = (await this.geocoding.reverseGeocode(lat, lng, businessId)) ?? undefined;
      }

      await this.prisma.savedPlace.upsert({
        where: { businessId_phone_lat_lng: { businessId, phone, lat, lng } },
        update: { useCount: { increment: 1 }, lastUsedAt: new Date(), ...(resolvedLabel && { label: resolvedLabel }) },
        create: { businessId, phone, lat, lng, label: resolvedLabel, source },
      });
    } catch (err) {
      this.logger.error(`recordUse failed for phone=${phone}: ${err instanceof Error ? err.message : err}`);
    }
  }

  async recent(businessId: string, phone: string, limit = 5) {
    return this.prisma.savedPlace.findMany({
      where: { businessId, phone },
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
    });
  }
}
