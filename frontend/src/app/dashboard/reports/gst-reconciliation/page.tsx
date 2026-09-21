'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileCheck2, AlertTriangle, FileX2, FileQuestion, CheckCircle2,
  X, Loader2, ShieldAlert, ChevronDown, ChevronUp, Download,
  ExternalLink, Info, BookOpen, HelpCircle, History, Clock, Trash2, PlusCircle,
  ArrowUp, ArrowDown, ArrowUpDown, Search,
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
  /** Return period ('YYYY-MM') of the 2B file the invoice was reported in; absent for books-only rows and older saved runs. */
  period?: string | null;
}
interface MergeInfo {
  files: { name: string; period: string | null; invoices: number; error: string | null }[];
  duplicatesRemoved: number;
  conflicts: { gstin: string; invoiceNo: string; keptFrom: string; droppedFrom: string }[];
  periods: string[];
  missingPeriods: string[];
  expectedRange: string | null;
  unknownPeriodFiles: string[];
}
interface Result {
  runId?: string;
  fileName: string;
  window: { from: string | null; to: string | null };
  summary: {
    b2bInvoices: number; matched: number; mismatch: number; onlyIn2B: number; onlyInBooks: number;
    itcIn2B: number; itcMatched: number; itcAtRisk: number; itcUnbooked: number;
    merge?: MergeInfo;   // absent on runs saved before multi-file upload existed
  };
  matched: Row[]; mismatch: Row[]; onlyIn2B: Row[]; onlyInBooks: Row[];
}

type TabKey = 'matched' | 'mismatch' | 'onlyIn2B' | 'onlyInBooks';
type SortKey =
  | 'supplier' | 'invoiceNo' | 'date'
  | 'b2bTaxable' | 'b2bTax' | 'bookTaxable' | 'bookTax'
  | 'taxableDiff' | 'taxDiff' | 'reason';

// Month bucket of an invoice date, in the same local time the table displays it in.
const monthKey = (iso: string | null) => {
  if (!iso) return 'none';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (k: string) =>
  k === 'none' ? 'No date'
    : new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1)
        .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

