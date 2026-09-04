import { Controller, Get, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { StorefrontJwtGuard } from '../storefront-auth/guards/storefront-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SavedPlacesService } from './saved-places.service';

@Controller('geocoding')
export class SavedPlacesController {
  constructor(private readonly savedPlaces: SavedPlacesService) {}

  @UseGuards(StorefrontJwtGuard)
  @Get('recent-places')
  recent(@Request() req: any) {
    return this.savedPlaces.recent(req.verifiedBusinessId, req.verifiedPhone);
  }

  // Staff already know the customer's phone from the order they're
  // dispatching — this looks up that phone's history directly, unlike the
  // customer-facing route above which can only ever see the caller's own.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR')
  @Get('recent-places/staff')
  recentForStaff(@Request() req: any, @Query('phone') phone: string) {
    if (!phone?.trim()) throw new BadRequestException('phone is required');
    return this.savedPlaces.recent(req.user.businessId, phone.trim());
  }
}
