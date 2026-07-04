'use client';

import { Scale, CheckCircle, History, BookOpen, AlertTriangle, HelpCircle, RotateCcw } from 'lucide-react';
import {
  BiText, BiHeading, BiBullet, InfoBox, ResultBox, FaqItem,
  Section, Card, SectionHeader,
} from '../../_shared';

export default function BBReference() {
  return (
    <>
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
                  {['Product','Bulk Cost','Unit / Size','→ Unit Cost'].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Parle-G Carton','₹120','24 packets (Fixed)','₹5.00'],
                  ['Lux Soap Box','₹180','6 bars (Fixed)','₹30.00'],
                  ['Cold Drink Crate','₹480','24 bottles (Fixed)','₹20.00'],
                  ['Rice 10kg bag','₹500','1kg packet (Variable)','₹50.00'],
                  ['Rice 10kg bag','₹500','2kg packet (Variable)','₹100.00'],
                  ['Sugar 25kg bag','₹1000','500g packet (Variable)','₹20.00'],
                  ['Toor Dal 5kg','₹350','500g packet (Variable)','₹35.00'],
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
          <ul className="list-none pl-0">
            <BiBullet en="Source (carton/bulk) stock DECREASES by the quantity you opened" te="సోర్స్ (కార్టన్/బల్క్) స్టాక్ మీరు తెరిచిన పరిమాణంతో తగ్గుతుంది" />
            <BiBullet en="Each output PLU stock INCREASES by the quantity repacked" te="ప్రతి అవుట్‌పుట్ PLU స్టాక్ రీప్యాక్ చేసిన పరిమాణంతో పెరుగుతుంది" />
            <BiBullet en="Cost price on every output PLU is recalculated and saved automatically" te="ప్రతి అవుట్‌పుట్ PLU పై కాస్ట్ ధర స్వయంచాలకంగా పునర్లెక్కించబడి సేవ్ అవుతుంది" />
            <BiBullet en="POS terminal sees updated unit stock immediately — no restart needed" te="POS టెర్మినల్ వెంటనే అప్‌డేటెడ్ యూనిట్ స్టాక్ చూస్తుంది — రీస్టార్ట్ అవసరం లేదు" />
            <BiBullet en="Online storefront stock count updates in real time" te="ఆన్‌లైన్ స్టోర్‌ఫ్రంట్ స్టాక్ కౌంట్ తక్షణం అప్‌డేట్ అవుతుంది" />
            <BiBullet en="A history record is created — session number, timestamp, staff name, all lines logged" te="హిస్టరీ రికార్డ్ సృష్టించబడుతుంది — సెషన్ నంబర్, సమయం, సిబ్బంది పేరు, అన్ని లైన్లు లాగ్" />
          </ul>
        </Card>
      </Section>

      {/* ── 9. HISTORY ── */}
      <Section id="history">
        <Card>
          <SectionHeader icon={History} num={9} en="History & Session Reversal" te="హిస్టరీ & సెషన్ రివర్సల్" />
          <BiText className="mb-3"
            en="The History tab shows every break bulk and repack session ever done. You can view details and reverse any session if a mistake was made."
            te="హిస్టరీ ట్యాబ్ చేసిన ప్రతి బ్రేక్ బల్క్ మరియు రీప్యాక్ సెషన్ చూపిస్తుంది. తప్పు జరిగితే ఏ సెషన్ అయినా రివర్స్ చేయవచ్చు." />
          <BiHeading en="How to reverse a session" te="సెషన్ ఎలా రివర్స్ చేయాలి" />
          <div className="space-y-2 mb-3">
            {[
              { s: 'Go to Break Bulk → History tab' },
              { s: 'Find the session by date, session number, or product name' },
              { s: 'Click Details to see all lines, then click Reverse' },
              { s: 'Enter reason (optional) → Confirm Reverse' },
            ].map(({ s }, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-gray-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-gray-700">{s}{i === 2 && <RotateCcw className="w-3 h-3 inline mx-1" />}</span>
              </div>
            ))}
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
            { label:'A: Lux Soap (Fixed)', te:'లక్స్ సబ్బు (స్థిర)', situation:'3 boxes of Lux soap. Each box = 6 bars. Box cost = ₹180.', sitte:'3 లక్స్ సబ్బు పెట్టెలు. ప్రతి పెట్టె = 6 బార్లు. పెట్టె కాస్ట్ = ₹180.', result:'3 boxes removed. 18 soap bars added. Each bar cost = ₹180 ÷ 6 = ₹30.', reste:'3 పెట్టెలు తొలగించబడ్డాయి. 18 సబ్బు బార్లు జోడించబడ్డాయి. ప్రతి బార్ కాస్ట్ = ₹30.' },
            { label:'B: Shampoo Sachets (Fixed)', te:'షాంపూ సాచెట్లు (స్థిర)', situation:'2 master boxes. Each box = 48 sachets. Box cost = ₹240.', sitte:'2 మాస్టర్ పెట్టెలు. ప్రతి పెట్టె = 48 సాచెట్లు. కాస్ట్ = ₹240.', result:'2 boxes removed. 96 sachets added. Each sachet cost = ₹240 ÷ 48 = ₹5.', reste:'2 పెట్టెలు తొలగించబడ్డాయి. 96 సాచెట్లు జోడించబడ్డాయి. ప్రతి సాచెట్ కాస్ట్ = ₹5.' },
            { label:'C: Sugar 25kg (Variable)', te:'చక్కెర 25కిలో (వేరియబుల్)', situation:'1 bag × 25kg sugar, cost ₹1000. Repacking: 20 × 1kg + 5 × 500g. Wastage: 2500g (moisture loss).', sitte:'25కిలో చక్కెర 1 బస్తా, కాస్ట్ ₹1000. రీప్యాక్: 20 × 1కిలో + 5 × 500గ్రా.', result:'1kg packet cost = ₹40. 500g packet cost = ₹20. Stock: +20 of 1kg, +5 of 500g.', reste:'1కిలో పొట్లం కాస్ట్ = ₹40. 500గ్రా పొట్లం కాస్ట్ = ₹20.' },
            { label:'D: Toor Dal 5kg (Variable, zero wastage)', te:'తుమ్మ పప్పు 5కిలో', situation:'1 bag × 5kg toor dal, cost ₹350. Repacking: 3 × 1kg + 4 × 500g. Wastage: 0.', sitte:'5కిలో తుమ్మ పప్పు 1 బస్తా, కాస్ట్ ₹350. రీప్యాక్: 3 × 1కిలో + 4 × 500గ్రా.', result:'1kg cost = ₹70. 500g cost = ₹35. Stock: +3 of 1kg, +4 of 500g. Balance bar shows ✓ Balanced.', reste:'1కిలో కాస్ట్ = ₹70. 500గ్రా కాస్ట్ = ₹35. బ్యాలెన్స్ బార్ ✓ చూపిస్తుంది.' },
          ].map(ex => (
            <div key={ex.label} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
                <span className="font-bold text-sm text-[#1B4F8A]">Example {ex.label}</span>
                <span className="text-xs text-gray-500" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>{ex.te}</span>
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
            { color:'amber' as const, title:'Mistake 1: Wrong quantity entered', te:'తప్పు 1: తప్పు పరిమాణం నమోదు', en:'Always verify the quantity in the blue summary box before clicking Commit. If you made a mistake, go to History tab and reverse the session.', teBody:'కమిట్ చేయడానికి ముందు నీలం సారాంశ పెట్టెలో పరిమాణాన్ని ఎల్లప్పుడూ ధృవీకరించండి. తప్పు జరిగితే హిస్టరీ ట్యాబ్ నుండి రివర్స్ చేయండి.' },
            { color:'red' as const, title:'Mistake 2: Variable output exceeds input weight', te:'తప్పు 2: వేరియబుల్ అవుట్‌పుట్ ఇన్‌పుట్ కంటే ఎక్కువ', en:'The system blocks the commit and shows a red warning. Reduce output quantities or increase the wastage field so the balance works out.', teBody:'సిస్టమ్ కమిట్‌ను బ్లాక్ చేసి ఎర్రని హెచ్చరిక చూపిస్తుంది.' },
            { color:'amber' as const, title:'Mistake 3: Using Variable for fixed-count products', te:'తప్పు 3: స్థిర సంఖ్య ఉత్పత్తులకు వేరియబుల్ ఉపయోగించడం', en:'For biscuits, soaps, bottles — always choose Fixed type. Variable is only for weighable loose goods like rice, sugar, dal.', teBody:'బిస్కెట్లు, సబ్బు, బాటిళ్ళకు — ఎల్లప్పుడూ స్థిర రకం ఎంచుకోండి.' },
            { color:'blue' as const, title:'Note: You no longer need to go to Products → PLU tab first', te:'గమనిక: ముందు ప్రొడక్ట్స్ → PLU ట్యాబ్‌కు వెళ్ళాల్సిన అవసరం లేదు', en:'The new unified page handles everything inline. If a product has no bundle, an inline setup wizard appears — set up and break immediately.', teBody:'కొత్త పేజీ అన్నీ ఇన్‌లైన్‌లో హ్యాండిల్ చేస్తుంది.' },
          ].map(m => (
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
          <FaqItem q="Can I break bulk a product that has no bundle set up yet?" qte="బండిల్ సెటప్ కాని ప్రొడక్ట్ బ్రేక్ బల్క్ చేయవచ్చా?" a="Yes — the new page shows an inline setup wizard. Enter the type, conversion details, and single PLU, then click Save & Start Breaking." ate="అవును — కొత్త పేజీ ఇన్‌లైన్ సెటప్ విజార్డ్ చూపిస్తుంది. రకం, కన్వర్షన్ వివరాలు, సింగిల్ PLU నమోదు చేసి 'సేవ్ & స్టార్ట్ బ్రేకింగ్' క్లిక్ చేయండి." />
          <FaqItem q="Can I reverse a break bulk session if I made a mistake?" qte="తప్పు జరిగితే సెషన్ రివర్స్ చేయవచ్చా?" a="Yes. History tab → find the session → click Reverse → confirm. Source stock is restored and output stock is deducted immediately." ate="అవును. హిస్టరీ ట్యాబ్ → సెషన్ కనుగొనండి → రివర్స్ క్లిక్ చేయండి → నిర్ధారించండి. సోర్స్ స్టాక్ పునరుద్ధరించబడుతుంది." />
          <FaqItem q="Does break bulk affect POS billing immediately?" qte="బ్రేక్ బల్క్ POS బిల్లింగ్‌ను వెంటనే ప్రభావితం చేస్తుందా?" a="Yes — the moment you commit, unit PLU stock is updated in POS. No refresh or restart needed at the counter." ate="అవును — కమిట్ చేసిన క్షణంలోనే POS లో యూనిట్ PLU స్టాక్ అప్‌డేట్ అవుతుంది. కౌంటర్‌లో రీస్టార్ట్ అవసరం లేదు." />
          <FaqItem q="What if I get fewer units than expected from a carton?" qte="కార్టన్ నుండి ఆశించిన దానికంటే తక్కువ యూనిట్లు వస్తే?" a="The Fixed form lets you enter any quantity. Just enter the actual count you got and note the wastage — the system handles the rest." ate="ఫిక్స్డ్ ఫారం మీరు అసలు సంఖ్య నమోదు చేసేందుకు అనుమతిస్తుంది. వ్యర్థం ఫీల్డ్‌లో వ్యత్యాసం నమోదు చేయండి." />
          <FaqItem q="Who can perform break bulk?" qte="బ్రేక్ బల్క్ ఎవరు చేయవచ్చు?" a="Super Admin, Branch Manager, Purchase Checker, and Floor Supervisor roles have access. Cashiers and regular staff do not." ate="సూపర్ అడ్మిన్, బ్రాంచ్ మేనేజర్, పర్చేస్ చెకర్, మరియు ఫ్లోర్ సూపర్‌వైజర్ పాత్రలకు యాక్సెస్ ఉంది." />
          <FaqItem q="What is the Wastage Report tab?" qte="వేస్టేజ్ రిపోర్ట్ ట్యాబ్ అంటే ఏమిటి?" a="It summarises all wastage across sessions grouped by source product. Filter by date range to see wastage trends. Useful for reconciliation with suppliers." ate="ఇది సోర్స్ ప్రొడక్ట్ వారీగా అన్ని సెషన్ల వ్యర్థాన్ని సారాంశం చేస్తుంది. సప్లయర్లతో రికన్సిలియేషన్‌కు ఉపయోగపడుతుంది." />
        </Card>
      </Section>

      <div className="text-center text-xs text-gray-400 py-5 border-t border-gray-200">
        Srivani Stores ERP · Break Bulk Guide · July 2026
      </div>
    </>
  );
}
