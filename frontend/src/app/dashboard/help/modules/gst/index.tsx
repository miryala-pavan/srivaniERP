'use client';

import { useState } from 'react';
import { ChevronLeft, Receipt } from 'lucide-react';
import { te } from '../../_shared';
import GSTOverview from './gst-overview';
import GSTReturns from './gst-returns';
import GSTRegisters from './gst-registers';
import GSTFiling from './gst-filing';
import GSTReference from './gst-reference';

const SECTIONS = [
  { id: 'gst-overview',   label: 'What are GST Reports?',    te: 'GST రిపోర్ట్‌లు అంటే?' },
  { id: 'gst-tabs',       label: '6 Tabs at a Glance',       te: '6 ట్యాబ్‌ల సారాంశం' },
  { id: 'gst-3b',         label: 'GSTR-3B Summary',          te: 'GSTR-3B సారాంశం' },
  { id: 'gst-itc',        label: 'Input Tax Credit (ITC)',    te: 'ఇన్‌పుట్ ట్యాక్స్ క్రెడిట్' },
  { id: 'gst-sales',      label: 'Sales Register',           te: 'సేల్స్ రిజిస్టర్' },
  { id: 'gst-purchase',   label: 'Purchase Register',        te: 'పర్చేస్ రిజిస్టర్' },
  { id: 'gst-hsn',        label: 'HSN + GSTR-1 Filing',      te: 'HSN + GSTR-1 ఫైలింగ్' },
  { id: 'gst-inward',     label: 'Inward Supplies (GSTR-2)', te: 'ఇన్వార్డ్ సప్లైస్' },
  { id: 'gst-trend',      label: 'FY Trend Dashboard',       te: 'FY ట్రెండ్ డాష్‌బోర్డ్' },
  { id: 'gst-recon2b',    label: 'Reconciliation Tool',      te: 'రికన్సిలియేషన్ టూల్' },
  { id: 'gst-ca',         label: 'Share with CA',            te: 'CA తో షేర్ చేయండి' },
  { id: 'gst-checklist',  label: 'Monthly Checklist',        te: 'నెలవారీ చెక్‌లిస్ట్' },
  { id: 'gst-mistakes',   label: 'Common Mistakes',          te: 'సాధారణ తప్పులు' },
  { id: 'gst-faq',        label: 'FAQ',                      te: 'తరచుగా అడిగే ప్రశ్నలు' },
];

export default function GSTModule({ onBack }: { onBack: () => void }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-emerald-800 text-white px-6 py-7">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <Receipt className="w-6 h-6" />
            <h1 className="text-xl font-bold">GST Reports Guide</h1>
          </div>
          <p className="text-emerald-200 text-sm" style={te}>GST రిపోర్ట్‌లు గైడ్</p>
          <p className="text-emerald-300 text-xs mt-1.5">ERP Platform · Tax & Compliance Guide · July 2026</p>
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
                  activeSection === s.id ? 'bg-emerald-700 text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'
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
          <GSTOverview />
          <GSTReturns />
          <GSTRegisters />
          <GSTFiling />
          <GSTReference />
        </main>
      </div>
    </div>
  );
}
