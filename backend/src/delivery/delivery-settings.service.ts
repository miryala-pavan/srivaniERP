import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DeliveryDispatchSettings {
  feeAmount: number;
  maxConcurrentPerRider: number;
  rebroadcastMinutes: number;
  staffAlertMinutes: number;
  photoRetentionDays: number;
  managerAlertPhone: string | null;
}

// Namespaced "deliveryDispatch.*" (not "delivery.*") to stay distinct from
// the pre-existing "delivery.slots" key (storefront's checkout time-window
// picker — an unrelated feature) already stored in SystemSetting.
const DEFAULTS: DeliveryDispatchSettings = {
  feeAmount: 20,
  maxConcurrentPerRider: 2,
  rebroadcastMinutes: 3,
  staffAlertMinutes: 6,
  photoRetentionDays: 5,
  managerAlertPhone: null,
};

const KEYS: Record<keyof DeliveryDispatchSettings, string> = {
  feeAmount: 'deliveryDispatch.feeAmount',
  maxConcurrentPerRider: 'deliveryDispatch.maxConcurrentPerRider',
  rebroadcastMinutes: 'deliveryDispatch.rebroadcastMinutes',
  staffAlertMinutes: 'deliveryDispatch.staffAlertMinutes',
  photoRetentionDays: 'deliveryDispatch.photoRetentionDays',
  managerAlertPhone: 'deliveryDispatch.managerAlertPhone',
};

@Injectable()
export class DeliverySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(businessId: string): Promise<DeliveryDispatchSettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { businessId, key: { in: Object.values(KEYS) } },
    });
    const byKey = new Map(rows.map(r => [r.key, r.value]));

    const num = (key: string, fallback: number) => {
      const v = byKey.get(key);
      const n = v === undefined ? NaN : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    return {
      feeAmount: num(KEYS.feeAmount, DEFAULTS.feeAmount),
      maxConcurrentPerRider: num(KEYS.maxConcurrentPerRider, DEFAULTS.maxConcurrentPerRider),
      rebroadcastMinutes: num(KEYS.rebroadcastMinutes, DEFAULTS.rebroadcastMinutes),
      staffAlertMinutes: num(KEYS.staffAlertMinutes, DEFAULTS.staffAlertMinutes),
      photoRetentionDays: num(KEYS.photoRetentionDays, DEFAULTS.photoRetentionDays),
      managerAlertPhone: byKey.get(KEYS.managerAlertPhone) || null,
    };
  }

  async update(businessId: string, updates: Partial<DeliveryDispatchSettings>): Promise<DeliveryDispatchSettings> {
    const ops = Object.entries(updates)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => {
        const key = KEYS[k as keyof DeliveryDispatchSettings];
        const value = String(v ?? '');
        return this.prisma.systemSetting.upsert({
          where: { businessId_key: { businessId, key } },
          update: { value },
          create: { businessId, key, value },
        });
      });
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getAll(businessId);
  }
}
