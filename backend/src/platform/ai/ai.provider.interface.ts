export interface AiCompleteRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AiCompleteResponse {
  text: string;
  confidence: number;
  tokensUsed: number;
  model: string;
  latencyMs: number;
}

export interface AiEmbedRequest {
  text: string;
  model?: string;
}

export interface AiEmbedResponse {
  embedding: number[];
  model: string;
  latencyMs: number;
}

export const AI_PROVIDER = 'AI_PROVIDER';

export abstract class AiProvider {
  abstract complete(req: AiCompleteRequest): Promise<AiCompleteResponse>;
  abstract embed(req: AiEmbedRequest): Promise<AiEmbedResponse>;
}
