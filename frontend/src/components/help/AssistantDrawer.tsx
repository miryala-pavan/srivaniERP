'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X, ChevronDown, ChevronRight, AlertTriangle, BookOpen, Languages } from 'lucide-react';
import { useAssistant } from './AssistantProvider';
import { HELP_CONTENT, findEntry } from '@/lib/help-content';

const LANG_KEY    = 'erp_assist_lang';
const SEEN_PREFIX = 'erp_assist_seen_';

export function AssistantDrawer() {
  const { isOpen, close } = useAssistant();
  const pathname = usePathname() ?? '';

  const [lang,     setLang]     = useState<'en' | 'te'>('en');
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [isNew,    setIsNew]    = useState(false);
  const [mounted,  setMounted]  = useState(false);

  const entry = findEntry(pathname);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'te') setLang('te');
  }, []);

  // On route change: check version + reset expanded
  useEffect(() => {
    if (!mounted || !entry) return;
    const seen = localStorage.getItem(`${SEEN_PREFIX}${entry.id}`);
    setIsNew(seen !== entry.version);
    setExpanded(new Set([0]));
  }, [mounted, entry?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Mark seen when drawer opens
  useEffect(() => {
    if (isOpen && mounted && entry) {
      localStorage.setItem(`${SEEN_PREFIX}${entry.id}`, entry.version);
      setIsNew(false);
    }
  }, [isOpen, mounted, entry?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  function t(field: { en: string; te: string }) {
    return lang === 'te' ? field.te : field.en;
  }

  function toggleLang() {
    const next = lang === 'en' ? 'te' : 'en';
    setLang(next);
    if (mounted) localStorage.setItem(LANG_KEY, next);
  }

  function toggleSection(i: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Slide-in drawer */}
      <div
        role="dialog"
        aria-label="Assistant"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 z-50 w-[380px] bg-white shadow-2xl flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-200 shrink-0">
          <BookOpen className="w-4 h-4 text-[#1B4F8A] shrink-0" />
          <span className="text-sm font-bold text-gray-900 flex-1 truncate">
            {entry ? t(entry.title) : 'Assistant'}
          </span>

          {isNew && (
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">
              Updated v{entry?.version}
            </span>
          )}

          <button
            onClick={toggleLang}
            title="Switch language"
            className="text-xs font-semibold text-gray-400 hover:text-[#1B4F8A] transition-colors
              border border-gray-200 rounded px-2 py-0.5 shrink-0 flex items-center gap-1"
          >
            <Languages className="w-3 h-3" />
            {lang === 'en' ? 'తె' : 'EN'}
          </button>

          <button
            onClick={close}
            className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Close assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!entry ? (
            <EmptyState />
          ) : (
            <div className="px-5 py-5 space-y-4">

              {/* Summary card */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <p className="text-sm text-blue-900 leading-relaxed">{t(entry.summary)}</p>
              </div>

              {/* Sections — collapsible */}
              {entry.sections?.map((sec, i) => (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleSection(i)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-gray-800">{t(sec.title)}</span>
                    {expanded.has(i)
                      ? <ChevronDown  className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                  </button>
                  {expanded.has(i) && (
                    <div className="px-4 pb-4 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-100 whitespace-pre-line">
                      {t(sec.body)}
                    </div>
                  )}
                </div>
              ))}

              {/* Field Guide */}
              {entry.fields && Object.keys(entry.fields).length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Field Guide
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {Object.entries(entry.fields).map(([key, hint]) => (
                      <div key={key} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                        <p className="text-xs font-bold text-[#1B4F8A] font-mono mb-0.5">{key}</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{t(hint)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Mistakes */}
              {entry.commonMistakes && entry.commonMistakes.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Common Mistakes
                  </p>
                  <div className="space-y-2">
                    {entry.commonMistakes.map((m, i) => (
                      <div key={i} className="border border-orange-200 rounded-xl overflow-hidden">
                        <div className="flex items-start gap-2 px-4 py-2.5 bg-orange-50">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                          <p className="text-xs font-semibold text-orange-800">{t(m.mistake)}</p>
                        </div>
                        <div className="px-4 py-2.5 bg-white">
                          <p className="text-xs text-gray-600 leading-relaxed">✓ {t(m.fix)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Topics */}
              {entry.relatedTopics && entry.relatedTopics.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Related
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entry.relatedTopics.map(id => {
                      const rel = HELP_CONTENT.find(e => e.id === id);
                      if (!rel) return null;
                      return (
                        <span
                          key={id}
                          className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full
                            hover:bg-blue-50 hover:text-[#1B4F8A] transition-colors cursor-default"
                        >
                          {t(rel.title)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            Press{' '}
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">?</kbd>
            {' '}to toggle
          </p>
          <p className="text-[10px] text-gray-300">Srivani ERP</p>
        </div>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <BookOpen className="w-10 h-10 text-gray-200 mb-3" />
      <p className="text-sm font-medium text-gray-500">No guide for this page yet.</p>
      <p className="text-xs text-gray-400 mt-1">
        Press{' '}
        <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px] text-gray-600">?</kbd>
        {' '}to close
      </p>
    </div>
  );
}
