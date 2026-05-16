import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateFeaturesDto } from './dto/update-features.dto';

const FEATURE_KEYS = [
  'smartCartEnabled',
  'onlineOrdersEnabled',
  'whatsappEnabled',
  'autoPOEnabled',
] as const;

type FeatureKey = (typeof FEATURE_KEYS)[number];

const DEFAULTS: Record<FeatureKey, boolean> = {
  smartCartEnabled:    false,
  onlineOrdersEnabled: false,
  whatsappEnabled:     false,
  autoPOEnabled:       false,
};

const SHORTCUT_DEFAULTS: Record<string, string> = {
  'pos.shortcut.cash':         'F5',
  'pos.shortcut.upi':          'F6',
  'pos.shortcut.card':         'F7',
  'pos.shortcut.print':        'F8',
  'pos.shortcut.estimate':     'F9',
  'pos.shortcut.hold':         'Ctrl+H',
  'pos.shortcut.heldbills':    'Ctrl+B',
  'pos.shortcut.newbill':      'Ctrl+N',
  'pos.shortcut.estimatemode': 'Ctrl+E',
};

const DANGEROUS_KEYS = new Set([
  'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+Z',
  'Ctrl+W', 'Ctrl+T', 'Ctrl+R', 'Alt+F4',
]);

const BILLING_DEFAULTS = {
  'billing.defaultBillType':        'TAX_INVOICE',
  'billing.estimateValidityDays':   '3',
  'billing.autoB2BOnGstin':         'true',
  'billing.defaultPrintFormat':     'THERMAL',
  'billing.showGstBreakupOnRetail': 'true',
};

const POS_DEFAULTS = {
  'pos.single_cashier_mode': 'true',
};

const SYSTEM_DEFAULTS = {
  'system.session_timeout': '0', // 0 = unlimited
};

