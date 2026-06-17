import { Controller, Get, Put, Post, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private service: NotificationsService,
    private whatsapp: WhatsAppService,
  ) {}

  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.service.getUnreadCount(req.user.businessId);
  }

  @Get()
  getNotifications(
    @Request() req: any,
    @Query('page')     page     = '1',
    @Query('limit')    limit    = '50',
    @Query('type')     type?: string,
    @Query('priority') priority?: string,
    @Query('isRead')   isRead?: string,
  ) {
    const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.service.getNotifications(
      req.user.businessId, Number(page), Number(limit), type, priority, isReadBool,
    );
  }

  @Put('mark-all-read')
  markAllReadAlias(@Request() req: any) {
    return this.service.markAllRead(req.user.businessId);
  }

  @Put('read-all')
  markAllRead(@Request() req: any) {
    return this.service.markAllRead(req.user.businessId);
  }

  @Put(':id/read')
  markRead(@Request() req: any, @Param('id') id: string) {
    return this.service.markRead(req.user.businessId, id, req.user.id);
  }

  // ── WhatsApp credential test ───────────────────────────────────────────────
  // Sends Meta's pre-approved "hello_world" template.
  // Use this to confirm WA_ACCESS_TOKEN + WA_PHONE_NUMBER_ID are correct
  // before submitting custom templates.
  @Roles('SUPER_ADMIN')
  @Post('whatsapp/test')
  testWhatsApp(@Body() body: { phone: string }) {
    return this.whatsapp.sendHelloWorld(body.phone ?? '');
  }
}
