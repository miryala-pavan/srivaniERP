import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LogAiCallDto {
  businessId: string;
  provider: string;
  model: string;
  promptHash: string;
  tokensUsed: number;
  latencyMs: number;
  confidence: number;
  success: boolean;
  error?: string;
}

@Injectable()
export class AiCallLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(dto: LogAiCallDto): Promise<void> {
    await this.prisma.aiCallLog.create({ data: dto });
  }
}
