import { Controller, Get, Put, Patch, Post, Delete, Param, Query, Body, UseGuards, UseInterceptors, UploadedFile, Request, Res } from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { NotificationsService } from './notifications.service';
import { WhatsAppService } from './whatsapp.service';
import { InternalNoteService } from './internal-note.service';
import { CreateInternalNoteDto } from './dto/create-internal-note.dto';
import { CannedReplyService } from './canned-reply.service';
import { CreateCannedReplyDto } from './dto/create-canned-reply.dto';
import { UpdateCannedReplyDto } from './dto/update-canned-reply.dto';
import { PushService } from './push.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { SocialMessagingService } from './social-messaging.service';
import { CreateCommentCampaignDto } from './dto/create-comment-campaign.dto';
import { BulkSendTemplateDto } from './dto/bulk-send-template.dto';
import { UpdateCommentCampaignDto } from './dto/update-comment-campaign.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private service: NotificationsService,
    private whatsapp: WhatsAppService,
    private internalNotes: InternalNoteService,
    private cannedReplies: CannedReplyService,
    private push: PushService,
    private social: SocialMessagingService,
  ) {}

  // ── Web push subscriptions ─────────────────────────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('push/subscribe')
  subscribePush(@Request() req: any, @Body() dto: SubscribePushDto) {
    return this.push.subscribe(req.user.businessId, req.user.userId, dto);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('push/unsubscribe')
  unsubscribePush(@Request() req: any, @Body('endpoint') endpoint: string) {
    return this.push.unsubscribe(req.user.businessId, endpoint);
  }

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

  // Read-only, unlike create/delete below — a New Chat to a number with no
  // open session needs an approved template, so BRANCH_MANAGER (who can use
  // the inbox but not manage templates) still needs to see what's available.
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
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

  /** One-time: subscribe Meta App to this WABA so webhook messages/statuses are delivered. */
  @Roles('SUPER_ADMIN')
  @Post('whatsapp/subscribe-app')
  subscribeApp() {
    return this.whatsapp.subscribeApp();
  }

  // ── Send any template to any number ───────────────────────────────────────
  // Powers both Campaigns (SUPER_ADMIN-only tab) and the chat inbox's New
  // Chat flow (BRANCH_MANAGER too) — the only way to message a number with
  // no open session, since Meta requires an approved template in that case.

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/send-template')
  sendTemplate(@Request() req: any, @Body() body: { phone: string; template: string; language?: string; params?: string[]; urlButtonParam?: string }) {
    return this.whatsapp.sendTemplateToNumber(
      req.user.businessId,
      body.phone,
      body.template,
      body.language ?? 'en',
      body.params ?? [],
      body.urlButtonParam,
    );
  }

  // ── WhatsApp credential management ────────────────────────────────────────

  // Read-only, unlike the PATCH below — returns a connected/not-connected
  // flag plus non-secret ids (phoneId/wabaId), never the actual access
  // token, so BRANCH_MANAGER can see whether the inbox they're using is
  // actually connected without being able to change or view credentials.
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
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

  // ── Saved phone number presets ──────────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/phone-numbers')
  listPhoneNumbers(@Request() req: any) {
    return this.whatsapp.listPhoneNumbers(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/phone-numbers')
  savePhoneNumber(@Request() req: any, @Body() body: {
    id?: string; label: string; accessToken?: string; phoneNumberId: string; businessAccountId: string; storeNotifyNumber?: string;
  }) {
    return this.whatsapp.savePhoneNumber(req.user.businessId, body);
  }

  @Roles('SUPER_ADMIN')
  @Delete('whatsapp/phone-numbers/:id')
  deletePhoneNumber(@Request() req: any, @Param('id') id: string) {
    return this.whatsapp.deletePhoneNumber(req.user.businessId, id);
  }

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/phone-numbers/:id/activate')
  activatePhoneNumber(@Request() req: any, @Param('id') id: string) {
    return this.whatsapp.activatePhoneNumber(req.user.businessId, id);
  }

  // ── WhatsApp message log ───────────────────────────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
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

  // Deliberately before the more specific /conversations routes below so it
  // never risks matching :phone param routes — Nest resolves in declaration
  // order and 'unread-count' would otherwise need to be excluded from any
  // :phone pattern.
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations/unread-count')
  getWhatsAppUnreadCount(@Request() req: any) {
    return this.whatsapp.getUnreadCount(req.user.businessId).then(count => ({ count }));
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations')
  listConversations(@Request() req: any) {
    return this.whatsapp.listConversations(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations/search')
  searchMessages(@Request() req: any, @Query('q') q: string) {
    return this.whatsapp.searchMessages(req.user.businessId, q ?? '');
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations/:phone/messages')
  getConversationMessages(
    @Request() req: any,
    @Param('phone') phone: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.whatsapp.getConversationMessages(req.user.businessId, phone, Number(page), Number(limit));
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations/:phone/window')
  getSessionWindow(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.getSessionWindowStatus(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/conversations/:phone/reply')
  sendReply(@Request() req: any, @Param('phone') phone: string, @Body() body: { text: string }) {
    return this.whatsapp.sendReply(req.user.businessId, phone, body.text ?? '');
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Patch('whatsapp/conversations/:phone/read')
  markConversationRead(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.markConversationRead(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations/:phone/meta')
  getConversationMeta(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.getConversationMeta(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Patch('whatsapp/conversations/:phone/meta')
  updateConversationMeta(@Request() req: any, @Param('phone') phone: string, @Body() body: {
    status?: 'OPEN' | 'RESOLVED'; pinned?: boolean; labels?: string[]; assignedToUserId?: string | null;
    snoozedUntil?: string | null;
  }) {
    return this.whatsapp.updateConversationMeta(req.user.businessId, phone, body);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations/:phone/contact')
  getContactInfo(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.getContactInfo(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Patch('whatsapp/conversations/:phone/contact')
  saveContactName(@Request() req: any, @Param('phone') phone: string, @Body() body: { name: string }) {
    return this.whatsapp.saveContactName(req.user.businessId, phone, body.name ?? '');
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
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

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/conversations/:phone/send-document')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
  }))
  sendDocumentReply(
    @Request() req: any,
    @Param('phone') phone: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) return { ok: false, reason: 'No file uploaded' };
    return this.whatsapp.sendDocumentReply(req.user.businessId, phone, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
    });
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/conversations/:phone/react')
  sendReaction(@Request() req: any, @Param('phone') phone: string, @Body() body: { messageId: string; emoji: string }) {
    return this.whatsapp.sendReaction(req.user.businessId, phone, body.messageId, body.emoji ?? '');
  }

  // JWT-protected but not @Roles-gated the same way images are served for an
  // <img> tag via a blob fetch (with the Authorization header) from the
  // frontend, not a bare <img src>, since Meta's media URLs require the
  // bearer token and can't be hotlinked directly.
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
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

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/business-profile')
  getBusinessProfile() {
    return this.whatsapp.getBusinessProfile();
  }

  @Roles('SUPER_ADMIN')
  @Patch('whatsapp/business-profile')
  updateBusinessProfile(@Body() body: { about?: string; address?: string; description?: string; email?: string; websites?: string[]; vertical?: string }) {
    return this.whatsapp.updateBusinessProfile(body);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/conversations/:phone/typing')
  sendTypingIndicator(@Request() req: any, @Param('phone') phone: string) {
    return this.whatsapp.sendTypingIndicator(req.user.businessId, phone);
  }

  // ── Internal notes (staff-only, never sent to the customer) ───────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/conversations/:phone/notes')
  listNotes(@Request() req: any, @Param('phone') phone: string) {
    return this.internalNotes.list(req.user.businessId, phone);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/conversations/:phone/notes')
  createNote(@Request() req: any, @Param('phone') phone: string, @Body() dto: CreateInternalNoteDto) {
    return this.internalNotes.create(req.user.businessId, phone, req.user.userId, dto.body);
  }

  // ── Canned / quick replies ─────────────────────────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('whatsapp/canned-replies')
  listCannedReplies(@Request() req: any) {
    return this.cannedReplies.list(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/canned-replies')
  createCannedReply(@Request() req: any, @Body() dto: CreateCannedReplyDto) {
    return this.cannedReplies.create(req.user.businessId, dto);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Patch('whatsapp/canned-replies/:id')
  updateCannedReply(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCannedReplyDto) {
    return this.cannedReplies.update(req.user.businessId, id, dto);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Delete('whatsapp/canned-replies/:id')
  deleteCannedReply(@Request() req: any, @Param('id') id: string) {
    return this.cannedReplies.delete(req.user.businessId, id);
  }

  // ── Campaigns ────────────────────────────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/campaigns/birthdays-today')
  getTodaysBirthdays(@Request() req: any) {
    return this.whatsapp.getTodaysBirthdays(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/campaigns/segments')
  getCampaignSegments(@Request() req: any) {
    return this.whatsapp.getCampaignSegments(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Post('whatsapp/campaigns/send')
  sendCampaign(@Request() req: any, @Body() body: { segmentId: string; template: string; language: string; params: string[] }) {
    return this.whatsapp.sendCampaign(req.user.businessId, body.segmentId, body.template, body.language, body.params ?? []);
  }

  // Not SUPER_ADMIN-only like sendCampaign above — this is triggered from
  // the Contacts tab, which BRANCH_MANAGER can already see and use.
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/campaigns/send-bulk')
  sendBulkTemplate(@Request() req: any, @Body() body: BulkSendTemplateDto) {
    return this.whatsapp.sendBulkTemplate(req.user.businessId, body.ids, body.template, body.language, body.params ?? [], {
      userId: req.user.userId,
      userName: req.user.fullName ?? req.user.username ?? 'Unknown',
      userRole: req.user.role,
      businessId: req.user.businessId,
    });
  }

  // ── Customer notification shortcuts (triggered from Customer 360) ───────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/send-credit-reminder')
  sendCreditReminder(@Request() req: any, @Body() body: { phone: string; customerName: string; amountDue: number }) {
    return this.whatsapp.sendCreditReminder(req.user.businessId, { customerPhone: body.phone, customerName: body.customerName, amountDue: body.amountDue });
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/send-reorder-reminder')
  sendReorderReminder(@Request() req: any, @Body() body: { phone: string; customerName: string }) {
    return this.whatsapp.sendReorderReminder(req.user.businessId, { customerPhone: body.phone, customerName: body.customerName });
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('whatsapp/send-welcome')
  sendWelcomeCustomer(@Request() req: any, @Body() body: { phone: string; customerName: string }) {
    return this.whatsapp.sendWelcomeCustomer(req.user.businessId, { customerPhone: body.phone, customerName: body.customerName });
  }

  // ── Auto-reply settings ─────────────────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/autoreply')
  getAutoReplySettings(@Request() req: any) {
    return this.whatsapp.getAutoReplySettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Patch('whatsapp/autoreply')
  updateAutoReplySettings(@Request() req: any, @Body() body: {
    enabled?: boolean; storeHours?: string;
    locationLat?: string; locationLng?: string; locationName?: string; locationAddr?: string;
  }) {
    return this.whatsapp.updateAutoReplySettings(req.user.businessId, body);
  }

  // ── Post-delivery feedback settings ─────────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('whatsapp/feedback-settings')
  getFeedbackSettings(@Request() req: any) {
    return this.whatsapp.getFeedbackSettings(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Patch('whatsapp/feedback-settings')
  updateFeedbackSettings(@Request() req: any, @Body() body: { googleReviewUrl?: string }) {
    return this.whatsapp.updateFeedbackSettings(req.user.businessId, body);
  }

  // ── Facebook / Instagram: credentials ───────────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('social/credentials')
  getSocialCredentials() {
    return this.social.getCredentials();
  }

  @Roles('SUPER_ADMIN')
  @Patch('social/credentials')
  saveSocialCredentials(@Request() req: any, @Body() body: { pageToken?: string; pageId?: string; igId?: string }) {
    return this.social.saveCredentials(req.user.businessId, body);
  }

  // ── Facebook / Instagram: saved Page presets ────────────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('social/page-accounts')
  listPageAccounts(@Request() req: any) {
    return this.social.listPageAccounts(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Post('social/page-accounts')
  savePageAccount(@Request() req: any, @Body() body: {
    id?: string; label: string; pageAccessToken?: string; pageId: string; igBusinessAccountId?: string;
  }) {
    return this.social.savePageAccount(req.user.businessId, body);
  }

  @Roles('SUPER_ADMIN')
  @Delete('social/page-accounts/:id')
  deletePageAccount(@Request() req: any, @Param('id') id: string) {
    return this.social.deletePageAccount(req.user.businessId, id);
  }

  @Roles('SUPER_ADMIN')
  @Post('social/page-accounts/:id/activate')
  activatePageAccount(@Request() req: any, @Param('id') id: string) {
    return this.social.activatePageAccount(req.user.businessId, id);
  }

  // ── Facebook / Instagram: comment-to-DM campaigns ───────────────────────────

  @Roles('SUPER_ADMIN')
  @Get('social/comment-campaigns')
  listCommentCampaigns(@Request() req: any) {
    return this.social.listCommentCampaigns(req.user.businessId);
  }

  @Roles('SUPER_ADMIN')
  @Post('social/comment-campaigns')
  createCommentCampaign(@Request() req: any, @Body() dto: CreateCommentCampaignDto) {
    return this.social.createCommentCampaign(req.user.businessId, dto);
  }

  @Roles('SUPER_ADMIN')
  @Patch('social/comment-campaigns/:id')
  updateCommentCampaign(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCommentCampaignDto) {
    return this.social.updateCommentCampaign(req.user.businessId, id, dto);
  }

  @Roles('SUPER_ADMIN')
  @Delete('social/comment-campaigns/:id')
  deleteCommentCampaign(@Request() req: any, @Param('id') id: string) {
    return this.social.deleteCommentCampaign(req.user.businessId, id);
  }

  // ── Facebook / Instagram: inbox ─────────────────────────────────────────────

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('social/conversations/unread-count')
  getSocialUnreadCount(@Request() req: any) {
    return this.social.getUnreadCount(req.user.businessId).then((count) => ({ count }));
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('social/conversations')
  listSocialConversations(@Request() req: any) {
    return this.social.listConversations(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('social/conversations/:channel/:externalUserId/messages')
  getSocialConversationMessages(
    @Request() req: any,
    @Param('channel') channel: 'FACEBOOK' | 'INSTAGRAM',
    @Param('externalUserId') externalUserId: string,
  ) {
    return this.social.getConversationMessages(req.user.businessId, channel, externalUserId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Patch('social/conversations/:channel/:externalUserId/read')
  markSocialConversationRead(
    @Request() req: any,
    @Param('channel') channel: 'FACEBOOK' | 'INSTAGRAM',
    @Param('externalUserId') externalUserId: string,
  ) {
    return this.social.markConversationRead(req.user.businessId, channel, externalUserId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('social/conversations/:channel/:externalUserId/reply')
  sendSocialReply(
    @Request() req: any,
    @Param('channel') channel: 'FACEBOOK' | 'INSTAGRAM',
    @Param('externalUserId') externalUserId: string,
    @Body('text') text: string,
  ) {
    return this.social.sendDirectMessage(req.user.businessId, channel, externalUserId, text ?? '');
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Post('social/conversations/:channel/:externalUserId/recommend')
  sendSocialRecommendationRequest(
    @Request() req: any,
    @Param('channel') channel: 'FACEBOOK' | 'INSTAGRAM',
    @Param('externalUserId') externalUserId: string,
  ) {
    return this.social.sendRecommendationRequest(req.user.businessId, channel, externalUserId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Get('social/conversations/:channel/:externalUserId/meta')
  getSocialConversationMeta(
    @Request() req: any,
    @Param('channel') channel: 'FACEBOOK' | 'INSTAGRAM',
    @Param('externalUserId') externalUserId: string,
  ) {
    return this.social.getConversationMeta(req.user.businessId, channel, externalUserId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Patch('social/conversations/:channel/:externalUserId/meta')
  updateSocialConversationMeta(
    @Request() req: any,
    @Param('channel') channel: 'FACEBOOK' | 'INSTAGRAM',
    @Param('externalUserId') externalUserId: string,
    @Body() body: { status?: 'OPEN' | 'RESOLVED'; pinned?: boolean; labels?: string[]; assignedToUserId?: string | null },
  ) {
    return this.social.updateConversationMeta(req.user.businessId, channel, externalUserId, body);
  }
}
