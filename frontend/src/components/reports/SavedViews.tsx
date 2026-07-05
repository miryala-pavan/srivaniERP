'use client';

// SavedViews — named bookmarks for report filter combinations.
// Stored in localStorage per report path, so each report keeps its own list.
// Saving captures the current URL query string; applying restores it.

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bookmark, Plus, Trash2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface SavedView { name: string; qs: string; savedAt: string; }

function storageKey(path: string) {
  return `report-views:${path}`;
}

function loadViews(path: string): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(path)) ?? '[]');
  } catch { return []; }
}

export default function SavedViews({ onApply }: { onApply?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setViews(loadViews(pathname)); }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setNaming(false); }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function persist(next: SavedView[]) {
    setViews(next);
    localStorage.setItem(storageKey(pathname), JSON.stringify(next));
  }

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const qs = window.location.search;
    const next = [...views.filter(v => v.name !== trimmed), { name: trimmed, qs, savedAt: new Date().toISOString() }];
    persist(next);
    setName(''); setNaming(false);
    toast.success(`View "${trimmed}" saved`);
  }

  function apply(v: SavedView) {
    window.history.replaceState(null, '', pathname + v.qs);
    setOpen(false);
    // Pages read URL params on mount — a reload re-initialises all filters from the restored URL.
    if (onApply) onApply(); else window.location.reload();
  }

  function remove(v: SavedView) {
    persist(views.filter(x => x.name !== v.name));
  }

  const currentQs = typeof window !== 'undefined' ? window.location.search : '';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        title="Save the current filters as a named view, or jump to a saved one"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
        <Bookmark className="w-3.5 h-3.5" /> Views{views.length > 0 ? ` (${views.length})` : ''}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-2">
          <p className="px-3 pb-2 text-[11px] text-gray-400 border-b border-gray-100">
            Saved views remember this report&apos;s filters (period, columns, sort) on this device.
          </p>

          {views.length === 0 && !naming && (
            <p className="px-3 py-3 text-xs text-gray-400">No saved views yet.</p>
          )}

          {views.map(v => (
            <div key={v.name} className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50 group">
              <button onClick={() => apply(v)} className="flex-1 text-left px-1 py-1 min-w-0">
                <span className="text-sm text-gray-700 flex items-center gap-1.5">
                  {v.qs === currentQs && <Check className="w-3 h-3 text-green-600 shrink-0" />}
                  <span className="truncate">{v.name}</span>
                </span>
              </button>
              <button onClick={() => remove(v)} title="Delete this view"
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1 px-2">
            {naming ? (
              <div className="flex items-center gap-1 py-1">
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveCurrent(); if (e.key === 'Escape') setNaming(false); }}
                  placeholder="View name…"
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1B4F8A] min-w-0" />
                <button onClick={saveCurrent} className="px-2 py-1.5 text-xs font-medium bg-[#1B4F8A] text-white rounded-lg">Save</button>
              </div>
            ) : (
              <button onClick={() => setNaming(true)}
                className="w-full flex items-center gap-1.5 px-1 py-1.5 text-xs text-[#1B4F8A] font-medium hover:bg-blue-50 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> Save current filters as view
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
