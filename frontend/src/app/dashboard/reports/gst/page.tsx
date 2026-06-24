'use client';

import { useState, useCallback } from 'react';
import { Download, FileJson, Loader2, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';

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

type Tab = 'gstr3b' | 'sales' | 'purchase' | 'hsn';
type SalesFilter = 'all' | 'b2b' | 'b2cl' | 'b2cs';

export default function GstReportsPage() {
  const now = new Date();
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [year,   setYear]   = useState(now.getFullYear());
  const [tab,    setTab]    = useState<Tab>('gstr3b');
  const [filter, setFilter] = useState<SalesFilter>('all');

  const [loading3b,       setLoading3b]       = useState(false);
  const [loadingSales,    setLoadingSales]     = useState(false);
  const [loadingPurch,    setLoadingPurch]     = useState(false);
  const [loadingPreflight, setLoadingPreflight] = useState(false);

  const [gstr3b,    setGstr3b]    = useState<GSTR3BData | null>(null);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [purchData, setPurchData] = useState<PurchaseData | null>(null);
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [error,     setError]     = useState('');

  const params = { month, year };

  const generate = useCallback(async () => {
    setError('');
    setGstr3b(null); setSalesData(null); setPurchData(null); setPreflight(null);
    setLoading3b(true); setLoadingSales(true); setLoadingPurch(true); setLoadingPreflight(true);

    const [rPre, r3b, rSales, rPurch] = await Promise.allSettled([
      api.get<PreflightData>('/reports/gst/preflight',        { params }),
      api.get<GSTR3BData>('/reports/gst/gstr3b',              { params }),
      api.get<SalesData> ('/reports/gst/sales-register',      { params }),
      api.get<PurchaseData>('/reports/gst/purchase-register', { params }),
    ]);

    if (rPre.status   === 'fulfilled') setPreflight(rPre.value.data);
    setLoadingPreflight(false);

    if (r3b.status    === 'fulfilled') setGstr3b(r3b.value.data);
    else setError('Failed to load GSTR-3B data');
    setLoading3b(false);

    if (rSales.status === 'fulfilled') setSalesData(rSales.value.data);
    setLoadingSales(false);

    if (rPurch.status === 'fulfilled') setPurchData(rPurch.value.data);
    setLoadingPurch(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const yearRange = [2024, 2025, 2026, 2027];

  const TABS: { id: Tab; label: string }[] = [
    { id: 'gstr3b',   label: 'GSTR-3B Summary'  },
    { id: 'sales',    label: 'Sales Register'    },
    { id: 'purchase', label: 'Purchase Register' },
    { id: 'hsn',      label: 'HSN + GSTR-1'     },
  ];

  const hasData = gstr3b || salesData || purchData;
  const period  = gstr3b?.period ?? salesData?.period ?? purchData?.period ?? '';

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
          <span>
            Reports comply with <strong>GSTR-1 v GST3.0.4</strong> schema.
            Opening ITC balance is auto-computed from FY start. GSTR-1 JSON is validated before download.
            Credit notes for cross-period voided bills are generated automatically.
          </span>
        </div>

        {/* Period Selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#1B4F8A]"
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Year</label>
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
              disabled={loading3b || loadingSales || loadingPurch}
              className="px-5 py-2 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {(loading3b || loadingSales || loadingPurch) && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate Reports
            </button>
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

        {!hasData && !loading3b && !loadingSales && !loadingPurch && !loadingPreflight && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Select a period and click Generate Reports to view GST data.
          </div>
        )}

        {hasData && (
          <>
            {/* Tab Bar */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
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
                      <p className="text-xs text-gray-500 mt-0.5">Period: {gstr3b.period}</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#1B4F8A] text-white text-xs">
                            <th className="text-left px-3 py-2.5 w-64">Description</th>
                            <th className="text-right px-3 py-2.5">Taxable</th>
                            <th className="text-right px-3 py-2.5">CGST</th>
                            <th className="text-right px-3 py-2.5">SGST</th>
                            <th className="text-right px-3 py-2.5">IGST</th>
                            <th className="text-right px-3 py-2.5">CESS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <SectionDivider label="3.1  Outward Taxable Supplies" />
                          <Gstr3bRow label="(a) B2B — with GSTIN"    row={gstr3b.outwardSupplies.b2b} />
                          <Gstr3bRow label="(a) B2C — without GSTIN" row={gstr3b.outwardSupplies.b2c} />
                          <Gstr3bRow label="Total Outward"           row={gstr3b.outwardSupplies.total} isTotal />

                          <SectionDivider label="3.1(d)  Reverse Charge" sub="(RCM — if applicable)" />
                          <tr>
                            <td className="px-3 py-2 text-sm text-gray-500 italic" colSpan={6}>
                              CGST ₹{inr(gstr3b.reverseCharge.cgst)}  SGST ₹{inr(gstr3b.reverseCharge.sgst)}  IGST ₹{inr(gstr3b.reverseCharge.igst)}
                              {gstr3b.reverseCharge.note && <span className="text-orange-600 ml-2">— {gstr3b.reverseCharge.note}</span>}
                            </td>
                          </tr>

                          <SectionDivider label="3.2  Inter-State to Unregistered" sub="(informational)" />
                          <Gstr3bRow label="Inter-state B2C" row={gstr3b.interStateUnregistered} />

                          <SectionDivider label="4.  Eligible ITC" />
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
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Net GST (this period) — {gstr3b.period}
                        </p>
                        <p className={`text-3xl font-bold ${gstr3b.netPayable.total > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          ₹{inr(gstr3b.netPayable.total)}
                        </p>
                      </div>
                      <div className={`rounded-xl p-5 text-center ${
                        gstr3b.creditLedger.netPayableAfterOpening > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'
                      }`}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                          Cash to Pay After Opening ITC
                        </p>
                        <p className={`text-3xl font-bold ${gstr3b.creditLedger.netPayableAfterOpening > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                          ₹{inr(gstr3b.creditLedger.netPayableAfterOpening)}
                        </p>
                      </div>
                    </div>

                    {/* ITC Credit Ledger */}
                    <div className="px-5 pb-5">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ITC Credit Ledger</h3>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Opening Balance', value: gstr3b.creditLedger.openingBalance, note: gstr3b.creditLedger.openingBalanceNote },
                          { label: 'ITC Claimed',     value: gstr3b.creditLedger.itcClaimed },
                          { label: 'ITC Used',        value: gstr3b.creditLedger.itcUsed },
                          { label: 'Closing Balance', value: gstr3b.creditLedger.closingBalance },
                        ].map(({ label, value, note }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
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
                    {/* Controls */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {([
                          { id: 'all',  label: `All (${salesData.totals.totalBills})` },
                          { id: 'b2b',  label: `B2B (${salesData.totals.b2bCount})` },
                          { id: 'b2cl', label: `B2C Large (${salesData.totals.b2clCount})` },
                          { id: 'b2cs', label: `B2C Small (${salesData.totals.b2csCount})` },
                        ] as { id: SalesFilter; label: string }[]).map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => setFilter(id)}
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
                        { label: 'Total Bills',     value: salesData.totals.totalBills,      isCount: true },
                        { label: 'Total Taxable',   value: salesData.totals.totalTaxable },
                        { label: 'CGST+SGST',       value: salesData.totals.totalCgst + salesData.totals.totalSgst },
                        { label: 'Total IGST',      value: salesData.totals.totalIgst },
                        { label: 'Grand Total',     value: salesData.totals.totalGrandTotal },
                      ].map(({ label, value, isCount }) => (
                        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                          <p className="text-xs text-gray-500">{label}</p>
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
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                        Cross-verify eligible ITC against <strong>GSTR-2B</strong> on the GST portal before filing.
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
                        { label: 'Total GRNs',     value: purchData.summary.totalPurchases, isCount: true },
                        { label: 'Eligible ITC',   value: purchData.summary.eligibleITC },
                        { label: 'Ineligible ITC', value: purchData.summary.ineligibleITC },
                        { label: 'CGST+SGST ITC',  value: purchData.summary.cgstITC + purchData.summary.sgstITC },
                      ].map(({ label, value, isCount }) => (
                        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                          <p className="text-xs text-gray-500">{label}</p>
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
                                {['GRN Date','GRN No','Supplier','GSTIN','Invoice No','Inter?','ITC','Taxable','CGST','SGST','IGST','CESS','Total','ITC Amt'].map((h) => (
                                  <th key={h} className={`px-3 py-2 font-semibold ${['GRN Date','GRN No','Supplier','GSTIN','Invoice No','Inter?','ITC'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
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
                                {['HSN Code','Description','UOM','GST Rate','Total Qty','Taxable','CGST','SGST','IGST','CESS','Total Tax'].map((h) => (
                                  <th key={h} className={`px-3 py-2 font-semibold ${['HSN Code','Description','UOM'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
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
