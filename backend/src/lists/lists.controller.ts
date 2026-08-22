import {
  Controller, Get, Post, Param, Query, Body, Res,
  UseGuards, Request, Req, Headers,
  HttpCode, BadRequestException, Logger, OnModuleInit,
} from '@nestjs/common';
import type { Response } from 'express';
import { ListsService } from './lists.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnlineOrdersService } from '../online-orders/online-orders.service';
import { WaOrderingService } from '../online-orders/wa-ordering.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { PushService } from '../notifications/push.service';
import { OrderPhotosService } from '../order-photos/order-photos.service';
import { HistoryService } from '../history/history.service';
import * as crypto from 'crypto';

// Matches the short Ref: code embedded in the wa.me pre-filled message
// (see OrderPhotosService's buildCustomerRefMessage) — case-insensitive
// since a customer could retype it, though normally it arrives untouched.
const ORDER_PHOTO_REF_RE = /\bRef:?\s*([A-Z0-9]{10})\b/i;

const WH_VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN ?? 'srivani-wa-verify-2026';
const WH_APP_SECRET   = process.env.WA_APP_SECRET ?? '';

// ── WhatsApp Webhook (public — no JWT) ────────────────────────────────────────

@Controller('wa')
export class WebhookController implements OnModuleInit {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private lists: ListsService,
    private prisma: PrismaService,
    private onlineOrders: OnlineOrdersService,
    private waOrdering: WaOrderingService,
    private events: EventsService,
    private whatsapp: WhatsAppService,
    private push: PushService,
    private orderPhotos: OrderPhotosService,
    private history: HistoryService,
  ) {}

  onModuleInit() {
    if (!WH_APP_SECRET) {
      this.logger.warn(
        'WA_APP_SECRET not configured — webhook signature verification is disabled. ' +
        'Set this in Meta App Dashboard > WhatsApp > Configuration and add it to .env.',
      );
    }
  }

  // Meta sends a GET to verify the webhook URL
  @Get('webhook')
  @HttpCode(200)
  verify(
    @Query('hub.mode')         mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge')    challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === WH_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Meta sends POST with message data
  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req()     req: any,
    @Headers('x-hub-signature-256') sig: string,
    @Body()    body: any,
  ) {
    // Verify signature if app secret is configured
    if (WH_APP_SECRET && sig) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', WH_APP_SECRET)
        .update((req as any).rawBody ?? Buffer.alloc(0))
        .digest('hex');
      if (expected !== sig) throw new BadRequestException('Invalid signature');
    }

    // Meta always expects 200 quickly — process async
    this.processWebhook(body).catch(() => null);
    return { status: 'ok' };
  }

  // Multi-tenant routing: Meta always includes the receiving number's
  // phone_number_id in metadata. Match it against the business that has
  // this number configured (SystemSetting key "wa.phone_number_id"). Falls
  // back to the single active business when the number is configured via
  // WA_PHONE_NUMBER_ID env var rather than the credentials UI — the common
  // case for a single-tenant deployment that hasn't saved credentials to the
  // database yet.
  private async resolveBusinessId(phoneNumberId: string | undefined): Promise<string | null> {
    if (!phoneNumberId) return null;
    const setting = await this.prisma.systemSetting.findFirst({
      where: { key: 'wa.phone_number_id', value: phoneNumberId },
      select: { businessId: true },
    });
    if (setting) return setting.businessId;

    if (phoneNumberId === process.env.WA_PHONE_NUMBER_ID) {
      const biz = await this.prisma.business.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      return biz?.id ?? null;
    }
    return null;
  }

  private async logInbound(businessId: string, waMessageId: string, data: {
    phone: string; messageType: string; bodyPreview?: string; buttonId?: string; mediaId?: string;
  }): Promise<boolean> {
    // Returns false if this message id was already processed (webhook retry).
    try {
      await this.prisma.waMessage.create({
        data: {
          businessId,
          waMessageId,
          direction: 'INBOUND',
          phone: data.phone,
          messageType: data.messageType,
          bodyPreview: data.bodyPreview?.slice(0, 200),
          buttonId: data.buttonId,
          mediaId: data.mediaId,
          status: 'DELIVERED',
        },
      });
      return true;
    } catch (err: any) {
      if (err?.code === 'P2002') return false; // unique constraint — already seen this message id
      this.logger.error(`Failed to log inbound WaMessage: ${err}`);
      return true; // don't block processing on a logging failure
    }
  }

  private async handleStatuses(businessId: string, statuses: any[]) {
    for (const st of statuses) {
      const waMessageId = st?.id as string;
      if (!waMessageId) continue;
      const newStatus =
        st.status === 'delivered' ? 'DELIVERED' :
        st.status === 'read'      ? 'READ' :
        st.status === 'failed'    ? 'FAILED' :
        null; // "sent" is already the initial state we log at send time
      if (!newStatus) continue;

      const data: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'DELIVERED') data.deliveredAt = new Date();
      if (newStatus === 'READ')      data.readAt = new Date();
      if (newStatus === 'FAILED')    data.errorMessage = st.errors?.[0]?.title ?? 'Unknown error';

      await this.prisma.waMessage.updateMany({
        where: { businessId, waMessageId },
        data,
      }).catch(() => null); // no-op if the message predates this feature
    }
  }

  private async processWebhook(body: any) {
    try {
      const entry   = body?.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      if (!changes) return;

      const businessId = await this.resolveBusinessId(changes.metadata?.phone_number_id);
      if (!businessId) {
        this.logger.warn(`No business configured for WA phone_number_id ${changes.metadata?.phone_number_id}`);
        return;
      }

      if (changes.statuses?.length) {
        await this.handleStatuses(businessId, changes.statuses);
      }

      if (!changes.messages?.length) return;

      const contact = changes.contacts?.[0];
      const msg     = changes.messages[0];

      const senderPhone = msg.from as string;        // e.g. "919382828484"
      const senderName  = contact?.profile?.name as string | undefined;

      // Dedup: Meta retries webhook delivery at-least-once for the same message.
      const location = msg.type === 'location' ? msg.location : undefined;
      const bodyPreview = msg.text?.body ?? msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title
        ?? msg.button?.text
        ?? (location ? `${location.latitude},${location.longitude}` : undefined);
      const messageType = msg.type === 'interactive'
        ? (msg.interactive?.list_reply ? 'LIST_REPLY' : 'BUTTON_REPLY')
        : msg.type === 'button' ? 'BUTTON_REPLY'
        : msg.type.toUpperCase();
      const mediaId = msg.type === 'image' ? msg.image?.id : msg.type === 'document' ? msg.document?.id : undefined;
      // msg.button is Meta's shape for a tap on a TEMPLATE's quick-reply button
      // (distinct from msg.interactive, which is a tap on a session message's
      // button/list) — payload carries whatever we set at send time.
      const selectionId = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? msg.button?.payload;
      const isNew = await this.logInbound(businessId, msg.id, {
        phone: senderPhone,
        messageType,
        bodyPreview,
        buttonId: selectionId,
        mediaId,
      });
      if (!isNew) return;

      try {
        this.events.emitToBusiness(businessId, Events.WA_MESSAGE_RECEIVED, {
          phone: senderPhone,
          direction: 'INBOUND',
          bodyPreview: bodyPreview?.slice(0, 200) ?? null,
          messageType,
          createdAt: new Date().toISOString(),
        });
      } catch { /* fire-and-forget */ }

      // Web push — reaches staff whose tab/app is closed or backgrounded,
      // complementing the WebSocket event above (which only reaches an
      // already-open tab). Fired from the same place, same trigger.
      this.prisma.customer.findFirst({ where: { businessId, phone: senderPhone }, select: { name: true } })
        .then((customer) => this.push.sendToBusiness(businessId, {
          title: customer?.name ?? `+${senderPhone}`,
          body:  bodyPreview?.slice(0, 150) ?? `[${messageType}]`,
          phone: senderPhone,
        }))
        .catch(() => {});

      const buttonId = msg.interactive?.button_reply?.id as string | undefined;
      const listReplyId = msg.interactive?.list_reply?.id as string | undefined;
      const messageBody = msg.text?.body as string | undefined;

      // WhatsApp quick-reorder flow (task #99) — takes over the conversation
      // while a session is open, or starts one on an explicit "reorder"
      // trigger. Checked before the generic auto-reply/button/list handlers
      // below since only this flow carries multi-turn state.
      const activeReorderSession = await this.waOrdering.getActiveSession(businessId, senderPhone);
      if (activeReorderSession) {
        await this.waOrdering.handleSessionMessage(businessId, senderPhone, activeReorderSession, { buttonId, listReplyId, messageBody })
          .catch(err => this.logger.error(`WA reorder session handling failed for ${senderPhone}: ${err}`));
        return;
      }
      const isReorderTrigger = listReplyId === 'WA_REORDER' || buttonId === 'WA_REORDER'
        || /^(reorder|order again|repeat( my)? order)/i.test((messageBody ?? '').trim());
      if (isReorderTrigger) {
        await this.waOrdering.startReorder(businessId, senderPhone)
          .catch(err => this.logger.error(`WA reorder start failed for ${senderPhone}: ${err}`));
        return;
      }

      // Order-photo share flow — a customer arriving via the wa.me
      // click-to-chat link (see OrderPhotosService) sends a message carrying
      // "Ref: <code>". Checked before the generic auto-reply for the same
      // reason as the reorder flow above: this needs OrderPhotosModule,
      // which whatsapp.service.ts can't depend on without a circular
      // module dependency (OrderPhotosModule already depends on
      // NotificationsModule).
      const refMatch = messageBody?.match(ORDER_PHOTO_REF_RE);
      if (refMatch) {
        const photo = await this.orderPhotos.findByRefCode(businessId, refMatch[1], senderPhone);
        if (photo) {
          await this.orderPhotos.sendPhotoReply(businessId, senderPhone, photo)
            .catch(err => this.logger.error(`Order photo reply failed for ${senderPhone}: ${err}`));
          return;
        }
      }

      // "History Link" option from the order-photo follow-up menu — same
      // circular-dependency reason as above (needs HistoryModule).
      if (buttonId === 'WA_HISTORY_LINK' || listReplyId === 'WA_HISTORY_LINK') {
        const customer = await this.findCustomerByPhone(businessId, senderPhone);
        if (customer) {
          await this.history.sendHistoryLink(customer.id, businessId)
            .catch(err => this.logger.error(`History link send failed for ${senderPhone}: ${err}`));
        }
        return;
      }

      // "Last Order Pic" option — same menu, needs OrderPhotosModule. No
      // customer lookup needed here; sendLastOrderReply matches by phone
      // directly (see its own comment for why — duplicate Customer rows).
      if (buttonId === 'WA_LAST_ORDER' || listReplyId === 'WA_LAST_ORDER') {
        await this.orderPhotos.sendLastOrderReply(businessId, senderPhone)
          .catch(err => this.logger.error(`Last order reply failed for ${senderPhone}: ${err}`));
        return;
      }

      // Rule-based auto-reply — layered alongside the existing handlers below,
      // not a replacement for them (e.g. a text list-order can still be
      // processed by ListsService even if a keyword also triggers an auto-reply).
      this.whatsapp.handleAutoReply(businessId, senderPhone, {
        messageBody,
        buttonId,
        listReplyId,
        senderName,
      }).catch(err => this.logger.error(`Auto-reply failed for ${senderPhone}: ${err}`));

      if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
        await this.handleButtonReply(msg.interactive.button_reply.id as string, senderPhone);
        return;
      }

      // A tap on a TEMPLATE's quick-reply button (e.g. post_delivery_feedback)
      // arrives with this shape, not the "interactive" shape above.
      if (msg.type === 'button' && msg.button?.payload) {
        await this.handleButtonReply(msg.button.payload as string, senderPhone);
        return;
      }

      if (msg.type === 'text') {
        await this.lists.handleIncoming(businessId, {
          senderPhone, senderName,
          msgType: 'TEXT',
          rawText: msg.text?.body as string,
        });

      } else if (msg.type === 'image') {
        await this.lists.handleIncoming(businessId, {
          senderPhone, senderName,
          msgType:   'IMAGE',
          mediaId:   msg.image?.id as string,
          mediaMime: msg.image?.mime_type as string,
        });

      } else if (msg.type === 'document') {
        const mime     = msg.document?.mime_type as string ?? '';
        const isPdf    = mime.includes('pdf');
        await this.lists.handleIncoming(businessId, {
          senderPhone, senderName,
          msgType:   isPdf ? 'PDF' : 'DOCUMENT',
          mediaId:   msg.document?.id as string,
          mediaMime: mime,
        });
      }
    } catch (err) {
      // Log but always return 200 to Meta
      this.logger.error(`Webhook processing failed: ${err}`);
    }
  }

  // Dispatches an inbound button tap to the action it represents.
  // Button ids are namespaced "ACTION:param" (see WhatsAppService.sendCustomerOrderUpdate).
  // senderPhone is the WhatsApp number the tap came from — required now to
  // verify the tapper actually owns the order (confirmDelivery checks it
  // matches the order's customerPhone), since Meta only tells us who sent
  // the button tap, not which order it's "supposed" to be for.
  private async handleButtonReply(buttonId: string, senderPhone: string) {
    const [action, param] = buttonId.split(':');
    if (action === 'CONFIRM_DELIVERY' && param) {
      await this.onlineOrders.confirmDelivery(param, senderPhone).catch(err =>
        this.logger.error(`confirmDelivery via WA button failed for ${param}: ${err}`),
      );
    } else if (action === 'FEEDBACK_POS' && param) {
      await this.handlePositiveFeedback(param).catch(err =>
        this.logger.error(`Positive feedback handling failed for ${param}: ${err}`),
      );
    } else if (action === 'FEEDBACK_NEG' && param) {
      await this.handleNegativeFeedback(param).catch(err =>
        this.logger.error(`Negative feedback handling failed for ${param}: ${err}`),
      );
    }
  }

  private async handlePositiveFeedback(orderNumber: string) {
    const order = await this.prisma.onlineOrder.findUnique({ where: { orderNumber } });
    if (!order || !order.customerPhone) return;
    await this.whatsapp.sendGoogleReviewRequest(order.businessId, {
      customerName: order.customerName, customerPhone: order.customerPhone,
    });
  }

  private async handleNegativeFeedback(orderNumber: string) {
    const order = await this.prisma.onlineOrder.findUnique({ where: { orderNumber } });
    if (!order || !order.customerPhone) return;
    const meta = await this.whatsapp.getConversationMeta(order.businessId, order.customerPhone);
    const labels = meta.labels.includes('Needs follow-up') ? meta.labels : [...meta.labels, 'Needs follow-up'];
    await this.whatsapp.updateConversationMeta(order.businessId, order.customerPhone, { labels, pinned: true });
    // Safe as free text — the tap that got us here just reopened the 24h session window.
    await this.whatsapp.sendTextMessage(order.businessId, order.customerPhone,
      "Thanks for letting us know — our team will reach out to help.").catch(() => {});
  }

  // Customer.phone isn't stored consistently (bare 10-digit vs 91-prefixed)
  // across creation paths, so an exact match against the webhook's raw
  // senderPhone silently misses real customers — match both known shapes.
  private async findCustomerByPhone(businessId: string, senderPhone: string) {
    const senderDigits = senderPhone.replace(/\D/g, '').slice(-10);
    return this.prisma.customer.findFirst({
      where: { businessId, OR: [{ phone: senderDigits }, { phone: `91${senderDigits}` }, { phone: senderPhone }] },
    });
  }
}

// ── ERP Lists API (JWT protected) ────────────────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lists')
export class ListsController {
  constructor(private lists: ListsService) {}

  @Get()
  getLists(
    @Request() req: any,
    @Query('page')  page  = '1',
    @Query('limit') limit = '30',
  ) {
    return this.lists.getLists(req.user.businessId, Number(page), Number(limit));
  }

  @Get('pending-downloads')
  getPending(@Request() req: any) {
    return this.lists.getPendingDownloads(req.user.businessId);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const { buffer, filename } = await this.lists.getDocBuffer(id, req.user.businessId);
    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.send(buffer);
  }

  @Post(':id/reprocess')
  reprocess(@Param('id') id: string, @Request() req: any) {
    return this.lists.reprocess(id, req.user.businessId);
  }

  @Post('manual')
  manual(
    @Request() req: any,
    @Body() dto: {
      senderPhone: string;
      senderName:  string;
      text?:        string;
      imageBase64?: string;
      imageMime?:   string;
      fileBase64?:  string;   // PDF or DOCX
      fileMime?:    string;
    },
  ) {
    return this.lists.manualCreate(req.user.businessId, dto);
  }
}
