import { Module } from '@nestjs/common';
import { AiProvider } from './ai.provider.interface';
import { OllamaProvider } from './providers/ollama.provider';
import { AiCallLogService } from './ai-call-log.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: AiProvider, useClass: OllamaProvider },
    AiCallLogService,
  ],
  exports: [AiProvider, AiCallLogService],
})
export class AiModule {}
