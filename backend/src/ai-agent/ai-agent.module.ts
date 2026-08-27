import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ShopModule } from '../shop/shop.module';
import { AiAgentService } from './ai-agent.service';
import { AiGatewayService } from './ai-gateway.service';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { MistralProvider } from './providers/mistral.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';

// Deliberately does NOT import NotificationsModule — NotificationsModule
// imports THIS module (so WhatsAppService can inject AiAgentService), and
// AiAgentService never needs WhatsAppService back (see ai-agent.service.ts
// header comment), so there is no import cycle in the Nest module graph.
@Module({
  imports:   [PrismaModule, ShopModule],
  providers: [AiAgentService, AiGatewayService, ClaudeProvider, GeminiProvider, GroqProvider, MistralProvider, OpenRouterProvider],
  exports:   [AiAgentService],
})
export class AiAgentModule {}
