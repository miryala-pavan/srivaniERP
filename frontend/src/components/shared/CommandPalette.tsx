'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Package, Users, Truck, ClipboardList, Receipt,
  LayoutDashboard, Settings, X, BarChart2, Layers, Building2,
  ShoppingCart, FileText, ArrowRight, Hash, CreditCard,
} from 'lucide-react';
import api from '@/lib/api';
import { useEscapeKey } from '@/hooks/useEscapeKey';

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchResultType = 'product' | 'customer' | 'supplier' | 'grn' | 'bill';

interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel?: string;
}

type FlatItem =
  | { kind: 'page'; page: PageEntry }
  | { kind: 'entity'; result: SearchResult };

// ─── Static page list ─────────────────────────────────────────────────────────

interface PageEntry {
  label: string;
  path: string;
  icon: React.ElementType;
  shortcut?: string;
}

const PAGES: PageEntry[] = [
  { label: 'Dashboard',    path: '/dashboard',                    icon: LayoutDashboard, shortcut: 'gd' },
  { label: 'Products',     path: '/dashboard/products',           icon: Package,         shortcut: 'gp' },
  { label: 'GRN',          path: '/dashboard/grn',                icon: ClipboardList,   shortcut: 'gg' },
  { label: 'Suppliers',    path: '/dashboard/suppliers',          icon: Truck,           shortcut: 'gs' },
  { label: 'Customers',    path: '/dashboard/customers',          icon: Users,           shortcut: 'gc' },
  { label: 'Bills',        path: '/dashboard/bills',              icon: Receipt,         shortcut: 'gb' },
  { label: 'POS',          path: '/dashboard/pos',                icon: ShoppingCart,    shortcut: 'gk' },
  { label: 'Payments',     path: '/dashboard/payments',           icon: CreditCard },
  { label: 'Settings',     path: '/dashboard/settings',           icon: Settings },
  { label: 'Users',        path: '/dashboard/users',              icon: Users },
  { label: 'Reports',      path: '/dashboard/reports',            icon: BarChart2 },
  { label: 'Departments',  path: '/dashboard/departments',        icon: Building2 },
  { label: 'Categories',   path: '/dashboard/categories',         icon: Layers },
  { label: 'Subcategories',path: '/dashboard/subcategories',      icon: Layers },
  { label: 'PLU',          path: '/dashboard/plu',                icon: Hash },
  { label: 'Estimates',    path: '/dashboard/estimates',          icon: FileText },
  { label: 'Inventory',    path: '/dashboard/inventory/stock-take', icon: Package },
  { label: 'Day Closure',  path: '/dashboard/day-closure',        icon: FileText },
];

// ─── Entity routing + icons ───────────────────────────────────────────────────

const TYPE_META: Record<SearchResultType, {
  label: string;
  icon: React.ElementType;
  route: (id: string) => string;
}> = {
  product:  { label: 'Products',  icon: Package,      route: (id) => `/dashboard/products/${id}` },
  customer: { label: 'Customers', icon: Users,        route: (id) => `/dashboard/customers/${id}` },
  supplier: { label: 'Suppliers', icon: Truck,        route: (id) => `/dashboard/suppliers/${id}` },
  grn:      { label: 'GRN',       icon: ClipboardList,route: (id) => `/dashboard/grn/${id}` },
  bill:     { label: 'Bills',     icon: Receipt,      route: () => `/dashboard/bills` },
};

const RESULT_ORDER: SearchResultType[] = ['product', 'customer', 'supplier', 'grn', 'bill'];

