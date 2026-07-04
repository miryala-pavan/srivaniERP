'use client';

import { useState } from 'react';
import {
  BookOpen, SplitSquareHorizontal, Receipt,
  Package, ShoppingCart, ClipboardList, ChevronRight,
} from 'lucide-react';
import BreakBulkModule from './modules/break-bulk';
import GSTModule from './modules/gst';

type ActiveModule = 'break-bulk' | 'gst' | null;

const te = { fontFamily: 'Noto Sans Telugu, Gautami, sans-serif' };

const ACTIVE_MODULES = [
  {
    id: 'break-bulk' as const,
    icon: SplitSquareHorizontal,
    color: 'bg-[#1B4F8A]',
    cardBorder: 'border-blue-200 hover:border-blue-400',
    badge: 'bg-blue-100 text-blue-800',
    title: 'Break Bulk & Repack',
    te: 'బ్రేక్ బల్క్ & రీప్యాక్ గైడ్',
    desc: 'How to split cartons and bulk bags into sellable units. Fixed and variable types, step-by-step walkthroughs, cost calculation, stock impact, and session reversal.',
    sections: '12 sections',
  },
  {
    id: 'gst' as const,
    icon: Receipt,
    color: 'bg-emerald-700',
    cardBorder: 'border-emerald-200 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800',
    title: 'GST Reports',
    te: 'GST రిపోర్ట్‌లు గైడ్',
    desc: 'Understand all 6 GST tabs — GSTR-3B, ITC, Sales & Purchase Registers, HSN+GSTR-1, Inward Supplies, FY Trend. Monthly filing checklist and CA share link.',
    sections: '13 sections',
  },
];

const COMING_SOON = [
  { icon: Package,       title: 'Products & PLU',   te: 'ప్రొడక్ట్స్ & PLU' },
  { icon: ClipboardList, title: 'GRN & Purchasing', te: 'GRN & పర్చేసింగ్' },
  { icon: ShoppingCart,  title: 'POS Billing',       te: 'POS బిల్లింగ్' },
  { icon: BookOpen,      title: 'Purchase Orders',   te: 'పర్చేస్ ఆర్డర్లు' },
];

export default function HelpPage() {
  const [activeModule, setActiveModule] = useState<ActiveModule>(null);

  if (activeModule === 'break-bulk') return <BreakBulkModule onBack={() => setActiveModule(null)} />;
  if (activeModule === 'gst')        return <GSTModule onBack={() => setActiveModule(null)} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1B4F8A] text-white px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <BookOpen className="w-6 h-6" />
            <h1 className="text-xl font-bold">Srivani ERP — Help Center</h1>
          </div>
          <p className="text-blue-200 text-sm" style={te}>సహాయ కేంద్రం — అన్ని మాడ్యూళ్ళకు గైడ్‌లు</p>
          <p className="text-blue-300 text-xs mt-1.5">Staff Training Guides · Bilingual (English + Telugu) · July 2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Available Guides</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {ACTIVE_MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button key={mod.id} onClick={() => setActiveModule(mod.id)}
                className={`text-left bg-white border-2 ${mod.cardBorder} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`${mod.color} p-2.5 rounded-xl shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-bold text-gray-800 group-hover:text-[#1B4F8A] transition-colors">{mod.title}</h2>
                    <p className="text-xs text-gray-500 mt-0.5" style={te}>{mod.te}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 mt-1 shrink-0 transition-colors" />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-2">{mod.desc}</p>
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${mod.badge}`}>
                  {mod.sections} · Bilingual
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Coming Soon</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COMING_SOON.map(mod => {
            const Icon = mod.icon;
            return (
              <div key={mod.title}
                className="bg-white border border-gray-200 rounded-xl p-4 opacity-60 cursor-not-allowed">
                <div className="bg-gray-100 p-2 rounded-lg w-fit mb-2">
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs font-semibold text-gray-500">{mod.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5" style={te}>{mod.te}</p>
                <span className="text-[10px] text-gray-400 mt-1.5 inline-block">Coming soon</span>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8 pt-5 border-t border-gray-200">
          Srivani Stores ERP Help Center · More modules added as features are built
        </p>
      </div>
    </div>
  );
}
