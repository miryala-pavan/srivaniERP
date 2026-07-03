'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Loader2, AlertCircle, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n ?? 0));

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
          {gstr3b && (
            <span className="text-sm text-blue-100 font-mono">{gstr3b.businessGstin ?? ''}</span>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

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
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
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
                <p className="text-xs text-gray-400 mt-0.5">Tax liability for the period</p>
              </div>
              <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100">
                <div className="p-5 space-y-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Outward Supplies</h3>
                  {[
                    { label: 'B2B (with GSTIN)',    row: gstr3b.outwardSupplies?.b2b },
                    { label: 'B2C (without GSTIN)', row: gstr3b.outwardSupplies?.b2c },
                    { label: 'Total',               row: gstr3b.outwardSupplies?.total, bold: true },
                  ].map(({ label, row, bold }) => row && (
                    <div key={label} className={`flex justify-between text-sm ${bold ? 'font-semibold border-t border-gray-100 pt-3' : ''}`}>
                      <span className="text-gray-600">{label}</span>
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
                    <span className="text-gray-600">Opening ITC Balance</span>
                    <span className="text-blue-600">₹{inr(gstr3b.creditLedger?.openingBalance ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-3 font-bold">
                    <span>Cash to Pay After Opening ITC</span>
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
                    <p className="text-xs text-gray-400 mt-0.5">{inward.summary?.totalGrns} GRNs · {inward.summary?.totalRows} rate-wise rows</p>
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
                  {[
                    { label: 'Eligible ITC',      sub: 'GSTR-3B Table 4',     value: inward.summary?.eligibleITC,      grns: inward.summary?.eligibleGrns,    color: 'green' },
                    { label: 'Exempt / Nil-Rated', sub: 'GSTR-3B Table 5',     value: inward.summary?.exemptTaxable,    grns: inward.summary?.exemptGrns,      color: 'amber' },
                    { label: 'Ineligible — 17(5)', sub: 'Table 4D(2) disclose', value: inward.summary?.ineligibleITC,   grns: inward.summary?.ineligibleGrns,  color: 'red'   },
                  ].map(({ label, sub, value, grns, color }) => (
                    <div key={label} className="p-5">
                      <p className={`text-xs font-semibold text-${color}-700 uppercase tracking-wide`}>{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{sub} · {grns} GRNs</p>
                      <p className={`text-xl font-bold text-${color}-800 mt-2`}>₹{inr(value ?? 0)}</p>
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
