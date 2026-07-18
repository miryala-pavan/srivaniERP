import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
  'FLOOR_SUPERVISOR', 'SALES_REP', 'CASHIER',
];

@Controller('history')
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  // Public — no auth — the unguessable token IS the access control
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.historyService.getByToken(token);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post('customers/:id/send')
  sendHistoryLink(@Param('id') id: string, @Request() req: any) {
    return this.historyService.sendHistoryLink(id, req.user.businessId);
  }
}
