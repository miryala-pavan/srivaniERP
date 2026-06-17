'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Header from '@/components/layout/Header';
import { History, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityRef?: string;
  description: string;
  userName: string;
  userRole: string;
  createdAt: string;
}

interface AuditResponse {
  rows: AuditRow[];
  total: number;
}

const ENTITY_OPTS = [
  { value: 'ALL',          label: 'All' },
  { value: 'BILL',         label: 'Bills' },
  { value: 'CREDIT_NOTE',  label: 'Credit Notes' },
  { value: 'GRN',          label: 'GRN' },
  { value: 'PRODUCT',      label: 'Products' },
  { value: 'CUSTOMER',     label: 'Customers' },
  { value: 'SUPPLIER',     label: 'Suppliers' },
  { value: 'EXPENSE',      label: 'Expenses' },
  { value: 'ONLINE_ORDER', label: 'Online Orders' },
  { value: 'USER',         label: 'Users' },
  { value: 'SETTINGS',     label: 'Settings' },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE:        'bg-green-100 text-green-700',
  UPDATE:        'bg-blue-100 text-blue-700',
  DELETE:        'bg-red-100 text-red-700',
  APPROVE:       'bg-emerald-100 text-emerald-700',
  REJECT:        'bg-orange-100 text-orange-700',
  STATUS_CHANGE: 'bg-purple-100 text-purple-700',
  PRINT:         'bg-gray-100 text-gray-600',
  LOGIN:         'bg-indigo-100 text-indigo-700',
};

const PAGE_SIZE = 50;

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function ActivityLogPage() {
  const [entity,   setEntity]   = useState('ALL');
  const [search,   setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [page,     setPage]     = useState(0);

  const params = {
    entity: entity !== 'ALL' ? entity : undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  };

  const { data, isLoading, refetch } = useQuery<AuditResponse>({
    queryKey: ['audit-log', params],
    queryFn:  async () => {
      const { data } = await api.get('/audit-log', { params });
      return data;
    },
    staleTime: 30_000,
  });

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  const today = () => {
    const t = new Date().toISOString().slice(0, 10);
    setDateFrom(t);
    setDateTo(t);
    setPage(0);
  };

  const reset = useCallback(() => {
    setEntity('ALL');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Header title="Activity Log" icon={<History className="w-5 h-5" />} />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select
            value={entity}
            onChange={e => { setEntity(e.target.value); setPage(0); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ENTITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <button onClick={today} className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium">
          Today
        </button>

        <div className="flex-1 min-w-[200px] relative">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search description, user, ref…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button onClick={reset} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
          Clear
        </button>

        <button onClick={() => refetch()} className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {isLoading ? 'Loading…' : `${total.toLocaleString()} records`}
        </p>
        {pages > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-gray-600">Page {page + 1} of {pages}</span>
            <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No activity found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Done by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{formatTime(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[row.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{row.entity.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-800">{row.description}</td>
                  <td className="px-4 py-3 text-blue-600 font-mono text-xs">{row.entityRef ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800 font-medium text-xs">{row.userName}</div>
                    <div className="text-gray-400 text-[10px]">{row.userRole}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