// ─── CommandPalette ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [showHelp, setShowHelp]   = useState(false);
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<SearchResult[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef   = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setSelectedIdx(0);
  }, []);

  const closeHelp = useCallback(() => setShowHelp(false), []);

  useEscapeKey(closeHelp, showHelp);
  useEscapeKey(closePalette, open && !showHelp);

  // Listen for erp:palette and erp:help custom events dispatched by layout
  useEffect(() => {
    const onPalette = () => {
      setOpen(true);
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    };
    const onHelp = () => setShowHelp(true);
    window.addEventListener('erp:palette', onPalette);
    window.addEventListener('erp:help', onHelp);
    return () => {
      window.removeEventListener('erp:palette', onPalette);
      window.removeEventListener('erp:help', onHelp);
    };
  }, []);

  // Focus input when palette opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  // Debounced search (250 ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/search', { params: { q: query.trim(), limit: 5 } });
        setResults(res.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ─── Build flat item list for keyboard navigation ────────────────────────────

  const filteredPages = PAGES.filter((p) =>
    !query.trim() || p.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const groupedResults: { type: SearchResultType; items: SearchResult[] }[] = [];
  for (const type of RESULT_ORDER) {
    const items = results.filter((r) => r.type === type);
    if (items.length) groupedResults.push({ type, items });
  }

  const flatItems: FlatItem[] = [
    ...filteredPages.map((page) => ({ kind: 'page' as const, page })),
    ...groupedResults.flatMap((g) => g.items.map((result) => ({ kind: 'entity' as const, result }))),
  ];

  // Reset selected index whenever the item list changes
  useEffect(() => { setSelectedIdx(0); }, [query, results.length]);

  // ─── Navigation ──────────────────────────────────────────────────────────────

  function navigateTo(item: FlatItem) {
    closePalette();
    if (item.kind === 'page') {
      router.push(item.page.path);
    } else {
      router.push(TYPE_META[item.result.type].route(item.result.id));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const total = flatItems.length;
    if (total === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIdx];
      if (item) navigateTo(item);
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────

  // Flat entity items pre-computed for index calculation
  const flatEntityItems = groupedResults.flatMap((g) => g.items);

  if (!open && !showHelp) return null;

  return (
    <>
      {/* ── Help overlay ─────────────────────────────────────────────────────── */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={closeHelp}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Keyboard Shortcuts</h2>
              <button onClick={closeHelp} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-5 text-sm">
              <HelpSection title="General">
                <ShortcutRow keys={['Ctrl', 'K']} label="Command palette" />
                <ShortcutRow keys={['?']}          label="This help" />
                <ShortcutRow keys={['Esc']}        label="Close modal / palette" />
              </HelpSection>

              <HelpSection title="Navigate (press g, then...)">
                <ShortcutRow keys={['g', 'd']} label="Dashboard" />
                <ShortcutRow keys={['g', 'p']} label="Products" />
                <ShortcutRow keys={['g', 'g']} label="GRN" />
                <ShortcutRow keys={['g', 's']} label="Suppliers" />
                <ShortcutRow keys={['g', 'c']} label="Customers" />
                <ShortcutRow keys={['g', 'b']} label="Bills" />
                <ShortcutRow keys={['g', 'k']} label="POS" />
              </HelpSection>

              <HelpSection title="Actions">
                <ShortcutRow keys={['n']}         label="New (context-aware)" />
                <ShortcutRow keys={['Ctrl', 'G']} label="Go to GRN" />
                <ShortcutRow keys={['Ctrl', 'B']} label="Go to Bills" />
              </HelpSection>
            </div>
          </div>
        </div>
      )}

      {/* ── Command palette ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] bg-black/40"
          onClick={closePalette}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden mx-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, customers, pages..."
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              />
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 border border-gray-200 rounded">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">

              {/* Static page targets */}
              {filteredPages.length > 0 && (
                <div className="py-1">
                  {!query.trim() && (
                    <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Pages
                    </p>
                  )}
                  {filteredPages.map((page, i) => {
                    const Icon = page.icon;
                    const isSelected = i === selectedIdx;
                    return (
                      <button
                        key={page.path}
                        onClick={() => navigateTo({ kind: 'page', page })}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-[#1B4F8A] text-white'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 opacity-70" />
                        <span className="flex-1 font-medium">{page.label}</span>
                        {page.shortcut && (
                          <span className={`text-xs font-mono ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                            {page.shortcut}
                          </span>
                        )}
                        <ArrowRight className={`w-3 h-3 ${isSelected ? 'opacity-60' : 'opacity-30'}`} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Entity results grouped by type */}
              {groupedResults.map(({ type, items }) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type} className="py-1 border-t border-gray-50">
                    <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {meta.label}
                    </p>
                    {items.map((result) => {
                      const entityFlatIdx = flatEntityItems.indexOf(result);
                      const globalIdx = filteredPages.length + entityFlatIdx;
                      const isSelected = globalIdx === selectedIdx;
                      return (
                        <button
                          key={result.id}
                          onClick={() => navigateTo({ kind: 'entity', result })}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-[#1B4F8A] text-white'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0 opacity-70" />
                          <span className="flex-1 font-medium truncate">{result.label}</span>
                          {result.sublabel && (
                            <span className={`text-xs truncate max-w-[160px] ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                              {result.sublabel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Empty: query with no results */}
              {query.trim() && !loading && results.length === 0 && filteredPages.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-400">
                  No results for &quot;{query}&quot;
                </div>
              )}

              {/* Empty: no query, no pages (shouldn't happen, but guard) */}
              {!query.trim() && filteredPages.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-400">
                  Type to search products, customers, suppliers, GRNs, bills
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd><Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> select
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd> close
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Kbd>?</Kbd> shortcuts
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 border border-gray-200 rounded text-xs font-mono bg-gray-50 text-gray-500">
      {children}
    </kbd>
  );
}

function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="px-2 py-0.5 text-xs font-mono bg-gray-100 border border-gray-200 rounded text-gray-700"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
