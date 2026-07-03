import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ConfigKey =
  | 'FEATURE_TDS_MODULE'
  | 'FEATURE_GST_FILING'
  | 'FEATURE_ADVANCE_TAX'
  | 'FEATURE_GENERAL_LEDGER'
  | 'FEATURE_AI_PLATFORM'
  | 'FEATURE_DOCUMENT_PLATFORM'
  | 'FEATURE_OUTBOX_EVENTS'
  | 'FEATURE_AUDIT_LOG'
  | 'FEATURE_RULE_ENGINE'
  | 'FEATURE_NUMBER_SERIES';

@Injectable()
export class BusinessConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(businessId: string, key: ConfigKey): Promise<string | null> {
    const config = await this.prisma.businessConfig.findFirst({
      where: { businessId, key },
    });
    return config?.value ?? null;
  }

  async isEnabled(businessId: string, key: ConfigKey): Promise<boolean> {
    const value = await this.get(businessId, key);
    return value === 'true';
  }

  async set(businessId: string, key: ConfigKey, value: string): Promise<void> {
    await this.prisma.businessConfig.upsert({
      where: { businessId_key: { businessId, key } },
      create: { businessId, key, value },
      update: { value },
    });
  }

  async initDefaults(businessId: string): Promise<void> {
    const defaults: ConfigKey[] = [
      'FEATURE_TDS_MODULE',
      'FEATURE_GST_FILING',
      'FEATURE_ADVANCE_TAX',
      'FEATURE_GENERAL_LEDGER',
      'FEATURE_AI_PLATFORM',
      'FEATURE_DOCUMENT_PLATFORM',
      'FEATURE_OUTBOX_EVENTS',
      'FEATURE_AUDIT_LOG',
      'FEATURE_RULE_ENGINE',
      'FEATURE_NUMBER_SERIES',
    ];

    for (const key of defaults) {
      await this.prisma.businessConfig.upsert({
        where: { businessId_key: { businessId, key } },
        create: { businessId, key, value: 'false' },
        update: {},
      });
    }
  }
}
