'use client';

import { Package, Scale, Settings2 } from 'lucide-react';
import {
  te, BiText, BiHeading, BiStep, InfoBox, ResultBox,
  Section, Card, SectionHeader,
} from '../../_shared';

export default function BBSteps() {
  return (
    <>
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
            <BiStep step={8} color="amber" en="Weight balance bar turns green: (6×1000) + (2×2000) = 10000 g ✓ — fully balanced." te="బరువు బ్యాలెన్స్ బార్ ఆకుపచ్చగా మారుతుంది: (6×1000) + (2×2000) = 10000గ్రా ✓" />
            <BiStep step={9} color="amber" en="Click 'Commit Repack Session'." te="'కమిట్ రీప్యాక్ సెషన్' క్లిక్ చేయండి." />
          </div>
          <ResultBox
            en="Rice 10kg bag: −1. Rice 1kg: +6 (cost ₹50 each). Rice 2kg: +2 (cost ₹100 each). All calculated automatically."
            te="బియ్యం 10కిలో బస్తా: −1. బియ్యం 1కిలో: +6 (రూ.50). బియ్యం 2కిలో: +2 (రూ.100). స్వయంచాలకంగా లెక్కించబడింది." />
          <BiHeading en="Weight Balance Bar" te="బరువు బ్యాలెన్స్ బార్" />
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
            {[
              { label: 'Opened', val: '10.00 kg', bg: 'bg-amber-50 border-amber-200 text-amber-900' },
              { label: 'Packed', val: '10.00 kg', bg: 'bg-blue-50 border-blue-200 text-blue-900' },
              { label: '✓ Balanced', val: '0.00 kg', bg: 'bg-green-50 border-green-200 text-green-900' },
            ].map(({ label, val, bg }) => (
              <div key={label} className={`rounded-lg px-2 py-2 border ${bg}`}>
                <p className="font-medium text-[10px] opacity-70">{label}</p>
                <p className="font-bold">{val}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">If you have unavoidable loss (moisture, handling), enter it in the <strong>Wastage (g)</strong> field so the balance still works out.</p>
          <p className="text-xs text-gray-400 mt-0.5" style={te}>అనివార్య నష్టం ఉంటే (తేమ, నిర్వహణ), వ్యర్థం (గ్రా) ఫీల్డ్‌లో నమోదు చేయండి.</p>
        </Card>
      </Section>

      {/* ── 6. INLINE SETUP ── */}
      <Section id="setup">
        <Card>
          <SectionHeader icon={Settings2} num={6} en="Inline Setup Wizard — First-time Configuration" te="ఇన్‌లైన్ సెటప్ విజార్డ్ — మొదటిసారి కాన్ఫిగరేషన్" />
          <BiText className="mb-4"
            en="If you select a product that has NO bundle configured yet, the system will open a setup wizard right on the same page. No navigation away required."
            te="బండిల్ కాన్ఫిగర్ కాని ప్రొడక్ట్ ఎంచుకుంటే, సిస్టమ్ అదే పేజీలో సెటప్ విజార్డ్ తెరుస్తుంది. ఎక్కడికీ వెళ్ళాల్సిన అవసరం లేదు." />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
              <div className="font-bold text-sm text-blue-800 mb-1">📦 Setting up Fixed</div>
              <p className="text-xs text-blue-700 mb-3" style={te}>స్థిర సెటప్</p>
              <div className="space-y-2">
                {[
                  'Choose 📦 Fixed Carton / Box type',
                  'Enter conversion qty — e.g. 24 packets per carton',
                  'Search and select the single-unit PLU (the packet PLU)',
                  'Click Save & Start Breaking →',
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-blue-900">
                    <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <InfoBox color="blue" className="mt-3"
                en="Done once per product. Next time you search this product, you'll go straight to the break form."
                te="ఒక్కసారి మాత్రమే. తర్వాత నేరుగా బ్రేక్ ఫారంకు వెళ్తుంది." />
            </div>
            <div className="border border-amber-200 rounded-xl p-4 bg-amber-50">
              <div className="font-bold text-sm text-amber-800 mb-1">⚖️ Setting up Variable</div>
              <p className="text-xs text-amber-700 mb-3" style={te}>వేరియబుల్ సెటప్</p>
              <div className="space-y-2">
                {[
                  'Choose ⚖️ Variable / Weighable type',
                  'Enter total weight of 1 bulk unit — e.g. 50000 g for a 50kg bag',
                  'Optionally: set a default pack size and output PLU',
                  'Click Save & Start Breaking →',
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-900">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <InfoBox color="amber" className="mt-3"
                en="Output PLU is optional at setup — you can always pick any PLU at repack time."
                te="అవుట్‌పుట్ PLU ఐచ్ఛికం — రీప్యాక్ సమయంలో ఎప్పుడైనా ఎంచుకోవచ్చు." />
            </div>
          </div>
        </Card>
      </Section>
    </>
  );
}
