'use client';

import { useEffect, useRef } from 'react';
import { X, ChevronRight, ExternalLink } from 'lucide-react';
import { usePopup, PopupEntityType } from '@/context/PopupContext';
import ProductPanel from './panels/ProductPanel';
import GrnPanel from './panels/GrnPanel';
import SupplierPanel from './panels/SupplierPanel';

const ENTITY_ROUTES: Record<PopupEntityType, string> = {
  product:  '/dashboard/products',
  grn:      '/dashboard/grn',
  supplier: '/dashboard/suppliers',
};

export default function PopupShell() {
  const { stack, pop, popAll, top } = usePopup();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (stack.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [stack.length]);

  if (!top) return null;

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === backdropRef.current) popAll();
  }

  function goTo(idx: number) {
    // Pop down to this breadcrumb level
    const stepsToRemove = stack.length - 1 - idx;
    for (let i = 0; i < stepsToRemove; i++) pop();
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        className="relative h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-slide-in-right"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header bar ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          {/* Breadcrumb trail */}
          <nav className="flex items-center gap-1 flex-1 min-w-0 text-sm">
            {stack.map((entry, i) => (
              <span key={`${entry.type}-${entry.id}`} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                <button
                  onClick={() => goTo(i)}
                  className={`truncate max-w-[160px] ${
                    i === stack.length - 1
                      ? 'font-semibold text-gray-800 cursor-default'
                      : 'text-[#1B4F8A] hover:underline'
                  }`}
                  disabled={i === stack.length - 1}
                >
                  {entry.label}
                </button>
              </span>
            ))}
          </nav>

          {/* Open full page */}
          <a
            href={`${ENTITY_ROUTES[top.type]}/${top.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[#1B4F8A] hover:bg-blue-50"
            title="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={pop}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Panel content ── */}
        <div className="flex-1 overflow-y-auto">
          {top.type === 'product'  && <ProductPanel  id={top.id} />}
          {top.type === 'grn'      && <GrnPanel      id={top.id} />}
          {top.type === 'supplier' && <SupplierPanel id={top.id} />}
        </div>
      </div>
    </div>
  );
}
