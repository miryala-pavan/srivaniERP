import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ── Account structure (mirrors the Phase 0 CoA seed) ─────────────────────────

interface AccountDef {
  code: string;
  name: string;
  isControl?: boolean;
  description?: string;
}

interface GroupDef {
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  accounts?: AccountDef[];
  children?: GroupDef[];
}

// Standard Indian Chart of Accounts — 134 accounts
const INDIA_COA: GroupDef[] = [
  {
    name: 'Assets',
    type: 'ASSET',
    children: [
      {
        name: 'Current Assets',
        type: 'ASSET',
        children: [
          {
            name: 'Cash & Bank',
            type: 'ASSET',
            accounts: [
              { code: '1001', name: 'Cash in Hand' },
              { code: '1002', name: 'Petty Cash' },
              { code: '1010', name: 'Bank Account — Current', isControl: true },
              { code: '1011', name: 'Bank Account — Savings' },
              { code: '1015', name: 'Bank Account — CC / OD Facility' },
            ],
          },
          {
            name: 'Receivables',
            type: 'ASSET',
            accounts: [
              { code: '1100', name: 'Trade Receivables (Debtors)', isControl: true },
              { code: '1101', name: 'Advance to Suppliers' },
              { code: '1102', name: 'Employee Advances' },
              { code: '1103', name: 'Other Receivables' },
            ],
          },
          {
            name: 'Inventory',
            type: 'ASSET',
            accounts: [
              { code: '1200', name: 'Stock in Trade', isControl: true },
              { code: '1201', name: 'Packing Materials' },
              { code: '1202', name: 'Stock in Transit' },
            ],
          },
          {
            name: 'Tax Assets',
            type: 'ASSET',
            accounts: [
              { code: '1300', name: 'CGST Input Credit' },
              { code: '1301', name: 'SGST Input Credit' },
              { code: '1302', name: 'IGST Input Credit' },
              { code: '1303', name: 'TDS Receivable' },
              { code: '1304', name: 'TCS Receivable' },
              { code: '1305', name: 'Advance Tax Paid' },
              { code: '1306', name: 'Income Tax Refund Receivable' },
            ],
          },
          {
            name: 'Prepaid & Deposits',
            type: 'ASSET',
            accounts: [
              { code: '1400', name: 'Prepaid Expenses' },
              { code: '1401', name: 'Security Deposits' },
              { code: '1402', name: 'Rent Deposits' },
            ],
          },
        ],
      },
      {
        name: 'Non-Current Assets',
        type: 'ASSET',
        children: [
          {
            name: 'Fixed Assets',
            type: 'ASSET',
            accounts: [
              { code: '1500', name: 'Land & Building' },
              { code: '1501', name: 'Furniture & Fixtures' },
              { code: '1502', name: 'Plant & Machinery' },
              { code: '1503', name: 'Computer & IT Equipment' },
              { code: '1504', name: 'Vehicles' },
              { code: '1505', name: 'Office Equipment' },
            ],
          },
          {
            name: 'Accumulated Depreciation',
            type: 'ASSET',
            accounts: [
              { code: '1600', name: 'Acc. Depreciation — Furniture & Fixtures' },
              { code: '1601', name: 'Acc. Depreciation — Plant & Machinery' },
              { code: '1602', name: 'Acc. Depreciation — Computers' },
              { code: '1603', name: 'Acc. Depreciation — Vehicles' },
            ],
          },
          {
            name: 'Intangible Assets',
            type: 'ASSET',
            accounts: [
              { code: '1700', name: 'Goodwill' },
              { code: '1701', name: 'Software Licenses' },
              { code: '1702', name: 'Brand / Trademark' },
            ],
          },
        ],
      },
    ],
  },

  {
    name: 'Liabilities',
    type: 'LIABILITY',
    children: [
      {
        name: 'Current Liabilities',
        type: 'LIABILITY',
        children: [
          {
            name: 'Trade Payables',
            type: 'LIABILITY',
            accounts: [
              { code: '2001', name: 'Trade Payables — MSME Suppliers', isControl: true },
              { code: '2002', name: 'Trade Payables — Other Suppliers', isControl: true },
              { code: '2003', name: 'Advance from Customers' },
            ],
          },
          {
            name: 'Tax Liabilities',
            type: 'LIABILITY',
            accounts: [
              { code: '2100', name: 'CGST Payable' },
              { code: '2101', name: 'SGST Payable' },
              { code: '2102', name: 'IGST Payable' },
              { code: '2103', name: 'TDS Payable' },
              { code: '2104', name: 'TCS Payable' },
              { code: '2105', name: 'Income Tax Payable' },
              { code: '2106', name: 'GST RCM Payable' },
            ],
          },
          {
            name: 'Other Current Liabilities',
            type: 'LIABILITY',
            accounts: [
              { code: '2200', name: 'Salary & Wages Payable' },
              { code: '2201', name: 'Electricity & Utilities Payable' },
              { code: '2202', name: 'Rent Payable' },
              { code: '2300', name: 'PF Payable' },
              { code: '2301', name: 'ESI Payable' },
              { code: '2302', name: 'Accrued Expenses' },
              { code: '2303', name: 'Statutory Dues Payable' },
              { code: '2304', name: 'Current Portion of Long-term Loans' },
              { code: '2305', name: 'Credit Card Outstanding' },
            ],
          },
        ],
      },
      {
        name: 'Non-Current Liabilities',
        type: 'LIABILITY',
        children: [
          {
            name: 'Long-term Loans',
            type: 'LIABILITY',
            accounts: [
              { code: '2500', name: 'Term Loan — Bank' },
              { code: '2501', name: 'Vehicle Loan' },
              { code: '2502', name: 'MSME / Mudra Loan' },
              { code: '2503', name: 'Loan from Directors / Partners' },
              { code: '2504', name: 'Unsecured Loans' },
            ],
          },
        ],
      },
    ],
  },

  {
    name: 'Equity',
    type: 'EQUITY',
    accounts: [
      { code: '3001', name: 'Capital Account — Owner', isControl: true },
      { code: '3002', name: 'Drawings Account' },
      { code: '3003', name: 'Retained Earnings' },
      { code: '3004', name: 'Profit & Loss Account (Current Year)' },
      { code: '3005', name: 'Reserves & Surplus' },
    ],
  },

  {
    name: 'Income',
    type: 'INCOME',
    children: [
      {
        name: 'Operating Revenue',
        type: 'INCOME',
        accounts: [
          { code: '4001', name: 'Sales — Trading Goods (Taxable)' },
          { code: '4002', name: 'Sales — GST Exempt Goods' },
          { code: '4003', name: 'Sales — Export (Zero-rated)' },
          { code: '4004', name: 'Online Sales Revenue' },
          { code: '4005', name: 'Sales Returns & Allowances' },
          { code: '4006', name: 'Trade Discounts Allowed' },
        ],
      },
      {
        name: 'Other Income',
        type: 'INCOME',
        accounts: [
          { code: '4100', name: 'Interest Income' },
          { code: '4101', name: 'Rent Income' },
          { code: '4102', name: 'Commission Income' },
          { code: '4103', name: 'Scrap / Damaged Goods Recovery' },
          { code: '4104', name: 'GST Input Credit Reversal Recovery' },
          { code: '4105', name: 'Miscellaneous Income' },
        ],
      },
    ],
  },

  {
    name: 'Expenses',
    type: 'EXPENSE',
    children: [
      {
        name: 'Cost of Goods Sold',
        type: 'EXPENSE',
        accounts: [
          { code: '5001', name: 'Purchases — Trading Goods' },
          { code: '5002', name: 'Purchase Returns' },
          { code: '5003', name: 'Freight Inward' },
          { code: '5004', name: 'Customs Duty / Import Charges' },
          { code: '5005', name: 'Stock Shrinkage & Wastage' },
          { code: '5006', name: 'Packing Material Cost' },
        ],
      },
      {
        name: 'Employee Costs',
        type: 'EXPENSE',
        accounts: [
          { code: '6001', name: 'Salaries & Wages' },
          { code: '6002', name: 'PF Contribution — Employer' },
          { code: '6003', name: 'ESI Contribution — Employer' },
          { code: '6004', name: 'Staff Welfare' },
          { code: '6005', name: 'Bonus & Incentives' },
        ],
      },
      {
        name: 'Operating Expenses',
        type: 'EXPENSE',
        accounts: [
          { code: '6100', name: 'Rent' },
          { code: '6101', name: 'Electricity & Water' },
          { code: '6102', name: 'Telephone & Internet' },
          { code: '6103', name: 'Office Supplies & Stationery' },
          { code: '6104', name: 'Printing & Packaging' },
          { code: '6105', name: 'Repairs & Maintenance' },
          { code: '6106', name: 'Housekeeping & Security' },
          { code: '6107', name: 'Advertisement & Marketing' },
          { code: '6108', name: 'Freight Outward & Delivery' },
          { code: '6109', name: 'Bank Charges & Commission' },
          { code: '6110', name: 'Professional Fees (CA / Legal)' },
          { code: '6111', name: 'Insurance Premium' },
          { code: '6112', name: 'Vehicle Running & Fuel' },
          { code: '6113', name: 'Subscription & Software' },
          { code: '6114', name: 'Miscellaneous Expenses' },
        ],
      },
      {
        name: 'Depreciation',
        type: 'EXPENSE',
        accounts: [
          { code: '6200', name: 'Depreciation — Furniture & Fixtures' },
          { code: '6201', name: 'Depreciation — Plant & Machinery' },
          { code: '6202', name: 'Depreciation — Computers' },
          { code: '6203', name: 'Depreciation — Vehicles' },
        ],
      },
      {
        name: 'Finance Costs',
        type: 'EXPENSE',
        accounts: [
          { code: '6300', name: 'Interest on Loans' },
          { code: '6301', name: 'Interest on CC / OD' },
          { code: '6302', name: 'Loan Processing Charges' },
          { code: '6303', name: 'Late Payment Interest' },
        ],
      },
      {
        name: 'Tax Expenses',
        type: 'EXPENSE',
        accounts: [
          { code: '6400', name: 'Income Tax — Current Year' },
          { code: '6401', name: 'GST Late Fee & Interest' },
          { code: '6402', name: 'TDS Late Fee & Interest' },
          { code: '6403', name: 'Penalty & Fines' },
        ],
      },
    ],
  },
];

