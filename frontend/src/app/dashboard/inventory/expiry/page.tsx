'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, AlertOctagon, Clock, Eye, PackageX,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

type Urgency = 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'WATCH' | 'UNKNOWN';

interface ExpiryBatch {
  id: string;
  batchNumber: string | null;
  expiryDate: string | null;
  daysLeft: number | null;
  urgency: Urgency;
  remainingQty: number;
  costPrice: number;
  rackLocation: string | null;
  product: {
    id: string;
    name: string;
    productCode: string | null;
    category: string | null;
    unitOfMeasure: string;
  };
}

const URGENCY_CONFIG: Record<Urgency, { label: string; bg: string; text: string; border: string; icon: any }> = {
  EXPIRED:  { label: 'Expired',         bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',   icon: PackageX },
  CRITICAL: { label: 'Critical (<7d)',  bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200',icon: AlertOctagon },
  WARNING:  { label: 'Warning (7-14d)', bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200', icon: AlertTriangle },
  WATCH:    { label: 'Watch (14-30d)',  bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',  icon: Eye },
  UNKNOWN:  { label: 'Unknown',         bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200',  icon: Clock },
};

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export default function ExpiryPage() {
  const [days, setDays]       = useState(30);
  const [filter, setFilter]   = useState<Urgency | 'ALL'>('ALL');
  const [search, setSearch]   = useState('');

  const { data = [], isLoading } = useQuery<ExpiryBatch[]>({
    queryKey: ['inventory', 'expiry', days],
    queryFn:  () => api.get('/inventory/expiry', { params: { days } }).then(r => r.data),
    staleTime: 60_000,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data.length, EXPIRED: 0, CRITICAL: 0, WARNING: 0, WATCH: 0 };
    for (const b of data) c[b.urgency] = (c[b.urgency] ?? 0) + 1;
    return c;
  }, [data]);

  const totalValue = useMemo(
    () => data.reduce((s, b) => s + b.remainingQty * b.costPrice, 0),
    [data],
  );

  const filtered = useMemo(() => {
    let rows = filter === 'ALL' ? data : data.filter(b => b.urgency === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(b =>
        b.product.name.toLowerCase().includes(q) ||
        (b.product.productCode?.toLowerCase().includes(q)) ||
        (b.batchNumber?.toLowerCase().includes(q)) ||
        (b.product.category?.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [data, filter, search]);

  return (
    <>
      <Header title="Expiry Tracker" />

      <main className="flex-1 p-6 space-y-5">
        {/* Horizon filter + search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  days === d ? 'bg-[#1B4F8A] text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search product or batch…"
            className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B4F8A]"
          />

          <div className="ml-auto text-sm text-gray-500">
            Total at-risk value: <span className="font-semibold text-gray-800">Rs.{inr(totalValue)}</span>
          </div>
        </div>

        {/* Urgency tabs */}
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'EXPIRED', 'CRITICAL', 'WARNING', 'WATCH'] as const).map(u => {
            const cfg = u === 'ALL' ? null : URGENCY_CONFIG[u];
            const active = filter === u;
            return (
              <button
                key={u}
                onClick={() => setFilter(u)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  active
                    ? u === 'ALL'
                      ? 'bg-[#1B4F8A] text-white border-[#1B4F8A]'
                      : `${cfg!.bg} ${cfg!.text} ${cfg!.border}`
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {cfg && <cfg.icon className="w-3.5 h-3.5" />}
                {u === 'ALL' ? 'All' : cfg!.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-white/30' : 'bg-gray-100 text-gray-500'
                }`}>
                  {counts[u] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-sm">
                {data.length === 0
                  ? `No batches expiring within ${days} days`
                  : 'No items match your filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Batch #</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Expiry</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Value</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Rack</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(b => {
                    const cfg = URGENCY_CONFIG[b.urgency];
                    const Icon = cfg.icon;
                    return (
                      <tr key={b.id} className={`hover:bg-gray-50 ${b.urgency === 'EXPIRED' ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{b.product.name}</p>
                          {b.product.productCode && (
                            <p className="text-xs text-gray-400 font-mono">{b.product.productCode}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                          {b.product.category ?? '—'}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-gray-500">
                          {b.batchNumber ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <p className={`font-medium text-sm ${b.urgency === 'EXPIRED' ? 'text-red-600' : 'text-gray-800'}`}>
                            {fmtDate(b.expiryDate)}
                          </p>
                          <p className={`text-xs mt-0.5 ${
                            b.daysLeft === null ? 'text-gray-400'
                            : b.daysLeft <= 0  ? 'text-red-500 font-medium'
                            : b.daysLeft <= 7  ? 'text-orange-600'
                            : 'text-gray-400'
                          }`}>
                            {b.daysLeft === null ? '' : b.daysLeft <= 0 ? `${Math.abs(b.daysLeft)}d ago` : `${b.daysLeft}d left`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700">
                          {b.remainingQty.toFixed(b.remainingQty % 1 === 0 ? 0 : 2)} {b.product.unitOfMeasure}
                        </td>
                        <td className="px-4 py-3 text-right hidden xl:table-cell text-gray-600 text-xs">
                          Rs.{inr(b.remainingQty * b.costPrice)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                          {b.rackLocation ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            Showing {filtered.length} batch{filtered.length !== 1 ? 'es' : ''} · Only batches with remaining stock are shown
          </p>
        )}
      </main>
    </>
  );
}
