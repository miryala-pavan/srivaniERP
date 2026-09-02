import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { StorefrontJwtGuard } from '../storefront-auth/guards/storefront-jwt.guard';
import { SavedPlacesService } from './saved-places.service';

@Controller('geocoding')
export class SavedPlacesController {
  constructor(private readonly savedPlaces: SavedPlacesService) {}

  @UseGuards(StorefrontJwtGuard)
  @Get('recent-places')
  recent(@Request() req: any) {
    return this.savedPlaces.recent(req.verifiedBusinessId, req.verifiedPhone);
  }
}
