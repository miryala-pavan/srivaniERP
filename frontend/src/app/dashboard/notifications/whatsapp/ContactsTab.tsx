'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Search, MessageCircle, Phone as PhoneIcon, Send, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { OptInBadge } from '@/components/shared/OptInBadge';
import { Avatar } from '@/components/shared/Avatar';

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  whatsappOptIn: boolean;
  googleSync: { syncEnabled: boolean } | null;
}

interface Conversation {
  phone: string;
}

interface ContactsTabProps {
  onOpenContact: (phone: string, hasThread: boolean, name?: string) => void;
  onBulkSend: (ids: string[]) => void;
}

// "Not reviewed" is a pragmatic proxy for whatsappOptIn=false — consentGivenAt
// is null for virtually the entire imported contact base, so it can't yet
// distinguish "reviewed and declined" from "never touched". Treat this filter
// as a starting point for review, not a claim every row here was actively declined.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in',  label: 'Opted in' },
  { key: 'out', label: 'Not reviewed' },
] as const;

export default function ContactsTab({ onOpenContact, onBulkSend }: ContactsTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  // Deliberately no "select all matching filter" mode here (unlike the
  // Customers page's bulk opt-in) — a message send is a bigger blast radius
  // than a reversible opt-in toggle, so selection stays capped and explicit.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const LIMIT = 30;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [debouncedSearch, filter]);

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  const { data, isLoading } = useQuery({
    queryKey: ['contacts-tab-customers', { page, search: debouncedSearch, filter }],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: {
          page, limit: LIMIT,
          search: debouncedSearch || undefined,
          whatsappOptIn: filter === 'all' ? undefined : filter === 'in' ? 'true' : 'false',
        },
      });
      return res.data as { data: Contact[]; meta: { totalPages: number; total: number } };
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // Fetched once and reused across pages/filters — which phones already have
  // a chat thread rarely changes mid-session, so no need to refetch per page.
  const { data: conversations = [] } = useQuery({
    queryKey: ['contacts-tab-conversations'],
    queryFn: async () => {
      const res = await api.get('/notifications/whatsapp/conversations');
      return (res.data as Conversation[]) ?? [];
    },
    staleTime: 60_000,
  });
  const threadPhones = useMemo(() => new Set(conversations.map((c) => c.phone)), [conversations]);

  const contacts    = data?.data ?? [];
  const totalPages  = data?.meta.totalPages ?? 1;
  const total       = data?.meta.total ?? 0;

  const toggleOptIn = useMutation({
    mutationFn: ({ id, whatsappOptIn }: { id: string; whatsappOptIn: boolean }) =>
      api.put(`/customers/${id}`, { whatsappOptIn }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts-tab-customers'] }),
    onError: () => toast.error('Failed to update opt-in status'),
  });

  const toggleGoogleSync = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/google-contacts/customers/${id}/sync-enabled`, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts-tab-customers'] }),
    onError: () => toast.error('Failed to update Google sync — is Google Contacts connected in Settings?'),
  });

  const bulkGoogleSync = useMutation({
    mutationFn: (ids: string[]) => api.post('/google-contacts/customers/bulk/sync-enabled', { ids, enabled: true }),
    onSuccess: (res) => {
      toast.success(`Synced ${res.data.succeeded}/${res.data.requested} contact(s) to Google`);
      queryClient.invalidateQueries({ queryKey: ['contacts-tab-customers'] });
    },
    onError: () => toast.error('Bulk Google sync failed — is Google Contacts connected in Settings?'),
  });

  // Sticky alphabetical grouping — computed from this page's already
  // name-sorted results, so it can split across a page boundary. Acceptable
  // for v1; fetching all contacts at once to group perfectly isn't worth it.
  let lastLetter = '';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap px-5 py-4 border-b border-gray-100">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pr-3 pl-8 text-sm w-full rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] focus:ring-2 focus:ring-[#1B4F8A]/10 outline-none transition-colors placeholder:text-gray-400"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f.key ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{total} contact{total !== 1 ? 's' : ''}</span>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-green-50 border-b border-green-100">
          <span className="text-sm font-medium text-green-800">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkGoogleSync.mutate(Array.from(selectedIds))}
            disabled={bulkGoogleSync.isPending}
            className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
          >
            <RefreshCw size={12} /> Sync to Google
          </button>
          <button
            onClick={() => { onBulkSend(Array.from(selectedIds)); clearSelection(); }}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            <Send size={12} /> Send template to selected
          </button>
          <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 text-xs underline">
            Clear
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          {search ? 'No contacts match your search' : 'No contacts found'}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {contacts.map((c) => {
            const letter = (c.name || '#').slice(0, 1).toUpperCase();
            const showHeader = letter !== lastLetter;
            lastLetter = letter;
            const hasThread = !!c.phone && threadPhones.has(`91${c.phone}`);

            return (
              <div key={c.id}>
                {showHeader && (
                  <div className="px-5 py-1.5 bg-gray-50/70 text-[11px] font-semibold text-gray-400 uppercase tracking-wide sticky top-0">
                    {letter}
                  </div>
                )}
                <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleRow(c.id)}
                    disabled={!c.phone || !c.whatsappOptIn}
                    title={!c.whatsappOptIn ? 'Not opted in for WhatsApp marketing — opt in first to include in a bulk send' : undefined}
                    className="rounded border-gray-300 shrink-0 disabled:opacity-30"
                  />
                  <Avatar seed={c.name || c.phone || '?'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    {c.phone && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <PhoneIcon size={10} /> {c.phone}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => c.phone && toggleOptIn.mutate({ id: c.id, whatsappOptIn: !c.whatsappOptIn })}
                    disabled={!c.phone || toggleOptIn.isPending}
                    className="shrink-0 disabled:opacity-50"
                    title="Toggle WhatsApp marketing opt-in"
                  >
                    <OptInBadge on={c.whatsappOptIn} />
                  </button>
                  <button
                    onClick={() => toggleGoogleSync.mutate({ id: c.id, enabled: !c.googleSync?.syncEnabled })}
                    disabled={toggleGoogleSync.isPending}
                    className={`shrink-0 p-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      c.googleSync?.syncEnabled
                        ? 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
                        : 'border-gray-200 text-gray-300 hover:text-gray-400'
                    }`}
                    title={c.googleSync?.syncEnabled ? 'Synced with Google Contacts — click to stop' : 'Not synced with Google Contacts — click to sync'}
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button
                    onClick={() => c.phone && onOpenContact(c.phone, hasThread, c.name)}
                    disabled={!c.phone}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <MessageCircle size={12} /> {hasThread ? 'Open chat' : 'Message'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-gray-100">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                p === page ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-100 hover:border-green-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
