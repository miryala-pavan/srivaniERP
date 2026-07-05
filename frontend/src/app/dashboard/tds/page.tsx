'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, IndianRupee, AlertCircle, CheckCircle2, Calculator } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { inr, fmtDate } from '@/lib/report-format';

interface TdsSummary {
  totalDeducted: number; totalDeposited: number; outstanding: number;
  bySection: { section: string; deducted: number; deposited: number; outstanding: number }[];
}
interface TdsEntry {
  id: string; financialYear: string; section: string;
  deducteeName: string; deducteePan: string | null;
  paymentDate: string; paymentAmount: number; tdsRatePct: number; tdsAmount: number;
}
interface TdsChallan {
  id: string; financialYear: string; quarter: string; section: string;
  amountDeducted: number; amountDeposited: number;
  bsrCode: string | null; challanSerial: string | null; createdAt: string;
}

function currentFy() {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(2)}`;
}

export default function TdsPage() {
  const [summary,  setSummary]  = useState<TdsSummary | null>(null);
  const [ledger,   setLedger]   = useState<TdsEntry[]>([]);
  const [challans, setChallans] = useState<TdsChallan[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab, setTab] = useState<'ledger' | 'challans'>('ledger');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recomputingId, setRecomputingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    financialYear: currentFy(), quarter: 'Q1', section: '194C',
    amountDeducted: '', amountDeposited: '', bsrCode: '', challanSerial: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, c] = await Promise.all([
        api.get<TdsSummary>('/tds/summary'),
        api.get<TdsEntry[]>('/tds/ledger'),
        api.get<TdsChallan[]>('/tds/challans'),
      ]);
      setSummary(s.data); setLedger(l.data); setChallans(c.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load TDS data'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveChallan() {
    setSaving(true);
    try {
      await api.post('/tds/challans', {
        financialYear: form.financialYear,
        quarter: form.quarter,
        section: form.section,
        amountDeducted: Number(form.amountDeducted || 0),
        amountDeposited: Number(form.amountDeposited || 0),
        bsrCode: form.bsrCode || undefined,
        challanSerial: form.challanSerial || undefined,
      });
      toast.success('Challan recorded');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record challan'));
    } finally { setSaving(false); }
  }

  const outstanding = summary?.outstanding ?? 0;
  const needsComputeCount = ledger.filter(e => Number(e.tdsRatePct) === 0).length;

  async function recompute(id: string) {
    setRecomputingId(id);
    try {
      await api.post(`/tds/ledger/${id}/recompute`);
      toast.success('Rate applied');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to compute rate'));
    } finally { setRecomputingId(null); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="TDS Management" />
      <div className="max-w-6xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'TDS' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Total Deducted</p>
            <p className="text-2xl font-bold text-gray-800">₹{inr(summary?.totalDeducted ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">TDS withheld from payments</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> Deposited</p>
            <p className="text-2xl font-bold text-green-700">₹{inr(summary?.totalDeposited ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Paid to government via challans</p>
          </div>
          <div className={`rounded-xl border p-4 ${outstanding > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
            <p className="text-xs text-gray-500 flex items-center gap-1"><AlertCircle className={`w-3 h-3 ${outstanding > 0 ? 'text-red-500' : 'text-gray-400'}`} /> Outstanding</p>
            <p className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-gray-800'}`}>₹{inr(outstanding)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Deducted but not yet deposited</p>
          </div>
        </div>

        {/* By section */}
        {(summary?.bySection.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">By Section</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium" title="Income Tax Act section, e.g. 194C contractors, 194I rent, 194J professional fees">Section</th>
                  <th className="px-4 py-2.5 text-right font-medium">Deducted</th>
                  <th className="px-4 py-2.5 text-right font-medium">Deposited</th>
                  <th className="px-4 py-2.5 text-right font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {summary!.bySection.map(s => (
                  <tr key={s.section} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{s.section}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(s.deducted)}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">₹{inr(s.deposited)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${s.outstanding > 0 ? 'text-red-600' : 'text-gray-500'}`}>₹{inr(s.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-3">
          {(['ledger', 'challans'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${tab === t ? 'bg-[#1B4F8A] text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
              {t === 'ledger' ? `Deduction Ledger (${ledger.length})` : `Challans (${challans.length})`}
            </button>
          ))}
          {tab === 'ledger' && needsComputeCount > 0 && (
            <span title="These were auto-created when a supplier payment was made, but still need their real TDS rate applied — click Compute on each row"
              className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              <AlertCircle className="w-3.5 h-3.5" /> {needsComputeCount} need rate computed
            </span>
          )}
          {tab === 'challans' && (
            <button onClick={() => setShowForm(s => !s)}
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e]">
              <Plus className="w-3 h-3" /> Record Deposit
            </button>
          )}
        </div>

        {tab === 'challans' && showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'financialYear', label: 'FY', ph: currentFy(), title: 'Financial year, e.g. 2026-27' },
              { key: 'quarter',       label: 'Quarter', ph: 'Q1', title: 'Q1=Apr–Jun … Q4=Jan–Mar' },
              { key: 'section',       label: 'Section', ph: '194C', title: 'TDS section this deposit covers' },
              { key: 'amountDeducted',  label: 'Deducted ₹', ph: '0', title: 'TDS amount that was withheld' },
              { key: 'amountDeposited', label: 'Deposited ₹', ph: '0', title: 'Amount actually paid via challan' },
              { key: 'bsrCode',       label: 'BSR Code', ph: 'Bank branch code', title: '7-digit bank branch code from the challan receipt' },
              { key: 'challanSerial', label: 'Challan Serial', ph: '5-digit serial', title: 'Challan serial number from the receipt' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[11px] text-gray-500 mb-1" title={f.title}>{f.label} <span className="cursor-help text-gray-400">ⓘ</span></label>
                <input value={(form as any)[f.key]} placeholder={f.ph}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#1B4F8A]" />
              </div>
            ))}
            <div className="flex items-end">
              <button onClick={saveChallan} disabled={saving}
                className="w-full px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            {tab === 'ledger' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-medium">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium">Deductee</th>
                    <th className="px-4 py-2.5 text-left font-medium">PAN</th>
                    <th className="px-4 py-2.5 text-left font-medium">Section</th>
                    <th className="px-4 py-2.5 text-right font-medium">Payment ₹</th>
                    <th className="px-4 py-2.5 text-right font-medium">Rate %</th>
                    <th className="px-4 py-2.5 text-right font-medium">TDS ₹</th>
                    <th className="px-4 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(e => {
                    const needsCompute = Number(e.tdsRatePct) === 0;
                    return (
                      <tr key={e.id} className={`border-b border-gray-50 hover:bg-gray-50 ${needsCompute ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(e.paymentDate)}</td>
                        <td className="px-4 py-2.5 text-gray-700 font-medium">{e.deducteeName}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{e.deducteePan ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{e.section}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(Number(e.paymentAmount))}</td>
                        <td className="px-4 py-2.5 text-right">
                          {needsCompute
                            ? <span className="text-amber-600 font-medium" title="Auto-created stub — rate not yet computed">0% (pending)</span>
                            : <span className="text-gray-500">{Number(e.tdsRatePct)}%</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800">₹{inr(Number(e.tdsAmount))}</td>
                        <td className="px-4 py-2.5 text-right">
                          {needsCompute && (
                            <button onClick={() => recompute(e.id)} disabled={recomputingId === e.id}
                              title="Apply the real TDS rate via the Rule Engine for this section"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 disabled:opacity-50">
                              <Calculator className={`w-3 h-3 ${recomputingId === e.id ? 'animate-pulse' : ''}`} /> Compute
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && ledger.length === 0 && (
                    <tr><td colSpan={8} className="py-12 text-center text-gray-400">No TDS deductions recorded yet — entries appear automatically when qualifying payments are made</td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-medium">FY</th>
                    <th className="px-4 py-2.5 text-left font-medium">Quarter</th>
                    <th className="px-4 py-2.5 text-left font-medium">Section</th>
                    <th className="px-4 py-2.5 text-right font-medium">Deducted</th>
                    <th className="px-4 py-2.5 text-right font-medium">Deposited</th>
                    <th className="px-4 py-2.5 text-left font-medium">BSR / Serial</th>
                    <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {challans.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600">{c.financialYear}</td>
                      <td className="px-4 py-2.5 text-gray-600">{c.quarter}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{c.section}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(Number(c.amountDeducted))}</td>
                      <td className="px-4 py-2.5 text-right text-green-700 font-medium">₹{inr(Number(c.amountDeposited))}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.bsrCode ?? '—'}{c.challanSerial ? ` / ${c.challanSerial}` : ''}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))}
                  {!loading && challans.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-gray-400">No challans recorded</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Statutory: TDS must be deposited by the <strong>7th of the following month</strong> (30 April for March).
          Quarterly returns: <strong>Form 26Q</strong> due 31 Jul / 31 Oct / 31 Jan / 31 May. Common sections —
          194C contractors (1–2%), 194I rent (2–10%), 194J professional fees (10%), 194H commission (2%).
          Deduction entries are created automatically when qualifying payments are made; record each government
          deposit here with its BSR code and challan serial for 26Q matching.
        </p>
      </div>
    </div>
  );
}
