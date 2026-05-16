import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { BusinessService } from './business.service';
import { SetupDto } from './dto/setup.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
