import { ModuleHelp } from '../platform/help/help.interface';

export const TDS_HELP: ModuleHelp = {
  module: 'tds',
  title: 'TDS Module',
  phase: 'Phase 1',
  description:
    'Manages Tax Deducted at Source (TDS): auto-deduction via Rule Engine (194J/194C/194I), ' +
    'TDS ledger, challan deposit tracking, and quarterly Form 26Q data. ' +
    'TDS rates are never hardcoded — always resolved through the Rule Engine.',
  caNote:
    'TDS must be deducted at payment or booking, whichever is earlier. ' +
    'Deposit by 7th of following month (March by 30th April). ' +
    '26Q must be filed quarterly. Sec 43B(h): MSME payment within 45 days or TDS provisions apply.',
  endpoints: [
    {
      method: 'POST',
      path: '/api/tds/compute',
      summary: 'Compute TDS for a transaction using Rule Engine (returns rate, amount, section)',
      example: { section: '194J', grossAmount: 50000, partyPan: 'ABCDE1234F' },
    },
    {
      method: 'GET',
      path: '/api/tds/ledger',
      summary: 'List all TDS deduction entries (optional ?financialYear=2025-26&section=194J)',
    },
    {
      method: 'GET',
      path: '/api/tds/ledger/:id',
      summary: 'Get a specific TDS entry',
    },
    {
      method: 'GET',
      path: '/api/tds/summary',
      summary: 'TDS dashboard: total deducted, deposited, outstanding, by section',
    },
    {
      method: 'POST',
      path: '/api/tds/challans',
      summary: 'Record a TDS challan deposit (BSR code, challan serial, amount)',
    },
    {
      method: 'GET',
      path: '/api/tds/challans',
      summary: 'List TDS challans (optional ?financialYear=2025-26)',
    },
    {
      method: 'GET',
      path: '/api/tds/form-26q',
      summary: 'Get 26Q data for a quarter (deductee-wise summary for return filing)',
      example: { financialYear: '2025-26', quarter: 'Q2' },
    },
    {
      method: 'GET',
      path: '/api/tds/sections',
      summary: 'List all TDS sections known to the Rule Engine with current rates',
    },
    {
      method: 'GET',
      path: '/api/tds/help',
      summary: 'This help document',
    },
  ],
  guides: [
    '194J: Professional/technical services — 10% (2% for companies). Threshold ₹30,000/year.',
    '194C: Contractor payments — 1% (individual/HUF) / 2% (others). Threshold ₹30,000 per payment or ₹1L/year.',
    '194I: Rent — 10% (land/building), 2% (plant & machinery). Threshold ₹2.4L/year.',
    'Section 40A(3): Cash payments >₹10,000 to single party in a day are disallowed as expense.',
    'MSME 43B(h): If MSME invoice not paid within 45 days, full amount becomes disallowed expense for that year.',
  ],
};
