'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileCheck2, AlertTriangle, FileX2, FileQuestion, CheckCircle2,
  X, Loader2, ShieldAlert, ChevronDown, ChevronUp, Download,
  ExternalLink, Info, BookOpen, HelpCircle, History, Clock, Trash2, PlusCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

function getMismatchReason(r: Row): { badge: string; color: string; hint: string } {
  const td = r.taxableDiff ?? 0;
  const tx = r.taxDiff ?? 0;
  const tdOff = Math.abs(td) >= 0.5;
  const txOff = Math.abs(tx) >= 0.5;

  if (tdOff && txOff) {
    return {
      badge: 'Both differ',
      color: 'bg-orange-100 text-orange-700',
      hint: 'Both taxable value and tax differ. Compare the physical bill against the amounts in GSTR-2B for each line item.',
    };
  }
  if (tdOff) {
    return {
      badge: 'Taxable diff',
      color: 'bg-amber-100 text-amber-700',
      hint: td < 0
        ? `2B taxable is ₹${Math.abs(td).toFixed(2)} higher than books. Common cause: supplier's invoice includes exempt or zero-rated goods that your GRN did not record separately.`
        : `Book taxable is ₹${Math.abs(td).toFixed(2)} higher than GSTR-2B. Check if the GRN was entered with excess quantity, wrong rate, or the supplier amended the invoice.`,
    };
  }
  return {
    badge: 'Tax diff',
    color: 'bg-yellow-100 text-yellow-700',
    hint: tx < 0
      ? `2B tax is ₹${Math.abs(tx).toFixed(2)} higher than books. Check if the correct GST rate was applied in the GRN.`
      : `Book tax is ₹${Math.abs(tx).toFixed(2)} higher than GSTR-2B. Verify the CGST/SGST/IGST amounts on the physical bill.`,
  };
}

