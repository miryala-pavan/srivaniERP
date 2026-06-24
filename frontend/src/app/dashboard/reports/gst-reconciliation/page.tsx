'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileCheck2, AlertTriangle, FileX2, FileQuestion, CheckCircle2,
  X, Loader2, ShieldAlert, Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

const inr = (v: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(v ?? 0));
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

interface Row {
  gstin: string; supplierName: string; invoiceNo: string; invoiceDate: string | null;
  grnNumber?: string | null; grnId?: string | null;
  b2bTaxable?: number; b2bTax?: number; bookTaxable?: number; bookTax?: number;
  taxableDiff?: number; taxDiff?: number;
}
interface Result {
  fileName: string;
  window: { from: string | null; to: string | null };
  summary: {
    b2bInvoices: number; matched: number; mismatch: number; onlyIn2B: number; onlyInBooks: number;
    itcIn2B: number; itcMatched: number; itcAtRisk: number; itcUnbooked: number;
  };
  matched: Row[]; mismatch: Row[]; onlyIn2B: Row[]; onlyInBooks: Row[];
}

type TabKey = 'matched' | 'mismatch' | 'onlyIn2B' | 'onlyInBooks';

export default function GstReconciliationPage() {
  const router = useRouter();
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<Result | null>(null);
  const [tab, setTab]         = useState<TabKey>('onlyInBooks');
  const fileRef = useRef<HTMLInputElement>(null);

  async function runReconcile(f: File) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.post('/reports/gst/reconcile-2b', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      // Default to the most actionable tab
      setTab(res.data.summary.onlyInBooks > 0 ? 'onlyInBooks' : res.data.summary.mismatch > 0 ? 'mismatch' : 'matched');
      toast.success('Reconciliation complete');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  }

  function onPick(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
    runReconcile(f);
  }

  const s = result?.summary;

  const TABS: { key: TabKey; label: string; count: number; tone: string }[] = result ? [
    { key: 'onlyInBooks', label: 'ITC at risk',       count: s!.onlyInBooks, tone: 'text-red-600' },
    { key: 'mismatch',    label: 'Mismatches',        count: s!.mismatch,    tone: 'text-amber-600' },
    { key: 'onlyIn2B',    label: 'In 2B, not booked', count: s!.onlyIn2B,    tone: 'text-blue-600' },
    { key: 'matched',     label: 'Matched',           count: s!.matched,     tone: 'text-green-600' },
  ] : [];

  const rows: Row[] = result ? result[tab] : [];

  return (
    <>
      <Header title="GST Reconciliation — GSTR-2B" />
      <main className="flex-1 p-6 space-y-5 max-w-6xl">

        {/* Intro / upload */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 flex items-start gap-3">
          <Scale size={16} className="mt-0.5 flex-shrink-0 text-blue-500" />
          <div>
            Upload your <strong>GSTR-2B</strong> (JSON or Excel) downloaded from the GST portal. We match it against
            your approved purchase GRNs so you only claim Input Tax Credit you&apos;re entitled to.
          </div>
        </div>

        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#1B4F8A] hover:bg-blue-50/40 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-[#1B4F8A]">
              <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm font-medium">Reconciling…</span>
            </div>
          ) : file ? (
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle2 size={18} /> <span className="text-sm font-medium">{file.name}</span>
              <button onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }} className="ml-2 text-gray-400 hover:text-red-500">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="text-gray-500">
              <Upload size={28} className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Click or drag your GSTR-2B file here</p>
              <p className="text-xs text-gray-400 mt-1">Accepts the portal&apos;s <strong>.json</strong> or <strong>.xlsx</strong> download</p>
            </div>
          )}
          <input
            ref={fileRef} type="file" accept=".json,.xlsx,.xls,application/json"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </div>

        {result && s && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard icon={<ShieldAlert className="w-5 h-5" />} tone="red"
                label="ITC at risk" value={`Rs.${inr(s.itcAtRisk)}`}
                sub={`${s.onlyInBooks} invoice(s) in books, not in 2B`} />
              <SummaryCard icon={<FileCheck2 className="w-5 h-5" />} tone="green"
                label="ITC matched" value={`Rs.${inr(s.itcMatched)}`}
                sub={`${s.matched} matched invoice(s)`} />
              <SummaryCard icon={<FileQuestion className="w-5 h-5" />} tone="blue"
                label="In 2B, not booked" value={`Rs.${inr(s.itcUnbooked)}`}
                sub={`${s.onlyIn2B} invoice(s) to record`} />
              <SummaryCard icon={<AlertTriangle className="w-5 h-5" />} tone="amber"
                label="Mismatches" value={`${s.mismatch}`}
                sub="value/tax differs — verify" />
            </div>

            <p className="text-xs text-gray-400">
              {s.b2bInvoices} invoices in 2B · Total ITC in 2B Rs.{inr(s.itcIn2B)}
              {result.window.from && ` · period ${fmtDate(result.window.from)} – ${fmtDate(result.window.to)}`}
            </p>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t.key ? 'border-[#1B4F8A] text-[#1B4F8A]' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {t.label} <span className={`ml-1 ${t.tone}`}>({t.count})</span>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {rows.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                  <FileX2 className="w-8 h-8 mx-auto mb-2 text-gray-300" /> Nothing in this bucket — good!
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Supplier / GSTIN</th>
                      <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                      <th className="text-right px-4 py-2.5 font-medium">2B Taxable</th>
                      <th className="text-right px-4 py-2.5 font-medium">2B Tax</th>
                      <th className="text-right px-4 py-2.5 font-medium">Book Taxable</th>
                      <th className="text-right px-4 py-2.5 font-medium">Book Tax</th>
                      {tab === 'mismatch' && <th className="text-right px-4 py-2.5 font-medium">Tax Diff</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-800">{r.supplierName || '—'}</div>
                          <div className="text-xs text-gray-400 font-mono">{r.gstin}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.grnId ? (
                            <button onClick={() => router.push(`/dashboard/grn/${r.grnId}`)}
                              className="text-[#1B4F8A] hover:underline text-left">{r.invoiceNo}</button>
                          ) : <span className="text-gray-700">{r.invoiceNo}</span>}
                          <div className="text-xs text-gray-400">{fmtDate(r.invoiceDate)}{r.grnNumber ? ` · ${r.grnNumber}` : ''}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{r.b2bTaxable != null ? `Rs.${inr(r.b2bTaxable)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{r.b2bTax != null ? `Rs.${inr(r.b2bTax)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{r.bookTaxable != null ? `Rs.${inr(r.bookTaxable)}` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{r.bookTax != null ? `Rs.${inr(r.bookTax)}` : '—'}</td>
                        {tab === 'mismatch' && (
                          <td className={`px-4 py-2.5 text-right font-medium ${Math.abs(r.taxDiff ?? 0) > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                            Rs.{inr(r.taxDiff ?? 0)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {tab === 'onlyInBooks' && rows.length > 0 && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> These are recorded in your books but not in GSTR-2B — your supplier may not have filed. Follow up before claiming this ITC.
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}

function SummaryCard({ icon, tone, label, value, sub }: {
  icon: React.ReactNode; tone: 'red' | 'green' | 'blue' | 'amber'; label: string; value: string; sub: string;
}) {
  const tones: Record<string, string> = {
    red:   'bg-red-50 border-red-200 text-red-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    blue:  'bg-blue-50 border-blue-200 text-blue-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 mb-1.5 opacity-80">{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}
