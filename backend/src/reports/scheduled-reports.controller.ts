import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ScheduledReportsService, REPORT_TYPES } from './scheduled-reports.service';
import type { ScheduleInput } from './scheduled-reports.service';

const MANAGER_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGER_ROLES)
@Controller('reports/schedules')
export class ScheduledReportsController {
  constructor(private readonly schedules: ScheduledReportsService) {}

  @Get('types')
  types() {
    return {
      reportTypes: REPORT_TYPES,
      frequencies: ['DAILY', 'WEEKLY', 'MONTHLY'],
      channels: ['WHATSAPP', 'EMAIL'],
      note: 'DAILY sends yesterday’s numbers; WEEKLY the last 7 days; MONTHLY the previous calendar month. Times are IST.',
    };
  }

  @Get()
  list(@Request() req: any) {
    return this.schedules.list(req.user.businessId);
  }

  @Post()
  create(@Request() req: any, @Body() body: ScheduleInput) {
    return this.schedules.create(req.user.businessId, body, req.user.username ?? req.user.sub);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: Partial<ScheduleInput> & { isActive?: boolean }) {
    return this.schedules.update(req.user.businessId, id, body);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.schedules.remove(req.user.businessId, id);
  }

  @Post(':id/run-now')
  runNow(@Request() req: any, @Param('id') id: string) {
    return this.schedules.runNow(req.user.businessId, id);
  }
}
