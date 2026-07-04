'use client';

import { Package, Layers, Zap, ArrowRight } from 'lucide-react';
import {
  te, BiText, BiHeading, BiBullet, InfoBox,
  Section, Card, SectionHeader, FlowMockup,
} from '../../_shared';

export default function BBOverview() {
  return (
    <>
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
          <ul className="list-none pl-0">
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
                {['1 carton Parle-G = 24 packets','1 box Lux soap = 6 bars','1 box shampoo = 48 sachets','1 crate cold drink = 24 bottles'].map(t => (
                  <div key={t} className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> {t}</div>
                ))}
              </div>
            </div>
            <div className="border-2 border-amber-300 rounded-xl p-3.5 bg-amber-50">
              <div className="text-amber-800 font-bold text-sm mb-0.5">⚖️ TYPE 2: Variable</div>
              <div className="text-amber-600 text-xs mb-2" style={te}>వేరియబుల్ బ్రేక్ బల్క్</div>
              <p className="text-xs text-amber-900 mb-2">You buy by <strong>weight</strong> and repack into different sizes each time — you decide at repack time.</p>
              <div className="text-[11px] text-amber-800 space-y-1">
                {['50kg rice bag → 1kg, 2kg, 5kg packets','25kg sugar bag → 500g, 1kg packets','10kg dal → 250g, 500g, 1kg packets','5kg dry fruits → 100g, 200g packets'].map(t => (
                  <div key={t} className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> {t}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#1B4F8A] text-white">
                  {['Feature','📦 Fixed','⚖️ Variable'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Input unit','No. of cartons/boxes','Weight in grams'],
                  ['Output','Fixed units per carton','Custom packet sizes & qty'],
                  ['Cost formula','Cost ÷ units/carton','Cost × (packet g ÷ total g)'],
                  ['Wastage unit','Pieces','Grams'],
                  ['Setup needed','Yes (done inline, once)','Not required'],
                  ['Typical products','Biscuits, Soap, Bottles','Rice, Sugar, Dal, Spices'],
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

      {/* ── 3. NEW FLOW ── */}
      <Section id="newflow">
        <Card>
          <SectionHeader icon={Zap} num={3} en="New Unified Flow — One Page, No Navigation" te="కొత్త ఫ్లో — ఒకే పేజీలో అన్నీ" />
          <BiText className="mb-4"
            en="The Break Bulk page now handles everything in one place. You never need to leave the page to set up a bundle, switch tabs, or go to Products first."
            te="బ్రేక్ బల్క్ పేజీ ఇప్పుడు ఒకే చోట అన్నీ హ్యాండిల్ చేస్తుంది. బండిల్ సెటప్ చేయడానికి లేదా ప్రొడక్ట్స్ పేజీకి వెళ్ళాల్సిన అవసరం లేదు." />
          <FlowMockup />
          <div className="mt-4 space-y-2">
            {[
              { icon: '🔍', en: 'Search finds ANY product — not just pre-configured ones. Type the name, PLU code, or scan a barcode.', te: 'శోధన అన్ని ప్రొడక్ట్‌లను కనుగొంటుంది — ముందే కాన్ఫిగర్ చేసినవి మాత్రమే కాదు.' },
              { icon: '⚡', en: 'Quick Pick panel shows all configured bundles below the search box — one-tap access to common products.', te: 'క్విక్ పిక్ ప్యానెల్ శోధన పెట్టె కింద అన్ని కాన్ఫిగర్ చేసిన బండిళ్ళను చూపిస్తుంది.' },
              { icon: '🧠', en: 'System auto-detects the bundle state and routes you: fixed bundle → break form; variable → repack form; no bundle → inline setup.', te: 'సిస్టమ్ స్వయంచాలకంగా బండిల్ స్థితిని గుర్తించి మళ్ళిస్తుంది.' },
              { icon: '🔙', en: 'Breadcrumb bar stays visible at the top — shows the selected product and break type. Click ← to reset at any point.', te: 'బ్రెడ్‌క్రంబ్ బార్ ఎల్లప్పుడూ పైన కనిపిస్తుంది — ఎంచుకున్న ప్రొడక్ట్ చూపిస్తుంది.' },
            ].map(item => (
              <div key={item.icon} className="flex gap-3 items-start">
                <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                <BiText en={item.en} te={item.te} />
              </div>
            ))}
          </div>
          <InfoBox color="green" className="mt-4"
            en="Old flow: Products → PLU tab → Set up bundle → Back → Break Bulk. New flow: Break Bulk → Search → Done. Everything is inline."
            te="పాత ఫ్లో: ప్రొడక్ట్స్ → PLU ట్యాబ్ → బండిల్ సెటప్ → వెనక్కి → బ్రేక్ బల్క్. కొత్త ఫ్లో: బ్రేక్ బల్క్ → శోధన → పూర్తి." />
        </Card>
      </Section>
    </>
  );
}
