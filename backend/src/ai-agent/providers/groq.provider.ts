import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiCompleteParams, AiCompletionResult, AiProvider } from '../ai-gateway.types';
import { AI_KEYS, AI_PROVIDER_API_KEY_ENV, AI_PROVIDER_DEFAULT_MODEL, AI_PROVIDER_MODEL_ENV } from '../ai-settings.keys';
import { completeOpenAiCompatible } from './openai-compatible';

/**
 * AiProvider implementation for Groq — OpenAI-compatible /chat/completions
 * endpoint (see openai-compatible.ts for the shared request/response logic).
 * Reads its API key + model per-business from SystemSetting (DB overrides
 * env var), same convention as ClaudeProvider.
 */
@Injectable()
export class GroqProvider implements AiProvider {
  constructor(private prisma: PrismaService) {}

  async complete(params: AiCompleteParams): Promise<AiCompletionResult> {
    const { apiKey, model } = await this.getCreds(params.businessId);
    if (!apiKey) {
      throw new Error('AI Gateway: no Groq API key configured for this business');
    }
    return completeOpenAiCompatible(params, {
      providerLabel: 'Groq',
      baseUrl:       'https://api.groq.com/openai/v1/chat/completions',
      apiKey,
      model,
    });
  }

  private async getCreds(businessId: string): Promise<{ apiKey?: string; model: string }> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { businessId, key: { in: [AI_KEYS.apiKey('groq'), AI_KEYS.model('groq')] } },
    });
    const byKey = new Map(rows.map(r => [r.key, r.value]));
    return {
      apiKey: byKey.get(AI_KEYS.apiKey('groq')) || process.env[AI_PROVIDER_API_KEY_ENV.groq] || undefined,
      model:  byKey.get(AI_KEYS.model('groq'))  || process.env[AI_PROVIDER_MODEL_ENV.groq]   || AI_PROVIDER_DEFAULT_MODEL.groq,
    };
  }
}
