import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Request, BadRequestException, HttpCode } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { OnlineOrdersService } from './online-orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { WhatsAppCheckoutDto } from './dto/whatsapp-checkout.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { AddOrderItemDto, UpdateOrderItemQtyDto } from './dto/edit-order-items.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ADMIN_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'ACCOUNTS_PERSON'];

@Controller('online-orders')
export class OnlineOrdersController {
  constructor(private readonly service: OnlineOrdersService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return this.service.createOrder(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('whatsapp-checkout')
  whatsappCheckout(@Body() dto: WhatsAppCheckoutDto) {
    return this.service.whatsappCheckout(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-payment')
  verifyPayment(@Body() dto: VerifyPaymentDto) {
    return this.service.verifyPayment(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':orderNumber/retry-payment')
  retryPayment(
    @Param('orderNumber') orderNumber: string,
    @Body('customerPhone') customerPhone: string,
  ) {
    if (!customerPhone) throw new BadRequestException('customerPhone is required');
    return this.service.retryPayment(orderNumber, customerPhone);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(':orderNumber/confirm-delivery')
  confirmDelivery(
    @Param('orderNumber') orderNumber: string,
    @Body('customerPhone') customerPhone: string,
  ) {
    if (!customerPhone) throw new BadRequestException('customerPhone is required');
    return this.service.confirmDelivery(orderNumber, customerPhone);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post(':orderNumber/cancel')
  cancelOrder(
    @Param('orderNumber') orderNumber: string,
    @Body('customerPhone') customerPhone: string,
    @Body('reason') reason?: string,
  ) {
    if (!customerPhone) throw new BadRequestException('customerPhone is required');
    return this.service.cancelOrder(orderNumber, customerPhone, reason);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':orderNumber')
  getOrder(
    @Param('orderNumber') orderNumber: string,
    @Query('phone') phone: string,
  ) {
    if (!phone) throw new BadRequestException('phone is required');
    return this.service.getOrder(orderNumber, phone);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post(':orderNumber/notify')
  notifyCustomer(@Param('orderNumber') orderNumber: string) {
    return this.service.notifyCustomer(orderNumber);
  }

  // ── Admin order detail + item editing ──────────────────────────────────────

  // NOTE: must stay registered before 'admin/:orderNumber' so the literal
  // segment wins over the param route.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get('admin/search-packs')
  searchPacks(@Query('q') q: string) {
    return this.service.searchPacksForAdmin(q ?? '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get('admin/:orderNumber')
  getAdminOrder(@Param('orderNumber') orderNumber: string) {
    return this.service.getAdminOrder(orderNumber);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch('admin/:orderNumber/meta')
  updateOrderMeta(
    @Request() req: any,
    @Param('orderNumber') orderNumber: string,
    @Body() body: { assignedToName?: string | null; deliverySlot?: string | null },
  ) {
    return this.service.updateOrderMeta(
      orderNumber,
      { assignedToName: body.assignedToName, deliverySlot: body.deliverySlot },
      req.user.fullName ?? req.user.username ?? 'Unknown',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post('admin/:orderNumber/items')
  addItem(@Request() req: any, @Param('orderNumber') orderNumber: string, @Body() dto: AddOrderItemDto) {
    return this.service.addOrderItem(orderNumber, dto, req.user.fullName ?? req.user.username ?? 'Unknown');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch('admin/:orderNumber/items/:itemId')
  updateItemQty(
    @Request() req: any,
    @Param('orderNumber') orderNumber: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemQtyDto,
  ) {
    return this.service.updateOrderItemQty(orderNumber, itemId, dto.quantity, req.user.fullName ?? req.user.username ?? 'Unknown');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete('admin/:orderNumber/items/:itemId')
  removeItem(
    @Request() req: any,
    @Param('orderNumber') orderNumber: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeOrderItem(orderNumber, itemId, req.user.fullName ?? req.user.username ?? 'Unknown');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('backfill-customers')
  @HttpCode(200)
  backfillCustomers(@Request() req: any) {
    return this.service.backfillCustomers(req.user.businessId);
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
