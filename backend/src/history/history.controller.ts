import { Controller, Get, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkSendHistoryDto } from './dto/bulk-send-history.dto';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
  'FLOOR_SUPERVISOR', 'SALES_REP', 'CASHIER',
];

@Controller('history')
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Get('customers/blast-list')
  getBlastList(@Query() q: any, @Request() req: any) {
    return this.historyService.getBlastList(req.user.businessId, {
      letter:  q.letter  || undefined,
      search:  q.search  || undefined,
      status:  q.status  || 'all',
      sort:    q.sort    || 'name_asc',
      page:    q.page    ? parseInt(q.page,  10) : 1,
      limit:   q.limit   ? parseInt(q.limit, 10) : 50,
    });
  }

  // Public — no auth — the unguessable token IS the access control
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.historyService.getByToken(token);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post('customers/:id/preview')
  ensurePreviewToken(@Param('id') id: string, @Request() req: any) {
    return this.historyService.ensurePreviewToken(id, req.user.businessId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post('customers/:id/send')
  sendHistoryLink(@Param('id') id: string, @Request() req: any) {
    return this.historyService.sendHistoryLink(id, req.user.businessId);
  }

  // Runs the send loop server-side (not in the browser tab) so a closed tab
  // or dropped connection can't silently strand part of the batch, and gives
  // per-customer detail instead of just an ok/fail count.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post('customers/bulk-send')
  sendHistoryLinkBulk(@Body() dto: BulkSendHistoryDto, @Request() req: any) {
    return this.historyService.sendHistoryLinkBulk(dto.customerIds, req.user.businessId);
  }

  /** One-time: submit svn_history_link template to Meta for approval. SUPER_ADMIN only. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('register-template')
  registerTemplate(@Request() req: any) {
    return this.historyService.registerHistoryTemplate(req.user.businessId);
  }
}
