'use client';

import { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronUp, Package, Scale, Layers, AlertTriangle,
  HelpCircle, CheckCircle, ArrowRight, Search, Zap, Settings2,
  SplitSquareHorizontal, History, RotateCcw, ChevronRight,
} from 'lucide-react';

const SECTIONS = [
  { id: 'what',      label: 'What is Break Bulk?',        te: 'బ్రేక్ బల్క్ అంటే ఏమిటి?' },
  { id: 'types',     label: 'Two Types',                   te: 'రెండు రకాలు' },
  { id: 'newflow',   label: 'New Unified Flow',            te: 'కొత్త యూనిఫైడ్ ఫ్లో' },
  { id: 'fixed',     label: 'Fixed — Step by Step',        te: 'స్థిర — దశలవారీగా' },
  { id: 'variable',  label: 'Variable — Step by Step',     te: 'వేరియబుల్ — దశలవారీగా' },
  { id: 'setup',     label: 'Inline Setup Wizard',         te: 'ఇన్‌లైన్ సెటప్ విజార్డ్' },
  { id: 'cost',      label: 'Cost Calculation',            te: 'కాస్ట్ లెక్కింపు' },
  { id: 'impact',    label: 'Stock & POS Impact',          te: 'స్టాక్ & POS ప్రభావం' },
  { id: 'history',   label: 'History & Reversal',          te: 'హిస్టరీ & రివర్సల్' },
  { id: 'examples',  label: 'More Examples',               te: 'మరిన్ని ఉదాహరణలు' },
  { id: 'mistakes',  label: 'Common Mistakes',             te: 'సాధారణ తప్పులు' },
  { id: 'faq',       label: 'FAQ',                         te: 'తరచుగా అడిగే ప్రశ్నలు' },
];

const te = { fontFamily: 'Noto Sans Telugu, Gautami, sans-serif' };

function BiText({ en, te: teText, className = '' }: { en: string; te: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-gray-800 leading-relaxed text-sm">{en}</p>
      <p className="text-gray-500 text-xs mt-0.5 leading-relaxed" style={te}>{teText}</p>
    </div>
  );
}

