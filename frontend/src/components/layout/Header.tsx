'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, LogOut, Menu, User, Search, Package, Users, Truck, FileText, ShoppingCart, X } from 'lucide-react';
import { logout, getUser } from '@/lib/auth';
import api from '@/lib/api';
import type { User as UserType } from '@/types';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
  productId?: string;
}

// ─── Universal Search ─────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  products:  Package,
  customers: Users,
  suppliers: Truck,
  grns:      ShoppingCart,
  bills:     FileText,
};

const TYPE_LABEL: Record<string, string> = {
  products:  'Products',
  customers: 'Customers',
  suppliers: 'Suppliers',
  grns:      'GRN',
  bills:     'Bills',
};

const TYPE_PATH: Record<string, (id: string, label?: string) => string> = {
  products:  (_id, label) => `/dashboard/products?search=${encodeURIComponent(label ?? '')}`,
  customers: (id)  => `/dashboard/customers/${id}`,
  suppliers: (id)  => `/dashboard/suppliers/${id}`,
  grns:      (id)  => `/dashboard/grn/${id}`,
  bills:     (_id) => `/dashboard/bills`,
};

interface SearchResult {
  type: string; id: string; label: string; sublabel?: string; meta?: string;
}

interface SearchResponse {
  products: SearchResult[]; customers: SearchResult[];
  suppliers: SearchResult[]; grns: SearchResult[]; bills: SearchResult[];
  total: number;
}

