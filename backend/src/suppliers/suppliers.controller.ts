import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const SUPPLIER_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'PURCHASE_CHECKER',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SUPPLIER_ROLES)
@Controller('suppliers')
export class SuppliersController {
  constructor(private suppliersService: SuppliersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(req.user.businessId, dto);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: SupplierQueryDto) {
    return this.suppliersService.findAll(req.user.businessId, query);
  }

  // ── Multi-segment routes BEFORE /:id ─────────────────

  @Get(':id/balance')
  getBalance(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.getSupplierBalance(req.user.businessId, id);
  }

  @Get(':id/ledger')
  getLedger(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.getSupplierLedger(req.user.businessId, id);
  }

  @Get(':id/payments')
  getPayments(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: { purchaseId?: string; page?: string; limit?: string },
  ) {
    return this.suppliersService.getPayments(req.user.businessId, id, query);
  }

  @Get(':id/credit-notes')
  getSupplierCreditNotes(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: { page?: string; limit?: string },
  ) {
    return this.suppliersService.getSupplierCreditNotes(req.user.businessId, id, query);
  }

  @Post(':id/payments')
  addPayment(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.suppliersService.addPayment(req.user.businessId, id, {
      ...body,
      createdByName: req.user.name ?? req.user.fullName ?? 'Unknown',
      createdById:   req.user.id,
    });
  }

  @Delete(':id/payments/:paymentId')
  deletePayment(
    @Request() req: any,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.suppliersService.deletePayment(req.user.businessId, id, paymentId);
  }

  @Patch(':id/opening-balance')
  updateOpeningBalance(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.suppliersService.updateOpeningBalance(req.user.businessId, id, body);
  }

  // ── Single-resource routes ────────────────────────────

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.findOne(req.user.businessId, id);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(req.user.businessId, id, dto);
  }
}
