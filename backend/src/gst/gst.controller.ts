import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GstService } from './gst.service';

const GST_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...GST_ROLES)
@Controller('gst')
export class GstController {
  constructor(private readonly gst: GstService) {}

  @Get('help')
  help() {
    return {
      module: 'gst',
      endpoints: [
        'POST /api/gst/compute/:period — Compute GSTR-1 and GSTR-3B for YYYY-MM',
        'GET  /api/gst/returns — List all GST returns',
        'GET  /api/gst/returns/:id — Get a specific return',
        'POST /api/gst/returns/:id/file — Mark return as FILED',
        'GET  /api/gst/returns/:id/export/json — Export GSTR-1 JSON for portal',
        'GET  /api/gst/itc-ledger — View ITC ledger (optional ?taxPeriod=YYYY-MM)',
        'POST /api/gst/itc-ledger — Add a manual ITC entry',
        'POST /api/gst/challans — Record a GST challan payment',
        'GET  /api/gst/challans — List all challans',
        'GET  /api/gst/summary — GST dashboard',
        'GET  /api/gst/gstin/validate/:gstin — Validate GSTIN format',
      ],
      caNote:
        'GSTR-1 due 11th; GSTR-3B due 20th of following month. Enter all purchase invoices before computing GSTR-3B.',
    };
  }

  @Post('compute/:period')
  compute(@Param('period') period: string, @Request() req: any) {
    return this.gst.compute(req.user.businessId, period);
  }

  @Get('returns')
  listReturns(@Request() req: any) {
    return this.gst.listReturns(req.user.businessId);
  }

  @Get('returns/:id')
  getReturn(@Param('id') id: string, @Request() req: any) {
    return this.gst.getReturn(id, req.user.businessId);
  }

  @Post('returns/:id/file')
  markFiled(@Param('id') id: string, @Request() req: any) {
    return this.gst.markFiled(id, req.user.businessId);
  }

  @Get('returns/:id/export/json')
  async exportJson(@Param('id') id: string, @Request() req: any) {
    const r = await this.gst.getReturn(id, req.user.businessId);
    return this.gst.exportGstr1Json(r);
  }

  @Get('itc-ledger')
  getItcLedger(@Request() req: any, @Query('taxPeriod') taxPeriod?: string) {
    return this.gst.getItcLedger(req.user.businessId, taxPeriod);
  }

  @Post('itc-ledger')
  addItcEntry(
    @Request() req: any,
    @Body()
    body: {
      taxPeriod: string;
      sourceType: string;
      sourceId: string;
      cgst: number;
      sgst: number;
      igst: number;
    },
  ) {
    return this.gst.addItcEntry(
      req.user.businessId,
      body.taxPeriod,
      body.sourceType,
      body.sourceId,
      body.cgst,
      body.sgst,
      body.igst,
    );
  }

  @Post('challans')
  recordChallan(
    @Request() req: any,
    @Body()
    body: {
      taxPeriod: string;
      cgstPaid: number;
      sgstPaid: number;
      igstPaid: number;
      interest?: number;
      lateFee?: number;
      cpin?: string;
      bsrCode?: string;
    },
  ) {
    return this.gst.recordChallan(req.user.businessId, body.taxPeriod, body);
  }

  @Get('challans')
  listChallans(@Request() req: any) {
    return this.gst.listChallans(req.user.businessId);
  }

  @Get('summary')
  getSummary(@Request() req: any) {
    return this.gst.getSummary(req.user.businessId);
  }

  @Get('gstin/validate/:gstin')
  validateGstin(@Param('gstin') gstin: string) {
    return this.gst.validateGstin(gstin);
  }
}
