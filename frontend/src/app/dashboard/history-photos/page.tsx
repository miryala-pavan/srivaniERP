'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { History, Search, X, Pencil, Trash2, Save, Loader2, ChevronLeft, ChevronRight, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import api from '@/lib/api';

interface EntryCustomer {
  id: string;
  name: string;
  phone: string | null;
}

interface Entry {
  id: string;
  entryDate: string;
  pageCount: number;
  source: string;
  imagePaths: string[];
  imageUrls: string[];
  customer: EntryCustomer;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
  customerCode: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function HistoryPhotosAdminPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editPaths, setEditPaths] = useState<string[]>([]);
  const [editUrls, setEditUrls] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reassign-customer picker (within the edit panel)
  const [reassignQuery, setReassignQuery] = useState('');
  const [reassignResults, setReassignResults] = useState<CustomerOption[]>([]);
  const [reassignTarget, setReassignTarget] = useState<CustomerOption | null>(null);
  const [showReassignDrop, setShowReassignDrop] = useState(false);
  const reassignTimer = useRef<ReturnType<typeof setTimeout>>();

  function onSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setDebouncedSearch(val); }, 300);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/history/admin/entries', {
        params: { search: debouncedSearch || undefined, page, limit },
      });
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error('Failed to load history entries');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setEditDate(toDateInputValue(entry.entryDate));
    setEditPaths([...entry.imagePaths]);
    setEditUrls([...entry.imageUrls]);
    setReassignTarget(null);
    setReassignQuery('');
  }

  function cancelEdit() {
    setEditingId(null);
    setReassignQuery('');
    setReassignResults([]);
    setReassignTarget(null);
  }

  function removeImage(idx: number) {
    if (editPaths.length <= 1) {
      toast.error('An entry needs at least one image — delete the entry instead if it should be removed entirely');
      return;
    }
    setEditPaths(prev => prev.filter((_, i) => i !== idx));
    setEditUrls(prev => prev.filter((_, i) => i !== idx));
  }

  function onReassignInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setReassignQuery(val);
    setReassignTarget(null);
    clearTimeout(reassignTimer.current);
    if (!val.trim()) { setReassignResults([]); setShowReassignDrop(false); return; }
    reassignTimer.current = setTimeout(async () => {
      try {
        const res = await api.get<{ data: CustomerOption[] }>('/customers', { params: { search: val } });
        setReassignResults(res.data.data ?? []);
        setShowReassignDrop(true);
      } catch { /* silent */ }
    }, 300);
  }

  async function saveEdit(entryId: string) {
    setSaving(true);
    try {
      await api.patch(`/history/admin/entries/${entryId}`, {
        entryDate: editDate ? new Date(editDate).toISOString() : undefined,
        imagePaths: editPaths,
        customerId: reassignTarget?.id,
      });
      toast.success('Entry updated');
      cancelEdit();
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entryId: string) {
    if (!confirm('Delete this history entry permanently? This removes it from the customer\'s public history page.')) return;
    setDeletingId(entryId);
    try {
      await api.delete(`/history/admin/entries/${entryId}`);
      toast.success('Entry deleted');
      if (editingId === entryId) cancelEdit();
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to delete entry');
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <Header
        title="History Photos"
        icon={
          <span className="w-7 h-7 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center">
            <History className="w-4 h-4 text-[#1B4F8A]" />
          </span>
        }
      />
      <main className="flex-1 bg-gray-50 min-h-[calc(100vh-56px)]">
        <div className="max-w-4xl mx-auto p-6 space-y-5">
          <div className="rounded-2xl bg-gradient-to-br from-[#1B4F8A] to-[#123a68] px-6 py-5 text-white shadow-sm">
            <h1 className="text-lg font-bold">Correct customer history photos</h1>
            <p className="text-sm text-blue-100 mt-1 max-w-xl">
              Some photos migrated from before this feature existed may be attributed to the wrong
              customer or date. Search below, edit an entry to fix its date, reassign it to the
              right customer, remove a wrong image, or delete it entirely.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:border-[#1B4F8A] focus:ring-2 focus:ring-[#1B4F8A]/10 outline-none transition-colors shadow-sm"
              placeholder="Search by customer name or phone… (leave blank to browse all)"
              value={search}
              onChange={onSearchInput}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">No history entries found</div>
          ) : (
            <div className="space-y-3">
              {entries.map(entry => (
                <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <div className="flex items-start gap-3.5">
                    <span className="w-10 h-10 rounded-full bg-[#1B4F8A]/10 text-[#1B4F8A] text-xs font-bold flex items-center justify-center shrink-0">
                      {initials(entry.customer.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{entry.customer.name}</p>
                          <p className="text-xs text-gray-400">
                            {entry.customer.phone ? `+91 ${entry.customer.phone}` : '—'} · {fmtDate(entry.entryDate)} · {entry.pageCount} page{entry.pageCount !== 1 ? 's' : ''}
                            {entry.source === 'MANUAL' && <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5">MANUAL</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {editingId === entry.id ? (
                            <button onClick={cancelEdit} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                              <X size={15} />
                            </button>
                          ) : (
                            <>
                              <button onClick={() => startEdit(entry)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#1B4F8A] hover:bg-blue-50 transition-colors" title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                disabled={deletingId === entry.id}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                title="Delete"
                              >
                                {deletingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Thumbnail strip — read-only view */}
                      {editingId !== entry.id && (
                        <div className="flex gap-2 mt-3 overflow-x-auto">
                          {entry.imageUrls.map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={url} alt="" className="w-16 h-20 rounded-lg object-cover border border-gray-200 shrink-0" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit panel */}
                  {editingId === entry.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                        <input
                          type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">Images (tap × to remove a wrong one)</label>
                        <div className="flex gap-2 flex-wrap">
                          {editUrls.map((url, i) => (
                            <div key={i} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-16 h-20 rounded-lg object-cover border border-gray-200" />
                              <button
                                onClick={() => removeImage(i)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                          <UserCog size={12} /> Reassign to a different customer <span className="font-normal text-gray-400">(optional — fixes a wrong attribution)</span>
                        </label>
                        {reassignTarget ? (
                          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                            <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {initials(reassignTarget.name)}
                            </span>
                            <span className="text-sm text-teal-900 flex-1 min-w-0 truncate">{reassignTarget.name}</span>
                            <button onClick={() => { setReassignTarget(null); setReassignQuery(''); }} className="text-teal-500 hover:text-teal-700 shrink-0">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <input
                            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#1B4F8A] outline-none transition-colors"
                            placeholder="Search by name, phone, or code…"
                            value={reassignQuery}
                            onChange={onReassignInput}
                            onFocus={() => reassignResults.length > 0 && setShowReassignDrop(true)}
                          />
                        )}
                        {showReassignDrop && !reassignTarget && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                            {reassignResults.length === 0 ? (
                              <div className="px-3 py-2.5 text-xs text-gray-400">No customers found</div>
                            ) : (
                              reassignResults.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => { setReassignTarget(c); setShowReassignDrop(false); }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between transition-colors"
                                >
                                  <span className="text-gray-800">{c.name}</span>
                                  <span className="text-xs text-gray-400">{c.phone ? `+91 ${c.phone}` : c.customerCode}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => saveEdit(entry.id)}
                        disabled={saving}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1B4F8A] hover:bg-[#163f70] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                      >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs text-gray-500">Page {page} of {totalPages} · {total} entries</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
