import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ServiceablePincodesService } from './serviceable-pincodes.service';
import { AddPincodeDto } from './dto/add-pincode.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings/serviceable-pincodes')
export class ServiceablePincodesController {
  constructor(private readonly service: ServiceablePincodesService) {}

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get()
  list(@Request() req: any) {
    return this.service.list(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post()
  add(@Request() req: any, @Body() dto: AddPincodeDto) {
    return this.service.add(req.user.businessId, dto.pincode, dto.areaLabel);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.businessId, id);
  }
}