// ── Number series defaults ────────────────────────────────────────────────────

const NUMBER_SERIES_DEFAULTS = [
  { code: 'SALES_INVOICE',    prefix: 'INV',  padLength: 5 },
  { code: 'PURCHASE_ORDER',   prefix: 'PO',   padLength: 5 },
  { code: 'GOODS_RECEIPT',    prefix: 'GRN',  padLength: 5 },
  { code: 'CREDIT_NOTE',      prefix: 'CN',   padLength: 5 },
  { code: 'DEBIT_NOTE',       prefix: 'DN',   padLength: 5 },
  { code: 'PAYMENT_VOUCHER',  prefix: 'PV',   padLength: 5 },
  { code: 'RECEIPT_VOUCHER',  prefix: 'RV',   padLength: 5 },
  { code: 'JOURNAL_VOUCHER',  prefix: 'JV',   padLength: 5 },
  { code: 'EXPENSE_VOUCHER',  prefix: 'EXP',  padLength: 5 },
];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run all onboarding steps for a newly created business.
   * Idempotent — safe to call again if it was partially run.
   */
  async runForBusiness(businessId: string): Promise<void> {
    this.logger.log(`Starting onboarding for business ${businessId}`);

    await this.seedChartOfAccounts(businessId);
    await this.seedFiscalPeriod(businessId);
    await this.seedNumberSeries(businessId);
    await this.seedBusinessConfig(businessId);

    this.logger.log(`Onboarding complete for business ${businessId}`);
  }

  // ── Step 1: Chart of Accounts ─────────────────────────────────────────────

  private async seedChartOfAccounts(businessId: string): Promise<void> {
    let accountsCreated = 0;

    const seedGroup = async (
      group: GroupDef,
      parentId: string | null,
    ): Promise<void> => {
      const existingGroup = await this.prisma.accountGroup.findFirst({
        where: { businessId, name: group.name },
      });

      const accountGroup = existingGroup ?? (await this.prisma.accountGroup.create({
        data: { businessId, name: group.name, type: group.type, parentId: parentId ?? undefined },
      }));

      // Seed leaf accounts
      for (const acc of group.accounts ?? []) {
        await this.prisma.account.upsert({
          where: { businessId_code: { businessId, code: acc.code } },
          create: {
            businessId,
            code: acc.code,
            name: acc.name,
            accountGroupId: accountGroup.id,
            currency: 'INR',
            isControl: acc.isControl ?? false,
            description: acc.description,
          },
          update: {},
        });
        accountsCreated++;
      }

      // Recurse into children
      for (const child of group.children ?? []) {
        await seedGroup(child, accountGroup.id);
      }
    };

    for (const topGroup of INDIA_COA) {
      await seedGroup(topGroup, null);
    }

    this.logger.log(`CoA seeded: ${accountsCreated} accounts for ${businessId}`);
  }

  // ── Step 2: Current Fiscal Period ─────────────────────────────────────────

  private async seedFiscalPeriod(businessId: string): Promise<void> {
    const now = new Date();
    const calYear = now.getFullYear();
    const month = now.getMonth() + 1; // 1-based

    // Indian FY: April–March
    const fyStartYear = month >= 4 ? calYear : calYear - 1;
    const startDate = new Date(`${fyStartYear}-04-01`);
    const endDate = new Date(`${fyStartYear + 1}-03-31`);
    const name = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;

    const existing = await this.prisma.fiscalPeriod.findFirst({
      where: { businessId, startDate, endDate },
    });

    if (!existing) {
      await this.prisma.fiscalPeriod.create({
        data: { businessId, name, startDate, endDate, status: 'OPEN' },
      });
      this.logger.log(`Fiscal period created: ${name} for ${businessId}`);
    }
  }

  // ── Step 3: Number Series ─────────────────────────────────────────────────

  private async seedNumberSeries(businessId: string): Promise<void> {
    for (const ns of NUMBER_SERIES_DEFAULTS) {
      await this.prisma.numberSeries.upsert({
        where: { businessId_code: { businessId, code: ns.code } },
        create: { businessId, code: ns.code, prefix: ns.prefix, padLength: ns.padLength, currentValue: 0 },
        update: {},
      });
    }
    this.logger.log(`Number series seeded for ${businessId}`);
  }

  // ── Step 4: Business Config (feature flags) ───────────────────────────────

  private async seedBusinessConfig(businessId: string): Promise<void> {
    const defaults: Array<{ key: string; value: string }> = [
      { key: 'FEATURE_TDS_MODULE',       value: 'false' },
      { key: 'FEATURE_GST_FILING',       value: 'false' },
      { key: 'FEATURE_MULTI_BRANCH',     value: 'false' },
      { key: 'FEATURE_LEDGER_API',       value: 'false' },
      { key: 'FEATURE_AI_ASSISTANT',     value: 'false' },
      { key: 'FEATURE_WHATSAPP_ORDERS',  value: 'false' },
      { key: 'TAX_REGIME',               value: 'NEW'   },
      { key: 'CURRENCY',                 value: 'INR'   },
      { key: 'LOCALE',                   value: 'en-IN' },
      { key: 'MSME_REGISTERED',          value: 'false' },
    ];

    for (const cfg of defaults) {
      await this.prisma.businessConfig.upsert({
        where: { businessId_key: { businessId, key: cfg.key } },
        create: { businessId, key: cfg.key, value: cfg.value },
        update: {},
      });
    }
    this.logger.log(`Business config seeded for ${businessId}`);
  }
}
