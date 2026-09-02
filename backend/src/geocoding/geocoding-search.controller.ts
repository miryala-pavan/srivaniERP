import { Controller, Get, Query, Param, BadRequestException, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { GeocodingService } from './geocoding.service';
import type { GeoProvider } from './geocoding.service';

// No auth guard — place search returns no sensitive data, and every app
// (storefront pre-auth, staff, rider) can hit the same route without
// juggling three separate guards. businessId is resolved via "the one
// active business", matching ShopService's public storefront-browsing
// endpoints, since this deployment is single-tenant today.
@Controller('geocoding')
export class GeocodingSearchController {
  constructor(private readonly geocoding: GeocodingService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('search')
  async search(@Query('q') q: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    if (!q?.trim()) throw new BadRequestException('q is required');
    const businessId = await this.geocoding.resolveActiveBusinessId();
    const location = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;
    return this.geocoding.autocomplete(q.trim(), businessId, location);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('place/:placeId')
  async resolve(@Param('placeId') placeId: string, @Query('provider') provider: GeoProvider) {
    if (provider !== 'ola' && provider !== 'google') throw new BadRequestException('provider must be ola or google');
    const businessId = await this.geocoding.resolveActiveBusinessId();
    const resolved = await this.geocoding.resolvePlace(placeId, provider, businessId);
    if (!resolved) throw new BadRequestException('Could not resolve this place');
    return resolved;
  }
}
