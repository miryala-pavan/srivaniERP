'use client';
import { useEffect, useState } from 'react';
import { CalendarRange, Lock, CheckCircle, AlertTriangle,
         TrendingUp, Package, Building2, RefreshCw,
         ChevronRight, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { useFY } from '@/context/FYContext';
import { getUser } from '@/lib/auth';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtD = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Types ──────────────────────────────────────────────

interface FYRecord {
  id: string; fyCode: string; startDate: string; endDate: string;
  isActive: boolean; isClosed: boolean; closedAt?: string;
  closingTotalSales?: number; closingTotalPurchases?: number;
  closingSupplierDues?: number; closingStockValue?: number;
  billSeries: { billType: string; seriesPrefix: string; currentNumber: number }[];
  purchaseCount: number; paymentCount: number;
  _count: { salesBills: number };
}

interface Comparison {
  fyCode: string;
  isActive: boolean;
  isClosed: boolean;
  totalSales: number;
  totalBills: number;
  totalPurchases: number;
  totalGrns: number;
  grossProfit: number;
  totalGstCollected: number;
  totalExpenses: number;
  totalPaymentsMade: number;
}

interface ClosePreview {
  currentFy: { id: string; fyCode: string; startDate: string; endDate: string };
  newFy:     { fyCode: string; startDate: string; endDate: string };
  summary: {
    totalSales: number; totalSalesBills: number;
    totalPurchases: number; totalGrns: number;
    supplierDues: number; supplierDuesCount: number;
    stockValue: number;
    bankAccounts: { name: string; bank: string; balance: number }[];
    totalBankBalance: number;
  };
  billSeriesWillReset: { billType: string; prefix: string; currentNumber: number; nextFyNumber: number }[];
  topUnpaidSuppliers: { name: string; due: number }[];
  warnings: string[];
}

// ── Wizard step indicator ─────────────────────────────

function StepDot({ step, current, label }: { step: number; current: number; label: string }) {
  const done    = current > step;
  const active  = current === step;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
        ${done   ? 'bg-green-500 text-white'
        : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                 : 'bg-gray-200 text-gray-500'}`}>
        {done ? '✓' : step}
      </div>
      <span className={`text-xs font-medium hidden sm:block ${active ? 'text-indigo-700' : done ? 'text-green-600' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────

export default function FinancialYearPage() {
  const { reload: reloadFY, activeFY } = useFY();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const user = mounted ? getUser<{ role: string }>() : null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [fys,        setFys]        = useState<FYRecord[]>([]);
  const [comparison, setComparison] = useState<Comparison[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1=Preview 2=Confirm 3=Done
  const [preview,  setPreview]  = useState<ClosePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [closing,  setClosing]  = useState(false);
  const [closedResult, setClosedResult] = useState<{ closedFy: string; newFy: string } | null>(null);
  const [checks,   setChecks]   = useState({ confirm1: false, confirm2: false, confirm3: false });
  const [error,    setError]    = useState('');

  async function loadFYs() {
    setLoading(true);
    try {
      const [fysRes, compRes] = await Promise.all([
        api.get('/financial-year'),
        api.get('/financial-year/comparison'),
      ]);
      setFys(fysRes.data);
      setComparison(compRes.data);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadFYs(); }, []);

  async function openWizard() {
    setWizardOpen(true);
    setWizardStep(1);
    setChecks({ confirm1: false, confirm2: false, confirm3: false });
    setError('');
    setPreview(null);
    setPreviewLoading(true);
    try {
      const res = await api.get('/financial-year/close-preview');
      setPreview(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to load preview');
    } finally { setPreviewLoading(false); }
  }

  async function executeClose() {
    setClosing(true);
    setError('');
    try {
      const res = await api.post('/financial-year/close');
      setClosedResult(res.data);
      setWizardStep(3);
      await loadFYs();
      reloadFY();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to close financial year');
    } finally { setClosing(false); }
  }

  const allChecked = checks.confirm1 && checks.confirm2 && checks.confirm3;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <CalendarRange className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Financial Years</h1>
            <p className="text-sm text-gray-500">Manage year-end closing and historical year browsing</p>
          </div>
        </div>
        {isSuperAdmin && activeFY && !activeFY.isClosed && (
          <button onClick={openWizard}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <ArrowRight className="w-4 h-4" />
            Close FY {activeFY.fyCode} &amp; Open Next
          </button>
        )}
      </div>

      {/* FY list */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {fys.map(fy => (
            <div key={fy.id}
              className={`bg-white border rounded-xl p-4 transition-colors
                ${fy.isActive && !fy.isClosed ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}>

              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-gray-900">FY {fy.fyCode}</h2>
                      {fy.isActive && !fy.isClosed && (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                          ● Active
                        </span>
                      )}
                      {fy.isClosed && (
                        <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Closed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtD(fy.startDate)} – {fmtD(fy.endDate)}
                      {fy.closedAt && ` · Closed on ${fmtD(fy.closedAt)}`}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                    {fy._count.salesBills} bills
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-orange-500" />
                    {fy.purchaseCount} GRNs
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    {fy.paymentCount} payments
                  </span>
                </div>
              </div>

              {/* Closing snapshot for closed FYs */}
              {fy.isClosed && fy.closingTotalSales != null && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Closing Sales',     value: `₹${fmt(Number(fy.closingTotalSales))}`,     color: 'text-green-700' },
                    { label: 'Closing Purchases',  value: `₹${fmt(Number(fy.closingTotalPurchases))}`, color: 'text-orange-700' },
                    { label: 'Supplier Dues C/F',  value: `₹${fmt(Number(fy.closingSupplierDues))}`,  color: 'text-red-600' },
                    { label: 'Closing Stock Value',value: `₹${fmt(Number(fy.closingStockValue))}`,    color: 'text-blue-700' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-gray-400">{s.label}</p>
                      <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Bill series */}
              {fy.billSeries.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {fy.billSeries.map(bs => (
                    <span key={bs.billType}
                      className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                      {bs.seriesPrefix}{String(bs.currentNumber).padStart(4,'0')}
                      <span className="text-gray-400 ml-1">({bs.billType})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Year-on-Year Comparison ── */}
      {comparison.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Year-on-Year Comparison</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-semibold text-xs">Metric</th>
                  {comparison.map(c => (
                    <th key={c.fyCode} className="text-right px-4 py-3 text-gray-600 font-semibold text-xs">
                      FY {c.fyCode}
                      {c.isActive && !c.isClosed && (
                        <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Active</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { label: 'Total Sales',     key: 'totalSales',         money: true  },
                  { label: 'Bills',           key: 'totalBills',         money: false },
                  { label: 'Total Purchases', key: 'totalPurchases',     money: true  },
                  { label: 'GRNs',            key: 'totalGrns',          money: false },
                  { label: 'Gross Profit',    key: 'grossProfit',        money: true  },
                  { label: 'GST Collected',   key: 'totalGstCollected',  money: true  },
                  { label: 'Expenses',        key: 'totalExpenses',      money: true  },
                  { label: 'Payments Made',   key: 'totalPaymentsMade',  money: true  },
                ].map(row => (
                  <tr key={row.key} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600 font-medium text-xs">{row.label}</td>
                    {comparison.map(c => {
                      const val = (c as any)[row.key] as number;
                      const isProfit = row.key === 'grossProfit';
                      return (
                        <td key={c.fyCode} className={`px-4 py-2.5 text-right font-semibold text-xs ${
                          isProfit ? (val >= 0 ? 'text-green-600' : 'text-red-500') : 'text-gray-800'
                        }`}>
                          {row.money ? `₹${fmt(val)}` : val.toLocaleString('en-IN')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Year-End Close Wizard Modal ── */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Wizard header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Year-End Close Wizard</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {wizardStep < 3 ? `Step ${wizardStep} of 2` : 'Complete'}
              </p>

              {/* Step indicators */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <StepDot step={1} current={wizardStep} label="Preview" />
                <div className="h-px flex-1 bg-gray-200" />
                <StepDot step={2} current={wizardStep} label="Confirm" />
                <div className="h-px flex-1 bg-gray-200" />
                <StepDot step={3} current={wizardStep} label="Done" />
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">

              {/* ── STEP 1: PREVIEW ── */}
              {wizardStep === 1 && (
                <>
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading preview…
                    </div>
                  ) : error ? (
                    <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>
                  ) : preview && (
                    <>
                      {/* Year transition */}
                      <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                        <div className="flex-1 text-center">
                          <p className="text-xs text-gray-400 mb-1">Closing</p>
                          <p className="text-xl font-black text-gray-800">FY {preview.currentFy.fyCode}</p>
                          <p className="text-xs text-gray-500">{fmtD(preview.currentFy.startDate)} – {fmtD(preview.currentFy.endDate)}</p>
                        </div>
                        <ArrowRight className="w-8 h-8 text-indigo-400 flex-shrink-0" />
                        <div className="flex-1 text-center">
                          <p className="text-xs text-gray-400 mb-1">Opening</p>
                          <p className="text-xl font-black text-indigo-700">FY {preview.newFy.fyCode}</p>
                          <p className="text-xs text-gray-500">{fmtD(preview.newFy.startDate)} – {fmtD(preview.newFy.endDate)}</p>
                        </div>
                      </div>

                      {/* FY summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Total Sales',     value: `₹${fmt(preview.summary.totalSales)}`,     sub: `${preview.summary.totalSalesBills} bills`,   color: 'text-green-700' },
                          { label: 'Total Purchases', value: `₹${fmt(preview.summary.totalPurchases)}`, sub: `${preview.summary.totalGrns} GRNs`,           color: 'text-orange-700' },
                          { label: 'Supplier Dues',   value: `₹${fmt(preview.summary.supplierDues)}`,   sub: `${preview.summary.supplierDuesCount} GRNs`,   color: 'text-red-600' },
                          { label: 'Stock Value',     value: `₹${fmt(preview.summary.stockValue)}`,     sub: 'est. at cost',                                color: 'text-blue-700' },
                        ].map(s => (
                          <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                            <p className="text-[11px] text-gray-400">{s.label}</p>
                            <p className={`font-bold text-base ${s.color}`}>{s.value}</p>
                            <p className="text-[11px] text-gray-400">{s.sub}</p>
                          </div>
                        ))}
                      </div>

                      {/* Bank balances */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Bank Account Balances at Close</p>
                        <div className="space-y-1.5">
                          {preview.summary.bankAccounts.map(a => (
                            <div key={a.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                              <span className="text-gray-700">{a.name} <span className="text-gray-400 text-xs">({a.bank})</span></span>
                              <span className={`font-semibold ${a.balance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                ₹{fmt(a.balance)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bill series reset */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Bill Series — will reset to /0001 in new FY</p>
                        <div className="flex flex-wrap gap-2">
                          {preview.billSeriesWillReset.map(bs => (
                            <div key={bs.billType} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                              <span className="font-mono text-gray-500 line-through">{bs.prefix}{String(bs.currentNumber).padStart(4,'0')}</span>
                              <ChevronRight className="w-3 h-3 inline mx-1 text-amber-500" />
                              <span className="font-mono text-indigo-700 font-semibold">{bs.prefix}0001</span>
                              <span className="text-gray-400 ml-1">({bs.billType})</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Top unpaid suppliers */}
                      {preview.topUnpaidSuppliers.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2">Top Outstanding Suppliers (carry forward)</p>
                          <div className="space-y-1">
                            {preview.topUnpaidSuppliers.map(s => (
                              <div key={s.name} className="flex justify-between text-xs bg-red-50 rounded px-3 py-1.5">
                                <span className="text-gray-700">{s.name}</span>
                                <span className="font-semibold text-red-600">₹{fmt(s.due)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {preview.warnings.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                          {preview.warnings.map((w, i) => (
                            <p key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                              {w}
                            </p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── STEP 2: CONFIRM ── */}
              {wizardStep === 2 && preview && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-800 mb-1">⚠ This action cannot be undone</p>
                    <p className="text-xs text-red-700">
                      FY {preview.currentFy.fyCode} will be permanently locked.
                      No new GRNs or sales bills can be created in it after this.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'confirm1', text: `I confirm that all GRNs and sales for FY ${preview.currentFy.fyCode} have been entered` },
                      { key: 'confirm2', text: `I understand FY ${preview.currentFy.fyCode} will be locked — no new entries allowed` },
                      { key: 'confirm3', text: `I confirm that bill numbering will reset from /0001 in FY ${preview.newFy.fyCode}` },
                    ].map(c => (
                      <label key={c.key} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors">
                        <input type="checkbox"
                          checked={checks[c.key as keyof typeof checks]}
                          onChange={e => setChecks(prev => ({ ...prev, [c.key]: e.target.checked }))}
                          className="mt-0.5 w-4 h-4 rounded accent-indigo-600" />
                        <span className="text-sm text-gray-700">{c.text}</span>
                      </label>
                    ))}
                  </div>

                  {error && (
                    <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">{error}</div>
                  )}
                </div>
              )}

              {/* ── STEP 3: DONE ── */}
              {wizardStep === 3 && closedResult && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Year Closed Successfully!</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      FY <strong>{closedResult.closedFy}</strong> is now locked.
                      FY <strong>{closedResult.newFy}</strong> is now active.
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                    ✓ All bill series have been reset to /0001<br />
                    ✓ Supplier outstanding has carried forward automatically<br />
                    ✓ Historical data remains accessible in read-only mode
                  </div>
                </div>
              )}
            </div>

            {/* Wizard footer buttons */}
            <div className="px-6 pb-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <button onClick={() => { setWizardOpen(false); setWizardStep(1); }}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                {wizardStep === 3 ? 'Close' : 'Cancel'}
              </button>

              {wizardStep === 1 && !previewLoading && !error && preview && (
                <button onClick={() => setWizardStep(2)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700">
                  Next: Confirm <ChevronRight className="w-4 h-4" />
                </button>
              )}

              {wizardStep === 2 && (
                <button onClick={executeClose} disabled={!allChecked || closing}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors
                    ${allChecked && !closing
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  {closing ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Closing year…</>
                  ) : (
                    <><Lock className="w-4 h-4" /> Close FY &amp; Open Next</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
