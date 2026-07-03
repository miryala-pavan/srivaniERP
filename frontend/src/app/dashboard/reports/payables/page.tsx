'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Phone, TrendingDown } from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';
import { EntityLink } from '@/components/shared/EntityLink';

interface PayablesRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  outstanding: number;
  paymentTermsDays: number | null;
  oldestInvoiceDate: string | null;
  latestInvoiceDate: string | null;
  lastPaymentDate:   string | null;
  daysOld: number;
  bucket:  'current' | 'd30_60' | 'd61_90' | 'd90plus';
  current: number;
  d30_60:  number;
  d61_90:  number;
  d90plus: number;
}

interface PayablesData {
  rows:   PayablesRow[];
  totals: { current: number; d30_60: number; d61_90: number; d90plus: number; total: number };
}

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const BUCKETS = [
  { key: 'current' as const, label: '0–30 days',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  { key: 'd30_60' as const,  label: '31–60 days', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  { key: 'd61_90' as const,  label: '61–90 days', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  { key: 'd90plus' as const, label: '90+ days',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
];

export default function PayablesAgingPage() {
  const [search, setSearch]         = useState('');
  const [bucketFilter, setBucket]   = useState<'ALL' | 'current' | 'd30_60' | 'd61_90' | 'd90plus'>('ALL');

  const { data, isLoading } = useQuery<PayablesData>({
    queryKey: ['suppliers', 'payables-aging'],
    queryFn:  () => api.get('/suppliers/payables-aging').then(r => r.data),
    staleTime: 60_000,
  });

  const rows   = data?.rows   ?? [];
  const totals = data?.totals ?? { current: 0, d30_60: 0, d61_90: 0, d90plus: 0, total: 0 };

  const filtered = useMemo(() => {
    let r = bucketFilter === 'ALL' ? rows : rows.filter(x => x.bucket === bucketFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x => x.name.toLowerCase().includes(q) || x.phone?.includes(q));
    }
    return r;
  }, [rows, bucketFilter, search]);

  const overdue = rows.filter(r => r.bucket !== 'current').reduce((s, r) => s + r.outstanding, 0);

  return (
    <>
      <Header title="Payables Aging" />

      <main className="flex-1 p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="md:col-span-1 bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 mb-1">Total Payable</p>
            <p className="text-xl font-bold text-gray-800">Rs.{inr(totals.total)}</p>
            {overdue > 0 && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Rs.{inr(overdue)} overdue
              </p>
            )}
          </div>
          {BUCKETS.map(b => (
            <button
              key={b.key}
              onClick={() => setBucket(prev => prev === b.key ? 'ALL' : b.key)}
              className={`bg-white rounded-xl border px-5 py-4 text-left transition-all ${
                bucketFilter === b.key ? `${b.bg} ${b.border}` : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">{b.label}</p>
              <p className={`text-lg font-semibold ${totals[b.key] > 0 ? b.color : 'text-gray-400'}`}>
                Rs.{inr(totals[b.key])}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {rows.filter(r => r.bucket === b.key).length} supplier{rows.filter(r => r.bucket === b.key).length !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search supplier…"
            className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
          />
          {bucketFilter !== 'ALL' && (
            <button onClick={() => setBucket('ALL')} className="text-xs text-[#1B4F8A] hover:underline">
              Clear filter
            </button>
          )}
          <span className="ml-auto text-sm text-gray-400">
            {filtered.length} supplier{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingDown className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {rows.length === 0 ? 'No outstanding payables' : 'No suppliers match your filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Outstanding</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">0–30d</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">31–60d</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">61–90d</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">90+d</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Oldest Invoice</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Last Payment</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => {
                    const bucket = BUCKETS.find(b => b.key === r.bucket)!;
                    const isOld  = r.bucket === 'd90plus';
                    return (
                      <tr key={r.id} className={`hover:bg-gray-50 ${isOld ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <EntityLink type="supplier" id={r.id} className="font-medium text-gray-800">
                            {r.name}
                          </EntityLink>
                          {r.phone && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />{r.phone}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${isOld ? 'text-red-600' : 'text-gray-800'}`}>
                            Rs.{inr(r.outstanding)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell text-gray-600 text-xs">
                          {r.current > 0 ? `Rs.${inr(r.current)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell text-xs text-amber-700">
                          {r.d30_60 > 0 ? `Rs.${inr(r.d30_60)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-orange-700">
                          {r.d61_90 > 0 ? `Rs.${inr(r.d61_90)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell text-xs text-red-600 font-medium">
                          {r.d90plus > 0 ? `Rs.${inr(r.d90plus)}` : '—'}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500">
                          {fmtDate(r.oldestInvoiceDate)}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500">
                          {fmtDate(r.lastPaymentDate)}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bucket.bg} ${bucket.color}`}>
                            {r.daysOld}d
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtered.length > 1 && (
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-700">Total ({filtered.length})</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">
                        Rs.{inr(filtered.reduce((s, r) => s + r.outstanding, 0))}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-xs font-medium text-gray-600">
                        Rs.{inr(filtered.reduce((s, r) => s + r.current, 0))}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-xs font-medium text-amber-700">
                        Rs.{inr(filtered.reduce((s, r) => s + r.d30_60, 0))}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-xs font-medium text-orange-700">
                        Rs.{inr(filtered.reduce((s, r) => s + r.d61_90, 0))}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell text-xs font-medium text-red-600">
                        Rs.{inr(filtered.reduce((s, r) => s + r.d90plus, 0))}
                      </td>
                      <td colSpan={3} className="hidden xl:table-cell"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {!isLoading && rows.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            Age buckets are based on the oldest outstanding invoice date per supplier
          </p>
        )}
      </main>
    </>
  );
}
