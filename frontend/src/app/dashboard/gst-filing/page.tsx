'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calculator, FileCheck2, Download, IndianRupee, AlertCircle, Plus } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import { inr, fmtDate } from '@/lib/report-format';

interface GstReturn {
  id: string; returnType: string; financialYear: string; taxPeriod: string;
  status: string; b2bTaxable: number; b2cTaxable: number;
  totalLiability: number; itcCgst: number; itcSgst: number; itcIgst: number;
  netPayableCgst: number; netPayableSgst: number; netPayableIgst: number;
  filedAt: string | null; createdAt: string;
}
interface GstChallan {
  id: string; taxPeriod: string; cgstPaid: number; sgstPaid: number; igstPaid: number;
  interest: number; lateFee: number; totalPaid: number; cpin: string | null; createdAt: string;
}
interface Summary { returns: GstReturn[]; challans: GstChallan[]; pendingFiling: number; totalPaid: number; }

const STATUS_BADGE: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-500',
  COMPUTED: 'bg-amber-100 text-amber-700',
  FILED:    'bg-green-100 text-green-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
};

function currentPeriod() {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function GstFilingPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(currentPeriod());
  const [computing, setComputing] = useState(false);
  const [showChallan, setShowChallan] = useState(false);
  const [challan, setChallan] = useState({ taxPeriod: currentPeriod(), cgstPaid: '', sgstPaid: '', igstPaid: '', interest: '', lateFee: '', cpin: '' });
  const [savingChallan, setSavingChallan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Summary>('/gst/summary');
      setData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load GST summary'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function compute() {
    if (!/^\d{4}-\d{2}$/.test(period)) { toast.error('Period must be YYYY-MM'); return; }
    setComputing(true);
    try {
      await api.post(`/gst/compute/${period}`);
      toast.success(`GSTR-1 & GSTR-3B computed for ${period}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Computation failed'));
    } finally { setComputing(false); }
  }

  async function markFiled(r: GstReturn) {
    if (!confirm(`Mark ${r.returnType} for ${r.taxPeriod} as FILED? Do this only after filing on the GST portal.`)) return;
    try {
      await api.post(`/gst/returns/${r.id}/file`);
      toast.success('Marked as filed');
      load();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
  }

  async function exportJson(r: GstReturn) {
    try {
      const res = await api.get(`/gst/returns/${r.id}/export/json`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `GSTR1_${r.taxPeriod}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) { toast.error(getErrorMessage(err, 'Export failed')); }
  }

  async function saveChallan() {
    setSavingChallan(true);
    try {
      await api.post('/gst/challans', {
        taxPeriod: challan.taxPeriod,
        cgstPaid: Number(challan.cgstPaid || 0),
        sgstPaid: Number(challan.sgstPaid || 0),
        igstPaid: Number(challan.igstPaid || 0),
        interest: Number(challan.interest || 0),
        lateFee:  Number(challan.lateFee || 0),
        cpin: challan.cpin || undefined,
      });
      toast.success('Challan recorded');
      setShowChallan(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record challan'));
    } finally { setSavingChallan(false); }
  }

  const returns = data?.returns ?? [];
  const challans = data?.challans ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="GST Filing" />
      <div className="max-w-6xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'GST Filing' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="YYYY-MM"
              title="Tax period to compute, e.g. 2026-06 for June 2026"
              className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1B4F8A]" />
            <button onClick={compute} disabled={computing}
              title="Computes GSTR-1 (outward) and GSTR-3B (summary + ITC) from your bills and GRNs for this period"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e] disabled:opacity-50">
              <Calculator className={`w-3.5 h-3.5 ${computing ? 'animate-pulse' : ''}`} /> Compute Returns
            </button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-amber-500" /> Pending Filing</p>
            <p className="text-2xl font-bold text-amber-600">{data?.pendingFiling ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Computed but not yet filed on portal</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Total Tax Paid</p>
            <p className="text-2xl font-bold text-[#1B4F8A]">₹{inr(data?.totalPaid ?? 0)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Across recorded challans</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Returns Computed</p>
            <p className="text-2xl font-bold text-gray-800">{returns.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Last 12 periods shown</p>
          </div>
        </div>

        {/* Returns table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">GST Returns</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium">Period</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium" title="Total output tax liability for the period">Liability</th>
                  <th className="px-4 py-2.5 text-right font-medium" title="Input Tax Credit claimed (CGST+SGST+IGST)">ITC</th>
                  <th className="px-4 py-2.5 text-right font-medium" title="Net cash payable after ITC set-off">Net Payable</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.map(r => {
                  const itc = Number(r.itcCgst) + Number(r.itcSgst) + Number(r.itcIgst);
                  const net = Number(r.netPayableCgst) + Number(r.netPayableSgst) + Number(r.netPayableIgst);
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.taxPeriod}</td>
                      <td className="px-4 py-2.5 text-gray-600">{r.returnType}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
                        {r.filedAt && <span className="block text-[10px] text-gray-400 mt-0.5">{fmtDate(r.filedAt)}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">₹{inr(Number(r.totalLiability))}</td>
                      <td className="px-4 py-2.5 text-right text-green-700">₹{inr(itc)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">₹{inr(net)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {r.returnType === 'GSTR1' && (
                          <button onClick={() => exportJson(r)} title="Download portal-ready GSTR-1 JSON"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#1B4F8A] hover:bg-blue-50 rounded-lg">
                            <Download className="w-3 h-3" /> JSON
                          </button>
                        )}
                        {r.status === 'COMPUTED' && (
                          <button onClick={() => markFiled(r)} title="Mark as filed after submitting on the GST portal"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-700 hover:bg-green-50 rounded-lg">
                            <FileCheck2 className="w-3 h-3" /> Mark Filed
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && returns.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-400">No returns yet — compute your first period above</td></tr>
                )}
                {loading && <tr><td colSpan={7} className="py-12 text-center text-gray-400">Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Challans */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Tax Payment Challans</h2>
            <button onClick={() => setShowChallan(s => !s)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163f6e]">
              <Plus className="w-3 h-3" /> Record Challan
            </button>
          </div>

          {showChallan && (
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'taxPeriod', label: 'Period (YYYY-MM)', ph: '2026-06' },
                { key: 'cgstPaid',  label: 'CGST Paid ₹', ph: '0' },
                { key: 'sgstPaid',  label: 'SGST Paid ₹', ph: '0' },
                { key: 'igstPaid',  label: 'IGST Paid ₹', ph: '0' },
                { key: 'interest',  label: 'Interest ₹', ph: '0' },
                { key: 'lateFee',   label: 'Late Fee ₹', ph: '0' },
                { key: 'cpin',      label: 'CPIN', ph: 'Challan ID from portal' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] text-gray-500 mb-1">{f.label}</label>
                  <input value={(challan as any)[f.key]} placeholder={f.ph}
                    onChange={e => setChallan({ ...challan, [f.key]: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#1B4F8A]" />
                </div>
              ))}
              <div className="flex items-end">
                <button onClick={saveChallan} disabled={savingChallan}
                  className="w-full px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg disabled:opacity-50">
                  {savingChallan ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium">Period</th>
                  <th className="px-4 py-2.5 text-right font-medium">CGST</th>
                  <th className="px-4 py-2.5 text-right font-medium">SGST</th>
                  <th className="px-4 py-2.5 text-right font-medium">IGST</th>
                  <th className="px-4 py-2.5 text-right font-medium">Interest+Fee</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-left font-medium">CPIN</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {challans.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{c.taxPeriod}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(Number(c.cgstPaid))}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(Number(c.sgstPaid))}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">₹{inr(Number(c.igstPaid))}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">₹{inr(Number(c.interest) + Number(c.lateFee))}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">₹{inr(Number(c.totalPaid))}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{c.cpin ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
                {challans.length === 0 && !loading && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-sm">No challans recorded</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Statutory deadlines: <strong>GSTR-1 by the 11th</strong> and <strong>GSTR-3B by the 20th</strong> of the following
          month. Compute pulls figures from your finalised bills (outward) and approved GRNs (ITC). &quot;Mark Filed&quot; is a
          book-keeping flag — actual filing happens on the GST portal; record the CPIN challan here after paying.
          Enter all purchase invoices before computing GSTR-3B so ITC is complete.
        </p>
      </div>
    </div>
  );
}
