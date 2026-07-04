import {
  Controller, Get, Post, Delete, Body, Query, Req, Res, Param, UseGuards, ParseIntPipe,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard }    from '../auth/guards/jwt-auth.guard';
import { RolesGuard }      from '../auth/guards/roles.guard';
import { Roles }           from '../auth/decorators/roles.decorator';
import { GstReportsService } from './gst-reports.service';
import { ExcelExportService } from './excel-export.service';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

@Controller('reports/gst')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA')
export class GstReportsController {
  constructor(
    private gstReports:  GstReportsService,
    private excelExport: ExcelExportService,
  ) {}

  // ─── Sales Register ────────────────────────────────────────────────────────

  @Get('sales-register')
  getSalesRegister(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.getSalesRegister(req.user.businessId, month, year);
  }

  @Get('sales-register/excel')
  async getSalesRegisterExcel(
    @Req()  req: any,
    @Res()  res: Response,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    const data     = await this.gstReports.getSalesRegister(req.user.businessId, month, year);
    const buf      = this.excelExport.generateSalesRegisterExcel(data);
    const filename = `Sales_Register_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  // ─── Inward Supplies Register (GSTR-2 format) ─────────────────────────────

  @Get('inward-supplies')
  getInwardSupplies(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.getInwardSuppliesReport(req.user.businessId, month, year);
  }

  @Get('inward-supplies/excel')
  async getInwardSuppliesExcel(
    @Req()  req: any,
    @Res()  res: Response,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    const data     = await this.gstReports.getInwardSuppliesReport(req.user.businessId, month, year);
    const buf      = this.excelExport.generateInwardSuppliesExcel(data);
    const filename = `GSTR2_Inward_Supplies_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  // ─── Purchase Register ─────────────────────────────────────────────────────

  @Get('purchase-register')
  getPurchaseRegister(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.getPurchaseRegister(req.user.businessId, month, year);
  }

  @Get('purchase-register/excel')
  async getPurchaseRegisterExcel(
    @Req()  req: any,
    @Res()  res: Response,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    const data     = await this.gstReports.getPurchaseRegister(req.user.businessId, month, year);
    const buf      = this.excelExport.generatePurchaseRegisterExcel(data);
    const filename = `Purchase_Register_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  // ─── GSTR-3B Summary ──────────────────────────────────────────────────────

  @Get('gstr3b')
  getGSTR3B(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.getGSTR3BSummary(req.user.businessId, month, year);
  }

  // ─── HSN Summary ──────────────────────────────────────────────────────────

  @Get('hsn-summary')
  getHSNSummary(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.getHSNSummary(req.user.businessId, month, year);
  }

  // ─── Pre-flight validation ────────────────────────────────────────────────

  @Get('preflight')
  preflight(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.preflight(req.user.businessId, month, year);
  }

  // ─── GSTR-2B Reconciliation ───────────────────────────────────────────────

  @Post('reconcile-2b')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  reconcile2B(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.gstReports.reconcile2B(req.user.businessId, file, req.user.username);
  }

  @Get('recon-runs')
  listReconRuns(@Req() req: any) {
    return this.gstReports.listReconRuns(req.user.businessId);
  }

  @Get('recon-runs/:id')
  getReconRun(@Req() req: any, @Param('id') id: string) {
    return this.gstReports.getReconRun(req.user.businessId, id);
  }

  @Delete('recon-runs/:id')
  deleteReconRun(@Req() req: any, @Param('id') id: string) {
    return this.gstReports.deleteReconRun(req.user.businessId, id);
  }

  // ─── GSTR-1 JSON ──────────────────────────────────────────────────────────

  @Get('gstr1-json')
  getGSTR1Json(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.getGSTR1Json(req.user.businessId, month, year);
  }

  // ─── Trend Dashboard ──────────────────────────────────────────────────────

  @Get('trend')
  getTrend(
    @Req() req: any,
    @Query('fyYear', ParseIntPipe) fyYear: number,
  ) {
    return this.gstReports.getGstTrend(req.user.businessId, fyYear);
  }

  // ─── Share Link ───────────────────────────────────────────────────────────

  @Post('share-link')
  generateShareLink(
    @Req()  req: any,
    @Body() body: { expiryDays?: number },
  ) {
    return this.gstReports.generateShareLink(req.user.businessId, body.expiryDays ?? 30);
  }
}
