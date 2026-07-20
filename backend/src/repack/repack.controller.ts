import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { RepackService } from './repack.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('repack')
export class RepackController {
  constructor(private readonly repackService: RepackService) {}

  @Get('search/any')
  searchAny(@Request() req: any, @Query('q') q: string) {
    return this.repackService.searchAnyPlu(req.user.businessId, q ?? '');
  }

  @Get('search/target')
  searchTarget(
    @Request() req: any,
    @Query('q') q: string,
    @Query('exclude') exclude: string,
  ) {
    return this.repackService.searchTargetPlus(req.user.businessId, q ?? '', exclude ?? '');
  }

  @Get('recent-pairs')
  getRecentPairs(@Request() req: any) {
    return this.repackService.getRecentPairs(req.user.businessId);
  }

  @Post('sessions')
  commitSession(
    @Request() req: any,
    @Body() body: {
      sourcePluId: string;
      sourceQty: number;
      lines: { targetPluId: string; qty: number; notes?: string }[];
      wastageNotes?: string;
      notes?: string;
    },
  ) {
    return this.repackService.commitSession(req.user.businessId, {
      ...body,
      userId:   req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
    });
  }

  @Post('sessions/:id/reverse')
  reverseSession(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.repackService.reverseSession(req.user.businessId, id, {
      userId:   req.user.id,
      userName: req.user.fullName,
      userRole: req.user.role,
      reason:   body?.reason,
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
