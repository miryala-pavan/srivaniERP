import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { SocialChannel } from '@prisma/client';

const API_VERSION = 'v25.0';

// DB keys for the live Facebook/Instagram credentials, stored in SystemSetting.
// One Page's access token covers both Messenger (Facebook) and its linked
// Instagram Business account via Meta's unified Send API — there is no
// separate Instagram token to store.
const SOCIAL_KEYS = {
  pageToken: 'fb.page_access_token',
  pageId:    'fb.page_id',
  igId:      'fb.ig_business_account_id',
} as const;

@Injectable()
export class SocialMessagingService implements OnModuleInit {
  private readonly logger = new Logger(SocialMessagingService.name);

  private _pageToken: string | undefined;
  private _pageId:    string | undefined;
  private _igId:      string | undefined;

  constructor(private prisma: PrismaService, private events: EventsService) {}

  async onModuleInit() {
    await this.loadCredentialsFromDb();
  }

  private async loadCredentialsFromDb() {
    try {
      const rows = await this.prisma.systemSetting.findMany({
        where: { key: { in: Object.values(SOCIAL_KEYS) } },
      });
      for (const row of rows) {
        if (row.key === SOCIAL_KEYS.pageToken && row.value) this._pageToken = row.value;
        if (row.key === SOCIAL_KEYS.pageId    && row.value) this._pageId    = row.value;
        if (row.key === SOCIAL_KEYS.igId      && row.value) this._igId      = row.value;
      }
    } catch { /* DB not ready at boot — env fallback will be used */ }
  }

  private get pageToken() { return this._pageToken ?? process.env.FB_PAGE_ACCESS_TOKEN; }
  private get pageId()    { return this._pageId    ?? process.env.FB_PAGE_ID; }
  private get igId()      { return this._igId      ?? process.env.FB_IG_BUSINESS_ACCOUNT_ID; }

  private get enabled() { return !!(this.pageToken && this.pageId); }

  // ── Credential management ───────────────────────────────────────────────────

  getCredentials() {
    return {
      tokenConfigured: !!this.pageToken,
      pageId:          this.pageId ?? null,
      igId:            this.igId   ?? null,
      source:          this._pageToken ? 'database' : 'env',
    };
  }

