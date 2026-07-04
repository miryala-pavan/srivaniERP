'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, MessageCircle, AlertTriangle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import SortableTh from '@/components/reports/SortableTh';
import ColumnToggle from '@/components/reports/ColumnToggle';
import ExportBtn from '@/components/reports/ExportBtn';
import { useReportParams } from '@/hooks/useReportParams';
import { useSortable } from '@/hooks/useSortable';
import { useColumnToggle } from '@/hooks/useColumnToggle';
import { inr, fmtDate, today } from '@/lib/report-format';
import api from '@/lib/api';

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

const COLUMNS = [
  { key: 'customerName', label: 'Customer' },
  { key: 'billCount',    label: 'Bills' },
  { key: 'b0_30',        label: '0–30 days' },
  { key: 'b31_60',       label: '31–60 days' },
  { key: 'b61_90',       label: '61–90 days' },
  { key: 'b90_plus',     label: '90+ days' },
  { key: 'total',        label: 'Total Due' },
  { key: 'oldestDays',   label: 'Oldest (days)' },
];

const cell = (v: number, danger = false) =>
  v <= 0 ? 'text-gray-300' : danger ? 'text-red-600 font-semibold' : 'text-gray-800';

export default function AgeingReportPage() {
  const params = useReportParams();
  const { isVisible, toggle, showAll } = useColumnToggle(
    COLUMNS.map(c => c.key),
    ['oldestDays'],
  );

  const [data,    setData]    = useState<AgeingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOf,    setAsOf]    = useState(() => params.get('asOf', today()));

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

  function handleAsOf(val: string) {
    setAsOf(val);
    params.set({ asOf: val });
  }

  const { sorted, sort, dir, handleSort } = useSortable(
    data?.customers ?? [],
    'total',
    'desc',
  );

  const remind = (c: AgeingCustomer) => {
    const phone = c.customerPhone?.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Dear ${c.customerName},\n\nThis is a gentle reminder regarding your outstanding balance of Rs.${inr(c.total)} (${c.billCount} bill${c.billCount > 1 ? 's' : ''}).\n\nKindly arrange the payment at your earliest convenience.\n\nThank you!`,
    );
    window.open(phone ? `https://wa.me/91${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
  };

  const t = data?.totals;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Receivables Ageing" />
      <div className="max-w-7xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Receivables Ageing' }]} />

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500">As of</label>
            <input
              type="date" value={asOf} onChange={e => handleAsOf(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-[#1B4F8A]"
            />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ColumnToggle columns={COLUMNS} isVisible={isVisible} onToggle={toggle} onShowAll={showAll} />
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Outstanding', value: t?.total ?? 0,    color: 'text-gray-900' },
            { label: '0–30 days',         value: t?.b0_30 ?? 0,    color: 'text-green-700' },
            { label: '31–60 days',         value: t?.b31_60 ?? 0,  color: 'text-amber-600' },
            { label: '61–90 days',         value: t?.b61_90 ?? 0,  color: 'text-orange-600' },
            { label: '90+ days',           value: t?.b90_plus ?? 0, color: 'text-red-600' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {card.label}
                {card.label === '90+ days' && <AlertTriangle className="w-3 h-3 text-red-500" />}
              </p>
              <p className={`text-lg font-bold ${card.color}`}>₹{inr(card.value)}</p>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">
              {data?.summary.customerCount ?? 0} customers · {data?.summary.billCount ?? 0} bills
            </h2>
            <p className="text-xs text-gray-400">Click column headers to sort</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  {isVisible('customerName') && <SortableTh column="customerName" label="Customer"     sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} />}
                  {isVisible('billCount')    && <SortableTh column="billCount"    label="Bills"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} align="center" />}
                  {isVisible('b0_30')        && <SortableTh column="b0_30"        label="0–30"         sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} align="right" />}
                  {isVisible('b31_60')       && <SortableTh column="b31_60"       label="31–60"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} align="right" />}
                  {isVisible('b61_90')       && <SortableTh column="b61_90"       label="61–90"        sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} align="right" />}
                  {isVisible('b90_plus')     && <SortableTh column="b90_plus"     label="90+"          sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} align="right" />}
                  {isVisible('total')        && <SortableTh column="total"        label="Total Due"    sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} align="right" />}
                  {isVisible('oldestDays')   && <SortableTh column="oldestDays"   label="Oldest (days)" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof AgeingCustomer)} align="right" />}
                  <th className="px-4 py-2.5 text-center font-medium print:hidden">Remind</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => (
                  <tr key={c.customerId ?? i} className="border-b border-gray-50 hover:bg-gray-50">
                    {isVisible('customerName') && (
                      <td className="px-4 py-2.5">
                        <div className="text-gray-800 font-medium">{c.customerName}</div>
                        {c.customerPhone && <div className="text-xs text-gray-400">{c.customerPhone}</div>}
                      </td>
                    )}
                    {isVisible('billCount')  && <td className="px-4 py-2.5 text-center text-gray-500">{c.billCount}</td>}
                    {isVisible('b0_30')      && <td className={`px-4 py-2.5 text-right ${cell(c.b0_30)}`}>{c.b0_30 > 0 ? inr(c.b0_30) : '—'}</td>}
                    {isVisible('b31_60')     && <td className={`px-4 py-2.5 text-right ${cell(c.b31_60)}`}>{c.b31_60 > 0 ? inr(c.b31_60) : '—'}</td>}
                    {isVisible('b61_90')     && <td className={`px-4 py-2.5 text-right ${cell(c.b61_90, true)}`}>{c.b61_90 > 0 ? inr(c.b61_90) : '—'}</td>}
                    {isVisible('b90_plus')   && <td className={`px-4 py-2.5 text-right ${cell(c.b90_plus, true)}`}>{c.b90_plus > 0 ? inr(c.b90_plus) : '—'}</td>}
                    {isVisible('total')      && <td className="px-4 py-2.5 text-right font-semibold text-gray-900">₹{inr(c.total)}</td>}
                    {isVisible('oldestDays') && <td className={`px-4 py-2.5 text-right ${c.oldestDays > 90 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>{c.oldestDays}d</td>}
                    <td className="px-4 py-2.5 text-center print:hidden">
                      <button onClick={() => remind(c)} title="Send WhatsApp reminder"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {data && data.customers.length === 0 && !loading && (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400 text-sm">No outstanding receivables 🎉</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400 text-sm">Loading…</td></tr>
                )}
              </tbody>
              {data && data.customers.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800 text-sm">
                    <td className="px-4 py-3" colSpan={isVisible('billCount') ? 2 : 1}>
                      Total ({data.summary.customerCount} customers)
                    </td>
                    {isVisible('b0_30')    && <td className="px-4 py-3 text-right">{inr(t!.b0_30)}</td>}
                    {isVisible('b31_60')   && <td className="px-4 py-3 text-right">{inr(t!.b31_60)}</td>}
                    {isVisible('b61_90')   && <td className="px-4 py-3 text-right text-red-600">{inr(t!.b61_90)}</td>}
                    {isVisible('b90_plus') && <td className="px-4 py-3 text-right text-red-600">{inr(t!.b90_plus)}</td>}
                    {isVisible('total')    && <td className="px-4 py-3 text-right">₹{inr(t!.total)}</td>}
                    {isVisible('oldestDays') && <td />}
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Ageing based on bill date of unpaid/partial credit bills, as of {data ? fmtDate(data.asOf) : '—'}.
          URL is shareable — paste it to open with the same date.
        </p>
      </div>
    </div>
  );
}
