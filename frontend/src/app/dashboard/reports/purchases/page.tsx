'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowLeftRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import SortableTh from '@/components/reports/SortableTh';
import ColumnToggle from '@/components/reports/ColumnToggle';
import ExportBtn from '@/components/reports/ExportBtn';
import PeriodFilter from '@/components/reports/PeriodFilter';
import SavedViews from '@/components/reports/SavedViews';
import DeltaBadge from '@/components/reports/DeltaBadge';
import { useReportParams } from '@/hooks/useReportParams';
import { useSortable } from '@/hooks/useSortable';
import { useColumnToggle } from '@/hooks/useColumnToggle';
import { inr, fmtDate, today, monthStart, periodDates, prevRange, pctDelta, type Period, type DateRange } from '@/lib/report-format';
import { LinkedGrn } from '@/components/linked/LinkedGrn';
import { LinkedSupplier } from '@/components/linked/LinkedSupplier';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

interface Purchase {
  id: string; grnNumber: string | null; invoiceNumber: string;
  invoiceDate: string; status: string; supplierId: string; supplierName: string;
  taxableAmount: number; totalTax: number; grandTotal: number;
  itemCount: number; paymentMode: string | null;
}
interface PurchaseData {
  purchases: Purchase[];
  summary: { count: number; totalTaxable: number; totalTax: number; grandTotal: number; approved: number; pending: number };
  dateRange: { startDate: string; endDate: string };
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT:            'bg-gray-100 text-gray-500',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED:         'bg-green-100 text-green-700',
  REJECTED:         'bg-red-100 text-red-600',
  CANCELLED:        'bg-gray-100 text-gray-400',
};

const COLUMNS = [
  { key: 'grnNumber',    label: 'GRN #' },
  { key: 'invoiceNumber', label: 'Invoice #' },
  { key: 'invoiceDate',  label: 'Date' },
  { key: 'supplierName', label: 'Supplier' },
  { key: 'status',       label: 'Status' },
  { key: 'itemCount',    label: 'Items' },
  { key: 'taxableAmount', label: 'Taxable' },
  { key: 'totalTax',     label: 'Tax' },
  { key: 'grandTotal',   label: 'Total' },
];

