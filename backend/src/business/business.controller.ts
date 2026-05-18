import { Controller, Get, Post, Put, Body, UseGuards, Request } from '@nestjs/common';
import { BusinessService } from './business.service';
import { SetupDto } from './dto/setup.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('business')
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  @Get('setup-status')
  getSetupStatus() {
    return this.businessService.getSetupStatus();
  }

  @Post('setup')
  setup(@Body() dto: SetupDto) {
    return this.businessService.setup(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('info')
  getInfo(@Request() req: any) {
    return this.businessService.getInfo(req.user.businessId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Put()
  update(@Request() req: any, @Body() dto: UpdateBusinessDto) {
    const u = req.user;
    return this.businessService.updateBusiness(
      u.businessId, dto, u.id ?? u.userId, u.fullName ?? u.username ?? 'Admin',
    );
  }
}
