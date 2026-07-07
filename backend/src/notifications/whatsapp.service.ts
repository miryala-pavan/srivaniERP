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

    if (data.token)    { ops.push(upsert(WA_KEYS.token,    data.token));    this._token    = data.token; }
    if (data.phoneId)  { ops.push(upsert(WA_KEYS.phoneId,  data.phoneId));  this._phoneId  = data.phoneId; }
    if (data.wabaId)   { ops.push(upsert(WA_KEYS.wabaId,   data.wabaId));   this._wabaId   = data.wabaId; }
    if (data.storeNum) { ops.push(upsert(WA_KEYS.storeNum, data.storeNum)); this._storeNum = data.storeNum; }

    await Promise.all(ops);
    return this.getCredentials();
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
    const customers = phones.length
      ? await this.prisma.customer.findMany({
          where: { businessId, phone: { in: phones } },
          select: { phone: true, name: true },
        })
      : [];
    const nameMap = new Map(customers.map(c => [c.phone, c.name]));

    return latest
      .map(l => ({
        phone: l.phone,
        customerName: nameMap.get(l.phone) ?? null,
        lastMessage: l.bodyPreview,
        lastMessageType: l.messageType,
        lastDirection: l.direction,
        lastAt: l.createdAt,
        lastStatus: l.status,
        unreadCount: unreadMap.get(l.phone) ?? 0,
      }))
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

  /** Marks all unread inbound messages in this conversation as read by staff. */
  async markConversationRead(businessId: string, phone: string) {
    const result = await this.prisma.waMessage.updateMany({
      where: { businessId, phone, direction: 'INBOUND', readByStaffAt: null },
      data: { readByStaffAt: new Date() },
    });
    return { updated: result.count };
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
}
