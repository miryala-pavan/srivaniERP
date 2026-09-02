import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorefrontAuthModule } from '../storefront-auth/storefront-auth.module';
import { GeocodingService } from './geocoding.service';
import { SavedPlacesService } from './saved-places.service';
import { GeocodingSettingsController } from './geocoding-settings.controller';
import { GeocodingSearchController } from './geocoding-search.controller';
import { SavedPlacesController } from './saved-places.controller';

@Module({
  imports: [PrismaModule, StorefrontAuthModule],
  controllers: [GeocodingSettingsController, GeocodingSearchController, SavedPlacesController],
  providers: [GeocodingService, SavedPlacesService],
  exports: [GeocodingService, SavedPlacesService],
})
export class GeocodingModule {}