  async saveCredentials(businessId: string, data: { pageToken?: string; pageId?: string; igId?: string }) {
    const ops: Promise<any>[] = [];
    const upsert = (key: string, value: string) =>
      this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      });

    const pageToken = data.pageToken?.trim();
    const pageId    = data.pageId?.trim();
    const igId      = data.igId?.trim();

    if (pageToken) { ops.push(upsert(SOCIAL_KEYS.pageToken, pageToken)); this._pageToken = pageToken; }
    if (pageId)    { ops.push(upsert(SOCIAL_KEYS.pageId,    pageId));    this._pageId    = pageId; }
    if (igId)      { ops.push(upsert(SOCIAL_KEYS.igId,      igId));     this._igId      = igId; }

    await Promise.all(ops);
    return this.getCredentials();
  }

  // ── Saved Page presets ───────────────────────────────────────────────────────

  async listPageAccounts(businessId: string) {
    return this.prisma.socialPageAccount.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, pageId: true, igBusinessAccountId: true, isActive: true, createdAt: true },
    });
  }

  async savePageAccount(businessId: string, dto: {
    id?: string; label: string; pageAccessToken?: string; pageId: string; igBusinessAccountId?: string;
  }) {
    const label  = dto.label.trim();
    const pageId = dto.pageId.trim();
    if (!label || !pageId) throw new BadRequestException('Label and Page ID are required');

    if (dto.id) {
      const existing = await this.prisma.socialPageAccount.findFirst({ where: { id: dto.id, businessId } });
      if (!existing) throw new NotFoundException('Page account not found');
      await this.prisma.socialPageAccount.update({
        where: { id: dto.id },
        data: {
          label, pageId,
          igBusinessAccountId: dto.igBusinessAccountId?.trim() || null,
          ...(dto.pageAccessToken?.trim() ? { pageAccessToken: dto.pageAccessToken.trim() } : {}),
        },
      });
    } else {
      if (!dto.pageAccessToken?.trim()) throw new BadRequestException('Page access token is required for a new Page');
      await this.prisma.socialPageAccount.create({
        data: {
          businessId, label, pageId,
          pageAccessToken: dto.pageAccessToken.trim(),
          igBusinessAccountId: dto.igBusinessAccountId?.trim() || null,
        },
      });
    }
    return this.listPageAccounts(businessId);
  }

  async deletePageAccount(businessId: string, id: string) {
    await this.prisma.socialPageAccount.deleteMany({ where: { id, businessId } });
    return this.listPageAccounts(businessId);
  }

  /** Copies a saved preset's values into the live fb.* credentials the sending pipeline reads. */
  async activatePageAccount(businessId: string, id: string) {
    const preset = await this.prisma.socialPageAccount.findFirst({ where: { id, businessId } });
    if (!preset) throw new NotFoundException('Page account not found');

    await this.saveCredentials(businessId, {
      pageToken: preset.pageAccessToken,
      pageId: preset.pageId,
      igId: preset.igBusinessAccountId ?? undefined,
    });

    await this.prisma.$transaction([
      this.prisma.socialPageAccount.updateMany({ where: { businessId }, data: { isActive: false } }),
      this.prisma.socialPageAccount.update({ where: { id }, data: { isActive: true } }),
    ]);

    return this.listPageAccounts(businessId);
  }

  // ── Low-level send ───────────────────────────────────────────────────────────

  private async post(path: string, body: object): Promise<{ ok: boolean; skipped?: boolean; data: any }> {
    if (!this.enabled) {
      this.logger.warn('Facebook/Instagram not configured — skipping (set FB_PAGE_ACCESS_TOKEN + FB_PAGE_ID)');
      return { ok: false, skipped: true, data: null };
    }
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${path}?access_token=${encodeURIComponent(this.pageToken!)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        this.logger.error(`Meta API ${res.status}: ${JSON.stringify(data)}`);
        return { ok: false, data };
      }
      this.logger.log(`Social message sent → ${JSON.stringify(data)}`);
      return { ok: true, data };
    } catch (err) {
      this.logger.error(`Social send failed: ${err}`);
      return { ok: false, data: { error: String(err) } };
    }
  }

  private async logAndSend(
    businessId: string,
    channel: SocialChannel,
    path: string,
    body: object,
    meta: {
      externalUserId: string;
      messageType: string;
      bodyPreview?: string;
      isCampaignTriggered?: boolean;
      triggeringCommentId?: string;
      triggeringPostId?: string;
    },
  ): Promise<{ ok: boolean; skipped?: boolean; data: any }> {
    const result = await this.post(path, body);
    if (result.skipped) return result;

    try {
      const externalMessageId = result.ok ? (result.data as any)?.message_id ?? (result.data as any)?.id : undefined;
      await this.prisma.socialMessage.create({
        data: {
          businessId, channel,
          externalMessageId: externalMessageId ?? `failed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          direction: 'OUTBOUND',
          externalUserId: meta.externalUserId,
          messageType: meta.messageType,
          bodyPreview: meta.bodyPreview?.slice(0, 200),
          status: result.ok ? 'SENT' : 'FAILED',
          errorMessage: result.ok ? undefined : JSON.stringify(result.data).slice(0, 500),
          isCampaignTriggered: meta.isCampaignTriggered ?? false,
          triggeringCommentId: meta.triggeringCommentId,
          triggeringPostId: meta.triggeringPostId,
          sentAt: result.ok ? new Date() : undefined,
        },
      });
      this.events.emitToBusiness(businessId, Events.SOCIAL_MESSAGE_SENT, {
        channel, externalUserId: meta.externalUserId, direction: 'OUTBOUND',
        bodyPreview: meta.bodyPreview?.slice(0, 200) ?? null, createdAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(`Failed to log social message: ${err}`);
    }
    return result;
  }

  /** POST /{page-id}/messages — same endpoint for Facebook Messenger and Instagram DM. */
  async sendDirectMessage(businessId: string, channel: SocialChannel, externalUserId: string, text: string) {
    return this.logAndSend(
      businessId, channel, `${this.pageId}/messages`,
      { recipient: { id: externalUserId }, messaging_type: 'RESPONSE', message: { text } },
      { externalUserId, messageType: 'TEXT', bodyPreview: text },
    );
  }

  /**
   * Private-replies to a public comment — bypasses the normal 24h messaging
   * window for up to 7 days after the comment (Meta-enforced). This is the
   * mechanism behind comment-to-DM campaigns.
   *
   * NOTE: Facebook and Instagram have historically used different request
   * shapes for this — Facebook via the comment's own /private_replies edge,
   * Instagram via /{page-id}/messages with a recipient.comment_id. Confirm
   * the exact Instagram shape against the Graph API Explorer once the Meta
   * App exists; this is not verifiable without a live token.
   */
  async sendPrivateReply(businessId: string, channel: SocialChannel, commentId: string, text: string, opts?: {
    triggeringPostId?: string;
  }) {
    const path = channel === 'FACEBOOK'
      ? `${commentId}/private_replies`
      : `${this.pageId}/messages`; // TODO: confirm exact Instagram private-reply shape once the Meta App exists
    const body = channel === 'FACEBOOK'
      ? { message: text }
      : { recipient: { comment_id: commentId }, message: { text } };
    return this.logAndSend(
      businessId, channel, path, body,
      {
        externalUserId: commentId, messageType: 'COMMENT_PRIVATE_REPLY', bodyPreview: text,
        isCampaignTriggered: true, triggeringCommentId: commentId, triggeringPostId: opts?.triggeringPostId,
      },
    );
  }

  /**
   * A thin wrapper around sendDirectMessage linking to the Page's
   * recommendations URL. Unlike WhatsApp's template system, Messenger has no
   * approved-template mechanism that bypasses the session window — this can
   * only be sent from an already-open conversation (called from the inbox
   * thread's "Ask for a recommendation" button, never as a scheduled/bulk
   * campaign, which would violate Messenger's promotional-content policy).
   */
  async sendRecommendationRequest(businessId: string, channel: SocialChannel, externalUserId: string) {
    if (!this.pageId) return { ok: false, skipped: true, data: null };
    const text = `Thank you! If you have a moment, we'd really appreciate a recommendation on Facebook: https://www.facebook.com/${this.pageId}/reviews/`;
    return this.sendDirectMessage(businessId, channel, externalUserId, text);
  }

  // ── Comment campaigns ────────────────────────────────────────────────────────

  async listCommentCampaigns(businessId: string) {
    return this.prisma.commentCampaign.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }

  async createCommentCampaign(businessId: string, data: {
    channel: SocialChannel; postId?: string; triggerKeyword: string; replyMessage: string;
  }) {
    return this.prisma.commentCampaign.create({
      data: {
        businessId, channel: data.channel,
        postId: data.postId?.trim() || null,
        triggerKeyword: data.triggerKeyword.trim(),
        replyMessage: data.replyMessage.trim(),
      },
    });
  }

  async updateCommentCampaign(businessId: string, id: string, data: {
    postId?: string | null; triggerKeyword?: string; replyMessage?: string; isActive?: boolean;
  }) {
    const existing = await this.prisma.commentCampaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Comment campaign not found');
    return this.prisma.commentCampaign.update({ where: { id }, data });
  }

  async deleteCommentCampaign(businessId: string, id: string) {
    const existing = await this.prisma.commentCampaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Comment campaign not found');
    await this.prisma.commentCampaign.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  /**
   * Finds the best-matching active campaign for a comment: case-insensitive
   * substring match against the comment text, preferring a post-specific
   * campaign over an account-wide one (postId: null) if both match.
   */
  async matchCampaign(businessId: string, channel: SocialChannel, postId: string | undefined, commentText: string) {
    const campaigns = await this.prisma.commentCampaign.findMany({
      where: { businessId, channel, isActive: true },
    });
    const text = commentText.toLowerCase();
    const matches = campaigns.filter((c) => text.includes(c.triggerKeyword.toLowerCase()));
    if (matches.length === 0) return null;
    const postSpecific = postId ? matches.find((c) => c.postId === postId) : undefined;
    return postSpecific ?? matches.find((c) => !c.postId) ?? matches[0];
  }

  // ── Conversations / message log ─────────────────────────────────────────────

  async getUnreadCount(businessId: string): Promise<number> {
    return this.prisma.socialMessage.count({
      where: { businessId, direction: 'INBOUND', readByStaffAt: null },
    });
  }

  async listConversations(businessId: string) {
    const latest = await this.prisma.$queryRaw<{
      channel: SocialChannel; externalUserId: string; bodyPreview: string | null;
      messageType: string; direction: string; createdAt: Date; status: string;
    }[]>`
      SELECT DISTINCT ON (channel, "externalUserId") channel, "externalUserId", "bodyPreview", "messageType", direction, "createdAt", status
      FROM social_message
      WHERE "businessId" = ${businessId}
      ORDER BY channel, "externalUserId", "createdAt" DESC`;

    const unreadRows = await this.prisma.socialMessage.groupBy({
      by: ['channel', 'externalUserId'],
      where: { businessId, direction: 'INBOUND', readByStaffAt: null },
      _count: { _all: true },
    });
    const unreadMap = new Map(unreadRows.map((r) => [`${r.channel}:${r.externalUserId}`, r._count._all]));

    const convMeta = await this.prisma.socialConversation.findMany({
      where: { businessId },
      select: {
        channel: true, externalUserId: true, status: true, pinned: true, labels: true,
        assignedToUserId: true, assignedTo: { select: { fullName: true } },
      },
    });
    const metaMap = new Map(convMeta.map((m) => [`${m.channel}:${m.externalUserId}`, m]));

    return latest
      .map((l) => {
        const key = `${l.channel}:${l.externalUserId}`;
        const meta = metaMap.get(key);
        return {
          channel: l.channel,
          externalUserId: l.externalUserId,
          lastMessage: l.bodyPreview,
          lastMessageType: l.messageType,
          lastDirection: l.direction,
          lastAt: l.createdAt,
          lastStatus: l.status,
          unreadCount: unreadMap.get(key) ?? 0,
          convStatus: meta?.status ?? 'OPEN',
          pinned: meta?.pinned ?? false,
          labels: meta?.labels ?? [],
          assignedToUserId: meta?.assignedToUserId ?? null,
          assignedToName: meta?.assignedTo?.fullName ?? null,
        };
      })
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || +new Date(b.lastAt) - +new Date(a.lastAt));
  }

  async getConversationMessages(businessId: string, channel: SocialChannel, externalUserId: string) {
    const messages = await this.prisma.socialMessage.findMany({
      where: { businessId, channel, externalUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return messages.reverse();
  }

  async markConversationRead(businessId: string, channel: SocialChannel, externalUserId: string) {
    await this.prisma.socialMessage.updateMany({
      where: { businessId, channel, externalUserId, direction: 'INBOUND', readByStaffAt: null },
      data: { readByStaffAt: new Date() },
    });
    return { ok: true };
  }

  async getConversationMeta(businessId: string, channel: SocialChannel, externalUserId: string) {
    const meta = await this.prisma.socialConversation.findUnique({
      where: { businessId_channel_externalUserId: { businessId, channel, externalUserId } },
      include: { assignedTo: { select: { fullName: true } } },
    });
    return meta ?? { status: 'OPEN' as const, pinned: false, labels: [] as string[], assignedToUserId: null, assignedTo: null };
  }

  async updateConversationMeta(businessId: string, channel: SocialChannel, externalUserId: string, data: {
    status?: 'OPEN' | 'RESOLVED'; pinned?: boolean; labels?: string[]; assignedToUserId?: string | null;
  }) {
    const meta = await this.prisma.socialConversation.upsert({
      where: { businessId_channel_externalUserId: { businessId, channel, externalUserId } },
      update: data,
      create: { businessId, channel, externalUserId, ...data },
      include: { assignedTo: { select: { fullName: true } } },
    });
    return meta;
  }
}
