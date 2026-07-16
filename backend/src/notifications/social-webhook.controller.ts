import {
  Controller, Get, Post, Query, Body, Res,
  Req, Headers, HttpCode, BadRequestException, Logger, OnModuleInit,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { SocialMessagingService } from './social-messaging.service';
import { SocialChannel } from '@prisma/client';
import * as crypto from 'crypto';

const FB_VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN ?? 'srivani-fb-verify-2026';
const FB_APP_SECRET   = process.env.FB_APP_SECRET ?? '';

// ── Facebook / Instagram Webhook (public — no JWT) ────────────────────────────
// Deliberately its own controller, not folded into WebhookController ('wa') —
// this is a genuinely separate Meta Developer App with its own app secret and
// verify token, and there's no order-taking-from-chat flow here the way
// ListsModule's WhatsApp webhook has, so there's no shared reason to entangle
// the two beyond both being "a Meta webhook."

@Controller('meta')
export class SocialWebhookController implements OnModuleInit {
  private readonly logger = new Logger(SocialWebhookController.name);

  constructor(
    private prisma: PrismaService,
    private events: EventsService,
    private social: SocialMessagingService,
  ) {}

  onModuleInit() {
    if (!FB_APP_SECRET) {
      this.logger.warn(
        'FB_APP_SECRET not configured — webhook signature verification is disabled. ' +
        'Set this once the Meta Developer App exists and add it to .env.',
      );
    }
  }

  @Get('webhook')
  @HttpCode(200)
  verify(
    @Query('hub.mode')         mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge')    challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  @Post('webhook')
  @HttpCode(200)
  async receive(
    @Req()     req: any,
    @Headers('x-hub-signature-256') sig: string,
    @Body()    body: any,
  ) {
    if (FB_APP_SECRET && sig) {
      const expected = 'sha256=' + crypto
        .createHmac('sha256', FB_APP_SECRET)
        .update((req as any).rawBody ?? Buffer.alloc(0))
        .digest('hex');
      if (expected !== sig) throw new BadRequestException('Invalid signature');
    }

    this.processWebhook(body).catch(() => null);
    return { status: 'ok' };
  }

  // Multi-tenant routing: each webhook entry carries the receiving Page or IG
  // Business Account's own id. Match it against fb.page_id / fb.ig_business_account_id
  // SystemSetting rows, falling back to the env-var single-tenant configuration.
  private async resolveBusinessId(entryId: string | undefined): Promise<string | null> {
    if (!entryId) return null;
    const setting = await this.prisma.systemSetting.findFirst({
      where: { OR: [{ key: 'fb.page_id', value: entryId }, { key: 'fb.ig_business_account_id', value: entryId }] },
      select: { businessId: true },
    });
    if (setting) return setting.businessId;

    if (entryId === process.env.FB_PAGE_ID || entryId === process.env.FB_IG_BUSINESS_ACCOUNT_ID) {
      const biz = await this.prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
      return biz?.id ?? null;
    }
    return null;
  }

  private async processWebhook(body: any) {
    try {
      const entries = body?.entry;
      if (!Array.isArray(entries)) return;
      const channel: SocialChannel = body?.object === 'instagram' ? 'INSTAGRAM' : 'FACEBOOK';

      for (const entry of entries) {
        const businessId = await this.resolveBusinessId(entry?.id);
        if (!businessId) {
          this.logger.warn(`No business configured for Meta entry id ${entry?.id}`);
          continue;
        }

        if (Array.isArray(entry.messaging)) {
          for (const event of entry.messaging) {
            await this.handleMessagingEvent(businessId, channel, event);
          }
        }

        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change?.field === 'feed' || change?.field === 'comments') {
              await this.handleComment(businessId, channel, change.value);
            }
          }
        }
      }
    } catch (err) {
      // Log but always return 200 to Meta
      this.logger.error(`Social webhook processing failed: ${err}`);
    }
  }

  private async handleMessagingEvent(businessId: string, channel: SocialChannel, event: any) {
    const senderId = event?.sender?.id as string | undefined;
    if (!senderId) return;

    if (event.delivery || event.read) {
      const status = event.read ? 'READ' : 'DELIVERED';
      const mids: string[] = event.delivery?.mids ?? [];
      if (mids.length) {
        await this.prisma.socialMessage.updateMany({
          where: { businessId, channel, externalMessageId: { in: mids } },
          data: { status, ...(status === 'READ' ? { readAt: new Date() } : { deliveredAt: new Date() }) },
        }).catch(() => {});
      }
      return;
    }

    const message = event.message;
    if (!message) return;

    const externalMessageId = message.mid as string | undefined;
    if (!externalMessageId) return;

    // Dedup — Meta retries webhook delivery at-least-once for the same event.
    const existing = await this.prisma.socialMessage.findUnique({
      where: { businessId_channel_externalMessageId: { businessId, channel, externalMessageId } },
    }).catch(() => null);
    if (existing) return;

    const bodyPreview: string | undefined = message.text;
    const mediaId: string | undefined = message.attachments?.[0]?.payload?.url;
    const messageType = message.attachments?.length ? (message.attachments[0].type ?? 'IMAGE').toUpperCase() : 'TEXT';

    await this.prisma.socialMessage.create({
      data: {
        businessId, channel, externalMessageId,
        direction: 'INBOUND', externalUserId: senderId,
        messageType, bodyPreview: bodyPreview?.slice(0, 200), mediaId,
      },
    });

    this.events.emitToBusiness(businessId, Events.SOCIAL_MESSAGE_RECEIVED, {
      channel, externalUserId: senderId, direction: 'INBOUND',
      bodyPreview: bodyPreview?.slice(0, 200) ?? null, messageType, createdAt: new Date().toISOString(),
    });
  }

  private async handleComment(businessId: string, channel: SocialChannel, value: any) {
    // Facebook Page feed comments (field: 'feed') vs Instagram comments
    // (field: 'comments') carry the same information under different keys.
    const isFacebookFeed = value?.item === 'comment';
    if (isFacebookFeed && value?.verb && value.verb !== 'add') return; // ignore edits/removals

    const commentId: string | undefined = isFacebookFeed ? value?.comment_id : value?.id;
    const postId: string | undefined    = isFacebookFeed ? value?.post_id : value?.media?.id;
    const text: string | undefined      = isFacebookFeed ? value?.message : value?.text;
    if (!commentId || !text) return;

    const match = await this.social.matchCampaign(businessId, channel, postId, text);
    if (!match) return;

    await this.social.sendPrivateReply(businessId, channel, commentId, match.replyMessage, { triggeringPostId: postId });
  }
}
