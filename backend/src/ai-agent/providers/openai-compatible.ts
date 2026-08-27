import { AiCompleteParams, AiCompletionResult, AiMessage, AiToolCall } from '../ai-gateway.types';

// Shared by Groq, Mistral, and OpenRouter — all three expose an
// OpenAI-compatible /chat/completions endpoint (same request/response shape,
// same function-calling convention: tools as {type:'function', function:{...}},
// tool calls returned as message.tool_calls[].function.arguments (a JSON
// string), tool results sent back as {role:'tool', tool_call_id, content}).
// Only the base URL, API key, model, and (optionally) a couple of extra
// headers differ per vendor — each provider file below is a thin wrapper
// around this one HTTP call + parse.

const MAX_TOKENS = 1024; // short WhatsApp-appropriate replies — this is a reply agent, not a long-form writer

export interface OpenAiCompatibleConfig {
  /** Used only in error messages, e.g. "Groq". */
  providerLabel: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
}

export async function completeOpenAiCompatible(params: AiCompleteParams, cfg: OpenAiCompatibleConfig): Promise<AiCompletionResult> {
  const body = {
    model: cfg.model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'system', content: params.systemPrompt }, ...toOpenAiMessages(params.messages)],
    tools: params.tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    })),
  };

  const res = await fetch(cfg.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
      ...(cfg.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${cfg.providerLabel} API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const choice = data?.choices?.[0];
  const message = choice?.message ?? {};

  const toolCalls: AiToolCall[] = (message.tool_calls ?? []).map((tc: any) => ({
    id:    tc.id,
    name:  tc.function?.name,
    input: safeParseJsonObject(tc.function?.arguments),
  }));

  return {
    text:       typeof message.content === 'string' && message.content.length > 0 ? message.content : null,
    toolCalls,
    stopReason: choice?.finish_reason ?? 'stop',
  };
}

function safeParseJsonObject(raw?: string): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Mirrors ClaudeProvider's toAnthropicMessages — same generic AiMessage[] history, OpenAI's flatter shape this time (no coalescing needed: OpenAI accepts one {role:'tool'} message per tool result). */
function toOpenAiMessages(messages: AiMessage[]): any[] {
  return messages.map(m => {
    if (m.role === 'user') return { role: 'user', content: m.content };
    if (m.role === 'assistant') {
      const out: any = { role: 'assistant', content: m.content ?? null };
      if (m.toolCalls && m.toolCalls.length > 0) {
        out.tool_calls = m.toolCalls.map(tc => ({
          id:   tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input ?? {}) },
        }));
      }
      return out;
    }
    // tool_result
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
  });
}
