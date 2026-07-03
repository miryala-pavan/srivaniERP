'use client';

import { useState, useCallback } from 'react';
import { Download, FileJson, Loader2, AlertCircle, Info, CheckCircle, AlertTriangle, Share2, Copy, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import toast from 'react-hot-toast';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaxRow { taxable: number; cgst: number; sgst: number; igst: number; cess: number }

interface PreflightData {
  period: string;
  businessGstin: string | null;
  businessState: string | null;
  errors: string[];
  warnings: string[];
  productsWithoutHsn: string[];
  crossPeriodVoids: number;
  isReadyToFile: boolean;
}

interface IneligibleDisclosure {
  cgst: number; sgst: number; igst: number; cess: number; total: number; note: string;
}

interface GSTR3BData {
  period: string;
  outwardSupplies: { b2b: TaxRow; b2c: TaxRow; total: TaxRow };
  interStateUnregistered: TaxRow;
  reverseCharge: { cgst: number; sgst: number; igst: number; note?: string };
  itcAvailable:  {
    fromPurchases: Omit<TaxRow,'taxable'> & { total: number };
    eligible: Omit<TaxRow,'taxable'> & { total: number };
    ineligibleDisclosure?: IneligibleDisclosure;
  };
  netPayable:    Omit<TaxRow,'taxable'> & { total: number };
  creditLedger:  {
    openingBalance: number;
    openingBalanceNote: string;
    itcClaimed: number;
    itcUsed: number;
    closingBalance: number;
    netPayableAfterOpening: number;
  };
}

interface ItemByRate { num: number; rt: number; txval: number; camt: number; samt: number; iamt: number; csamt: number }

interface B2BBill {
  billNumber: string; billDate: string; customerName: string; customerGstin: string;
  supplyStateCode: string; isInterState: boolean; billType: string;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; grandTotal: number;
  itemsByRate: ItemByRate[];
}

interface B2CLGroup {
  pos: string;
  invoices: { inum: string; idt: string; val: number; itemsByRate: ItemByRate[] }[];
}

interface B2CSGroup {
  splyTp: string; pos: string; gstRate: number;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; count: number;
}

interface HsnRow {
  hsnCode: string; description: string; uom: string; gstRate: number; totalQty: number;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; totalTax: number;
}

interface SalesData {
  period: string;
  bizStateCode: string;
  b2b:  B2BBill[];
  b2cl: B2CLGroup[];
  b2cs: B2CSGroup[];
  hsnSummary: HsnRow[];
  totals: {
    totalBills: number; totalTaxable: number;
    totalCgst: number; totalSgst: number; totalIgst: number; totalCess: number; totalGrandTotal: number;
    b2bCount: number; b2clCount: number; b2csCount: number;
  };
}

interface PurchaseRow {
  grnNumber: string; grnDate: string; supplierName: string; supplierGstin: string;
  invoiceNumber: string; invoiceDate: string; isInterState: boolean; itcEligibility: string;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number;
  totalAmount: number; itcClaimed: number;
}

interface PurchaseData {
  period: string;
  purchases: PurchaseRow[];
  summary: {
    totalPurchases: number; totalTaxable: number;
    eligibleITC: number; ineligibleITC: number;
    cgstITC: number; sgstITC: number; igstITC: number; cessITC: number;
  };
}

interface InwardRow {
  supplierGstin: string; supplierName: string; transactionType: string;
  invoiceNumber: string; invoiceDate: string; invoiceValue: number;
  gstRate: number; cessRate: number; taxableValue: number;
  igstAmount: number; cgstAmount: number; sgstAmount: number; cessAmount: number;
  placeOfSupply: string; itcEligibility: string; isInterState: boolean;
}

interface InwardData {
  period: string;
  businessGstin: string;
  businessName: string;
  rows: InwardRow[];
  summary: {
    totalGrns: number; totalRows: number;
    eligibleGrns: number; eligibleTaxable: number; eligibleCgst: number; eligibleSgst: number; eligibleIgst: number; eligibleCess: number; eligibleITC: number;
    exemptGrns: number; exemptTaxable: number;
    ineligibleGrns: number; ineligibleTaxable: number; ineligibleITC: number;
  };
}

interface TrendMonth {
  month: number; year: number; period: string; shortPeriod: string;
  taxableOutward: number; totalTaxOut: number; billCount: number;
  eligibleITC: number; grnCount: number; netPayable: number;
}
interface TrendData {
  fyYear: number; fyLabel: string;
  months: TrendMonth[];
  totals: { taxableOutward: number; totalTaxOut: number; eligibleITC: number; netPayable: number; billCount: number; grnCount: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

async function downloadBlob(url: string, filename: string, params: object) {
  const res  = await api.get(url, { params, responseType: 'blob' });
  const blob = new Blob([res.data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadJSON(data: object, filename: string) {
  // Strip _meta before downloading (it's for UI only, not part of portal upload)
  const { _meta: _, ...portalData } = data as any;
  const blob = new Blob([JSON.stringify(portalData, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex items-center align-middle ml-1">
      <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-normal text-left shadow-lg">
        {children}
      </span>
    </span>
  );
}

function TaxCell({ n, bold }: { n: number; bold?: boolean }) {
  return (
    <td className={`text-right px-3 py-2 text-sm tabular-nums ${bold ? 'font-semibold' : ''}`}>
      {inr(n)}
    </td>
  );
}

function SectionDivider({ label, sub }: { label: string; sub?: string }) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={6} className="px-3 py-1.5">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{label}</span>
        {sub && <span className="text-xs text-gray-400 ml-2">{sub}</span>}
      </td>
    </tr>
  );
}

function Gstr3bRow({ label, row, isTotal }: {
  label: string;
  row: Partial<TaxRow> & { total?: number };
  isTotal?: boolean;
}) {
  return (
    <tr className={isTotal ? 'bg-gray-50 font-semibold' : ''}>
      <td className="px-3 py-2 text-sm text-gray-700">{label}</td>
      {row.taxable !== undefined && <TaxCell n={row.taxable} bold={isTotal} />}
      <TaxCell n={row.cgst ?? 0} bold={isTotal} />
      <TaxCell n={row.sgst ?? 0} bold={isTotal} />
      <TaxCell n={row.igst ?? 0} bold={isTotal} />
      <TaxCell n={row.cess ?? 0} bold={isTotal} />
      {row.total !== undefined && (
        <td className="text-right px-3 py-2 text-sm tabular-nums">{inr(row.total)}</td>
      )}
    </tr>
  );
}

// ── Preflight Panel ───────────────────────────────────────────────────────────

function PreflightPanel({ data }: { data: PreflightData }) {
  const [expanded, setExpanded] = useState(data.errors.length > 0 || data.warnings.length > 0);

  if (data.errors.length === 0 && data.warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span><strong>Pre-filing check passed</strong> — All data is valid. GSTR-1 JSON is ready for portal upload.</span>
        <span className="ml-auto text-xs text-green-600 font-mono">{data.businessGstin}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${data.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left"
      >
        {data.errors.length > 0
          ? <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          : <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
        }
        <span className={`font-semibold ${data.errors.length > 0 ? 'text-red-700' : 'text-amber-700'}`}>
          {data.errors.length > 0
            ? `${data.errors.length} error(s) must be fixed before filing`
            : `${data.warnings.length} warning(s) — review before filing`
          }
        </span>
        <span className="ml-auto text-xs text-gray-400">{expanded ? 'Hide ▲' : 'Show ▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {data.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-red-700">
              <span className="mt-0.5 shrink-0">✕</span>
              <span>{e}</span>
            </div>
          ))}
          {data.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-amber-700">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{w}</span>
            </div>
          ))}
          {data.productsWithoutHsn.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-amber-600 cursor-pointer font-medium">
                Products without HSN ({data.productsWithoutHsn.length})
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                {data.productsWithoutHsn.map((p, i) => (
                  <div key={i} className="text-xs text-gray-600 pl-2">• {p}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'gstr3b' | 'sales' | 'purchase' | 'hsn' | 'inward' | 'trend';
type SalesFilter = 'all' | 'b2b' | 'b2cl' | 'b2cs';

export default function GstReportsPage() {
  const now = new Date();
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [year,   setYear]   = useState(now.getFullYear());
  const [tab,    setTab]    = useState<Tab>('gstr3b');
  const [filter, setFilter] = useState<SalesFilter>('all');

  const [loading3b,        setLoading3b]        = useState(false);
  const [loadingSales,     setLoadingSales]      = useState(false);
  const [loadingPurch,     setLoadingPurch]      = useState(false);
  const [loadingPreflight, setLoadingPreflight]  = useState(false);
  const [loadingInward,    setLoadingInward]     = useState(false);
  const [loadingTrend,     setLoadingTrend]      = useState(false);

  const [gstr3b,     setGstr3b]     = useState<GSTR3BData | null>(null);
  const [salesData,  setSalesData]  = useState<SalesData | null>(null);
  const [purchData,  setPurchData]  = useState<PurchaseData | null>(null);
  const [preflight,  setPreflight]  = useState<PreflightData | null>(null);
  const [inwardData, setInwardData] = useState<InwardData | null>(null);
  const [trendData,  setTrendData]  = useState<TrendData | null>(null);
  const [error,      setError]      = useState('');
  const [shareLink,  setShareLink]  = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const params = { month, year };

  // FY year: if month >= 4, fy = year; else fy = year-1  (Apr 2026 = FY2026)
  const fyYear = month >= 4 ? year : year - 1;

  const generate = useCallback(async () => {
    setError('');
    setGstr3b(null); setSalesData(null); setPurchData(null); setPreflight(null);
    setInwardData(null); setTrendData(null); setShareLink(null);
    setLoading3b(true); setLoadingSales(true); setLoadingPurch(true);
    setLoadingPreflight(true); setLoadingInward(true); setLoadingTrend(true);

    const [rPre, r3b, rSales, rPurch, rInward, rTrend] = await Promise.allSettled([
      api.get<PreflightData>('/reports/gst/preflight',           { params }),
      api.get<GSTR3BData>('/reports/gst/gstr3b',                 { params }),
      api.get<SalesData> ('/reports/gst/sales-register',         { params }),
      api.get<PurchaseData>('/reports/gst/purchase-register',    { params }),
      api.get<InwardData>('/reports/gst/inward-supplies',        { params }),
      api.get<TrendData>('/reports/gst/trend',                   { params: { fyYear } }),
    ]);

    if (rPre.status    === 'fulfilled') setPreflight(rPre.value.data);
    setLoadingPreflight(false);

    if (r3b.status     === 'fulfilled') setGstr3b(r3b.value.data);
    else setError('Failed to load GSTR-3B data');
    setLoading3b(false);

    if (rSales.status  === 'fulfilled') setSalesData(rSales.value.data);
    setLoadingSales(false);

    if (rPurch.status  === 'fulfilled') setPurchData(rPurch.value.data);
    setLoadingPurch(false);

    if (rInward.status === 'fulfilled') setInwardData(rInward.value.data);
    setLoadingInward(false);

    if (rTrend.status  === 'fulfilled') setTrendData(rTrend.value.data);
    setLoadingTrend(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  async function handleShare() {
    try {
      const res = await api.post('/reports/gst/share-link', { expiryDays: 30 });
      const { token } = res.data;
      const url = `${window.location.origin}/gst-public?token=${token}&month=${month}&year=${year}`;
      setShareLink(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      toast.success('Link copied to clipboard — valid 30 days');
      setTimeout(() => setShareCopied(false), 3000);
    } catch {
      toast.error('Failed to generate share link. Please try again.');
    }
  }

  const yearRange = [2024, 2025, 2026, 2027];

  const TABS: { id: Tab; label: string; tip: string }[] = [
    { id: 'gstr3b',   label: 'GSTR-3B Summary',          tip: 'Monthly tax summary filed on the GST portal. Shows outward tax collected, ITC available, and net cash to pay.' },
    { id: 'sales',    label: 'Sales Register',            tip: 'All sales bills for the period split into B2B (with GSTIN), B2C Large (inter-state >₹2.5L), and B2C Small (rest). Used to prepare GSTR-1.' },
    { id: 'purchase', label: 'Purchase Register',         tip: 'All approved GRNs for the period with ITC eligibility. Cross-verify with GSTR-2B on the portal before claiming ITC in GSTR-3B.' },
    { id: 'hsn',      label: 'HSN + GSTR-1',             tip: 'HSN-wise summary of all outward supplies (Table 12 of GSTR-1). Also download the GSTR-1 JSON for direct portal upload.' },
    { id: 'inward',   label: 'Inward Supplies (GSTR-2)', tip: 'Rate-wise inward supplies in GSTR-2 format. One row per GST rate slab per invoice. Classifies ITC as Eligible, Exempt, or Blocked under Sec 17(5).' },
    { id: 'trend',    label: 'FY Trend Dashboard',        tip: 'Full financial year (April–March) view. See month-wise taxable sales, ITC claimed, and net GST payable in a chart and table.' },
  ];

  const hasData = gstr3b || salesData || purchData || inwardData || trendData;
  const period  = gstr3b?.period ?? salesData?.period ?? purchData?.period ?? inwardData?.period ?? '';

  return (
    <>
      <Header title="GST Reports" />
      <main className="flex-1 p-6 space-y-5">

        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports',   href: '/dashboard/reports' },
          { label: 'GST Reports' },
        ]} />

        {/* Compliance note */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              Reports comply with <strong>GSTR-1 v GST3.0.4</strong> schema. Opening ITC balance is auto-computed from April 1 of the financial year.
              GSTR-1 JSON is validated before download. Credit notes for cross-period voided bills are generated automatically.
            </p>
            <p className="text-blue-500">
              <strong>GST Financial Year:</strong> April to March (e.g. April 2025 – March 2026 = FY 2025-26).
              Monthly returns (GSTR-1 &amp; GSTR-3B) are due by the 11th and 20th of the following month respectively.
              GSTR-2B (auto-populated ITC statement) is available on the portal after the 14th.
            </p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Month
                <Tip>Select the GST return month. GSTR-1 is due by the 11th and GSTR-3B by the 20th of the following month.</Tip>
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#1B4F8A]"
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Year
                <Tip>Calendar year of the return month. For April 2025, select Year 2025. The FY Trend tab will automatically show the full April 2025 – March 2026 financial year.</Tip>
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#1B4F8A]"
              >
                {yearRange.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button
              onClick={generate}
              disabled={loading3b || loadingSales || loadingPurch || loadingInward || loadingTrend || loadingPreflight}
              title="Loads all 6 report tabs for the selected month and year — GSTR-3B, Sales, Purchases, HSN, Inward Supplies, and FY Trend"
              className="px-5 py-2 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {(loading3b || loadingSales || loadingPurch || loadingInward || loadingTrend || loadingPreflight) && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate Reports
            </button>
            {hasData && (
              <button
                onClick={handleShare}
                title="Generates a secure read-only link valid for 30 days. Share it with your CA or auditor — no login required on their end."
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                {shareCopied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
                {shareCopied ? 'Link Copied!' : 'Share with CA'}
              </button>
            )}
            {period && (
              <span className="text-sm text-gray-500 ml-2">
                Period: <span className="font-medium text-gray-800">{period}</span>
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Preflight Panel */}
        {loadingPreflight && (
          <div className="flex items-center gap-2 text-sm text-gray-400 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running pre-filing checks…
          </div>
        )}
        {preflight && <PreflightPanel data={preflight} />}

        {/* Share link banner */}
        {shareLink && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">Share link generated — valid 30 days</p>
              <p className="text-xs text-green-600 truncate mt-0.5">{shareLink}</p>
            </div>
            <button
              onClick={async () => { await navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
              className="flex items-center gap-1 text-xs text-green-700 border border-green-300 rounded px-2 py-1 hover:bg-green-100 shrink-0"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
        )}

        {!hasData && !loading3b && !loadingSales && !loadingPurch && !loadingPreflight && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Select a period and click Generate Reports to view GST data.
          </div>
        )}

        {hasData && (
          <>
            {/* Tab Bar */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
              {TABS.map(({ id, label, tip }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  title={tip}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === id ? 'bg-white text-[#1B4F8A] shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── TAB 1: GSTR-3B Summary ───────────────────────────────────────── */}
            {tab === 'gstr3b' && (
              <div className="space-y-4">
                {loading3b ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading GSTR-3B…
                  </div>
                ) : gstr3b ? (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h2 className="font-bold text-gray-900">GSTR-3B Summary</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Period: {gstr3b.period} · Monthly self-assessed return filed on the GST portal</p>
                    </div>

                    {/* How to read GSTR-3B */}
                    <details className="border-b border-gray-100">
                      <summary className="px-5 py-2.5 text-xs text-blue-700 cursor-pointer select-none flex items-center gap-1.5 hover:bg-blue-50">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" /> How to read this report
                      </summary>
                      <div className="px-5 pb-4 pt-2 text-xs text-gray-600 space-y-2 bg-blue-50">
                        <p><strong>Section 3.1 — Outward Taxable Supplies:</strong> Total tax collected on sales.
                           B2B = sales to businesses with GSTIN (reported invoice-wise in GSTR-1 Table 4).
                           B2C = sales to consumers without GSTIN (reported consolidated).</p>
                        <p><strong>CGST + SGST</strong> apply to intra-state sales (buyer and seller in the same state).
                           <strong>IGST</strong> applies to inter-state sales (buyer in a different state). Never both at the same time.</p>
                        <p><strong>Section 4 — ITC Available:</strong> Input Tax Credit you can deduct from your tax liability.
                           Only purchases with ELIGIBLE ITC status are included. CGST credit offsets CGST liability, SGST offsets SGST, IGST can offset all three heads.</p>
                        <p><strong>Net Payable:</strong> Tax Collected − ITC = cash you owe to the government for this period.</p>
                        <p><strong>Cash to Pay After Opening ITC:</strong> Net Payable minus any leftover ITC balance carried forward from prior months.</p>
                        <p><strong>Section 4D(2) — Ineligible ITC:</strong> Tax paid on blocked purchases (vehicles, food, personal use items under Section 17(5)).
                           This must be disclosed in GSTR-3B but cannot be claimed as credit.</p>
                      </div>
                    </details>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#1B4F8A] text-white text-xs">
                            <th className="text-left px-3 py-2.5 w-64">Description</th>
                            <th className="text-right px-3 py-2.5">
                              Taxable
                              <Tip>Value of goods/services before adding GST. This is the base amount on which tax is calculated.</Tip>
                            </th>
                            <th className="text-right px-3 py-2.5">
                              CGST
                              <Tip>Central GST — half the applicable GST rate, collected by the Central Government. Applies only to intra-state (within Andhra Pradesh) transactions.</Tip>
                            </th>
                            <th className="text-right px-3 py-2.5">
                              SGST
                              <Tip>State GST — other half of the applicable GST rate, collected by the Andhra Pradesh Government. Applies only to intra-state transactions.</Tip>
                            </th>
                            <th className="text-right px-3 py-2.5">
                              IGST
                              <Tip>Integrated GST — full GST rate applied to inter-state transactions (buyer in a different state). Replaces CGST+SGST for cross-state sales/purchases.</Tip>
                            </th>
                            <th className="text-right px-3 py-2.5">
                              CESS
                              <Tip>Compensation Cess — extra levy on certain goods (tobacco, luxury cars, aerated drinks) over and above GST. Most FMCG products have 0 cess.</Tip>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <SectionDivider label="3.1  Outward Taxable Supplies" sub="All sales bills for the period" />
                          <Gstr3bRow label="(a) B2B — with GSTIN"    row={gstr3b.outwardSupplies.b2b} />
                          <tr><td colSpan={6} className="px-3 pb-1 text-[10px] text-gray-400 italic">Sales to businesses or dealers with a valid GSTIN. Reported invoice-by-invoice in GSTR-1 Table 4. Buyer can claim ITC on these.</td></tr>
                          <Gstr3bRow label="(a) B2C — without GSTIN" row={gstr3b.outwardSupplies.b2c} />
                          <tr><td colSpan={6} className="px-3 pb-1 text-[10px] text-gray-400 italic">Sales to consumers/retailers without GSTIN. Reported consolidated. No ITC available to the buyer.</td></tr>
                          <Gstr3bRow label="Total Outward"           row={gstr3b.outwardSupplies.total} isTotal />

                          <SectionDivider label="3.1(d)  Reverse Charge" sub="RCM — buyer pays tax directly to govt instead of seller" />
                          <tr>
                            <td className="px-3 py-2 text-sm text-gray-500 italic" colSpan={6}>
                              CGST ₹{inr(gstr3b.reverseCharge.cgst)}  SGST ₹{inr(gstr3b.reverseCharge.sgst)}  IGST ₹{inr(gstr3b.reverseCharge.igst)}
                              {gstr3b.reverseCharge.note && <span className="text-orange-600 ml-2">— {gstr3b.reverseCharge.note}</span>}
                            </td>
                          </tr>

                          <SectionDivider label="3.2  Inter-State to Unregistered" sub="(informational)" />
                          <Gstr3bRow label="Inter-state B2C" row={gstr3b.interStateUnregistered} />

                          <SectionDivider label="4.  Eligible ITC" sub="Input Tax Credit you can set off against your tax liability" />
                          <tr><td colSpan={6} className="px-3 pb-1 text-[10px] text-gray-400 italic">ITC = tax paid on purchases that you can deduct from tax collected on sales. Only ELIGIBLE purchases qualify. Cannot use CGST credit against SGST liability or vice versa — but IGST credit can offset any head.</td></tr>
                          <tr>
                            <td className="px-3 py-2 text-sm text-gray-700">From Purchases (verify with GSTR-2B)</td>
                            <td className="px-3 py-2" />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.cgst} />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.sgst} />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.igst} />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.cess} />
                          </tr>
                          <tr className="bg-gray-50 font-semibold">
                            <td className="px-3 py-2 text-sm text-gray-700">Total ITC Available</td>
                            <td className="px-3 py-2" />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cgst} bold />
                            <TaxCell n={gstr3b.itcAvailable.eligible.sgst} bold />
                            <TaxCell n={gstr3b.itcAvailable.eligible.igst} bold />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cess} bold />
                          </tr>
                          {gstr3b.itcAvailable.ineligibleDisclosure && gstr3b.itcAvailable.ineligibleDisclosure.total > 0 && (
                            <tr className="bg-amber-50">
                              <td className="px-3 py-2 text-xs text-amber-700">
                                4(D)(2) Ineligible ITC — Sec 17(5) <span className="text-amber-500 ml-1">(disclosure only, not deducted)</span>
                              </td>
                              <td className="px-3 py-2 text-right text-xs text-amber-700 tabular-nums">
                                ₹{gstr3b.itcAvailable.ineligibleDisclosure.total.toFixed(2)}
                              </td>
                              <TaxCell n={gstr3b.itcAvailable.ineligibleDisclosure.cgst} />
                              <TaxCell n={gstr3b.itcAvailable.ineligibleDisclosure.sgst} />
                              <TaxCell n={gstr3b.itcAvailable.ineligibleDisclosure.igst} />
                              <TaxCell n={gstr3b.itcAvailable.ineligibleDisclosure.cess} />
                            </tr>
                          )}

                          <SectionDivider label="Net GST Payable" />
                          <tr>
                            <td className="px-3 py-2 text-sm text-gray-700">Tax Collected</td>
                            <td />
                            <TaxCell n={gstr3b.outwardSupplies.total.cgst} />
                            <TaxCell n={gstr3b.outwardSupplies.total.sgst} />
                            <TaxCell n={gstr3b.outwardSupplies.total.igst} />
                            <TaxCell n={gstr3b.outwardSupplies.total.cess} />
                          </tr>
                          <tr>
                            <td className="px-3 py-2 text-sm text-gray-700">Less: ITC this period</td>
                            <td />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cgst} />
                            <TaxCell n={gstr3b.itcAvailable.eligible.sgst} />
                            <TaxCell n={gstr3b.itcAvailable.eligible.igst} />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cess} />
                          </tr>
                          <tr className={`font-bold ${gstr3b.netPayable.total > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <td className="px-3 py-2 text-sm">Net Payable (this period)</td>
                            <td />
                            <td className="text-right px-3 py-2 tabular-nums">{inr(gstr3b.netPayable.cgst)}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{inr(gstr3b.netPayable.sgst)}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{inr(gstr3b.netPayable.igst)}</td>
                            <td className="text-right px-3 py-2 tabular-nums">{inr(gstr3b.netPayable.cess)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Net Payable Banner */}
                    <div className="mx-5 my-4 grid grid-cols-2 gap-4">
                      <div className={`rounded-xl p-5 text-center ${
                        gstr3b.netPayable.total > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                      }`}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                          Net GST (this period) — {gstr3b.period}
                          <Tip>Tax collected on sales minus eligible ITC for this month. If positive (red), you owe this to the government. If zero or negative (green), your ITC covers your full liability this month.</Tip>
                        </p>
                        <p className={`text-3xl font-bold ${gstr3b.netPayable.total > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          ₹{inr(gstr3b.netPayable.total)}
                        </p>
                      </div>
                      <div className={`rounded-xl p-5 text-center ${
                        gstr3b.creditLedger.netPayableAfterOpening > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'
                      }`}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 flex items-center justify-center gap-1">
                          Cash to Pay After Opening ITC
                          <Tip>Net Payable minus the opening ITC balance carried forward from previous months. This is the actual cash you need to deposit via Challan (PMT-06) on the GST portal before the 20th.</Tip>
                        </p>
                        <p className={`text-3xl font-bold ${gstr3b.creditLedger.netPayableAfterOpening > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                          ₹{inr(gstr3b.creditLedger.netPayableAfterOpening)}
                        </p>
                      </div>
                    </div>

                    {/* ITC Credit Ledger */}
                    <div className="px-5 pb-5">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                        ITC Credit Ledger
                        <Tip>Your Electronic Credit Ledger on the GST portal. Tracks how much ITC you have accumulated vs. used. Closing balance carries forward to the next month.</Tip>
                      </h3>
                      <p className="text-[10px] text-gray-400 mb-3">ITC flows: Opening balance + ITC claimed this period − ITC used to pay tax = Closing balance</p>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Opening Balance', tip: 'Total unused ITC accumulated from all prior months of this financial year (April onwards). Auto-computed from all GRNs before this period.', value: gstr3b.creditLedger.openingBalance, note: gstr3b.creditLedger.openingBalanceNote },
                          { label: 'ITC Claimed',     tip: 'Eligible ITC from GRNs approved this month — tax paid to suppliers that you are now claiming as credit.', value: gstr3b.creditLedger.itcClaimed },
                          { label: 'ITC Used',        tip: 'Portion of ITC applied against your outward tax liability for this period. IGST credit is used first, then CGST against CGST, SGST against SGST.', value: gstr3b.creditLedger.itcUsed },
                          { label: 'Closing Balance', tip: 'Remaining unused ITC carried forward to next month. If positive, you do not need to pay cash next month until this is exhausted.', value: gstr3b.creditLedger.closingBalance },
                        ].map(({ label, tip, value, note }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide flex items-center gap-0.5">
                              {label}<Tip>{tip}</Tip>
                            </p>
                            {note && <p className="text-[9px] text-blue-500">{note}</p>}
                            <p className="text-base font-semibold text-gray-900 mt-0.5">₹{inr(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No transactions found for this period.</p>
                )}
              </div>
            )}

            {/* ── TAB 2: Sales Register ────────────────────────────────────────── */}
            {tab === 'sales' && (
              <div className="space-y-4">
                {loadingSales ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Sales Register…
                  </div>
                ) : salesData ? (
                  <>
                    {/* How to read Sales Register */}
                    <details className="bg-blue-50 border border-blue-200 rounded-lg">
                      <summary className="px-4 py-2.5 text-xs text-blue-700 cursor-pointer select-none flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" /> How to read this report
                      </summary>
                      <div className="px-4 pb-3 pt-1 text-xs text-gray-600 space-y-1.5">
                        <p><strong>B2B (Business-to-Business):</strong> Sales to buyers who gave their GSTIN. Each invoice is reported individually in GSTR-1 Table 4. Your buyer can claim ITC on these purchases.</p>
                        <p><strong>B2C Large:</strong> Sales to consumers without GSTIN, but the invoice is inter-state and value exceeds ₹2.5 lakh. Reported individually in GSTR-1 Table 5.</p>
                        <p><strong>B2C Small:</strong> All remaining consumer sales — intra-state B2C of any value, and inter-state B2C ≤₹2.5L. Consolidated by state and GST rate in GSTR-1 Table 7.</p>
                        <p><strong>Inter-state (IGST):</strong> Buyer's state ≠ your state (Andhra Pradesh). Full GST rate as IGST. <strong>Intra-state (CGST+SGST):</strong> Buyer's state = Andhra Pradesh. Tax split equally between Centre and State.</p>
                        <p><strong>POS (Place of Supply):</strong> The state where the supply is deemed to occur. For goods, typically where goods are delivered. Determines whether IGST or CGST+SGST applies.</p>
                      </div>
                    </details>

                    {/* Controls */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {([
                          { id: 'all',  label: `All (${salesData.totals.totalBills})`,          tip: 'Show all sales invoices' },
                          { id: 'b2b',  label: `B2B (${salesData.totals.b2bCount})`,            tip: 'Sales to registered businesses with GSTIN — GSTR-1 Table 4' },
                          { id: 'b2cl', label: `B2C Large (${salesData.totals.b2clCount})`,     tip: 'Inter-state sales >₹2.5L to unregistered buyers — GSTR-1 Table 5' },
                          { id: 'b2cs', label: `B2C Small (${salesData.totals.b2csCount})`,     tip: 'All other consumer sales — consolidated by state+rate — GSTR-1 Table 7' },
                        ] as { id: SalesFilter; label: string; tip: string }[]).map(({ id, label, tip }) => (
                          <button
                            key={id}
                            onClick={() => setFilter(id)}
                            title={tip}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filter === id ? 'bg-white text-[#1B4F8A] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadBlob('/reports/gst/sales-register/excel', `Sales_Register_${MONTH_ABBR[month-1]}_${year}.xlsx`, params)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          <Download className="w-3.5 h-3.5" /> Excel
                        </button>
                        <button
                          onClick={() => downloadJSON(salesData, `Sales_Register_${MONTH_ABBR[month-1]}_${year}.json`)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          <FileJson className="w-3.5 h-3.5" /> JSON
                        </button>
                      </div>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-5 gap-3">
                      {[
                        { label: 'Total Bills',   tip: 'Total invoices issued this month across all categories (B2B + B2C Large + B2C Small).', value: salesData.totals.totalBills,      isCount: true },
                        { label: 'Total Taxable', tip: 'Sum of taxable value across all invoices — the base amount before adding GST. This goes into GSTR-3B Section 3.1 Taxable column.', value: salesData.totals.totalTaxable },
                        { label: 'CGST+SGST',     tip: 'Total intra-state (within AP) tax — split equally between Central (CGST) and State (SGST). These are collected from local buyers.', value: salesData.totals.totalCgst + salesData.totals.totalSgst },
                        { label: 'Total IGST',    tip: 'Total inter-state tax collected from buyers outside Andhra Pradesh. IGST goes fully to the Centre initially, then apportioned to the destination state.', value: salesData.totals.totalIgst },
                        { label: 'Grand Total',   tip: 'Taxable value + all taxes (CGST+SGST+IGST+CESS). This matches the invoice total your customers paid.', value: salesData.totals.totalGrandTotal },
                      ].map(({ label, tip, value, isCount }) => (
                        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 flex items-center gap-0.5">{label}<Tip>{tip}</Tip></p>
                          <p className="text-lg font-bold text-gray-900 mt-0.5">
                            {isCount ? value : `₹${inr(value as number)}`}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* B2B Table */}
                    {(filter === 'all' || filter === 'b2b') && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-800">Table 4 — B2B Invoices ({salesData.b2b.length})</h3>
                          <p className="text-xs text-gray-400 mt-0.5">Invoices to registered businesses with GSTIN</p>
                        </div>
                        {salesData.b2b.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">No B2B invoices.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                <tr>
                                  {['Date','Bill No','Customer','GSTIN','POS','Inter?','Taxable','CGST','SGST','IGST','CESS','Total'].map((h) => (
                                    <th key={h} className={`px-3 py-2 font-semibold ${['Date','Bill No','Customer','GSTIN','POS','Inter?'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {salesData.b2b.map((b) => (
                                  <tr key={b.billNumber} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-600">{fmtDate(b.billDate)}</td>
                                    <td className="px-3 py-2 font-mono text-gray-900">{b.billNumber}</td>
                                    <td className="px-3 py-2 text-gray-800 max-w-[120px] truncate">{b.customerName}</td>
                                    <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{b.customerGstin}</td>
                                    <td className="px-3 py-2 text-gray-500">{b.supplyStateCode}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${b.isInterState ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {b.isInterState ? 'IGST' : 'CGST'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.taxableAmount)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.cgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.sgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.igst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.cess)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-medium">{inr(b.grandTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-50 font-semibold text-xs text-gray-700">
                                <tr>
                                  <td colSpan={6} className="px-3 py-2">Total ({salesData.b2b.length} bills)</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2b.reduce((s,b)=>s+b.taxableAmount,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2b.reduce((s,b)=>s+b.cgst,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2b.reduce((s,b)=>s+b.sgst,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2b.reduce((s,b)=>s+b.igst,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2b.reduce((s,b)=>s+b.cess,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2b.reduce((s,b)=>s+b.grandTotal,0))}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* B2CL Table */}
                    {(filter === 'all' || filter === 'b2cl') && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-800">Table 5 — B2C Large ({salesData.totals.b2clCount} invoices)</h3>
                          <p className="text-xs text-gray-400 mt-0.5">Inter-state invoices to unregistered persons where invoice value &gt; ₹2.5 lakh — reported individually</p>
                        </div>
                        {salesData.b2cl.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">No B2C Large invoices.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                <tr>
                                  {['POS','Invoice No','Date','Invoice Value','GST Rate','Taxable','IGST','CESS'].map((h) => (
                                    <th key={h} className={`px-3 py-2 font-semibold ${['POS','Invoice No','Date'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {salesData.b2cl.flatMap((grp) =>
                                  grp.invoices.flatMap((inv) =>
                                    inv.itemsByRate.map((item, j) => (
                                      <tr key={`${inv.inum}-${j}`} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-gray-600">{grp.pos}</td>
                                        <td className="px-3 py-2 font-mono text-gray-900">{inv.inum}</td>
                                        <td className="px-3 py-2 text-gray-600">{inv.idt}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-medium">{inr(inv.val)}</td>
                                        <td className="px-3 py-2 text-right">{item.rt}%</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{inr(item.txval)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{inr(item.camt + item.samt + item.iamt)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{inr(item.csamt)}</td>
                                      </tr>
                                    ))
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* B2CS Table */}
                    {(filter === 'all' || filter === 'b2cs') && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-800">Table 7 — B2C Small ({salesData.b2cs.length} groups)</h3>
                          <p className="text-xs text-gray-400 mt-0.5">Intra-state B2C + inter-state ≤ ₹2.5L — consolidated by supply type, state and GST rate</p>
                        </div>
                        {salesData.b2cs.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">No B2C Small invoices.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                <tr>
                                  {['Supply Type','POS','GST Rate','Taxable','CGST','SGST','IGST','CESS','Invoices'].map((h) => (
                                    <th key={h} className={`px-3 py-2 font-semibold ${['Supply Type','POS'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {salesData.b2cs.map((b, i) => (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${b.splyTp === 'INTRA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {b.splyTp}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">{b.pos}</td>
                                    <td className="px-3 py-2 text-right">{b.gstRate}%</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.taxableAmount)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.cgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.sgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.igst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.cess)}</td>
                                    <td className="px-3 py-2 text-right">{b.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-50 font-semibold text-xs text-gray-700">
                                <tr>
                                  <td colSpan={3} className="px-3 py-2">Total</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2cs.reduce((s,b)=>s+b.taxableAmount,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2cs.reduce((s,b)=>s+b.cgst,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2cs.reduce((s,b)=>s+b.sgst,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2cs.reduce((s,b)=>s+b.igst,0))}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.b2cs.reduce((s,b)=>s+b.cess,0))}</td>
                                  <td className="px-3 py-2 text-right">{salesData.b2cs.reduce((s,b)=>s+b.count,0)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No sales data.</p>
                )}
              </div>
            )}

            {/* ── TAB 3: Purchase Register ─────────────────────────────────────── */}
            {tab === 'purchase' && (
              <div className="space-y-4">
                {loadingPurch ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Purchase Register…
                  </div>
                ) : purchData ? (
                  <>
                    {/* How to read Purchase Register */}
                    <details className="bg-blue-50 border border-blue-200 rounded-lg">
                      <summary className="px-4 py-2.5 text-xs text-blue-700 cursor-pointer select-none flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" /> How to read this report
                      </summary>
                      <div className="px-4 pb-3 pt-1 text-xs text-gray-600 space-y-1.5">
                        <p><strong>GRN (Goods Receipt Note):</strong> The internal document created when you receive goods from a supplier and approve them. The GRN date determines which month the purchase falls in for ITC.</p>
                        <p><strong>ITC Eligible:</strong> Tax paid on this purchase can be claimed as credit in GSTR-3B Section 4. The supplier must have filed their GSTR-1 and the invoice must appear in your GSTR-2B.</p>
                        <p><strong>ITC Exempt:</strong> Goods are exempt or 0% rated — no GST was charged, so there is nothing to claim.</p>
                        <p><strong>ITC Blocked (Sec 17(5)):</strong> GST was charged but you cannot claim it. Examples: motor vehicles, food &amp; beverages, club memberships, construction materials for own building. Must be disclosed in GSTR-3B Table 4D(2) but cannot be deducted.</p>
                        <p><strong>GSTR-2B:</strong> Auto-populated ITC statement from the portal, generated on the 14th of each month. Always cross-check your eligible ITC amount against GSTR-2B before filing GSTR-3B — claim only what appears there.</p>
                        <p><strong>Invoice No vs GRN No:</strong> Invoice No is the supplier's original bill number. GRN No is your internal receipt number. The portal requires the supplier's Invoice No.</p>
                      </div>
                    </details>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        ⚠ Cross-verify eligible ITC against <strong>GSTR-2B</strong> on the portal (available after the 14th) before filing GSTR-3B. Claim only what appears in GSTR-2B.
                      </div>
                      <button
                        onClick={() => downloadBlob('/reports/gst/purchase-register/excel', `Purchase_Register_${MONTH_ABBR[month-1]}_${year}.xlsx`, params)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Excel
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Total GRNs',     tip: 'Number of Goods Receipt Notes approved in this period. Each GRN = one supplier invoice received and accepted.', value: purchData.summary.totalPurchases, isCount: true },
                        { label: 'Eligible ITC',   tip: 'Total GST you can claim as Input Tax Credit from purchases this period. Enter this in GSTR-3B Section 4 after verifying against GSTR-2B.', value: purchData.summary.eligibleITC },
                        { label: 'Ineligible ITC', tip: 'GST paid on blocked purchases (Sec 17(5)) — vehicles, personal items, food, etc. Must be disclosed in GSTR-3B Table 4D(2) but CANNOT be claimed as credit.', value: purchData.summary.ineligibleITC },
                        { label: 'CGST+SGST ITC',  tip: 'Portion of eligible ITC from intra-state (within AP) purchases. CGST credit offsets CGST liability; SGST credit offsets SGST liability.', value: purchData.summary.cgstITC + purchData.summary.sgstITC },
                      ].map(({ label, tip, value, isCount }) => (
                        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                          <p className="text-xs text-gray-500 flex items-center gap-0.5">{label}<Tip>{tip}</Tip></p>
                          <p className="text-lg font-bold text-gray-900 mt-0.5">{isCount ? value : `₹${inr(value as number)}`}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {purchData.purchases.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No approved GRNs for this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                              <tr>
                                {([
                                  { h: 'GRN Date',    tip: 'Date the goods were received and GRN was approved — this determines the tax period for ITC.' },
                                  { h: 'GRN No',      tip: 'Your internal goods receipt number.' },
                                  { h: 'Supplier',    tip: 'Name of the supplier/vendor.' },
                                  { h: 'GSTIN',       tip: "Supplier's GST Identification Number. Must be valid for you to claim ITC. If blank, supplier is unregistered and ITC is not available." },
                                  { h: 'Invoice No',  tip: "Supplier's original invoice number as printed on their bill. This is what appears in GSTR-2B." },
                                  { h: 'Inter?',      tip: 'IGST = supplier is from another state (inter-state supply). CGST = supplier is from Andhra Pradesh (intra-state supply).' },
                                  { h: 'ITC',         tip: 'ITC eligibility: Eligible = can claim credit · Exempt = 0% goods, no tax to claim · Blocked = Sec 17(5) restricted items, tax paid but cannot claim.' },
                                  { h: 'Taxable',     tip: 'Value of goods before GST.' },
                                  { h: 'CGST',        tip: 'Central GST on intra-state purchases. Claimable as CGST credit against CGST liability.' },
                                  { h: 'SGST',        tip: 'State GST on intra-state purchases. Claimable as SGST credit against SGST liability.' },
                                  { h: 'IGST',        tip: 'Integrated GST on inter-state purchases. Can be used to offset IGST, then CGST, then SGST liability in that order.' },
                                  { h: 'CESS',        tip: 'Compensation Cess on applicable goods. Cess credit can only offset cess liability.' },
                                  { h: 'Total',       tip: 'Taxable + all taxes = total amount paid to supplier.' },
                                  { h: 'ITC Amt',     tip: 'Actual tax amount being claimed as ITC. Zero for blocked/exempt items.' },
                                ] as { h: string; tip: string }[]).map(({ h, tip }) => (
                                  <th key={h} className={`px-3 py-2 font-semibold ${['GRN Date','GRN No','Supplier','GSTIN','Invoice No','Inter?','ITC'].includes(h) ? 'text-left' : 'text-right'}`}>
                                    <span className="inline-flex items-center gap-0.5">{h}<Tip>{tip}</Tip></span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {purchData.purchases.map((p) => (
                                <tr key={p.grnNumber + p.invoiceNumber} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-gray-600">{fmtDate(p.grnDate)}</td>
                                  <td className="px-3 py-2 font-mono text-gray-900">{p.grnNumber || '—'}</td>
                                  <td className="px-3 py-2 text-gray-800 max-w-[110px] truncate">{p.supplierName}</td>
                                  <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{p.supplierGstin || '—'}</td>
                                  <td className="px-3 py-2 font-mono text-gray-600">{p.invoiceNumber}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${p.isInterState ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {p.isInterState ? 'IGST' : 'CGST'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${p.itcEligibility === 'NOT_ELIGIBLE' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                      {p.itcEligibility === 'NOT_ELIGIBLE' ? 'No ITC' : 'Eligible'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(p.taxableAmount)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(p.cgst)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(p.sgst)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(p.igst)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(p.cess)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-medium">{inr(p.totalAmount)}</td>
                                  <td className={`px-3 py-2 text-right tabular-nums ${p.itcEligibility === 'NOT_ELIGIBLE' ? 'text-red-500' : 'text-green-600'}`}>
                                    {p.itcEligibility === 'NOT_ELIGIBLE' ? '—' : inr(p.itcClaimed)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-semibold text-xs text-gray-700">
                              <tr>
                                <td colSpan={7} className="px-3 py-2">Total ({purchData.purchases.length} GRNs)</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(purchData.purchases.reduce((s,p)=>s+p.taxableAmount,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(purchData.purchases.reduce((s,p)=>s+p.cgst,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(purchData.purchases.reduce((s,p)=>s+p.sgst,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(purchData.purchases.reduce((s,p)=>s+p.igst,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(purchData.purchases.reduce((s,p)=>s+p.cess,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(purchData.purchases.reduce((s,p)=>s+p.totalAmount,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-green-600">{inr(purchData.summary.eligibleITC)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No purchase data.</p>
                )}
              </div>
            )}

            {/* ── TAB 4: HSN Summary + GSTR-1 JSON ────────────────────────────── */}
            {tab === 'hsn' && (
              <div className="space-y-4">
                {!salesData ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading HSN Summary…
                  </div>
                ) : (
                  <>
                    {/* How to read HSN tab */}
                    <details className="bg-blue-50 border border-blue-200 rounded-lg">
                      <summary className="px-4 py-2.5 text-xs text-blue-700 cursor-pointer select-none flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" /> How to read this report
                      </summary>
                      <div className="px-4 pb-3 pt-1 text-xs text-gray-600 space-y-1.5">
                        <p><strong>HSN Code (Harmonised System of Nomenclature):</strong> A globally standardised 6–8 digit product classification code. GST law requires HSN codes on invoices above ₹5 crore turnover (4-digit for ₹1.5–5 crore). Every product must have an HSN code assigned in the product master for GSTR-1 filing.</p>
                        <p><strong>UOM (Unit of Measurement):</strong> The unit in which quantity is measured — e.g. NOS (numbers), KGS (kilograms), LTR (litres), MTR (metres). Must use GST-approved codes. GSTR-1 Table 12 requires quantity and UOM per HSN code.</p>
                        <p><strong>UNCLASSIFIED entries:</strong> Products sold without an HSN code assigned in the product master. These are shown here for reference but EXCLUDED from the GSTR-1 JSON. Assign HSN codes to all products to fix this.</p>
                        <p><strong>GSTR-1 JSON:</strong> The file you upload to the GST portal at gst.gov.in → Returns → GSTR-1. Schema version GST3.0.4. Fix all preflight errors before downloading — the portal will reject invalid JSON.</p>
                        <p><strong>Filing workflow:</strong> 1) Fix all preflight errors → 2) Download GSTR-1 JSON → 3) Login to gst.gov.in → 4) Go to Returns → GSTR-1 → File Returns → Upload JSON → 5) Preview and Submit → 6) File with DSC or EVC.</p>
                      </div>
                    </details>

                    <div className="flex justify-end">
                      <button
                        onClick={() => downloadBlob('/reports/gst/sales-register/excel', `HSN_Summary_${MONTH_ABBR[month-1]}_${year}.xlsx`, params)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Excel
                      </button>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">Table 12 — HSN Summary ({salesData.hsnSummary.length} entries)</h3>
                          <p className="text-xs text-gray-400 mt-0.5">One row per HSN code + GST rate. UNCLASSIFIED entries shown here but excluded from GSTR-1 JSON.</p>
                        </div>
                        {salesData.hsnSummary.some(h => h.hsnCode === 'UNCLASSIFIED') && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">
                            {salesData.hsnSummary.filter(h => h.hsnCode === 'UNCLASSIFIED').length} UNCLASSIFIED (excluded from JSON)
                          </span>
                        )}
                      </div>
                      {salesData.hsnSummary.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No HSN data.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                              <tr>
                                {([
                                  { h: 'HSN Code',    tip: 'Harmonised System of Nomenclature code — globally standardised product classification. 4, 6, or 8 digits depending on your turnover slab. Assign in Product Master → Edit Product.' },
                                  { h: 'Description', tip: 'Standard description for this HSN code as per the GST tariff schedule.' },
                                  { h: 'UOM',         tip: 'Unit of Measure as per GST portal codes — NOS (pieces), KGS (kilograms), LTR (litres), MTR (metres), etc.' },
                                  { h: 'GST Rate',    tip: 'GST rate slab applicable to this HSN code — 0%, 5%, 12%, 18%, or 28%. Set per product in the product master.' },
                                  { h: 'Total Qty',   tip: 'Total quantity sold this period for this HSN+rate combination.' },
                                  { h: 'Taxable',     tip: 'Total taxable value (before GST) for this HSN code.' },
                                  { h: 'CGST',        tip: 'Central GST collected on intra-state sales for this HSN.' },
                                  { h: 'SGST',        tip: 'State GST collected on intra-state sales for this HSN.' },
                                  { h: 'IGST',        tip: 'Integrated GST collected on inter-state sales for this HSN.' },
                                  { h: 'CESS',        tip: 'Compensation Cess collected for this HSN (usually 0 for food items).' },
                                  { h: 'Total Tax',   tip: 'CGST + SGST + IGST + CESS — total tax component for this HSN code.' },
                                ] as { h: string; tip: string }[]).map(({ h, tip }) => (
                                  <th key={h} className={`px-3 py-2 font-semibold ${['HSN Code','Description','UOM'].includes(h) ? 'text-left' : 'text-right'}`}>
                                    <span className="inline-flex items-center gap-0.5">{h}<Tip>{tip}</Tip></span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {salesData.hsnSummary.map((h) => (
                                <tr key={`${h.hsnCode}-${h.gstRate}`} className={`hover:bg-gray-50 ${h.hsnCode === 'UNCLASSIFIED' ? 'bg-amber-50' : ''}`}>
                                  <td className="px-3 py-2 font-mono text-gray-900">
                                    {h.hsnCode === 'UNCLASSIFIED'
                                      ? <span className="text-amber-600 italic">UNCLASSIFIED</span>
                                      : h.hsnCode
                                    }
                                  </td>
                                  <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate">{h.description}</td>
                                  <td className="px-3 py-2 text-gray-500">{h.uom}</td>
                                  <td className="px-3 py-2 text-right font-medium">{h.gstRate}%</td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {h.totalQty % 1 === 0 ? h.totalQty : h.totalQty.toFixed(3)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(h.taxableAmount)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(h.cgst)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(h.sgst)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(h.igst)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{inr(h.cess)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-medium">{inr(h.totalTax)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-semibold text-xs text-gray-700">
                              <tr>
                                <td colSpan={5} className="px-3 py-2">Total ({salesData.hsnSummary.length} entries)</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.hsnSummary.reduce((s,h)=>s+h.taxableAmount,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.hsnSummary.reduce((s,h)=>s+h.cgst,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.hsnSummary.reduce((s,h)=>s+h.sgst,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.hsnSummary.reduce((s,h)=>s+h.igst,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.hsnSummary.reduce((s,h)=>s+h.cess,0))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(salesData.hsnSummary.reduce((s,h)=>s+h.totalTax,0))}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* GSTR-1 JSON Download */}
                    <div className={`rounded-xl p-4 flex items-center justify-between gap-4 border ${
                      preflight && !preflight.isReadyToFile
                        ? 'bg-red-50 border-red-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div>
                        <p className={`text-sm font-semibold ${preflight && !preflight.isReadyToFile ? 'text-red-800' : 'text-blue-800'}`}>
                          GSTR-1 JSON — Portal Upload
                        </p>
                        <p className={`text-xs mt-0.5 ${preflight && !preflight.isReadyToFile ? 'text-red-600' : 'text-blue-600'}`}>
                          {preflight && !preflight.isReadyToFile
                            ? 'Fix errors above before downloading'
                            : `Schema: GST3.0.4 · Includes B2B, B2C Large/Small, HSN, Credit Notes, Nil, Doc Issue`
                          }
                        </p>
                      </div>
                      <GstR1DownloadButton
                        month={month}
                        year={year}
                        blocked={!!(preflight && !preflight.isReadyToFile)}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {/* ── TAB 6: FY Trend Dashboard ───────────────────────────────── */}
            {tab === 'trend' && (
              <div className="space-y-4">
                {loadingTrend ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading trend data…
                  </div>
                ) : trendData ? (
                  <>
                    {/* How to read FY Trend */}
                    <details className="bg-blue-50 border border-blue-200 rounded-lg">
                      <summary className="px-4 py-2.5 text-xs text-blue-700 cursor-pointer select-none flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" /> How to read this dashboard
                      </summary>
                      <div className="px-4 pb-3 pt-1 text-xs text-gray-600 space-y-1.5">
                        <p><strong>Financial Year (FY):</strong> April to March. E.g. FY 2025-26 = April 2025 through March 2026. This dashboard shows all 12 months of the selected FY regardless of which month you picked in the period selector.</p>
                        <p><strong>Taxable Sales (blue bar):</strong> Total value of goods sold before GST, per month. Rising bars = growing revenue.</p>
                        <p><strong>ITC Claimed (green bar):</strong> Eligible Input Tax Credit from purchases per month. Higher ITC means more purchases — which reduces your cash outflow to the government.</p>
                        <p><strong>Net Payable (red line):</strong> Tax Collected − ITC = cash owed to government. When the line dips below the bars, your ITC is significantly covering your tax. When it's close to the tax collected bar, ITC is low.</p>
                        <p><strong>Surplus (green row in table):</strong> Months where ITC exceeds your tax liability — no cash payment needed; the surplus carries forward.</p>
                        <p><strong>FY Total row:</strong> Running totals across all 12 months. Use this for annual tax planning — compare to advance tax payments and project GSTR-9 annual return values.</p>
                      </div>
                    </details>

                    {/* FY Summary Cards */}
                    <div className="grid grid-cols-4 gap-3">
                      {([
                        { label: 'Total Taxable Sales', tip: 'Total value of goods/services sold (before GST) across all 12 months of this financial year.', value: trendData.totals.taxableOutward, wrap: 'bg-blue-50 border-blue-200',   text: 'text-blue-600',   bold: 'text-blue-800',   icon: <TrendingUp className="w-4 h-4" /> },
                        { label: 'Total Tax Collected',  tip: 'Total GST (CGST+SGST+IGST) collected from customers across the FY. This is your gross tax liability before deducting ITC.', value: trendData.totals.totalTaxOut,    wrap: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-600', bold: 'text-indigo-800', icon: <TrendingUp className="w-4 h-4" /> },
                        { label: 'Total ITC Claimed',    tip: 'Total eligible Input Tax Credit from all approved purchases across the FY. Higher ITC = lower cash outflow. Only ELIGIBLE GRNs counted — Exempt and Blocked excluded.', value: trendData.totals.eligibleITC,    wrap: 'bg-green-50 border-green-200',  text: 'text-green-600',  bold: 'text-green-800',  icon: <TrendingDown className="w-4 h-4" /> },
                        { label: 'Total Net Payable',    tip: 'Total cash paid (or to be paid) to the government across the FY = Tax Collected − ITC. This is your net GST cost for the year, useful for GSTR-9 annual return.', value: trendData.totals.netPayable,     wrap: 'bg-red-50 border-red-200',      text: 'text-red-600',    bold: 'text-red-800',    icon: <TrendingUp className="w-4 h-4" /> },
                      ] as const).map(({ label, tip, value, wrap, text, bold, icon }) => (
                        <div key={label} className={`${wrap} border rounded-xl p-4`}>
                          <div className={`flex items-center gap-1.5 ${text} mb-1`}>
                            {icon}
                            <span className="text-xs font-medium uppercase tracking-wide flex items-center gap-0.5">{label}<Tip>{tip}</Tip></span>
                          </div>
                          <p className={`text-xl font-bold ${bold}`}>₹{inr(value)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{trendData.fyLabel}</p>
                        </div>
                      ))}
                    </div>

                    {/* Chart */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900">Month-wise GST Trend — {trendData.fyLabel}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Bars: Taxable sales (blue) · ITC (green) · Line: Net payable (red)
                        </p>
                      </div>
                      <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={trendData.months} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="shortPeriod" tick={{ fontSize: 11 }} />
                          <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `₹${v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`}
                          />
                          <Tooltip
                            formatter={(value: any, name: any) => [`₹${inr(Number(value))}`, String(name)]}
                            labelStyle={{ fontWeight: 600 }}
                          />
                          <Legend />
                          <ReferenceLine yAxisId="left" y={0} stroke="#ccc" />
                          <Bar yAxisId="left" dataKey="taxableOutward" name="Taxable Sales"  fill="#1B4F8A" opacity={0.85} radius={[3,3,0,0]} />
                          <Bar yAxisId="left" dataKey="eligibleITC"    name="ITC Claimed"    fill="#10B981" opacity={0.85} radius={[3,3,0,0]} />
                          <Line yAxisId="left" type="monotone" dataKey="netPayable" name="Net Payable" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 4, fill: '#EF4444' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Month-wise table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800">Month-wise Breakdown</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                            <tr>
                              {([
                                { h: 'Month',         tip: 'Return month. GST FY runs April–March.' },
                                { h: 'Bills',         tip: 'Number of sales invoices issued in this month.' },
                                { h: 'Taxable Sales', tip: 'Total taxable value of outward supplies (before GST) for the month.' },
                                { h: 'Tax Collected', tip: 'Total GST collected from customers — CGST+SGST+IGST+Cess combined.' },
                                { h: 'GRNs',          tip: 'Number of purchase receipts (Goods Receipt Notes) approved in this month.' },
                                { h: 'ITC Claimed',   tip: 'Eligible ITC from GRNs approved this month. Only ELIGIBLE status GRNs included — Exempt and Blocked excluded.' },
                                { h: 'Net Payable',   tip: 'Tax Collected − ITC Claimed = cash owed to government for this month. Green "Surplus" means ITC exceeded tax liability; surplus carries to next month.' },
                              ] as { h: string; tip: string }[]).map(({ h, tip }) => (
                                <th key={h} className={`px-3 py-2 font-semibold ${h === 'Month' ? 'text-left' : 'text-right'}`}>
                                  <span className="inline-flex items-center gap-0.5">{h}<Tip>{tip}</Tip></span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {trendData.months.map((m) => (
                              <tr key={m.period} className={`hover:bg-gray-50 ${m.netPayable > 0 ? '' : 'bg-green-50'}`}>
                                <td className="px-3 py-2 font-medium text-gray-800">{m.period}</td>
                                <td className="px-3 py-2 text-right text-gray-600">{m.billCount}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(m.taxableOutward)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{inr(m.totalTaxOut)}</td>
                                <td className="px-3 py-2 text-right text-gray-600">{m.grnCount}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-green-600">{inr(m.eligibleITC)}</td>
                                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${m.netPayable > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {m.netPayable > 0 ? `₹${inr(m.netPayable)}` : 'Surplus'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-100 font-bold text-xs text-gray-700 border-t-2 border-gray-200">
                            <tr>
                              <td className="px-3 py-2">FY Total</td>
                              <td className="px-3 py-2 text-right">{trendData.totals.billCount}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{inr(trendData.totals.taxableOutward)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{inr(trendData.totals.totalTaxOut)}</td>
                              <td className="px-3 py-2 text-right">{trendData.totals.grnCount}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-green-600">{inr(trendData.totals.eligibleITC)}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-red-600">{inr(trendData.totals.netPayable)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No trend data available.</p>
                )}
              </div>
            )}

            {/* ── TAB 5: Inward Supplies (GSTR-2) ─────────────────────────── */}
            {tab === 'inward' && (
              <div className="space-y-4">
                {loadingInward ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Inward Supplies…
                  </div>
                ) : inwardData ? (
                  <>
                    {/* How to read Inward Supplies */}
                    <details className="bg-blue-50 border border-blue-200 rounded-lg">
                      <summary className="px-4 py-2.5 text-xs text-blue-700 cursor-pointer select-none flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 shrink-0" /> How to read this report
                      </summary>
                      <div className="px-4 pb-3 pt-1 text-xs text-gray-600 space-y-1.5">
                        <p><strong>Rate-wise rows:</strong> One GRN can have multiple rows here — one per GST rate slab. E.g., a GRN with items at 5% and 18% GST produces two rows. This matches the GSTR-2 format required by the GST portal.</p>
                        <p><strong>Invoice Value vs Taxable Value:</strong> Invoice Value = total amount you paid to the supplier (taxable + all taxes). Taxable Value = base amount before tax. The tax = Invoice Value − Taxable Value.</p>
                        <p><strong>Place of Supply:</strong> The state where the supply is deemed to occur. If Place of Supply = Andhra Pradesh = your state, it is intra-state (CGST+SGST applies). Otherwise it is inter-state (IGST applies).</p>
                        <p><strong>ITC: Eligible (green):</strong> Tax on this purchase can be claimed as credit. Supplier is GST-registered, goods/services are used for business, not blocked under Sec 17(5).</p>
                        <p><strong>ITC: Exempt (amber):</strong> Goods attract 0% GST. No tax was charged, so nothing to claim. These go into GSTR-3B Table 5 as exempt inward supplies.</p>
                        <p><strong>ITC: Blocked (red):</strong> GST was charged but you CANNOT claim it. Section 17(5) restricts ITC on: motor vehicles &amp; transport, food/beverages, club memberships, rent-a-cab, health insurance, construction materials for own building, gifts to employees. Disclosed in GSTR-3B Table 4D(2).</p>
                        <p><strong>GSTR-2B reconciliation:</strong> After downloading this Excel, go to gst.gov.in → Returns → GSTR-2B → Download JSON, then upload it in the GST Reconciliation page of this ERP to find mismatches.</p>
                      </div>
                    </details>

                    {/* Header + Download */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        One row per GST rate slab per invoice — matches <strong>GSTR-2 Inward Supplies</strong> format.
                        Cross-verify ITC with <strong>GSTR-2B</strong> before filing.
                      </div>
                      <button
                        onClick={() => downloadBlob(
                          '/reports/gst/inward-supplies/excel',
                          `GSTR2_Inward_Supplies_${MONTH_ABBR[month-1]}_${year}.xlsx`,
                          params
                        )}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e]"
                      >
                        <Download className="w-4 h-4" /> Download GSTR-2 Excel
                      </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Eligible ITC</p>
                        <p className="text-xs text-green-600 mt-0.5">{inwardData.summary.eligibleGrns} GRNs · GSTR-3B Table 4</p>
                        <p className="text-xl font-bold text-green-800 mt-1">₹{inr(inwardData.summary.eligibleITC)}</p>
                        <p className="text-xs text-green-600 mt-0.5">Taxable: ₹{inr(inwardData.summary.eligibleTaxable)}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Exempt / Nil-Rated</p>
                        <p className="text-xs text-amber-600 mt-0.5">{inwardData.summary.exemptGrns} GRNs · GSTR-3B Table 5</p>
                        <p className="text-xl font-bold text-amber-800 mt-1">₹{inr(inwardData.summary.exemptTaxable)}</p>
                        <p className="text-xs text-amber-600 mt-0.5">No ITC — exempted goods</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                        <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Ineligible — Sec 17(5)</p>
                        <p className="text-xs text-red-600 mt-0.5">{inwardData.summary.ineligibleGrns} GRNs · GSTR-3B Table 4D2</p>
                        <p className="text-xl font-bold text-red-800 mt-1">₹{inr(inwardData.summary.ineligibleITC)}</p>
                        <p className="text-xs text-red-600 mt-0.5">Blocked ITC · disclosure only</p>
                      </div>
                    </div>

                    {/* Inward Supplies Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">
                            Inward Supplies Register — {inwardData.period}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {inwardData.summary.totalGrns} GRNs · {inwardData.summary.totalRows} rate-wise rows
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 font-mono">{inwardData.businessGstin}</span>
                      </div>

                      {inwardData.rows.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No approved GRNs for this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-[#1B4F8A] text-white">
                              <tr>
                                {([
                                  { h: 'GSTIN/UIN',       tip: "Supplier's GST Identification Number (15-digit). Must be valid for ITC claim. UIN = Unique Identification Number for embassies/UN bodies." },
                                  { h: 'Party Name',      tip: "Supplier's registered business name." },
                                  { h: 'Invoice No.',     tip: "Supplier's original invoice number. This is what gets matched against GSTR-2B. Must match exactly." },
                                  { h: 'Invoice Date',    tip: "Date on the supplier's invoice. ITC can only be claimed in the period this GRN was received and approved." },
                                  { h: 'Invoice Value',   tip: 'Total amount paid to supplier including all taxes (taxable + CGST + SGST + IGST + Cess).' },
                                  { h: 'Rate',            tip: 'GST rate slab for this row — 0%, 5%, 12%, 18%, or 28%. One GRN can have multiple rows if items span multiple slabs.' },
                                  { h: 'Taxable Value',   tip: 'Value of goods/services before adding GST. Tax = Taxable Value × (Rate/100).' },
                                  { h: 'IGST',            tip: 'Integrated GST paid — applies when supplier is from a different state. Can offset IGST, then CGST, then SGST liability.' },
                                  { h: 'CGST',            tip: 'Central GST paid — applies when supplier is from Andhra Pradesh (intra-state). Offsets only CGST liability.' },
                                  { h: 'SGST',            tip: 'State GST paid — applies when supplier is from Andhra Pradesh (intra-state). Offsets only SGST liability.' },
                                  { h: 'Cess',            tip: 'Compensation Cess paid — applicable only on specific goods. Cess credit offsets cess liability only.' },
                                  { h: 'Place of Supply', tip: 'State where supply is deemed to occur. If = Andhra Pradesh: CGST+SGST applies. If = another state: IGST applies.' },
                                  { h: 'ITC',             tip: 'Eligible = can claim credit | Exempt = 0% goods, no tax to claim | Blocked = Sec 17(5) restricted, cannot claim even though tax was paid.' },
                                ] as { h: string; tip: string }[]).map(({ h, tip }) => (
                                  <th key={h} className={`px-2 py-2 font-semibold whitespace-nowrap ${
                                    ['GSTIN/UIN','Party Name','Invoice No.','Invoice Date','Place of Supply','ITC'].includes(h)
                                      ? 'text-left' : 'text-right'
                                  }`}>
                                    <span className="inline-flex items-center gap-0.5">{h}<Tip>{tip}</Tip></span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {inwardData.rows.map((r, i) => (
                                <tr key={i} className={`hover:bg-gray-50 ${
                                  r.itcEligibility === 'EXEMPT' ? 'bg-amber-50' :
                                  r.itcEligibility === 'NOT_ELIGIBLE' ? 'bg-red-50' : ''
                                }`}>
                                  <td className="px-2 py-2 font-mono text-gray-500 text-[10px]">{r.supplierGstin || '—'}</td>
                                  <td className="px-2 py-2 text-gray-800 max-w-[120px] truncate">{r.supplierName}</td>
                                  <td className="px-2 py-2 font-mono text-gray-900">{r.invoiceNumber}</td>
                                  <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{r.invoiceDate}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.invoiceValue)}</td>
                                  <td className="px-2 py-2 text-right font-semibold">
                                    {r.gstRate === 0 ? <span className="text-amber-600">0%</span> : `${r.gstRate}%`}
                                  </td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.taxableValue)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.igstAmount)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.cgstAmount)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.sgstAmount)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">{inr(r.cessAmount)}</td>
                                  <td className="px-2 py-2 text-gray-600 max-w-[100px] truncate">{r.placeOfSupply}</td>
                                  <td className="px-2 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                      r.itcEligibility === 'ELIGIBLE'     ? 'bg-green-100 text-green-700' :
                                      r.itcEligibility === 'EXEMPT'       ? 'bg-amber-100 text-amber-700' :
                                                                             'bg-red-100 text-red-600'
                                    }`}>
                                      {r.itcEligibility === 'ELIGIBLE' ? 'Eligible' :
                                       r.itcEligibility === 'EXEMPT'   ? 'Exempt' : 'Blocked'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-semibold text-xs text-gray-700 border-t border-gray-200">
                              <tr>
                                <td colSpan={4} className="px-2 py-2">Total ({inwardData.summary.totalRows} rows)</td>
                                <td className="px-2 py-2 text-right tabular-nums">
                                  {inr(inwardData.rows.reduce((s,r)=>s+r.invoiceValue,0))}
                                </td>
                                <td />
                                <td className="px-2 py-2 text-right tabular-nums">
                                  {inr(inwardData.rows.reduce((s,r)=>s+r.taxableValue,0))}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums">
                                  {inr(inwardData.rows.reduce((s,r)=>s+r.igstAmount,0))}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums">
                                  {inr(inwardData.rows.reduce((s,r)=>s+r.cgstAmount,0))}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums">
                                  {inr(inwardData.rows.reduce((s,r)=>s+r.sgstAmount,0))}
                                </td>
                                <td className="px-2 py-2 text-right tabular-nums">
                                  {inr(inwardData.rows.reduce((s,r)=>s+r.cessAmount,0))}
                                </td>
                                <td colSpan={2} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No inward supplies data.</p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function GstR1DownloadButton({ month, year, blocked }: { month: number; year: number; blocked: boolean }) {
  const [loading, setLoading] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ unclassifiedHsnCount: number; creditNoteCount: number } | null>(null);
  const ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  async function handleClick() {
    if (blocked) return;
    setLoading(true);
    try {
      const res  = await api.get('/reports/gst/gstr1-json', { params: { month, year } });
      const data = res.data;
      setLastMeta(data._meta ?? null);
      downloadJSON(data, `GSTR1_${ABBR[month-1]}_${year}.json`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to generate GSTR-1 JSON';
      alert(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        onClick={handleClick}
        disabled={loading || blocked}
        className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors ${
          blocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
        Download GSTR-1 JSON
      </button>
      {lastMeta && lastMeta.unclassifiedHsnCount > 0 && (
        <p className="text-[10px] text-amber-600">
          {lastMeta.unclassifiedHsnCount} UNCLASSIFIED HSN entries excluded from JSON
        </p>
      )}
      {lastMeta && lastMeta.creditNoteCount > 0 && (
        <p className="text-[10px] text-blue-600">
          {lastMeta.creditNoteCount} credit note(s) included
        </p>
      )}
    </div>
  );
}
