import {
  Controller, Get, Query, Res, ParseIntPipe, UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { GstReportsService } from './gst-reports.service';
import { ExcelExportService } from './excel-export.service';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// No auth guards — token is validated inside each method
@Controller('public/gst')
export class GstPublicController {
  constructor(
    private gstReports:  GstReportsService,
    private excelExport: ExcelExportService,
  ) {}

  private getBid(token: string): string {
    try {
      return this.gstReports.verifyShareToken(token);
    } catch (e: any) {
      throw new UnauthorizedException(e?.message ?? 'Invalid or expired share link');
    }
  }

  @Get('summary')
  async getSummary(
    @Query('token')                      token: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    const businessId = this.getBid(token);
    const [gstr3b, purchases, inward] = await Promise.all([
      this.gstReports.getGSTR3BSummary(businessId, month, year),
      this.gstReports.getPurchaseRegister(businessId, month, year),
      this.gstReports.getInwardSuppliesReport(businessId, month, year),
    ]);
    return { gstr3b, purchases, inward };
  }

  @Get('inward-excel')
  async getInwardExcel(
    @Query('token')                       token: string,
    @Query('month', ParseIntPipe) month:  number,
    @Query('year',  ParseIntPipe) year:   number,
    @Res() res: Response,
  ) {
    const businessId = this.getBid(token);
    const data       = await this.gstReports.getInwardSuppliesReport(businessId, month, year);
    const buf        = this.excelExport.generateInwardSuppliesExcel(data);
    const filename   = `GSTR2_Inward_Supplies_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  @Get('purchase-excel')
  async getPurchaseExcel(
    @Query('token')                       token: string,
    @Query('month', ParseIntPipe) month:  number,
    @Query('year',  ParseIntPipe) year:   number,
    @Res() res: Response,
  ) {
    const businessId = this.getBid(token);
    const data       = await this.gstReports.getPurchaseRegister(businessId, month, year);
    const buf        = this.excelExport.generatePurchaseRegisterExcel(data);
    const filename   = `Purchase_Register_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }
}