const inr = (v: number) => {
  const n = Number(v ?? 0);
  const abs = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
  return n < 0 ? `-₹${abs}` : `₹${abs}`;
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

interface PastRun {
  id: string;
  fileName: string;
  period: string;
  runAt: string;
  uploadedBy: string | null;
  summary: Result['summary'];
}

interface Row {
  gstin: string; supplierName: string; invoiceNo: string; invoiceDate: string | null;
  grnNumber?: string | null; grnId?: string | null;
  b2bTaxable?: number; b2bTax?: number; bookTaxable?: number; bookTax?: number;
  taxableDiff?: number; taxDiff?: number;
}
interface Result {
  runId?: string;
  fileName: string;
  window: { from: string | null; to: string | null };
  summary: {
    b2bInvoices: number; matched: number; mismatch: number; onlyIn2B: number; onlyInBooks: number;
    itcIn2B: number; itcMatched: number; itcAtRisk: number; itcUnbooked: number;
  };
  matched: Row[]; mismatch: Row[]; onlyIn2B: Row[]; onlyInBooks: Row[];
}

type TabKey = 'matched' | 'mismatch' | 'onlyIn2B' | 'onlyInBooks';

function downloadAllCsv(result: Result) {
  const parts: string[] = [];
  const row = (vals: (string | number | null | undefined)[]) =>
    vals.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');

  const sections: { key: TabKey; label: string; cols: string[]; getData: (r: Row) => (string | number | null | undefined)[] }[] = [
    {
      key: 'onlyInBooks', label: `ITC AT RISK — ${result.onlyInBooks.length} invoice(s) (supplier not filed)`,
      cols: ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', 'GRN No', 'Book Taxable (₹)', 'Book Tax (₹)'],
      getData: (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.grnNumber ?? '', r.bookTaxable ?? 0, r.bookTax ?? 0],
    },
    {
      key: 'mismatch', label: `MISMATCHES — ${result.mismatch.length} invoice(s) (amounts differ)`,
      cols: ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', 'GRN No', '2B Taxable (₹)', '2B Tax (₹)', 'Book Taxable (₹)', 'Book Tax (₹)', 'Taxable Diff (₹)', 'Tax Diff (₹)'],
      getData: (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.grnNumber ?? '', r.b2bTaxable ?? 0, r.b2bTax ?? 0, r.bookTaxable ?? 0, r.bookTax ?? 0, r.taxableDiff ?? 0, r.taxDiff ?? 0],
    },
    {
      key: 'onlyIn2B', label: `NOT IN BOOKS — ${result.onlyIn2B.length} invoice(s) (no GRN entered)`,
      cols: ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', '2B Taxable (₹)', '2B Tax (₹)'],
      getData: (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.b2bTaxable ?? 0, r.b2bTax ?? 0],
    },
    {
      key: 'matched', label: `MATCHED — ${result.matched.length} invoice(s) (safe to claim)`,
      cols: ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', 'GRN No', '2B Taxable (₹)', '2B Tax (₹)', 'Book Taxable (₹)', 'Book Tax (₹)'],
      getData: (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.grnNumber ?? '', r.b2bTaxable ?? 0, r.b2bTax ?? 0, r.bookTaxable ?? 0, r.bookTax ?? 0],
    },
  ];

  for (const sec of sections) {
    const rows = result[sec.key];
    parts.push(row([`=== ${sec.label} ===`]));
    parts.push(row(sec.cols));
    rows.forEach((r) => parts.push(row(sec.getData(r))));
    parts.push('');
  }

  const blob = new Blob(['﻿' + parts.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GSTR2B_Recon_ALL_${result.fileName.replace(/\.[^.]+$/, '')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(rows: Row[], tab: TabKey, fileName: string) {
  let headers: string[];
  let getData: (r: Row) => (string | number | null | undefined)[];

  switch (tab) {
    case 'onlyInBooks':
      headers = ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', 'GRN No', 'Book Taxable (₹)', 'Book Tax (₹)'];
      getData = (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.grnNumber ?? '', r.bookTaxable ?? 0, r.bookTax ?? 0];
      break;
    case 'onlyIn2B':
      headers = ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', '2B Taxable (₹)', '2B Tax (₹)'];
      getData = (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.b2bTaxable ?? 0, r.b2bTax ?? 0];
      break;
    case 'mismatch':
      headers = ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', 'GRN No', '2B Taxable', '2B Tax', 'Book Taxable', 'Book Tax', 'Taxable Diff', 'Tax Diff'];
      getData = (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.grnNumber ?? '', r.b2bTaxable ?? 0, r.b2bTax ?? 0, r.bookTaxable ?? 0, r.bookTax ?? 0, r.taxableDiff ?? 0, r.taxDiff ?? 0];
      break;
    default:
      headers = ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', 'GRN No', '2B Taxable (₹)', '2B Tax (₹)', 'Book Taxable (₹)', 'Book Tax (₹)'];
      getData = (r) => [r.supplierName, r.gstin, r.invoiceNo, fmtDate(r.invoiceDate), r.grnNumber ?? '', r.b2bTaxable ?? 0, r.b2bTax ?? 0, r.bookTaxable ?? 0, r.bookTax ?? 0];
  }

  const csv = [headers, ...rows.map(getData)]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GSTR2B_Recon_${tab}_${fileName.replace(/\.[^.]+$/, '')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const GUIDE_STEPS = [
  'Go to the GST portal: gst.gov.in → Login with your GSTIN and password.',
  'Click Services → Returns → View Returns / Filed Returns → OR use Returns Dashboard → View GSTR-2B.',
  'Select the return period (month and year) you want to reconcile.',
  'If the statement says "Generate" — click it and wait a few minutes for it to be generated.',
  'Once ready, click "Download" → choose JSON format (preferred) or Excel (.xlsx).',
  'Upload the downloaded file in the box below. Both .json and .xlsx are accepted here.',
];

const TAB_CONFIG: Record<TabKey, {
  shortLabel: string; tone: string; bgTone: string; borderTone: string; icon: React.ElementType;
  action: string; detail: string; emptyMsg: string;
}> = {
  onlyInBooks: {
    shortLabel: 'ITC at risk',
    tone: 'text-red-700', bgTone: 'bg-red-50', borderTone: 'border-red-200',
    icon: ShieldAlert,
    action: 'These GRNs are recorded in your books but NOT in GSTR-2B — the supplier has not filed their GSTR-1 for this period. You cannot safely claim this ITC until it appears in your GSTR-2B.',
    detail: 'Action: Contact each supplier below and ask them to file their GSTR-1. These invoices will appear in next month\'s GSTR-2B once they file. Do not claim this ITC in GSTR-3B until confirmed.',
    emptyMsg: 'All your GRN entries appear in GSTR-2B — no ITC at risk.',
  },
  mismatch: {
    shortLabel: 'Mismatches',
    tone: 'text-amber-700', bgTone: 'bg-amber-50', borderTone: 'border-amber-200',
    icon: AlertTriangle,
    action: 'These invoices exist in both GSTR-2B and your books, but the amounts differ beyond the ₹2 / 0.5% tolerance. Hover the "Reason" badge on each row for a specific explanation.',
    detail: 'Action: Compare each invoice against the physical bill. Claim ITC only on the amount shown in GSTR-2B. Common cause — suppliers include exempt/zero-rated goods in the same invoice; your GRN may only have recorded the taxable portion.',
    emptyMsg: 'No amount mismatches — all matched invoices have consistent values.',
  },
  onlyIn2B: {
    shortLabel: 'Not in books',
    tone: 'text-blue-700', bgTone: 'bg-blue-50', borderTone: 'border-blue-200',
    icon: FileQuestion,
    action: 'These invoices appear in your GSTR-2B (supplier filed correctly) but you have NO matching GRN entry. You are currently not claiming this ITC.',
    detail: 'Action: Check if these goods were actually received. If yes, create a GRN for each invoice to record the purchase and claim ITC. Remember — ITC must be claimed by 30 November of the next financial year.',
    emptyMsg: 'All GSTR-2B invoices have matching GRN entries in your books.',
  },
  matched: {
    shortLabel: 'Matched',
    tone: 'text-green-700', bgTone: 'bg-green-50', borderTone: 'border-green-200',
    icon: CheckCircle2,
    action: 'These invoices match between GSTR-2B and your books (within the ₹2 / 0.5% tolerance). ITC for all these invoices is safe to claim in GSTR-3B Table 4(A)(5).',
    detail: '',
    emptyMsg: 'No matched invoices found. Upload the correct GSTR-2B period or add GRN entries.',
  },
};

export default function GstReconciliationPage() {
  const router = useRouter();
  const [file, setFile]           = useState<File | null>(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<Result | null>(null);
  const [tab, setTab]             = useState<TabKey>('onlyInBooks');
  const [guideOpen, setGuideOpen] = useState(false);
  const [pastRuns, setPastRuns]     = useState<PastRun[]>([]);
  const [runsOpen, setRunsOpen]     = useState(false);
  const [loadingRun, setLoadingRun] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/reports/gst/recon-runs')
      .then((r) => setPastRuns(r.data))
      .catch(() => {});
  }, []);

  async function runReconcile(f: File) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.post('/reports/gst/reconcile-2b', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data: Result = res.data;
      setResult(data);
      setActiveRunId(data.runId ?? null);
      const s = data.summary;
      setTab(s.onlyInBooks > 0 ? 'onlyInBooks' : s.mismatch > 0 ? 'mismatch' : s.onlyIn2B > 0 ? 'onlyIn2B' : 'matched');
      toast.success('Reconciliation complete — saved to history');
      api.get('/reports/gst/recon-runs').then((r) => setPastRuns(r.data)).catch(() => {});
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Reconciliation failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadRun(runId: string) {
    if (activeRunId === runId) return;
    setLoadingRun(runId);
    try {
      const res = await api.get(`/reports/gst/recon-runs/${runId}`);
      const run = res.data;
      const data: Result = {
        runId: run.id,
        fileName: run.fileName,
        window: run.window,
        summary: run.summary,
        matched: run.matched,
        mismatch: run.mismatch,
        onlyIn2B: run.onlyIn2B,
        onlyInBooks: run.onlyInBooks,
      };
      setResult(data);
      setFile(null);
      setActiveRunId(runId);
      const s = data.summary;
      setTab(s.onlyInBooks > 0 ? 'onlyInBooks' : s.mismatch > 0 ? 'mismatch' : s.onlyIn2B > 0 ? 'onlyIn2B' : 'matched');
    } catch {
      toast.error('Could not load this run');
    } finally {
      setLoadingRun(null);
    }
  }

  async function deleteRun(e: React.MouseEvent, runId: string) {
    e.stopPropagation();
    if (deletingRun) return;
    if (!confirm('Delete this reconciliation run? This cannot be undone.')) return;
    setDeletingRun(runId);
    try {
      await api.delete(`/reports/gst/recon-runs/${runId}`);
      setPastRuns(prev => prev.filter(r => r.id !== runId));
      if (activeRunId === runId) { setResult(null); setActiveRunId(null); }
      toast.success('Run deleted');
    } catch {
      toast.error('Could not delete run');
    } finally {
      setDeletingRun(null);
    }
  }

  function onPick(f: File | undefined | null) {
    if (!f) return;
    setFile(f);
    runReconcile(f);
  }

  function reset() {
    setFile(null);
    setResult(null);
    setActiveRunId(null);
  }

  const s = result?.summary;
  const rows: Row[] = result ? result[tab] : [];
  const cfg = TAB_CONFIG[tab];

  const TABS: { key: TabKey; count: number; itc?: number }[] = result ? [
    { key: 'onlyInBooks', count: s!.onlyInBooks, itc: s!.itcAtRisk   },
    { key: 'mismatch',    count: s!.mismatch                           },
    { key: 'onlyIn2B',   count: s!.onlyIn2B,   itc: s!.itcUnbooked  },
    { key: 'matched',    count: s!.matched,     itc: s!.itcMatched   },
  ] : [];

  return (
    <>
      <Header title="GSTR-2B Reconciliation" />
      <main className="flex-1 p-6 space-y-4 max-w-5xl">

        {/* How to get the file */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setGuideOpen(!guideOpen)}
              className="flex-1 flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen size={15} className="text-[#1B4F8A]" />
                <span className="font-medium text-[#1B4F8A]">How to download GSTR-2B from the GST portal</span>
              </div>
              {guideOpen
                ? <ChevronUp size={15} className="text-gray-400" />
                : <ChevronDown size={15} className="text-gray-400" />}
            </button>
            <a href="/dashboard/help?module=gst#gst-recon2b"
              className="flex items-center gap-1 px-3 py-3 text-xs text-gray-400 hover:text-[#1B4F8A] transition-colors border-l border-gray-100 shrink-0"
              title="Open full reconciliation guide in Help Center"
            >
              <HelpCircle size={14} /> Help
            </a>
          </div>
          {guideOpen && (
            <div className="border-t border-gray-100 px-4 py-3 bg-blue-50/40 space-y-2">
              {GUIDE_STEPS.map((text, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed">{text}</p>
                </div>
              ))}
              <a href="https://gst.gov.in" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#1B4F8A] mt-1 hover:underline">
                Open GST Portal <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>

        {/* Past Runs — always visible when runs exist */}
        {pastRuns.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setRunsOpen(!runsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-gray-700">
                <History size={15} className="text-[#1B4F8A]" />
                <span className="font-medium">Past Reconciliation Runs</span>
                <span className="text-xs text-gray-400">({pastRuns.length})</span>
                {activeRunId && (
                  <span className="text-xs bg-[#1B4F8A]/10 text-[#1B4F8A] px-2 py-0.5 rounded font-medium">viewing one</span>
                )}
              </div>
              {runsOpen
                ? <ChevronUp size={15} className="text-gray-400" />
                : <ChevronDown size={15} className="text-gray-400" />}
            </button>
            {runsOpen && (
              <div className="border-t border-gray-100">
                {/* New Upload button — shown when viewing a past run */}
                {result && (
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <button
                      onClick={reset}
                      className="flex items-center gap-1.5 text-xs text-[#1B4F8A] font-medium hover:underline"
                    >
                      <PlusCircle size={13} /> New upload / clear result
                    </button>
                  </div>
                )}
                {pastRuns.map((run) => {
                  const s = run.summary;
                  const isLoading = loadingRun === run.id;
                  const isDeleting = deletingRun === run.id;
                  const isActive = activeRunId === run.id;
                  return (
                    <div
                      key={run.id}
                      className={`flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-b-0 transition-colors ${
                        isActive ? 'bg-blue-50 border-l-2 border-l-[#1B4F8A]' : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <button
                        onClick={() => loadRun(run.id)}
                        disabled={isLoading || isActive}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-[#1B4F8A]/20' : 'bg-[#1B4F8A]/10'}`}>
                          {isLoading
                            ? <Loader2 size={14} className="text-[#1B4F8A] animate-spin" />
                            : <Clock size={14} className="text-[#1B4F8A]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">
                            {run.period}
                            {isActive && <span className="ml-2 text-[10px] bg-[#1B4F8A] text-white px-1.5 py-0.5 rounded font-bold">CURRENT</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
                            {new Date(run.runAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {run.uploadedBy && <> · {run.uploadedBy}</>}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0 text-xs ml-2">
                        {s.mismatch > 0 && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">{s.mismatch} mismatch</span>
                        )}
                        {s.onlyInBooks > 0 && (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">{s.onlyInBooks} at risk</span>
                        )}
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">{s.matched} matched</span>
                        <button
                          onClick={(e) => deleteRun(e, run.id)}
                          disabled={!!deletingRun}
                          title="Delete this run"
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded"
                        >
                          {isDeleting
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Upload area */}
        {!result && (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              loading
                ? 'border-[#1B4F8A] bg-blue-50 cursor-default'
                : 'border-gray-300 hover:border-[#1B4F8A] hover:bg-blue-50/30'
            }`}
            onClick={() => !loading && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-[#1B4F8A]">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-semibold">Matching against your purchase GRNs…</p>
                <p className="text-xs text-gray-500">This takes a few seconds. Do not close the tab.</p>
              </div>
            ) : (
              <div>
                <Upload size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Click or drag your GSTR-2B file here</p>
                <p className="text-xs text-gray-500 mt-1">Accepts <strong>.json</strong> (from GST portal) or <strong>.xlsx</strong> · Max 20 MB</p>
                <p className="text-[11px] text-gray-400 mt-3 max-w-sm mx-auto leading-relaxed">
                  Not sure how to get the file? Expand the guide above.
                </p>
              </div>
            )}
            <input
              ref={fileRef} type="file" accept=".json,.xlsx,.xls,application/json"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </div>
        )}

        {result && s && (
          <>
            {/* File info bar */}
            <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <div className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 size={15} />
                  <span className="font-medium text-gray-800">{result.fileName}</span>
                </div>
                {!file && result.runId && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <History size={11} /> saved run
                  </span>
                )}
                {result.window.from && (
                  <span className="bg-gray-100 px-2.5 py-0.5 rounded-full text-xs font-mono text-gray-600">
                    {fmtDate(result.window.from)} – {fmtDate(result.window.to)}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {s.b2bInvoices} invoices in 2B · Total ITC: {inr(s.itcIn2B)}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => downloadAllCsv(result)}
                  className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6b] font-medium transition-colors"
                >
                  <Download size={13} /> Download All
                </button>
                <button onClick={reset}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
                  <X size={13} /> New file
                </button>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  icon: ShieldAlert, tone: 'red', tabKey: 'onlyInBooks' as TabKey,
                  label: 'ITC at risk', value: inr(s.itcAtRisk),
                  sub: `${s.onlyInBooks} invoice(s) — supplier not filed`,
                },
                {
                  icon: AlertTriangle, tone: 'amber', tabKey: 'mismatch' as TabKey,
                  label: 'Mismatches', value: String(s.mismatch) + ' invoice(s)',
                  sub: 'amounts differ — need review',
                },
                {
                  icon: FileQuestion, tone: 'blue', tabKey: 'onlyIn2B' as TabKey,
                  label: 'Unclaimed ITC', value: inr(s.itcUnbooked),
                  sub: `${s.onlyIn2B} invoice(s) — no GRN entered`,
                },
                {
                  icon: FileCheck2, tone: 'green', tabKey: 'matched' as TabKey,
                  label: 'Matched & safe', value: inr(s.itcMatched),
                  sub: `${s.matched} invoice(s) confirmed`,
                },
              ].map(({ icon: Icon, tone, tabKey, label, value, sub }) => {
                const toneMap: Record<string, string> = {
                  red:   'bg-red-50 border-red-200 text-red-800',
                  amber: 'bg-amber-50 border-amber-200 text-amber-800',
                  blue:  'bg-blue-50 border-blue-200 text-blue-800',
                  green: 'bg-green-50 border-green-200 text-green-800',
                };
                const ringMap: Record<string, string> = {
                  red: 'ring-red-400', amber: 'ring-amber-400', blue: 'ring-blue-400', green: 'ring-green-400',
                };
                return (
                  <button key={label}
                    onClick={() => setTab(tabKey)}
                    className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${toneMap[tone]} ${
                      tab === tabKey ? `ring-2 ${ringMap[tone]}` : ''
                    }`}>
                    <div className="flex items-center gap-2 mb-1.5 opacity-80">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{label}</span>
                    </div>
                    <div className="text-lg font-bold">{value}</div>
                    <div className="text-xs opacity-70 mt-0.5 leading-relaxed">{sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
              {TABS.map(({ key, count, itc }) => {
                const c = TAB_CONFIG[key];
                const Icon = c.icon;
                const active = tab === key;
                return (
                  <button key={key} onClick={() => setTab(key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      active
                        ? 'border-[#1B4F8A] text-[#1B4F8A]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                    <Icon size={14} className={active ? 'text-[#1B4F8A]' : c.tone} />
                    {c.shortLabel}
                    <span className={`${c.tone} ${active ? '' : 'opacity-60'}`}>({count})</span>
                    {itc !== undefined && count > 0 && (
                      <span className={`text-[10px] ${c.tone} opacity-80 ml-0.5`}>{inr(itc)}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab action banner */}
            <div className={`rounded-xl border ${cfg.bgTone} ${cfg.borderTone} px-4 py-3 space-y-1`}>
              <p className={`text-sm font-medium ${cfg.tone}`}>{cfg.action}</p>
              {cfg.detail && <p className={`text-xs ${cfg.tone} opacity-80`}>{cfg.detail}</p>}
            </div>

            {/* Table */}
            {rows.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
                <FileX2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                {cfg.emptyMsg}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/70">
                  <p className="text-xs text-gray-500">{rows.length} invoice(s)</p>
                  <button
                    onClick={() => downloadCsv(rows, tab, result.fileName)}
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#1B4F8A] transition-colors"
                  >
                    <Download size={13} /> Download CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold">Supplier / GSTIN</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Invoice</th>
                        {(tab === 'matched' || tab === 'mismatch' || tab === 'onlyIn2B') && (
                          <>
                            <th className="text-right px-4 py-2.5 font-semibold cursor-help" title="Taxable value as parsed from the GSTR-2B file uploaded from the GST portal">2B Taxable</th>
                            <th className="text-right px-4 py-2.5 font-semibold cursor-help" title="Total GST (CGST + SGST + IGST) from the GSTR-2B file — this is the ITC you can claim">2B Tax</th>
                          </>
                        )}
                        {(tab === 'matched' || tab === 'mismatch' || tab === 'onlyInBooks') && (
                          <>
                            <th className="text-right px-4 py-2.5 font-semibold cursor-help" title="Taxable value recorded in your GRN (books)">Book Taxable</th>
                            <th className="text-right px-4 py-2.5 font-semibold cursor-help" title="Total GST recorded in your GRN (books) — CGST + SGST + IGST">Book Tax</th>
                          </>
                        )}
                        {tab === 'mismatch' && (
                          <>
                            <th className="text-right px-4 py-2.5 font-semibold text-amber-700 cursor-help" title="Book Taxable − 2B Taxable. Positive = your book value is higher than GSTR-2B">Taxable Diff</th>
                            <th className="text-right px-4 py-2.5 font-semibold text-amber-700 cursor-help" title="Book Tax − 2B Tax. Positive = your book tax is higher than GSTR-2B. Claim only the 2B amount.">Tax Diff</th>
                            <th className="text-left px-4 py-2.5 font-semibold text-amber-700" title="Why this invoice is mismatched">Reason</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-800">{r.supplierName || '—'}</div>
                            <div className="text-xs text-gray-400 font-mono tracking-wide">{r.gstin}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            {r.grnId ? (
                              <button
                                onClick={() => router.push(`/dashboard/grn/${r.grnId}`)}
                                className="text-[#1B4F8A] hover:underline font-medium"
                              >
                                {r.invoiceNo}
                              </button>
                            ) : (
                              <span className="text-gray-800 font-medium">{r.invoiceNo}</span>
                            )}
                            <div className="text-xs text-gray-400 mt-0.5">
                              {fmtDate(r.invoiceDate)}
                              {r.grnNumber && <> · <span className="font-mono">{r.grnNumber}</span></>}
                            </div>
                          </td>
                          {(tab === 'matched' || tab === 'mismatch' || tab === 'onlyIn2B') && (
                            <>
                              <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                                {r.b2bTaxable != null ? inr(r.b2bTaxable) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                                {r.b2bTax != null ? inr(r.b2bTax) : '—'}
                              </td>
                            </>
                          )}
                          {(tab === 'matched' || tab === 'mismatch' || tab === 'onlyInBooks') && (
                            <>
                              <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                                {r.bookTaxable != null ? inr(r.bookTaxable) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                                {r.bookTax != null ? inr(r.bookTax) : '—'}
                              </td>
                            </>
                          )}
                          {tab === 'mismatch' && (() => {
                            const td = r.taxableDiff ?? 0;
                            const tx = r.taxDiff ?? 0;
                            const reason = getMismatchReason(r);
                            return (
                              <>
                                <td className={`px-4 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${Math.abs(td) > 0.5 ? 'text-amber-600' : 'text-gray-400'}`}>
                                  {td > 0 ? '+' : ''}{inr(td)}
                                </td>
                                <td className={`px-4 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${Math.abs(tx) > 0.5 ? 'text-amber-600' : 'text-gray-400'}`}>
                                  {tx > 0 ? '+' : ''}{inr(tx)}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium cursor-help ${reason.color}`}
                                    title={reason.hint}
                                  >
                                    {reason.badge}
                                  </span>
                                </td>
                              </>
                            );
                          })()}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer info */}
            <p className="text-xs text-gray-400 flex items-start gap-1.5 pb-4">
              <Info size={12} className="mt-0.5 shrink-0" />
              Matched by GSTIN + Invoice Number (case-insensitive, punctuation stripped). An invoice is &ldquo;matched&rdquo; when the taxable value differs by less than ₹2 or 0.5%, and tax by less than ₹2 or 1%.
              Credit/debit notes (CDNR) from GSTR-2B are included. Positive diff = your book value is higher than GSTR-2B.
            </p>
          </>
        )}
      </main>
    </>
  );
}
