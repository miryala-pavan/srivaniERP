'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode, type MouseEvent } from 'react';
import {
  Send, Clock, CheckCircle2, Circle, History,
  RefreshCw, Search, ExternalLink, X,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Avatar } from '@/components/shared/Avatar';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LIMIT = 50;

type Status = 'all' | 'ready' | 'sent';
type Sort =
  | 'name_asc'    | 'name_desc'
  | 'phone_asc'   | 'phone_desc'
  | 'entries_asc' | 'entries_desc'
  | 'sent_asc'    | 'sent_desc';

type WaStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

interface BlastCustomer {
  id: string;
  name: string;
  phone: string | null;
  historyToken: string | null;
  historyUrl: string | null;
  historySentAt: string | null;
  waStatus: WaStatus | null;
  _count: { listEntries: number };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function fmtPhone(phone: string | null): string {
  if (!phone) return '—';
  return `+91 ${phone.replace(/^(\d{5})(\d{5})$/, '$1 $2')}`;
}

const WA_STATUS: Record<WaStatus, { label: string; cls: string }> = {
  QUEUED:    { label: 'Queued',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  SENT:      { label: 'Sent ✓',   cls: 'bg-sky-50 text-sky-600 border-sky-200' },
  DELIVERED: { label: 'Delivered', cls: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  READ:      { label: 'Read ✓✓',  cls: 'bg-green-50 text-green-700 border-green-200' },
  FAILED:    { label: 'Failed',    cls: 'bg-red-50 text-red-600 border-red-200' },
};

function WaStatusBadge({ status }: { status: WaStatus | null }) {
  if (!status) return <span className="text-gray-300 text-xs select-none">—</span>;
  const cfg = WA_STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200' };
  return (
    <span className={`inline-flex text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function parseSortKey(sort: Sort): { col: string; dir: 'asc' | 'desc' } {
  const i = sort.lastIndexOf('_');
  return { col: sort.substring(0, i), dir: sort.substring(i + 1) as 'asc' | 'desc' };
}

function SortTh({
  col, children, sort, onSort, className = '',
}: {
  col: string; children: ReactNode; sort: Sort; onSort: (col: string) => void; className?: string;
}) {
  const { col: activeCol, dir } = parseSortKey(sort);
  const isActive = activeCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider
        cursor-pointer select-none whitespace-nowrap hover:text-gray-800 transition-colors ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive
          ? dir === 'asc'
            ? <ChevronUp   size={11} className="text-green-600 shrink-0" />
            : <ChevronDown size={11} className="text-green-600 shrink-0" />
          : <ChevronsUpDown size={11} className="text-gray-300 shrink-0" />
        }
      </span>
    </th>
  );
}

export default function HistoryBlastTab() {
  const [search, setSearch]   = useState('');
  const [dSearch, setDSearch] = useState('');
  const [letter, setLetter]   = useState('');
  const [status, setStatus]   = useState<Status>('all');
  const [sort, setSort]       = useState<Sort>('name_asc');
  const [page, setPage]       = useState(1);

  const [customers, setCustomers] = useState<BlastCustomer[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending]       = useState(false);
  const [justSent, setJustSent]     = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState<Set<string>>(new Set());

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDSearch(search);
      if (search) setLetter('');
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => { setPage(1); }, [dSearch, letter, status, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { data } = await api.get('/history/customers/blast-list', {
        params: {
          search: dSearch || undefined,
          letter: (!dSearch && letter) ? letter : undefined,
          status,
          sort,
          page,
          limit: LIMIT,
        },
      });
      setCustomers(data.customers ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [dSearch, letter, status, sort, page]);

  useEffect(() => { load(); }, [load]);

  const selectableIds = customers
    .filter(c => c._count.listEntries > 0)
    .map(c => c.id);

  function toggleAll() {
    setSelected(prev =>
      prev.size === selectableIds.length ? new Set() : new Set(selectableIds)
    );
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSort(col: string) {
    setSort(prev => {
      const { col: prevCol, dir: prevDir } = parseSortKey(prev);
      if (prevCol === col) {
        return `${col}_${prevDir === 'asc' ? 'desc' : 'asc'}` as Sort;
      }
      // Default direction: desc for entries/sent, asc for name/phone
      return `${col}_${col === 'entries' || col === 'sent' ? 'desc' : 'asc'}` as Sort;
    });
  }

  async function sendSelected() {
    if (selected.size === 0) return;
    if (!confirm(
      `Send history links to ${selected.size} customer${selected.size !== 1 ? 's' : ''}?\n\n` +
      `A bilingual Telugu+English WhatsApp message will be sent to each. Confirm?`
    )) return;

    setSending(true);
    let ok = 0, fail = 0;
    const ids = Array.from(selected);

    for (const id of ids) {
      try {
        await api.post(`/history/customers/${id}/send`);
        ok++;
        setJustSent(prev => new Set(Array.from(prev).concat(id)));
      } catch {
        fail++;
      }
      await new Promise(r => setTimeout(r, 300));
    }

    setSending(false);
    setSelected(new Set());

    if (fail === 0) toast.success(`✅ Sent to ${ok} customer${ok !== 1 ? 's' : ''}`);
    else toast.error(`Sent ${ok}, failed ${fail} — check Chat tab for errors`);

    load();
  }

  async function openHistory(c: BlastCustomer, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (c.historyUrl) {
      window.open(c.historyUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewLoading(prev => new Set(Array.from(prev).concat(c.id)));
    try {
      const { data } = await api.post(`/history/customers/${c.id}/preview`);
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        setCustomers(prev => prev.map(x =>
          x.id === c.id ? { ...x, historyUrl: data.url, historyToken: data.token } : x
        ));
      }
    } catch {
      toast.error('Could not generate preview link');
    } finally {
      setPreviewLoading(prev => { const n = new Set(prev); n.delete(c.id); return n; });
    }
  }

  function statusOf(c: BlastCustomer): 'sent' | 'ready' | 'none' {
    if (c._count.listEntries === 0) return 'none';
    if (justSent.has(c.id) || c.historySentAt) return 'sent';
    return 'ready';
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <History size={16} className="text-green-600" />
            History Blast
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Verify each customer's history first, then select and send bilingual WhatsApp links in batches
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selected.size > 0 && (
            <button
              onClick={sendSelected}
              disabled={sending}
              className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              <Send size={13} />
              {sending ? 'Sending…' : `Send to ${selected.size}`}
            </button>
          )}
          <button onClick={load} disabled={loading} className="btn-outline flex items-center gap-1.5 text-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            className="input text-sm pl-8 pr-7 h-8"
            placeholder="Search name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs font-medium">
          {(['all', 'ready', 'sent'] as Status[]).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 border-r last:border-r-0 border-gray-200 transition-colors
                ${status === s ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {s === 'all' ? 'All' : s === 'ready' ? '🟡 Ready' : '✅ Sent'}
            </button>
          ))}
        </div>
      </div>

      {/* A–Z filter */}
      <div className={`flex flex-wrap gap-1 transition-opacity ${dSearch ? 'opacity-30 pointer-events-none' : ''}`}>
        <button
          onClick={() => setLetter('')}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors
            ${letter === '' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          All
        </button>
        {ALPHABET.map(l => (
          <button
            key={l}
            onClick={() => setLetter(l)}
            className={`text-xs w-7 py-1 rounded-lg border font-medium transition-colors
              ${letter === l ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {l}
          </button>
        ))}
        {dSearch && (
          <span className="text-xs text-gray-400 self-center ml-1">A–Z disabled while searching</span>
        )}
      </div>

      {/* Count + legend */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-400">
          {loading ? 'Loading…' : (
            <>
              <span className="font-medium text-gray-700">{total}</span>
              {` customer${total !== 1 ? 's' : ''}${
                status !== 'all' ? ` — ${status}` : ''
              }${letter && !dSearch ? ` — starting with "${letter}"` : ''}${
                dSearch ? ` — matching "${dSearch}"` : ''
              }`}
            </>
          )}
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-green-600" /> Sent</span>
          <span className="flex items-center gap-1"><Clock size={11} className="text-amber-500" /> Ready</span>
          <span className="flex items-center gap-1"><Circle size={11} className="text-gray-300" /> No history</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                {/* Checkbox */}
                <th className="w-10 px-3 py-2.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={selectableIds.length > 0 && selected.size === selectableIds.length}
                    onChange={toggleAll}
                    className="rounded border-gray-300 cursor-pointer"
                    title="Select all on this page"
                  />
                </th>
                {/* Avatar spacer */}
                <th className="w-9 px-1 py-2.5" />
                <SortTh col="name"    sort={sort} onSort={handleSort}>Name</SortTh>
                <SortTh col="phone"   sort={sort} onSort={handleSort}>Phone</SortTh>
                <SortTh col="entries" sort={sort} onSort={handleSort}>Entries</SortTh>
                <SortTh col="sent"    sort={sort} onSort={handleSort}>Status</SortTh>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  WA Delivery
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-sm text-gray-400">Loading…</td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-sm text-gray-400">
                    No customers found
                    {dSearch ? ` matching "${dSearch}"` : letter ? ` starting with "${letter}"` : ''}
                  </td>
                </tr>
              ) : customers.map(c => {
                const st = statusOf(c);
                const canSelect = st !== 'none';
                const isSelected = selected.has(c.id);

                return (
                  <tr
                    key={c.id}
                    onClick={() => canSelect && toggle(c.id)}
                    className={`transition-colors
                      ${canSelect ? 'cursor-pointer hover:bg-gray-50/80' : 'opacity-50 cursor-default'}
                      ${isSelected ? 'bg-green-50/50' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => canSelect && toggle(c.id)}
                        disabled={!canSelect}
                        onClick={e => e.stopPropagation()}
                        className="rounded border-gray-300 cursor-pointer disabled:opacity-30"
                      />
                    </td>

                    {/* Avatar */}
                    <td className="w-9 px-0 py-2">
                      <Avatar seed={c.name || c.phone || '?'} size="sm" />
                    </td>

                    {/* Name — clickable for any customer with entries */}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      {c._count.listEntries > 0 ? (
                        <button
                          type="button"
                          onClick={e => openHistory(c, e)}
                          disabled={previewLoading.has(c.id)}
                          title={`Preview ${c.name}'s history before sending`}
                          className="text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 group text-left min-w-0 disabled:opacity-50"
                        >
                          <span className="truncate">{c.name}</span>
                          {previewLoading.has(c.id)
                            ? <RefreshCw size={11} className="shrink-0 animate-spin" />
                            : <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          }
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-gray-900 truncate block">{c.name}</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums whitespace-nowrap">
                      {fmtPhone(c.phone)}
                    </td>

                    {/* Entries */}
                    <td className="px-3 py-2.5 text-xs text-gray-500 tabular-nums">
                      {c._count.listEntries}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      {st === 'sent' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium whitespace-nowrap">
                            <CheckCircle2 size={10} /> Sent
                          </span>
                          {c.historySentAt && (
                            <p className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">{fmtDate(c.historySentAt)}</p>
                          )}
                        </div>
                      ) : st === 'ready' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium whitespace-nowrap">
                          <Clock size={10} /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200 font-medium whitespace-nowrap">
                          <Circle size={10} /> No history
                        </span>
                      )}
                    </td>

                    {/* WA Delivery */}
                    <td className="px-3 py-2.5">
                      <WaStatusBadge status={c.waStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} total
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages || loading}
              className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
