import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { AiCompleteParams, AiCompletionResult, AiMessage, AiProvider } from '../ai-gateway.types';
import { AI_KEYS, AI_PROVIDER_API_KEY_ENV, AI_PROVIDER_DEFAULT_MODEL, AI_PROVIDER_MODEL_ENV } from '../ai-settings.keys';
import { decrypt } from '../../common/helpers/credential-encryption.util';

const MAX_TOKENS = 1024; // short WhatsApp-appropriate replies — this is a reply agent, not a long-form writer

/**
 * AiProvider implementation backed by the official @anthropic-ai/sdk.
 * Reads its API key + model per-business from SystemSetting (DB overrides
 * env var, same "database wins" convention as WhatsApp credentials) — always
 * fresh, no cache, since this path isn't hot enough to justify one and a
 * stale key/model right after a Settings save would be a worse bug than an
 * extra SELECT per customer message.
 */
@Injectable()
export class ClaudeProvider implements AiProvider {
  private readonly logger = new Logger(ClaudeProvider.name);

  constructor(private prisma: PrismaService) {}

  async complete(params: AiCompleteParams): Promise<AiCompletionResult> {
    const { apiKey, model } = await this.getCreds(params.businessId);
    if (!apiKey) {
      throw new Error('AI Gateway: no Claude API key configured for this business');
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: params.systemPrompt,
      messages: toAnthropicMessages(params.messages),
      tools: params.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    });

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    return {
      text: textBlocks.length > 0 ? textBlocks.map(b => b.text).join('\n') : null,
      toolCalls: toolUseBlocks.map(b => ({
        id: b.id,
        name: b.name,
        input: (b.input ?? {}) as Record<string, any>,
      })),
      stopReason: response.stop_reason ?? 'end_turn',
    };
  }

  private async getCreds(businessId: string): Promise<{ apiKey?: string; model: string }> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { businessId, key: { in: [AI_KEYS.apiKey('claude'), AI_KEYS.model('claude')] } },
    });
    const byKey = new Map(rows.map(r => [r.key, r.value]));
    const dbKey = byKey.get(AI_KEYS.apiKey('claude'));
    return {
      // decrypt() transparently returns legacy plaintext rows unchanged.
      apiKey: (dbKey ? decrypt(dbKey) : undefined) || process.env[AI_PROVIDER_API_KEY_ENV.claude] || undefined,
      model:  byKey.get(AI_KEYS.model('claude'))  || process.env[AI_PROVIDER_MODEL_ENV.claude]   || AI_PROVIDER_DEFAULT_MODEL.claude,
    };
  }
}

/**
 * Translates the generic AiMessage history into Anthropic's MessageParam[].
 * tool_result turns must be delivered to Claude as content blocks inside a
 * single user message — consecutive tool_result entries in our history are
 * coalesced into one user message so a multi-tool-call turn round-trips
 * correctly (Claude requires every tool_result for a turn in one message).
 */
function toAnthropicMessages(messages: AiMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
      continue;
    }
    if (m.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
      }
      out.push({ role: 'assistant', content: blocks });
      continue;
    }
    // tool_result — append to the previous message if it's already a
    // coalesced tool_result user message, otherwise start a new one.
    const block: Anthropic.ToolResultBlockParam = {
      type: 'tool_result',
      tool_use_id: m.toolCallId,
      content: m.content,
    };
    const last = out[out.length - 1];
    if (last && last.role === 'user' && Array.isArray(last.content) && isToolResultArray(last.content)) {
      last.content.push(block);
    } else {
      out.push({ role: 'user', content: [block] });
    }
  }

  return out;
}

function isToolResultArray(content: Anthropic.ContentBlockParam[]): content is Anthropic.ToolResultBlockParam[] {
  return content.every(b => b.type === 'tool_result');
}
