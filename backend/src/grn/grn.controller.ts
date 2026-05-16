import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { GrnService } from './grn.service';
import { CreateGrnDto } from './dto/create-grn.dto';
import { UpdateGrnDto } from './dto/update-grn.dto';
import { GrnQueryDto } from './dto/grn-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SuppliersService } from '../suppliers/suppliers.service';

const GRN_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON'];
const APPROVE_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('grn')
export class GrnController {
  constructor(
    private grnService: GrnService,
    private suppliersService: SuppliersService,
  ) {}

  // ── Multi-segment lookups MUST be declared before /:id ────────────────────

  @Get('search-products')
  @Roles(...GRN_ROLES)
  searchProducts(@Request() req: any, @Query('q') q: string) {
    return this.grnService.searchProductsForGrn(q ?? '', req.user.businessId);
  }

  @Get('supplier/:supplierId/advance')
  @Roles(...GRN_ROLES)
  getSupplierAdvances(@Request() req: any, @Param('supplierId') supplierId: string) {
    return this.grnService.getSupplierAdvances(req.user.businessId, supplierId);
  }

  @Get('product/:productId/last-rates')
  @Roles(...GRN_ROLES)
  getProductLastRates(@Request() req: any, @Param('productId') productId: string) {
    return this.grnService.getProductLastRates(req.user.businessId, productId);
  }

  // ── Credit note routes (before /:id) ──────────────────────────────────────

  @Post('credit-notes')
  @Roles(...GRN_ROLES)
  createCreditNote(@Request() req: any, @Body() dto: any) {
    return this.grnService.createSupplierCreditNote(
      req.user.businessId,
      req.user.userId,
      req.user.fullName ?? req.user.username ?? 'Unknown',
      dto,
    );
  }

  @Get('credit-notes')
  @Roles(...GRN_ROLES)
  getCreditNotes(
    @Request() req: any,
    @Query('supplierId') supplierId?: string,
    @Query('originalGrnId') originalGrnId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.grnService.getSupplierCreditNotes(req.user.businessId, {
      supplierId,
      originalGrnId,
      dateFrom,
      dateTo,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  // ── Collection routes ─────────────────────────────────────────────────────

  @Get()
  @Roles(...GRN_ROLES)
  findAll(@Request() req: any, @Query() query: GrnQueryDto) {
    return this.grnService.findAll(req.user.businessId, query);
  }

  @Post()
  @Roles(...GRN_ROLES)
  create(@Request() req: any, @Body() dto: CreateGrnDto) {
    return this.grnService.create(req.user.businessId, dto);
  }

  // ── Single-resource routes ────────────────────────────────────────────────

  @Get(':id/print-data')
  @Roles(...GRN_ROLES)
  getPrintData(@Request() req: any, @Param('id') id: string) {
    return this.grnService.getPrintData(req.user.businessId, id);
  }

  @Get(':id/payment-summary')
  @Roles(...GRN_ROLES)
  getPaymentSummary(@Request() req: any, @Param('id') id: string) {
    return this.suppliersService.getGrnPaymentSummary(req.user.businessId, id);
  }

  @Get(':id')
  @Roles(...GRN_ROLES)
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.grnService.findOne(req.user.businessId, id);
  }

  @Put(':id')
  @Roles(...GRN_ROLES)
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateGrnDto) {
    return this.grnService.update(req.user.businessId, id, dto);
  }

  @Delete(':id')
  @Roles(...GRN_ROLES)
  delete(@Request() req: any, @Param('id') id: string) {
    return this.grnService.deleteGrn(req.user.businessId, id);
  }

  // ── Status transition routes ──────────────────────────────────────────────

  @Post(':id/submit')
  @Roles(...GRN_ROLES)
  submit(@Request() req: any, @Param('id') id: string) {
    return this.grnService.submit(req.user.businessId, id);
  }

  @Post(':id/approve')
  @Roles(...APPROVE_ROLES)
  approve(
    @Request() req: any,
    @Param('id') id: string,
    @Body('approverName') approverName?: string,
    @Body('notes') notes?: string,
  ) {
    return this.grnService.approve(req.user.businessId, id, approverName ?? req.user.name, notes);
  }

  @Post(':id/reject')
  @Roles(...APPROVE_ROLES)
  reject(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.grnService.reject(req.user.businessId, id, req.user.name, reason);
  }

  @Post(':id/revert')
  @Roles(...GRN_ROLES)
  revert(@Request() req: any, @Param('id') id: string) {
    return this.grnService.revertToDraft(req.user.businessId, id);
  }
}
