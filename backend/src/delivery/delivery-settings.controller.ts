import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeliverySettingsService, DeliveryDispatchSettings } from './delivery-settings.service';

// Deliberately declared here in DeliveryModule (not on SettingsController /
// SettingsModule) — SettingsModule sits behind NotificationsModule/ShopModule
// in the import graph, and DeliveryModule already imports NotificationsModule
// for WhatsAppService, so SettingsModule importing DeliveryModule would
// create a real circular dependency (confirmed: NestJS refused to boot with
// "module at index [1] of DeliveryModule imports is undefined"). Multiple
// modules can each contribute a @Controller('settings') with distinct
// sub-paths with no route collision, which sidesteps the cycle entirely.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class DeliverySettingsController {
  constructor(private deliverySettingsService: DeliverySettingsService) {}

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('delivery-dispatch')
  getDeliveryDispatchSettings(@Request() req: any) {
    return this.deliverySettingsService.getAll(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put('delivery-dispatch')
  updateDeliveryDispatchSettings(@Request() req: any, @Body() body: Partial<DeliveryDispatchSettings>) {
    return this.deliverySettingsService.update(req.user.businessId, body);
  }
}
