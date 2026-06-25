import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/guards/jwt-auth.guard';
import { RolesGuard }      from '../auth/guards/roles.guard';
import { Roles }           from '../auth/decorators/roles.decorator';
import { GstHealthService } from './gst-health.service';

@Controller('reports/gst-health')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA')
export class GstHealthController {
  constructor(private gstHealth: GstHealthService) {}

  @Get()
  getHealth(@Req() req: any) {
    return this.gstHealth.runHealthChecks(req.user.businessId);
  }

  // Runs checks AND pushes notifications to the bell for CRITICAL/HIGH issues
  @Post('notify')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  runAndNotify(@Req() req: any) {
    return this.gstHealth.runAndNotify(req.user.businessId);
  }
}
