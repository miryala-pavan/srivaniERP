// ─── AI Gateway — provider-agnostic types ──────────────────────────────────
// Nothing outside providers/*.provider.ts should know which LLM vendor is
// actually being called. Swapping Claude for OpenAI/Gemini/a local model
// later should mean writing one more small file here, not touching any
// calling code (AiGatewayService, AiAgentService, or the tool executors).

/** A tool the model is allowed to call, described the same way for every provider (JSON Schema input). */
export interface AiToolDef {
  name: string;
  description: string;
  inputSchema: object;
}

/** One tool invocation the model asked for. */
export interface AiToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
  /**
   * Provider-specific opaque data that must be echoed back verbatim if this
   * exact tool call is replayed into a later request in the same
   * conversation — ignored by every provider except the one that produced
   * it. Needed for Gemini 3.x, which rejects a replayed function-call part
   * that's missing the `thoughtSignature` it returned the call with
   * (confirmed live — 2.5-tier models never required this, 3.x models do).
   */
  raw?: Record<string, any>;
}

/**
 * One turn of conversation history fed back to the model. Shaped close to
 * OpenAI/Anthropic's own function-calling message shapes (assistant message
 * carrying optional tool_calls, separate tool-result turns) so it stays a
 * reasonable fit for whichever provider is plugged in later — not just Claude.
 */
export type AiMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: AiToolCall[] }
  | { role: 'tool_result'; toolCallId: string; content: string };

/** Result of one gateway.complete() call — one model turn, not a whole conversation. */
export interface AiCompletionResult {
  text: string | null;
  toolCalls: AiToolCall[];
  stopReason: string;
}

export interface AiCompleteParams {
  /** Per-business scoping — every provider reads its own credentials/model per businessId, same as WhatsApp credentials. */
  businessId: string;
  systemPrompt: string;
  messages: AiMessage[];
  tools: AiToolDef[];
}

/** Implemented once per LLM vendor. Only providers/*.provider.ts files should import an SDK. */
export interface AiProvider {
  complete(params: AiCompleteParams): Promise<AiCompletionResult>;
}
