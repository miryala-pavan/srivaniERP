'use client';

import { BookOpen, Layers } from 'lucide-react';
import { BiText, BiBullet, InfoBox, Section, Card, SectionHeader } from '../../_shared';

export default function GSTOverview() {
  return (
    <>
      {/* ── 1. WHAT ARE GST REPORTS ── */}
      <Section id="gst-overview">
        <Card>
          <SectionHeader icon={BookOpen} num={1} en="What are GST Reports?" te="GST రిపోర్ట్‌లు అంటే ఏమిటి?" />
          <BiText className="mb-3"
            en="GST (Goods and Services Tax) is India's unified indirect tax that replaced multiple state and central taxes from July 2017. Every sale and purchase your store makes has a GST component that must be reported to the government monthly."
            te="GST (వస్తువులు మరియు సేవల పన్ను) జూలై 2017 నుండి అనేక రాష్ట్ర మరియు కేంద్ర పన్నులను భర్తీ చేసిన భారతదేశం యొక్క ఏకీకృత పరోక్ష పన్ను. మీ స్టోర్ చేసే ప్రతి అమ్మకం మరియు కొనుగోలులో GST భాగం ఉంటుంది." />
          <InfoBox color="green"
            en="Srivani ERP auto-generates all GST data from POS sales and GRN purchases. No manual data entry — every bill and GRN creates the GST record automatically."
            te="Srivani ERP POS సేల్స్ మరియు GRN కొనుగోళ్ళ నుండి అన్ని GST డేటాను స్వయంచాలకంగా రూపొందిస్తుంది. మాన్యువల్ నమోదు అవసరం లేదు." />
          <BiText className="mb-3 mt-3"
            en="These reports are used to: (1) file monthly returns on the GST portal, (2) share data with your CA for review, (3) reconcile purchases with GSTR-2B, and (4) track tax liability throughout the year."
            te="ఈ రిపోర్ట్‌లు: (1) GST పోర్టల్‌లో నెలవారీ రిటర్న్‌లు దాఖలు చేయడానికి, (2) CA తో డేటా షేర్ చేయడానికి, (3) GSTR-2B తో కొనుగోళ్ళను రికన్సైల్ చేయడానికి ఉపయోగపడతాయి." />
          <BiText className="mb-1"
            en="Monthly filing cycle: GSTR-1 (sales detail) by the 11th → GSTR-3B (tax summary) by the 20th of the following month."
            te="నెలవారీ ఫైలింగ్ చక్రం: GSTR-1 (సేల్స్ వివరాలు) 11వ తేదీలోపు → GSTR-3B (పన్ను సారాంశం) తదుపరి నెల 20వ తేదీలోపు." />
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Key GST concepts for grocery retail</p>
            <ul className="list-none pl-0">
              <BiBullet en="CGST + SGST: Intra-state sales tax split equally between Centre and State (e.g. 18% GST = 9% CGST + 9% SGST)" te="CGST + SGST: రాష్ట్రంలోని అమ్మకాలపై పన్ను కేంద్రం మరియు రాష్ట్రం మధ్య సమానంగా విభజించబడుతుంది" />
              <BiBullet en="IGST: Inter-state sales tax goes entirely to Centre (e.g. 18% GST = 18% IGST)" te="IGST: వేరే రాష్ట్రాలకు అమ్మకాలపై పన్ను మొత్తం కేంద్రానికి వెళ్తుంది" />
              <BiBullet en="ITC (Input Tax Credit): GST paid on purchases can offset GST collected on sales — you pay only the difference" te="ITC (ఇన్‌పుట్ ట్యాక్స్ క్రెడిట్): కొనుగోళ్ళపై చెల్లించిన GST అమ్మకాలపై వసూలు చేసిన GST ని తగ్గిస్తుంది" />
              <BiBullet en="GSTR-2B: Auto-populated ITC statement from suppliers' filed returns — download from GST portal monthly" te="GSTR-2B: సప్లయర్ల దాఖలైన రిటర్న్‌ల నుండి స్వయంచాలకంగా పాపులేట్ అయిన ITC స్టేట్‌మెంట్" />
            </ul>
          </div>
        </Card>
      </Section>

      {/* ── 2. 6 TABS AT A GLANCE ── */}
      <Section id="gst-tabs">
        <Card>
          <SectionHeader icon={Layers} num={2} en="6 Tabs at a Glance" te="6 ట్యాబ్‌ల సారాంశం" />
          <BiText className="mb-4"
            en="The GST Reports page has 6 tabs. Each tab shows a different view of your GST data. Here's what each one is for:"
            te="GST రిపోర్ట్‌ల పేజీలో 6 ట్యాబ్‌లు ఉన్నాయి. ప్రతి ట్యాబ్ మీ GST డేటా యొక్క వేర్వేరు వీక్షణను చూపిస్తుంది." />
          <div className="space-y-2">
            {[
              { tab: 'GSTR-3B Summary', color: 'bg-blue-600', en: 'Monthly tax summary — total output tax collected, ITC available, and net tax payable. This is what you file on the GST portal by the 20th.', te: 'నెలవారీ పన్ను సారాంశం — మొత్తం అవుట్‌పుట్ పన్ను వసూలు, ITC అందుబాటు, మరియు చెల్లించాల్సిన నికర పన్ను.' },
              { tab: 'Sales Register', color: 'bg-emerald-600', en: 'All sales bills split by type (B2B / B2CL / B2CS) with GSTIN, taxable value, CGST, SGST, IGST. Used to prepare GSTR-1 annexures.', te: 'అన్ని సేల్స్ బిల్లులు రకం వారీగా విభజించబడ్డాయి — GSTIN, పన్ను విలువ, CGST, SGST, IGST తో.' },
              { tab: 'Purchase Register', color: 'bg-violet-600', en: 'All approved GRNs with supplier GSTIN, invoice details, and ITC eligibility (ELIGIBLE / EXEMPT / NOT_ELIGIBLE). Reconcile with GSTR-2B here.', te: 'సప్లయర్ GSTIN, ఇన్వాయిస్ వివరాలు మరియు ITC అర్హత (ELIGIBLE / EXEMPT / NOT_ELIGIBLE) తో అన్ని GRNలు.' },
              { tab: 'HSN + GSTR-1', color: 'bg-orange-600', en: 'HSN-wise summary of outward supplies — HSN code, UQC, quantity, taxable value, and tax. Required for GSTR-1 filing (HSN summary section).', te: 'HSN కోడ్, UQC, పరిమాణం, పన్ను విలువ మరియు పన్నుతో అవుట్‌వార్డ్ సప్లైస్ యొక్క HSN వారీ సారాంశం.' },
              { tab: 'Inward Supplies (GSTR-2)', color: 'bg-cyan-600', en: 'Rate-wise purchase summary in GSTR-2 format — total taxable value and tax for each GST rate slab (5%, 12%, 18%, 28%). Share with CA using the download or share link.', te: 'GSTR-2 ఫార్మాట్‌లో రేటు వారీ కొనుగోలు సారాంశం — ప్రతి GST రేటు స్లాబ్ కోసం మొత్తం పన్ను విలువ మరియు పన్ను.' },
              { tab: 'FY Trend Dashboard', color: 'bg-rose-600', en: 'Full April–March financial year view — monthly bar charts for sales, tax collected, ITC claimed, and net tax paid. Useful for CA review and year-end planning.', te: 'పూర్తి ఏప్రిల్–మార్చి ఆర్థిక సంవత్సరం వీక్షణ — సేల్స్, పన్ను వసూలు, ITC క్లెయిమ్ మరియు నికర పన్ను చెల్లించిన మాసవారీ చార్ట్‌లు.' },
            ].map(({ tab, color, en, te }) => (
              <div key={tab} className="flex gap-3 items-start border border-gray-100 rounded-xl p-3 hover:bg-gray-50 transition-colors">
                <span className={`${color} text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0 mt-0.5 whitespace-nowrap`}>{tab}</span>
                <div>
                  <p className="text-xs text-gray-800 leading-relaxed">{en}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>{te}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>
    </>
  );
}
