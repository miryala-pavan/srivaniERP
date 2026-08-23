import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainClock } from '../clock/clock.interface';

export interface JournalLineDto {
  accountId: string;
  debitAmount: Decimal | number;
  creditAmount: Decimal | number;
  narration?: string;
}

export interface CreateJournalDto {
  businessId: string;
  fiscalPeriodId: string;
  reference?: string;
  narration: string;
  lines: JournalLineDto[];
  createdByUserId?: string;
}

@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: DomainClock,
  ) {}

  async post(dto: CreateJournalDto) {
    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debitAmount), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.creditAmount), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new UnprocessableEntityException(
        `Journal is not balanced: debit ${totalDebit} ≠ credit ${totalCredit}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const journal = await tx.journal.create({
        data: {
          businessId: dto.businessId,
          fiscalPeriodId: dto.fiscalPeriodId,
          reference: dto.reference,
          narration: dto.narration,
          totalDebit: new Decimal(totalDebit),
          totalCredit: new Decimal(totalCredit),
          status: 'POSTED',
          postedAt: this.clock.now(),
          createdByUserId: dto.createdByUserId,
          lines: {
            create: dto.lines.map((l) => ({
              accountId: l.accountId,
              debitAmount: new Decimal(l.debitAmount),
              creditAmount: new Decimal(l.creditAmount),
              narration: l.narration,
            })),
          },
        },
        include: { lines: true },
      });
      return journal;
    });
  }

  async reverse(journalId: string, reason: string, userId?: string, businessId?: string) {
    // businessId scoping is optional here only so any other internal caller
    // that doesn't have it handy still compiles — the one HTTP entry point
    // (ledger-api.controller.ts) always passes it, closing what would
    // otherwise be a cross-tenant reversal (any business's journal id).
    const original = await this.prisma.journal.findFirst({
      where: { id: journalId, ...(businessId ? { businessId } : {}) },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException('Journal not found');

    if (original.status !== 'POSTED') {
      throw new BadRequestException('Only POSTED journals can be reversed');
    }

    return this.post({
      businessId: original.businessId,
      fiscalPeriodId: original.fiscalPeriodId,
      reference: `REV-${original.reference ?? journalId}`,
      narration: `Reversal: ${reason}`,
      createdByUserId: userId,
      lines: original.lines.map((l) => ({
        accountId: l.accountId,
        debitAmount: l.creditAmount,
        creditAmount: l.debitAmount,
        narration: `Reversal of ${l.narration ?? ''}`,
      })),
    });
  }
}
