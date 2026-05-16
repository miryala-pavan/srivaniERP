import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateFeaturesDto } from './dto/update-features.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('features')
  getFeatures(@Request() req: any) {
    return this.settingsService.getFeatures(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Put('features')
  updateFeatures(@Request() req: any, @Body() dto: UpdateFeaturesDto) {
    return this.settingsService.updateFeatures(req.user.businessId, dto);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('billing')
  getBillingSettings(@Request() req: any) {
    return this.settingsService.getBillingSettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put('billing')
  updateBillingSettings(@Request() req: any, @Body() body: Record<string, string>) {
    return this.settingsService.updateBillingSettings(req.user.businessId, body);
  }

  @Get('pos')
  getPosSettings(@Request() req: any) {
    return this.settingsService.getPosSettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put('pos')
  updatePosSettings(@Request() req: any, @Body() body: Record<string, string>) {
    return this.settingsService.updatePosSettings(req.user.businessId, body);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('system')
  getSystemSettings(@Request() req: any) {
    return this.settingsService.getSystemSettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put('system')
  updateSystemSettings(@Request() req: any, @Body() body: Record<string, string>) {
    return this.settingsService.updateSystemSettings(req.user.businessId, body);
  }

  @Get('pos-shortcuts')
  getPosShortcuts(@Request() req: any) {
    return this.settingsService.getPosShortcuts(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put('pos-shortcuts')
  updatePosShortcuts(@Request() req: any, @Body() body: Record<string, string>) {
    return this.settingsService.updatePosShortcuts(req.user.businessId, body);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('gst')
  getGstSettings(@Request() req: any) {
    return this.settingsService.getGstSettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Put('gst')
  updateGstSettings(@Request() req: any, @Body() body: Record<string, string>) {
    return this.settingsService.updateGstSettings(req.user.businessId, body);
  }
}
