import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { PosQuickAddCustomerDto } from './dto/pos-quick-add-customer.dto';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from './dto/create-customer-address.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
  'FLOOR_SUPERVISOR', 'SALES_REP', 'CASHIER',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // ─── STATIC ROUTES (before :id) ──────────────────────

  @Post('seed-defaults')
  seedDefaults(@Request() req: any) {
    return this.customersService.seedWalkInCustomer(req.user.businessId);
  }

  @Post('backfill-codes')
  backfillCodes(@Request() req: any) {
    return this.customersService.backfillCustomerCodes(req.user.businessId);
  }

  @Post('pos-quick-add')
  posQuickAdd(@Request() req: any, @Body() dto: PosQuickAddCustomerDto) {
    return this.customersService.posQuickAdd(req.user.businessId, dto);
  }

  // ─── COLLECTION ───────────────────────────────────────

  @Post()
  create(@Request() req: any, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.user.businessId, dto);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: CustomerQueryDto) {
    return this.customersService.findAll(req.user.businessId, query);
  }

  // ─── PER-CUSTOMER SUB-RESOURCES (before :id) ─────────

  @Get(':id/bills')
  getBills(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: { page?: string; limit?: string },
  ) {
    return this.customersService.getBills(req.user.businessId, id, query);
  }

  @Get(':id/payments')
  getPayments(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: { page?: string; limit?: string },
  ) {
    return this.customersService.getPayments(req.user.businessId, id, query);
  }

  @Get(':id/statement')
  getStatement(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: { dateFrom?: string; dateTo?: string },
  ) {
    return this.customersService.getStatement(req.user.businessId, id, query);
  }

  @Post(':id/payments')
  recordPayment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateCustomerPaymentDto,
  ) {
    return this.customersService.recordPayment(
      req.user.businessId, id, dto, req.user.userId, req.user.fullName,
    );
  }

  @Delete(':id/payments/:pid')
  deletePayment(
    @Request() req: any,
    @Param('id') id: string,
    @Param('pid') pid: string,
  ) {
    return this.customersService.deletePayment(req.user.businessId, id, pid);
  }

  @Get(':id/addresses')
  getAddresses(@Request() req: any, @Param('id') id: string) {
    return this.customersService.getAddresses(req.user.businessId, id);
  }

  @Post(':id/addresses')
  createAddress(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    return this.customersService.createAddress(req.user.businessId, id, dto);
  }

  @Put(':id/addresses/:addrId')
  updateAddress(
    @Request() req: any,
    @Param('id') id: string,
    @Param('addrId') addrId: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customersService.updateAddress(req.user.businessId, id, addrId, dto);
  }

  @Delete(':id/addresses/:addrId')
  deleteAddress(
    @Request() req: any,
    @Param('id') id: string,
    @Param('addrId') addrId: string,
  ) {
    return this.customersService.deleteAddress(req.user.businessId, id, addrId);
  }

  // ─── SINGLE RESOURCE ──────────────────────────────────

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.customersService.findOne(req.user.businessId, id);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(req.user.businessId, id, dto);
  }
}
