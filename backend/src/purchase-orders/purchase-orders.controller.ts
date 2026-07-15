import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';

const PO_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...PO_ROLES)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
  ) {
    return this.service.findAll(req.user.businessId, {
      status, supplierId, source, from, to,
      take: take ? parseInt(take) : 100,
    });
  }

  @Post()
  create(@Request() req: any, @Body() body: CreatePurchaseOrderDto) {
    return this.service.create(req.user.businessId, {
      ...body,
      userId: req.user.id,
      userName: req.user.fullName,
    });
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.businessId, id);
  }

  @Post(':id/send')
  markSent(@Request() req: any, @Param('id') id: string, @Body('via') via: 'WHATSAPP' | 'EMAIL') {
    return this.service.markSent(req.user.businessId, id, via ?? 'WHATSAPP');
  }

  @Get(':id/whatsapp-text')
  getWhatsAppText(@Request() req: any, @Param('id') id: string) {
    return this.service.buildWhatsAppText(req.user.businessId, id).then(text => ({ text }));
  }

  @Patch(':id/items/:itemId/received')
  updateReceived(
    @Request() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('qtyReceived') qtyReceived: number,
  ) {
    return this.service.updateReceived(req.user.businessId, id, itemId, qtyReceived);
  }

  @Post(':id/cancel')
  cancel(@Request() req: any, @Param('id') id: string) {
    return this.service.cancel(req.user.businessId, id);
  }

  @Post(':id/create-grn')
  createGrn(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { invoiceNumber: string; invoiceDate: string },
  ) {
    return this.service.createGrnFromPo(req.user.businessId, id, {
      ...body,
      branchId: req.user.branchId ?? undefined,
    });
  }
}
