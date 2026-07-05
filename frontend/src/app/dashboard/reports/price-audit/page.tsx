'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, History } from 'lucide-react';
import Header from '@/components/layout/Header';
import { BackButton } from '@/components/shared/BackButton';
import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import SortableTh from '@/components/reports/SortableTh';
import ColumnToggle from '@/components/reports/ColumnToggle';
import ExportBtn from '@/components/reports/ExportBtn';
import PeriodFilter from '@/components/reports/PeriodFilter';
import SavedViews from '@/components/reports/SavedViews';
import { useReportParams } from '@/hooks/useReportParams';
import { useSortable } from '@/hooks/useSortable';
import { useColumnToggle } from '@/hooks/useColumnToggle';
import { inr, fmtDate, today, monthStart, periodDates, type Period, type DateRange } from '@/lib/report-format';
import { LinkedProduct } from '@/components/linked/LinkedProduct';
import { LinkedGrn } from '@/components/linked/LinkedGrn';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';

interface PriceChange {
  id: string; productId: string; productName: string;
  pluCode: string; packLabel: string | null;
  changeSource: string; grnId: string | null; changedBy: string | null;
  effectiveDate: string; recordedAt: string;
  mrpBefore: number | null; mrpAfter: number | null;
  sellingPriceBefore: number | null; sellingPriceAfter: number | null;
  sellingPriceDelta: number | null;
  gstRateBefore: number | null; gstRateAfter: number | null;
  isActiveAfter: boolean | null; isDefaultAfter: boolean | null;
  notes: string | null;
}
interface AuditData {
  changes: PriceChange[];
  summary: { count: number; increases: number; decreases: number; bySource: Record<string, number> };
}

const SOURCES = [
  { key: '',              label: 'All' },
  { key: 'GRN_APPROVAL',  label: 'GRN' },
  { key: 'PLU_CREATE',    label: 'New PLU' },
  { key: 'MANUAL_UPDATE', label: 'Manual' },
  { key: 'SET_DEFAULT',   label: 'Default' },
  { key: 'DEACTIVATE',    label: 'Deactivated' },
];

const SOURCE_BADGE: Record<string, string> = {
  GRN_APPROVAL:  'bg-blue-100 text-blue-700',
  PLU_CREATE:    'bg-green-100 text-green-700',
  MANUAL_UPDATE: 'bg-amber-100 text-amber-700',
  SET_DEFAULT:   'bg-purple-100 text-purple-700',
  DEACTIVATE:    'bg-red-100 text-red-600',
};

const COLUMNS = [
  { key: 'recordedAt',   label: 'When' },
  { key: 'productName',  label: 'Product' },
  { key: 'pluCode',      label: 'PLU' },
  { key: 'changeSource', label: 'Source' },
  { key: 'changedBy',    label: 'By' },
  { key: 'mrpAfter',     label: 'MRP' },
  { key: 'sellingPriceAfter', label: 'Selling Price' },
  { key: 'gstRateAfter', label: 'GST %' },
  { key: 'notes',        label: 'Notes' },
];

function PriceCell({ before, after }: { before: number | null; after: number | null }) {
  if (before == null && after == null) return <span className="text-gray-300">—</span>;
  if (before == null || after == null || before === after) {
    return <span className="text-gray-600">₹{inr(Number(after ?? before))}</span>;
  }
  const up = after > before;
  return (
    <span className="whitespace-nowrap">
      <span className="text-gray-400 line-through mr-1.5">₹{inr(before)}</span>
      <span className={`font-semibold ${up ? 'text-red-600' : 'text-green-700'}`}>₹{inr(after)}</span>
    </span>
  );
}

