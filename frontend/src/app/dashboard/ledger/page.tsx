'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Scale, TrendingUp, Landmark, CheckCircle2, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { inr, fmtDate } from '@/lib/report-format';

interface FiscalPeriod { id: string; name: string; startDate: string; endDate: string; status: string; }
interface TrialBalance {
  fiscalPeriodId: string;
  rows: { accountId: string; name: string; debit: number; credit: number }[];
  totals: { debit: number; credit: number };
  balanced: boolean;
}
interface ProfitLoss {
  revenue: number; expenses: number; netProfit: number;
  revenueBreakdown: Record<string, number>; expenseBreakdown: Record<string, number>;
}
interface BalanceSheet {
  asAt: string; assets: number; liabilities: number; equity: number;
  totalLiabilitiesAndEquity: number; balances: boolean;
  assetBreakdown: Record<string, number>; liabilityBreakdown: Record<string, number>; equityBreakdown: Record<string, number>;
}

type Tab = 'trial-balance' | 'profit-loss' | 'balance-sheet';

function BreakdownTable({ title, rows, color }: { title: string; rows: Record<string, number>; color: string }) {
  const entries = Object.entries(rows).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([name, v]) => (
            <tr key={name} className="border-b border-gray-50">
              <td className="px-4 py-2 text-gray-600">{name}</td>
              <td className={`px-4 py-2 text-right font-medium ${color}`}>₹{inr(v)}</td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td className="px-4 py-6 text-center text-gray-400 text-xs">No entries</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function LedgerPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('trial-balance');
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FiscalPeriod[]>('/ledger/fiscal-periods')
      .then(r => {
        setPeriods(r.data);
        const open = r.data.find(p => p.status === 'OPEN') ?? r.data[0];
        if (open) setPeriodId(open.id);
      })
      .catch(err => toast.error(getErrorMessage(err, 'Failed to load fiscal periods')));
  }, []);

  const load = useCallback(async () => {
    if (!periodId && tab !== 'balance-sheet') return;
    setLoading(true);
    try {
      if (tab === 'trial-balance') {
        const r = await api.get<TrialBalance>('/ledger/trial-balance', { params: { fiscalPeriodId: periodId } });
        setTb(r.data);
      } else if (tab === 'profit-loss') {
        const r = await api.get<ProfitLoss>('/ledger/profit-loss', { params: { fiscalPeriodId: periodId } });
        setPl(r.data);
      } else {
        const r = await api.get<BalanceSheet>('/ledger/balance-sheet');
        setBs(r.data);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load ledger data'));
    } finally { setLoading(false); }
  }, [periodId, tab]);

  useEffect(() => { load(); }, [load]);

  const TABS: { key: Tab; label: string; icon: React.ElementType; help: string }[] = [
    { key: 'trial-balance', label: 'Trial Balance', icon: Scale,     help: 'Every account with its total debits and credits — the two columns must match' },
    { key: 'profit-loss',   label: 'Profit & Loss', icon: TrendingUp, help: 'Revenue minus expenses for the selected fiscal period' },
    { key: 'balance-sheet', label: 'Balance Sheet', icon: Landmark,   help: 'Assets vs liabilities + equity as of today (all posted journals)' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="General Ledger" />
      <div className="max-w-5xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Ledger' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            {tab !== 'balance-sheet' && (
              <select value={periodId} onChange={e => setPeriodId(e.target.value)}
                title="Fiscal period — Indian FY runs April to March"
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1B4F8A]">
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                ))}
                {periods.length === 0 && <option value="">No fiscal periods</option>}
              </select>
            )}
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} title={t.help}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg ${
                tab === t.key ? 'bg-[#1B4F8A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4F8A]'
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Trial Balance */}
        {tab === 'trial-balance' && (
          <>
            {tb && (
              <div className={`flex items-center gap-2 mb-3 text-sm px-4 py-2.5 rounded-xl ${tb.balanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {tb.balanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {tb.balanced
                  ? 'Trial balance is balanced — total debits equal total credits.'
                  : 'NOT BALANCED — debits and credits differ. A journal may be mis-posted; contact support.'}
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-medium">Account</th>
                    <th className="px-4 py-2.5 text-right font-medium" title="Total debit postings in the period">Debit ₹</th>
                    <th className="px-4 py-2.5 text-right font-medium" title="Total credit postings in the period">Credit ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {(tb?.rows ?? []).map(r => (
                    <tr key={r.accountId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{r.name}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{r.debit > 0 ? `₹${inr(r.debit)}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{r.credit > 0 ? `₹${inr(r.credit)}` : '—'}</td>
                    </tr>
                  ))}
                  {!loading && (tb?.rows.length ?? 0) === 0 && (
                    <tr><td colSpan={3} className="py-12 text-center text-gray-400">No journal postings in this period yet</td></tr>
                  )}
                  {loading && <tr><td colSpan={3} className="py-12 text-center text-gray-400">Loading…</td></tr>}
                </tbody>
                {tb && tb.rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
                      <td className="px-4 py-3">Totals</td>
                      <td className="px-4 py-3 text-right">₹{inr(tb.totals.debit)}</td>
                      <td className="px-4 py-3 text-right">₹{inr(tb.totals.credit)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}

        {/* P&L */}
        {tab === 'profit-loss' && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-2xl font-bold text-green-700">₹{inr(pl?.revenue ?? 0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Expenses</p>
                <p className="text-2xl font-bold text-red-600">₹{inr(pl?.expenses ?? 0)}</p>
              </div>
              <div className={`rounded-xl border p-4 ${(pl?.netProfit ?? 0) >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className="text-xs text-gray-500">Net {((pl?.netProfit ?? 0) >= 0) ? 'Profit' : 'Loss'}</p>
                <p className={`text-2xl font-bold ${(pl?.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  ₹{inr(Math.abs(pl?.netProfit ?? 0))}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BreakdownTable title="Revenue Accounts" rows={pl?.revenueBreakdown ?? {}} color="text-green-700" />
              <BreakdownTable title="Expense Accounts" rows={pl?.expenseBreakdown ?? {}} color="text-red-600" />
            </div>
          </>
        )}

        {/* Balance Sheet */}
        {tab === 'balance-sheet' && (
          <>
            {bs && (
              <div className={`flex items-center gap-2 mb-3 text-sm px-4 py-2.5 rounded-xl ${bs.balances ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {bs.balances ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {bs.balances
                  ? `Balanced as at ${fmtDate(bs.asAt)} — Assets = Liabilities + Equity.`
                  : `Assets and Liabilities+Equity differ — some transactions may not be journalled yet.`}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Assets</p>
                <p className="text-2xl font-bold text-[#1B4F8A]">₹{inr(bs?.assets ?? 0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Liabilities</p>
                <p className="text-2xl font-bold text-amber-700">₹{inr(bs?.liabilities ?? 0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Equity</p>
                <p className="text-2xl font-bold text-gray-800">₹{inr(bs?.equity ?? 0)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BreakdownTable title="Assets" rows={bs?.assetBreakdown ?? {}} color="text-[#1B4F8A]" />
              <BreakdownTable title="Liabilities" rows={bs?.liabilityBreakdown ?? {}} color="text-amber-700" />
              <BreakdownTable title="Equity" rows={bs?.equityBreakdown ?? {}} color="text-gray-800" />
            </div>
          </>
        )}

        <p className="text-xs text-gray-400 mt-4">
          The General Ledger is populated automatically — every sale, purchase, expense, and payment posts a balanced
          double-entry journal. Trial Balance verifies the books (debits = credits). P&amp;L covers the selected fiscal
          period; the Balance Sheet is cumulative as of today. Indian FY runs 1 April – 31 March.
        </p>
      </div>
    </div>
  );
}
