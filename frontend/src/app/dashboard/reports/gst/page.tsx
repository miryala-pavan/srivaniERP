'use client';

import { useState, useCallback } from 'react';
import { Download, FileJson, Loader2, AlertCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaxRow { taxable: number; cgst: number; sgst: number; igst: number; cess: number }

interface GSTR3BData {
  period: string;
  outwardSupplies: { b2b: TaxRow; b2c: TaxRow; total: TaxRow };
  itcAvailable:    { fromPurchases: Omit<TaxRow,'taxable'>; eligible: Omit<TaxRow,'taxable'> };
  netPayable:      Omit<TaxRow,'taxable'> & { total: number };
  creditLedger:    { openingBalance: number; itcClaimed: number; taxPaid: number; closingBalance: number };
}

interface B2BBill {
  billNumber: string; billDate: string; customerName: string;
  customerGstin: string; supplyStateCode: string; billType: string;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; grandTotal: number;
}

interface B2CGroup {
  stateCode: string; gstRate: number;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; count: number;
}

interface HsnRow {
  hsnCode: string; description: string; uom: string; totalQty: number;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; totalTax: number;
}

interface SalesData {
  period: string;
  b2b: B2BBill[];
  b2c: B2CGroup[];
  hsnSummary: HsnRow[];
  totals: { totalBills: number; totalTaxable: number; totalCgst: number; totalSgst: number; totalIgst: number; totalCess: number; totalGrandTotal: number };
}

interface PurchaseRow {
  grnNumber: string; grnDate: string; supplierName: string; supplierGstin: string;
  invoiceNumber: string; invoiceDate: string; isInterState: boolean; itcEligibility: string;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; totalAmount: number; itcClaimed: number;
}

interface PurchaseData {
  period: string;
  purchases: PurchaseRow[];
  summary: { totalPurchases: number; eligibleITC: number; ineligibleITC: number; cgstITC: number; sgstITC: number; igstITC: number; cessITC: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
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
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

function SectionDivider({ label }: { label: string }) {
  return (
    <tr className="bg-gray-100">
      <td colSpan={6} className="px-3 py-1.5 text-xs font-bold text-gray-600 uppercase tracking-wide">{label}</td>
    </tr>
  );
}

function Gstr3bRow({
  label, row, isTotal, highlight,
}: {
  label: string;
  row: Partial<TaxRow> & { total?: number };
  isTotal?: boolean;
  highlight?: 'red' | 'green' | 'neutral';
}) {
  const cls = isTotal
    ? 'bg-gray-50 font-semibold'
    : '';
  const valCls = highlight === 'red'
    ? 'text-red-600 font-bold'
    : highlight === 'green'
    ? 'text-green-600 font-bold'
    : '';
  return (
    <tr className={cls}>
      <td className="px-3 py-2 text-sm text-gray-700">{label}</td>
      {row.taxable !== undefined && <TaxCell n={row.taxable} bold={isTotal} />}
      <TaxCell n={row.cgst ?? 0} bold={isTotal} />
      <TaxCell n={row.sgst ?? 0} bold={isTotal} />
      <TaxCell n={row.igst ?? 0} bold={isTotal} />
      <TaxCell n={row.cess ?? 0} bold={isTotal} />
      {row.total !== undefined && (
        <td className={`text-right px-3 py-2 text-sm tabular-nums ${valCls}`}>{inr(row.total)}</td>
      )}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'gstr3b' | 'sales' | 'purchase' | 'hsn';
type SalesFilter = 'all' | 'b2b' | 'b2c';

export default function GstReportsPage() {
  const now  = new Date();
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [year,   setYear]   = useState(now.getFullYear());
  const [tab,    setTab]    = useState<Tab>('gstr3b');
  const [filter, setFilter] = useState<SalesFilter>('all');

  const [loading3b,  setLoading3b]  = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingPurch, setLoadingPurch] = useState(false);

  const [gstr3b,    setGstr3b]    = useState<GSTR3BData | null>(null);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [purchData, setPurchData] = useState<PurchaseData | null>(null);
  const [error,     setError]     = useState('');

  const params = { month, year };

  const generate = useCallback(async () => {
    setError('');
    setGstr3b(null); setSalesData(null); setPurchData(null);
    setLoading3b(true); setLoadingSales(true); setLoadingPurch(true);

    const [r3b, rSales, rPurch] = await Promise.allSettled([
      api.get<GSTR3BData>('/reports/gst/gstr3b',            { params }),
      api.get<SalesData>('/reports/gst/sales-register',     { params }),
      api.get<PurchaseData>('/reports/gst/purchase-register', { params }),
    ]);

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
    { id: 'gstr3b',   label: 'GSTR-3B Summary'    },
    { id: 'sales',    label: 'Sales Register'      },
    { id: 'purchase', label: 'Purchase Register'   },
    { id: 'hsn',      label: 'HSN Summary'         },
  ];

  const hasData = gstr3b || salesData || purchData;
  const period  = gstr3b?.period ?? salesData?.period ?? purchData?.period ?? '';

  // Flat bills for sales filter
  const visibleSalesBills = salesData
    ? filter === 'b2b' ? salesData.b2b
    : filter === 'b2c' ? []   // B2C is shown as grouped rows below
    : salesData.b2b
    : [];

  return (
    <>
      <Header title="GST Reports" />
      <main className="flex-1 p-6 space-y-5">

        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Reports', href: '/dashboard/reports' },
          { label: 'GST Reports' },
        ]} />

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
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
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
              <span className="text-sm text-gray-500 ml-2">Showing: <span className="font-medium text-gray-800">{period}</span></span>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!hasData && !loading3b && !loadingSales && !loadingPurch && (
          <div className="text-center py-16 text-gray-400 text-sm">
            Select a period and click Generate Reports to view GST data.
          </div>
        )}

        {hasData && (
          <>
            {/* Tab Bar */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === id
                      ? 'bg-white text-[#1B4F8A] shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── TAB 1: GSTR-3B Summary ─────────────────────────────────── */}
            {tab === 'gstr3b' && (
              <div className="space-y-4">
                {loading3b ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading GSTR-3B...
                  </div>
                ) : gstr3b ? (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h2 className="font-bold text-gray-900">GSTR-3B Summary</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Period: {gstr3b.period}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#1B4F8A] text-white text-xs">
                            <th className="text-left px-3 py-2.5 w-52">Description</th>
                            <th className="text-right px-3 py-2.5">Taxable</th>
                            <th className="text-right px-3 py-2.5">CGST</th>
                            <th className="text-right px-3 py-2.5">SGST</th>
                            <th className="text-right px-3 py-2.5">IGST</th>
                            <th className="text-right px-3 py-2.5">CESS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <SectionDivider label="3.1  Outward Taxable Supplies" />
                          <Gstr3bRow label="B2B — with GSTIN"    row={{ ...gstr3b.outwardSupplies.b2b }} />
                          <Gstr3bRow label="B2C — without GSTIN" row={{ ...gstr3b.outwardSupplies.b2c }} />
                          <Gstr3bRow label="Total Outward"       row={{ ...gstr3b.outwardSupplies.total }} isTotal />

                          <SectionDivider label="4.  Eligible ITC" />
                          <tr>
                            <td className="px-3 py-2 text-sm text-gray-700">From Purchases</td>
                            <td className="px-3 py-2" />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.cgst} />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.sgst} />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.igst} />
                            <TaxCell n={gstr3b.itcAvailable.fromPurchases.cess} />
                          </tr>
                          <tr className="bg-gray-50 font-semibold">
                            <td className="px-3 py-2 text-sm text-gray-700">Total ITC</td>
                            <td className="px-3 py-2" />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cgst} bold />
                            <TaxCell n={gstr3b.itcAvailable.eligible.sgst} bold />
                            <TaxCell n={gstr3b.itcAvailable.eligible.igst} bold />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cess} bold />
                          </tr>

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
                            <td className="px-3 py-2 text-sm text-gray-700">Less: ITC</td>
                            <td />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cgst} />
                            <TaxCell n={gstr3b.itcAvailable.eligible.sgst} />
                            <TaxCell n={gstr3b.itcAvailable.eligible.igst} />
                            <TaxCell n={gstr3b.itcAvailable.eligible.cess} />
                          </tr>
                          <tr className={`font-bold ${gstr3b.netPayable.total > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <td className="px-3 py-2 text-sm">Net Payable</td>
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
                    <div className={`mx-5 my-4 rounded-xl p-5 text-center ${
                      gstr3b.netPayable.total > 0
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-green-50 border border-green-200'
                    }`}>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Total Net GST Payable — {gstr3b.period}
                      </p>
                      <p className={`text-3xl font-bold ${gstr3b.netPayable.total > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        Rs.{inr(gstr3b.netPayable.total)}
                      </p>
                      {gstr3b.netPayable.total <= 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          ITC covers all tax. Excess credit: Rs.{inr(gstr3b.creditLedger.closingBalance)}
                        </p>
                      )}
                    </div>

                    {/* Credit Ledger */}
                    <div className="px-5 pb-5">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Credit Ledger</h3>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Opening Balance',  value: gstr3b.creditLedger.openingBalance },
                          { label: 'ITC Claimed',      value: gstr3b.creditLedger.itcClaimed },
                          { label: 'Tax Paid via ITC', value: gstr3b.creditLedger.taxPaid },
                          { label: 'Closing Balance',  value: gstr3b.creditLedger.closingBalance },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
                            <p className="text-base font-semibold text-gray-900 mt-0.5">Rs.{inr(value)}</p>
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

            {/* ── TAB 2: Sales Register ──────────────────────────────────── */}
            {tab === 'sales' && (
              <div className="space-y-4">
                {loadingSales ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Sales Register...
                  </div>
                ) : salesData ? (
                  <>
                    {/* Controls */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                        {(['all','b2b','b2c'] as SalesFilter[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filter === f ? 'bg-white text-[#1B4F8A] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                          >
                            {f === 'all' ? 'All' : f === 'b2b' ? 'B2B Only' : 'B2C Only'}
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

                    {/* Totals row */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Total Bills',    value: salesData.totals.totalBills, isCount: true },
                        { label: 'Total Taxable',  value: salesData.totals.totalTaxable },
                        { label: 'Total Tax',      value: salesData.totals.totalCgst + salesData.totals.totalSgst + salesData.totals.totalIgst },
                        { label: 'Grand Total',    value: salesData.totals.totalGrandTotal },
                      ].map(({ label, value, isCount }) => (
                        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="text-lg font-bold text-gray-900 mt-0.5">{isCount ? value : `Rs.${inr(value as number)}`}</p>
                        </div>
                      ))}
                    </div>

                    {/* B2B table */}
                    {(filter === 'all' || filter === 'b2b') && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-800">B2B Invoices ({salesData.b2b.length})</h3>
                        </div>
                        {salesData.b2b.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">No B2B invoices for this period.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                <tr>
                                  {['Date','Bill No','Customer','GSTIN','Type','Taxable','CGST','SGST','IGST','CESS','Total'].map((h) => (
                                    <th key={h} className={`px-3 py-2 font-semibold ${h === 'Date' || h === 'Bill No' || h === 'Customer' || h === 'GSTIN' || h === 'Type' ? 'text-left' : 'text-right'}`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {salesData.b2b.map((b) => (
                                  <tr key={b.billNumber} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-600">{fmtDate(b.billDate)}</td>
                                    <td className="px-3 py-2 font-mono text-gray-900">{b.billNumber}</td>
                                    <td className="px-3 py-2 text-gray-800 max-w-[140px] truncate">{b.customerName}</td>
                                    <td className="px-3 py-2 font-mono text-gray-500">{b.customerGstin}</td>
                                    <td className="px-3 py-2 text-gray-500">{b.billType === 'TAX_INVOICE' ? 'GST' : 'Retail'}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.taxableAmount)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.cgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.sgst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.igst)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{inr(b.cess)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums font-medium">{inr(b.grandTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-50 font-semibold text-gray-700 text-xs">
                                <tr>
                                  <td colSpan={5} className="px-3 py-2">Total ({salesData.b2b.length} bills)</td>
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

                    {/* B2C table */}
                    {(filter === 'all' || filter === 'b2c') && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <h3 className="text-sm font-semibold text-gray-800">B2C Consolidated ({salesData.b2c.length} groups)</h3>
                          <p className="text-xs text-gray-400 mt-0.5">Grouped by state and GST rate — for GSTR-1 filing</p>
                        </div>
                        {salesData.b2c.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-6">No B2C invoices for this period.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                <tr>
                                  {['State Code','GST Rate %','Taxable','CGST','SGST','IGST','CESS','Invoices'].map((h) => (
                                    <th key={h} className={`px-3 py-2 font-semibold ${h === 'State Code' ? 'text-left' : 'text-right'}`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {salesData.b2c.map((b) => (
                                  <tr key={`${b.stateCode}-${b.gstRate}`} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-700">{b.stateCode}</td>
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
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No sales data for this period.</p>
                )}
              </div>
            )}

            {/* ── TAB 3: Purchase Register ───────────────────────────────── */}
            {tab === 'purchase' && (
              <div className="space-y-4">
                {loadingPurch ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Purchase Register...
                  </div>
                ) : purchData ? (
                  <>
                    <div className="flex justify-end">
                      <button
                        onClick={() => downloadBlob('/reports/gst/purchase-register/excel', `Purchase_Register_${MONTH_ABBR[month-1]}_${year}.xlsx`, params)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Excel
                      </button>
                    </div>

                    {/* ITC Summary cards */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Total GRNs',      value: purchData.summary.totalPurchases, isCount: true },
                        { label: 'Eligible ITC',    value: purchData.summary.eligibleITC },
                        { label: 'Ineligible ITC',  value: purchData.summary.ineligibleITC },
                        { label: 'CGST + SGST ITC', value: purchData.summary.cgstITC + purchData.summary.sgstITC },
                      ].map(({ label, value, isCount }) => (
                        <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="text-lg font-bold text-gray-900 mt-0.5">{isCount ? value : `Rs.${inr(value as number)}`}</p>
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
                                {['GRN Date','GRN No','Supplier','GSTIN','Invoice No','Taxable','CGST','SGST','IGST','CESS','Total','ITC'].map((h) => (
                                  <th key={h} className={`px-3 py-2 font-semibold ${['GRN Date','GRN No','Supplier','GSTIN','Invoice No'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {purchData.purchases.map((p) => (
                                <tr key={p.grnNumber + p.invoiceNumber} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-gray-600">{fmtDate(p.grnDate)}</td>
                                  <td className="px-3 py-2 font-mono text-gray-900">{p.grnNumber || '—'}</td>
                                  <td className="px-3 py-2 text-gray-800 max-w-[120px] truncate">{p.supplierName}</td>
                                  <td className="px-3 py-2 font-mono text-gray-500 text-[10px]">{p.supplierGstin || '—'}</td>
                                  <td className="px-3 py-2 font-mono text-gray-600">{p.invoiceNumber}</td>
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
                                <td colSpan={5} className="px-3 py-2">Total ({purchData.purchases.length} GRNs)</td>
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
                  <p className="text-sm text-gray-400 text-center py-8">No purchase data for this period.</p>
                )}
              </div>
            )}

            {/* ── TAB 4: HSN Summary ────────────────────────────────────── */}
            {tab === 'hsn' && (
              <div className="space-y-4">
                {!salesData ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading HSN Summary...
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
                      {salesData.hsnSummary.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No HSN data for this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                              <tr>
                                {['HSN Code','Description','UOM','Total Qty','Taxable Value','CGST','SGST','IGST','CESS','Total Tax'].map((h) => (
                                  <th key={h} className={`px-3 py-2 font-semibold ${['HSN Code','Description','UOM'].includes(h) ? 'text-left' : 'text-right'}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {salesData.hsnSummary.map((h) => (
                                <tr key={h.hsnCode} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-gray-900">{h.hsnCode}</td>
                                  <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{h.description}</td>
                                  <td className="px-3 py-2 text-gray-500">{h.uom}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{h.totalQty % 1 === 0 ? h.totalQty : h.totalQty.toFixed(3)}</td>
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
                                <td colSpan={4} className="px-3 py-2">Total ({salesData.hsnSummary.length} HSN codes)</td>
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
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-blue-800">GSTR-1 JSON for GST Portal</p>
                        <p className="text-xs text-blue-600 mt-0.5">Download the GSTR-1 JSON file and upload it directly on the GST portal.</p>
                      </div>
                      <GstR1DownloadButton month={month} year={year} />
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

function GstR1DownloadButton({ month, year }: { month: number; year: number }) {
  const [loading, setLoading] = useState(false);
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  async function handleClick() {
    setLoading(true);
    try {
      const res  = await api.get('/reports/gst/gstr1-json', { params: { month, year } });
      downloadJSON(res.data, `GSTR1_${MONTH_ABBR[month-1]}_${year}.json`);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors shrink-0"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
      Download GSTR-1 JSON
    </button>
  );
}