const GST_DEFAULTS = {
  'gst.filing_deadline_day': '10',
};

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getFeatures(businessId: string) {
    const rows = await this.prisma.systemSetting.findMany({
      where: { businessId, key: { in: FEATURE_KEYS as unknown as string[] } },
    });

    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value === 'true']));

    // Seed any missing defaults
    const missing = FEATURE_KEYS.filter((k) => !(k in stored));
    if (missing.length) {
      await this.prisma.$transaction(
        missing.map((key) =>
          this.prisma.systemSetting.upsert({
            where:  { businessId_key: { businessId, key } },
            update: {},
            create: { businessId, key, value: 'false' },
          }),
        ),
      );
    }

    const features: Record<string, boolean> = {};
    for (const key of FEATURE_KEYS) {
      features[key] = key in stored ? stored[key] : DEFAULTS[key];
    }
    return { features };
  }

  async updateFeatures(businessId: string, dto: UpdateFeaturesDto) {
    const updates = Object.entries(dto).filter(([, v]) => v !== undefined) as [FeatureKey, boolean][];

    if (updates.length === 0) return this.getFeatures(businessId);

    await this.prisma.$transaction(
      updates.map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where:  { businessId_key: { businessId, key } },
          update: { value: String(value) },
          create: { businessId, key, value: String(value) },
        }),
      ),
    );

    return this.getFeatures(businessId);
  }

  async getBillingSettings(businessId: string) {
    const keys = Object.keys(BILLING_DEFAULTS);
    const rows = await this.prisma.systemSetting.findMany({ where: { businessId, key: { in: keys } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings: Record<string, string> = {};
    for (const key of keys) {
      settings[key.replace('billing.', '')] = stored[key] ?? BILLING_DEFAULTS[key as keyof typeof BILLING_DEFAULTS];
    }
    return settings;
  }

  async updateBillingSettings(businessId: string, updates: Record<string, string>) {
    const allowed = Object.keys(BILLING_DEFAULTS).map((k) => k.replace('billing.', ''));
    const ops: any[] = [];
    for (const [field, value] of Object.entries(updates)) {
      if (!allowed.includes(field)) continue;
      const key = `billing.${field}`;
      ops.push(this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value: String(value) },
        create: { businessId, key, value: String(value) },
      }));
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getBillingSettings(businessId);
  }

  async getPosSettings(businessId: string) {
    const keys = Object.keys(POS_DEFAULTS);
    const rows = await this.prisma.systemSetting.findMany({ where: { businessId, key: { in: keys } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings: Record<string, string> = {};
    for (const key of keys) {
      settings[key.replace('pos.', '')] = stored[key] ?? POS_DEFAULTS[key as keyof typeof POS_DEFAULTS];
    }
    return settings;
  }

  async updatePosSettings(businessId: string, updates: Record<string, string>) {
    const allowed = Object.keys(POS_DEFAULTS).map((k) => k.replace('pos.', ''));
    const ops: any[] = [];
    for (const [field, value] of Object.entries(updates)) {
      if (!allowed.includes(field)) continue;
      const key = `pos.${field}`;
      ops.push(this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value: String(value) },
        create: { businessId, key, value: String(value) },
      }));
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getPosSettings(businessId);
  }

  async getPosShortcuts(businessId: string) {
    const keys = Object.keys(SHORTCUT_DEFAULTS);
    const rows = await this.prisma.systemSetting.findMany({ where: { businessId, key: { in: keys } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const shortcuts: Record<string, string> = {};
    for (const key of keys) {
      shortcuts[key.replace('pos.shortcut.', '')] = stored[key] ?? SHORTCUT_DEFAULTS[key];
    }
    return shortcuts;
  }

  async getSystemSettings(businessId: string) {
    const keys = Object.keys(SYSTEM_DEFAULTS);
    const rows = await this.prisma.systemSetting.findMany({ where: { businessId, key: { in: keys } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings: Record<string, string> = {};
    for (const key of keys) {
      settings[key.replace('system.', '')] = stored[key] ?? SYSTEM_DEFAULTS[key as keyof typeof SYSTEM_DEFAULTS];
    }
    return settings;
  }

  async updateSystemSettings(businessId: string, updates: Record<string, string>) {
    const allowed = Object.keys(SYSTEM_DEFAULTS).map((k) => k.replace('system.', ''));
    const ops: any[] = [];
    for (const [field, value] of Object.entries(updates)) {
      if (!allowed.includes(field)) continue;
      const key = `system.${field}`;
      ops.push(this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value: String(value) },
        create: { businessId, key, value: String(value) },
      }));
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getSystemSettings(businessId);
  }

  async updatePosShortcuts(businessId: string, updates: Record<string, string>) {
    const allowed = Object.keys(SHORTCUT_DEFAULTS).map((k) => k.replace('pos.shortcut.', ''));

    // Validate: no dangerous keys
    for (const [, value] of Object.entries(updates)) {
      if (DANGEROUS_KEYS.has(value)) {
        const { BadRequestException } = await import('@nestjs/common');
        throw new BadRequestException(`Key "${value}" is reserved by the browser and cannot be used.`);
      }
    }

    // Validate: no duplicate assignments
    const assigned = new Map<string, string>(); // key -> action
    const merged: Record<string, string> = { ...(await this.getPosShortcuts(businessId)) };
    for (const [action, key] of Object.entries(updates)) {
      if (allowed.includes(action)) merged[action] = key;
    }
    for (const [action, key] of Object.entries(merged)) {
      if (assigned.has(key)) {
        const { BadRequestException } = await import('@nestjs/common');
        throw new BadRequestException(`Key "${key}" is already assigned to "${assigned.get(key)}". Each action needs a unique key.`);
      }
      assigned.set(key, action);
    }

    const ops: any[] = [];
    for (const [action, value] of Object.entries(updates)) {
      if (!allowed.includes(action)) continue;
      const key = `pos.shortcut.${action}`;
      ops.push(this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      }));
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getPosShortcuts(businessId);
  }

  async getGstSettings(businessId: string) {
    const keys = Object.keys(GST_DEFAULTS);
    const rows = await this.prisma.systemSetting.findMany({ where: { businessId, key: { in: keys } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const settings: Record<string, string> = {};
    for (const key of keys) {
      settings[key.replace('gst.', '')] = stored[key] ?? GST_DEFAULTS[key as keyof typeof GST_DEFAULTS];
    }
    return settings;
  }

  async updateGstSettings(businessId: string, updates: Record<string, string>) {
    const allowed = Object.keys(GST_DEFAULTS).map((k) => k.replace('gst.', ''));
    const ops: any[] = [];
    for (const [field, value] of Object.entries(updates)) {
      if (!allowed.includes(field)) continue;
      const day = parseInt(value, 10);
      if (isNaN(day) || day < 1 || day > 28) continue;
      const key = `gst.${field}`;
      ops.push(this.prisma.systemSetting.upsert({
        where:  { businessId_key: { businessId, key } },
        update: { value: String(day) },
        create: { businessId, key, value: String(day) },
      }));
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return this.getGstSettings(businessId);
  }
}
