import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeliveryDispatchService } from './delivery-dispatch.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { DeliveryQueryDto } from './dto/delivery-query.dto';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
  'FLOOR_SUPERVISOR', 'SALES_REP', 'CASHIER',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('deliveries')
export class DeliveryController {
  constructor(private readonly dispatch: DeliveryDispatchService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateDeliveryDto) {
    return this.dispatch.createDelivery(req.user.businessId, dto);
  }

  @Post('from-online-order/:orderId')
  createFromOnlineOrder(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Body() override: { lat?: number; lng?: number; addressText?: string; codAmount?: number },
  ) {
    return this.dispatch.createDeliveryFromOnlineOrder(req.user.businessId, orderId, override);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: DeliveryQueryDto) {
    return this.dispatch.findAll(req.user.businessId, query);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.dispatch.findOne(req.user.businessId, id);
  }

  @Post(':id/manual-assign')
  manualAssign(@Request() req: any, @Param('id') id: string, @Body('deliveryBoyId') deliveryBoyId: string) {
    return this.dispatch.manualAssign(req.user.businessId, id, deliveryBoyId);
  }

  @Post(':id/cancel')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.dispatch.cancelDelivery(req.user.businessId, id);
  }
}
