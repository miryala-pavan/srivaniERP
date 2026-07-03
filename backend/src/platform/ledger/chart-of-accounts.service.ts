import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAccountDto {
  businessId: string;
  code: string;
  name: string;
  accountGroupId: string;
  currency?: string;
  description?: string;
}

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(businessId: string, name: string, type: string, parentId?: string) {
    return this.prisma.accountGroup.create({
      data: { businessId, name, type, parentId },
    });
  }

  async createAccount(dto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        businessId: dto.businessId,
        code: dto.code,
        name: dto.name,
        accountGroupId: dto.accountGroupId,
        currency: dto.currency ?? 'INR',
        description: dto.description,
      },
    });
  }

  async findByCode(businessId: string, code: string) {
    return this.prisma.account.findFirst({ where: { businessId, code } });
  }

  async trialBalance(businessId: string, fiscalPeriodId: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: { journal: { businessId, fiscalPeriodId, status: 'POSTED' } },
      include: { account: true },
    });

    const balances = new Map<string, { debit: number; credit: number; name: string }>();
    for (const line of lines) {
      const key = line.accountId;
      const existing = balances.get(key) ?? { debit: 0, credit: 0, name: line.account.name };
      existing.debit += Number(line.debitAmount);
      existing.credit += Number(line.creditAmount);
      balances.set(key, existing);
    }
    return Array.from(balances.entries()).map(([accountId, b]) => ({ accountId, ...b }));
  }
}
