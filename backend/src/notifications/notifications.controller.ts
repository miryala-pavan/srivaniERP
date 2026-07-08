import { Controller, Get, Put, Patch, Post, Delete, Param, Query, Body, UseGuards, UseInterceptors, UploadedFile, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
  testWhatsApp(@Request() req: any, @Body() body: { phone: string }) {
    return this.whatsapp.sendHelloWorld(req.user.businessId, body.phone ?? '');
  }

  // ── WhatsApp template management ───────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/templates')
  listTemplates() {
    return this.whatsapp.listTemplates();
  }

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/templates')
  createTemplate(@Body() body: {
    name: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    language: string;
    bodyText: string;
    headerText?: string;
    footerText?: string;
    buttons?: Array<
      | { type: 'QUICK_REPLY'; text: string }
      | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
      | { type: 'URL'; text: string; url: string }
    >;
  }) {
    return this.whatsapp.createTemplate(body);
  }

  @Roles('SUPER_ADMIN')
  @Delete('whatsapp/templates/:name')
  deleteTemplate(@Param('name') name: string) {
    return this.whatsapp.deleteTemplate(name);
  }

  // ── Send any template to any number ───────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/send-template')
  sendTemplate(@Request() req: any, @Body() body: { phone: string; template: string; language?: string; params?: string[] }) {
    return this.whatsapp.sendTemplateToNumber(
      req.user.businessId,
      body.phone,
      body.template,
      body.language ?? 'en',
      body.params ?? [],
    );
  }

  // ── WhatsApp credential management ────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/credentials')
  getCredentials() {
    return this.whatsapp.getCredentials();
  }

  @Roles('SUPER_ADMIN')
  @Patch('whatsapp/credentials')
  saveCredentials(
    @Request() req: any,
    @Body() body: { token?: string; phoneId?: string; wabaId?: string; storeNum?: string },
  ) {
    return this.whatsapp.saveCredentials(req.user.businessId, body);
  }

  // ── WhatsApp message log ───────────────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/messages')
  listWhatsAppMessages(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('direction') direction?: 'OUTBOUND' | 'INBOUND',
    @Query('status') status?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
  ) {
    return this.whatsapp.listMessages(req.user.businessId, Number(page), Number(limit), direction, status);
  }

  // ── WhatsApp chat inbox ────────────────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/conversations')
  listConversations(@Request() req: any) {
    return this.whatsapp.listConversations(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/conversations/:phone/messages')
  getConversationMessages(
    @Request() req: any,
    @Param('phone') phone: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.whatsapp.getConversationMessages(req.user.businessId, phone, Number(page), Number(limit));
  }

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/conversations/:phone/window')
  getSessionWindow(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.getSessionWindowStatus(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/conversations/:phone/reply')
  sendReply(@Request() req: any, @Param('phone') phone: string, @Body() body: { text: string }) {
    return this.whatsapp.sendReply(req.user.businessId, phone, body.text ?? '');
  }

  @Roles('SUPER_ADMIN')
  @Patch('whatsapp/conversations/:phone/read')
  markConversationRead(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.markConversationRead(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/conversations/:phone/contact')
  getContactInfo(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.getContactInfo(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN')
  @Patch('whatsapp/conversations/:phone/contact')
  saveContactName(@Request() req: any, @Param('phone') phone: string, @Body() body: { name: string }) {
    return this.whatsapp.saveContactName(req.user.businessId, phone, body.name ?? '');
  }

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/conversations/:phone/send-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  sendImageReply(
    @Request() req: any,
    @Param('phone') phone: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) return { ok: false, reason: 'No file uploaded' };
    return this.whatsapp.sendImageReply(req.user.businessId, phone, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
    });
  }

  // JWT-protected but not @Roles-gated the same way images are served for an
  // <img> tag via a blob fetch (with the Authorization header) from the
  // frontend, not a bare <img src>, since Meta's media URLs require the
  // bearer token and can't be hotlinked directly.
  @Roles('SUPER_ADMIN')
  @Get('whatsapp/media/:mediaId')
  async getMedia(@Param('mediaId') mediaId: string, @Res() res: Response) {
    const media = await this.whatsapp.getMediaBuffer(mediaId);
    if (!media) { res.status(404).send(); return; }
    res.set({ 'Content-Type': media.mimeType, 'Cache-Control': 'private, max-age=86400' });
    res.send(media.buffer);
  }

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/register-number')
  registerPhoneNumber(@Body() body: { pin: string }) {
    return this.whatsapp.registerPhoneNumber(body.pin ?? '');
  }

  // ── Campaigns ────────────────────────────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/campaigns/birthdays-today')
  getTodaysBirthdays(@Request() req: any) {
    return this.whatsapp.getTodaysBirthdays(req.user.businessId);
  }

  // ── Auto-reply settings ─────────────────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/autoreply')
  getAutoReplySettings(@Request() req: any) {
    return this.whatsapp.getAutoReplySettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Patch('whatsapp/autoreply')
  updateAutoReplySettings(@Request() req: any, @Body() body: { enabled?: boolean; storeHours?: string }) {
    return this.whatsapp.updateAutoReplySettings(req.user.businessId, body);
  }
}
