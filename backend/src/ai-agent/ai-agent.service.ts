import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiMessage, AiToolCall, AiToolDef } from './ai-gateway.types';
import {
  AI_KEYS, AI_PROVIDER_DEFAULT_MODEL, AI_PROVIDER_LABEL, AI_PROVIDER_MODEL_ENV, AI_PROVIDER_ORDER,
  AiProviderName, DEFAULT_DAILY_LIMIT, aiDailyCountKey, getConfiguredProviderOrder,
} from './ai-settings.keys';

// Bounds cost/latency per customer message even if the model keeps calling
// tools back-to-back — independent of the daily message cap below, which
// bounds volume across a whole day instead of one conversation turn.
const MAX_TOOL_ITERATIONS = 4;

export interface StoreInfo {
  storeHours: string;
  locationName: string;
  locationAddr: string;
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
        if (upd.apiKey && upd.apiKey.trim()) ops.push(upsert(AI_KEYS.apiKey(p), upd.apiKey.trim()));
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
   * Drafts a reply to one inbound customer WhatsApp message, or returns null
   * to silently hand off to the human inbox (unconfigured, daily cap hit,
   * the model escalated, or any error). Caller (WhatsAppService) is
   * responsible for actually sending a non-null result via autoReplyText —
   * this service never sends anything itself.
   */
  async handleCustomerMessage(businessId: string, phone: string, messageBody: string, storeInfo: StoreInfo): Promise<string | null> {
    try {
      const settings = await this.getSettings(businessId);
      if (!settings.enabled || !settings.anyConfigured) return null;

      const count = await this.getDailyCount(businessId);
      if (count >= settings.dailyLimit) {
        this.logger.warn(`AI daily cap reached for business ${businessId} (${count}/${settings.dailyLimit}) — falling back`);
        return null;
      }
      await this.incrementDailyCount(businessId, count);

      const systemPrompt = await this.buildSystemPrompt(businessId);
      const messages: AiMessage[] = [{ role: 'user', content: messageBody }];

      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const result = await this.gateway.complete({ businessId, systemPrompt, messages, tools: TOOLS });

        const escalate = result.toolCalls.find(tc => tc.name === 'escalate_to_human');
        if (escalate) return null;

        if (result.toolCalls.length === 0) {
          return result.text?.trim() || null;
        }

        messages.push({ role: 'assistant', content: result.text, toolCalls: result.toolCalls });
        for (const call of result.toolCalls) {
          const output = await this.executeTool(call, storeInfo);
          messages.push({ role: 'tool_result', toolCallId: call.id, content: output });
        }
      }

      this.logger.warn(`AI agent hit max tool iterations for business ${businessId} — falling back`);
      return null;
    } catch (err) {
      this.logger.error(`AI agent failed for business ${businessId}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
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

  private async buildSystemPrompt(businessId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    const storeName = business?.name?.trim() || 'the store';

    return [
      `You are a helpful WhatsApp assistant for ${storeName}, a retail store. You answer customers' product/price/stock questions and general store questions (hours, location) using the tools provided — never from memory or guesswork.`,
      '',
      'Reply in the same bilingual style this store already uses with customers: a short line in Telugu, followed by the same line in English in italics (wrap it in single asterisks, e.g. *like this*). Keep the whole reply short — this is a WhatsApp chat reply, not an essay. Use at most one or two relevant emoji, no more.',
      '',
      'You have two data tools: search_products (product name/price/stock lookups) and get_store_info (hours/location). Always call the relevant tool rather than answering from memory — if you are not sure a product exists, search for it; never state a price or stock status you did not get from search_products.',
      '',
      'You MUST call escalate_to_human instead of answering, for any of these — do not attempt to handle them yourself:',
      '- A specific order\'s status, delivery, or tracking',
      '- A complaint of any kind',
      '- A refund or return request',
      '- Price negotiation or a discount request',
      '- Payment issues or anything needing account access',
      '- Anything else you are not confident you can answer correctly from the two tools above',
      '',
      'If you escalate, do not send any other reply — just call escalate_to_human and stop.',
    ].join('\n');
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