export default function PriceAuditPage() {
  const params = useReportParams();
  const { isVisible, toggle, showAll } = useColumnToggle(COLUMNS.map(c => c.key), ['gstRateAfter', 'notes']);

  const [period, setPeriod] = useState<Period>(() => (params.get('period', 'month') as Period));
  const [range,  setRange]  = useState<DateRange>({ from: params.get('from', monthStart()), to: params.get('to', today()) });
  const [source, setSource] = useState(() => params.get('source', ''));
  const [data,   setData]   = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from: startDate, to: endDate } = periodDates(period, range);
    try {
      const res = await api.get<AuditData>('/reports/price-audit', {
        params: { startDate, endDate, ...(source ? { source } : {}) },
      });
      setData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load price audit'));
    } finally { setLoading(false); }
  }, [period, range, source]);

  useEffect(() => { load(); }, [load]);

  function handlePeriod(p: Period, r: DateRange) {
    setPeriod(p); setRange(r);
    params.set({ period: p, from: r.from, to: r.to });
  }
  function handleSource(s: string) {
    setSource(s);
    params.set({ source: s || null });
  }

  const { sorted, sort, dir, handleSort } = useSortable(data?.changes ?? [], 'recordedAt', 'desc');
  const s = data?.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Price Audit" />
      <div className="max-w-7xl mx-auto px-4 py-5">
        <Breadcrumbs items={[{ label: 'Reports', href: '/dashboard/reports' }, { label: 'Price Audit' }]} />

        <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-4">
          <BackButton />
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter period={period} from={range.from} to={range.to} onChange={handlePeriod} />
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ColumnToggle columns={COLUMNS} isVisible={isVisible} onToggle={toggle} onShowAll={showAll} />
            <SavedViews />
            <ExportBtn onPrint={() => window.print()} />
          </div>
        </div>

        {/* Source filter chips */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-gray-500">Change source:</span>
          {SOURCES.map(sc => (
            <button key={sc.key} onClick={() => handleSource(sc.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                source === sc.key ? 'bg-[#1B4F8A] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#1B4F8A]'
              }`}>
              {sc.label}{sc.key && s?.bySource[sc.key] ? ` (${s.bySource[sc.key]})` : ''}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><History className="w-3 h-3" /> Total Changes</p>
            <p className="text-2xl font-bold text-gray-800">{s?.count ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">All PLU price &amp; status changes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-red-500" /> Price Increases</p>
            <p className="text-2xl font-bold text-red-600">{s?.increases ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Selling price went up</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-green-600" /> Price Decreases</p>
            <p className="text-2xl font-bold text-green-700">{s?.decreases ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Selling price went down</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{sorted.length} changes</h2>
            <p className="text-xs text-gray-400">Old price struck through; red = increase, green = decrease</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                  {isVisible('recordedAt')   && <SortableTh column="recordedAt"   label="When"    sort={sort as string} dir={dir} onSort={c => handleSort(c as keyof PriceChange)} />}
                  {isVisible('productName')  && <SortableTh column="productName"  label="Product" sort={sort as string} dir={dir} onSort={c => handleSort(c as keyof PriceChange)} />}
                  {isVisible('pluCode')      && <SortableTh column="pluCode"      label="PLU"     sort={sort as string} dir={dir} onSort={c => handleSort(c as keyof PriceChange)} />}
                  {isVisible('changeSource') && <SortableTh column="changeSource" label="Source"  sort={sort as string} dir={dir} onSort={c => handleSort(c as keyof PriceChange)} />}
                  {isVisible('changedBy')    && <SortableTh column="changedBy"    label="By"      sort={sort as string} dir={dir} onSort={c => handleSort(c as keyof PriceChange)} />}
                  {isVisible('mrpAfter')     && <th className="px-4 py-2.5 text-right font-medium">MRP</th>}
                  {isVisible('sellingPriceAfter') && <SortableTh column="sellingPriceDelta" label="Selling Price" sort={sort as string} dir={dir} onSort={c => handleSort('sellingPriceDelta')} align="right" />}
                  {isVisible('gstRateAfter') && <th className="px-4 py-2.5 text-right font-medium">GST %</th>}
                  {isVisible('notes')        && <th className="px-4 py-2.5 text-left font-medium">Notes</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    {isVisible('recordedAt') && (
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-xs">
                        {fmtDate(c.recordedAt)}
                        {c.effectiveDate.slice(0, 10) !== c.recordedAt.slice(0, 10) && (
                          <span className="block text-gray-400" title="Business date (e.g. GRN invoice date) differs from entry date">
                            eff. {fmtDate(c.effectiveDate)}
                          </span>
                        )}
                      </td>
                    )}
                    {isVisible('productName') && (
                      <td className="px-4 py-2.5">
                        <LinkedProduct id={c.productId} name={c.productName} className="font-medium" />
                        {c.packLabel && <p className="text-xs text-gray-400">{c.packLabel}</p>}
                      </td>
                    )}
                    {isVisible('pluCode') && <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{c.pluCode}</td>}
                    {isVisible('changeSource') && (
                      <td className="px-4 py-2.5">
                        {c.grnId
                          ? <LinkedGrn id={c.grnId} label="GRN" className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[c.changeSource] ?? 'bg-gray-100 text-gray-500'}`} />
                          : <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_BADGE[c.changeSource] ?? 'bg-gray-100 text-gray-500'}`}>{c.changeSource.replace('_', ' ')}</span>}
                      </td>
                    )}
                    {isVisible('changedBy') && <td className="px-4 py-2.5 text-xs text-gray-500">{c.changedBy ?? 'System'}</td>}
                    {isVisible('mrpAfter') && <td className="px-4 py-2.5 text-right"><PriceCell before={c.mrpBefore} after={c.mrpAfter} /></td>}
                    {isVisible('sellingPriceAfter') && <td className="px-4 py-2.5 text-right"><PriceCell before={c.sellingPriceBefore} after={c.sellingPriceAfter} /></td>}
                    {isVisible('gstRateAfter') && (
                      <td className="px-4 py-2.5 text-right text-xs text-gray-600">
                        {c.gstRateBefore != null && c.gstRateAfter != null && Number(c.gstRateBefore) !== Number(c.gstRateAfter)
                          ? <><span className="text-gray-400 line-through mr-1">{Number(c.gstRateBefore)}%</span><span className="font-semibold text-amber-700">{Number(c.gstRateAfter)}%</span></>
                          : c.gstRateAfter != null ? `${Number(c.gstRateAfter)}%` : '—'}
                      </td>
                    )}
                    {isVisible('notes') && <td className="px-4 py-2.5 text-xs text-gray-400 max-w-xs truncate">{c.notes ?? '—'}</td>}
                  </tr>
                ))}
                {!loading && sorted.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-400">No price changes in this period</td></tr>
                )}
                {loading && <tr><td colSpan={9} className="py-12 text-center text-gray-400">Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Complete audit trail of every PLU price and status change. Sources: GRN approval (cost from supplier invoice),
          new PLU creation, manual edits, default-PLU switches, and deactivations.
          &quot;eff.&quot; shows the business date when it differs from the entry date. Statutory note: keep price change
          records for GST audit — MRP changes on packaged goods must comply with Legal Metrology rules. URL is shareable.
        </p>
      </div>
    </div>
  );
}
