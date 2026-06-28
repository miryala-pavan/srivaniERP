import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { OnlineOrdersService } from './online-orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ADMIN_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'ACCOUNTS_PERSON'];

@Controller('online-orders')
export class OnlineOrdersController {
  constructor(private readonly service: OnlineOrdersService) {}

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return this.service.createOrder(dto);
  }

  @Post('verify-payment')
  verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.service.verifyPayment(dto);
  }

  @Get()
  listOrders(
    @Query('phone') phone?: string,
    @Query('email') email?: string,
  ) {
    return this.service.listOrders(phone, email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get('admin')
  listAllOrders(
    @Query('status')   status?: string,
    @Query('date')     date?: string,
    @Query('search')   search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?: string,
  ) {
    return this.service.listAllOrders(status, date, search, dateFrom, dateTo);
  }

  @Post(':orderNumber/confirm-delivery')
  confirmDelivery(@Param('orderNumber') orderNumber: string) {
    return this.service.confirmDelivery(orderNumber);
  }

  @Post(':orderNumber/cancel')
  cancelOrder(
    @Param('orderNumber') orderNumber: string,
    @Body('reason') reason?: string,
  ) {
    return this.service.cancelOrder(orderNumber, reason);
  }

  @Get(':orderNumber')
  getOrder(@Param('orderNumber') orderNumber: string) {
    return this.service.getOrder(orderNumber);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post(':orderNumber/notify')
  notifyCustomer(@Param('orderNumber') orderNumber: string) {
    return this.service.notifyCustomer(orderNumber);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':orderNumber/status')
  updateStatus(
    @Request() req: any,
    @Param('orderNumber') orderNumber: string,
    @Body('status') status: string,
  ) {
    return this.service.updateOrderStatus(orderNumber, status as any, { userId: req.user.userId, userName: req.user.fullName ?? req.user.username ?? 'Unknown', userRole: req.user.role });
  }
}
