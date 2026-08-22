'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  FileText,
  UserCheck,
  CalendarCheck,
  Tag,
  List,
  FolderTree,
  ListTree,
  Layers,
  ClipboardList,
  Warehouse,
  PackageCheck,
  Users,
  Truck,
  CreditCard,
  UserCog,
  BarChart2,
  ScrollText,
  History,
  Building2,
  Settings,
  Store,
  ChevronRight,
  Menu,
  X,
  Hash,
  Wallet,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  CalendarRange,
  ShoppingBag,
  PackageSearch,
  Download,
  Smartphone,
  MessageSquare,
  Globe,
  Scale,
  Ruler,
  ShieldCheck,
  SplitSquareHorizontal,
  BookOpen,
  Calculator,
  AlarmClock,
  Percent,
  Banknote,
  Camera,
  ImagePlus,
} from 'lucide-react';
import { getUser } from '@/lib/auth';
import type { User } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/useWebSocketEvent';
import api from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
  external?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON', 'FLOOR_SUPERVISOR', 'PACKING_STAFF', 'SALES_REP', 'VIEWER'] },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    items: [
      { href: '/dashboard/pos',          label: 'POS / New Sale', icon: ShoppingCart,  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'SALES_REP'] },
      { href: '/dashboard/bills',        label: 'Bills',          icon: Receipt,        roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'SALES_REP'] },
      { href: '/dashboard/estimates',    label: 'Estimates',      icon: FileText,       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/shifts',       label: 'Shifts',         icon: UserCheck,      roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/day-closure',    label: 'Day Closure',    icon: CalendarCheck,  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/online-orders',  label: 'Online Orders',  icon: ShoppingBag,    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'ACCOUNTS_PERSON'] },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    items: [
      { href: '/dashboard/products',                  label: 'Products',      icon: Tag,          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'PACKING_STAFF'] },
      { href: '/dashboard/plu',                       label: 'PLU Management',    icon: List,  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/products/online-visibility', label: 'Online Visibility', icon: Globe, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/products/unit-management',   label: 'Unit Management',   icon: Ruler, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/categories',                label: 'Categories',    icon: FolderTree,   roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/subcategories',             label: 'Sub-Categories',icon: ListTree,     roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/hsn',                       label: 'HSN Codes',     icon: Hash,         roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/departments',               label: 'Departments',   icon: Layers,       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/inventory/stock-take',      label: 'Stock-take',    icon: ClipboardList,roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'FLOOR_SUPERVISOR'] },
      { href: '/dashboard/inventory/opening-stock',   label: 'Opening Stock', icon: Warehouse,    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER'] },
      { href: '/dashboard/grn',                       label: 'GRN',           icon: PackageCheck, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER'] },
      { href: '/dashboard/purchase-orders',           label: 'Purchase Orders', icon: ShoppingCart, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER'] },
      { href: '/dashboard/products/labels',            label: 'Print Labels',  icon: Printer,      roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'PACKING_STAFF', 'FLOOR_SUPERVISOR'] },
      { href: '/dashboard/reorder',                         label: 'Reorder Guide',   icon: PackageSearch,      roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER'] },
      { href: '/dashboard/inventory/break-bulk',            label: 'Break Bulk',      icon: SplitSquareHorizontal, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'PURCHASE_CHECKER'] },
      { href: '/dashboard/inventory/expiry',                label: 'Expiry Tracker',  icon: AlarmClock,         roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'FLOOR_SUPERVISOR'] },
      { href: '/dashboard/inventory/volume-pricing',        label: 'Volume Pricing',  icon: Percent,            roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    key: 'people',
    label: 'People',
    items: [
      { href: '/dashboard/customers', label: 'Customers',    icon: Users,    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'SALES_REP', 'CASHIER', 'FLOOR_SUPERVISOR'] },
      { href: '/dashboard/suppliers', label: 'Suppliers',    icon: Truck,    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/payments',  label: 'Sup. Payments',icon: CreditCard,roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/expenses',  label: 'Expenses',     icon: Wallet,    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/bank',      label: 'Bank & Accounts', icon: Building2, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/users',     label: 'Staff',        icon: UserCog,  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    items: [
      { href: '/dashboard/activity',          label: 'Activity Log',     icon: History,    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/reports',          label: 'Reports',          icon: BarChart2,  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'VIEWER'] },
      { href: '/dashboard/reports/gst-health', label: 'GST Health',         icon: ShieldCheck,     roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { href: '/dashboard/reports/gst',       label: 'GST Reports',      icon: ScrollText,       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { href: '/dashboard/reports/gst-reconciliation', label: 'GST Reconciliation', icon: Scale,    roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { href: '/dashboard/reports/ca-export',        label: 'CA Export',          icon: FileSpreadsheet,  roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'CA'] },
      { href: '/dashboard/reports/year-comparison',  label: 'Year Comparison',    icon: TrendingUp,       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/reports/payables',          label: 'Payables Aging',     icon: Banknote,         roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/historical-bills',          label: 'Historical Bills',   icon: History,          roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance & Books',
    items: [
      { href: '/dashboard/gst-filing', label: 'GST Filing',      icon: ScrollText, roles: ['SUPER_ADMIN', 'ACCOUNTS_PERSON', 'CA'] },
      { href: '/dashboard/tds',        label: 'TDS',             icon: Percent,    roles: ['SUPER_ADMIN', 'ACCOUNTS_PERSON', 'CA'] },
      { href: '/dashboard/ledger',     label: 'General Ledger',  icon: BookOpen,   roles: ['SUPER_ADMIN', 'ACCOUNTS_PERSON', 'CA'] },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      { href: '/dashboard/business',                    label: 'Business',        icon: Building2,       roles: ['SUPER_ADMIN'] },
      { href: '/dashboard/settings',                    label: 'Settings',        icon: Settings,        roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/settings/financial-year',     label: 'Financial Years', icon: CalendarRange,   roles: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'] },
      { href: '/dashboard/notifications/whatsapp',      label: 'PaVa Connect',    icon: MessageSquare,   roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/order-photos',                label: 'Order Photos',    icon: ImagePlus,       roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/notifications/social',        label: 'Facebook & Instagram', icon: Camera, roles: ['SUPER_ADMIN', 'BRANCH_MANAGER'] },
      { href: '/dashboard/lists',                        label: 'Order Lists',      icon: FileText,        roles: ['SUPER_ADMIN'] },
      { href: '/dashboard/settings/roles',               label: 'Role Permissions', icon: ShieldCheck,     roles: ['SUPER_ADMIN'] },
      { href: '/dashboard/billing',                      label: 'Subscription',     icon: CreditCard,      roles: ['SUPER_ADMIN'] },
    ],
  },
];

const LS_KEY = 'srivani_nav_collapsed';

function useLoginDuration(): string {
  const [duration, setDuration] = useState('');
  useEffect(() => {
    function compute() {
      try {
        const token = localStorage.getItem('srivani_token');
        if (!token) return '';
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.iat) return '';
        const mins = Math.floor((Date.now() - payload.iat * 1000) / 60_000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60), m = mins % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
      } catch { return ''; }
    }
    setDuration(compute());
    const id = setInterval(() => setDuration(compute()), 60_000);
    return () => clearInterval(id);
  }, []);
  return duration;
}

export default function Sidebar() {
  const pathname = usePathname();
  const user     = getUser<User>();
  const role     = user?.role ?? '';

  const [mounted,       setMounted]       = useState(false);
  const loginDuration = useLoginDuration();
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [collapsed,     setCollapsed]     = useState<Record<string, boolean>>({});
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIos,         setIsIos]         = useState(false);
  const [isInstalled,   setIsInstalled]   = useState(false);
  const [showIosHint,   setShowIosHint]   = useState(false);

  const qc = useQueryClient();
  const { data: pendingOnlineOrders = 0 } = useQuery<number>({
    queryKey: ['online-orders-pending-count'],
    queryFn:  async () => {
      const { data } = await api.get('/online-orders/admin', { params: { status: 'PENDING_COD' } });
      return Array.isArray(data) ? data.length : 0;
    },
    staleTime: 60_000,
    enabled: mounted && ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'ACCOUNTS_PERSON'].includes(role),
  });
  useWebSocketEvent('online.order.placed',        () => qc.invalidateQueries({ queryKey: ['online-orders-pending-count'] }));
  useWebSocketEvent('online.order.status_changed', () => qc.invalidateQueries({ queryKey: ['online-orders-pending-count'] }));

  const { data: waUnreadCount = 0 } = useQuery<number>({
    queryKey: ['wa-unread-count'],
    queryFn:  async () => {
      const { data } = await api.get('/notifications/whatsapp/conversations/unread-count');
      return data?.count ?? 0;
    },
    staleTime: 60_000,
    enabled: mounted && ['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(role),
  });
  useWebSocketEvent('wa.message.received', () => qc.invalidateQueries({ queryKey: ['wa-unread-count'] }));
  useWebSocketEvent('wa.message.sent',     () => qc.invalidateQueries({ queryKey: ['wa-unread-count'] }));

  const { data: socialUnreadCount = 0 } = useQuery<number>({
    queryKey: ['social-unread-count'],
    queryFn:  async () => {
      const { data } = await api.get('/notifications/social/conversations/unread-count');
      return data?.count ?? 0;
    },
    staleTime: 60_000,
    enabled: mounted && ['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(role),
  });
  useWebSocketEvent('social.message.received', () => qc.invalidateQueries({ queryKey: ['social-unread-count'] }));
  useWebSocketEvent('social.message.sent',     () => qc.invalidateQueries({ queryKey: ['social-unread-count'] }));

  // Read persisted collapse state after hydration (avoids SSR mismatch)
  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}

    // PWA install detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Listen for mobile toggle dispatched by Header
  useEffect(() => {
    const handler = () => setMobileOpen((o) => !o);
    window.addEventListener('sidebar:toggle', handler);
    return () => window.removeEventListener('sidebar:toggle', handler);
  }, []);

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 w-56 bg-[#1B4F8A] flex flex-col z-50 transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo row */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-blue-700 shrink-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-white">
            <img src="/icons/logo512x512.png" alt="Srivani Stores" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Srivani</p>
            <p className="text-blue-300 text-xs leading-tight">Stores ERP</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-blue-300 hover:text-white rounded"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logged-in user */}
        {mounted && user && (
          <div className="px-4 py-3 border-b border-blue-700 shrink-0 bg-blue-900/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">
                  {(user.fullName || user.username || 'U')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate leading-tight">
                  {user.fullName || user.username}
                </p>
                <p className="text-blue-300 text-[10px] mt-0.5 truncate">
                  {user.role?.replace(/_/g, ' ')}
                  {loginDuration ? ` · ${loginDuration}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {GROUPS.map((group) => {
            const visible = group.items.filter(
              (item) => !item.roles || item.roles.includes(role),
            );
            if (visible.length === 0) return null;

            const isCollapsed = mounted && !!collapsed[group.key];

            return (
              <div key={group.key} className="mb-0.5">
                {/* Group header — click to collapse */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-widest text-blue-400 hover:text-blue-200 hover:bg-white/5 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronRight
                    className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                  />
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-0.5">
                    {visible.map(({ href, label, icon: Icon, external }) => {
                      const active = isActive(href);
                      const badge =
                        href === '/dashboard/online-orders' ? pendingOnlineOrders :
                        href === '/dashboard/notifications/whatsapp' ? waUnreadCount :
                        href === '/dashboard/notifications/social' ? socialUnreadCount :
                        0;
                      const linkClass = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'text-blue-200 hover:bg-white/10 hover:text-white'
                      }`;
                      const inner = (
                        <>
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1">{label}</span>
                          {badge > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          )}
                        </>
                      );
                      return external ? (
                        <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                          {inner}
                        </a>
                      ) : (
                        <Link key={href} href={href} className={linkClass}>
                          {inner}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-blue-700 shrink-0 space-y-2">
          {/* PWA install button — hidden once installed */}
          {!isInstalled && (
            <>
              {installPrompt && (
                <button
                  onClick={async () => {
                    installPrompt.prompt();
                    const { outcome } = await installPrompt.userChoice;
                    if (outcome === 'accepted') setIsInstalled(true);
                    setInstallPrompt(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  Install App
                </button>
              )}
              {isIos && !installPrompt && (
                <div className="relative">
                  <button
                    onClick={() => setShowIosHint((v) => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    Install App
                  </button>
                  {showIosHint && (
                    <div className="absolute bottom-full mb-2 left-0 right-0 bg-white text-gray-800 text-xs rounded-lg p-3 shadow-lg">
                      Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> in Safari
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <div className="flex gap-1">
            <Link href="/dashboard/help" className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-blue-300 hover:text-white hover:bg-white/10 text-xs transition-colors">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              Help Guide
            </Link>
            <a href="/calc.html" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-blue-300 hover:text-white hover:bg-white/10 text-xs transition-colors">
              <Calculator className="w-3.5 h-3.5 shrink-0" />
              Calculator
            </a>
          </div>
          <p className="text-blue-400 text-xs px-2">v1.0.0 · Telangana, India</p>
        </div>
      </aside>
    </>
  );
}
