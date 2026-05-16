import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { DayClosureService } from './day-closure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('day-closure')
export class DayClosureController {
  constructor(private service: DayClosureService) {}

  @Get('today')
  getToday(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.service.getToday(req.user.businessId, branchId);
  }

  @Get('yesterday-status')
  getYesterdayStatus(@Request() req: any) {
    return this.service.getYesterdayStatus(req.user.businessId);
  }

  @Get('history')
  getHistory(@Request() req: any) {
    return this.service.getHistory(req.user.businessId);
  }

  @Post('open')
  open(@Request() req: any) {
    const u = req.user;
    return this.service.open(u.businessId, u.id ?? u.userId, u.fullName ?? u.username ?? 'Manager');
  }

  @Post('force-close-shifts')
  forceCloseShifts(@Request() req: any) {
    return this.service.forceCloseShifts(req.user.businessId, req.user.fullName ?? req.user.username ?? 'Manager');
  }

  @Post('close')
  close(
    @Request() req: any,
    @Body('actualCash') actualCash: number,
    @Body('notes')      notes?: string,
  ) {
    return this.service.close(req.user.businessId, actualCash, notes, req.user.id);
  }
}
