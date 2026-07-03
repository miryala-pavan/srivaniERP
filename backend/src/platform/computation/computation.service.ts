import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainClock } from '../clock/clock.interface';

export interface StartComputationJobDto {
  businessId: string;
  jobType: string;
  triggeredByUserId?: string;
  inputSummary?: Record<string, unknown>;
}

@Injectable()
export class ComputationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: DomainClock,
  ) {}

  async start(dto: StartComputationJobDto) {
    return this.prisma.computationJob.create({
      data: {
        businessId: dto.businessId,
        jobType: dto.jobType,
        triggeredByUserId: dto.triggeredByUserId,
        inputSummary: (dto.inputSummary ?? {}) as Prisma.InputJsonValue,
        status: 'RUNNING',
        startedAt: this.clock.now(),
      },
    });
  }

  async complete(jobId: string, outputSummary: Record<string, unknown>) {
    return this.prisma.computationJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: this.clock.now(), outputSummary: outputSummary as Prisma.InputJsonValue },
    });
  }

  async fail(jobId: string, error: string) {
    return this.prisma.computationJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', completedAt: this.clock.now(), error },
    });
  }
}
