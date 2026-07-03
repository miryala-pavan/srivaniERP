/**
 * Seed the Rule Engine with all current Indian tax rules.
 * Run: npx ts-node src/platform/rule-engine/seeds/india-tax-rules.seed.ts
 *
 * This seed is idempotent — safe to re-run. Uses upsert on RuleSet.code + effectiveFrom.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedRule {
  condition: Record<string, unknown>;
  effect: Record<string, unknown>;
  priority: number;
  notes?: string;
}

interface SeedRuleSet {
  ruleSetCode: string;
  name: string;
  category: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceAct: string;
  sourceSection: string;
  rules: SeedRule[];
}

const AUTHORITIES = {
  INCOME_TAX: {
    code: 'INCOME_TAX_ACT_1961',
    name: 'Income Tax Act 1961',
    jurisdiction: 'IN',
  },
  GST: {
    code: 'CGST_ACT_2017',
    name: 'Central Goods and Services Tax Act 2017',
    jurisdiction: 'IN',
  },
  COMPLIANCE: {
    code: 'IT_COMPLIANCE',
    name: 'Income Tax Compliance Rules',
    jurisdiction: 'IN',
  },
};

const RULE_SETS: Array<SeedRuleSet & { authorityCode: string }> = [
  {
    authorityCode: 'INCOME_TAX_ACT_1961',
    ruleSetCode: 'TDS_SECTION_194J',
    name: 'TDS on Professional / Technical Services',
    category: 'TDS',
    effectiveFrom: '2021-04-01',
    sourceAct: 'Income Tax Act 1961 amended by Finance Act 2020',
    sourceSection: 'Section 194J',
    rules: [
      // Threshold check first (priority 0 = exempt trumps everything)
      {
        condition: { cumulativeAmount: { op: 'lt', value: 50000 } },
        effect: { rate: 0, exempt: true },
        priority: 0,
        notes: 'Threshold ₹50,000/year — Budget 2025 raised from ₹30,000',
      },
      { condition: { vendorServiceType: 'TECHNICAL' }, effect: { rate: 0.02 }, priority: 1, notes: 'Technical services 2%' },
      { condition: { vendorServiceType: 'PROFESSIONAL' }, effect: { rate: 0.10 }, priority: 2, notes: 'Professional services 10%' },
      { condition: { vendorServiceType: 'ROYALTY' }, effect: { rate: 0.10 }, priority: 3, notes: 'Royalty 10%' },
      { condition: { vendorServiceType: 'DIRECTOR_FEES' }, effect: { rate: 0.10 }, priority: 4, notes: 'Director fees 10%' },
    ],
  },

  {
    authorityCode: 'INCOME_TAX_ACT_1961',
    ruleSetCode: 'TDS_SECTION_194C',
    name: 'TDS on Contractor Payments',
    category: 'TDS',
    effectiveFrom: '2010-04-01',
    sourceAct: 'Income Tax Act 1961',
    sourceSection: 'Section 194C',
    rules: [
      {
        condition: { singleAmount: { op: 'lt', value: 30000 }, cumulativeAmount: { op: 'lt', value: 100000 } },
        effect: { rate: 0, exempt: true },
        priority: 0,
        notes: 'Exempt if single payment < ₹30,000 AND cumulative < ₹1,00,000',
      },
      { condition: { vendorEntityType: 'INDIVIDUAL' }, effect: { rate: 0.01 }, priority: 1, notes: 'Individual 1%' },
      { condition: { vendorEntityType: 'HUF' }, effect: { rate: 0.01 }, priority: 2, notes: 'HUF 1%' },
      { condition: {}, effect: { rate: 0.02 }, priority: 10, notes: 'Others (Company/LLP) 2%' },
    ],
  },

  {
    authorityCode: 'INCOME_TAX_ACT_1961',
    ruleSetCode: 'TDS_SECTION_194I',
    name: 'TDS on Rent',
    category: 'TDS',
    effectiveFrom: '2010-04-01',
    sourceAct: 'Income Tax Act 1961',
    sourceSection: 'Section 194I',
    rules: [
      {
        condition: { cumulativeAmount: { op: 'lt', value: 240000 } },
        effect: { rate: 0, exempt: true },
        priority: 0,
        notes: 'Exempt if annual rent < ₹2,40,000',
      },
      { condition: { assetType: 'PLANT_MACHINERY' }, effect: { rate: 0.02 }, priority: 1, notes: 'Plant & Machinery 2%' },
      { condition: { assetType: 'LAND_BUILDING' }, effect: { rate: 0.10 }, priority: 2, notes: 'Land/Building 10%' },
      { condition: { assetType: 'FURNITURE' }, effect: { rate: 0.10 }, priority: 3, notes: 'Furniture 10%' },
    ],
  },

  {
    authorityCode: 'CGST_ACT_2017',
    ruleSetCode: 'GST_RATE_STANDARD',
    name: 'Standard GST Rate Slabs',
    category: 'GST',
    effectiveFrom: '2017-07-01',
    sourceAct: 'CGST Act 2017',
    sourceSection: 'Schedules I-V',
    rules: [
      { condition: { gstSlab: 'EXEMPT' }, effect: { cgst: 0, sgst: 0, igst: 0 }, priority: 1 },
      { condition: { gstSlab: 'ZERO' }, effect: { cgst: 0, sgst: 0, igst: 0 }, priority: 2 },
      { condition: { gstSlab: '5' }, effect: { cgst: 0.025, sgst: 0.025, igst: 0.05 }, priority: 3 },
      { condition: { gstSlab: '12' }, effect: { cgst: 0.06, sgst: 0.06, igst: 0.12 }, priority: 4 },
      { condition: { gstSlab: '18' }, effect: { cgst: 0.09, sgst: 0.09, igst: 0.18 }, priority: 5 },
      { condition: { gstSlab: '28' }, effect: { cgst: 0.14, sgst: 0.14, igst: 0.28 }, priority: 6 },
    ],
  },

  {
    authorityCode: 'INCOME_TAX_ACT_1961',
    ruleSetCode: 'ADVANCE_TAX_NEW_REGIME',
    name: 'Advance Tax Instalment Schedule',
    category: 'ADVANCE_TAX',
    effectiveFrom: '2024-04-01',
    sourceAct: 'Income Tax Act 1961 amended by Finance Act 2024',
    sourceSection: 'Section 207-209',
    rules: [
      { condition: { quarter: 'Q1' }, effect: { percentage: 0.15, dueDay: 15, dueMonth: 6 }, priority: 1, notes: 'By 15 June: 15% of estimated annual tax' },
      { condition: { quarter: 'Q2' }, effect: { percentage: 0.45, dueDay: 15, dueMonth: 9 }, priority: 2, notes: 'By 15 Sep: 45% cumulative' },
      { condition: { quarter: 'Q3' }, effect: { percentage: 0.75, dueDay: 15, dueMonth: 12 }, priority: 3, notes: 'By 15 Dec: 75% cumulative' },
      { condition: { quarter: 'Q4' }, effect: { percentage: 1.00, dueDay: 15, dueMonth: 3 }, priority: 4, notes: 'By 15 Mar: 100% cumulative' },
    ],
  },

  {
    authorityCode: 'INCOME_TAX_ACT_1961',
    ruleSetCode: 'INCOME_TAX_NEW_REGIME_2025_26',
    name: 'Income Tax Slabs — New Regime FY 2025-26 (AY 2026-27)',
    category: 'INCOME_TAX',
    effectiveFrom: '2025-04-01',
    sourceAct: 'Finance Act 2025',
    sourceSection: 'Section 115BAC',
    rules: [
      { condition: { income: { op: 'lte', value: 400000 } }, effect: { rate: 0 }, priority: 1, notes: 'Up to ₹4L: NIL' },
      { condition: { income: { from: 400001, to: 800000 } }, effect: { rate: 0.05 }, priority: 2, notes: '₹4L-8L: 5%' },
      { condition: { income: { from: 800001, to: 1200000 } }, effect: { rate: 0.10 }, priority: 3, notes: '₹8L-12L: 10%' },
      { condition: { income: { from: 1200001, to: 1600000 } }, effect: { rate: 0.15 }, priority: 4, notes: '₹12L-16L: 15%' },
      { condition: { income: { from: 1600001, to: 2000000 } }, effect: { rate: 0.20 }, priority: 5, notes: '₹16L-20L: 20%' },
      { condition: { income: { from: 2000001, to: 2400000 } }, effect: { rate: 0.25 }, priority: 6, notes: '₹20L-24L: 25%' },
      { condition: { income: { op: 'gt', value: 2400000 } }, effect: { rate: 0.30 }, priority: 7, notes: 'Above ₹24L: 30%' },
      {
        condition: { income: { op: 'lte', value: 1200000 } },
        effect: { rebate: true, maxRebate: 60000 },
        priority: 0,
        notes: 'Section 87A rebate: tax nil if income ≤ ₹12L (Finance Act 2025)',
      },
      {
        condition: { incomeType: 'SALARY' },
        effect: { standardDeduction: 75000 },
        priority: 0,
        notes: 'Standard deduction ₹75,000 for salaried employees',
      },
    ],
  },

  {
    authorityCode: 'IT_COMPLIANCE',
    ruleSetCode: 'MSME_PAYMENT_43BH',
    name: 'MSME Payment Obligation — Section 43B(h)',
    category: 'COMPLIANCE',
    effectiveFrom: '2023-04-01',
    sourceAct: 'Income Tax Act 1961 amended by Finance Act 2023',
    sourceSection: 'Section 43B(h)',
    rules: [
      { condition: { msmeCategory: 'MICRO' }, effect: { maxPaymentDays: 45 }, priority: 1, notes: 'Micro MSME: pay within 45 days' },
      { condition: { msmeCategory: 'SMALL' }, effect: { maxPaymentDays: 45 }, priority: 2, notes: 'Small MSME: pay within 45 days' },
      { condition: { msmeCategory: 'MEDIUM' }, effect: { maxPaymentDays: 45 }, priority: 3, notes: 'Medium MSME: pay within 45 days' },
    ],
  },

  {
    authorityCode: 'IT_COMPLIANCE',
    ruleSetCode: 'CASH_PAYMENT_40A3',
    name: 'Cash Payment Disallowance — Section 40A(3)',
    category: 'COMPLIANCE',
    effectiveFrom: '2017-04-01',
    sourceAct: 'Income Tax Act 1961',
    sourceSection: 'Section 40A(3)',
    rules: [
      {
        condition: { paymentMode: 'CASH', singleDayAmount: { op: 'gt', value: 10000 } },
        effect: { disallowed: true, reason: 'Cash payment exceeds ₹10,000 — Section 40A(3) disallowance' },
        priority: 1,
        notes: 'General: cash >₹10,000 in single day to single person not deductible',
      },
      {
        condition: { paymentMode: 'CASH', vendorType: 'TRANSPORT', singleDayAmount: { op: 'gt', value: 35000 } },
        effect: { disallowed: true, reason: 'Cash transport payment exceeds ₹35,000 — Section 40A(3) disallowance' },
        priority: 2,
        notes: 'Transport contractors: ₹35,000 cash limit',
      },
    ],
  },
];

async function seed() {
  console.log('Seeding Rule Engine with India tax rules...\n');

  // Upsert authorities
  for (const auth of Object.values(AUTHORITIES)) {
    await prisma.ruleAuthority.upsert({
      where: { code: auth.code },
      create: auth,
      update: { name: auth.name },
    });
    console.log(`  Authority: ${auth.code}`);
  }

  // Upsert rule sets and their rules
  for (const rs of RULE_SETS) {
    const authority = await prisma.ruleAuthority.findUniqueOrThrow({
      where: { code: rs.authorityCode },
    });

    const effectiveFrom = new Date(rs.effectiveFrom);

    // Find existing or create
    let ruleSet = await prisma.ruleSet.findFirst({
      where: { code: rs.ruleSetCode, effectiveFrom },
    });

    if (!ruleSet) {
      ruleSet = await prisma.ruleSet.create({
        data: {
          authorityId: authority.id,
          code: rs.ruleSetCode,
          name: rs.name,
          category: rs.category,
          effectiveFrom,
          effectiveTo: rs.effectiveTo ? new Date(rs.effectiveTo) : null,
          sourceSection: rs.sourceSection,
          notes: rs.sourceAct,
        },
      });
      console.log(`  RuleSet created: ${rs.ruleSetCode} (effective ${rs.effectiveFrom})`);
    } else {
      console.log(`  RuleSet exists:  ${rs.ruleSetCode} (effective ${rs.effectiveFrom})`);
    }

    // Delete and re-create rules to ensure they're up to date
    await prisma.rule.deleteMany({ where: { ruleSetId: ruleSet.id } });
    for (const rule of rs.rules) {
      await prisma.rule.create({
        data: {
          ruleSetId: ruleSet.id,
          priority: rule.priority,
          condition: rule.condition as Prisma.InputJsonValue,
          effect: rule.effect as Prisma.InputJsonValue,
          notes: rule.notes,
        },
      });
    }
    console.log(`    → ${rs.rules.length} rules seeded`);
  }

  console.log('\nDone. Rule Engine seeded with 8 rule sets.');
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
