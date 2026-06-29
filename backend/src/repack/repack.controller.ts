import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { RepackService } from './repack.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('repack')
export class RepackController {
  constructor(private readonly repackService: RepackService) {}

  @Get('search/source')
  searchSource(@Request() req: any, @Query('q') q: string) {
    return this.repackService.searchSourcePlus(req.user.businessId, q ?? '');
  }

  @Get('search/target')
  searchTarget(
    @Request() req: any,
    @Query('q') q: string,
    @Query('exclude') exclude: string,
  ) {
    return this.repackService.searchTargetPlus(req.user.businessId, q ?? '', exclude ?? '');
  }

  @Get('bundles')
  getBundles(@Request() req: any) {
    return this.repackService.getAllBundles(req.user.businessId);
  }

  @Patch('bundles/:id')
  updateBundle(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { type?: 'FIXED' | 'VARIABLE'; bulkWeightG?: number; unitWeightG?: number; conversionQty?: number; notes?: string },
  ) {
    return this.repackService.updateBundle(req.user.businessId, id, body);
  }

  @Post('sessions')
  commitSession(
    @Request() req: any,
    @Body() body: {
      sourcePluId: string;
      sourceQty: number;
      type: 'FIXED' | 'VARIABLE';
      lines: { targetPluId: string; qty: number; unitWeightG?: number; notes?: string }[];
      wastageG?: number;
      wastageNotes?: string;
      notes?: string;
    },
  ) {
    return this.repackService.commitSession(req.user.businessId, {
      ...body,
      userId: req.user.id,
      userName: req.user.fullName,
    });
  }

  @Get('sessions')
  getSessions(
    @Request() req: any,
    @Query('sourcePluId') sourcePluId?: string,
    @Query('take') take?: string,
  ) {
    return this.repackService.getSessions(req.user.businessId, sourcePluId, take ? parseInt(take) : 50);
  }

  @Get('wastage-report')
  getWastageReport(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.repackService.getWastageReport(req.user.businessId, from, to);
  }
}
