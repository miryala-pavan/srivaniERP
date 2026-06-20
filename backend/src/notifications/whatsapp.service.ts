import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

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

  // ── Core sender ────────────────────────────────────────────────────────────

  private async post(payload: object): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('WhatsApp not configured — skipping (set WA_ACCESS_TOKEN + WA_PHONE_NUMBER_ID)');
      return;
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
      } else {
        this.logger.log(`WhatsApp sent → ${JSON.stringify((data as any)?.messages?.[0])}`);
      }
    } catch (err) {
      this.logger.error(`WhatsApp send failed: ${err}`);
    }
  }

  private sendTemplate(to: string, name: string, params: string[]): Promise<void> {
    return this.post({
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
    });
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
  async sendOrderAlert(order: {
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
    await this.sendTemplate(to, 'test_order2', [
      order.orderNumber,
      order.customerName,
      order.customerPhone,
      String(order.itemCount),
      order.total.toFixed(2),
      payment,
      delivery,
    ]);
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
  async sendCustomerOrderPlaced(order: {
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    total: number;
    deliveryType: string;
  }): Promise<void> {
    const to = this.e164(order.customerPhone);
    if (!to) return;
    const delivery = order.deliveryType === 'HOME_DELIVERY' ? 'Home Delivery' : 'Store Pickup';
    await this.sendTemplate(to, 'svn_order_placed', [
      order.customerName,
      order.orderNumber,
      order.total.toFixed(0),
      delivery,
    ]);
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
  async sendCustomerPaymentConfirmed(order: {
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    total: number;
  }): Promise<void> {
    const to = this.e164(order.customerPhone);
    if (!to) return;
    await this.sendTemplate(to, 'svn_payment_done', [
      order.customerName,
      order.total.toFixed(0),
      order.orderNumber,
    ]);
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
  async sendCustomerOrderUpdate(order: {
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    status: string;
    deliveryType?: string;
  }): Promise<void> {
    const to = this.e164(order.customerPhone);
    if (!to) return;

    // Statuses match OnlineOrderStatus enum in schema.prisma
    const messages: Record<string, string> = {
      CONFIRMED:      'Your order is confirmed and we are preparing it! 🎉',
      PROCESSING:     'Your order is being prepared. 👨‍🍳',
      READY:          order.deliveryType === 'HOME_DELIVERY'
                        ? 'Your order is on the way! 🚴 Expected in 30–60 mins.'
                        : 'Your order is ready for pickup at our store! 🏪',
      DELIVERED:      'Your order has been delivered. Enjoy! 😊 Thank you for shopping with Srivani Stores.',
      CANCELLED:      'Your order has been cancelled. If you paid online, a refund will be processed in 5–7 working days.',
    };
    const msg = messages[order.status];
    if (!msg) return; // skip PENDING_PAYMENT, PENDING_COD, PAYMENT_FAILED

    await this.sendTemplate(to, 'svn_order_update', [
      order.customerName,
      order.orderNumber,
      msg,
    ]);
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

  // ── Credential test ─────────────────────────────────────────────────────────

  /**
   * Send the pre-approved Meta "hello_world" template to any number.
   * Use this to verify credentials before submitting custom templates.
   */
  async sendHelloWorld(phone: string): Promise<{ ok: boolean; to: string | null; reason?: string }> {
    const to = this.e164(phone);
    if (!to) return { ok: false, to: null, reason: 'Invalid phone number' };
    if (!this.enabled) return { ok: false, to, reason: 'WhatsApp not configured — set WA_ACCESS_TOKEN and WA_PHONE_NUMBER_ID' };

    try {
      const url = `https://graph.facebook.com/${API_VERSION}/${this.phoneId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: { name: 'hello_world', language: { code: 'en_US' } },
        }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        return { ok: false, to, reason: JSON.stringify(data) };
      }
      return { ok: true, to };
    } catch (err) {
      return { ok: false, to, reason: String(err) };
    }
  }
}
