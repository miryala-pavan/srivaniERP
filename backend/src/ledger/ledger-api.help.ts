import { ModuleHelp } from '../platform/help/help.interface';

export const LEDGER_API_HELP: ModuleHelp = {
  module: 'ledger',
  title: 'Ledger API',
  phase: 'Phase 1',
  description:
    'Exposes the double-entry accounting engine as REST endpoints. ' +
    'Post journal entries, query trial balance, generate P&L and Balance Sheet, ' +
    'and manage fiscal periods. All financial amounts in Decimal(19,4). ' +
    'Journals are immutable once posted — reversals create a counter-entry.',
  caNote:
    'All debits must equal credits per journal (validated at DB level). ' +
    'Trial balance should be run and reconciled at each month-end before GST/TDS filing. ' +
    'Balance Sheet always balances: Assets = Liabilities + Equity.',
  endpoints: [
    {
      method: 'POST',
      path: '/api/ledger/journals',
      summary: 'Post a journal entry (debits must equal credits)',
      example: {
        fiscalPeriodId: 'fp_xxx',
        reference: 'INV-001',
        narration: 'Sales to customer XYZ',
        lines: [
          { accountCode: '1100', debit: 11800, credit: 0 },
          { accountCode: '4000', debit: 0, credit: 10000 },
          { accountCode: '2200', debit: 0, credit: 1800 },
        ],
      },
    },
    {
      method: 'GET',
      path: '/api/ledger/journals',
      summary: 'List journals (optional ?fiscalPeriodId=&reference=&limit=)',
    },
    {
      method: 'GET',
      path: '/api/ledger/journals/:id',
      summary: 'Get a journal with all lines',
    },
    {
      method: 'POST',
      path: '/api/ledger/journals/:id/reverse',
      summary: 'Create a reversal journal for a posted entry',
    },
    {
      method: 'GET',
      path: '/api/ledger/trial-balance',
      summary: 'Trial balance as at a date (optional ?asAt=YYYY-MM-DD)',
    },
    {
      method: 'GET',
      path: '/api/ledger/profit-loss',
      summary: 'Profit & Loss for a fiscal period or date range',
    },
    {
      method: 'GET',
      path: '/api/ledger/balance-sheet',
      summary: 'Balance Sheet as at a date',
    },
    {
      method: 'GET',
      path: '/api/ledger/fiscal-periods',
      summary: 'List fiscal periods for the business',
    },
    {
      method: 'POST',
      path: '/api/ledger/fiscal-periods',
      summary: 'Create a fiscal period (open or close)',
    },
    {
      method: 'GET',
      path: '/api/ledger/accounts',
      summary: 'List chart of accounts (optional ?groupCode=)',
    },
    {
      method: 'GET',
      path: '/api/ledger/help',
      summary: 'This help document',
    },
  ],
  guides: [
    'Journal Rules: Every entry must balance. Posted journals cannot be edited — use reversal.',
    'Trial Balance: Sum of all debit balances must equal sum of all credit balances.',
    'P&L = Revenue (4xxx) – Expenses (5xxx-6xxx). Closing balance goes to Retained Earnings.',
    'Balance Sheet: Assets (1xxx) = Liabilities (2xxx) + Equity (3xxx) + Net Profit.',
    'Indian FY: April 1 – March 31. Fiscal periods are monthly sub-periods within the FY.',
  ],
};
