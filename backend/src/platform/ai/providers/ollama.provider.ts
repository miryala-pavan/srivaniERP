import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  AiProvider,
  AiCompleteRequest,
  AiCompleteResponse,
  AiEmbedRequest,
  AiEmbedResponse,
} from '../ai.provider.interface';

@Injectable()
export class OllamaProvider extends AiProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  private readonly defaultModel = process.env.OLLAMA_MODEL ?? 'llama3.2';
  private readonly embedModel = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text';

  async complete(req: AiCompleteRequest): Promise<AiCompleteResponse> {
    const start = Date.now();
    const model = req.model ?? this.defaultModel;

    const messages: Array<{ role: string; content: string }> = [];
    if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
    messages.push({ role: 'user', content: req.prompt });

    const response = await axios.post(`${this.baseUrl}/api/chat`, {
      model,
      messages,
      options: { temperature: req.temperature ?? 0.1 },
      stream: false,
    });

    const latencyMs = Date.now() - start;
    const data = response.data as { message: { content: string }; eval_count?: number };

    return {
      text: data.message.content,
      confidence: 0.8,
      tokensUsed: data.eval_count ?? 0,
      model,
      latencyMs,
    };
  }

  async embed(req: AiEmbedRequest): Promise<AiEmbedResponse> {
    const start = Date.now();
    const model = req.model ?? this.embedModel;

    const response = await axios.post(`${this.baseUrl}/api/embeddings`, {
      model,
      prompt: req.text,
    });

    const data = response.data as { embedding: number[] };
    return { embedding: data.embedding, model, latencyMs: Date.now() - start };
  }
}
