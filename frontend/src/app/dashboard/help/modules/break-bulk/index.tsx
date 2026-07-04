'use client';

import { useState } from 'react';
import { ChevronLeft, SplitSquareHorizontal } from 'lucide-react';
import { te } from '../../_shared';
import BBOverview from './bb-overview';
import BBSteps from './bb-steps';
import BBReference from './bb-reference';

const SECTIONS = [
  { id: 'what',     label: 'What is Break Bulk?',      te: 'బ్రేక్ బల్క్ అంటే?' },
  { id: 'types',    label: 'Two Types',                 te: 'రెండు రకాలు' },
  { id: 'newflow',  label: 'New Unified Flow',          te: 'కొత్త యూనిఫైడ్ ఫ్లో' },
  { id: 'fixed',    label: 'Fixed — Step by Step',      te: 'స్థిర — దశలవారీగా' },
  { id: 'variable', label: 'Variable — Step by Step',   te: 'వేరియబుల్ — దశలవారీగా' },
  { id: 'setup',    label: 'Inline Setup Wizard',       te: 'ఇన్‌లైన్ సెటప్ విజార్డ్' },
  { id: 'cost',     label: 'Cost Calculation',          te: 'కాస్ట్ లెక్కింపు' },
  { id: 'impact',   label: 'Stock & POS Impact',        te: 'స్టాక్ & POS ప్రభావం' },
  { id: 'history',  label: 'History & Reversal',        te: 'హిస్టరీ & రివర్సల్' },
  { id: 'examples', label: 'More Examples',             te: 'మరిన్ని ఉదాహరణలు' },
  { id: 'mistakes', label: 'Common Mistakes',           te: 'సాధారణ తప్పులు' },
  { id: 'faq',      label: 'FAQ',                       te: 'తరచుగా అడిగే ప్రశ్నలు' },
];

export default function BreakBulkModule({ onBack }: { onBack: () => void }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1B4F8A] text-white px-6 py-7">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <SplitSquareHorizontal className="w-6 h-6" />
            <h1 className="text-xl font-bold">Break Bulk / Repack Guide</h1>
          </div>
          <p className="text-blue-200 text-sm" style={te}>బ్రేక్ బల్క్ / రీప్యాక్ గైడ్</p>
          <p className="text-blue-300 text-xs mt-1.5">Srivani Stores ERP · Staff Training Guide · July 2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 flex gap-5">
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-4 bg-white rounded-xl border border-gray-200 p-3">
            <button onClick={onBack}
              className="w-full text-left px-2 py-1.5 rounded-md text-xs text-gray-500 hover:bg-gray-100 flex items-center gap-1 mb-2 transition-colors">
              <ChevronLeft className="w-3 h-3" /> Help Center
            </button>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-t border-gray-100 pt-2">Contents</p>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs mb-0.5 transition-colors ${
                  activeSection === s.id ? 'bg-[#C2410C] text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {/* Mobile back */}
          <button onClick={onBack}
            className="lg:hidden flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-4 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Help Center
          </button>
          <BBOverview />
          <BBSteps />
          <BBReference />
        </main>
      </div>
    </div>
  );
}
