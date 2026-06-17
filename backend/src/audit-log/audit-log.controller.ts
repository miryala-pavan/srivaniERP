import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

const VIEW_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...VIEW_ROLES)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  list(
    @Request() req: any,
    @Query('entity')   entity?: string,
    @Query('userId')   userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?: string,
    @Query('search')   search?: string,
    @Query('take')     take?: string,
    @Query('skip')     skip?: string,
  ) {
    return this.service.list(req.user.businessId, {
      entity,
      userId,
      dateFrom,
      dateTo,
      search,
      take: take ? Number(take) : 100,
      skip: skip ? Number(skip) : 0,
    });
  }
}
