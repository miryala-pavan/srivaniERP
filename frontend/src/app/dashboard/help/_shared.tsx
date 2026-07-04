'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, CheckCircle } from 'lucide-react';

export const te = { fontFamily: 'Noto Sans Telugu, Gautami, sans-serif' };

export function BiText({ en, te: teText, className = '' }: { en: string; te: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-gray-800 leading-relaxed text-sm">{en}</p>
      <p className="text-gray-500 text-xs mt-0.5 leading-relaxed" style={te}>{teText}</p>
    </div>
  );
}

export function BiHeading({ en, te: teText, level = 3 }: { en: string; te: string; level?: number }) {
  if (level === 2) return (
    <div className="mb-3 mt-6 first:mt-0">
      <h2 className="text-base font-bold text-gray-800">{en}</h2>
      <p className="text-sm font-semibold text-gray-500 mt-0.5" style={te}>{teText}</p>
    </div>
  );
  return (
    <div className="mb-2 mt-5">
      <h3 className="text-sm font-bold text-gray-700">{en}</h3>
      <p className="text-xs font-semibold text-gray-400 mt-0.5" style={te}>{teText}</p>
    </div>
  );
}

export function BiBullet({ en, te: teText }: { en: string; te: string }) {
  return (
    <li className="mb-2.5 flex gap-2 items-start">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
      <div>
        <p className="text-gray-800 text-sm leading-relaxed">{en}</p>
        <p className="text-gray-500 text-xs mt-0.5 leading-relaxed" style={te}>{teText}</p>
      </div>
    </li>
  );
}

export function BiStep({ step, en, te: teText, color = 'blue' }: { step: number; en: string; te: string; color?: string }) {
  const colors: Record<string, string> = {
    blue:  'bg-[#1B4F8A] text-white',
    amber: 'bg-amber-600 text-white',
    green: 'bg-green-700 text-white',
  };
  return (
    <div className="flex gap-3 mb-3">
      <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${colors[color] ?? colors.blue}`}>{step}</div>
      <div>
        <p className="text-gray-800 text-sm leading-relaxed font-medium">{en}</p>
        <p className="text-gray-500 text-xs mt-0.5 leading-relaxed" style={te}>{teText}</p>
      </div>
    </div>
  );
}

export function InfoBox({ en, te: teText, color = 'blue', className }: {
  en: string; te: string; color?: 'blue' | 'green' | 'amber' | 'red'; className?: string;
}) {
  const styles = {
    blue:  'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red:   'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`border rounded-lg p-3 my-3 ${styles[color]} ${className ?? ''}`}>
      <p className="text-xs leading-relaxed font-medium">{en}</p>
      <p className="text-[11px] mt-1 leading-relaxed opacity-80" style={te}>{teText}</p>
    </div>
  );
}

export function ResultBox({ en, te: teText }: { en: string; te: string }) {
  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 my-3">
      <div className="flex items-center gap-2 mb-1.5">
        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
        <span className="text-xs font-bold text-green-800">Result / ఫలితం</span>
      </div>
      <p className="text-xs text-green-900 leading-relaxed">{en}</p>
      <p className="text-[11px] text-green-700 mt-1 leading-relaxed" style={te}>{teText}</p>
    </div>
  );
}

export function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="mb-6">{children}</section>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className ?? ''}`}>{children}</div>;
}

export function SectionHeader({ icon: Icon, num, en, te: teText }: {
  icon: React.ElementType; num: number; en: string; te: string;
}) {
  return (
    <div className="flex items-start gap-2 mb-4 pb-3 border-b border-gray-100">
      <Icon className="text-[#C2410C] mt-0.5 shrink-0" style={{ width: '1.1rem', height: '1.1rem' }} />
      <div>
        <h2 className="text-base font-bold text-[#C2410C]">{num}. {en}</h2>
        <p className="text-xs font-semibold text-[#C2410C]/70 mt-0.5" style={te}>{teText}</p>
      </div>
    </div>
  );
}

export function FaqItem({ q, qte, a, ate }: { q: string; qte: string; a: string; ate: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg mb-2.5 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
        <HelpCircle className="w-4 h-4 text-[#C2410C] shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">{q}</p>
          <p className="text-xs text-gray-500 mt-0.5" style={te}>{qte}</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-700 leading-relaxed">{a}</p>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed" style={te}>{ate}</p>
        </div>
      )}
    </div>
  );
}

export function FlowMockup() {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50">
      <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex gap-1">
        <span className="bg-white text-gray-900 shadow-sm text-[10px] font-semibold px-2.5 py-1 rounded-md">⚡ New Session</span>
        <span className="text-gray-500 text-[10px] font-medium px-2.5 py-1 rounded-md">🕐 History</span>
        <span className="text-gray-500 text-[10px] font-medium px-2.5 py-1 rounded-md">⚠ Wastage Report</span>
      </div>
      <div className="px-3 pt-3 pb-2">
        <div className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
          <span className="text-gray-400 text-xs">🔍</span>
          <span className="text-[11px] text-gray-400">Search by product name, PLU code or barcode…</span>
        </div>
      </div>
      <div className="px-3 pb-3 grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
          <div className="font-bold text-blue-800">📦 Fixed bundle</div>
          <div className="text-blue-600 mt-0.5">→ Break form</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
          <div className="font-bold text-amber-800">⚖️ Variable bundle</div>
          <div className="text-amber-600 mt-0.5">→ Repack form</div>
        </div>
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-2 text-center">
          <div className="font-bold text-gray-700">❓ No bundle</div>
          <div className="text-gray-500 mt-0.5">→ Setup wizard</div>
        </div>
      </div>
    </div>
  );
}
