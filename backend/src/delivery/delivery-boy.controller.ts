import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeliveryBoyService } from './delivery-boy.service';
import { CreateDeliveryBoyDto } from './dto/create-delivery-boy.dto';
import { UpdateDeliveryBoyDto } from './dto/update-delivery-boy.dto';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
  'FLOOR_SUPERVISOR', 'SALES_REP', 'CASHIER',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('delivery-boys')
export class DeliveryBoyController {
  constructor(private readonly service: DeliveryBoyService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.businessId);
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateDeliveryBoyDto) {
    return this.service.create(req.user.businessId, dto);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.businessId, id);
  }

  @Patch(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateDeliveryBoyDto) {
    return this.service.update(req.user.businessId, id, dto);
  }

  @Get(':id/payouts')
  payouts(@Request() req: any, @Param('id') id: string) {
    return this.service.payouts(req.user.businessId, id);
  }

  @Post(':id/payouts/settle')
  settlePayouts(@Request() req: any, @Param('id') id: string) {
    return this.service.settlePayouts(req.user.businessId, id);
  }
}
