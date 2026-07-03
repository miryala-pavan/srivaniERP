/**
 * Seed the standard Indian Chart of Accounts for a given businessId.
 * Run: npx ts-node src/platform/ledger/seeds/india-chart-of-accounts.seed.ts <businessId>
 *
 * Idempotent — uses upsert on (businessId, code).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Account Group / Account structure ────────────────────────────────────────
// Each top-level entry is a group; children are the leaf accounts (code + name).
// Group type: ASSET | LIABILITY | EQUITY | INCOME | EXPENSE

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

const INDIA_COA: GroupDef[] = [
  // ── ASSETS ──────────────────────────────────────────────────────────────
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
            name: 'Trade Receivables',
            type: 'ASSET',
            accounts: [
              { code: '1100', name: 'Sundry Debtors (Trade Receivables)', isControl: true },
              { code: '1101', name: 'Debtors — Domestic' },
              { code: '1102', name: 'Debtors — Online Orders' },
              { code: '1105', name: 'Advance to Customers' },
            ],
          },
          {
            name: 'Inventory',
            type: 'ASSET',
            accounts: [
              { code: '1200', name: 'Stock — Trading Goods' },
              { code: '1201', name: 'Stock — Raw Materials' },
              { code: '1202', name: 'Stock — Finished Goods' },
              { code: '1203', name: 'Stock — Packing Materials' },
              { code: '1205', name: 'Stock in Transit' },
              { code: '1210', name: 'Goods Returned (Inward)' },
            ],
          },
          {
            name: 'GST Receivable',
            type: 'ASSET',
            accounts: [
              { code: '1300', name: 'CGST Input Tax Credit' },
              { code: '1301', name: 'SGST Input Tax Credit' },
              { code: '1302', name: 'IGST Input Tax Credit' },
              { code: '1303', name: 'GST Refund Receivable' },
              { code: '1305', name: 'TDS Receivable (26AS)' },
              { code: '1306', name: 'Advance Tax Paid' },
              { code: '1307', name: 'Self-Assessment Tax Paid' },
            ],
          },
          {
            name: 'Other Current Assets',
            type: 'ASSET',
            accounts: [
              { code: '1400', name: 'Prepaid Expenses' },
              { code: '1401', name: 'Advance to Suppliers', isControl: true },
              { code: '1402', name: 'Security Deposits (Short-term)' },
              { code: '1403', name: 'Employee Advances' },
              { code: '1404', name: 'Accrued Income' },
              { code: '1405', name: 'Interest Receivable' },
            ],
          },
        ],
      },
      {
        name: 'Non-Current Assets',
        type: 'ASSET',
        children: [
          {
            name: 'Fixed Assets (Tangible)',
            type: 'ASSET',
            accounts: [
              { code: '1500', name: 'Land & Building (Gross)' },
              { code: '1501', name: 'Plant & Machinery (Gross)' },
              { code: '1502', name: 'Furniture & Fixtures (Gross)' },
              { code: '1503', name: 'Computers & IT Equipment (Gross)' },
              { code: '1504', name: 'Vehicles (Gross)' },
              { code: '1505', name: 'Office Equipment (Gross)' },
              { code: '1510', name: 'Capital Work-in-Progress' },
            ],
          },
          {
            name: 'Accumulated Depreciation',
            type: 'ASSET',
            accounts: [
              { code: '1550', name: 'Accum. Depreciation — Land & Building' },
              { code: '1551', name: 'Accum. Depreciation — Plant & Machinery' },
              { code: '1552', name: 'Accum. Depreciation — Furniture & Fixtures' },
              { code: '1553', name: 'Accum. Depreciation — Computers & IT' },
              { code: '1554', name: 'Accum. Depreciation — Vehicles' },
              { code: '1555', name: 'Accum. Depreciation — Office Equipment' },
            ],
          },
          {
            name: 'Intangible Assets',
            type: 'ASSET',
            accounts: [
              { code: '1600', name: 'Goodwill' },
              { code: '1601', name: 'Software Licenses' },
              { code: '1602', name: 'Brand / Trademarks' },
            ],
          },
          {
            name: 'Long-term Investments & Deposits',
            type: 'ASSET',
            accounts: [
              { code: '1700', name: 'Security Deposits (Long-term)' },
              { code: '1701', name: 'Fixed Deposits (> 1 year)' },
              { code: '1702', name: 'Investments — Shares & Mutual Funds' },
            ],
          },
        ],
      },
    ],
  },

  // ── LIABILITIES ──────────────────────────────────────────────────────────
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
              { code: '2001', name: 'Sundry Creditors (Trade Payables)', isControl: true },
              { code: '2002', name: 'Creditors — MSME Suppliers', description: 'Tracked separately for 43B(h) compliance' },
              { code: '2003', name: 'Creditors — Non-MSME Suppliers' },
              { code: '2005', name: 'Advance from Customers' },
            ],
          },
          {
            name: 'GST Payable',
            type: 'LIABILITY',
            accounts: [
              { code: '2100', name: 'CGST Payable (Output)' },
              { code: '2101', name: 'SGST Payable (Output)' },
              { code: '2102', name: 'IGST Payable (Output)' },
              { code: '2103', name: 'GST — RCM Payable' },
              { code: '2104', name: 'GST — TCS Payable' },
            ],
          },
          {
            name: 'TDS & Tax Payable',
            type: 'LIABILITY',
            accounts: [
              { code: '2200', name: 'TDS Payable — 194J (Professional)' },
              { code: '2201', name: 'TDS Payable — 194C (Contractor)' },
              { code: '2202', name: 'TDS Payable — 194I (Rent)' },
              { code: '2203', name: 'TDS Payable — Others' },
              { code: '2204', name: 'Income Tax Payable' },
              { code: '2205', name: 'Advance Tax — Instalment Payable' },
              { code: '2206', name: 'Professional Tax Payable' },
            ],
          },
          {
            name: 'Other Current Liabilities',
            type: 'LIABILITY',
            accounts: [
              { code: '2300', name: 'Salary & Wages Payable' },
              { code: '2301', name: 'PF Payable' },
              { code: '2302', name: 'ESI Payable' },
              { code: '2303', name: 'Accrued Expenses' },
              { code: '2304', name: 'Statutory Dues Payable' },
              { code: '2305', name: 'Current Portion of Long-term Loans' },
              { code: '2306', name: 'Credit Card Outstanding' },
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

  // ── EQUITY ───────────────────────────────────────────────────────────────
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

  // ── INCOME ───────────────────────────────────────────────────────────────
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

  // ── EXPENSES ─────────────────────────────────────────────────────────────
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
          { code: '5004', name: 'Import Duties & Customs' },
          { code: '5005', name: 'Packaging Material Consumed' },
        ],
      },
      {
        name: 'Employee Costs',
        type: 'EXPENSE',
        accounts: [
          { code: '5100', name: 'Salaries & Wages' },
          { code: '5101', name: 'Employer PF Contribution' },
          { code: '5102', name: 'Employer ESI Contribution' },
          { code: '5103', name: 'Staff Bonus & Incentives' },
          { code: '5104', name: 'Staff Welfare Expenses' },
        ],
      },
      {
        name: 'Operating Expenses',
        type: 'EXPENSE',
        accounts: [
          { code: '5200', name: 'Rent Expense' },
          { code: '5201', name: 'Electricity & Utilities' },
          { code: '5202', name: 'Communication & Internet' },
          { code: '5203', name: 'Office Supplies & Stationery' },
          { code: '5204', name: 'Repairs & Maintenance' },
          { code: '5205', name: 'Printing & Postage' },
          { code: '5206', name: 'Travelling & Conveyance' },
          { code: '5207', name: 'Vehicle Running Expenses' },
          { code: '5208', name: 'Security Expenses' },
          { code: '5209', name: 'Cleaning & Housekeeping' },
        ],
      },
      {
        name: 'Administrative & Professional',
        type: 'EXPENSE',
        accounts: [
          { code: '5300', name: 'Professional Fees (CA / Legal / Consultant)' },
          { code: '5301', name: 'Audit Fees' },
          { code: '5302', name: 'Filing & Registration Fees' },
          { code: '5303', name: 'Bank Charges & Commission' },
          { code: '5304', name: 'Insurance Premium' },
          { code: '5305', name: 'Subscription & Software' },
          { code: '5306', name: 'Advertisement & Marketing' },
        ],
      },
      {
        name: 'Financial Costs',
        type: 'EXPENSE',
        accounts: [
          { code: '5400', name: 'Interest on Term Loans' },
          { code: '5401', name: 'Interest on Working Capital / OD' },
          { code: '5402', name: 'Interest on TDS Late Deposit' },
          { code: '5403', name: 'Bank Processing Fees & Loan Charges' },
          { code: '5404', name: 'GST Late Fee & Interest' },
        ],
      },
      {
        name: 'Depreciation',
        type: 'EXPENSE',
        accounts: [
          { code: '5500', name: 'Depreciation — Plant & Machinery' },
          { code: '5501', name: 'Depreciation — Furniture & Fixtures' },
          { code: '5502', name: 'Depreciation — Computers & IT Equipment' },
          { code: '5503', name: 'Depreciation — Vehicles' },
          { code: '5504', name: 'Depreciation — Office Equipment' },
          { code: '5505', name: 'Amortisation — Intangible Assets' },
        ],
      },
      {
        name: 'Tax Expenses',
        type: 'EXPENSE',
        accounts: [
          { code: '5600', name: 'Income Tax Expense' },
          { code: '5601', name: 'Deferred Tax Expense' },
          { code: '5602', name: 'TDS Disallowed (Section 40A(3))' },
          { code: '5603', name: 'Penalties & Fines (non-deductible)' },
        ],
      },
    ],
  },
];

// ── Recursive seed function ───────────────────────────────────────────────────

async function seedGroup(
  businessId: string,
  group: GroupDef,
  parentId: string | null = null,
  depth = 0,
): Promise<void> {
  const indent = '  '.repeat(depth);

  // Create / find the group
  const existing = await prisma.accountGroup.findFirst({
    where: { businessId, name: group.name, type: group.type },
  });

  const accountGroup = existing ?? await prisma.accountGroup.create({
    data: { businessId, name: group.name, type: group.type, parentId },
  });

  console.log(`${indent}[${group.type}] ${group.name}`);

  // Seed leaf accounts
  if (group.accounts) {
    for (const acc of group.accounts) {
      await prisma.account.upsert({
        where: { businessId_code: { businessId, code: acc.code } },
        create: {
          businessId,
          accountGroupId: accountGroup.id,
          code: acc.code,
          name: acc.name,
          isControl: acc.isControl ?? false,
          description: acc.description,
        },
        update: { name: acc.name, description: acc.description },
      });
      console.log(`${indent}  ${acc.code}  ${acc.name}`);
    }
  }

  // Recurse into child groups
  if (group.children) {
    for (const child of group.children) {
      await seedGroup(businessId, child, accountGroup.id, depth + 1);
    }
  }
}

async function seed() {
  const businessId = process.argv[2];
  if (!businessId) {
    // Seed for all existing businesses
    const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
    if (!businesses.length) {
      console.error('No businesses found. Pass a businessId as argument.');
      process.exit(1);
    }
    for (const biz of businesses) {
      console.log(`\n=== Seeding CoA for: ${biz.name} (${biz.id}) ===\n`);
      for (const group of INDIA_COA) {
        await seedGroup(biz.id, group);
      }
    }
  } else {
    console.log(`\n=== Seeding CoA for businessId: ${businessId} ===\n`);
    for (const group of INDIA_COA) {
      await seedGroup(businessId, group);
    }
  }

  const total = await prisma.account.count();
  console.log(`\nDone. Total accounts in DB: ${total}`);
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
