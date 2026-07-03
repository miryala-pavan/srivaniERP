'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2, AlertCircle, ShieldCheck, FileSpreadsheet, HelpCircle } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n ?? 0));

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

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

async function downloadPublicBlob(url: string, filename: string) {
  const res  = await axios.get(url, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function GstPublicContent() {
  const params = useSearchParams();
  const token  = params.get('token') ?? '';
  const [month, setMonth] = useState(Number(params.get('month') ?? new Date().getMonth() + 1));
  const [year,  setYear]  = useState(Number(params.get('year')  ?? new Date().getFullYear()));

  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    if (!token) { setError('No share token — this link is invalid.'); return; }
    setLoading(true); setError(''); setData(null);
    try {
      const res = await axios.get(`${API_BASE}/public/gst/summary`, {
        params: { token, month, year },
      });
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load report. The link may be expired or invalid.');
    } finally {
      setLoading(false);
    }
  }, [token, month, year]);

  useEffect(() => { load(); }, [load]);

  const gstr3b  = data?.gstr3b;
  const inward  = data?.inward;
  const period  = gstr3b?.period ?? '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B4F8A] text-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-200" />
            <div>
              <h1 className="font-bold text-lg">Srivani Stores — GST Report</h1>
              <p className="text-blue-200 text-xs">Shared read-only view · Valid 30 days from generation</p>
            </div>
          </div>
          <div className="text-right">
            {inward?.businessGstin && (
              <span className="text-sm text-blue-100 font-mono block">{inward.businessGstin}</span>
            )}
            <span className="text-xs text-blue-300">Read-only · No login required</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Auditor guidance */}
        <details className="bg-amber-50 border border-amber-200 rounded-xl">
          <summary className="px-4 py-3 text-xs text-amber-800 font-medium cursor-pointer select-none flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" /> Auditor / CA Guide — How to read this report
          </summary>
          <div className="px-4 pb-4 pt-2 text-xs text-gray-700 space-y-2">
            <p><strong>What you are seeing:</strong> This is a read-only GST summary for Srivani Stores generated from their ERP system. It includes GSTR-3B liability data and GSTR-2 inward supplies for the selected month.</p>
            <p><strong>GSTR-3B Summary:</strong> Self-assessed monthly return. Shows outward tax collected (3.1), eligible ITC (Section 4), and net GST payable. Cross-check outward numbers against sales invoices/bills. Verify ITC with GSTR-2B auto-populated on the GST portal.</p>
            <p><strong>ITC Summary — 3 categories:</strong></p>
            <ul className="ml-3 space-y-1 list-disc list-inside">
              <li><strong>Eligible ITC (green):</strong> ITC claimed in GSTR-3B Table 4. Verify against GSTR-2B — only claim what appears there.</li>
              <li><strong>Exempt / Nil-rated (amber):</strong> Purchases at 0% GST. No ITC available. Reported in GSTR-3B Table 5 as exempt inward supplies.</li>
              <li><strong>Ineligible — Sec 17(5) (red):</strong> Blocked ITC. GST was paid but cannot be claimed. Must be disclosed in GSTR-3B Table 4D(2). Common items: vehicles, food, personal items.</li>
            </ul>
            <p><strong>Downloading Excel files:</strong> Use the download buttons to get detailed register files — Purchase Register (all GRN-level details) and Inward Supplies in GSTR-2 format (rate-wise, one row per tax slab per invoice).</p>
            <p><strong>Verification steps:</strong> 1) Confirm GSTIN shown matches the registration certificate · 2) Check Net Payable against payment challans on the GST portal · 3) Reconcile ITC with GSTR-2B · 4) Verify blocked ITC is disclosed, not claimed.</p>
          </div>
        </details>

        {/* Period selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
              {(() => { const cy = new Date().getFullYear(); return [cy-1, cy, cy+1]; })().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={load} disabled={loading}
            className="px-4 py-2 bg-[#1B4F8A] text-white text-sm font-semibold rounded-lg hover:bg-[#163f6e] disabled:opacity-60 flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Load Report
          </button>
          {period && <span className="text-sm text-gray-500">Period: <strong>{period}</strong></span>}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {gstr3b && (
          <>
            {/* GSTR-3B Summary */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">GSTR-3B Summary — {period}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Monthly self-assessed GST return · Tax collected on sales minus Input Tax Credit from purchases = Net cash payable</p>
              </div>
              <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">
                <div className="p-5 space-y-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Outward Supplies
                    <Tip>Total GST collected from customers on sales invoices. B2B = sales to businesses with GSTIN (they can claim ITC). B2C = sales to consumers without GSTIN.</Tip>
                  </h3>
                  {[
                    { label: 'B2B (with GSTIN)',    tip: 'Sales to registered businesses. Reported invoice-by-invoice in GSTR-1 Table 4. Buyer can claim ITC.', row: gstr3b.outwardSupplies?.b2b },
                    { label: 'B2C (without GSTIN)', tip: 'Sales to consumers without GSTIN. Reported consolidated. No ITC available to buyer.', row: gstr3b.outwardSupplies?.b2c },
                    { label: 'Total',               tip: 'Total outward tax liability for this month — goes into GSTR-3B Section 3.1.', row: gstr3b.outwardSupplies?.total, bold: true },
                  ].map(({ label, tip, row, bold }) => row && (
                    <div key={label} className={`flex justify-between text-sm ${bold ? 'font-semibold border-t border-gray-100 pt-3' : ''}`}>
                      <span className="text-gray-600 flex items-center">{label}{tip && <Tip>{tip}</Tip>}</span>
                      <div className="text-right space-x-4">
                        <span className="text-gray-500 text-xs">Taxable ₹{inr(row.taxable ?? 0)}</span>
                        <span>Tax ₹{inr((row.cgst ?? 0) + (row.sgst ?? 0) + (row.igst ?? 0))}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-5 space-y-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">ITC & Net Payable</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Eligible ITC</span>
                    <span className="text-green-600 font-medium">
                      ₹{inr((gstr3b.itcAvailable?.eligible?.cgst ?? 0) + (gstr3b.itcAvailable?.eligible?.sgst ?? 0) + (gstr3b.itcAvailable?.eligible?.igst ?? 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-3 font-semibold">
                    <span>Net Payable (this period)</span>
                    <span className={gstr3b.netPayable?.total > 0 ? 'text-red-600' : 'text-green-600'}>
                      ₹{inr(gstr3b.netPayable?.total ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center">
                      Opening ITC Balance
                      <Tip>Unused ITC accumulated from prior months of this financial year (April onwards). Reduces the cash needed this month.</Tip>
                    </span>
                    <span className="text-blue-600">₹{inr(gstr3b.creditLedger?.openingBalance ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-3 font-bold">
                    <span className="flex items-center">
                      Cash to Pay After Opening ITC
                      <Tip>Net Payable minus the opening ITC balance. This is the actual cash Srivani Stores must deposit via GST Challan (PMT-06) on the portal before the 20th of the following month.</Tip>
                    </span>
                    <span className={gstr3b.creditLedger?.netPayableAfterOpening > 0 ? 'text-red-700' : 'text-green-700'}>
                      ₹{inr(gstr3b.creditLedger?.netPayableAfterOpening ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ITC Breakdown */}
            {inward && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">Inward Supplies — ITC Summary</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{inward.summary?.totalGrns} GRNs · {inward.summary?.totalRows} rate-wise rows · One row per GST rate slab per invoice</p>
                  </div>
                  <button
                    onClick={() => downloadPublicBlob(
                      `${API_BASE}/public/gst/inward-excel?token=${token}&month=${month}&year=${year}`,
                      `GSTR2_Inward_${MONTH_ABBR[month-1]}_${year}.xlsx`
                    )}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#1B4F8A] rounded-lg hover:bg-[#163f6e]"
                  >
                    <Download className="w-3.5 h-3.5" /> GSTR-2 Excel
                  </button>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  {([
                    { label: 'Eligible ITC',       sub: 'GSTR-3B Table 4',      tip: 'ITC that can legally be claimed — tax paid on purchases used for business. Supplier must be GST-registered and the invoice must appear in GSTR-2B. Verify this amount matches Table 4 of the filed GSTR-3B.', value: inward.summary?.eligibleITC,   grns: inward.summary?.eligibleGrns,   head: 'text-green-700', amt: 'text-green-800' },
                    { label: 'Exempt / Nil-Rated', sub: 'GSTR-3B Table 5',      tip: 'Purchases of goods that are either exempt from GST or taxed at 0%. No GST was charged, so there is no ITC to claim. Must be reported separately in GSTR-3B Table 5 as exempt inward supplies.', value: inward.summary?.exemptTaxable, grns: inward.summary?.exemptGrns,     head: 'text-amber-700', amt: 'text-amber-800' },
                    { label: 'Ineligible — 17(5)', sub: 'Table 4D(2) disclose', tip: 'GST was charged by the supplier, but Section 17(5) of the CGST Act blocks the ITC. Examples: motor vehicles, food & beverages, beauty treatments, health insurance, club memberships, construction for own use, gifts to employees. Must be disclosed in Table 4D(2) of GSTR-3B but CANNOT be deducted. Verify this is NOT being claimed.', value: inward.summary?.ineligibleITC, grns: inward.summary?.ineligibleGrns, head: 'text-red-700',   amt: 'text-red-800'   },
                  ] as const).map(({ label, sub, tip, value, grns, head, amt }) => (
                    <div key={label} className="p-5">
                      <p className={`text-xs font-semibold ${head} uppercase tracking-wide flex items-center`}>{label}<Tip>{tip}</Tip></p>
                      <p className="text-xs text-gray-400 mt-0.5">{sub} · {grns} GRNs</p>
                      <p className={`text-xl font-bold ${amt} mt-2`}>₹{inr(value ?? 0)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download Row */}
            <div className="flex gap-3 flex-wrap">
              <a
                href={`${API_BASE}/public/gst/purchase-excel?token=${token}&month=${month}&year=${year}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> Download Purchase Register
              </a>
              <button
                onClick={() => downloadPublicBlob(
                  `${API_BASE}/public/gst/inward-excel?token=${token}&month=${month}&year=${year}`,
                  `GSTR2_Inward_${MONTH_ABBR[month-1]}_${year}.xlsx`
                )}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-600" /> Download Inward Supplies (GSTR-2)
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 py-2">
              This is a read-only view shared by Srivani Stores. Data is as of the time of sharing.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GstPublicPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <GstPublicContent />
    </Suspense>
  );
}
