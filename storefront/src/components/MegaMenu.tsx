'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { NavDepartment } from '@/lib/shop';

interface Props {
  navTree: NavDepartment[];
}

const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const PANEL_W   = 900; // must match .mega-panel max width
const PANEL_GAP = 12;  // px gap between trigger bottom and panel top
const EDGE_PAD  = 8;   // min px from viewport edge

export default function MegaMenu({ navTree }: Props) {
  const [open, setOpen]               = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [activeDept, setActiveDept]   = useState<string>(navTree[0]?.code ?? '');
  const [activeCat, setActiveCat]     = useState<string>('');
  const [expandedDept, setExpandedDept] = useState<string>('');
  const [expandedCat, setExpandedCat]   = useState<string>('');
  const [panelStyle, setPanelStyle]   = useState<React.CSSProperties>({});
  const [mounted, setMounted]         = useState(false);

  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Portal requires document — only available after hydration
  useEffect(() => { setMounted(true); }, []);

  // Mobile nav open event (fired by BottomNav)
  useEffect(() => {
    const handler = () => setDrawerOpen(true);
    document.addEventListener('openMobileNav', handler);
    return () => document.removeEventListener('openMobileNav', handler);
  }, []);

  // ── Position calculation ─────────────────────────────────────────────────
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect  = triggerRef.current.getBoundingClientRect();
    const vw    = window.innerWidth;
    const panelW = Math.min(PANEL_W, vw - EDGE_PAD * 2);

    // Centre under trigger, then clamp to viewport
    let left = rect.left + rect.width / 2 - panelW / 2;
    left = Math.max(EDGE_PAD, Math.min(left, vw - panelW - EDGE_PAD));

    setPanelStyle({
      position : 'fixed',
      top      : rect.bottom + PANEL_GAP,
      left,
      width    : panelW,
    });
  }, []);

  // ── Hover open / close ───────────────────────────────────────────────────
  //  IMPORTANT: always clearTimeout before setting a new one so stale timers
  //  never close the panel after cancelClose has been called.
  const scheduleClose = useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  const openMenu = useCallback(() => {
    clearTimeout(closeTimer.current);
    calcPosition();
    setOpen(true);
    setActiveDept(d => d || (navTree[0]?.code ?? ''));
  }, [calcPosition, navTree]);

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  }, []);

  // ── Re-position on resize / scroll while open ────────────────────────────
  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', calcPosition, { passive: true });
    window.addEventListener('scroll', calcPosition, { passive: true });
    return () => {
      window.removeEventListener('resize', calcPosition);
      window.removeEventListener('scroll', calcPosition);
    };
  }, [open, calcPosition]);

  // ── Click-outside to close (replaces the backdrop div) ───────────────────
  //  No backdrop div — it was causing the panel to close immediately because:
  //  1. Backdrop z-index (199) > header z-index (50), so it covered the trigger.
  //  2. Browser fired onMouseEnter on the backdrop the moment it rendered
  //     (mouse was still physically over the trigger), calling scheduleClose.
  //  3. scheduleClose was also leaking multiple timers (no clearTimeout before
  //     setting a new one), so cancelClose only cleared the last one.
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) return;
      close();
    };
    // Use pointerdown so click-outside fires before React synthetic events
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open, close]);

  // ── Escape key ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  // Mobile accordion helpers
  const toggleDept = (code: string) => {
    setExpandedDept(prev => (prev === code ? '' : code));
    setExpandedCat('');
  };
  const toggleCat = (code: string) => {
    setExpandedCat(prev => (prev === code ? '' : code));
  };

  const currentDept = navTree.find(d => d.code === activeDept) ?? navTree[0];
  const currentCat  = currentDept?.categories.find(c => c.code === activeCat);
  const shownSubs   = currentCat?.subcategories
    ?? currentDept?.categories[0]?.subcategories
    ?? [];

  // ── Mega-panel rendered into document.body via portal ────────────────────
  //  Portal prevents any ancestor overflow:hidden or stacking-context clipping.
  //  No backdrop div — click-outside is handled by the pointerdown listener above.
  const megaPanel = mounted && open
    ? createPortal(
        <div
          ref={panelRef}
          className="mega-panel"
          style={panelStyle}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {/* Col 1 — Departments */}
          <div className="mega-col">
            <p className="mega-col-head">Department</p>
            {navTree.map(dept => (
              <Link
                key={dept.code}
                href={`/products?dept=${dept.code}`}
                className={`mega-dept${activeDept === dept.code ? ' active' : ''}`}
                onMouseEnter={() => { setActiveDept(dept.code); setActiveCat(''); }}
                onClick={close}
              >
                <span>{dept.name}</span>
                <span className="mega-dept-count">{dept.productCount.toLocaleString()}</span>
              </Link>
            ))}
          </div>

          {/* Col 2 — Categories */}
          <div className="mega-col">
            <p className="mega-col-head">Category</p>
            {currentDept?.categories.map(cat => (
              <Link
                key={cat.code}
                href={`/category/${cat.code}`}
                className={`mega-cat${activeCat === cat.code ? ' active' : ''}`}
                onMouseEnter={() => setActiveCat(cat.code)}
                onClick={close}
              >
                <span>{cat.name}</span>
                <span className="mega-cat-count">{cat.subcategories.length}</span>
              </Link>
            ))}
          </div>

          {/* Col 3 — Subcategories */}
          <div className="mega-col">
            <p className="mega-col-head">Subcategory</p>
            {shownSubs.length > 0
              ? shownSubs.map(sub => (
                  <Link
                    key={sub.code}
                    href={`/category/${sub.code}`}
                    className="mega-sub"
                    onClick={close}
                  >
                    {sub.name}
                  </Link>
                ))
              : <span className="mega-sub-empty">Hover a category</span>
            }
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {/* ── Desktop trigger ──────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        className={`mega-trigger${open ? ' open' : ''}`}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onClick={() => (open ? close() : openMenu())}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Categories
        <ChevronDown />
      </button>

      {megaPanel}

      {/* ── Mobile drawer overlay ────────────────────────────────────────── */}
      <div
        className={`nav-drawer-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      <nav className={`nav-drawer${drawerOpen ? ' open' : ''}`} aria-label="Navigation">
        <div className="nav-drawer-head">
          <span className="nav-drawer-title">Browse</span>
          <button
            className="nav-drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close"
          >
            &#215;
          </button>
        </div>

        {navTree.map(dept => (
          <div key={dept.code}>
            <button
              className={`drawer-dept-btn${expandedDept === dept.code ? ' expanded' : ''}`}
              onClick={() => toggleDept(dept.code)}
            >
              {dept.name}
              <ChevronRight />
            </button>

            {expandedDept === dept.code && (
              <div className="drawer-cats">
                <Link
                  href={`/products?dept=${dept.code}`}
                  className="drawer-all-link"
                  onClick={() => setDrawerOpen(false)}
                >
                  All in {dept.name} &rarr;
                </Link>

                {dept.categories.map(cat => (
                  <div key={cat.code}>
                    <button
                      className={`drawer-cat-btn${expandedCat === cat.code ? ' expanded' : ''}`}
                      onClick={() => toggleCat(cat.code)}
                    >
                      {cat.name}
                      <ChevronRight />
                    </button>

                    {expandedCat === cat.code && (
                      <div className="drawer-subs">
                        <Link
                          href={`/category/${cat.code}`}
                          className="drawer-all-link"
                          style={{ paddingLeft: '52px' }}
                          onClick={() => setDrawerOpen(false)}
                        >
                          All in {cat.name} &rarr;
                        </Link>
                        {cat.subcategories.map(sub => (
                          <Link
                            key={sub.code}
                            href={`/category/${sub.code}`}
                            className="drawer-sub-link"
                            onClick={() => setDrawerOpen(false)}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </>
  );
}