export default function PurchaseRegisterPage() {
  const params = useReportParams();
  const { isVisible, toggle, showAll } = useColumnToggle(COLUMNS.map(c => c.key), ['taxableAmount', 'totalTax']);

  const [period, setPeriod] = useState<Period>(() => (params.get('period', 'month') as Period));
  const [range,  setRange]  = useState<DateRange>({ from: params.get('from', monthStart()), to: params.get('to', today()) });
  const [cmp,    setCmp]    = useState(() => params.get('cmp') === '1');
  const [data,   setData]   = useState<PurchaseData | null>(null);
  const [prev,   setPrev]   = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from: startDate, to: endDate } = periodDates(period, range);
    try {
      const res = await api.get<PurchaseData>('/reports/purchases', { params: { startDate, endDate } });
      setData(res.data);
      if (cmp) {
        const pr = prevRange({ from: startDate, to: endDate });
        const prevRes = await api.get<PurchaseData>('/reports/purchases', { params: { startDate: pr.from, endDate: pr.to } });
        setPrev(prevRes.data);
      } else setPrev(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load purchase register'));
    } finally { setLoading(false); }
  }, [period, range, cmp]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(p: Period, r: DateRange) {
    setPeriod(p); setRange(r);
    params.set({ period: p, from: r.from, to: r.to });
  }
  function toggleCmp() {
    const v = !cmp; setCmp(v);
    params.set({ cmp: v ? '1' : null });
  }

  const { sorted, sort, dir, handleSort } = useSortable(data?.purchases ?? [], 'invoiceDate', 'desc');
  const s = data?.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Purchase Register" />
      <div className="max-w-7xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Purchase Register' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter period={period} from={range.from} to={range.to} onChange={handlePeriod} />
            <button onClick={toggleCmp}
              title="Compare with the previous period of equal length — deltas appear on the summary cards"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${cmp ? 'bg-[#1B4F8A] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Compare
            </button>
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ColumnToggle columns={COLUMNS} isVisible={isVisible} onToggle={toggle} onShowAll={showAll} />
            <SavedViews />
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'GRNs',         value: s?.count ?? 0,        prevValue: prev?.summary.count,      isMoney: false, color: 'text-gray-800' },
            { label: 'Grand Total',  value: s?.grandTotal ?? 0,   prevValue: prev?.summary.grandTotal, isMoney: true,  color: 'text-[#1B4F8A]' },
            { label: 'Approved',     value: s?.approved ?? 0,     prevValue: prev?.summary.approved,   isMoney: false, color: 'text-green-700' },
            { label: 'Pending',      value: s?.pending ?? 0,      prevValue: prev?.summary.pending,    isMoney: false, color: 'text-amber-700' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className={`text-xl font-bold ${card.color}`}>
                {card.isMoney ? `₹${inr(Number(card.value))}` : card.value}
                {cmp && prev && <span className="ml-2 align-middle"><DeltaBadge delta={pctDelta(Number(card.value), card.prevValue)} goodWhenUp={false} /></span>}
              </p>
              {cmp && prev && card.prevValue != null && (
                <p className="text-[10px] text-gray-400 mt-0.5">prev: {card.isMoney ? `₹${inr(Number(card.prevValue))}` : card.prevValue}</p>
              )}
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{sorted.length} GRNs</h2>
            <p className="text-xs text-gray-400">GRN date filter. Click headers to sort.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  {isVisible('grnNumber')    && <SortableTh column="grnNumber"    label="GRN #"    sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} />}
                  {isVisible('invoiceNumber') && <SortableTh column="invoiceNumber" label="Invoice" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} />}
                  {isVisible('invoiceDate')  && <SortableTh column="invoiceDate"  label="Date"     sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} />}
                  {isVisible('supplierName') && <SortableTh column="supplierName" label="Supplier" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} />}
                  {isVisible('status')       && <SortableTh column="status"       label="Status"   sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} />}
                  {isVisible('itemCount')    && <SortableTh column="itemCount"    label="Items"    sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} align="right" />}
                  {isVisible('taxableAmount') && <SortableTh column="taxableAmount" label="Taxable" sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} align="right" />}
                  {isVisible('totalTax')     && <SortableTh column="totalTax"    label="Tax"      sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} align="right" />}
                  {isVisible('grandTotal')   && <SortableTh column="grandTotal"  label="Total"    sort={sort as string} dir={dir} onSort={s => handleSort(s as keyof Purchase)} align="right" />}
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {isVisible('grnNumber')    && <td className="px-4 py-2.5"><LinkedGrn id={p.id} label={p.grnNumber ?? p.invoiceNumber} /></td>}
                    {isVisible('invoiceNumber') && <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{p.invoiceNumber}</td>}
                    {isVisible('invoiceDate')  && <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(p.invoiceDate)}</td>}
                    {isVisible('supplierName') && <td className="px-4 py-2.5"><LinkedSupplier id={p.supplierId} name={p.supplierName} /></td>}
                    {isVisible('status')       && <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>{p.status}</span></td>}
                    {isVisible('itemCount')    && <td className="px-4 py-2.5 text-right text-gray-600">{p.itemCount}</td>}
                    {isVisible('taxableAmount') && <td className="px-4 py-2.5 text-right text-gray-600">{inr(p.taxableAmount)}</td>}
                    {isVisible('totalTax')     && <td className="px-4 py-2.5 text-right text-gray-600">{inr(p.totalTax)}</td>}
                    {isVisible('grandTotal')   && <td className="px-4 py-2.5 text-right font-semibold text-gray-800">₹{inr(p.grandTotal)}</td>}
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">No GRNs in this period</td></tr>
                )}
                {loading && <tr><td colSpan={9} className="py-12 text-center text-gray-400">Loading…</td></tr>}
              </tbody>
              {data && data.purchases.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-800">
                    <td className="px-4 py-3" colSpan={6}>Total ({s?.count} GRNs)</td>
                    {isVisible('taxableAmount') && <td className="px-4 py-3 text-right">{inr(s?.totalTaxable ?? 0)}</td>}
                    {isVisible('totalTax')     && <td className="px-4 py-3 text-right">{inr(s?.totalTax ?? 0)}</td>}
                    {isVisible('grandTotal')   && <td className="px-4 py-3 text-right">₹{inr(s?.grandTotal ?? 0)}</td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">Filtered by GRN invoice date. All statuses included. URL is shareable.</p>
      </div>
    </div>
  );
}
