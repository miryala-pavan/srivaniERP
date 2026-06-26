import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/guards/jwt-auth.guard';
import { RolesGuard }      from '../auth/guards/roles.guard';
import { Roles }           from '../auth/decorators/roles.decorator';
import { GstHealthService } from './gst-health.service';

function parseFrom(from?: string): Date | undefined {
  if (!from) return undefined;
  const d = new Date(from);
  return isNaN(d.getTime()) ? undefined : d;
}

@Controller('reports/gst-health')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA')
export class GstHealthController {
  constructor(private gstHealth: GstHealthService) {}

  @Get()
  getHealth(@Req() req: any, @Query('from') from?: string) {
    return this.gstHealth.runHealthChecks(req.user.businessId, parseFrom(from));
  }

  @Post('notify')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  runAndNotify(@Req() req: any, @Query('from') from?: string) {
    return this.gstHealth.runAndNotify(req.user.businessId, parseFrom(from));
  }
}
