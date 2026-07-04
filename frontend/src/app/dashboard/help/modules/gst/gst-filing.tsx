'use client';

import { FileText, BarChart3, TrendingUp } from 'lucide-react';
import { BiText, BiHeading, BiBullet, InfoBox, Section, Card, SectionHeader } from '../../_shared';

export default function GSTFiling() {
  return (
    <>
      {/* ── 7. HSN + GSTR-1 ── */}
      <Section id="gst-hsn">
        <Card>
          <SectionHeader icon={FileText} num={7} en="HSN + GSTR-1 Filing" te="HSN + GSTR-1 ఫైలింగ్" />
          <BiText className="mb-3"
            en="HSN (Harmonized System of Nomenclature) is the product classification code assigned by the government. Every product you sell must have an HSN code — the ERP pulls it from the product master."
            te="HSN (హార్మోనైజ్డ్ సిస్టమ్ ఆఫ్ నామెన్‌క్లేచర్) ప్రభుత్వం నిర్ణయించిన ఉత్పత్తి వర్గీకరణ కోడ్. మీరు విక్రయించే ప్రతి ఉత్పత్తికి HSN కోడ్ ఉండాలి — ERP దాన్ని ప్రొడక్ట్ మాస్టర్ నుండి తీసుకుంటుంది." />

          <BiHeading en="HSN Code Requirements (3 tiers)" te="HSN కోడ్ అవసరాలు (3 స్థాయిలు)" />
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-700 mb-1">Turnover ≤ ₹1.5 crore / year</p>
              <p className="text-xs text-gray-600">HSN code is optional on invoices. But recommended — set it in the product master for future-proofing.</p>
              <p className="text-[11px] text-gray-500 mt-1" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>HSN ఐచ్ఛికం, కానీ ఇప్పుడే సెట్ చేయడం సూచించబడుతుంది.</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-800 mb-1">Turnover ₹1.5 – ₹5 crore / year</p>
              <p className="text-xs text-blue-700">4-digit HSN code required on invoices and GSTR-1. Minimum mandatory.</p>
              <p className="text-[11px] text-blue-500 mt-1">Example: 1901 (biscuits), 2501 (salt), 1006 (rice)</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-bold text-orange-800 mb-1">Turnover &gt; ₹5 crore / year</p>
              <p className="text-xs text-orange-700">6-digit HSN code mandatory on invoices and GSTR-1. Stricter requirement.</p>
              <p className="text-[11px] text-orange-500 mt-1">Example: 190190 (other food preparations), 100610 (rice in husk)</p>
            </div>
          </div>

          <BiHeading en="What the HSN Tab Shows" te="HSN ట్యాబ్ ఏమి చూపిస్తుంది" />
          <ul className="list-none pl-0">
            <BiBullet en="HSN Code: The product's classification code — set in Product → PLU details" te="HSN కోడ్: ప్రొడక్ట్ యొక్క వర్గీకరణ కోడ్ — ప్రొడక్ట్ → PLU వివరాల్లో సెట్ చేయబడింది" />
            <BiBullet en="Description: Product name / category description" te="వివరణ: ఉత్పత్తి పేరు / వర్గం వివరణ" />
            <BiBullet en="UQC (Unit Quantity Code): Government-standard unit — KGS (kilograms), NOS (numbers), PCS (pieces), LTR (litres), etc." te="UQC (యూనిట్ క్వాంటిటీ కోడ్): ప్రభుత్వ-ప్రమాణ యూనిట్ — KGS, NOS, PCS, LTR మొదలైనవి." />
            <BiBullet en="Total Quantity: Units sold in the selected period for that HSN code" te="మొత్తం పరిమాణం: ఎంచుకున్న కాలానికి ఆ HSN కోడ్ కోసం విక్రయించబడిన యూనిట్లు" />
            <BiBullet en="Taxable Value: Total sales value (before GST) for that HSN code" te="పన్ను విలువ: ఆ HSN కోడ్ కోసం మొత్తం అమ్మకాల విలువ (GST కి ముందు)" />
            <BiBullet en="Tax: Integrated / Central / State tax collected on that HSN code" te="పన్ను: ఆ HSN కోడ్ పై వసూలు చేసిన ఇంటిగ్రేటెడ్ / కేంద్ర / రాష్ట్ర పన్ను" />
          </ul>
          <InfoBox color="amber"
            en="If a product has no HSN code set, it will appear under 'Unknown HSN' in this tab. Go to Products → edit the PLU → set the HSN code before filing GSTR-1."
            te="ఒక ప్రొడక్ట్‌కు HSN కోడ్ సెట్ లేకపోతే, ఇది ఈ ట్యాబ్‌లో 'Unknown HSN' కింద కనిపిస్తుంది. GSTR-1 దాఖలు చేయడానికి ముందు Products → PLU సవరించు → HSN కోడ్ సెట్ చేయండి." />

          <BiHeading en="GSTR-1 Filing Steps" te="GSTR-1 ఫైలింగ్ దశలు" />
          <div className="space-y-2 mb-2">
            {[
              { s:'1', en:'Set the month in GST Reports. Verify Sales Register — all bills must be entered.', te:'GST రిపోర్ట్‌లలో నెల సెట్ చేయండి. సేల్స్ రిజిస్టర్ ధృవీకరించండి — అన్ని బిల్లులు నమోదు చేయాలి.' },
              { s:'2', en:'Check HSN tab — all products should have valid HSN codes. Fix any "Unknown HSN" entries in Products.', te:'HSN ట్యాబ్ చెక్ చేయండి — అన్ని ప్రొడక్ట్‌లకు చెల్లుబాటు అయ్యే HSN కోడ్‌లు ఉండాలి.' },
              { s:'3', en:'Note the B2B invoice list (with GSTIN), B2CL invoices (>₹2.5L), and HSN summary totals.', te:'B2B ఇన్వాయిస్ జాబితా (GSTIN తో), B2CL ఇన్వాయిస్‌లు (>₹2.5లక్ష), మరియు HSN సారాంశం మొత్తాలు నమోదు చేయండి.' },
              { s:'4', en:'Log in to GST portal (gstin.gov.in) → Returns → GSTR-1 → Enter data or upload JSON (JSON export coming soon in ERP).', te:'GST పోర్టల్‌లో లాగిన్ అవ్వండి → రిటర్న్‌లు → GSTR-1 → డేటా నమోదు చేయండి లేదా JSON అప్‌లోడ్ చేయండి.' },
              { s:'5', en:'File GSTR-1 by the 11th of the following month (or 13th for QRMP quarterly filers).', te:'తదుపరి నెల 11వ తేదీలోపు GSTR-1 దాఖలు చేయండి (QRMP త్రైమాసిక ఫైలర్లకు 13వ తేదీ).' },
              { s:'5A', en:'Error found after GSTR-1 is filed? Use GSTR-1A on the GST portal to amend mistakes — only one GSTR-1A per period allowed, and only before you file GSTR-3B for the same period.', te:'GSTR-1 దాఖలు చేసిన తర్వాత తప్పు కనుగొన్నారా? సవరణకు GSTR-1A ఉపయోగించండి — ఒక కాలానికి ఒక GSTR-1A మాత్రమే అనుమతి, GSTR-3B దాఖలు చేయడానికి ముందు మాత్రమే.' },
            ].map(({ s, en, te }) => (
              <div key={s} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-full bg-[#1B4F8A] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{s}</span>
                <div>
                  <p className="text-xs text-gray-800 leading-relaxed">{en}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>{te}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ── 8. INWARD SUPPLIES ── */}
      <Section id="gst-inward">
        <Card>
          <SectionHeader icon={BarChart3} num={8} en="Inward Supplies (GSTR-2 Format)" te="ఇన్వార్డ్ సప్లైస్ (GSTR-2 ఫార్మాట్)" />
          <BiText className="mb-3"
            en="This tab shows all your purchases in the government's GSTR-2 format — grouped by GST rate slab. It's the fastest way to share purchase data with your CA or accountant."
            te="ఈ ట్యాబ్ మీ అన్ని కొనుగోళ్ళను ప్రభుత్వం యొక్క GSTR-2 ఫార్మాట్‌లో చూపిస్తుంది — GST రేటు స్లాబ్ వారీగా సమూహపరచబడింది. మీ CA లేదా అకౌంటెంట్‌తో కొనుగోలు డేటా షేర్ చేయడానికి ఇది వేగవంతమైన మార్గం." />

          <BiHeading en="Rate-wise Summary" te="రేటు వారీ సారాంశం" />
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#1B4F8A] text-white">
                  {['GST Rate','Taxable Value','CGST','SGST','IGST','ITC Available'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['0%', 'Nil-rated/exempt purchases', '₹0', '₹0', '₹0', 'Nil'],
                  ['5%', 'e.g. Edible oils, packaged food', 'CGST 2.5%', 'SGST 2.5%', 'IGST 5%', 'Eligible if not Sec 17(5)'],
                  ['12%', 'e.g. Some processed food, ghee', 'CGST 6%', 'SGST 6%', 'IGST 12%', 'Eligible if not Sec 17(5)'],
                  ['18%', 'e.g. Soap, shampoo, beverages', 'CGST 9%', 'SGST 9%', 'IGST 18%', 'Eligible if not Sec 17(5)'],
                  ['28%', 'e.g. Aerated drinks, tobacco', 'CGST 14%', 'SGST 14%', 'IGST 28%', 'Eligible if not Sec 17(5)'],
                ].map(([rate, ex, cgst, sgst, igst, itc], i) => (
                  <tr key={rate} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 border border-gray-200 font-bold text-gray-700">{rate}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-500 italic text-[11px]">{ex}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">{cgst}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">{sgst}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">{igst}</td>
                    <td className="px-3 py-2 border border-gray-200 text-green-700 font-medium">{itc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <BiText
            en="Each rate row expands to show individual supplier invoices — GSTIN, invoice no., date, taxable value, and ITC category. Your CA uses this to verify ITC claims and cross-check with GSTR-2B."
            te="ప్రతి రేటు వరుస విస్తరించి వ్యక్తిగత సప్లయర్ ఇన్వాయిస్‌లు చూపిస్తుంది — GSTIN, ఇన్వాయిస్ నం., తేదీ, పన్ను విలువ మరియు ITC వర్గం." />
          <InfoBox color="blue"
            en="Use the 'Download Excel' button in this tab to export inward supplies for your CA. The Excel contains all columns the CA needs for GST audit and GSTR-2B matching."
            te="CA కోసం ఇన్వార్డ్ సప్లైస్ ఎగుమతి చేయడానికి ఈ ట్యాబ్‌లో 'ఎక్సెల్ డౌన్‌లోడ్' బటన్ ఉపయోగించండి." />
        </Card>
      </Section>

      {/* ── 9. FY TREND ── */}
      <Section id="gst-trend">
        <Card>
          <SectionHeader icon={TrendingUp} num={9} en="FY Trend Dashboard" te="FY ట్రెండ్ డాష్‌బోర్డ్" />
          <BiText className="mb-3"
            en="The FY Trend tab shows the entire financial year (April to March) in one view — monthly bar charts for sales, tax collected, ITC claimed, and net tax paid in cash."
            te="FY ట్రెండ్ ట్యాబ్ మొత్తం ఆర్థిక సంవత్సరం (ఏప్రిల్ నుండి మార్చి) ఒకే వీక్షణలో చూపిస్తుంది — అమ్మకాలు, పన్ను వసూలు, ITC క్లెయిమ్ మరియు నికర పన్ను చెల్లించిన మాసవారీ చార్ట్‌లు." />

          <BiHeading en="Important: Indian Financial Year" te="ముఖ్యమైన: భారతీయ ఆర్థిక సంవత్సరం" />
          <InfoBox color="amber"
            en="Financial Year in India = April 1 to March 31 (NOT January–December). FY 2025-26 means April 2025 to March 2026. Always select the correct FY in the dropdown."
            te="భారతదేశంలో ఆర్థిక సంవత్సరం = ఏప్రిల్ 1 నుండి మార్చి 31 (జనవరి–డిసెంబర్ కాదు). FY 2025-26 అంటే ఏప్రిల్ 2025 నుండి మార్చి 2026." />

          <BiHeading en="What the 4 charts show" te="4 చార్ట్‌లు ఏమి చూపిస్తాయి" />
          <div className="space-y-2 mb-3">
            {[
              { color: 'bg-blue-100 border-blue-300', label: 'Taxable Sales (₹)', desc: 'Total revenue from GST-taxable sales each month. Use this to identify peak months and plan stock accordingly.', te: 'ప్రతి నెలా GST పన్ను అమ్మకాల నుండి మొత్తం రాబడి. అత్యధిక నెలలు గుర్తించి స్టాక్ ప్లాన్ చేయండి.' },
              { color: 'bg-orange-100 border-orange-300', label: 'Tax Collected (₹)', desc: 'Output CGST+SGST+IGST collected each month. Compare with Cash to Pay to see how much ITC reduced your liability.', te: 'ప్రతి నెలా వసూలు చేసిన అవుట్‌పుట్ పన్ను. Cash to Pay తో పోల్చి ITC మీ బాధ్యతను ఎంత తగ్గించిందో చూడండి.' },
              { color: 'bg-green-100 border-green-300', label: 'ITC Claimed (₹)', desc: 'Input tax credit utilised each month from eligible purchases. Higher ITC months usually mean more stock procurement.', te: 'అర్హమైన కొనుగోళ్ళ నుండి ప్రతి నెలా ఉపయోగించిన ITC. అధిక ITC నెలలు సాధారణంగా అధిక స్టాక్ కొనుగోళ్ళను సూచిస్తాయి.' },
              { color: 'bg-red-100 border-red-300', label: 'Cash to Pay (₹)', desc: 'Net tax paid in cash after offsetting ITC — the actual government payment each month. Useful for cash flow planning.', te: 'ITC సెట్ ఆఫ్ చేసిన తర్వాత నగదులో చెల్లించిన నికర పన్ను — ప్రతి నెలా వాస్తవ ప్రభుత్వ చెల్లింపు.' },
            ].map(({ color, label, desc, te }) => (
              <div key={label} className={`border rounded-lg p-3 ${color}`}>
                <p className="text-xs font-bold text-gray-800">{label}</p>
                <p className="text-xs text-gray-700 mt-1 leading-relaxed">{desc}</p>
                <p className="text-[11px] text-gray-500 mt-0.5" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>{te}</p>
              </div>
            ))}
          </div>

          <BiHeading en="Common Use Cases" te="సాధారణ వినియోగ సందర్భాలు" />
          <ul className="list-none pl-0">
            <BiBullet en="Show to bank for loan application — monthly turnover and tax compliance history visible at a glance" te="రుణ దరఖాస్తు కోసం బ్యాంక్‌కు చూపించండి — మాసవారీ టర్నోవర్ మరియు పన్ను సమ్మతి చరిత్ర ఒకేసారి కనిపిస్తుంది" />
            <BiBullet en="Year-end CA review — export or share via link; CA can verify tax paid matches GSTR-3B filings" te="సంవత్సరాంత CA సమీక్ష — ఎగుమతి చేయండి లేదా లింక్ ద్వారా షేర్ చేయండి; CA చెల్లించిన పన్ను GSTR-3B దాఖళ్ళతో సరిపోతుందో ధృవీకరించవచ్చు" />
            <BiBullet en="Year-over-year comparison — switch FY dropdown to compare growth between FY 2024-25 and FY 2025-26" te="సంవత్సరానికి సంవత్సరం పోలిక — FY డ్రాప్‌డౌన్ మార్చి FY 2024-25 మరియు FY 2025-26 మధ్య వృద్ధిని పోల్చండి" />
            <BiBullet en="Cash flow planning — if Cash to Pay spikes in a month, plan vendor payments to ensure liquidity" te="నగదు ప్రవాహ ప్రణాళిక — ఒక నెలలో నగదు చెల్లింపు పెరిగితే, లిక్విడిటీ నిర్ధారించడానికి విక్రేత చెల్లింపులు ప్లాన్ చేయండి" />
          </ul>
        </Card>
      </Section>
    </>
  );
}
