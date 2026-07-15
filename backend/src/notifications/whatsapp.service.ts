import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';

const API_VERSION = 'v25.0';

// DB keys for WhatsApp credentials stored in SystemSetting
const WA_KEYS = {
  token:    'wa.access_token',
  phoneId:  'wa.phone_number_id',
  wabaId:   'wa.business_account_id',
  storeNum: 'wa.store_notify_number',
} as const;

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppService.name);

  // Runtime cache — DB values override env vars
  private _token:    string | undefined;
  private _phoneId:  string | undefined;
  private _wabaId:   string | undefined;
  private _storeNum: string | undefined;

  constructor(private prisma: PrismaService, private events: EventsService) {}

  async onModuleInit() {
    await this.loadCredentialsFromDb();
  }

  private async loadCredentialsFromDb() {
    try {
      const rows = await this.prisma.systemSetting.findMany({
        where: { key: { in: Object.values(WA_KEYS) } },
      });
      for (const row of rows) {
        if (row.key === WA_KEYS.token    && row.value) this._token    = row.value;
        if (row.key === WA_KEYS.phoneId  && row.value) this._phoneId  = row.value;
        if (row.key === WA_KEYS.wabaId   && row.value) this._wabaId   = row.value;
        if (row.key === WA_KEYS.storeNum && row.value) this._storeNum = row.value;
      }
    } catch { /* DB not ready at boot — env fallback will be used */ }
  }

  private get token()    { return this._token    ?? process.env.WA_ACCESS_TOKEN; }
  private get phoneId()  { return this._phoneId  ?? process.env.WA_PHONE_NUMBER_ID; }
  private get wabaId()   { return this._wabaId   ?? process.env.WA_BUSINESS_ACCOUNT_ID; }
  private get storeNum() { return this._storeNum ?? process.env.WA_STORE_NOTIFY_NUMBER; }

  private get enabled() {
    return !!(this.token && this.phoneId);
  }

  // ── Credential management ───────────────────────────────────────────────────

  getCredentials() {
    return {
      tokenConfigured:  !!this.token,
      phoneId:          this.phoneId  ?? null,
      wabaId:           this.wabaId   ?? null,
      storeNum:         this.storeNum ?? null,
      source:           this._token ? 'database' : 'env',
    };
  }

  async saveCredentials(businessId: string, data: {
    token?:    string;
    phoneId?:  string;
    wabaId?:   string;
    storeNum?: string;
  }) {
    const ops: Promise<any>[] = [];
    const upsert = (key: string, value: string) =>
      this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      });

    const token    = data.token?.trim();
    const phoneId  = data.phoneId?.trim();
    const wabaId   = data.wabaId?.trim();
    const storeNum = data.storeNum?.trim();

    if (token)    { ops.push(upsert(WA_KEYS.token,    token));    this._token    = token; }
    if (phoneId)  { ops.push(upsert(WA_KEYS.phoneId,  phoneId));  this._phoneId  = phoneId; }
    if (wabaId)   { ops.push(upsert(WA_KEYS.wabaId,   wabaId));   this._wabaId   = wabaId; }
    if (storeNum) { ops.push(upsert(WA_KEYS.storeNum, storeNum)); this._storeNum = storeNum; }

    await Promise.all(ops);
    return this.getCredentials();
  }

  // ── Saved phone number presets ──────────────────────────────────────────────

  /**
   * Lists saved number presets. If none exist yet but legacy single-number
   * credentials are already configured (from before this feature existed),
   * auto-migrates them into a first "Current Number" preset so they don't
   * just disappear from the new UI.
   */
  async listPhoneNumbers(businessId: string) {
    const existing = await this.prisma.waPhoneNumber.count({ where: { businessId } });
    if (existing === 0 && this.token && this.phoneId && this.wabaId) {
      await this.prisma.waPhoneNumber.create({
        data: {
          businessId, label: 'Current Number',
          accessToken: this.token, phoneNumberId: this.phoneId, businessAccountId: this.wabaId,
          storeNotifyNumber: this.storeNum, isActive: true,
        },
      }).catch(() => null); // ignore races / unique conflicts
    }
    return this.prisma.waPhoneNumber.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, phoneNumberId: true, businessAccountId: true, storeNotifyNumber: true, isActive: true, createdAt: true },
    });
  }

  async savePhoneNumber(businessId: string, dto: {
    id?: string; label: string; accessToken?: string; phoneNumberId: string; businessAccountId: string; storeNotifyNumber?: string;
  }) {
    const label             = dto.label.trim();
    const phoneNumberId     = dto.phoneNumberId.trim();
    const businessAccountId = dto.businessAccountId.trim();
    if (!label || !phoneNumberId || !businessAccountId) {
      throw new Error('Label, Phone Number ID, and Business Account ID are required');
    }

    if (dto.id) {
      const existing = await this.prisma.waPhoneNumber.findFirst({ where: { id: dto.id, businessId } });
      if (!existing) throw new Error('Number not found');
      await this.prisma.waPhoneNumber.update({
        where: { id: dto.id },
        data: {
          label, phoneNumberId, businessAccountId,
          storeNotifyNumber: dto.storeNotifyNumber?.trim() || null,
          ...(dto.accessToken?.trim() ? { accessToken: dto.accessToken.trim() } : {}),
        },
      });
    } else {
      if (!dto.accessToken?.trim()) throw new Error('Access token is required for a new number');
      await this.prisma.waPhoneNumber.create({
        data: {
          businessId, label, phoneNumberId, businessAccountId,
          accessToken: dto.accessToken.trim(),
          storeNotifyNumber: dto.storeNotifyNumber?.trim() || null,
        },
      });
    }
    return this.listPhoneNumbers(businessId);
  }

  async deletePhoneNumber(businessId: string, id: string) {
    await this.prisma.waPhoneNumber.deleteMany({ where: { id, businessId } });
    return this.listPhoneNumbers(businessId);
  }

  /** Copies a saved preset's values into the live wa.* credentials the sending pipeline already reads — no change needed to any send method. */
  async activatePhoneNumber(businessId: string, id: string) {
    const preset = await this.prisma.waPhoneNumber.findFirst({ where: { id, businessId } });
    if (!preset) throw new Error('Number not found');

    await this.saveCredentials(businessId, {
      token: preset.accessToken,
      phoneId: preset.phoneNumberId,
      wabaId: preset.businessAccountId,
      storeNum: preset.storeNotifyNumber ?? undefined,
    });

    await this.prisma.$transaction([
      this.prisma.waPhoneNumber.updateMany({ where: { businessId }, data: { isActive: false } }),
      this.prisma.waPhoneNumber.update({ where: { id }, data: { isActive: true } }),
    ]);

    return this.listPhoneNumbers(businessId);
  }

  // ── Business profile (Meta's own "About this business" panel) ─────────────────

  async getBusinessProfile() {
    if (!this.token || !this.phoneId) return { error: 'WhatsApp not configured' };
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${this.phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
      const data = await res.json();
      if (!res.ok) return { error: data };
      return data?.data?.[0] ?? {};
    } catch (err) {
      return { error: String(err) };
    }
  }

  async updateBusinessProfile(dto: {
    about?: string; address?: string; description?: string; email?: string; websites?: string[]; vertical?: string;
  }) {
    if (!this.token || !this.phoneId) return { ok: false, error: 'WhatsApp not configured' };
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${this.phoneId}/whatsapp_business_profile`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...dto }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // ── Message log ──────────────────────────────────────────────────────────────

  async listMessages(
    businessId: string,
    page = 1,
    limit = 30,
    direction?: 'OUTBOUND' | 'INBOUND',
    status?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
  ) {
    const where = { businessId, ...(direction ? { direction } : {}), ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.waMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.waMessage.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // ── Conversations (chat inbox) ──────────────────────────────────────────────

  /**
   * Lightweight count for the Sidebar nav badge — deliberately not reusing
   * listConversations (which joins customers/conversation-meta and does a
   * DISTINCT ON scan) since this gets polled from every page in the app,
   * not just while PaVa Connect is open.
   */
  async getUnreadCount(businessId: string): Promise<number> {
    return this.prisma.waMessage.count({
      where: { businessId, direction: 'INBOUND', readByStaffAt: null },
    });
  }

  /**
   * One row per phone number: the latest message (either direction) plus an
   * unread count (inbound messages staff haven't opened yet). Uses Postgres
   * DISTINCT ON since Prisma has no "latest row per group" primitive.
   */
  async listConversations(businessId: string) {
    const latest = await this.prisma.$queryRaw<{
      phone: string; bodyPreview: string | null; messageType: string;
      direction: string; createdAt: Date; status: string;
    }[]>`
      SELECT DISTINCT ON (phone) phone, "bodyPreview", "messageType", direction, "createdAt", status
      FROM wa_message
      WHERE "businessId" = ${businessId}
      ORDER BY phone, "createdAt" DESC`;

    const unreadRows = await this.prisma.waMessage.groupBy({
      by: ['phone'],
      where: { businessId, direction: 'INBOUND', readByStaffAt: null },
      _count: { _all: true },
    });
    const unreadMap = new Map(unreadRows.map(r => [r.phone, r._count._all]));

    const phones = latest.map(l => l.phone);
    const [customers, convMeta] = await Promise.all([
      this.prisma.customer.findMany({
        where: { businessId, phone: { in: phones } },
        select: { phone: true, name: true },
      }),
      this.prisma.waConversation.findMany({
        where: { businessId, phone: { in: phones } },
        select: {
          phone: true, status: true, pinned: true, labels: true, assignedToUserId: true,
          assignedTo: { select: { fullName: true } },
        },
      }),
    ]);
    const nameMap = new Map(customers.map(c => [c.phone, c.name]));
    const metaMap = new Map(convMeta.map(m => [m.phone, m]));

    return latest
      .map(l => {
        const meta = metaMap.get(l.phone);
        return {
          phone: l.phone,
          customerName: nameMap.get(l.phone) ?? null,
          lastMessage: l.bodyPreview,
          lastMessageType: l.messageType,
          lastDirection: l.direction,
          lastAt: l.createdAt,
          lastStatus: l.status,
          unreadCount: unreadMap.get(l.phone) ?? 0,
          convStatus: meta?.status ?? 'OPEN',
          pinned: meta?.pinned ?? false,
          labels: meta?.labels ?? [],
          assignedToUserId: meta?.assignedToUserId ?? null,
          assignedToName: meta?.assignedTo?.fullName ?? null,
        };
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
      });
  }

  /** Fetches or lazily creates the organization state (status/pinned/labels/assignment) for one conversation. */
  async getConversationMeta(businessId: string, phone: string) {
    const to = this.e164(phone) ?? phone;
    const meta = await this.prisma.waConversation.findUnique({
      where: { businessId_phone: { businessId, phone: to } },
      include: { assignedTo: { select: { fullName: true } } },
    });
    return meta ?? { status: 'OPEN' as const, pinned: false, labels: [] as string[], assignedToUserId: null, assignedTo: null };
  }

  async updateConversationMeta(businessId: string, phone: string, data: {
    status?: 'OPEN' | 'RESOLVED'; pinned?: boolean; labels?: string[]; assignedToUserId?: string | null;
  }) {
    const to = this.e164(phone) ?? phone;
    const meta = await this.prisma.waConversation.upsert({
      where:  { businessId_phone: { businessId, phone: to } },
      update: data,
      create: { businessId, phone: to, ...data },
      include: { assignedTo: { select: { fullName: true } } },
    });

    if (data.assignedToUserId !== undefined) {
      try {
        this.events.emitToBusiness(businessId, Events.WA_CONVERSATION_ASSIGNED, {
          phone: to,
          assignedToUserId: meta.assignedToUserId,
          assignedToName: meta.assignedTo?.fullName ?? null,
        });
      } catch { /* fire-and-forget */ }
    }

    return meta;
  }

  /** Simple substring search over logged message previews (max ~200 chars/message), grouped to matching conversations. */
  async searchMessages(businessId: string, query: string) {
    const q = query.trim();
    if (!q) return [];
    const rows = await this.prisma.$queryRaw<{ phone: string; bodyPreview: string | null; createdAt: Date }[]>`
      SELECT DISTINCT ON (phone) phone, "bodyPreview", "createdAt"
      FROM wa_message
      WHERE "businessId" = ${businessId} AND "bodyPreview" ILIKE ${'%' + q + '%'}
      ORDER BY phone, "createdAt" DESC
      LIMIT 30`;
    const phones = rows.map(r => r.phone);
    const customers = phones.length
      ? await this.prisma.customer.findMany({ where: { businessId, phone: { in: phones } }, select: { phone: true, name: true } })
      : [];
    const nameMap = new Map(customers.map(c => [c.phone, c.name]));
    return rows
      .map(r => ({ phone: r.phone, customerName: nameMap.get(r.phone) ?? null, matchPreview: r.bodyPreview, lastAt: r.createdAt }))
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }

  /** Paginated thread for one phone number, newest page first — frontend reverses for display. */
  async getConversationMessages(businessId: string, phone: string, page = 1, limit = 50) {
    const where = { businessId, phone };
    const [items, total] = await Promise.all([
      this.prisma.waMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.waMessage.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Contact card for the chat sidebar: linked Customer (if any), online orders, and POS purchase history. */
  async getContactInfo(businessId: string, phone: string) {
    const to = this.e164(phone) ?? phone;
    const customer = await this.prisma.customer.findFirst({
      where: { businessId, phone: to },
      select: {
        id: true, name: true, email: true, customerCode: true,
        outstandingBalance: true, creditLimit: true, loyaltyPoints: true,
      },
    });
    const [orderCount, lastOrder, posBillCount, lastPosBill] = await Promise.all([
      this.prisma.onlineOrder.count({ where: { businessId, customerPhone: to } }),
      this.prisma.onlineOrder.findFirst({
        where: { businessId, customerPhone: to },
        orderBy: { createdAt: 'desc' },
        select: { orderNumber: true, status: true, total: true, createdAt: true },
      }),
      this.prisma.salesBill.count({ where: { businessId, customerPhone: to, status: { not: 'CANCELLED' } } }),
      this.prisma.salesBill.findFirst({
        where: { businessId, customerPhone: to, status: { not: 'CANCELLED' } },
        orderBy: { billDate: 'desc' },
        select: { billNumber: true, grandTotal: true, billDate: true },
      }),
    ]);
    return {
      phone: to,
      customerId:   customer?.id ?? null,
      name:         customer?.name ?? null,
      email:        customer?.email ?? null,
      customerCode: customer?.customerCode ?? null,
      outstandingBalance: customer?.outstandingBalance ?? null,
      creditLimit:        customer?.creditLimit ?? null,
      loyaltyPoints:      customer?.loyaltyPoints ?? null,
      orderCount,
      lastOrder,
      posBillCount,
      lastPosBill,
    };
  }

  /** Creates a Customer for this number if none exists yet, or renames the existing one. */
  async saveContactName(businessId: string, phone: string, name: string) {
    const to = this.e164(phone) ?? phone;
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Name is required');

    const existing = await this.prisma.customer.findFirst({ where: { businessId, phone: to } });
    if (existing) {
      await this.prisma.customer.update({ where: { id: existing.id }, data: { name: trimmed } });
    } else {
      await this.prisma.customer.create({
        data: { businessId, name: trimmed, phone: to, channel: 'ONLINE' },
      });
    }
    return this.getContactInfo(businessId, phone);
  }

  /** Marks all unread inbound messages in this conversation as read by staff. */
  async markConversationRead(businessId: string, phone: string) {
    const unread = await this.prisma.waMessage.findMany({
      where: { businessId, phone, direction: 'INBOUND', readByStaffAt: null },
      select: { waMessageId: true },
    });

    const result = await this.prisma.waMessage.updateMany({
      where: { businessId, phone, direction: 'INBOUND', readByStaffAt: null },
      data: { readByStaffAt: new Date() },
    });

    // Tell Meta so the customer sees blue read ticks — best-effort, doesn't
    // block the staff-side read tracking above if Meta's API is unavailable.
    if (this.token && this.phoneId) {
      for (const m of unread) {
        fetch(`https://graph.facebook.com/${API_VERSION}/${this.phoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: m.waMessageId }),
        }).catch(() => null);
      }
    }

    return { updated: result.count };
  }

  /**
   * Shows the "typing…" indicator to the customer for a few seconds — piggybacks
   * on the same read-receipt call, attached to their most recent inbound message.
   * Best-effort/fire-and-forget: not worth failing the UI over.
   */
  async sendTypingIndicator(businessId: string, phone: string): Promise<void> {
    if (!this.token || !this.phoneId) return;
    const lastInbound = await this.prisma.waMessage.findFirst({
      where: { businessId, phone: this.e164(phone) ?? phone, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { waMessageId: true },
    });
    if (!lastInbound) return;
    fetch(`https://graph.facebook.com/${API_VERSION}/${this.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: lastInbound.waMessageId,
        typing_indicator: { type: 'text' },
      }),
    }).catch(() => null);
  }

  /**
   * Whether a free-text reply can currently be sent — Meta only allows
   * non-template messages within 24h of the customer's last inbound message.
   */
  async getSessionWindowStatus(businessId: string, phone: string) {
    const lastInbound = await this.prisma.waMessage.findFirst({
      where: { businessId, phone, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!lastInbound) return { open: false, expiresAt: null };
    const expiresAt = new Date(lastInbound.createdAt.getTime() + 24 * 60 * 60 * 1000);
    return { open: expiresAt.getTime() > Date.now(), expiresAt };
  }

  /** Sends a free-text reply within an open session window. */
  async sendReply(businessId: string, phone: string, text: string): Promise<{ ok: boolean; reason?: string }> {
    const window = await this.getSessionWindowStatus(businessId, phone);
    if (!window.open) {
      return { ok: false, reason: 'Session window closed — customer must message first (Meta 24h rule). Send a template instead.' };
    }
    try {
      await this.sendTextMessage(businessId, phone, text);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  }

  /** Sends an image reply within an open session window. Uploads the file to Meta first, then references it by media id. */
  async sendImageReply(
    businessId: string,
    phone: string,
    file: { buffer: Buffer; mimeType: string; filename: string },
  ): Promise<{ ok: boolean; reason?: string }> {
    return this.sendMediaReply(businessId, phone, file, 'image', 'IMAGE', '[Image]');
  }

  /** Send any document (PDF, invoice, etc.) — same flow as images, different Meta message type. */
  async sendDocumentReply(
    businessId: string,
    phone: string,
    file: { buffer: Buffer; mimeType: string; filename: string },
  ): Promise<{ ok: boolean; reason?: string }> {
    return this.sendMediaReply(businessId, phone, file, 'document', 'DOCUMENT', `[Document] ${file.filename}`);
  }

  private async sendMediaReply(
    businessId: string,
    phone: string,
    file: { buffer: Buffer; mimeType: string; filename: string },
    metaType: 'image' | 'document',
    messageType: string,
    bodyPreview: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    const window = await this.getSessionWindowStatus(businessId, phone);
    if (!window.open) {
      return { ok: false, reason: 'Session window closed — customer must message first (Meta 24h rule). Send a template instead.' };
    }
    if (!this.enabled) return { ok: false, reason: 'WhatsApp not configured' };
    const to = this.e164(phone);
    if (!to) return { ok: false, reason: 'Invalid phone number' };

    try {
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename);
      const uploadRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${this.phoneId}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
        body: form,
      });
      const uploadData = await uploadRes.json() as { id?: string; error?: unknown };
      if (!uploadRes.ok || !uploadData.id) {
        return { ok: false, reason: JSON.stringify(uploadData) };
      }

      const mediaPayload = metaType === 'document'
        ? { id: uploadData.id, filename: file.filename }
        : { id: uploadData.id };
      const result = await this.logAndSend(
        businessId,
        { to, type: metaType, [metaType]: mediaPayload },
        { phone: to, messageType, bodyPreview, mediaId: uploadData.id },
      );
      if (!result.ok) return { ok: false, reason: JSON.stringify(result.data) };
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  }

  /** Sends an emoji reaction to a specific inbound/outbound message. Pass emoji: '' to remove a reaction. */
  async sendReaction(businessId: string, phone: string, messageId: string, emoji: string): Promise<{ ok: boolean; reason?: string }> {
    const window = await this.getSessionWindowStatus(businessId, phone);
    if (!window.open) return { ok: false, reason: 'Session window closed — customer must message first (Meta 24h rule).' };
    if (!this.enabled) return { ok: false, reason: 'WhatsApp not configured' };
    const to = this.e164(phone);
    if (!to) return { ok: false, reason: 'Invalid phone number' };

    const result = await this.logAndSend(
      businessId,
      { to, type: 'reaction', reaction: { message_id: messageId, emoji } },
      { phone: to, messageType: 'REACTION', bodyPreview: emoji || '(removed)' },
    );
    if (!result.ok) return { ok: false, reason: JSON.stringify(result.data) };
    return { ok: true };
  }

  /** Sends the store's location as a native WhatsApp location message. */
  async sendLocation(
    businessId: string, phone: string,
    location: { latitude: number; longitude: number; name?: string; address?: string },
    opts?: { isAutoReply?: boolean },
  ): Promise<{ ok: boolean; reason?: string }> {
    const window = await this.getSessionWindowStatus(businessId, phone);
    if (!window.open) return { ok: false, reason: 'Session window closed — customer must message first (Meta 24h rule).' };
    if (!this.enabled) return { ok: false, reason: 'WhatsApp not configured' };
    const to = this.e164(phone);
    if (!to) return { ok: false, reason: 'Invalid phone number' };

    const result = await this.logAndSend(
      businessId,
      { to, type: 'location', location },
      {
        phone: to, messageType: 'LOCATION',
        bodyPreview: location.name ?? `${location.latitude},${location.longitude}`,
        isAutoReply: opts?.isAutoReply,
      },
    );
    if (!result.ok) return { ok: false, reason: JSON.stringify(result.data) };
    return { ok: true };
  }

  /**
   * Downloads a media object's bytes from Meta so it can be proxied to the
   * browser — Meta's media URLs are short-lived and require the same bearer
   * token, so they can't be hotlinked directly in an <img> tag.
   */
  async getMediaBuffer(mediaId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    if (!this.token) return null;
    try {
      const metaRes = await fetch(`https://graph.facebook.com/${API_VERSION}/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!metaRes.ok) return null;
      const meta = await metaRes.json() as { url?: string; mime_type?: string };
      if (!meta.url) return null;

      const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${this.token}` } });
      if (!fileRes.ok) return null;
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      return { buffer, mimeType: meta.mime_type ?? 'application/octet-stream' };
    } catch (err) {
      this.logger.error(`Failed to fetch WhatsApp media ${mediaId}: ${err}`);
      return null;
    }
  }

  // ── Campaigns ────────────────────────────────────────────────────────────────

  /**
   * Customers whose birthday is today, opted in to WhatsApp. Month/day match
   * (not full date) since we only care about the anniversary, not the year —
   * Prisma has no date-part filter, hence the raw query.
   */
  async getTodaysBirthdays(businessId: string) {
    return this.prisma.$queryRaw<{
      id: string; name: string; phone: string | null; dateOfBirth: Date;
    }[]>`
      SELECT id, name, phone, "dateOfBirth"
      FROM customer
      WHERE "businessId" = ${businessId}
        AND "whatsappOptIn" = true
        AND "dateOfBirth" IS NOT NULL
        AND EXTRACT(MONTH FROM "dateOfBirth") = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM "dateOfBirth") = EXTRACT(DAY FROM CURRENT_DATE)
      ORDER BY name`;
  }

  /** Segment definitions for broadcast campaigns, with live counts. */
  async getCampaignSegments(businessId: string) {
    const allOptedIn = await this.prisma.customer.count({
      where: { businessId, whatsappOptIn: true, phone: { not: null } },
    });
    const winBackRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM customer c
      WHERE c."businessId" = ${businessId}
        AND c."whatsappOptIn" = true
        AND c.phone IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM online_order o
          WHERE o."customerPhone" = c.phone AND o."businessId" = ${businessId}
            AND o."createdAt" > NOW() - INTERVAL '30 days'
        )`;
    return [
      { id: 'ALL_OPTED_IN', label: 'All opted-in customers',           count: allOptedIn },
      { id: 'WIN_BACK_30D', label: 'No orders in 30+ days (win-back)', count: Number(winBackRows[0]?.count ?? 0) },
    ];
  }

  private async getSegmentCustomers(businessId: string, segmentId: string): Promise<{ phone: string; name: string }[]> {
    if (segmentId === 'ALL_OPTED_IN') {
      const rows = await this.prisma.customer.findMany({
        where: { businessId, whatsappOptIn: true, phone: { not: null } },
        select: { phone: true, name: true },
      });
      return rows.filter((r): r is { phone: string; name: string } => !!r.phone);
    }
    if (segmentId === 'WIN_BACK_30D') {
      return this.prisma.$queryRaw<{ phone: string; name: string }[]>`
        SELECT c.phone, c.name FROM customer c
        WHERE c."businessId" = ${businessId}
          AND c."whatsappOptIn" = true
          AND c.phone IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM online_order o
            WHERE o."customerPhone" = c.phone AND o."businessId" = ${businessId}
              AND o."createdAt" > NOW() - INTERVAL '30 days'
          )`;
    }
    return [];
  }

  /** Sends an approved template to every customer in a segment. Sequential to stay well under Meta's rate limits. */
  async sendCampaign(businessId: string, segmentId: string, templateName: string, language: string, params: string[]) {
    const customers = await this.getSegmentCustomers(businessId, segmentId);
    let sent = 0, failed = 0;
    for (const c of customers) {
      const result = await this.sendTemplateToNumber(businessId, c.phone, templateName, language, params);
      if (result.ok) sent++; else failed++;
    }
    return { total: customers.length, sent, failed };
  }

  // ── Auto-reply (rule-based) ─────────────────────────────────────────────────

  private static readonly AUTOREPLY_KEYS = {
    enabled:        'wa.autoreply_enabled',
    storeHours:     'wa.store_hours_text',
    locationLat:    'wa.store_location_lat',
    locationLng:    'wa.store_location_lng',
    locationName:   'wa.store_location_name',
    locationAddr:   'wa.store_location_address',
  } as const;

  async getAutoReplySettings(businessId: string) {
    const rows = await this.prisma.systemSetting.findMany({
      where: { businessId, key: { in: Object.values(WhatsAppService.AUTOREPLY_KEYS) } },
    });
    const map = new Map(rows.map(r => [r.key, r.value]));
    return {
      enabled:        map.get(WhatsAppService.AUTOREPLY_KEYS.enabled) === 'true',
      storeHours:     map.get(WhatsAppService.AUTOREPLY_KEYS.storeHours) ?? '',
      locationLat:    map.get(WhatsAppService.AUTOREPLY_KEYS.locationLat) ?? '',
      locationLng:    map.get(WhatsAppService.AUTOREPLY_KEYS.locationLng) ?? '',
      locationName:   map.get(WhatsAppService.AUTOREPLY_KEYS.locationName) ?? '',
      locationAddr:   map.get(WhatsAppService.AUTOREPLY_KEYS.locationAddr) ?? '',
    };
  }

  async updateAutoReplySettings(businessId: string, data: {
    enabled?: boolean; storeHours?: string;
    locationLat?: string; locationLng?: string; locationName?: string; locationAddr?: string;
  }) {
    const ops: Promise<any>[] = [];
    const upsert = (key: string, value: string) =>
      this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      });
    if (data.enabled !== undefined)      ops.push(upsert(WhatsAppService.AUTOREPLY_KEYS.enabled, String(data.enabled)));
    if (data.storeHours !== undefined)   ops.push(upsert(WhatsAppService.AUTOREPLY_KEYS.storeHours, data.storeHours));
    if (data.locationLat !== undefined)  ops.push(upsert(WhatsAppService.AUTOREPLY_KEYS.locationLat, data.locationLat));
    if (data.locationLng !== undefined)  ops.push(upsert(WhatsAppService.AUTOREPLY_KEYS.locationLng, data.locationLng));
    if (data.locationName !== undefined) ops.push(upsert(WhatsAppService.AUTOREPLY_KEYS.locationName, data.locationName));
    if (data.locationAddr !== undefined) ops.push(upsert(WhatsAppService.AUTOREPLY_KEYS.locationAddr, data.locationAddr));
    await Promise.all(ops);
    return this.getAutoReplySettings(businessId);
  }

  /**
   * Called from the webhook right after an inbound message is logged.
   * Rule-based only — no AI — so behavior is predictable and auditable:
   *   1. Opt-in/opt-out keyword (START/SUBSCRIBE, STOP/UNSUBSCRIBE) — exact match, not substring
   *   2. A recognized menu button tap (Track Order / Store Hours / Talk to Staff)
   *   3. Keyword match in free text (order/status/track, hours/timing)
   *   4. First-ever inbound message from this number → welcome menu
   */
  async handleAutoReply(businessId: string, phone: string, opts: {
    messageBody?: string; buttonId?: string; listReplyId?: string; senderName?: string;
  }): Promise<void> {
    if (!(await this.getAutoReplySettings(businessId)).enabled) return;

    // Exact match (not substring) — opting someone in/out by accident is worse
    // than missing a loose keyword match, so this is deliberately strict.
    const exact = (opts.messageBody ?? '').trim().toLowerCase();
    if (exact === 'start' || exact === 'subscribe' || exact === 'join') {
      return this.autoReplyOptIn(businessId, phone, opts.senderName);
    }
    if (exact === 'stop' || exact === 'unsubscribe') {
      return this.autoReplyOptOut(businessId, phone);
    }

    const selection = opts.buttonId ?? opts.listReplyId;
    if (selection === 'WA_TRACK_ORDER')    return this.autoReplyOrderStatus(businessId, phone);
    if (selection === 'WA_STORE_HOURS')    return this.autoReplyStoreHours(businessId, phone);
    if (selection === 'WA_TALK_STAFF')     return this.autoReplyText(businessId, phone, "Sure! A team member will reply to you here shortly. 🙏");
    if (selection === 'WA_BROWSE_STORE')   return this.autoReplyText(businessId, phone, "🛒 Browse and order online here: https://shop.srivani.com");
    if (selection === 'WA_STORE_LOCATION') return this.autoReplyStoreLocation(businessId, phone);

    const body = exact;
    if (/order|status|track/.test(body)) return this.autoReplyOrderStatus(businessId, phone);
    if (/hour|timing|open|close/.test(body)) return this.autoReplyStoreHours(businessId, phone);

    // Greet only on the very first inbound message ever received from this number
    // (the current message has already been logged by the time this runs).
    const inboundCount = await this.prisma.waMessage.count({ where: { businessId, phone: this.e164(phone) ?? phone, direction: 'INBOUND' } });
    if (inboundCount <= 1) return this.autoReplyWelcome(businessId, phone);
  }

  /** Opt-in keyword handler: creates the Customer if needed and flags whatsappOptIn=true. */
  private async autoReplyOptIn(businessId: string, phone: string, senderName?: string) {
    const to = this.e164(phone);
    if (!to) return;
    const existing = await this.prisma.customer.findFirst({ where: { businessId, phone: to } });
    if (existing) {
      if (!existing.whatsappOptIn) {
        await this.prisma.customer.update({ where: { id: existing.id }, data: { whatsappOptIn: true } });
      }
    } else {
      await this.prisma.customer.create({
        data: { businessId, name: senderName?.trim() || `+${to}`, phone: to, channel: 'ONLINE', whatsappOptIn: true },
      });
    }
    await this.autoReplyText(businessId, phone, "✅ You're subscribed! We'll send order updates and offers here. Reply STOP anytime to unsubscribe.");
  }

  /** Opt-out keyword handler: flips whatsappOptIn=false, doesn't delete the contact. */
  private async autoReplyOptOut(businessId: string, phone: string) {
    const to = this.e164(phone);
    if (!to) return;
    await this.prisma.customer.updateMany({ where: { businessId, phone: to }, data: { whatsappOptIn: false } });
    await this.autoReplyText(businessId, phone, "You've been unsubscribed from offers and updates. Message START anytime to opt back in.");
  }

  private async autoReplyWelcome(businessId: string, phone: string) {
    await this.autoReplyInteractiveList(
      businessId, phone,
      "Hi! 👋 Welcome to Srivani Stores. How can we help you today?",
      'Menu',
      [
        { id: 'WA_TRACK_ORDER',  title: 'Track Order',   description: 'Check the status of your latest order' },
        { id: 'WA_BROWSE_STORE',   title: 'Browse Store',   description: 'Shop online at shop.srivani.com' },
        { id: 'WA_STORE_HOURS',    title: 'Store Hours',    description: 'When we\'re open' },
        { id: 'WA_STORE_LOCATION', title: 'Store Location', description: 'Get directions to our store' },
        { id: 'WA_TALK_STAFF',     title: 'Talk to Staff',  description: 'Chat with our team directly' },
      ],
    );
  }

  private async autoReplyStoreHours(businessId: string, phone: string) {
    const { storeHours } = await this.getAutoReplySettings(businessId);
    const hours = storeHours || 'Please contact the store directly for our timings.';
    await this.autoReplyText(businessId, phone, `🕒 Our store hours:\n${hours}`);
  }

  private async autoReplyStoreLocation(businessId: string, phone: string) {
    const s = await this.getAutoReplySettings(businessId);
    const lat = parseFloat(s.locationLat);
    const lng = parseFloat(s.locationLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      await this.sendLocation(businessId, phone, {
        latitude: lat, longitude: lng,
        name: s.locationName || undefined,
        address: s.locationAddr || undefined,
      }, { isAutoReply: true });
      return;
    }
    const fallback = s.locationAddr || 'Please contact the store directly for directions.';
    await this.autoReplyText(businessId, phone, `📍 Our location:\n${fallback}`);
  }

  private async autoReplyOrderStatus(businessId: string, phone: string) {
    const to = this.e164(phone);
    const order = to
      ? await this.prisma.onlineOrder.findFirst({
          where: { businessId, customerPhone: to },
          orderBy: { createdAt: 'desc' },
          select: { orderNumber: true, status: true, total: true },
        })
      : null;
    if (!order) {
      await this.autoReplyText(
        businessId, phone,
        "We couldn't find a recent order for this number. If you've just placed one, it may take a minute to show — reply here and our team will check for you.",
      );
      return;
    }
    await this.autoReplyText(
      businessId, phone,
      `📦 Your latest order *${order.orderNumber}* — Total ₹${order.total.toFixed(0)}\nStatus: *${order.status}*`,
    );
  }

  private async autoReplyText(businessId: string, phone: string, body: string) {
    const to = this.e164(phone);
    if (!to) return;
    await this.logAndSend(
      businessId,
      { to, type: 'text', text: { body, preview_url: false } },
      { phone: to, messageType: 'TEXT', bodyPreview: body, isAutoReply: true },
    );
  }

  private async autoReplyInteractiveButtons(businessId: string, phone: string, bodyText: string, buttons: { id: string; title: string }[]) {
    const to = this.e164(phone);
    if (!to) return;
    await this.logAndSend(
      businessId,
      {
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
        },
      },
      { phone: to, messageType: 'INTERACTIVE_BUTTON', bodyPreview: bodyText, isAutoReply: true },
    );
  }

  private async autoReplyInteractiveList(
    businessId: string, phone: string, bodyText: string, buttonLabel: string,
    rows: { id: string; title: string; description?: string }[],
  ) {
    const to = this.e164(phone);
    if (!to) return;
    await this.logAndSend(
      businessId,
      {
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonLabel,
            sections: [{ title: 'Options', rows: rows.map(r => ({ id: r.id, title: r.title, description: r.description })) }],
          },
        },
      },
      { phone: to, messageType: 'INTERACTIVE_LIST', bodyPreview: bodyText, isAutoReply: true },
    );
  }

  // ── Core sender ────────────────────────────────────────────────────────────

  private async post(payload: object): Promise<{ ok: boolean; skipped?: boolean; data: any }> {
    if (!this.enabled) {
      this.logger.warn('WhatsApp not configured — skipping (set WA_ACCESS_TOKEN + WA_PHONE_NUMBER_ID)');
      return { ok: false, skipped: true, data: null };
    }
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${this.phoneId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        this.logger.error(`WhatsApp API ${res.status}: ${JSON.stringify(data)}`);
        return { ok: false, data };
      }
      this.logger.log(`WhatsApp sent → ${JSON.stringify((data as any)?.messages?.[0])}`);
      return { ok: true, data };
    } catch (err) {
      this.logger.error(`WhatsApp send failed: ${err}`);
      return { ok: false, data: { error: String(err) } };
    }
  }

  /**
   * Wraps post() with a WaMessage log row so every outbound send is
   * correlated to Meta's message id — this is what makes delivery/read
   * status (arriving later via the webhook's `statuses[]`) traceable back
   * to a specific send, and makes failures visible instead of log-only.
   */
  private async logAndSend(
    businessId: string,
    payload: object,
    meta: {
      phone: string;
      messageType: string;
      templateName?: string;
      bodyPreview?: string;
      relatedType?: string;
      relatedId?: string;
      mediaId?: string;
      isAutoReply?: boolean;
    },
  ): Promise<{ ok: boolean; skipped?: boolean; data: any }> {
    const result = await this.post(payload);
    if (result.skipped) return result; // WhatsApp not configured — nothing to log

    try {
      const messageId = result.ok ? (result.data as any)?.messages?.[0]?.id : undefined;
      await this.prisma.waMessage.create({
        data: {
          businessId,
          waMessageId: messageId ?? `failed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          direction: 'OUTBOUND',
          phone: meta.phone,
          messageType: meta.messageType,
          templateName: meta.templateName,
          bodyPreview: meta.bodyPreview?.slice(0, 200),
          mediaId: meta.mediaId,
          isAutoReply: meta.isAutoReply ?? false,
          status: result.ok ? 'SENT' : 'FAILED',
          errorMessage: result.ok ? undefined : JSON.stringify(result.data).slice(0, 500),
          relatedType: meta.relatedType,
          relatedId: meta.relatedId,
          sentAt: result.ok ? new Date() : undefined,
        },
      });
      try {
        this.events.emitToBusiness(businessId, Events.WA_MESSAGE_SENT, {
          phone: meta.phone,
          direction: 'OUTBOUND',
          bodyPreview: meta.bodyPreview?.slice(0, 200) ?? null,
          messageType: meta.messageType,
          createdAt: new Date().toISOString(),
        });
      } catch { /* fire-and-forget */ }
    } catch (err) {
      this.logger.error(`Failed to log outbound WaMessage: ${err}`);
    }
    return result;
  }

  /**
   * Free-form text message for scheduled report delivery.
   * Meta restriction: text (non-template) messages only reach recipients who
   * messaged this WhatsApp number within the last 24 hours. If reports stop
   * arriving, the recipient just needs to send any message to the store's
   * WhatsApp number to re-open the window. Email is the guaranteed channel.
   */
  async sendTextMessage(businessId: string, phone: string, body: string): Promise<void> {
    if (!this.enabled) throw new Error('WhatsApp not configured (token/phoneId missing)');
    const to = this.e164(phone);
    if (!to) throw new Error(`Invalid WhatsApp number: ${phone}`);
    await this.logAndSend(
      businessId,
      { to, type: 'text', text: { body, preview_url: false } },
      { phone: to, messageType: 'TEXT', bodyPreview: body },
    );
  }

  /**
   * Interactive reply-button message (Cloud API `type: "interactive"`, max 3
   * buttons, 20-char title limit). Same 24h session-window rule as free text.
   */
  async sendInteractiveButtons(
    businessId: string,
    phone: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    meta?: { relatedType?: string; relatedId?: string },
  ): Promise<void> {
    const to = this.e164(phone);
    if (!to) return;
    if (buttons.length === 0 || buttons.length > 3) {
      throw new Error('Interactive button messages support 1–3 buttons');
    }
    for (const b of buttons) {
      if (b.title.length > 20) {
        throw new Error(`Button title "${b.title}" exceeds Meta's 20-character limit`);
      }
    }
    await this.logAndSend(
      businessId,
      {
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title } })),
          },
        },
      },
      {
        phone: to,
        messageType: 'INTERACTIVE_BUTTON',
        bodyPreview: bodyText,
        relatedType: meta?.relatedType,
        relatedId: meta?.relatedId,
      },
    );
  }

  /**
   * Interactive list message — up to 10 rows total (across up to 10 sections),
   * shown in a scrollable menu rather than the 3-button cap of sendInteractiveButtons.
   * Same 24h session-window rule as free text.
   */
  async sendInteractiveList(
    businessId: string,
    phone: string,
    bodyText: string,
    buttonLabel: string,
    sections: { title: string; rows: { id: string; title: string; description?: string }[] }[],
    meta?: { relatedType?: string; relatedId?: string },
  ): Promise<void> {
    const to = this.e164(phone);
    if (!to) return;
    const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
    if (sections.length === 0 || sections.length > 10) {
      throw new Error('Interactive list messages support 1–10 sections');
    }
    if (totalRows === 0 || totalRows > 10) {
      throw new Error('Interactive list messages support up to 10 rows total across all sections');
    }
    await this.logAndSend(
      businessId,
      {
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: { button: buttonLabel, sections },
        },
      },
      {
        phone: to,
        messageType: 'INTERACTIVE_LIST',
        bodyPreview: bodyText,
        relatedType: meta?.relatedType,
        relatedId: meta?.relatedId,
      },
    );
  }

  private async sendTemplate(
    businessId: string,
    to: string,
    name: string,
    params: string[],
    meta?: { relatedType?: string; relatedId?: string },
  ): Promise<void> {
    await this.logAndSend(
      businessId,
      {
        to,
        type: 'template',
        template: {
          name,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: params.map(text => ({ type: 'text', text })),
            },
          ],
        },
      },
      {
        phone: to,
        messageType: 'TEMPLATE',
        templateName: name,
        bodyPreview: params.join(' | '),
        relatedType: meta?.relatedType,
        relatedId: meta?.relatedId,
      },
    );
  }

  // Normalize to E.164 Indian number (91XXXXXXXXXX)
  private e164(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    // Strip leading 91 country code if present, get last 10
    const local = digits.length >= 10 ? digits.slice(-10) : null;
    if (!local || !/^[6-9]\d{9}$/.test(local)) return null;
    return `91${local}`;
  }

  // ── Store notification ──────────────────────────────────────────────────────

  /**
   * Template: svn_new_order (previously "test_order")
   * Body: Hello! New order {{1}} from {{2}} ({{3}}).
   *       Items: {{4}} | Total: ₹{{5}} | {{6}} | {{7}}
   */
  async sendOrderAlert(businessId: string, order: {
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    total: number;
    paymentMethod: string;
    deliveryType: string;
    itemCount: number;
  }): Promise<void> {
    if (!this.storeNum) return;
    const to = this.e164(this.storeNum);
    if (!to) {
      this.logger.warn(`Invalid WA_STORE_NOTIFY_NUMBER: ${this.storeNum}`);
      return;
    }
    const delivery = order.deliveryType === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup';
    const payment  = order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Paid';
    await this.sendTemplate(businessId, to, 'test_order', [
      order.orderNumber,
      order.customerName,
      order.customerPhone,
      String(order.itemCount),
      order.total.toFixed(2),
      payment,
      delivery,
    ], { relatedType: 'ONLINE_ORDER', relatedId: order.orderNumber });
  }

  // ── Customer notifications ──────────────────────────────────────────────────

  /**
   * Template: svn_order_placed
   * Send to CUSTOMER when a COD order is placed (confirmed immediately).
   * For Razorpay orders, send after payment is verified instead.
   *
   * Body text to submit to Meta:
   *   Hello {{1}}, your order *{{2}}* has been placed at Srivani Stores! 🎉
   *   Total: ₹{{3}} | {{4}}
   *   We will keep you updated. Thank you for shopping with us! 🙏
   */
  async sendCustomerOrderPlaced(businessId: string, order: {
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    total: number;
    deliveryType: string;
  }): Promise<void> {
    const to = this.e164(order.customerPhone);
    if (!to) return;
    const delivery = order.deliveryType === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup';
    await this.sendTemplate(businessId, to, 'svn_order_placed', [
      order.customerName,
      order.orderNumber,
      order.total.toFixed(0),
      delivery,
    ], { relatedType: 'ONLINE_ORDER', relatedId: order.orderNumber });
  }

  /**
   * Template: svn_payment_done
   * Send to CUSTOMER after Razorpay payment is verified.
   *
   * Body text to submit to Meta:
   *   Hello {{1}}, payment of ₹{{2}} received! ✅
   *   Order *{{3}}* is confirmed. We will start preparing it now.
   *   - Srivani Stores
   */
  async sendCustomerPaymentConfirmed(businessId: string, order: {
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    total: number;
  }): Promise<void> {
    const to = this.e164(order.customerPhone);
    if (!to) return;
    await this.sendTemplate(businessId, to, 'svn_payment_done', [
      order.customerName,
      order.total.toFixed(0),
      order.orderNumber,
    ], { relatedType: 'ONLINE_ORDER', relatedId: order.orderNumber });
  }

  /**
   * Template: svn_order_update
   * Send to CUSTOMER on every status change.
   *
   * Body text to submit to Meta:
   *   Hello {{1}},
   *   Your order *{{2}}* update:
   *   {{3}}
   *   - Team Srivani Stores
   */
  async sendCustomerOrderUpdate(businessId: string, order: {
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    status: string;
    deliveryType?: string;
  }): Promise<void> {
    const to = this.e164(order.customerPhone);
    if (!to) return;

    // Home-delivery orders going READY get an in-chat "Confirm Receipt"
    // button instead of a text link — the tap is handled by the webhook's
    // button_reply branch, which calls OnlineOrdersService.confirmDelivery().
    if (order.status === 'READY' && order.deliveryType === 'HOME_DELIVERY') {
      await this.sendInteractiveButtons(
        businessId,
        order.customerPhone,
        `Hello ${order.customerName}, your order *${order.orderNumber}* is on the way! 🚴 Expected in 30–60 mins.\nTap below once you've received it.`,
        [{ id: `CONFIRM_DELIVERY:${order.orderNumber}`, title: 'Confirm Receipt' }],
        { relatedType: 'ONLINE_ORDER', relatedId: order.orderNumber },
      );
      return;
    }

    // Statuses match OnlineOrderStatus enum in schema.prisma
    const messages: Record<string, string> = {
      CONFIRMED:      'Your order is confirmed and we are preparing it! 🎉',
      PROCESSING:     'Your order is being prepared. 👨‍🍳',
      READY:          'Your order is ready for pickup at our store! 🏪', // STORE_PICKUP only — HOME_DELIVERY handled above
      DELIVERED:      'Your order has been delivered. Enjoy! 😊 Thank you for shopping with Srivani Stores.',
      CANCELLED:      'Your order has been cancelled. If you paid online, a refund will be processed in 5–7 working days.',
    };
    const msg = messages[order.status];
    if (!msg) return; // skip PENDING_PAYMENT, PENDING_COD, PAYMENT_FAILED

    await this.sendTemplate(businessId, to, 'svn_order_update', [
      order.customerName,
      order.orderNumber,
      msg,
    ], { relatedType: 'ONLINE_ORDER', relatedId: order.orderNumber });
  }

  /**
   * Template: svn_back_in_stock
   * Body: Hi {{1}}, {{2}} ({{3}}) is back in stock! Order now: {{4}}
   */
  async sendBackInStock(businessId: string, data: {
    customerPhone: string;
    customerName: string;
    productName: string;
    packLabel: string;
    productUrl: string;
  }): Promise<void> {
    const to = this.e164(data.customerPhone);
    if (!to) return;
    await this.sendTemplate(businessId, to, 'svn_back_in_stock', [
      data.customerName,
      data.productName,
      data.packLabel,
      data.productUrl,
    ], { relatedType: 'PRODUCT', relatedId: data.productName });
  }

  // ── Template management (Meta Graph API) ────────────────────────────────────

  async listTemplates() {
    if (!this.token || !this.wabaId) {
      return { error: 'WA_ACCESS_TOKEN or WA_BUSINESS_ACCOUNT_ID not configured' };
    }
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${this.wabaId}/message_templates?limit=100&fields=name,status,category,language,components,rejected_reason`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  async createTemplate(dto: {
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
    if (!this.token || !this.wabaId) {
      return { error: 'WA_ACCESS_TOKEN or WA_BUSINESS_ACCOUNT_ID not configured' };
    }
    const components: object[] = [];
    if (dto.headerText) {
      components.push({ type: 'HEADER', format: 'TEXT', text: dto.headerText });
    }
    components.push({ type: 'BODY', text: dto.bodyText });
    if (dto.footerText) {
      components.push({ type: 'FOOTER', text: dto.footerText });
    }
    if (dto.buttons && dto.buttons.length > 0) {
      const hasQuickReply = dto.buttons.some(b => b.type === 'QUICK_REPLY');
      const hasCta        = dto.buttons.some(b => b.type === 'PHONE_NUMBER' || b.type === 'URL');
      if (hasQuickReply && hasCta) {
        return { error: 'Meta does not allow mixing Quick Reply buttons with Call/Website buttons in one template' };
      }
      if (hasQuickReply && dto.buttons.length > 3) {
        return { error: 'Quick Reply templates support up to 3 buttons' };
      }
      if (hasCta && dto.buttons.length > 2) {
        return { error: 'Call/Website button templates support up to 2 buttons' };
      }
      components.push({ type: 'BUTTONS', buttons: dto.buttons });
    }
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${this.wabaId}/message_templates`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: dto.name,
          category: dto.category,
          language: dto.language,
          components,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.logger.error(`Template create failed: ${JSON.stringify(data)}`);
      }
      return data;
    } catch (err) {
      return { error: String(err) };
    }
  }

  async deleteTemplate(name: string) {
    if (!this.token || !this.wabaId) {
      return { error: 'WA_ACCESS_TOKEN or WA_BUSINESS_ACCOUNT_ID not configured' };
    }
    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${this.wabaId}/message_templates?name=${encodeURIComponent(name)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.token}` },
      });
      return await res.json();
    } catch (err) {
      return { error: String(err) };
    }
  }

  async sendTemplateToNumber(businessId: string, phone: string, templateName: string, language: string, params: string[]) {
    const to = this.e164(phone);
    if (!to) return { ok: false, reason: 'Invalid phone number' };
    if (!this.enabled) return { ok: false, reason: 'WhatsApp not configured' };

    const components: object[] = [];
    if (params.length > 0) {
      components.push({
        type: 'body',
        parameters: params.map(text => ({ type: 'text', text })),
      });
    }
    const result = await this.logAndSend(
      businessId,
      { to, type: 'template', template: { name: templateName, language: { code: language }, components } },
      { phone: to, messageType: 'TEMPLATE', templateName, bodyPreview: params.join(' | ') },
    );
    if (!result.ok) return { ok: false, reason: JSON.stringify((result.data as any)?.error?.message ?? result.data) };
    return { ok: true, to };
  }

  // ── Credential test ─────────────────────────────────────────────────────────

  /**
   * Send the pre-approved Meta "hello_world" template to any number.
   * Use this to verify credentials before submitting custom templates.
   */
  async sendHelloWorld(businessId: string, phone: string): Promise<{ ok: boolean; to: string | null; reason?: string }> {
    const to = this.e164(phone);
    if (!to) return { ok: false, to: null, reason: 'Invalid phone number' };
    if (!this.enabled) return { ok: false, to, reason: 'WhatsApp not configured — set WA_ACCESS_TOKEN and WA_PHONE_NUMBER_ID' };

    const result = await this.logAndSend(
      businessId,
      { to, type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } },
      { phone: to, messageType: 'TEMPLATE', templateName: 'hello_world' },
    );
    if (!result.ok) return { ok: false, to, reason: JSON.stringify(result.data) };
    return { ok: true, to };
  }

  // ── Phone number registration ───────────────────────────────────────────────

  /**
   * Activates a phone number for Cloud API sending/receiving. Meta requires
   * this one-time call (with a 6-digit two-step-verification PIN the business
   * chooses) before a number can move out of "Pending" status — this is what
   * the "Register phone number" button in Meta's own UI does under the hood.
   */
  async registerPhoneNumber(pin: string): Promise<{ ok: boolean; reason?: string }> {
    if (!this.token || !this.phoneId) return { ok: false, reason: 'WhatsApp not configured' };
    if (!/^\d{6}$/.test(pin)) return { ok: false, reason: 'PIN must be exactly 6 digits' };
    try {
      const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${this.phoneId}/register`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, reason: JSON.stringify(data) };
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: String(err) };
    }
  }
}
