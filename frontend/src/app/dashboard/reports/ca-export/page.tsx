'use client';
import { useState } from 'react';
import { FileSpreadsheet, Download, CheckCircle, BookOpen,
         TrendingUp, Building2, Package, Receipt, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

// Quick financial year helper
function getFY() {
  const today = new Date();
  const yr    = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { from: `${yr}-04-01`, to: `${yr + 1}-03-31` };
}

const PRESETS = [
  { label: 'This Financial Year (Apr–Mar)', ...getFY() },
  {
    label: 'Last Financial Year',
    from: `${Number(getFY().from.slice(0,4))-1}-04-01`,
    to:   `${getFY().from.slice(0,4)}-03-31`,
  },
  {
    label: 'Last 3 Months',
    from: (() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0,10); })(),
    to:   new Date().toISOString().slice(0,10),
  },
  {
    label: 'Last 6 Months',
    from: (() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().slice(0,10); })(),
    to:   new Date().toISOString().slice(0,10),
  },
];

const SHEETS = [
  { icon: BookOpen,         color: 'text-slate-600',   bg: 'bg-slate-50',   title: '0. Summary',              desc: 'Cover page — totals at a glance' },
  { icon: Receipt,          color: 'text-orange-600',  bg: 'bg-orange-50',  title: '1. Purchase Register',     desc: 'All GRNs with supplier, invoice no, GST breakup, paid/balance' },
  { icon: TrendingUp,       color: 'text-green-600',   bg: 'bg-green-50',   title: '2. Sales Register',        desc: 'All bills with GST, payment mode split (Cash/UPI/Card)' },
  { icon: Building2,        color: 'text-blue-600',    bg: 'bg-blue-50',    title: '3. Bank Transactions',     desc: 'Full bank ledger — all accounts, descriptions, match status' },
  { icon: CheckCircle,      color: 'text-indigo-600',  bg: 'bg-indigo-50',  title: '4. Bank Reconciliation',   desc: 'Per-account summary + list of unmatched transactions' },
  { icon: FileSpreadsheet,  color: 'text-rose-600',    bg: 'bg-rose-50',    title: '5. Expense Summary',       desc: 'Month-wise rent, bank charges, other expenses' },
  { icon: ChevronRight,     color: 'text-purple-600',  bg: 'bg-purple-50',  title: '6. Supplier Outstanding',  desc: 'Creditors list with ageing buckets (0-30, 31-60, 61-90, 90+ days)' },
  { icon: Package,          color: 'text-teal-600',    bg: 'bg-teal-50',    title: '7. Stock Register',        desc: 'All stock movements — purchase in, sales out, net value' },
  { icon: Receipt,          color: 'text-amber-600',   bg: 'bg-amber-50',   title: '8. GST Summary',           desc: 'Month-wise Output vs Input GST — net payable per month' },
];

export default function CaExportPage() {
  const fy = getFY();
  const [fromDate, setFromDate] = useState(fy.from);
  const [toDate,   setToDate]   = useState(fy.to);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  function applyPreset(p: typeof PRESETS[0]) {
    setFromDate(p.from);
    setToDate(p.to);
    setDone(false);
  }

  async function download() {
    if (!fromDate || !toDate) { setError('Please select both dates'); return; }
    setError('');
    setLoading(true);
    setDone(false);
    try {
      const res = await api.get('/reports/ca-export', {
        params: { fromDate, toDate },
        responseType: 'blob',
      });
      // Trigger browser download
      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      const from = fromDate.replace(/-/g, '');
      const to   = toDate.replace(/-/g, '');
      link.href     = url;
      link.download = `CA_Export_${from}_${to}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (e: any) {
      setError('Export failed. Please check the date range and try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">CA Export Package</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            One-click Excel workbook with all registers, ledgers and GST summaries —
            ready to hand to your Chartered Accountant.
          </p>
        </div>
      </div>

      {/* Date range card */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Select Period</h2>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.label}
              onClick={() => applyPreset(p)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                ${fromDate === p.from && toDate === p.to
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Date pickers */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">From</label>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDone(false); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">To</label>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDone(false); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Download button */}
        <button onClick={download} disabled={loading}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all
            ${loading
              ? 'bg-indigo-400 text-white cursor-not-allowed'
              : done
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md'}`}>
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Building export… this may take a moment
            </>
          ) : done ? (
            <><CheckCircle className="w-4 h-4" /> Downloaded! Click to export again</>
          ) : (
            <><Download className="w-4 h-4" /> Download Excel Workbook</>
          )}
        </button>

        {done && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ✓ File downloaded — <strong>CA_Export_{fromDate.replace(/-/g,'')}_{toDate.replace(/-/g,'')}.xlsx</strong>.
            Share this file with your CA directly.
          </p>
        )}
      </div>

      {/* What's inside */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold text-gray-800 mb-4">What's inside the Excel file</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SHEETS.map(sheet => {
            const Icon = sheet.icon;
            return (
              <div key={sheet.title} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                <div className={`w-8 h-8 rounded-lg ${sheet.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${sheet.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{sheet.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{sheet.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CA note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-1">📌 Note for your CA</p>
        <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
          <li>Opening stock value and depreciation schedule should be provided separately</li>
          <li>Capital account entries (owner deposits / withdrawals) need to be confirmed</li>
          <li>TDS deducted/received entries are not in this export — confirm with CA</li>
          <li>All amounts are in INR. GST Summary sheet can be used for GSTR-3B reference</li>
        </ul>
      </div>

    </div>
  );
}
