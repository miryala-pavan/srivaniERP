'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import api from '@/lib/api';
import Header from '@/components/layout/Header';
import { SettlementBadge } from '@/components/shared/SettlementBadge';

const n = (v: unknown) => Number(v) || 0;
const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const SETTLEMENT_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'ADJUST_BALANCE', label: 'Adjust Balance' },
  { value: 'REPLACEMENT', label: 'Replacement Stock' },
  { value: 'REFUND', label: 'Cash / Bank Refund' },
];

const SETTLEMENT_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SETTLED', label: 'Settled' },
];

type SortKey = 'debitNoteDate' | 'debitNoteNumber' | 'totalAmount' | 'settlementStatus' | 'settlementType';

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'debitNoteNumber', label: 'DN #' },
  { key: 'debitNoteDate',   label: 'Date' },
  { key: 'totalAmount',     label: 'Amount', align: 'right' },
  { key: 'settlementType',  label: 'Settlement Type' },
  { key: 'settlementStatus', label: 'Status' },
];

export default function DebitNotesListPage() {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [reason, setReason] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplier, setSupplier] = useState<{ id: string; name: string } | null>(null);
  const [settlementType, setSettlementType] = useState('');
  const [settlementStatus, setSettlementStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'debitNoteDate', dir: 'desc' });

  const { data: supplierResults } = useQuery({
    queryKey: ['suppliers-typeahead', supplierSearch],
    queryFn: () => api.get('/suppliers', { params: { search: supplierSearch, limit: 8 } }).then(r => r.data),
    enabled: supplierSearch.trim().length >= 2 && !supplier,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['debit-notes', { page, reason, supplierId: supplier?.id, settlementType, settlementStatus, dateFrom, dateTo, sort }],
    queryFn: () => api.get('/grn/debit-notes', {
      params: {
        page, limit: 20,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(supplier ? { supplierId: supplier.id } : {}),
        ...(settlementType ? { settlementType } : {}),
        ...(settlementStatus ? { settlementStatus } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        sortBy: sort.key, sortDir: sort.dir,
      },
    }).then(r => r.data),
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, totalPages: 1 };

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
    setPage(1);
  }

  function clearFilters() {
    setReason(''); setSupplierSearch(''); setSupplier(null);
    setSettlementType(''); setSettlementStatus(''); setDateFrom(''); setDateTo('');
    setPage(1);
  }

  const hasFilters = !!(reason || supplier || settlementType || settlementStatus || dateFrom || dateTo);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Purchase Returns" />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">

        <div>
          <h1 className="text-lg font-semibold text-gray-900">Purchase Returns</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Debit notes issued for damage, expiry, shortage, or quality returns to suppliers — across every supplier.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1 relative">
              <label className="text-xs font-medium text-gray-600">Supplier</label>
              {supplier ? (
                <div className="flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50">
                  <span className="truncate">{supplier.name}</span>
                  <button onClick={() => { setSupplier(null); setSupplierSearch(''); }} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={supplierSearch}
                      onChange={(e) => { setSupplierSearch(e.target.value); setPage(1); }}
                      placeholder="Search supplier…"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
                    />
                  </div>
                  {supplierSearch.trim().length >= 2 && (supplierResults?.data?.length ?? 0) > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {supplierResults.data.map((s: any) => (
                        <button key={s.id} type="button"
                          onClick={() => { setSupplier({ id: s.id, name: s.name }); setSupplierSearch(''); setPage(1); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Reason contains</label>
              <input value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }}
                placeholder="e.g. damaged, expired…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Settlement Type</label>
              <select value={settlementType} onChange={(e) => { setSettlementType(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
                {SETTLEMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Settlement Status</label>
              <select value={settlementStatus} onChange={(e) => { setSettlementStatus(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]">
                {SETTLEMENT_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">From</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">To</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]" />
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <button onClick={clearFilters}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No purchase returns found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-medium">Supplier</th>
                      {COLUMNS.map((c) => (
                        <th key={c.key}
                          onClick={() => toggleSort(c.key)}
                          className={`px-4 py-2.5 font-medium cursor-pointer select-none hover:text-gray-700 ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                        >
                          <span className={`flex items-center gap-1 ${c.align === 'right' ? 'justify-end' : ''}`}>
                            {c.label}
                            {sort.key === c.key
                              ? (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-left font-medium">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((dn: any) => (
                      <tr key={dn.id} onClick={() => router.push(`/dashboard/debit-notes/${dn.id}`)}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                        <td className="px-4 py-2.5 text-gray-700">{dn.supplier?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#1B4F8A]">{dn.debitNoteNumber}</td>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(dn.debitNoteDate)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">Rs. {inr(n(dn.totalAmount))}</td>
                        <td className="px-4 py-2.5">
                          <SettlementBadge type={dn.settlementType} status={dn.settlementStatus} />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dn.status === 'ISSUED' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {dn.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{dn.items?.length ?? 0} item{(dn.items?.length ?? 0) !== 1 ? 's' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
                  <span className="text-xs text-gray-400">{meta.total} total</span>
                  <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs">Page {page} of {meta.totalPages}</span>
                    <button disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