// Indian financial year (Apr–Mar), identified by the calendar year it starts in.
const fyStartOfDate = (iso: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
};
const fyStartOfPeriod = (key: string): number => {       // 'YYYY-MM'
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5));
  return m >= 4 ? y : y - 1;
};
const fyLabel = (start: number) => `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
const periodLabel = (key: string) =>
  new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
// ITC on an FY's invoices can be claimed until 30 Nov after that FY ends (Section 16(4)).
const itcDeadline = (fyStart: number) => new Date(fyStart + 1, 10, 30);

// Tax that matters for a row in a given tab: books' tax for "ITC at risk", the 2B's tax otherwise.
const rowTax = (r: Row, tab: TabKey) => Number((tab === 'onlyInBooks' ? r.bookTax : r.b2bTax) ?? 0);
const supplierKey = (r: Row) => r.gstin || r.supplierName;

function sortValue(r: Row, k: SortKey): string | number | null {
  switch (k) {
    case 'supplier':    return (r.supplierName || r.gstin || '').toLowerCase();
    case 'invoiceNo':   return r.invoiceNo ?? '';
    case 'date':        return r.invoiceDate ? new Date(r.invoiceDate).getTime() : null;
    case 'reason':      return getMismatchReason(r).badge;
    default:            return (r[k] as number | undefined) ?? null;
  }
}

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

// ─── Excel export ─────────────────────────────────────────────────────────────
// Built in the browser (SheetJS, loaded only on click) so a per-tab export can
// respect whatever filters and sort the user has applied.
type Cell = string | number | Date | null;
type SheetSpec = { name: string; head?: string[]; data: Cell[][] };

const TAB_SHEET_NAME: Record<TabKey, string> = {
  onlyInBooks: 'ITC at risk', mismatch: 'Mismatches', onlyIn2B: 'Not in books', matched: 'Matched',
};
const BASE_HEAD = ['Supplier', 'GSTIN', 'Invoice No', 'Invoice Date', 'Financial Year'];

function tabSheet(tab: TabKey, rows: Row[]): SheetSpec {
  const base = (r: Row): Cell[] => {
    const fy = fyStartOfDate(r.invoiceDate);
    return [r.supplierName, r.gstin, r.invoiceNo, r.invoiceDate ? new Date(r.invoiceDate) : null, fy === null ? '' : fyLabel(fy)];
  };
  const in2b = (r: Row) => (r.period ? periodLabel(r.period) : '');
  const n = (v: number | undefined) => v ?? 0;
  switch (tab) {
    case 'onlyInBooks':
      return { name: TAB_SHEET_NAME[tab], head: [...BASE_HEAD, 'GRN No', 'Book Taxable (₹)', 'Book Tax (₹)'],
        data: rows.map((r) => [...base(r), r.grnNumber ?? '', n(r.bookTaxable), n(r.bookTax)]) };
    case 'onlyIn2B':
      return { name: TAB_SHEET_NAME[tab], head: [...BASE_HEAD, 'Reported in 2B', '2B Taxable (₹)', '2B Tax (₹)'],
        data: rows.map((r) => [...base(r), in2b(r), n(r.b2bTaxable), n(r.b2bTax)]) };
    case 'mismatch':
      return { name: TAB_SHEET_NAME[tab],
        head: [...BASE_HEAD, 'Reported in 2B', 'GRN No', '2B Taxable (₹)', '2B Tax (₹)', 'Book Taxable (₹)', 'Book Tax (₹)', 'Taxable Diff (₹)', 'Tax Diff (₹)', 'Reason'],
        data: rows.map((r) => [...base(r), in2b(r), r.grnNumber ?? '', n(r.b2bTaxable), n(r.b2bTax), n(r.bookTaxable), n(r.bookTax), n(r.taxableDiff), n(r.taxDiff), getMismatchReason(r).badge]) };
    default:
      return { name: TAB_SHEET_NAME[tab],
        head: [...BASE_HEAD, 'Reported in 2B', 'GRN No', '2B Taxable (₹)', '2B Tax (₹)', 'Book Taxable (₹)', 'Book Tax (₹)'],
        data: rows.map((r) => [...base(r), in2b(r), r.grnNumber ?? '', n(r.b2bTaxable), n(r.b2bTax), n(r.bookTaxable), n(r.bookTax)]) };
  }
}

function summarySheet(result: Result): SheetSpec {
  const s = result.summary;
  const m = s.merge;
  const d = (iso: string | null) => (iso ? fmtDate(iso) : '—');
  const data: Cell[][] = [
    ['GSTR-2B Reconciliation'],
    ['File(s)', result.fileName],
    ['Invoice dates covered', `${d(result.window.from)} – ${d(result.window.to)}`],
    ['Invoices in GSTR-2B', s.b2bInvoices],
    [],
    ['Category', 'Invoices', 'Tax (₹)', 'What it means'],
    ['ITC at risk', s.onlyInBooks, s.itcAtRisk, 'In your books but not in GSTR-2B — supplier has not filed; do not claim yet'],
    ['Mismatches', s.mismatch, null, 'In both, but amounts differ — claim only the 2B amount'],
    ['Not in books', s.onlyIn2B, s.itcUnbooked, 'In GSTR-2B but no GRN entered — enter the purchase to claim'],
    ['Matched', s.matched, s.itcMatched, 'Matches your books — safe to claim'],
    [],
    ['Total ITC per GSTR-2B', null, s.itcIn2B],
  ];
  if (m) {
    data.push([]);
    data.push(['Files merged', m.files.filter((f) => !f.error).length]);
    data.push(['Duplicate invoices ignored', m.duplicatesRemoved]);
    if (m.expectedRange) data.push(['Months expected', m.expectedRange]);
    data.push(['Missing month files', m.missingPeriods.length ? m.missingPeriods.join(', ') : 'None']);
    m.files.forEach((f) => data.push(['File', f.name, f.period ?? 'month unknown', f.error ?? `${f.invoices} invoice(s)`]));
  }
  return { name: 'Summary', data };
}

async function saveWorkbook(sheets: SheetSpec[], fileName: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const aoa: Cell[][] = sh.head ? [sh.head, ...sh.data] : sh.data;
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: 'dd-mmm-yyyy' });
    const cols = Math.max(...aoa.map((r) => r.length), 1);
    ws['!cols'] = Array.from({ length: cols }, (_, c) => ({
      wch: Math.min(48, Math.max(10, ...aoa.slice(0, 300).map((r) => (r[c] instanceof Date ? 12 : String(r[c] ?? '').length + 2)))),
    }));
    if (sh.head && sh.data.length > 0) {
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sh.data.length, c: sh.head.length - 1 } }) };
    }
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}

const safeName = (fileName: string) => fileName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');

async function downloadAllExcel(result: Result) {
  const order: TabKey[] = ['onlyInBooks', 'mismatch', 'onlyIn2B', 'matched'];
  await saveWorkbook(
    [summarySheet(result), ...order.map((k) => tabSheet(k, result[k]))],
    `GSTR2B_Recon_ALL_${safeName(result.fileName)}.xlsx`,
  );
}

async function downloadTabExcel(tab: TabKey, rows: Row[], fileName: string) {
  await saveWorkbook([tabSheet(tab, rows)], `GSTR2B_${TAB_SHEET_NAME[tab].replace(/ /g, '_')}_${safeName(fileName)}.xlsx`);
}

const GUIDE_STEPS = [
  'Go to the GST portal: gst.gov.in → Login with your GSTIN and password.',
  'Click Services → Returns → View Returns / Filed Returns → OR use Returns Dashboard → View GSTR-2B.',
  'Select the return period (month and year) you want to reconcile.',
  'If the statement says "Generate" — click it and wait a few minutes for it to be generated.',
  'Once ready, click "Download" → choose JSON format (preferred) or Excel (.xlsx). Repeat for every month you want checked — earlier months matter, because a supplier often reports an invoice a month or two late.',
  'Upload all the downloaded files together in the box below (select many at once, or drag them in). Both .json and .xlsx are accepted, and you can mix them. Duplicates across files are removed automatically — no manual merging needed.',
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
  const [sort, setSort]             = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const [fFy, setFFy]               = useState('');
  const [fMonth, setFMonth]         = useState('');
  const [fPeriod, setFPeriod]       = useState('');
  const [fSupplier, setFSupplier]   = useState('');
  const [fSearch, setFSearch]       = useState('');
  const [fMinTax, setFMinTax]       = useState('');
  const [fReason, setFReason]       = useState('');

  function resetFilters() { setFFy(''); setFMonth(''); setFPeriod(''); setFSupplier(''); setFSearch(''); setFMinTax(''); setFReason(''); }
  // Sorting and the mismatch-reason filter are per-tab (columns differ); the
  // month/supplier/search filters deliberately carry across tabs.
  useEffect(() => { setSort(null); setFReason(''); }, [tab]);
  // A different file or saved run has different months/suppliers.
  useEffect(() => { resetFilters(); setSort(null); }, [result?.runId, result?.fileName]);

  useEffect(() => {
    if (fFy && fMonth && fMonth !== 'none' && String(fyStartOfPeriod(fMonth)) !== fFy) setFMonth('');
  }, [fFy, fMonth]);

  function toggleSort(key: SortKey) {
    setSort((cur) => (!cur || cur.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null));
  }

  useEffect(() => {
    api.get('/reports/gst/recon-runs')
      .then((r) => setPastRuns(r.data))
      .catch(() => {});
  }, []);

  async function runReconcile(picked: File[]) {
    setLoading(true);
    try {
      const fd = new FormData();
      picked.forEach((f) => fd.append('files', f));
      const res = await api.post('/reports/gst/reconcile-2b', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data: Result = res.data;
      setResult(data);
      setActiveRunId(data.runId ?? null);
      const s = data.summary;
      setTab(s.onlyInBooks > 0 ? 'onlyInBooks' : s.mismatch > 0 ? 'mismatch' : s.onlyIn2B > 0 ? 'onlyIn2B' : 'matched');
      const m = s.merge;
      const skipped = m?.files.filter((x) => x.error).length ?? 0;
      toast.success(
        picked.length > 1
          ? `${picked.length - skipped} files merged${m?.duplicatesRemoved ? `, ${m.duplicatesRemoved} duplicate(s) ignored` : ''} — saved to history`
          : 'Reconciliation complete — saved to history',
      );
      if (skipped) toast.error(`${skipped} file(s) could not be read — see details below`);
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

  function onPick(list: FileList | File[] | undefined | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    setFile(picked[0]);
    runReconcile(picked);
  }

  function reset() {
    setFile(null);
    setResult(null);
    setActiveRunId(null);
  }

  const s = result?.summary;
  const rows: Row[] = result ? result[tab] : [];
  const cfg = TAB_CONFIG[tab];

  // Options come from every tab so a selected month/supplier stays valid when
  // switching tabs; counts are for the tab being viewed.
  const { monthOptions, supplierOptions, fyOptions, periodOptions } = useMemo(() => {
    if (!result) return {
      monthOptions: [] as string[], supplierOptions: [] as { key: string; label: string }[],
      fyOptions: [] as number[], periodOptions: [] as string[],
    };
    const months = new Set<string>();
    const fys = new Set<number>();
    const periods = new Set<string>();
    const suppliers = new Map<string, string>();
    (['matched', 'mismatch', 'onlyIn2B', 'onlyInBooks'] as TabKey[]).forEach((k) =>
      result[k].forEach((r) => {
        months.add(monthKey(r.invoiceDate));
        const fy = fyStartOfDate(r.invoiceDate);
        if (fy !== null) fys.add(fy);
        if (r.period) periods.add(r.period);
        if (!suppliers.has(supplierKey(r))) suppliers.set(supplierKey(r), r.supplierName || r.gstin);
      }));
    // Months narrow to the chosen financial year, so the two filters never contradict each other.
    const monthList = Array.from(months)
      .filter((m) => m !== 'none' && (!fFy || String(fyStartOfPeriod(m)) === fFy))
      .sort().reverse();
    if (months.has('none') && !fFy) monthList.push('none');
    const supplierList = Array.from(suppliers, ([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      monthOptions: monthList, supplierOptions: supplierList,
      fyOptions: Array.from(fys).sort((a, b) => b - a),
      periodOptions: Array.from(periods).sort().reverse(),
    };
  }, [result, fFy]);

  const { monthCounts, fyCounts, periodCounts } = useMemo(() => {
    const m: Record<string, number> = {}, f: Record<string, number> = {}, p: Record<string, number> = {};
    rows.forEach((r) => {
      const k = monthKey(r.invoiceDate); m[k] = (m[k] ?? 0) + 1;
      const fy = fyStartOfDate(r.invoiceDate); if (fy !== null) f[fy] = (f[fy] ?? 0) + 1;
      if (r.period) p[r.period] = (p[r.period] ?? 0) + 1;
    });
    return { monthCounts: m, fyCounts: f, periodCounts: p };
  }, [rows]);

  // Invoices dated in the chosen FY but reported in a later FY's 2B — e.g. March bills the supplier
  // filed in April. They stay in the FY they are dated in; this just tells the user they are there.
  const crossFyCount = useMemo(() => {
    if (!fFy) return 0;
    return rows.filter((r) => String(fyStartOfDate(r.invoiceDate)) === fFy && r.period && fyStartOfPeriod(r.period) > Number(fFy)).length;
  }, [rows, fFy]);

  const shownRows = useMemo(() => {
    const q = fSearch.trim().toLowerCase();
    const min = fMinTax.trim() === '' ? null : Number(fMinTax);
    let out = rows.filter((r) => {
      if (fFy && String(fyStartOfDate(r.invoiceDate)) !== fFy) return false;
      if (fMonth && monthKey(r.invoiceDate) !== fMonth) return false;
      if (fPeriod && (r.period ?? '') !== fPeriod) return false;
      if (fSupplier && supplierKey(r) !== fSupplier) return false;
      if (min !== null && !Number.isNaN(min) && rowTax(r, tab) < min) return false;
      if (fReason && getMismatchReason(r).badge !== fReason) return false;
      if (q && ![r.supplierName, r.gstin, r.invoiceNo, r.grnNumber].some((v) => (v ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
    if (sort) {
      const mult = sort.dir === 'asc' ? 1 : -1;
      out = [...out].sort((a, b) => {
        const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
        if (va === null && vb === null) return 0;
        if (va === null) return 1;          // blanks always last, regardless of direction
        if (vb === null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult;
        return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * mult;
      });
    }
    return out;
  }, [rows, tab, fFy, fMonth, fPeriod, fSupplier, fSearch, fMinTax, fReason, sort]);

  const filtersActive = !!(fFy || fMonth || fPeriod || fSupplier || fSearch.trim() || fMinTax.trim() || fReason);
  const shownTax = shownRows.reduce((sum, r) => sum + rowTax(r, tab), 0);

  const sortTh = (key: SortKey, label: string, opts: { right?: boolean; title?: string; cls?: string } = {}) => (
    <th className={`px-4 py-2.5 font-semibold ${opts.right ? 'text-right' : 'text-left'} ${opts.cls ?? ''}`} title={opts.title}>
      <button
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 hover:text-[#1B4F8A] ${opts.right ? 'flex-row-reverse' : ''}`}
        title={opts.title ? `${opts.title} — click to sort` : 'Click to sort'}
      >
        {label}
        {sort?.key === key
          ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)
          : <ArrowUpDown size={11} className="opacity-30" />}
      </button>
    </th>
  );

  const TABS: { key: TabKey; count: number; itc?: number }[] = result ? [
    { key: 'onlyInBooks', count: s!.onlyInBooks, itc: s!.itcAtRisk   },
    { key: 'mismatch',    count: s!.mismatch                           },
    { key: 'onlyIn2B',   count: s!.onlyIn2B,   itc: s!.itcUnbooked  },
    { key: 'matched',    count: s!.matched,     itc: s!.itcMatched   },
  ] : [];

  return (
    <>
      <Header title="GSTR-2B Reconciliation" />
      <main className="flex-1 p-6 space-y-4 max-w-6xl">

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
            onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files); }}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-[#1B4F8A]">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-semibold">Merging files and matching against your purchase GRNs…</p>
                <p className="text-xs text-gray-500">This takes a few seconds. Do not close the tab.</p>
              </div>
            ) : (
              <div>
                <Upload size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Click or drag your GSTR-2B files here</p>
                <p className="text-xs text-gray-500 mt-1">Select <strong>all</strong> the files you downloaded — every month, .json or .xlsx, up to 24 files · Max 20 MB each</p>
                <p className="text-[11px] text-gray-400 mt-3 max-w-md mx-auto leading-relaxed">
                  Files are merged automatically and duplicate invoices are ignored, so there is nothing to combine by hand.
                  Not sure how to get the files? Expand the guide above.
                </p>
              </div>
            )}
            <input
              ref={fileRef} type="file" multiple accept=".json,.xlsx,.xls,application/json"
              className="hidden"
              onChange={(e) => { onPick(e.target.files); e.target.value = ''; }}
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
                  onClick={() => downloadAllExcel(result).catch(() => toast.error('Could not create the Excel file'))}
                  title="One Excel workbook with a Summary sheet plus a sheet each for ITC at risk, Mismatches, Not in books and Matched — everything, ignoring the filters"
                  className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6b] font-medium transition-colors"
                >
                  <Download size={13} /> All (Excel)
                </button>
                <button
                  onClick={() => downloadAllCsv(result)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1B4F8A] transition-colors"
                >
                  <Download size={13} /> All (CSV)
                </button>
                <button onClick={reset}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
                  <X size={13} /> New file
                </button>
              </div>
            </div>

            {/* What was merged, and whether any month's file is missing */}
            {s.merge && (() => {
              const m = s.merge;
              const unread = m.files.filter((f) => f.error);
              const many = m.files.length > 1;
              const hasRange = !!m.expectedRange;
              if (!many && !unread.length && !m.missingPeriods.length && !m.unknownPeriodFiles.length && !hasRange) return null;
              return (
                <div className="space-y-2">
                  {m.missingPeriods.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Missing GSTR-2B file for: {m.missingPeriods.join(', ')}
                      </p>
                      <p className="text-xs text-red-700/80 mt-1 leading-relaxed">
                        Your books need a 2B for {m.expectedRange}, but nothing uploaded covers {m.missingPeriods.length === 1 ? 'that month' : 'those months'}.
                        Invoices your suppliers reported in {m.missingPeriods.length === 1 ? 'it' : 'them'} will wrongly show as &ldquo;ITC at risk&rdquo; until you
                        download {m.missingPeriods.length === 1 ? 'that month' : 'those months'} from the GST portal and upload all the files together again.
                      </p>
                    </div>
                  )}
                  {m.missingPeriods.length === 0 && hasRange && m.unknownPeriodFiles.length === 0 && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs text-green-700 flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Every month covered: {m.expectedRange}
                    </div>
                  )}
                  {m.unknownPeriodFiles.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                      Couldn&apos;t tell which month {m.unknownPeriodFiles.join(', ')} covers, so the missing-month check may be incomplete.
                      Files downloaded from the portal keep the month in their name — avoid renaming them.
                    </div>
                  )}
                  {unread.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                      <strong>Not used:</strong>{' '}
                      {unread.map((f) => `${f.name} (${f.error})`).join('; ')}
                    </div>
                  )}
                  {(many || m.duplicatesRemoved > 0) && (
                    <details className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs text-gray-600">
                      <summary className="cursor-pointer select-none font-medium text-gray-700">
                        {m.files.length - unread.length} file(s) merged
                        {m.duplicatesRemoved > 0 && ` · ${m.duplicatesRemoved} duplicate invoice(s) ignored`}
                        {m.conflicts.length > 0 && ` · ${m.conflicts.length} with differing amounts`}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {m.files.map((f, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="truncate">{f.name}</span>
                            <span className="text-gray-400 whitespace-nowrap">
                              {f.period ?? 'month unknown'} · {f.invoices} invoice(s)
                            </span>
                          </li>
                        ))}
                      </ul>
                      {m.conflicts.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100 text-amber-700">
                          Same invoice in two files with different amounts (the later month&apos;s value was used):{' '}
                          {m.conflicts.map((c) => `${c.invoiceNo} (${c.gstin})`).join(', ')}
                        </div>
                      )}
                    </details>
                  )}
                </div>
              );
            })()}

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
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-white">
                  <select value={fFy} onChange={(e) => setFFy(e.target.value)}
                    title="Financial year (April–March), by invoice date. A March bill that the supplier reported in April's 2B still belongs to the earlier year."
                    className="text-xs h-7 px-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none">
                    <option value="">All financial years</option>
                    {fyOptions.map((y) => (
                      <option key={y} value={String(y)}>{fyLabel(y)} ({fyCounts[y] ?? 0})</option>
                    ))}
                  </select>
                  <select value={fMonth} onChange={(e) => setFMonth(e.target.value)}
                    title="Show only invoices dated in this month (by invoice date, not upload date)"
                    className="text-xs h-7 px-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none">
                    <option value="">All months</option>
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>{monthLabel(m)} ({monthCounts[m] ?? 0})</option>
                    ))}
                  </select>
                  {tab !== 'onlyInBooks' && periodOptions.length > 0 && (
                    <select value={fPeriod} onChange={(e) => setFPeriod(e.target.value)}
                      title="Show only invoices that appeared in this month's GSTR-2B (the month the supplier reported them, which can be later than the invoice date)"
                      className="text-xs h-7 px-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none">
                      <option value="">Reported in any 2B</option>
                      {periodOptions.map((k) => (
                        <option key={k} value={k}>In {periodLabel(k)} 2B ({periodCounts[k] ?? 0})</option>
                      ))}
                    </select>
                  )}
                  <select value={fSupplier} onChange={(e) => setFSupplier(e.target.value)}
                    title="Show only one supplier's invoices"
                    className="text-xs h-7 px-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none max-w-[200px]">
                    <option value="">All suppliers</option>
                    {supplierOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  {tab === 'mismatch' && (
                    <select value={fReason} onChange={(e) => setFReason(e.target.value)}
                      title="Filter by what differs: taxable value, tax, or both"
                      className="text-xs h-7 px-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none">
                      <option value="">All reasons</option>
                      <option value="Both differ">Both differ</option>
                      <option value="Taxable diff">Taxable diff</option>
                      <option value="Tax diff">Tax diff</option>
                    </select>
                  )}
                  <input type="number" min="0" value={fMinTax} onChange={(e) => setFMinTax(e.target.value)}
                    placeholder="Min tax ₹"
                    title={tab === 'onlyInBooks' ? 'Hide invoices whose book tax is below this amount' : 'Hide invoices whose 2B tax is below this amount'}
                    className="text-xs h-7 w-24 px-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none" />
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={fSearch} onChange={(e) => setFSearch(e.target.value)}
                      placeholder="Supplier, GSTIN, invoice, GRN…"
                      title="Search by supplier name, GSTIN, invoice number or GRN number"
                      className="text-xs h-7 w-52 pl-7 pr-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none" />
                  </div>
                  {filtersActive && (
                    <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500">
                      <X size={12} /> Clear filters
                    </button>
                  )}
                  {fFy && (() => {
                    const dl = itcDeadline(Number(fFy));
                    const passed = dl < new Date();
                    return (
                      <p className={`basis-full text-[11px] leading-relaxed ${passed ? 'text-red-600' : 'text-gray-500'}`}
                        title="Section 16(4) of the CGST Act: ITC on an invoice can be claimed only up to 30 November following the end of the financial year the invoice belongs to (or the annual return date, if earlier).">
                        {fyLabel(Number(fFy))}: ITC {passed ? 'claim deadline has passed' : 'can be claimed until'}{' '}
                        <strong>{dl.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>.
                        {crossFyCount > 0 && (
                          <> {crossFyCount} invoice(s) dated in this year were reported in a later year&apos;s 2B (for example March bills filed by the supplier in April) — they are counted here by invoice date.</>
                        )}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/70">
                  <p className="text-xs text-gray-500">
                    {filtersActive ? `${shownRows.length} of ${rows.length}` : rows.length} invoice(s)
                    {' · '}
                    <span title={tab === 'onlyInBooks' ? 'Total tax recorded in your books for the rows shown' : 'Total tax per GSTR-2B for the rows shown'}>
                      Tax {inr(shownTax)}
                    </span>
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => downloadTabExcel(tab, shownRows, result.fileName).catch(() => toast.error('Could not create the Excel file'))}
                      title="Downloads the rows currently shown, in this tab's own Excel file (with your filters and sort applied)"
                      className="flex items-center gap-1.5 text-xs text-[#1B4F8A] hover:text-[#163d6b] font-medium transition-colors"
                    >
                      <Download size={13} /> Download Excel
                    </button>
                    <button
                      onClick={() => downloadCsv(shownRows, tab, result.fileName)}
                      title="Downloads the rows currently shown as CSV (with your filters and sort applied)"
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1B4F8A] transition-colors"
                    >
                      <Download size={13} /> CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs">
                      <tr>
                        {sortTh('supplier', 'Supplier / GSTIN')}
                        {sortTh('invoiceNo', 'Invoice', { title: 'Invoice number (and GRN it is linked to)' })}
                        {sortTh('date', 'Date', { title: 'Invoice date' })}
                        {(tab === 'matched' || tab === 'mismatch' || tab === 'onlyIn2B') && (
                          <>
                            {sortTh('b2bTaxable', '2B Taxable', { right: true, title: 'Taxable value as parsed from the GSTR-2B file uploaded from the GST portal' })}
                            {sortTh('b2bTax', '2B Tax', { right: true, title: 'Total GST (CGST + SGST + IGST) from the GSTR-2B file — this is the ITC you can claim' })}
                          </>
                        )}
                        {(tab === 'matched' || tab === 'mismatch' || tab === 'onlyInBooks') && (
                          <>
                            {sortTh('bookTaxable', 'Book Taxable', { right: true, title: 'Taxable value recorded in your GRN (books)' })}
                            {sortTh('bookTax', 'Book Tax', { right: true, title: 'Total GST recorded in your GRN (books) — CGST + SGST + IGST' })}
                          </>
                        )}
                        {tab === 'mismatch' && (
                          <>
                            {sortTh('taxableDiff', 'Taxable Diff', { right: true, cls: 'text-amber-700', title: 'Book Taxable − 2B Taxable. Positive = your book value is higher than GSTR-2B' })}
                            {sortTh('taxDiff', 'Tax Diff', { right: true, cls: 'text-amber-700', title: 'Book Tax − 2B Tax. Positive = your book tax is higher than GSTR-2B. Claim only the 2B amount.' })}
                            {sortTh('reason', 'Reason', { cls: 'text-amber-700', title: 'Why this invoice is mismatched' })}
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {shownRows.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">
                            No invoices match these filters.{' '}
                            <button onClick={resetFilters} className="text-[#1B4F8A] hover:underline">Clear filters</button>
                          </td>
                        </tr>
                      )}
                      {shownRows.map((r, i) => (
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
                            {r.grnNumber && <div className="text-xs text-gray-400 mt-0.5 font-mono">{r.grnNumber}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                            {fmtDate(r.invoiceDate)}
                            {r.period && r.period !== monthKey(r.invoiceDate) && (
                              <div className="text-[10px] text-blue-600" title="The supplier reported this invoice in a later month than its date">
                                in {periodLabel(r.period)} 2B
                              </div>
                            )}
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
