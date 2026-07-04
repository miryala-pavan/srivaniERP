'use client';

import { Receipt, ShieldCheck } from 'lucide-react';
import { te, BiText, BiHeading, BiBullet, InfoBox, Section, Card, SectionHeader } from '../../_shared';

export default function GSTReturns() {
  return (
    <>
      {/* ── 3. GSTR-3B SUMMARY ── */}
      <Section id="gst-3b">
        <Card>
          <SectionHeader icon={Receipt} num={3} en="GSTR-3B Summary" te="GSTR-3B సారాంశం" />
          <BiText className="mb-3"
            en="GSTR-3B is your monthly self-declared tax return — a summary of all sales, purchases, ITC, and net tax payable. Filed on the GST portal by the 20th of the following month."
            te="GSTR-3B మీ నెలవారీ స్వయంప్రకటిత పన్ను రిటర్న్ — అన్ని సేల్స్, కొనుగోళ్ళు, ITC మరియు చెల్లించాల్సిన నికర పన్ను సారాంశం. తదుపరి నెల 20వ తేదీలోపు GST పోర్టల్‌లో దాఖలు చేయాలి." />

          <InfoBox color="blue"
            en="Important (July 2025 onwards): Table 3.1 and 3.2 auto-populate from your filed GSTR-1 and cannot be manually edited in GSTR-3B. File GSTR-1 first, verify the numbers, then file GSTR-3B."
            te="ముఖ్యమైన (జులై 2025 నుండి): పట్టిక 3.1 మరియు 3.2 మీరు దాఖలు చేసిన GSTR-1 నుండి స్వయంచాలకంగా పాపులేట్ అవుతాయి మరియు GSTR-3B లో మాన్యువల్‌గా సవరించలేరు. ముందు GSTR-1 దాఖలు చేయండి." />

          <BiHeading en="Table 3.1 — Outward Supplies (5 rows)" te="పట్టిక 3.1 — అవుట్‌వార్డ్ సప్లైస్ (5 వరుసలు)" />
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#1B4F8A] text-white">
                  {['Row','What goes here','Relevant for grocery store?'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['3.1(a)','Taxable outward supplies — all sales attracting GST (B2B + B2C, any rate > 0%). This is your main sales row.','✅ Yes — bulk of sales'],
                  ['3.1(b)','Zero-rated outward (exports, SEZ supplies). Tax = 0% but reported separately.','❌ Not applicable for retail'],
                  ['3.1(c)','Nil-rated and exempt outward — sales of items with 0% GST (rice, vegetables, fresh produce, etc.)','✅ Yes — exempt grocery items'],
                  ['3.1(d)','Inward supplies liable to Reverse Charge (RCM) — YOU pay GST as buyer, not the supplier. E.g. goods from unregistered vendors, advocate fees, transportation.','⚠ Only if applicable'],
                  ['3.1(e)','Non-GST outward supplies — goods/services outside GST scope entirely (alcohol, petrol, electricity).','⚠ Only if you sell these'],
                ].map(([row, meaning, relevant], i) => (
                  <tr key={row} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 border border-gray-200 font-bold text-blue-700">{row}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-700">{meaning}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">{relevant}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <BiHeading en="Table 4 — ITC (Input Tax Credit)" te="పట్టిక 4 — ITC" />
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#1B4F8A] text-white">
                  {['Row','What it means','Grocery store usage'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['4(A) — ITC Available','Total ITC you are eligible to claim this month','Sum of all eligible GRNs'],
                  ['4(A)(1) Import of goods','ITC on goods imported (BOE-based)','Usually 0 for grocery'],
                  ['4(A)(3) RCM inward','ITC on RCM purchases (you paid the GST)','If applicable'],
                  ['4(A)(5) All other ITC','Regular domestic purchases — the main row for grocery stores','✅ Your main ITC row'],
                  ['4(B)(2) ITC reversed — Others','Sec 17(5) blocked ITC and any other reversals. Must be reversed here.','NOT_ELIGIBLE amounts'],
                  ['4(C) Net ITC','4(A) minus 4(B) — the ITC you actually use to offset output tax','Auto-calculated'],
                  ['4(D)(1) Ineligible — Sec 17(5)','Disclosure only (not deducted from 4A, just reported). GST paid on blocked items.','Same as 4(B)(2) usually'],
                ].map(([row, meaning, usage], i) => (
                  <tr key={row} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 border border-gray-200 font-semibold text-gray-700">{row}</td>
                    <td className="px-3 py-2 border border-gray-200 text-gray-600">{meaning}</td>
                    <td className="px-3 py-2 border border-gray-200 text-blue-700 text-[11px]">{usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <BiHeading en="The 3 summary cards at the top" te="పైన 3 సారాంశం కార్డ్‌లు" />
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Total Output Tax', desc: 'GST collected from customers on all taxable sales', color: 'border-blue-200 bg-blue-50 text-blue-800' },
              { label: 'Net ITC Available', desc: 'GST paid on eligible purchases — offsets output tax', color: 'border-green-200 bg-green-50 text-green-800' },
              { label: 'Cash to Pay', desc: 'Output tax minus ITC — this is the actual cash outflow to government', color: 'border-orange-200 bg-orange-50 text-orange-800' },
            ].map(({ label, desc, color }) => (
              <div key={label} className={`border rounded-xl p-3 ${color}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
                <p className="text-[11px] mt-1 leading-relaxed opacity-80">{desc}</p>
              </div>
            ))}
          </div>

          <InfoBox color="blue"
            en="Example: If you collected ₹45,000 GST on sales and paid ₹32,000 GST on eligible purchases, your Cash to Pay = ₹45,000 − ₹32,000 = ₹13,000."
            te="ఉదాహరణ: అమ్మకాలపై ₹45,000 GST వసూలు చేసి, అర్హమైన కొనుగోళ్ళపై ₹32,000 GST చెల్లించినట్లయితే, చెల్లించాల్సిన నగదు = ₹13,000." />
        </Card>
      </Section>

      {/* ── 4. ITC ── */}
      <Section id="gst-itc">
        <Card>
          <SectionHeader icon={ShieldCheck} num={4} en="Input Tax Credit (ITC)" te="ఇన్‌పుట్ ట్యాక్స్ క్రెడిట్ (ITC)" />
          <BiText className="mb-3"
            en="ITC allows you to offset GST paid on business purchases against the GST you collect on sales. The ERP automatically categorises every GRN line into one of three ITC types."
            te="ITC వ్యాపార కొనుగోళ్ళపై చెల్లించిన GST ని అమ్మకాలపై వసూలు చేసిన GST కి వ్యతిరేకంగా సెట్ ఆఫ్ చేయడానికి అనుమతిస్తుంది. ERP స్వయంచాలకంగా ప్రతి GRN లైన్‌ను మూడు ITC రకాల్లో ఒకదానికి వర్గీకరిస్తుంది." />

          <div className="space-y-3 mb-4">
            <div className="border-l-4 border-green-500 pl-4 py-1">
              <p className="text-sm font-bold text-green-800">✅ ELIGIBLE — Can be claimed</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">Regular business purchases where GST is paid and the goods are used in your taxable business activity. Goes into GSTR-3B Table 4(A). You get the full credit.</p>
              <p className="text-[11px] text-gray-500 mt-1" style={te}>సాధారణ వ్యాపార కొనుగోళ్ళు — పూర్తి క్రెడిట్ పొందవచ్చు.</p>
              <p className="text-[11px] text-gray-500 mt-1">Examples: Stock purchases (biscuits, soap, rice, beverages), packing materials, stationery, store equipment bought for business.</p>
            </div>
            <div className="border-l-4 border-amber-500 pl-4 py-1">
              <p className="text-sm font-bold text-amber-800">⚠ EXEMPT / NIL-RATED — No ITC (legitimately)</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">Purchases of goods that are GST-exempt or nil-rated — the supplier charged 0% GST, so there's no credit to claim. Shown in GSTR-3B Table 5 (exempt).</p>
              <p className="text-[11px] text-gray-500 mt-1" style={te}>GST మినహాయింపు వస్తువులు — 0% GST, కాబట్టి క్రెడిట్ లేదు.</p>
              <p className="text-[11px] text-gray-500 mt-1">Examples: Fresh vegetables, fresh fruits, unbranded rice/wheat, fresh milk, eggs — no GST charged by supplier.</p>
            </div>
            <div className="border-l-4 border-red-500 pl-4 py-1">
              <p className="text-sm font-bold text-red-800">🚫 NOT_ELIGIBLE — Sec 17(5) Blocked</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">GST was charged by the supplier and you paid it — but Section 17(5) of the CGST Act legally blocks you from claiming this ITC. Must be disclosed in Table 4(D)(2) of GSTR-3B.</p>
              <p className="text-[11px] text-gray-500 mt-1" style={te}>సప్లయర్ GST వసూలు చేసాడు కానీ Sec 17(5) ప్రకారం మీరు ITC క్లెయిమ్ చేయలేరు.</p>
            </div>
          </div>

          <BiHeading en="Section 17(5) Blocked Items — Full List" te="సెక్షన్ 17(5) నిరోధిత వస్తువులు — పూర్తి జాబితా" />
          <ul className="list-none pl-0">
            <BiBullet en="Food, beverages, and outdoor catering (restaurant purchases, tea/coffee for office)" te="ఆహారం, పానీయాలు మరియు అవుట్‌డోర్ కేటరింగ్ (రెస్టారెంట్ కొనుగోళ్ళు)" />
            <BiBullet en="Health services, fitness club and gym memberships" te="ఆరోగ్య సేవలు, ఫిట్‌నెస్ క్లబ్ మరియు జిమ్ సభ్యత్వాలు" />
            <BiBullet en="Life insurance and health insurance (unless mandatory for employees by law)" te="జీవిత బీమా మరియు ఆరోగ్య బీమా (చట్టపరంగా ఉద్యోగులకు తప్పనిసరి అయితే తప్ప)" />
            <BiBullet en="Rent-a-cab / vehicle hire (unless providing transportation service as business)" te="రెంట్-ఎ-క్యాబ్ / వాహన అద్దె (వ్యాపారంగా రవాణా సేవ అందించకపోతే)" />
            <BiBullet en="Works contract services for construction of immovable property (building renovation, civil works)" te="స్థిర ఆస్తి నిర్మాణానికి వర్క్స్ కాంట్రాక్ట్ సేవలు (భవన పునరుద్ధరణ, నిర్మాణ పనులు)" />
            <BiBullet en="Goods or services for personal use (not for business)" te="వ్యక్తిగత వినియోగానికి వస్తువులు లేదా సేవలు (వ్యాపారం కోసం కాదు)" />
          </ul>
          <InfoBox color="amber"
            en="If a GRN line is marked NOT_ELIGIBLE in the ERP, it means ITC was automatically blocked because the product category is in the Sec 17(5) list. This is correct — do not change it."
            te="GRN లైన్ NOT_ELIGIBLE గా గుర్తించబడినట్లయితే, ప్రొడక్ట్ కేటగిరీ Sec 17(5) జాబితాలో ఉన్నందున ITC స్వయంచాలకంగా నిరోధించబడింది. ఇది సరైనది — దీన్ని మార్చవద్దు." />

          <BiHeading en="GSTR-2B Reconciliation" te="GSTR-2B రికన్సిలియేషన్" />
          <BiText
            en="GSTR-2B is a statement auto-populated by the GST system from your suppliers' filed GSTR-1 returns. Download it from the GST portal each month and compare with the ERP Purchase Register."
            te="GSTR-2B మీ సప్లయర్ల దాఖలైన GSTR-1 రిటర్న్‌ల నుండి GST సిస్టమ్ స్వయంచాలకంగా పాపులేట్ చేసిన స్టేట్‌మెంట్. ప్రతి నెలా GST పోర్టల్ నుండి డౌన్‌లోడ్ చేసి ERP పర్చేస్ రిజిస్టర్‌తో పోల్చండి." />
          <InfoBox color="red"
            en="If a supplier has NOT filed their GSTR-1 return, their invoices will NOT appear in your GSTR-2B. You cannot claim ITC for those invoices until they file. Follow up with your suppliers."
            te="సప్లయర్ వారి GSTR-1 దాఖలు చేయకపోతే, వారి ఇన్వాయిస్‌లు మీ GSTR-2B లో కనిపించవు. వారు దాఖలు చేసే వరకు ఆ ఇన్వాయిస్‌లకు ITC క్లెయిమ్ చేయలేరు." />
        </Card>
      </Section>
    </>
  );
}
