import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiCompleteParams, AiCompletionResult, AiMessage, AiProvider, AiToolCall, AiToolDef } from '../ai-gateway.types';
import { AI_KEYS, AI_PROVIDER_API_KEY_ENV, AI_PROVIDER_DEFAULT_MODEL, AI_PROVIDER_MODEL_ENV } from '../ai-settings.keys';
import { decrypt } from '../../common/helpers/credential-encryption.util';

const MAX_TOKENS = 1024; // short WhatsApp-appropriate replies — this is a reply agent, not a long-form writer

/**
 * AiProvider implementation for Google's Gemini API (generativelanguage
 * googleapis.com REST endpoint — no SDK dependency needed, same fetch()
 * convention already used elsewhere in this backend for external HTTP APIs).
 *
 * Gemini's function-calling shape differs from Claude/OpenAI-style
 * providers in three ways this file has to bridge:
 *  - Tool calls come back as {functionCall:{name, args}} parts with NO id of
 *    their own, so this provider synthesizes one (gemini-call-N) to satisfy
 *    the generic AiToolCall.id field the rest of the agent depends on.
 *  - Sending a tool result back requires the function's NAME, not just an
 *    id — so toGeminiContents() below rebuilds an id->name map by scanning
 *    the assistant turns already in the conversation history.
 *  - Gemini 3.x models additionally return a `thoughtSignature` (an opaque
 *    base64 blob) on each functionCall part, and REJECT the whole request
 *    with a 400 if a replayed functionCall part is missing it on a later
 *    turn — confirmed live against gemini-3.5-flash-lite; 2.5-tier models
 *    never required this, which is what makes it easy to miss. Stashed on
 *    AiToolCall.raw and echoed back verbatim in toGeminiContents below.
 *
 * Reads its API key + model per-business from SystemSetting (DB overrides
 * env var), same convention as ClaudeProvider.
 */
@Injectable()
export class GeminiProvider implements AiProvider {
  constructor(private prisma: PrismaService) {}

  async complete(params: AiCompleteParams): Promise<AiCompletionResult> {
    const { apiKey, model } = await this.getCreds(params.businessId);
    if (!apiKey) {
      throw new Error('AI Gateway: no Gemini API key configured for this business');
    }

    const body = {
      system_instruction: { parts: [{ text: params.systemPrompt }] },
      contents:            toGeminiContents(params.messages),
      tools:               [{ functionDeclarations: params.tools.map(toGeminiFunctionDeclaration) }],
      generationConfig:    { maxOutputTokens: MAX_TOKENS },
    };

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 300)}`);
    }

    const data: any = await res.json();
    const candidate = data?.candidates?.[0];
    const parts: any[] = candidate?.content?.parts ?? [];

    const textParts = parts.filter(p => typeof p.text === 'string' && p.text.length > 0).map(p => p.text);
    const toolCalls: AiToolCall[] = parts
      .filter(p => p.functionCall)
      .map((p, i) => ({
        id:    `gemini-call-${i}-${Date.now()}`,
        name:  p.functionCall.name,
        input: (p.functionCall.args ?? {}) as Record<string, any>,
        raw:   p.thoughtSignature ? { thoughtSignature: p.thoughtSignature } : undefined,
      }));

    return {
      text:       textParts.length > 0 ? textParts.join('\n') : null,
      toolCalls,
      stopReason: candidate?.finishReason ?? 'STOP',
    };
  }

  private async getCreds(businessId: string): Promise<{ apiKey?: string; model: string }> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { businessId, key: { in: [AI_KEYS.apiKey('gemini'), AI_KEYS.model('gemini')] } },
    });
    const byKey = new Map(rows.map(r => [r.key, r.value]));
    const dbKey = byKey.get(AI_KEYS.apiKey('gemini'));
    return {
      // decrypt() transparently returns legacy plaintext rows unchanged.
      apiKey: (dbKey ? decrypt(dbKey) : undefined) || process.env[AI_PROVIDER_API_KEY_ENV.gemini] || undefined,
      model:  byKey.get(AI_KEYS.model('gemini'))  || process.env[AI_PROVIDER_MODEL_ENV.gemini]   || AI_PROVIDER_DEFAULT_MODEL.gemini,
    };
  }
}

function toGeminiFunctionDeclaration(t: AiToolDef) {
  return { name: t.name, description: t.description, parameters: stripUnsupportedSchemaFields(t.inputSchema) };
}

/**
 * Gemini's function-parameter schema is a restricted OpenAPI-3.0 subset —
 * fields like additionalProperties (which our tool defs set) aren't part of
 * it and older API versions reject unknown fields outright. Strip anything
 * Gemini doesn't recognize rather than risk a 400 on every call.
 */
function stripUnsupportedSchemaFields(schema: any): any {
  if (Array.isArray(schema)) return schema.map(stripUnsupportedSchemaFields);
  if (schema && typeof schema === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === 'additionalProperties') continue;
      out[k] = stripUnsupportedSchemaFields(v);
    }
    return out;
  }
  return schema;
}

/**
 * Translates the generic AiMessage history into Gemini's contents[] shape.
 * Consecutive tool_result entries are coalesced into one 'user' turn with
 * multiple functionResponse parts, same reasoning as ClaudeProvider's
 * coalescing (Gemini expects one turn per role, not one message per tool
 * result) — and each one is matched back to its function NAME via an
 * id->name map built from the assistant turns already seen.
 */
function toGeminiContents(messages: AiMessage[]): any[] {
  const idToName = new Map<string, string>();
  for (const m of messages) {
    if (m.role === 'assistant') {
      for (const tc of m.toolCalls ?? []) idToName.set(tc.id, tc.name);
    }
  }

  const out: any[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', parts: [{ text: m.content }] });
      continue;
    }
    if (m.role === 'assistant') {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const tc of m.toolCalls ?? []) {
        const thoughtSignature = (tc.raw as { thoughtSignature?: string } | undefined)?.thoughtSignature;
        parts.push({
          functionCall: { name: tc.name, args: tc.input ?? {} },
          ...(thoughtSignature ? { thoughtSignature } : {}),
        });
      }
      out.push({ role: 'model', parts });
      continue;
    }
    // tool_result
    const part = { functionResponse: { name: idToName.get(m.toolCallId) ?? 'unknown', response: { content: m.content } } };
    const last = out[out.length - 1];
    if (last && last.role === 'user' && Array.isArray(last.parts) && last.parts.every((p: any) => p.functionResponse)) {
      last.parts.push(part);
    } else {
      out.push({ role: 'user', parts: [part] });
    }
  }
  return out;
}