function BiHeading({ en, te: teText, level = 3 }: { en: string; te: string; level?: number }) {
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

function BiBullet({ en, te: teText }: { en: string; te: string }) {
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

function BiStep({ step, en, te: teText, color = 'blue' }: { step: number; en: string; te: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-[#1B4F8A] text-white',
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

function InfoBox({ en, te: teText, color = 'blue', className }: { en: string; te: string; color?: 'blue' | 'green' | 'amber' | 'red'; className?: string }) {
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

function ResultBox({ en, te: teText }: { en: string; te: string }) {
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

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} className="mb-6">{children}</section>;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className ?? ''}`}>{children}</div>;
}

function SectionHeader({ icon: Icon, num, en, te: teText }: { icon: any; num: number; en: string; te: string }) {
  return (
    <div className="flex items-start gap-2 mb-4 pb-3 border-b border-gray-100">
      <Icon className="w-4.5 h-4.5 text-[#C2410C] mt-0.5 shrink-0" style={{ width: '1.1rem', height: '1.1rem' }} />
      <div>
        <h2 className="text-base font-bold text-[#C2410C]">{num}. {en}</h2>
        <p className="text-xs font-semibold text-[#C2410C]/70 mt-0.5" style={te}>{teText}</p>
      </div>
    </div>
  );
}

function FaqItem({ q, qte, a, ate }: { q: string; qte: string; a: string; ate: string }) {
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
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
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

// Inline mockup of the new page flow
function FlowMockup() {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50">
      {/* Tab bar */}
      <div className="bg-gray-100 border-b border-gray-200 px-3 py-2 flex gap-1">
        <span className="bg-white text-gray-900 shadow-sm text-[10px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" /> New Session
        </span>
        <span className="text-gray-500 text-[10px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1">
          <History className="w-3 h-3" /> History
        </span>
        <span className="text-gray-500 text-[10px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Wastage Report
        </span>
      </div>

      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
          <Search className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[11px] text-gray-400">Search by product name, PLU code or barcode…</span>
        </div>
      </div>

      {/* Auto-routing arrows */}
      <div className="px-3 pb-3">
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <div className="font-bold text-blue-800">📦 Fixed bundle found</div>
            <div className="text-blue-600 mt-0.5">→ Straight to break form</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
            <div className="font-bold text-amber-800">⚖️ Variable bundle found</div>
            <div className="text-amber-600 mt-0.5">→ Straight to repack form</div>
          </div>
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-2 text-center">
            <div className="font-bold text-gray-700">❓ No bundle yet</div>
            <div className="text-gray-500 mt-0.5">→ Inline setup wizard</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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

        {/* Sticky Table of Contents */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-4 bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Contents</p>
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs mb-0.5 transition-colors ${
                  activeSection === s.id ? 'bg-[#C2410C] text-white font-semibold' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-0">

          {/* ── 1. WHAT ── */}
          <Section id="what">
            <Card>
              <SectionHeader icon={Package} num={1} en="What is Break Bulk?" te="బ్రేక్ బల్క్ అంటే ఏమిటి?" />
              <BiText className="mb-3"
                en="Break Bulk (also called Repack) means taking a large package — a carton, box, or bag — and splitting it into smaller units that can be sold individually to customers."
                te="బ్రేక్ బల్క్ అంటే ఒక పెద్ద కార్టన్, పెట్టె, లేదా బస్తాను తీసుకుని దాన్ని చిన్న యూనిట్లుగా విభజించడం — ఇవి కస్టమర్లకు విడిగా అమ్మవచ్చు." />
              <InfoBox color="blue"
                en="Example: You receive a carton of 24 Parle-G biscuit packets from your supplier. Instead of selling the whole carton, you break it open and sell each packet at the counter."
                te="ఉదాహరణ: మీరు 24 పార్లే-జి బిస్కెట్ పొట్లాల కార్టన్ కొంటారు. మొత్తం కార్టన్ అమ్మకుండా, తెరిచి ప్రతి పొట్లాన్ని కౌంటర్‌లో అమ్ముతారు." />
              <BiHeading en="Why is it needed?" te="దీని అవసరం ఏమిటి?" />
              <ul className="list-none space-y-0 pl-0">
                <BiBullet en="Suppliers sell in bulk; customers buy single units" te="సప్లయర్లు పెద్దగా అమ్ముతారు; కస్టమర్లు ఒక్కో యూనిట్ కొంటారు" />
                <BiBullet en="ERP tracks stock accurately at unit level after every break" te="ప్రతి బ్రేక్ తర్వాత ERP యూనిట్ స్థాయిలో స్టాక్ ఖచ్చితంగా ట్రాక్ చేస్తుంది" />
                <BiBullet en="Cost price per small unit is calculated automatically — no manual math" te="చిన్న యూనిట్ కాస్ట్ స్వయంచాలకంగా లెక్కించబడుతుంది — మాన్యువల్ అవసరం లేదు" />
                <BiBullet en="POS immediately reflects updated unit stock — no restart needed" te="POS వెంటనే అప్‌డేటెడ్ స్టాక్ చూపిస్తుంది — రీస్టార్ట్ అవసరం లేదు" />
              </ul>
            </Card>
          </Section>

          {/* ── 2. TYPES ── */}
          <Section id="types">
            <Card>
              <SectionHeader icon={Layers} num={2} en="Two Types of Break Bulk" te="రెండు రకాలు" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="border-2 border-blue-300 rounded-xl p-3.5 bg-blue-50">
                  <div className="text-blue-800 font-bold text-sm mb-0.5">📦 TYPE 1: Fixed</div>
                  <div className="text-blue-600 text-xs mb-2" style={te}>స్థిర బ్రేక్ బల్క్</div>
                  <p className="text-xs text-blue-900 mb-2">Every carton always has the <strong>same fixed number</strong> of units. Count never changes.</p>
                  <div className="text-[11px] text-blue-800 space-y-1">
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 1 carton Parle-G = 24 packets</div>
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 1 box Lux soap = 6 bars</div>
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 1 box shampoo = 48 sachets</div>
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 1 crate cold drink = 24 bottles</div>
                  </div>
                </div>
                <div className="border-2 border-amber-300 rounded-xl p-3.5 bg-amber-50">
                  <div className="text-amber-800 font-bold text-sm mb-0.5">⚖️ TYPE 2: Variable</div>
                  <div className="text-amber-600 text-xs mb-2" style={te}>వేరియబుల్ బ్రేక్ బల్క్</div>
                  <p className="text-xs text-amber-900 mb-2">You buy by <strong>weight</strong> and repack into different sizes each time — you decide at repack time.</p>
                  <div className="text-[11px] text-amber-800 space-y-1">
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 50kg rice bag → 1kg, 2kg, 5kg packets</div>
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 25kg sugar bag → 500g, 1kg packets</div>
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 10kg dal → 250g, 500g, 1kg packets</div>
                    <div className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> 5kg dry fruits → 100g, 200g packets</div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1B4F8A] text-white">
                      <th className="px-3 py-2 text-left">Feature</th>
                      <th className="px-3 py-2 text-left">📦 Fixed</th>
                      <th className="px-3 py-2 text-left">⚖️ Variable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Input unit',        'No. of cartons/boxes',  'Weight in grams'],
                      ['Output',            'Fixed units per carton', 'Custom packet sizes & qty'],
                      ['Cost formula',      'Cost ÷ units/carton',   'Cost × (packet g ÷ total g)'],
                      ['Wastage unit',      'Pieces',                 'Grams'],
                      ['Setup needed',      'Yes (done inline, once)','Not required'],
                      ['Typical products',  'Biscuits, Soap, Bottles','Rice, Sugar, Dal, Spices'],
                    ].map(([feat, fixed, variable], i) => (
                      <tr key={feat} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-3 py-2 font-semibold text-gray-700 border border-gray-200">{feat}</td>
                        <td className="px-3 py-2 text-gray-600 border border-gray-200">{fixed}</td>
                        <td className="px-3 py-2 text-gray-600 border border-gray-200">{variable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>

          {/* ── 3. NEW UNIFIED FLOW ── */}
          <Section id="newflow">
            <Card>
              <SectionHeader icon={Zap} num={3} en="New Unified Flow — One Page, No Navigation" te="కొత్త ఫ్లో — ఒకే పేజీలో అన్నీ" />
              <BiText className="mb-4"
                en="The Break Bulk page now handles everything in one place. You never need to leave the page to set up a bundle, switch tabs, or go to Products first."
                te="బ్రేక్ బల్క్ పేజీ ఇప్పుడు ఒకే చోట అన్నీ హ్యాండిల్ చేస్తుంది. బండిల్ సెటప్ చేయడానికి లేదా ప్రొడక్ట్స్ పేజీకి వెళ్ళాల్సిన అవసరం లేదు." />

              <FlowMockup />

              <div className="mt-4 space-y-2">
                {[
                  {
                    icon: '🔍',
                    en: 'Search finds ANY product — not just pre-configured ones. Type the name, PLU code, or scan a barcode.',
                    te: 'శోధన అన్ని ప్రొడక్ట్‌లను కనుగొంటుంది — ముందే కాన్ఫిగర్ చేసినవి మాత్రమే కాదు.',
                  },
                  {
                    icon: '⚡',
                    en: 'Quick Pick panel shows all configured bundles below the search box — one-tap access to common products.',
                    te: 'క్విక్ పిక్ ప్యానెల్ శోధన పెట్టె కింద అన్ని కాన్ఫిగర్ చేసిన బండిళ్ళను చూపిస్తుంది.',
                  },
                  {
                    icon: '🧠',
                    en: 'System auto-detects the bundle state and routes you directly: fixed bundle → fixed form; variable bundle → variable form; no bundle → inline setup wizard.',
                    te: 'సిస్టమ్ స్వయంచాలకంగా బండిల్ స్థితిని గుర్తించి మళ్ళిస్తుంది: స్థిర బండిల్ → స్థిర ఫారం; వేరియబుల్ → వేరియబుల్ ఫారం; బండిల్ లేదు → ఇన్‌లైన్ సెటప్.',
                  },
                  {
                    icon: '🔙',
                    en: 'Breadcrumb bar stays visible at the top — shows the selected product and break type. Click ← New search or ✕ to reset at any point.',
                    te: 'బ్రెడ్‌క్రంబ్ బార్ ఎల్లప్పుడూ పైన కనిపిస్తుంది — ఎంచుకున్న ప్రొడక్ట్ మరియు రకం చూపిస్తుంది.',
                  },
                ].map((item) => (
                  <div key={item.icon} className="flex gap-3 items-start">
                    <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                    <BiText en={item.en} te={item.te} />
                  </div>
                ))}
              </div>

              <InfoBox color="green" className="mt-4"
                en="Old flow required: Products → PLU tab → Set up bundle → Back → Break Bulk. New flow: Break Bulk → Search → Done. Everything is inline."
                te="పాత ఫ్లో: ప్రొడక్ట్స్ → PLU ట్యాబ్ → బండిల్ సెటప్ → వెనక్కి → బ్రేక్ బల్క్. కొత్త ఫ్లో: బ్రేక్ బల్క్ → శోధన → పూర్తి." />
            </Card>
          </Section>

          {/* ── 4. FIXED STEP BY STEP ── */}
          <Section id="fixed">
            <Card>
              <SectionHeader icon={Package} num={4} en="Fixed Break Bulk — Step by Step" te="స్థిర బ్రేక్ బల్క్ — దశలవారీగా" />
              <InfoBox color="amber"
                en="Example: Breaking 2 cartons of Parle-G biscuits. Each carton = 24 packets. Carton cost = ₹120."
                te="ఉదాహరణ: 2 పార్లే-జి కార్టన్లు విభజించడం. ప్రతి కార్టన్ = 24 పొట్లాలు. కార్టన్ కాస్ట్ = ₹120." />
              <div className="mt-4">
                <BiStep step={1} en="Go to Dashboard → Inventory → Break Bulk" te="వెళ్ళండి: డాష్‌బోర్డ్ → ఇన్వెంటరీ → బ్రేక్ బల్క్" />
                <BiStep step={2} en="In the search box, type 'Parle-G' or the carton PLU code" te="శోధన పెట్టెలో 'పార్లే-జి' లేదా కార్టన్ PLU కోడ్ టైప్ చేయండి" />
                <BiStep step={3} en="Select the carton PLU from results. System sees the Fixed bundle and goes straight to the break form." te="ఫలితాల్లో కార్టన్ PLU ఎంచుకోండి. సిస్టమ్ స్థిర బండిల్ చూసి నేరుగా బ్రేక్ ఫారంకు వెళ్తుంది." />
                <BiStep step={4} en="See the conversion summary: Carton ← ×24 → Packet, with current stock levels." te="కన్వర్షన్ సారాంశం చూడండి: కార్టన్ ← ×24 → పొట్లం, ప్రస్తుత స్టాక్ స్థాయిలతో." />
                <BiStep step={5} en="Enter quantity to break: 2  (tap the quick-pick 1, 2, 5, 10 buttons for speed)" te="విభజించాల్సిన పరిమాణం: 2  (వేగం కోసం 1, 2, 5, 10 బటన్లు నొక్కండి)" />
                <BiStep step={6} en="System auto-shows: −2 cartons, +48 packets, cost per packet = ₹120÷24 = ₹5.00" te="సిస్టమ్ స్వయంచాలకంగా చూపిస్తుంది: −2 కార్టన్లు, +48 పొట్లాలు, పొట్లం కాస్ట్ = ₹5.00" />
                <BiStep step={7} en="Optional: enter wastage units (if any packets were damaged) and reason." te="ఐచ్ఛికం: వ్యర్థ యూనిట్లు (ఏదైనా పొట్లాలు దెబ్బతిన్నట్లయితే) మరియు కారణం నమోదు చేయండి." />
                <BiStep step={8} en="Click 'Break X cartons → Y singles' to confirm." te="'బ్రేక్ X కార్టన్లు → Y సింగిల్స్' క్లిక్ చేయండి." />
              </div>
              <ResultBox
                en="Carton stock: −2. Packet stock: +48. Packet PLU cost price updated to ₹5.00 automatically."
                te="కార్టన్ స్టాక్: −2. పొట్లం స్టాక్: +48. పొట్లం PLU కాస్ట్ ధర స్వయంచాలకంగా ₹5.00 కు అప్‌డేట్." />
            </Card>
          </Section>

          {/* ── 5. VARIABLE STEP BY STEP ── */}
          <Section id="variable">
            <Card>
              <SectionHeader icon={Scale} num={5} en="Variable Break Bulk — Step by Step" te="వేరియబుల్ బ్రేక్ బల్క్ — దశలవారీగా" />
              <InfoBox color="amber"
                en="Example: Repacking 1 bag of 10kg rice (cost ₹500) into 6 × 1kg packets and 2 × 2kg packets."
                te="ఉదాహరణ: 10కిలో బియ్యం బస్తా (కాస్ట్ ₹500) నుండి 6 పొట్లాలు 1కిలో మరియు 2 పొట్లాలు 2కిలో." />
              <div className="mt-4">
                <BiStep step={1} color="amber" en="Go to Dashboard → Inventory → Break Bulk" te="వెళ్ళండి: డాష్‌బోర్డ్ → ఇన్వెంటరీ → బ్రేక్ బల్క్" />
                <BiStep step={2} color="amber" en="Search 'Rice 10kg' and select the bulk bag PLU" te="'బియ్యం 10కిలో' శోధించి బల్క్ బస్తా PLU ఎంచుకోండి" />
                <BiStep step={3} color="amber" en="If a Variable bundle is already set up, system goes straight to the repack form." te="వేరియబుల్ బండిల్ ఇప్పటికే సెటప్ అయి ఉంటే, సిస్టమ్ నేరుగా రీప్యాక్ ఫారంకు వెళ్తుంది." />
                <BiStep step={4} color="amber" en="Enter: Units to open = 1, Weight per unit = 10000 g" te="నమోదు చేయండి: తెరవాల్సిన యూనిట్లు = 1, యూనిట్ బరువు = 10000 గ్రా" />
                <BiStep step={5} color="amber" en="System shows total input: 10.00 kg to account for." te="సిస్టమ్ మొత్తం ఇన్‌పుట్ చూపిస్తుంది: లెక్కించాల్సిన 10.00 కిలో." />
                <BiStep step={6} color="amber" en="Output Pack 1: search 'Rice 1kg' → Qty: 6, Weight: 1000 g each" te="అవుట్‌పుట్ పొట్లం 1: 'బియ్యం 1కిలో' శోధించండి → పరిమాణం: 6, బరువు: 1000 గ్రా" />
                <BiStep step={7} color="amber" en="Click '+ Add pack size' → Output Pack 2: 'Rice 2kg' → Qty: 2, Weight: 2000 g" te="'+ పొట్లం సైజు జోడించు' → అవుట్‌పుట్ పొట్లం 2: 'బియ్యం 2కిలో' → పరిమాణం: 2, బరువు: 2000 గ్రా" />
                <BiStep step={8} color="amber" en="Weight balance bar turns green: (6×1000) + (2×2000) = 10000g ✓ — fully balanced." te="బరువు బ్యాలెన్స్ బార్ ఆకుపచ్చగా మారుతుంది: (6×1000) + (2×2000) = 10000గ్రా ✓" />
                <BiStep step={9} color="amber" en="Click 'Commit Repack Session'." te="'కమిట్ రీప్యాక్ సెషన్' క్లిక్ చేయండి." />
              </div>
              <ResultBox
                en="Rice 10kg bag: −1. Rice 1kg: +6 (cost ₹50 each). Rice 2kg: +2 (cost ₹100 each). All calculated automatically."
                te="బియ్యం 10కిలో బస్తా: −1. బియ్యం 1కిలో: +6 (రూ.50). బియ్యం 2కిలో: +2 (రూ.100). స్వయంచాలకంగా లెక్కించబడింది." />

              <BiHeading en="Weight Balance Bar" te="బరువు బ్యాలెన్స్ బార్" />
              <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
                <div className="bg-amber-50 rounded-lg px-2 py-2 border border-amber-200">
                  <p className="text-amber-600 font-medium text-[10px]">Opened</p>
                  <p className="font-bold text-amber-900">10.00 kg</p>
                </div>
                <div className="bg-blue-50 rounded-lg px-2 py-2 border border-blue-200">
                  <p className="text-blue-600 font-medium text-[10px]">Packed</p>
                  <p className="font-bold text-blue-900">10.00 kg</p>
                </div>
                <div className="bg-green-50 rounded-lg px-2 py-2 border border-green-200">
                  <p className="text-green-600 font-medium text-[10px]">✓ Balanced</p>
                  <p className="font-bold text-green-900">0.00 kg</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">If you have unavoidable loss (moisture, handling), enter it in the <strong>Wastage (g)</strong> field so the balance still works out.</p>
              <p className="text-xs text-gray-400 mt-0.5" style={te}>అనివార్య నష్టం ఉంటే (తేమ, నిర్వహణ), వ్యర్థం (గ్రా) ఫీల్డ్‌లో నమోదు చేయండి.</p>
            </Card>
          </Section>

          {/* ── 6. INLINE SETUP ── */}
          <Section id="setup">
            <Card>
              <SectionHeader icon={Settings2} num={6} en="Inline Setup Wizard — First-time Configuration" te="ఇన్‌లైన్ సెటప్ విజార్డ్ — మొదటిసారి కాన్ఫిగరేషన్" />
              <BiText className="mb-3"
                en="If you select a product that has NO bundle configured yet, the system will open a setup wizard right on the same page. No navigation away required."
                te="బండిల్ కాన్ఫిగర్ కాని ప్రొడక్ట్ ఎంచుకుంటే, సిస్టమ్ అదే పేజీలో సెటప్ విజార్డ్ తెరుస్తుంది. ఎక్కడికీ వెళ్ళాల్సిన అవసరం లేదు." />

              <div className="grid md:grid-cols-2 gap-4">
                {/* Fixed setup */}
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                  <div className="font-bold text-sm text-blue-800 mb-2">📦 Setting up Fixed</div>
                  <p className="text-xs text-blue-700 mb-3" style={te}>స్థిర సెటప్</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-blue-900">
                      <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                      <span>Choose <strong>📦 Fixed Carton / Box</strong> type</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-900">
                      <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                      <span>Enter conversion qty — e.g. <strong>24</strong> packets per carton</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-900">
                      <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                      <span>Search and select the <strong>single-unit PLU</strong> (the packet PLU, from any product)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-900">
                      <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
                      <span>Click <strong>Save &amp; Start Breaking →</strong></span>
                    </div>
                  </div>
                  <InfoBox color="blue" className="mt-3"
                    en="Done once per product. Next time you search this product, you'll go straight to the break form."
                    te="ఒక్కసారి మాత్రమే. తర్వాత నేరుగా బ్రేక్ ఫారంకు వెళ్తుంది." />
                </div>

                {/* Variable setup */}
                <div className="border border-amber-200 rounded-xl p-4 bg-amber-50">
                  <div className="font-bold text-sm text-amber-800 mb-2">⚖️ Setting up Variable</div>
                  <p className="text-xs text-amber-700 mb-3" style={te}>వేరియబుల్ సెటప్</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-amber-900">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                      <span>Choose <strong>⚖️ Variable / Weighable</strong> type</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-900">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                      <span>Enter total weight of 1 bulk unit — e.g. <strong>50000 g</strong> for a 50kg bag</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-900">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                      <span>Optionally: set a default pack size and output PLU</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-900">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
                      <span>Click <strong>Save &amp; Start Breaking →</strong></span>
                    </div>
                  </div>
                  <InfoBox color="amber" className="mt-3"
                    en="Output PLU is optional at setup — you can always pick any PLU at repack time."
                    te="అవుట్‌పుట్ PLU ఐచ్ఛికం — రీప్యాక్ సమయంలో ఎప్పుడైనా ఎంచుకోవచ్చు." />
                </div>
              </div>
            </Card>
          </Section>

          {/* ── 7. COST ── */}
          <Section id="cost">
            <Card>
              <SectionHeader icon={Scale} num={7} en="Cost Price Calculation" te="కాస్ట్ ధర లెక్కింపు" />
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-blue-800 uppercase mb-1.5">📦 Fixed Formula</p>
                  <p className="text-xs font-mono font-bold text-blue-900">Unit Cost = Carton Cost ÷ Units per Carton</p>
                  <p className="text-[11px] text-blue-600 mt-1">e.g. ₹120 ÷ 24 = <strong>₹5.00 per packet</strong></p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-amber-800 uppercase mb-1.5">⚖️ Variable Formula</p>
                  <p className="text-xs font-mono font-bold text-amber-900">Packet Cost = Bulk Cost × (Packet g ÷ Total g)</p>
                  <p className="text-[11px] text-amber-600 mt-1">e.g. ₹500 × (1000÷10000) = <strong>₹50.00 per kg</strong></p>
                </div>
              </div>
              <InfoBox color="green"
                en="You never calculate these manually. The system computes and saves cost automatically when you commit a session."
                te="ఇవి మీరు మాన్యువల్‌గా లెక్కించాల్సిన అవసరం లేదు. సెషన్ కమిట్ చేసినప్పుడు సిస్టమ్ స్వయంచాలకంగా లెక్కించి సేవ్ చేస్తుంది." />
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1B4F8A] text-white">
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Bulk Cost</th>
                      <th className="px-3 py-2 text-left">Unit / Size</th>
                      <th className="px-3 py-2 text-left">→ Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Parle-G Carton', '₹120', '24 packets (Fixed)', '₹5.00'],
                      ['Lux Soap Box', '₹180', '6 bars (Fixed)', '₹30.00'],
                      ['Cold Drink Crate', '₹480', '24 bottles (Fixed)', '₹20.00'],
                      ['Rice 10kg bag', '₹500', '1kg packet (Variable)', '₹50.00'],
                      ['Rice 10kg bag', '₹500', '2kg packet (Variable)', '₹100.00'],
                      ['Sugar 25kg bag', '₹1000', '1kg packet (Variable)', '₹40.00'],
                      ['Sugar 25kg bag', '₹1000', '500g packet (Variable)', '₹20.00'],
                      ['Toor Dal 5kg', '₹350', '500g packet (Variable)', '₹35.00'],
                    ].map(([p, c, u, uc], i) => (
                      <tr key={`${p}-${u}`} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-3 py-2 border border-gray-200 text-gray-700">{p}</td>
                        <td className="px-3 py-2 border border-gray-200 text-gray-600">{c}</td>
                        <td className="px-3 py-2 border border-gray-200 text-gray-600">{u}</td>
                        <td className="px-3 py-2 border border-gray-200 font-bold text-green-700">{uc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </Section>

          {/* ── 8. IMPACT ── */}
          <Section id="impact">
            <Card>
              <SectionHeader icon={CheckCircle} num={8} en="Stock & POS Impact" te="స్టాక్ & POS ప్రభావం" />
              <BiText className="mb-3"
                en="When you commit a Break Bulk session, all of these happen instantly — no manual adjustment needed:"
                te="బ్రేక్ బల్క్ సెషన్ కమిట్ చేసినప్పుడు, ఇవన్నీ వెంటనే జరుగుతాయి — మాన్యువల్ అడ్జస్ట్‌మెంట్ అవసరం లేదు:" />
              <ul className="list-none space-y-0 pl-0">
                <BiBullet en="Source (carton/bulk) stock DECREASES by the quantity you opened" te="సోర్స్ (కార్టన్/బల్క్) స్టాక్ మీరు తెరిచిన పరిమాణంతో తగ్గుతుంది" />
                <BiBullet en="Each output PLU stock INCREASES by the quantity repacked" te="ప్రతి అవుట్‌పుట్ PLU స్టాక్ రీప్యాక్ చేసిన పరిమాణంతో పెరుగుతుంది" />
                <BiBullet en="Cost price on every output PLU is recalculated and saved automatically" te="ప్రతి అవుట్‌పుట్ PLU పై కాస్ట్ ధర స్వయంచాలకంగా పునర్లెక్కించబడి సేవ్ అవుతుంది" />
                <BiBullet en="POS terminal sees updated unit stock immediately — no restart needed" te="POS టెర్మినల్ వెంటనే అప్‌డేటెడ్ యూనిట్ స్టాక్ చూస్తుంది — రీస్టార్ట్ అవసరం లేదు" />
                <BiBullet en="Online storefront stock count updates in real time" te="ఆన్‌లైన్ స్టోర్‌ఫ్రంట్ స్టాక్ కౌంట్ తక్షణం అప్‌డేట్ అవుతుంది" />
                <BiBullet en="A history record is created — session number, timestamp, staff name, all lines logged" te="హిస్టరీ రికార్డ్ సృష్టించబడుతుంది — సెషన్ నంబర్, సమయం, సిబ్బంది పేరు, అన్ని లైన్లు లాగ్ చేయబడతాయి" />
              </ul>
            </Card>
          </Section>

          {/* ── 9. HISTORY & REVERSAL ── */}
          <Section id="history">
            <Card>
              <SectionHeader icon={History} num={9} en="History & Session Reversal" te="హిస్టరీ & సెషన్ రివర్సల్" />
              <BiText className="mb-3"
                en="The History tab shows every break bulk and repack session ever done. You can view details and reverse any session if a mistake was made."
                te="హిస్టరీ ట్యాబ్ చేసిన ప్రతి బ్రేక్ బల్క్ మరియు రీప్యాక్ సెషన్ చూపిస్తుంది. తప్పు జరిగితే ఏ సెషన్ అయినా రివర్స్ చేయవచ్చు." />

              <BiHeading en="How to reverse a session" te="సెషన్ ఎలా రివర్స్ చేయాలి" />
              <div className="space-y-2 mb-3">
                <div className="flex gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                  <span className="text-gray-700">Go to Break Bulk → <strong>History tab</strong></span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                  <span className="text-gray-700">Find the session by date, session number, or product name</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                  <span className="text-gray-700">Click <strong>Details</strong> to see all lines, then click <RotateCcw className="w-3 h-3 inline" /> <strong>Reverse</strong></span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">4</span>
                  <span className="text-gray-700">Enter reason (optional) → <strong>Confirm Reverse</strong></span>
                </div>
              </div>
              <InfoBox color="amber"
                en="Reversal immediately restores source stock and deducts output stock. It creates a new reversal session for audit trail."
                te="రివర్సల్ వెంటనే సోర్స్ స్టాక్ పునరుద్ధరిస్తుంది మరియు అవుట్‌పుట్ స్టాక్ తగ్గిస్తుంది. ఆడిట్ ట్రెయిల్ కోసం కొత్త రివర్సల్ సెషన్ సృష్టించబడుతుంది." />
              <InfoBox color="red"
                en="You cannot reverse a session that has already been reversed. If output stock was already sold through POS, reversal will result in negative stock — investigate first."
                te="ఇప్పటికే రివర్స్ చేసిన సెషన్ మళ్ళీ రివర్స్ చేయలేరు. అవుట్‌పుట్ స్టాక్ POS ద్వారా అమ్మబడి ఉంటే, రివర్సల్ నెగటివ్ స్టాక్‌కు దారితీస్తుంది." />
            </Card>
          </Section>

          {/* ── 10. EXAMPLES ── */}
          <Section id="examples">
            <Card>
              <SectionHeader icon={BookOpen} num={10} en="More Examples" te="మరిన్ని ఉదాహరణలు" />
              {[
                {
                  label: 'A: Lux Soap (Fixed)',
                  te: 'లక్స్ సబ్బు (స్థిర)',
                  situation: '3 boxes of Lux soap. Each box = 6 bars. Box cost = ₹180.',
                  sitte: '3 లక్స్ సబ్బు పెట్టెలు. ప్రతి పెట్టె = 6 బార్లు. పెట్టె కాస్ట్ = ₹180.',
                  result: '3 boxes removed. 18 soap bars added. Each bar cost = ₹180 ÷ 6 = ₹30.',
                  reste: '3 పెట్టెలు తొలగించబడ్డాయి. 18 సబ్బు బార్లు జోడించబడ్డాయి. ప్రతి బార్ కాస్ట్ = ₹30.',
                },
                {
                  label: 'B: Shampoo Sachets (Fixed)',
                  te: 'షాంపూ సాచెట్లు (స్థిర)',
                  situation: '2 master boxes. Each box = 48 sachets. Box cost = ₹240.',
                  sitte: '2 మాస్టర్ పెట్టెలు. ప్రతి పెట్టె = 48 సాచెట్లు. కాస్ట్ = ₹240.',
                  result: '2 boxes removed. 96 sachets added. Each sachet cost = ₹240 ÷ 48 = ₹5.',
                  reste: '2 పెట్టెలు తొలగించబడ్డాయి. 96 సాచెట్లు జోడించబడ్డాయి. ప్రతి సాచెట్ కాస్ట్ = ₹5.',
                },
                {
                  label: 'C: Sugar 25kg (Variable)',
                  te: 'చక్కెర 25కిలో (వేరియబుల్)',
                  situation: '1 bag × 25kg sugar, cost ₹1000. Repacking: 20 × 1kg + 5 × 500g. Wastage: 2500g (moisture loss).',
                  sitte: '25కిలో చక్కెర 1 బస్తా, కాస్ట్ ₹1000. రీప్యాక్: 20 పొట్లాలు 1కిలో + 5 పొట్లాలు 500గ్రా. వ్యర్థం: 2500గ్రా.',
                  result: '1kg packet cost = ₹40. 500g packet cost = ₹20. Stock: +20 of 1kg, +5 of 500g.',
                  reste: '1కిలో పొట్లం కాస్ట్ = ₹40. 500గ్రా పొట్లం కాస్ట్ = ₹20. స్టాక్: 1కిలో +20, 500గ్రా +5.',
                },
                {
                  label: 'D: Toor Dal 5kg (Variable, zero wastage)',
                  te: 'తుమ్మ పప్పు 5కిలో (వేరియబుల్, వ్యర్థం సున్నా)',
                  situation: '1 bag × 5kg toor dal, cost ₹350. Repacking: 3 × 1kg + 4 × 500g. Wastage: 0.',
                  sitte: '5కిలో తుమ్మ పప్పు 1 బస్తా, కాస్ట్ ₹350. రీప్యాక్: 3 పొట్లాలు 1కిలో + 4 పొట్లాలు 500గ్రా. వ్యర్థం: 0.',
                  result: '1kg cost = ₹70. 500g cost = ₹35. Stock: +3 of 1kg, +4 of 500g. Balance bar shows ✓ Balanced.',
                  reste: '1కిలో కాస్ట్ = ₹70. 500గ్రా కాస్ట్ = ₹35. బ్యాలెన్స్ బార్ ✓ బ్యాలెన్స్ చూపిస్తుంది.',
                },
              ].map((ex) => (
                <div key={ex.label} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <span className="font-bold text-sm text-[#1B4F8A]">Example {ex.label}</span>
                    <span className="text-xs text-gray-500 ml-2" style={te}>{ex.te}</span>
                  </div>
                  <div className="p-4">
                    <BiText en={`Situation: ${ex.situation}`} te={ex.sitte} className="mb-2" />
                    <ResultBox en={ex.result} te={ex.reste} />
                  </div>
                </div>
              ))}
            </Card>
          </Section>

          {/* ── 11. MISTAKES ── */}
          <Section id="mistakes">
            <Card>
              <SectionHeader icon={AlertTriangle} num={11} en="Common Mistakes to Avoid" te="సాధారణ తప్పులు" />
              {[
                {
                  color: 'amber' as const,
                  title: 'Mistake 1: Wrong quantity entered',
                  te: 'తప్పు 1: తప్పు పరిమాణం నమోదు',
                  en: 'Always verify the quantity in the blue summary box before clicking Commit. If you made a mistake, go to History tab and reverse the session.',
                  teBody: 'కమిట్ చేయడానికి ముందు నీలం సారాంశ పెట్టెలో పరిమాణాన్ని ఎల్లప్పుడూ ధృవీకరించండి. తప్పు జరిగితే హిస్టరీ ట్యాబ్ నుండి రివర్స్ చేయండి.',
                },
                {
                  color: 'red' as const,
                  title: 'Mistake 2: Variable output exceeds input weight',
                  te: 'తప్పు 2: వేరియబుల్ అవుట్‌పుట్ ఇన్‌పుట్ కంటే ఎక్కువ',
                  en: 'The system blocks the commit and shows a red warning. Reduce output quantities or increase the wastage field so the balance works out.',
                  teBody: 'సిస్టమ్ కమిట్‌ను బ్లాక్ చేసి ఎర్రని హెచ్చరిక చూపిస్తుంది. అవుట్‌పుట్ పరిమాణాలు తగ్గించండి లేదా వ్యర్థం పెంచండి.',
                },
                {
                  color: 'amber' as const,
                  title: 'Mistake 3: Using Variable for fixed-count products',
                  te: 'తప్పు 3: స్థిర సంఖ్య ఉత్పత్తులకు వేరియబుల్ ఉపయోగించడం',
                  en: 'For biscuits, soaps, bottles — always choose Fixed type. Variable is only for weighable loose goods like rice, sugar, dal.',
                  teBody: 'బిస్కెట్లు, సబ్బు, బాటిళ్ళకు — ఎల్లప్పుడూ స్థిర రకం ఎంచుకోండి. వేరియబుల్ కేవలం బరువు ఆధారిత వస్తువులకు.',
                },
                {
                  color: 'blue' as const,
                  title: 'Note: You no longer need to go to Products → PLU tab first',
                  te: 'గమనిక: ముందు ప్రొడక్ట్స్ → PLU ట్యాబ్‌కు వెళ్ళాల్సిన అవసరం లేదు',
                  en: 'The new unified page handles everything inline. If a product has no bundle, an inline setup wizard appears. Set it up and break immediately — no page switches.',
                  teBody: 'కొత్త పేజీ అన్నీ ఇన్‌లైన్‌లో హ్యాండిల్ చేస్తుంది. బండిల్ లేని ప్రొడక్ట్ ఉంటే, ఇన్‌లైన్ సెటప్ విజార్డ్ కనిపిస్తుంది. సెటప్ చేసి వెంటనే బ్రేక్ చేయండి.',
                },
              ].map((m) => (
                <InfoBox key={m.title} color={m.color}
                  en={`${m.title}: ${m.en}`}
                  te={`${m.te}: ${m.teBody}`} />
              ))}
            </Card>
          </Section>

          {/* ── 12. FAQ ── */}
          <Section id="faq">
            <Card>
              <SectionHeader icon={HelpCircle} num={12} en="Frequently Asked Questions" te="తరచుగా అడిగే ప్రశ్నలు" />
              <FaqItem
                q="Can I break bulk a product that has no bundle set up yet?"
                qte="బండిల్ సెటప్ కాని ప్రొడక్ట్ బ్రేక్ బల్క్ చేయవచ్చా?"
                a="Yes — the new page shows an inline setup wizard. Enter the type, conversion details, and single PLU, then click Save & Start Breaking. The bundle is saved for future use automatically."
                ate="అవును — కొత్త పేజీ ఇన్‌లైన్ సెటప్ విజార్డ్ చూపిస్తుంది. రకం, కన్వర్షన్ వివరాలు, సింగిల్ PLU నమోదు చేసి 'సేవ్ & స్టార్ట్ బ్రేకింగ్' క్లిక్ చేయండి." />
              <FaqItem
                q="Can I reverse a break bulk session if I made a mistake?"
                qte="తప్పు జరిగితే సెషన్ రివర్స్ చేయవచ్చా?"
                a="Yes. History tab → find the session → click Reverse → confirm. Source stock is restored and output stock is deducted immediately."
                ate="అవును. హిస్టరీ ట్యాబ్ → సెషన్ కనుగొనండి → రివర్స్ క్లిక్ చేయండి → నిర్ధారించండి. సోర్స్ స్టాక్ పునరుద్ధరించబడుతుంది." />
              <FaqItem
                q="Does break bulk affect POS billing immediately?"
                qte="బ్రేక్ బల్క్ POS బిల్లింగ్‌ను వెంటనే ప్రభావితం చేస్తుందా?"
                a="Yes — the moment you commit, unit PLU stock is updated in POS. No refresh or restart needed at the counter."
                ate="అవును — కమిట్ చేసిన క్షణంలోనే POS లో యూనిట్ PLU స్టాక్ అప్‌డేట్ అవుతుంది. కౌంటర్‌లో రీస్టార్ట్ అవసరం లేదు." />
              <FaqItem
                q="What if I get fewer units than expected from a carton?"
                qte="కార్టన్ నుండి ఆశించిన దానికంటే తక్కువ యూనిట్లు వస్తే?"
                a="The Fixed form auto-calculates based on what you enter. Just reduce the output — if you expected 24 but only got 23, the system can handle it. Enter the actual count and note wastage."
                ate="ఫిక్స్డ్ ఫారం మీరు నమోదు చేసినదాన్ని బట్టి స్వయంచాలకంగా లెక్కిస్తుంది. అసలు సంఖ్య నమోదు చేయండి మరియు వ్యర్థం గమనించండి." />
              <FaqItem
                q="Who can perform break bulk?"
                qte="బ్రేక్ బల్క్ ఎవరు చేయవచ్చు?"
                a="Super Admin, Branch Manager, Purchase Checker, and Floor Supervisor roles have access. Cashiers and regular staff do not."
                ate="సూపర్ అడ్మిన్, బ్రాంచ్ మేనేజర్, పర్చేస్ చెకర్, మరియు ఫ్లోర్ సూపర్‌వైజర్ పాత్రలకు యాక్సెస్ ఉంది." />
              <FaqItem
                q="Can I break multiple products in one session?"
                qte="ఒకే సెషన్‌లో బహుళ ఉత్పత్తులు బ్రేక్ చేయవచ్చా?"
                a="Each session handles one source PLU at a time. But you can do multiple sessions back-to-back — after committing, the page resets to the search box ready for the next product."
                ate="ప్రతి సెషన్ ఒక్కో సమయంలో ఒక సోర్స్ PLU హ్యాండిల్ చేస్తుంది. కమిట్ చేసిన తర్వాత పేజీ రీసెట్ అవుతుంది — తదుపరి ప్రొడక్ట్ కోసం వెంటనే సిద్ధంగా ఉంటుంది." />
              <FaqItem
                q="What is the Wastage Report tab?"
                qte="వేస్టేజ్ రిపోర్ట్ ట్యాబ్ అంటే ఏమిటి?"
                a="It summarises all wastage across sessions, grouped by source product. Filter by date range to see wastage trends over any period. Useful for reconciliation with suppliers."
                ate="ఇది సోర్స్ ప్రొడక్ట్ వారీగా అన్ని సెషన్ల వ్యర్థాన్ని సారాంశం చేస్తుంది. తేదీ పరిధి ద్వారా ఫిల్టర్ చేయండి. సప్లయర్లతో రికన్సిలియేషన్‌కు ఉపయోగపడుతుంది." />
            </Card>
          </Section>

          <div className="text-center text-xs text-gray-400 py-5 border-t border-gray-200">
            Srivani Stores ERP · Break Bulk Guide · July 2026
          </div>
        </main>
      </div>
    </div>
  );
}
