import {
  Controller, Get, Query, Req, Res, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard }    from '../auth/guards/jwt-auth.guard';
import { RolesGuard }      from '../auth/guards/roles.guard';
import { Roles }           from '../auth/decorators/roles.decorator';
import { GstReportsService } from './gst-reports.service';
import { ExcelExportService } from './excel-export.service';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

@Controller('reports/gst')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
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

  // ─── GSTR-1 JSON ──────────────────────────────────────────────────────────

  @Get('gstr1-json')
  getGSTR1Json(
    @Req() req: any,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    return this.gstReports.getGSTR1Json(req.user.businessId, month, year);
  }
}
