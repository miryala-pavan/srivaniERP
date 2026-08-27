import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { MistralProvider } from './providers/mistral.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { AiCompleteParams, AiCompletionResult, AiProvider } from './ai-gateway.types';
import { AiProviderName, getConfiguredProviderOrder } from './ai-settings.keys';

/**
 * Automatic failover chain across every provider the business has a key for
 * — there is no manually-selected "active provider". complete() tries each
 * configured provider in AI_PROVIDER_ORDER (claude -> gemini -> groq ->
 * mistral -> openrouter), skips any without a key, and on a call that throws
 * (network error, auth error, rate limit, timeout, quota — anything) logs
 * which provider failed and why, then tries the next configured one. The
 * first success wins; if every configured provider fails, this throws and
 * lets AiAgentService's existing outer try/catch handle it exactly like any
 * other AI-agent failure today (silent fallback to the non-AI auto-reply).
 *
 * This is the ONLY file (besides ai-gateway.types.ts) that anything outside
 * providers/* should ever need to touch — callers depend on
 * AiGatewayService.complete(), never on a specific provider class. Adding a
 * 6th provider later means one more providers/*.provider.ts file, one more
 * entry in AI_PROVIDER_ORDER (ai-settings.keys.ts), and one more case in
 * providerFor() below — not touching AiAgentService or anything upstream.
 */
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private prisma: PrismaService,
    private claudeProvider: ClaudeProvider,
    private geminiProvider: GeminiProvider,
    private groqProvider: GroqProvider,
    private mistralProvider: MistralProvider,
    private openRouterProvider: OpenRouterProvider,
  ) {}

  async complete(params: AiCompleteParams): Promise<AiCompletionResult> {
    const order = await getConfiguredProviderOrder(this.prisma, params.businessId);
    if (order.length === 0) {
      throw new Error('AI Gateway: no provider has an API key configured for this business');
    }

    let lastError: unknown;
    for (const name of order) {
      try {
        return await this.providerFor(name).complete(params);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`AI Gateway: provider "${name}" failed for business ${params.businessId} — ${msg}. Trying next configured provider.`);
      }
    }

    const finalMsg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`AI Gateway: all configured providers failed (tried: ${order.join(', ')}). Last error: ${finalMsg}`);
  }

  private providerFor(name: AiProviderName): AiProvider {
    switch (name) {
      case 'claude':     return this.claudeProvider;
      case 'gemini':     return this.geminiProvider;
      case 'groq':       return this.groqProvider;
      case 'mistral':    return this.mistralProvider;
      case 'openrouter': return this.openRouterProvider;
    }
  }
}