function UniversalSearch() {
  const router   = useRouter();
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ctrl+K / Cmd+K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setResults(null); setLoading(false); return; }
    setLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/search', { params: { q: query.trim(), limit: 8 } });
        setResults(data);
        setActiveIdx(-1);
      } catch { setResults(null); }
      finally { setLoading(false); }
    }, 280);
  }, [query]);

  // Flatten results for keyboard nav
  const flat: SearchResult[] = results
    ? [...results.products, ...results.customers, ...results.suppliers, ...results.grns, ...results.bills]
    : [];

  // Backend returns singular type ('product'), maps are plural ('products')
  function typeKey(t: string) { return t.endsWith('s') ? t : `${t}s`; }

  function handleSelect(r: SearchResult) {
    setOpen(false);
    setQuery('');
    const path = TYPE_PATH[typeKey(r.type)];
    if (path) router.push(path(r.id, r.label));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || flat.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(flat[activeIdx]); }
  }

  const sections = results
    ? (['products','customers','suppliers','grns','bills'] as const)
        .map(k => ({ key: k, items: results[k] }))
        .filter(s => s.items.length > 0)
    : [];

  let flatIdx = 0;

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 text-sm bg-white transition-all ${open ? 'border-[#1B4F8A] w-80' : 'border-gray-200 w-56 hover:border-gray-300'}`}>
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search… Ctrl+K  (* wildcard)"
          className="flex-1 bg-transparent outline-none text-gray-700 placeholder:text-gray-400 text-xs"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults(null); }} className="text-gray-400 hover:text-gray-600">
            <X className="w-3 h-3" />
          </button>
        )}
        {!query && <span className="text-[10px] text-gray-300 font-mono shrink-0">Ctrl+K</span>}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full left-0 mt-1 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {loading && (
            <div className="px-4 py-3 text-xs text-gray-400">Searching…</div>
          )}
          {!loading && sections.length === 0 && query && (
            <div className="px-4 py-4 text-center text-sm text-gray-400">
              No results for <strong>{query}</strong>
              <div className="text-xs mt-1 text-gray-300">Try using * as wildcard: <code>sun*oil</code></div>
            </div>
          )}
          {!loading && sections.map(({ key, items }) => {
            const Icon = TYPE_ICON[key];
            return (
              <div key={key}>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                  <Icon className="w-3 h-3 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{TYPE_LABEL[key]}</span>
                  <span className="text-xs text-gray-300 ml-auto">{items.length}</span>
                </div>
                {items.map((r) => {
                  const idx = flatIdx++;
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleSelect(r)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${activeIdx === idx ? 'bg-blue-50' : ''}`}
                    >
                      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{r.label}</div>
                        {r.sublabel && <div className="text-xs text-gray-400 truncate">{r.sublabel}</div>}
                      </div>
                      {r.meta && <span className="text-xs font-semibold text-[#1B4F8A] shrink-0">{r.meta}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!loading && results && results.total > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">↑↓ navigate · Enter to open</span>
              {results.products.length > 0 && (
                <button
                  onClick={() => { setOpen(false); router.push(`/dashboard/products?search=${encodeURIComponent(query.replace(/\*/g,''))}`); setQuery(''); }}
                  className="text-xs text-[#1B4F8A] hover:underline font-medium"
                >
                  See all products →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function priorityDot(priority: string, type: string): string {
  if (priority === 'URGENT' || type === 'OUT_OF_STOCK') return 'bg-red-500';
  if (priority === 'HIGH'   || type === 'LOW_STOCK' || type === 'GRN_PENDING') return 'bg-orange-400';
  if (priority === 'NORMAL' || type === 'RESTOCKED' || type === 'GRN_APPROVED') return 'bg-yellow-400';
  return 'bg-blue-400';
}

function typeToPage(type: string, actionUrl?: string | null): string {
  if (actionUrl) return actionUrl;
  if (type === 'OUT_OF_STOCK' || type === 'RESTOCKED' || type === 'LOW_STOCK') return '/dashboard/products';
  if (type === 'GRN_PENDING' || type === 'GRN_APPROVED' || type === 'GRN_REJECTED') return '/dashboard/grn';
  return '/dashboard';
}

export default function Header({ title, actions, icon }: HeaderProps) {
  const router      = useRouter();
  const queryClient = useQueryClient();
  const [mounted, setMounted]               = useState(false);
  const [open, setOpen]                     = useState(false);
  const [yesterdayPending, setYesterdayPending] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    async function checkYesterdayClosure() {
      const hour = new Date().getHours();
      if (hour < 9) return;
      try {
        const { data } = await api.get('/day-closure/yesterday-status');
        setYesterdayPending(!data.isClosed);
      } catch {}
    }
    checkYesterdayClosure();
  }, [mounted]);

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data;
    },
    enabled: mounted,
    staleTime: 60_000,
  });

  const { data: recentData } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/notifications', { params: { limit: 5, page: 1 } });
      return data;
    },
    enabled: mounted && open,
    staleTime: 0,
  });

  useWebSocketEvent('notification.created',  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
  useWebSocketEvent('notification.read',     () => queryClient.invalidateQueries({ queryKey: ['notifications'] }));
  useWebSocketEvent('notification.read_all', () => queryClient.invalidateQueries({ queryKey: ['notifications'] }));

  const markAllMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) markOneMutation.mutate(n.id);
    setOpen(false);
    router.push(typeToPage(n.type, n.actionUrl));
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handler = () => setYesterdayPending(false);
    window.addEventListener('dayClosed', handler);
    return () => window.removeEventListener('dayClosed', handler);
  }, []);

  const user         = mounted ? getUser<UserType>() : null;
  const unreadCount  = (countData?.count ?? 0) as number;
  const notifications = (recentData?.data ?? []) as Notification[];

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <>
      {/* Yesterday closure warning banner */}
      {mounted && yesterdayPending && (
        <div className="bg-orange-500 text-white text-xs flex items-center justify-between px-6 py-1.5">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            Yesterday&apos;s day closure is pending. Complete it before starting today.
          </span>
          <button
            onClick={() => router.push('/dashboard/day-closure')}
            className="text-orange-100 hover:text-white font-semibold underline underline-offset-2 ml-4 whitespace-nowrap"
          >
            Complete Closure →
          </button>
        </div>
      )}

      <header className="sticky top-0 z-10 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile hamburger — triggers sidebar via CustomEvent */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('sidebar:toggle'))}
            className="md:hidden p-2 -ml-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-gray-800 flex items-center gap-2">{icon}{title}</h1>
          {actions}
        </div>

        {/* Universal Search */}
        <UniversalSearch />

        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          {mounted && (
            <div ref={bellRef} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-0.5 leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {open && (
                <div className="absolute right-0 top-10 w-[320px] bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-700">Notifications</span>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllMutation.mutate()}
                          disabled={markAllMutation.isPending}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-60"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${!n.isRead ? 'border-l-2 border-l-blue-400 bg-blue-50/30' : ''}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${priorityDot(n.priority, n.type)}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                                {n.actionLabel && (
                                  <span className="text-xs text-blue-600 font-medium">{n.actionLabel}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="border-t border-gray-100 px-4 py-2">
                    <button
                      onClick={() => { setOpen(false); router.push('/dashboard/notifications'); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-center"
                    >
                      View all notifications →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-7 h-7 rounded-full bg-[#1B4F8A] flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="font-medium">{user?.fullName ?? user?.username ?? 'User'}</span>
            {user?.role && (
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {user.role.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>
    </>
  );
}
