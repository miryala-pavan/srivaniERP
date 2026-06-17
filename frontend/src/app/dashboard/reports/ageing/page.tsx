'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Printer, MessageCircle, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import api from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

interface AgeingCustomer {
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  b0_30: number; b31_60: number; b61_90: number; b90_plus: number;
  total: number; billCount: number; oldestDays: number;
}
interface AgeingData {
  asOf: string;
  customers: AgeingCustomer[];
  totals: { b0_30: number; b31_60: number; b61_90: number; b90_plus: number; total: number };
  summary: { customerCount: number; billCount: number; totalOutstanding: number };
}

// ── Bucket cell colouring ───────────────────────────────────────────────────────
const cell = (v: number, danger = false) =>
  v <= 0 ? 'text-gray-300'
    : danger ? 'text-red-600 font-semibold'
    : 'text-gray-800';

export default function AgeingReportPage() {
  const [data, setData]       = useState<AgeingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf]       = useState(() => new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AgeingData>('/reports/receivables/ageing', { params: { asOf } });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  const remind = (c: AgeingCustomer) => {
    const phone = c.customerPhone?.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Dear ${c.customerName},\n\n` +
      `This is a gentle reminder from Srivani Kirana & General Stores regarding your ` +
      `outstanding balance of Rs.${inr(c.total)} (${c.billCount} bill${c.billCount > 1 ? 's' : ''}).\n\n` +
      `Kindly arrange the payment at your earliest convenience.\n\nThank you!`,
    );
    window.open(phone ? `https://wa.me/91${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
  };

  const t = data?.totals;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Receivables Ageing" />
      <div className="max-w-7xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Receivables Ageing' }]} />
        <div className="flex items-center justify-between mt-2 mb-4">
          <BackButton />
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">As of</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]" />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1B4F8A] text-white rounded-lg hover:bg-[#163d6e]">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Total Outstanding</p>
            <p className="text-lg font-bold text-gray-900">₹{inr(t?.total ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">0–30 days</p>
            <p className="text-lg font-bold text-green-700">₹{inr(t?.b0_30 ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">31–60 days</p>
            <p className="text-lg font-bold text-amber-600">₹{inr(t?.b31_60 ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">61–90 days</p>
            <p className="text-lg font-bold text-orange-600">₹{inr(t?.b61_90 ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1">90+ days <AlertTriangle className="w-3 h-3 text-red-500" /></p>
            <p className="text-lg font-bold text-red-600">₹{inr(t?.b90_plus ?? 0)}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-4 py-2.5 text-center font-medium">Bills</th>
                  <th className="px-4 py-2.5 text-right font-medium">0–30</th>
                  <th className="px-4 py-2.5 text-right font-medium">31–60</th>
                  <th className="px-4 py-2.5 text-right font-medium">61–90</th>
                  <th className="px-4 py-2.5 text-right font-medium">90+</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total Due</th>
                  <th className="px-4 py-2.5 text-center font-medium print:hidden">Remind</th>
                </tr>
              </thead>
              <tbody>
                {data?.customers.map((c, i) => (
                  <tr key={c.customerId ?? i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="text-gray-800 font-medium">{c.customerName}</div>
                      {c.customerPhone && <div className="text-xs text-gray-400">{c.customerPhone}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-500">{c.billCount}</td>
                    <td className={`px-4 py-2.5 text-right ${cell(c.b0_30)}`}>{c.b0_30 > 0 ? inr(c.b0_30) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right ${cell(c.b31_60)}`}>{c.b31_60 > 0 ? inr(c.b31_60) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right ${cell(c.b61_90, true)}`}>{c.b61_90 > 0 ? inr(c.b61_90) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right ${cell(c.b90_plus, true)}`}>{c.b90_plus > 0 ? inr(c.b90_plus) : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">₹{inr(c.total)}</td>
                    <td className="px-4 py-2.5 text-center print:hidden">
                      <button onClick={() => remind(c)} title="Send WhatsApp reminder"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {data && data.customers.length === 0 && !loading && (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">No outstanding receivables 🎉</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400 text-sm">Loading…</td></tr>
                )}
              </tbody>
              {data && data.customers.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
                    <td className="px-4 py-3" colSpan={2}>Total ({data.summary.customerCount} customers)</td>
                    <td className="px-4 py-3 text-right">{inr(t!.b0_30)}</td>
                    <td className="px-4 py-3 text-right">{inr(t!.b31_60)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{inr(t!.b61_90)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{inr(t!.b90_plus)}</td>
                    <td className="px-4 py-3 text-right">₹{inr(t!.total)}</td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Ageing based on bill date of unpaid/partial credit bills, as of {data ? fmtDate(data.asOf) : '—'}.
        </p>
      </div>
    </div>
  );
}
