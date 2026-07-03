import {
  Controller, Get, Query, Req, Res, ParseIntPipe,
  UnauthorizedException, ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GstReportsService } from './gst-reports.service';
import { ExcelExportService } from './excel-export.service';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Simple in-process rate limiter — 20 requests per IP per minute on public endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string) {
  const now  = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }
  entry.count++;
  if (entry.count > 20) {
    throw new ServiceUnavailableException('Too many requests — try again in a minute');
  }
}

// No JWT auth guards — token validated per-request via HMAC
@Controller('public/gst')
export class GstPublicController {
  constructor(
    private gstReports:  GstReportsService,
    private excelExport: ExcelExportService,
  ) {}

  private getBid(token: string, req: Request): string {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
    checkRateLimit(ip);
    // verifyShareToken already throws UnauthorizedException on failure
    return this.gstReports.verifyShareToken(token);
  }

  @Get('summary')
  async getSummary(
    @Req()  req:   Request,
    @Query('token')                      token: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year',  ParseIntPipe) year:  number,
  ) {
    const businessId = this.getBid(token, req);
    const [r3b, rInward] = await Promise.allSettled([
      this.gstReports.getGSTR3BSummary(businessId, month, year),
      this.gstReports.getInwardSuppliesReport(businessId, month, year),
    ]);
    return {
      gstr3b: r3b.status     === 'fulfilled' ? r3b.value     : null,
      inward: rInward.status === 'fulfilled' ? rInward.value : null,
    };
  }

  @Get('inward-excel')
  async getInwardExcel(
    @Req()  req:   Request,
    @Query('token')                       token: string,
    @Query('month', ParseIntPipe) month:  number,
    @Query('year',  ParseIntPipe) year:   number,
    @Res() res: Response,
  ) {
    const businessId = this.getBid(token, req);
    const data       = await this.gstReports.getInwardSuppliesReport(businessId, month, year);
    if (!data.rows.length) {
      res.status(404).json({ message: 'No inward supply data for this period' });
      return;
    }
    const buf      = this.excelExport.generateInwardSuppliesExcel(data);
    const filename = `GSTR2_Inward_Supplies_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  @Get('purchase-excel')
  async getPurchaseExcel(
    @Req()  req:   Request,
    @Query('token')                       token: string,
    @Query('month', ParseIntPipe) month:  number,
    @Query('year',  ParseIntPipe) year:   number,
    @Res() res: Response,
  ) {
    const businessId = this.getBid(token, req);
    const data       = await this.gstReports.getPurchaseRegister(businessId, month, year);
    if (!data.purchases.length) {
      res.status(404).json({ message: 'No purchase data for this period' });
      return;
    }
    const buf      = this.excelExport.generatePurchaseRegisterExcel(data);
    const filename = `Purchase_Register_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }
}
