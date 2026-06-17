'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getUser, logout } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
import { UpdateBanner } from '@/components/ui/UpdateBanner';
import { useVersionPoll } from '@/hooks/useVersionPoll';
import api, { silentRefresh } from '@/lib/api';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { FYProvider } from '@/context/FYContext';
import FYSwitcher from '@/components/layout/FYSwitcher';
import OnlineOrderAlert from '@/components/layout/OnlineOrderAlert';

interface StoredUser { role: string; fullName?: string }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { updateAvailable, dismiss } = useVersionPoll();

  useEffect(() => { setMounted(true); }, []);

  const user      = mounted ? getUser<StoredUser>() : null;
  const role      = user?.role ?? '';
  const isCashier = role === 'CASHIER';
  const isPosPage = pathname?.includes('/dashboard/pos') ?? false;

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (isCashier && !isPosPage) router.replace('/dashboard/pos');
  }, [mounted, router, isCashier, isPosPage]);

  // Warn before browser close if any form has unsaved changes
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if ((window as any).__erpHasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Inactivity auto-logout based on session_timeout setting (0 = never)
  useEffect(() => {
    if (!mounted) return;

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let timeoutMs = 0;

    function startTimer() {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (timeoutMs <= 0) return;
      timeoutHandle = setTimeout(() => {
        logout();
        router.replace('/login');
      }, timeoutMs);
    }

    function resetTimer() {
      if (timeoutMs > 0) startTimer();
    }

    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;

    api.get('/settings/system').then(({ data }) => {
      const minutes = Number(data.session_timeout ?? '0');
      if (minutes > 0) {
        timeoutMs = minutes * 60 * 1000;
        startTimer();
        ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
      }
    }).catch(() => {
      // if setting fetch fails, default to no timeout — safe for a supermarket ERP
    });

    return () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [mounted, router]);

  // Proactive token refresh: every 10 min of activity, silently renew before expiry
  useEffect(() => {
    if (!mounted) return;

    const REFRESH_INTERVAL = 10 * 60 * 1000;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => {
        const token = localStorage.getItem('srivani_token');
        if (!token) return;
        const ok = await silentRefresh();
        if (ok) scheduleRefresh();
      }, REFRESH_INTERVAL);
    };

    const onActivity = () => scheduleRefresh();

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    scheduleRefresh();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [mounted]);

  // Global keyboard shortcuts
  useEffect(() => {
    if (!mounted || isCashier) return;

    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    function isTyping() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select'
        || (el as HTMLElement).isContentEditable;
    }

    function contextNew() {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/grn')) {
        router.push('/dashboard/grn/v2');
      } else if (
        path.startsWith('/dashboard/products') ||
        path.startsWith('/dashboard/customers') ||
        path.startsWith('/dashboard/suppliers')
      ) {
        window.dispatchEvent(new CustomEvent('erp:new'));
      }
    }

    function handler(e: KeyboardEvent) {
      // Ctrl+K / Cmd+K — always open palette regardless of focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('erp:palette'));
        return;
      }

      // All single-key and chord shortcuts: ignore when typing
      if (isTyping()) return;

      // Ctrl+G → GRN list
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        router.push('/dashboard/grn');
        return;
      }

      // Ctrl+B → Bills
      if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        router.push('/dashboard/bills');
        return;
      }

      // Ignore modified keys below
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // g chord — first key
      if (e.key === 'g' && !e.shiftKey) {
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 1000);
        return;
      }

      // g chord — second key
      if (gPressed && !e.shiftKey) {
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);
        e.preventDefault();
        switch (e.key.toLowerCase()) {
          case 'd': router.push('/dashboard');            break;
          case 'p': router.push('/dashboard/products');   break;
          case 'g': router.push('/dashboard/grn');        break;
          case 's': router.push('/dashboard/suppliers');  break;
          case 'c': router.push('/dashboard/customers');  break;
          case 'b': router.push('/dashboard/bills');      break;
          case 'k': router.push('/dashboard/pos');        break;
        }
        return;
      }

      // Single-key shortcuts
      if (!e.shiftKey && e.key === 'n') { contextNew(); return; }
      if (e.key === '?') { window.dispatchEvent(new CustomEvent('erp:help')); return; }
    }

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [mounted, isCashier, router]);

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Cashier: full-screen POS, no sidebar
  if (isCashier) {
    return (
      <WebSocketProvider>
        <div className="h-screen overflow-hidden">
          {children}
          {updateAvailable && <UpdateBanner onDismiss={dismiss} />}
        </div>
      </WebSocketProvider>
    );
  }

  return (
    <WebSocketProvider>
      <FYProvider>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar />
          <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
            <FYSwitcher />
            {children}
          </div>
          {updateAvailable && <UpdateBanner onDismiss={dismiss} />}
          <CommandPalette />
          <OnlineOrderAlert />
        </div>
      </FYProvider>
    </WebSocketProvider>
  );
}
