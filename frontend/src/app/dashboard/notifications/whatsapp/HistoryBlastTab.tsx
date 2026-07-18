'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Clock, CheckCircle2, Circle, History, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Avatar } from '@/components/shared/Avatar';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LIMIT = 50;

interface BlastCustomer {
  id: string;
  name: string;
  phone: string | null;
  historyToken: string | null;
  historySentAt: string | null;
  _count: { listEntries: number };
}

export default function HistoryBlastTab() {
  const [letter, setLetter] = useState('');
  const [page, setPage]     = useState(1);
  const [customers, setCustomers] = useState<BlastCustomer[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { data } = await api.get('/history/customers/blast-list', {
        params: { letter: letter || undefined, page, limit: LIMIT },
      });
      setCustomers(data.customers ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [letter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [letter]);

  const selectableIds = customers
    .filter(c => c._count.listEntries > 0)
    .map(c => c.id);

  function toggleAll() {
    if (selected.size === selectableIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function sendSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Send history links to ${selected.size} customer${selected.size !== 1 ? 's' : ''}?\n\nThis will send a bilingual WhatsApp message to each. Please confirm before proceeding.`)) return;

    setSending(true);
    let ok = 0;
    let fail = 0;
    const ids = Array.from(selected);

    for (const id of ids) {
      try {
        await api.post(`/history/customers/${id}/send`);
        ok++;
        setJustSent(prev => new Set(Array.from(prev).concat(id)));
      } catch {
        fail++;
      }
      // 300 ms between sends to avoid WhatsApp rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    setSending(false);
    setSelected(new Set());

    if (fail === 0) {
      toast.success(`✅ Sent to ${ok} customer${ok !== 1 ? 's' : ''}`);
    } else {
      toast.error(`Sent ${ok}, failed ${fail} — check Chat tab for errors`);
    }

    load();
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
            Send personalised bilingual shopping-history links to customers via WhatsApp
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
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={11} className="text-green-600" /> Sent — link already delivered
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} className="text-amber-500" /> Ready — has history, not sent yet
        </span>
        <span className="flex items-center gap-1">
          <Circle size={11} className="text-gray-300" /> No history files
        </span>
      </div>

      {/* A–Z filter */}
      <div className="flex flex-wrap gap-1">
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
      </div>

      {/* Count bar */}
      <p className="text-xs text-gray-400">
        {loading
          ? 'Loading…'
          : `${total} customer${total !== 1 ? 's' : ''} with history${letter ? ` — names starting with "${letter}"` : ''}`}
      </p>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

        {/* Select-all header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
          <input
            type="checkbox"
            checked={selectableIds.length > 0 && selected.size === selectableIds.length}
            onChange={toggleAll}
            className="rounded border-gray-300 cursor-pointer"
          />
          <span className="text-xs text-gray-500 font-medium">
            {selected.size > 0 ? `${selected.size} selected` : 'Select all on this page'}
          </span>
        </div>

        {loading ? (
          <div className="py-14 text-center text-sm text-gray-400">Loading customers…</div>
        ) : customers.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-400">
            No customers found{letter ? ` with names starting with "${letter}"` : ''}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {customers.map(c => {
              const status = statusOf(c);
              const canSelect = status !== 'none';
              const isSelected = selected.has(c.id);

              return (
                <div
                  key={c.id}
                  onClick={() => canSelect && toggle(c.id)}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-default
                    ${canSelect ? 'cursor-pointer hover:bg-gray-50/80' : 'opacity-50'}
                    ${isSelected ? 'bg-green-50/50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => canSelect && toggle(c.id)}
                    disabled={!canSelect}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-gray-300 cursor-pointer disabled:opacity-30"
                  />
                  <Avatar seed={c.name || c.phone || '?'} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.phone
                        ? `+91 ${c.phone.replace(/^(\d{5})(\d{5})$/, '$1 $2')}`
                        : 'No phone on record'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs text-gray-400 tabular-nums">
                      {c._count.listEntries} {c._count.listEntries === 1 ? 'entry' : 'entries'}
                    </span>
                    {status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium whitespace-nowrap">
                        <CheckCircle2 size={10} /> Sent
                      </span>
                    ) : status === 'ready' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium whitespace-nowrap">
                        <Clock size={10} /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200 font-medium whitespace-nowrap">
                        <Circle size={10} /> No history
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages}
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
