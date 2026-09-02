import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GeocodingService } from './geocoding.service';
import { UpdateGeocodingSettingsDto } from './dto/update-geocoding-settings.dto';

// Declared inside GeocodingModule rather than on the shared SettingsController
// — same reasoning as DeliverySettingsController (see that file's comment):
// multiple modules can each contribute a @Controller('settings') with
// distinct sub-paths with no route collision, sidestepping any import cycle.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class GeocodingSettingsController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('geocoding')
  getSettings(@Request() req: any) {
    return this.geocoding.getSettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put('geocoding')
  updateSettings(@Request() req: any, @Body() dto: UpdateGeocodingSettingsDto) {
    return this.geocoding.updateSettings(req.user.businessId, dto.googlePlacesApiKey);
  }
}
