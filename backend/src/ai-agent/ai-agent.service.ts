import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiMessage, AiToolCall, AiToolDef } from './ai-gateway.types';
import {
  AI_KEYS, AI_PROVIDER_DEFAULT_MODEL, AI_PROVIDER_LABEL, AI_PROVIDER_MODEL_ENV, AI_PROVIDER_ORDER,
  AiProviderName, DEFAULT_DAILY_LIMIT, aiDailyCountKey, getConfiguredProviderOrder,
} from './ai-settings.keys';
import { encrypt } from '../common/helpers/credential-encryption.util';

// Bounds cost/latency per customer message even if the model keeps calling
// tools back-to-back — independent of the daily message cap below, which
// bounds volume across a whole day instead of one conversation turn.
const MAX_TOOL_ITERATIONS = 4;

export interface StoreInfo {
  storeHours: string;
  locationName: string;
  locationAddr: string;
  /** Set when today has an active WaSpecialDay override (e.g. a festival the store is too busy to keep up with WhatsApp on) — woven into the system prompt directly, not left to the model to think to ask for. */
  specialDayMessage?: string;
}

export interface AiProviderSettings {
  provider: AiProviderName;
  label: string;
  apiKeyConfigured: boolean;
  model: string;
}

export interface AiAgentSettings {
  enabled: boolean;
  /** True once at least one provider below has a key — the toggle above can only be turned on once this is true. */
  anyConfigured: boolean;
  dailyLimit: number;
  /** One entry per provider, in the same order the gateway tries them (AI_PROVIDER_ORDER). */
  providers: AiProviderSettings[];
}

/**
 * Result of one handleCustomerMessage() call. Replaces the old `string | null`
 * return — null used to mean three different things (not configured/capped,
 * the model escalated, or a hard error), and the caller couldn't tell "the
 * model handed this to a human" apart from "nothing happened". `escalated`
 * disambiguates just that one case, since it's the only one the caller
 * (WhatsAppService.handleAutoReply) needs to react to differently — sending
 * an acknowledgment + Main Menu instead of staying silent.
 */
export interface AiAgentResult {
  /** Drafted reply text, or null if there's nothing to send (declined/capped/errored/escalated). */
  reply: string | null;
  /** True only when the model explicitly called escalate_to_human. */
  escalated: boolean;
}

/**
 * Light, warmth-only context about the customer messaging in — NOT a
 * substitute for escalate_to_human on real order questions. Deliberately
 * carries only a name and a purchase count/date, never order line items,
 * statuses, or amounts, so the model has nothing specific to get wrong.
 */
interface AiCustomerContext {
  name?: string;
  orderCount: number;
  lastOrderAt?: Date;
}

const TOOLS: AiToolDef[] = [
  {
    name: 'search_products',
    description:
      "Search this store's product catalog by name or keyword to answer price/stock/availability questions. Returns up to a few matching products with their name, selling price, and category. Use this for ANY question about a specific product — never guess a price or stock status.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Product name or keyword to search for, e.g. "ashirwad atta" or "toor dal"' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_store_info',
    description: "Get this store's hours and location/address. Use this for general questions like store timings or where the store is.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'escalate_to_human',
    description:
      "Hand this conversation off to a human staff member instead of answering yourself. You MUST call this — instead of answering — for anything about: a specific customer's order status, a complaint, a refund, a price negotiation or discount request, payment issues, or anything that would require looking up or changing a customer's account. Also call this if you are not confident you can answer correctly from the two tools above.",
    inputSchema: {
      type: 'object',
      properties: { reason: { type: 'string', description: 'Brief internal note on why this needs a human (not shown to the customer)' } },
      additionalProperties: false,
    },
  },
];

/**
 * The one Customer-Service/Sales WhatsApp agent for V1. Deliberately does NOT
 * inject WhatsAppService (that would create a circular module dependency,
 * since WhatsAppService is the one calling into this service) — store
 * hours/location are handed in by the caller as plain data (storeInfo),
 * already fetched by WhatsAppService.getAutoReplySettings(), rather than this
 * service reaching back into WhatsAppService to fetch them itself. Sending
 * the reply is likewise left to the caller: this service only drafts text.
 */
