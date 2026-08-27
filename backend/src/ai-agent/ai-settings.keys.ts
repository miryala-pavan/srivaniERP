// DB keys for AI Gateway settings, stored per-business in SystemSetting —
// same convention as WA_KEYS in notifications/whatsapp.service.ts.
//
// ─── Automatic failover, not a manual "active provider" switch ─────────────
// There is no single "currently active" provider chosen by the business
// owner. Each provider below can independently have its own API key + model
// configured (any subset — one, several, or all five). AiGatewayService
// tries them in AI_PROVIDER_ORDER, skipping any without a key, and fails
// over to the next configured one if a call throws. See ai-gateway.service.ts.
import { PrismaService } from '../prisma/prisma.service';

export const AI_PROVIDER_ORDER = ['claude', 'gemini', 'groq', 'mistral', 'openrouter'] as const;
export type AiProviderName = (typeof AI_PROVIDER_ORDER)[number];

export const AI_PROVIDER_LABEL: Record<AiProviderName, string> = {
  claude:     'Claude (Anthropic)',
  gemini:     'Gemini (Google)',
  groq:       'Groq',
  mistral:    'Mistral',
  openrouter: 'OpenRouter',
};

// Env-var fallback names (DB value always wins when present — same
// "database overrides env" convention already used for WhatsApp/Claude creds).
export const AI_PROVIDER_API_KEY_ENV: Record<AiProviderName, string> = {
  claude:     'ANTHROPIC_API_KEY',
  gemini:     'GEMINI_API_KEY',
  groq:       'GROQ_API_KEY',
  mistral:    'MISTRAL_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

export const AI_PROVIDER_MODEL_ENV: Record<AiProviderName, string> = {
  claude:     'ANTHROPIC_MODEL',
  gemini:     'GEMINI_MODEL',
  groq:       'GROQ_MODEL',
  mistral:    'MISTRAL_MODEL',
  openrouter: 'OPENROUTER_MODEL',
};

// Fast/cheap, short-reply-appropriate default per provider — this is a
// WhatsApp reply agent, not a long-form writer. Live-verified against real
// API keys with an actual tool-calling round trip (not just checked against
// docs) — gemini-2.5-flash and llama-3.3-70b-versatile both 404'd as
// deprecated/inaccessible during that verification and were swapped for the
// models that actually round-tripped successfully.
export const AI_PROVIDER_DEFAULT_MODEL: Record<AiProviderName, string> = {
  claude:     'claude-haiku-4-5',
  gemini:     'gemini-3.5-flash-lite',
  groq:       'openai/gpt-oss-20b',
  mistral:    'mistral-small-latest',
  openrouter: 'openai/gpt-4o-mini',
};

export const AI_KEYS = {
  enabled:    'ai.enabled',
  dailyLimit: 'ai.daily_limit',
  apiKey:     (p: AiProviderName) => `ai.${p}.api_key`,
  model:      (p: AiProviderName) => `ai.${p}.model`,
} as const;

export const DEFAULT_DAILY_LIMIT = 500;

/** SystemSetting key for a business's message count on a given UTC calendar day — the safety-cap counter. */
export function aiDailyCountKey(date: Date = new Date()): string {
  return `ai.daily_count:${date.toISOString().slice(0, 10)}`;
}

/**
 * The single place that decides "which providers does this business actually
 * have a key for, in priority order". Used by both AiGatewayService (to know
 * which provider to try, and what to fail over to) and AiAgentService (to
 * report per-provider "configured" status and compute isEnabled()) — so the
 * two can never disagree about what counts as configured.
 */
export async function getConfiguredProviderOrder(prisma: PrismaService, businessId: string): Promise<AiProviderName[]> {
  const rows = await prisma.systemSetting.findMany({
    where: { businessId, key: { in: AI_PROVIDER_ORDER.map(p => AI_KEYS.apiKey(p)) } },
  });
  const byKey = new Map(rows.map(r => [r.key, r.value]));
  return AI_PROVIDER_ORDER.filter(p => !!(byKey.get(AI_KEYS.apiKey(p)) || process.env[AI_PROVIDER_API_KEY_ENV[p]]));
}
