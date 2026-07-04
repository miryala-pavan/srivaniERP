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
import { TdsService } from './tds.service';
import type { TdsComputationInput } from './tds.service';

@UseGuards(JwtAuthGuard)
@Controller('api/tds')
export class TdsController {
  constructor(private readonly tds: TdsService) {}

  @Get('help')
  help() {
    return {
      module: 'tds',
      endpoints: [
        'POST /api/tds/compute — Compute TDS for a transaction',
        'GET  /api/tds/ledger — TDS deduction ledger (optional ?financialYear=&section=)',
        'GET  /api/tds/ledger/:id — Single TDS entry',
        'GET  /api/tds/summary — TDS dashboard: deducted, deposited, outstanding',
        'POST /api/tds/challans — Record TDS challan deposit',
        'GET  /api/tds/challans — List challans (optional ?financialYear=)',
        'GET  /api/tds/form-26q — 26Q data for ?financialYear=2025-26&quarter=Q2',
        'GET  /api/tds/sections — List TDS sections from Rule Engine',
      ],
      caNote:
        'TDS deducted = earlier of payment or booking date. Deposit by 7th of next month.',
    };
  }

  @Post('compute')
  computeTds(@Request() req: any, @Body() body: TdsComputationInput) {
    return this.tds.computeTds(req.user.businessId, body);
  }

  @Get('ledger')
  getLedger(
    @Request() req: any,
    @Query('financialYear') financialYear?: string,
    @Query('section') section?: string,
  ) {
    return this.tds.getLedger(req.user.businessId, financialYear, section);
  }

  @Get('ledger/:id')
  getLedgerEntry(@Param('id') id: string) {
    return this.tds.getLedgerEntry(id);
  }

  @Post('challans')
  recordChallan(
    @Request() req: any,
    @Body()
    body: {
      financialYear: string;
      quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
      section: string;
      amountDeducted: number;
      amountDeposited: number;
      interest?: number;
      lateFee?: number;
      bsrCode?: string;
      challanSerial?: string;
    },
  ) {
    return this.tds.recordChallan(req.user.businessId, body);
  }

  @Get('challans')
  listChallans(@Request() req: any, @Query('financialYear') financialYear?: string) {
    return this.tds.listChallans(req.user.businessId, financialYear);
  }

  @Get('summary')
  getSummary(@Request() req: any) {
    return this.tds.getSummary(req.user.businessId);
  }

  @Get('form-26q')
  getForm26Q(
    @Request() req: any,
    @Query('financialYear') financialYear: string,
    @Query('quarter') quarter: string,
  ) {
    return this.tds.getForm26QData(req.user.businessId, financialYear, quarter);
  }

  @Get('sections')
  listSections(@Request() req: any) {
    return this.tds.listSections(req.user.businessId);
  }
}