@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  constructor(
    private prisma: PrismaService,
    private shop: ShopService,
    private gateway: AiGatewayService,
  ) {}

  // ── Settings (read/write) ───────────────────────────────────────────────

  async getSettings(businessId: string): Promise<AiAgentSettings> {
    const allKeys = [
      AI_KEYS.enabled, AI_KEYS.dailyLimit,
      ...AI_PROVIDER_ORDER.flatMap(p => [AI_KEYS.apiKey(p), AI_KEYS.model(p)]),
    ];
    const rows = await this.prisma.systemSetting.findMany({ where: { businessId, key: { in: allKeys } } });
    const byKey = new Map(rows.map(r => [r.key, r.value]));
    const configuredOrder = await getConfiguredProviderOrder(this.prisma, businessId);
    const configuredSet = new Set(configuredOrder);

    const providers: AiProviderSettings[] = AI_PROVIDER_ORDER.map(p => ({
      provider:         p,
      label:            AI_PROVIDER_LABEL[p],
      apiKeyConfigured: configuredSet.has(p),
      model:            byKey.get(AI_KEYS.model(p)) || process.env[AI_PROVIDER_MODEL_ENV[p]] || AI_PROVIDER_DEFAULT_MODEL[p],
    }));

    return {
      enabled:       byKey.get(AI_KEYS.enabled) === 'true',
      anyConfigured: providers.some(p => p.apiKeyConfigured),
      dailyLimit:    parseInt(byKey.get(AI_KEYS.dailyLimit) ?? '', 10) || DEFAULT_DAILY_LIMIT,
      providers,
    };
  }

  async saveSettings(businessId: string, data: {
    enabled?: boolean;
    dailyLimit?: number;
    providers?: Partial<Record<AiProviderName, { apiKey?: string; model?: string }>>;
  }): Promise<AiAgentSettings> {
    const ops: Promise<any>[] = [];
    const upsert = (key: string, value: string) =>
      this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      });

    if (data.enabled !== undefined) ops.push(upsert(AI_KEYS.enabled, String(data.enabled)));
    if (data.dailyLimit !== undefined && data.dailyLimit > 0) ops.push(upsert(AI_KEYS.dailyLimit, String(Math.floor(data.dailyLimit))));

    if (data.providers) {
      for (const p of AI_PROVIDER_ORDER) {
        const upd = data.providers[p];
        if (!upd) continue;
        if (upd.apiKey && upd.apiKey.trim()) ops.push(upsert(AI_KEYS.apiKey(p), encrypt(upd.apiKey.trim())));
        if (upd.model && upd.model.trim())   ops.push(upsert(AI_KEYS.model(p), upd.model.trim()));
      }
    }

    await Promise.all(ops);
    return this.getSettings(businessId);
  }

  /** Cheap enabled/configured check — no gateway call — used by WhatsAppService to decide which branch of handleAutoReply to take. */
  async isEnabled(businessId: string): Promise<boolean> {
    const settings = await this.getSettings(businessId);
    return settings.enabled && settings.anyConfigured;
  }

  // ── Core orchestration ──────────────────────────────────────────────────

  /**
   * Drafts a reply to one inbound customer WhatsApp message. `reply` is null
   * when there's nothing to send (unconfigured, daily cap hit, max
   * iterations, or any error) OR when the model escalated — check
   * `escalated` to tell those apart. Caller (WhatsAppService) is responsible
   * for actually sending a non-null reply via autoReplyText, and for
   * reacting to `escalated` (acknowledgment + Main Menu) — this service
   * never sends anything itself.
   */
  async handleCustomerMessage(businessId: string, phone: string, messageBody: string, storeInfo: StoreInfo): Promise<AiAgentResult> {
    const declined: AiAgentResult = { reply: null, escalated: false };
    try {
      const settings = await this.getSettings(businessId);
      if (!settings.enabled || !settings.anyConfigured) return declined;

      const count = await this.getDailyCount(businessId);
      if (count >= settings.dailyLimit) {
        this.logger.warn(`AI daily cap reached for business ${businessId} (${count}/${settings.dailyLimit}) — falling back`);
        return declined;
      }
      await this.incrementDailyCount(businessId, count);

      const [customerContext, history] = await Promise.all([
        this.getCustomerContext(businessId, phone),
        this.getRecentHistory(businessId, phone),
      ]);

      const systemPrompt = await this.buildSystemPrompt(businessId, customerContext, storeInfo.specialDayMessage);
      const messages: AiMessage[] = [...history, { role: 'user', content: messageBody }];

      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await this.gateway.complete({ businessId, systemPrompt, messages, tools: TOOLS });

        const escalate = result.toolCalls.find(tc => tc.name === 'escalate_to_human');
        if (escalate) return { reply: null, escalated: true };

        if (result.toolCalls.length === 0) {
          return { reply: result.text?.trim() || null, escalated: false };
        }

        messages.push({ role: 'assistant', content: result.text, toolCalls: result.toolCalls });
        for (const call of result.toolCalls) {
          const output = await this.executeTool(call, storeInfo);
          messages.push({ role: 'tool_result', toolCallId: call.id, content: output });
        }
      }

      this.logger.warn(`AI agent hit max tool iterations for business ${businessId} — falling back`);
      return declined;
    } catch (err) {
      this.logger.error(`AI agent failed for business ${businessId}: ${err instanceof Error ? err.message : String(err)}`);
      return declined;
    }
  }

  private async executeTool(call: AiToolCall, storeInfo: StoreInfo): Promise<string> {
    switch (call.name) {
      case 'search_products': {
        const query = typeof call.input?.query === 'string' ? call.input.query : '';
        if (!query.trim()) return JSON.stringify({ products: [] });
        const { products } = await this.shop.suggest(query, 5);
        return JSON.stringify({
          products: products.map(p => ({ name: p.name, price: p.sellingPrice, category: p.subcategory })),
        });
      }
      case 'get_store_info':
        return JSON.stringify(storeInfo);
      default:
        return JSON.stringify({ error: `Unknown tool ${call.name}` });
    }
  }

  private async buildSystemPrompt(businessId: string, customerContext: AiCustomerContext, specialDayMessage?: string): Promise<string> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    const storeName = business?.name?.trim() || 'the store';

    const lines = [
      `You are a helpful WhatsApp assistant for ${storeName}, a retail store. You answer customers' product/price/stock questions and general store questions (hours, location) using the tools provided — never from memory or guesswork.`,
      '',
      'Reply in the same bilingual style this store already uses with customers: a short line in Telugu, followed by the same line in English in italics (wrap it in single asterisks, e.g. *like this*). Keep the whole reply short — this is a WhatsApp chat reply, not an essay. Use at most one or two relevant emoji, no more.',
      '',
      'You have two data tools: search_products (product name/price/stock lookups) and get_store_info (hours/location). Always call the relevant tool rather than answering from memory — if you are not sure a product exists, search for it; never state a price or stock status you did not get from search_products.',
      '',
      'Customers write casually — greetings, spelling mistakes, extra punctuation, and the real question all mixed into one message (e.g. "Good day biscuit bulk stock available?"). Always look past the greeting/small talk and extract the actual product or topic being asked about; never treat a message as "just a greeting" when it also names a product, category, or request. Never let a friendly opener cause you to skip or ignore the real question that follows it.',
      '',
      'If the message is too vague to search meaningfully — it names only a broad category or general need (e.g. "biscuits", "bulk stock", "snacks") with no specific brand or product — do not silently fail and do not escalate. Instead ask ONE short, friendly clarifying question to narrow it down (e.g. "Sure! Which biscuit brand are you looking for? 🍪"), in the same bilingual style as your other replies. A broad query on its own is never a reason to escalate.',
      '',
      'If a customer asks about getting something delivered as a NEW request — "I need delivery", "do you deliver", "can I get this delivered" — that is NOT the same as asking about an EXISTING order\'s delivery status (which still must escalate, see below). Answer this one directly: confirm delivery is available, then tell them how to place the order — either reply right here on WhatsApp with their name, phone number, full delivery address with a landmark, and the items/brands they want, or order online for home delivery at ' + (process.env.SHOP_URL ?? 'https://shop.srivani.com') + '. Never reply with a bare acknowledgement like "thank you for contacting us" that gives no actual next step — every reply must tell the customer what to do next.',
      '',
      'You MUST call escalate_to_human instead of answering, for any of these — do not attempt to handle them yourself:',
      '- A specific EXISTING order\'s status, delivery, or tracking (as opposed to a new delivery request, handled above)',
      '- A complaint of any kind',
      '- A refund or return request',
      '- Price negotiation or a discount request',
      '- Payment issues or anything needing account access',
      '- Genuine total incomprehension — the message makes no sense at all, not merely a broad or under-specified product query',
      '',
      'If you escalate, do not send any other reply — just call escalate_to_human and stop.',
    ];

    // Light, warmth-only customer context — see AiCustomerContext's own comment
    // for why this deliberately never carries order line items/status/amounts.
    const contextLines: string[] = [];
    if (specialDayMessage) {
      contextLines.push(`Today is a special/busy day for the store — customers are already being told: "${specialDayMessage}". Keep this in mind: replies may be slower than usual today, so briefly acknowledge that if relevant, especially in your first response, without repeating the whole message verbatim.`);
    }
    if (customerContext.name) {
      contextLines.push(`This customer's name is ${customerContext.name} — address them by name where it reads naturally (e.g. in a greeting), not forced into every sentence.`);
    }
    if (customerContext.orderCount > 0) {
      const when = customerContext.lastOrderAt
        ? customerContext.lastOrderAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : undefined;
      contextLines.push(
        `They are a returning customer — ${customerContext.orderCount} past purchase${customerContext.orderCount === 1 ? '' : 's'}` +
        `${when ? `, most recently on ${when}` : ''}. You may warmly acknowledge this (e.g. "welcome back!"), but you were NOT given ` +
        `their order items, statuses, or amounts — never state or guess at those. Any real question about a specific order still ` +
        'goes through escalate_to_human as instructed above.',
      );
    }
    if (contextLines.length) {
      lines.push('', '--- Customer context ---', ...contextLines);
    }

    return lines.join('\n');
  }

  // ── Customer context + conversation memory ──────────────────────────────
  // Both resolve the customer by phone independently of WhatsAppService's own
  // lookup (same normalized-last-10-digits matching precedent already used in
  // whatsapp.service.ts and lists.controller.ts) — no circular dependency,
  // this service already has its own PrismaService.

  private async getCustomerContext(businessId: string, phone: string): Promise<AiCustomerContext> {
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (digits.length < 10) return { orderCount: 0 };

    const [customer, billAgg, orderAgg] = await Promise.all([
      this.prisma.customer.findFirst({
        where: { businessId, OR: [{ phone: digits }, { phone: `91${digits}` }] },
        select: { name: true },
      }),
      this.prisma.salesBill.aggregate({
        where: { businessId, customerPhone: digits, billType: { not: 'ESTIMATE' }, isVoided: false },
        _count: true,
        _max: { billDate: true },
      }),
      this.prisma.onlineOrder.aggregate({
        where: { businessId, customerPhone: { in: [digits, `91${digits}`] } },
        _count: true,
        _max: { createdAt: true },
      }),
    ]);

    const orderCount = billAgg._count + orderAgg._count;
    const dates = [billAgg._max.billDate, orderAgg._max.createdAt].filter((d): d is Date => d != null);
    const lastOrderAt = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;

    return { name: customer?.name?.trim() || undefined, orderCount, lastOrderAt };
  }

  /**
   * Last ~10 prior WhatsApp text turns for this phone, oldest first, mapped to
   * AiMessage history so the model actually sees the conversation instead of
   * treating every inbound message as the first one ever sent. The current
   * message has already been logged as a WaMessage row by the time this runs
   * (see WhatsAppService.handleAutoReply's own comment on the same fact), so
   * the single most recent row is that same message — dropped here rather
   * than re-sent as both "history" and the live user turn below it.
   * messageType:'TEXT' only — interactive/button/media rows carry no useful
   * free text and would just inject noise (or nothing at all) into context.
   */
  private async getRecentHistory(businessId: string, phone: string): Promise<AiMessage[]> {
    const HISTORY_LIMIT = 10;
    const rows = await this.prisma.waMessage.findMany({
      where: { businessId, phone, messageType: 'TEXT' },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT + 1,
      select: { direction: true, body: true, bodyPreview: true },
    });

    return rows
      .slice(1) // drop the current inbound message (already logged, most recent row)
      .reverse() // oldest first
      .map(r => ({ direction: r.direction, text: (r.body ?? r.bodyPreview ?? '').trim() }))
      .filter(r => r.text.length > 0)
      .map(r => r.direction === 'INBOUND'
        ? { role: 'user' as const, content: r.text }
        : { role: 'assistant' as const, content: r.text });
  }

  // ── Daily safety cap ─────────────────────────────────────────────────────
  // Simple per-business, per-UTC-day counter in SystemSetting — a soft cap to
  // stop a malfunction (bad prompt loop, retry storm) from running up an
  // unexpected bill, not a precise token/cost meter.

  private async getDailyCount(businessId: string): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { businessId_key: { businessId, key: aiDailyCountKey() } },
    });
    return row ? parseInt(row.value, 10) || 0 : 0;
  }

  private async incrementDailyCount(businessId: string, currentCount: number): Promise<void> {
    const key = aiDailyCountKey();
    await this.prisma.systemSetting.upsert({
      where:  { businessId_key: { businessId, key } },
      update: { value: String(currentCount + 1) },
      create: { businessId, key, value: '1' },
    });
  }
}
