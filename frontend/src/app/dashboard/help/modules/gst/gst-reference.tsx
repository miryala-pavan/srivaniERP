'use client';

import { Share2, CheckCircle, AlertTriangle, HelpCircle, GitMerge } from 'lucide-react';
import { BiText, BiHeading, BiBullet, InfoBox, FaqItem, Section, Card, SectionHeader } from '../../_shared';

export default function GSTReference() {
  return (
    <>
      {/* ── GSTR-2B RECONCILIATION TOOL ── */}
      <Section id="gst-recon2b">
        <Card>
          <SectionHeader icon={GitMerge} num={10} en="GSTR-2B Reconciliation Tool" te="GSTR-2B రికన్సిలియేషన్ టూల్" />
          <BiText className="mb-3"
            en="The ERP automatically matches your uploaded GSTR-2B against every approved GRN in your books — by GSTIN + invoice number. It produces 4 buckets so you know exactly which invoices are safe to claim, which need follow-up, and which you missed entering."
            te="ERP మీ అప్‌లోడ్ చేసిన GSTR-2B ను మీ పుస్తకాల్లో ఆమోదించిన ప్రతి GRN తో GSTIN + ఇన్వాయిస్ నంబర్ ద్వారా స్వయంచాలకంగా సరిపోలుస్తుంది. ఏ ఇన్వాయిస్‌లు క్లెయిమ్ చేయడానికి సురక్షితమో, ఏవి ఫాలో-అప్ కావాలో తెలుసుకోవడానికి 4 విభాగాలు చూపిస్తుంది." />

          <BiHeading en="How to use" te="ఎలా ఉపయోగించాలి" />
          <div className="space-y-2 mb-4">
            {[
              { s:'1', en:'Download your GSTR-2B from the GST portal for the month you want to reconcile. Choose JSON format (preferred) — expand the guide on the reconciliation page for exact steps.', te:'రికన్సైల్ చేయాలనుకునే నెలకు GST పోర్టల్ నుండి GSTR-2B డౌన్‌లోడ్ చేయండి. JSON ఫార్మాట్ ఉత్తమం.' },
              { s:'2', en:'Go to Reports → GSTR-2B Reconciliation in the ERP.', te:'ERP లో Reports → GSTR-2B Reconciliation కు వెళ్ళండి.' },
              { s:'3', en:'Click or drag the downloaded file into the upload area. Both .json and .xlsx are accepted.', te:'డౌన్‌లోడ్ చేసిన ఫైల్‌ను అప్‌లోడ్ ఏరియాలో క్లిక్ చేయండి లేదా డ్రాగ్ చేయండి. .json మరియు .xlsx రెండూ అంగీకరించబడతాయి.' },
              { s:'4', en:'The ERP matches invoices and shows results in 4 tabs. Review each tab and act on it before filing GSTR-3B.', te:'ERP ఇన్వాయిస్‌లను సరిపోల్చి 4 ట్యాబ్‌లలో ఫలితాలు చూపిస్తుంది. GSTR-3B దాఖలు చేయడానికి ముందు ప్రతి ట్యాబ్ సమీక్షించండి.' },
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

          <BiHeading en="What the 4 tabs mean" te="4 ట్యాబ్‌లు ఏమి అర్థం" />
          <div className="space-y-2 mb-4">
            <div className="border border-red-200 bg-red-50 rounded-xl p-3">
              <p className="text-sm font-bold text-red-800">🔴 ITC at Risk — GRN in books, NOT in GSTR-2B</p>
              <p className="text-xs text-red-700 mt-1">Your GRN is recorded but the supplier has not filed their GSTR-1 yet. This ITC does NOT appear in GSTR-2B. <strong>Do not claim this ITC</strong> in GSTR-3B — it will trigger a mismatch notice. Action: contact the supplier and ask them to file their GSTR-1. It will appear in next month's GSTR-2B once they file.</p>
              <p className="text-[11px] text-red-600 mt-1" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>మీ GRN నమోదు చేయబడింది కానీ సప్లయర్ GSTR-1 దాఖలు చేయలేదు. ఈ ITC క్లెయిమ్ చేయవద్దు. సప్లయర్‌ను సంప్రదించి GSTR-1 దాఖలు చేయమని అడగండి.</p>
            </div>
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
              <p className="text-sm font-bold text-amber-800">🟡 Mismatches — in both sides, amounts differ</p>
              <p className="text-xs text-amber-700 mt-1">Both GSTR-2B and your books have this invoice but the taxable value or tax amounts differ beyond the tolerance (₹2 or 0.5%). Cause: data entry error in the GRN, or the supplier filed a different amount. Action: compare with the physical invoice bill. If GSTR-2B is correct, update the GRN. Claim ITC only for the GSTR-2B amount.</p>
              <p className="text-[11px] text-amber-600 mt-1" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>రెండు వైపులా ఇన్వాయిస్ ఉంది కానీ మొత్తాలు తేడాగా ఉన్నాయి. భౌతిక బిల్లుతో పోల్చండి. GSTR-2B మొత్తం సరైతే GRN నవీకరించండి.</p>
            </div>
            <div className="border border-blue-200 bg-blue-50 rounded-xl p-3">
              <p className="text-sm font-bold text-blue-800">🔵 Not in Books — in GSTR-2B, NO matching GRN</p>
              <p className="text-xs text-blue-700 mt-1">The supplier filed correctly and this invoice is in GSTR-2B, but you have not entered a GRN for it. You are currently not claiming this ITC. Action: check if goods were received. If yes, create the GRN in ERP — ITC will then be claimable. Remember the ITC deadline: 30 November of the next FY.</p>
              <p className="text-[11px] text-blue-600 mt-1" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>GSTR-2B లో ఉంది కానీ GRN నమోదు చేయలేదు. వస్తువులు అందుకున్నారా తనిఖీ చేయండి. అయితే GRN నమోదు చేయండి. గడువు: తదుపరి FY నవంబర్ 30.</p>
            </div>
            <div className="border border-green-200 bg-green-50 rounded-xl p-3">
              <p className="text-sm font-bold text-green-800">🟢 Matched — amounts agree on both sides</p>
              <p className="text-xs text-green-700 mt-1">The invoice is in both GSTR-2B and your books and the amounts match within tolerance. ITC from these invoices is safe to claim in GSTR-3B Table 4(A)(5). No action needed.</p>
              <p className="text-[11px] text-green-600 mt-1" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>ఇన్వాయిస్ రెండు వైపులా ఉంది మరియు మొత్తాలు సరిపోల్చబడ్డాయి. GSTR-3B Table 4(A)(5) లో ITC క్లెయిమ్ చేయడం సురక్షితం.</p>
            </div>
          </div>

          <BiHeading en="Tolerance rule" te="సహన నియమం" />
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3 text-xs text-gray-700 space-y-1">
            <p>An invoice is classified as <strong>Matched</strong> (not Mismatch) when both conditions hold:</p>
            <p className="font-mono text-gray-600">│ 2B Taxable − Book Taxable │ ≤ max(₹2, 0.5% of 2B Taxable)</p>
            <p className="font-mono text-gray-600">│ 2B Tax − Book Tax │ ≤ max(₹2, 1% of 2B Tax)</p>
            <p className="mt-1 text-gray-500">This handles rounding differences that arise when a supplier breaks taxable value across multiple HSN rates on the same invoice.</p>
            <p className="text-[11px] text-gray-400 mt-1" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>ఇది సప్లయర్ ఒకే ఇన్వాయిస్‌లో బహుళ HSN రేట్లపై పన్ను విలువను విభజించినప్పుడు తలెత్తే రౌండింగ్ తేడాలను నిర్వహిస్తుంది.</p>
          </div>

          <BiHeading en="Match logic" te="సరిపోలిక తర్కం" />
          <ul className="list-none pl-0 mb-3">
            <BiBullet en="Matching key: Supplier GSTIN + Invoice Number (case-insensitive, all punctuation stripped). So 'PE/1234/26-27' and 'PE1234/26-27' match." te="సరిపోలిక కీ: సప్లయర్ GSTIN + ఇన్వాయిస్ నంబర్ (కేస్ అసెన్సిటివ్, విరామ చిహ్నాలు తొలగించబడతాయి)." />
            <BiBullet en="Invoice date is not used for matching — only for the date-window filter (ITC at Risk only shows GRNs whose invoice date falls within the GSTR-2B period)." te="ఇన్వాయిస్ తేదీ సరిపోలికకు ఉపయోగించబడదు — దేదీ-విండో ఫిల్టర్ కోసం మాత్రమే." />
            <BiBullet en="Credit/Debit notes (CDNR) from GSTR-2B are also included in the match." te="GSTR-2B నుండి క్రెడిట్/డెబిట్ నోట్లు (CDNR) కూడా సరిపోలికలో చేర్చబడతాయి." />
          </ul>

          <BiHeading en="Downloading results" te="ఫలితాలు డౌన్‌లోడ్ చేయడం" />
          <ul className="list-none pl-0">
            <BiBullet en="Each tab has its own 'Download CSV' button — exports only that tab's invoices." te="ప్రతి ట్యాబ్‌లో 'Download CSV' బటన్ ఉంది — ఆ ట్యాబ్ ఇన్వాయిస్‌లు మాత్రమే ఎగుమతి చేస్తుంది." />
            <BiBullet en="'Download All' (in the file info bar) exports all 4 tabs in a single CSV with section headers — easier to share with CA or file for audit." te="'Download All' (ఫైల్ ఇన్ఫో బార్‌లో) అన్ని 4 ట్యాబ్‌లను సెక్షన్ హెడర్‌లతో ఒకే CSV లో ఎగుమతి చేస్తుంది — CA తో షేర్ చేయడానికి లేదా ఆడిట్ కోసం సులభం." />
            <BiBullet en="The CSV includes supplier GSTIN, invoice number, date, 2B amounts, book amounts, and diff columns — suitable for filing as evidence." te="CSV లో సప్లయర్ GSTIN, ఇన్వాయిస్ నంబర్, తేదీ, 2B మొత్తాలు, పుస్తక మొత్తాలు మరియు తేడా కాలమ్‌లు ఉంటాయి." />
          </ul>

          <InfoBox color="amber"
            en="Run this reconciliation every month BEFORE filing GSTR-3B. Claiming ITC that is not in GSTR-2B will trigger a GST department mismatch notice and demand of ITC reversal with 18% interest."
            te="GSTR-3B దాఖలు చేయడానికి ముందు ప్రతి నెలా ఈ రికన్సిలియేషన్ నిర్వహించండి. GSTR-2B లో లేని ITC క్లెయిమ్ చేస్తే 18% వడ్డీతో ITC రివర్సల్ నోటీసు వస్తుంది." />
        </Card>
      </Section>

      {/* ── 11. SHARE WITH CA ── */}
      <Section id="gst-ca">
        <Card>
          <SectionHeader icon={Share2} num={11} en="Share with CA / Auditor" te="CA / ఆడిటర్‌తో షేర్ చేయండి" />
          <BiText className="mb-3"
            en="Generate a secure, read-only share link for your CA or auditor. They can view GSTR-3B summary and inward supplies — and download Excel — without needing an ERP login."
            te="మీ CA లేదా ఆడిటర్ కోసం సురక్షిత, రీడ్-ఓన్లీ షేర్ లింక్ రూపొందించండి. ERP లాగిన్ అవసరం లేకుండా వారు GSTR-3B సారాంశం మరియు ఇన్వార్డ్ సప్లైస్ వీక్షించవచ్చు." />

          <BiHeading en="How to generate and share" te="ఎలా రూపొందించి షేర్ చేయాలి" />
          <div className="space-y-2 mb-3">
            {[
              { s:'1', en:'Go to Dashboard → Reports → GST Reports', te:'వెళ్ళండి: డాష్‌బోర్డ్ → రిపోర్ట్‌లు → GST రిపోర్ట్‌లు' },
              { s:'2', en:'Select the month and year you want to share', te:'షేర్ చేయాలనుకునే నెల మరియు సంవత్సరం ఎంచుకోండి' },
              { s:'3', en:"Click the 🔗 'Share with CA' button (lock icon) in the top-right area", te:"పై-కుడి వైపు 🔗 'CA తో షేర్ చేయి' బటన్ క్లిక్ చేయండి" },
              { s:'4', en:'A unique link is generated — copy it', te:'ఒక ప్రత్యేక లింక్ రూపొందించబడుతుంది — దాన్ని కాపీ చేయండి' },
              { s:'5', en:'Send via WhatsApp or email to your CA', te:'WhatsApp లేదా ఇమెయిల్ ద్వారా మీ CA కు పంపండి' },
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

          <BiHeading en="What the CA sees" te="CA ఏమి చూస్తారు" />
          <ul className="list-none pl-0">
            <BiBullet en="GSTR-3B summary card — output tax, ITC available, and net tax payable for the selected month" te="GSTR-3B సారాంశం కార్డ్ — ఎంచుకున్న నెలకు అవుట్‌పుట్ పన్ను, ITC అందుబాటు, మరియు నికర పన్ను" />
            <BiBullet en="Full inward supplies (purchase) table with supplier GSTIN, invoice, taxable value, and ITC category" te="సప్లయర్ GSTIN, ఇన్వాయిస్, పన్ను విలువ మరియు ITC వర్గంతో పూర్తి ఇన్వార్డ్ సప్లైస్ పట్టిక" />
            <BiBullet en="ITC summary: Eligible / Exempt / Ineligible breakdown with grand totals" te="ITC సారాంశం: Eligible / Exempt / Ineligible వివరణ మరియు మొత్తం మొత్తాలు" />
            <BiBullet en="Download buttons for inward supplies Excel and purchase register Excel" te="ఇన్వార్డ్ సప్లైస్ ఎక్సెల్ మరియు పర్చేస్ రిజిస్టర్ ఎక్సెల్ కోసం డౌన్‌లోడ్ బటన్లు" />
          </ul>

          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <InfoBox color="green"
              en="Link expires in 30 days. Generate a new one each month when sharing with CA for review."
              te="లింక్ 30 రోజుల్లో గడువు ముగుస్తుంది. CA తో సమీక్ష కోసం షేర్ చేసేటప్పుడు ప్రతి నెలా కొత్తది రూపొందించండి." />
            <InfoBox color="blue"
              en="Security: Each link is HMAC-signed with a secret key. Even if someone guesses the URL, they cannot access another business's data."
              te="భద్రత: ప్రతి లింక్ రహస్య కీతో HMAC-సైన్ చేయబడింది. వేరే వ్యాపారం డేటా యాక్సెస్ చేయడం అసాధ్యం." />
          </div>
        </Card>
      </Section>

      {/* ── 11. MONTHLY CHECKLIST ── */}
      <Section id="gst-checklist">
        <Card>
          <SectionHeader icon={CheckCircle} num={12} en="Monthly Filing Checklist" te="నెలవారీ ఫైలింగ్ చెక్‌లిస్ట్" />
          <BiText className="mb-3"
            en="Follow this checklist every month to file GST accurately and on time. The key rule: always file GSTR-1 (sales) before GSTR-3B (summary)."
            te="GST ఖచ్చితంగా మరియు సమయానికి దాఖలు చేయడానికి ప్రతి నెలా ఈ చెక్‌లిస్ట్ అనుసరించండి. ముఖ్యమైన నియమం: ఎల్లప్పుడూ GSTR-3B కి ముందు GSTR-1 దాఖలు చేయండి." />
          <div className="space-y-2.5">
            {[
              { by:'By 5th', color:'bg-gray-100 border-gray-300', step:'Ensure all supplier GRNs for the previous month are entered and approved in ERP. Missing GRNs = lost ITC.', te:'మునుపటి నెల అన్ని సప్లయర్ GRNలు ERP లో నమోదు చేయబడి ఆమోదించబడ్డాయని నిర్ధారించుకోండి. మిస్ అయిన GRNలు = కోల్పోయిన ITC.' },
              { by:'By 8th', color:'bg-blue-50 border-blue-200', step:'Open GST Reports → Sales Register. Verify total matches your billing summary. Spot-check a few B2B invoices for correct GSTIN.', te:'GST రిపోర్ట్‌లు → సేల్స్ రిజిస్టర్ తెరవండి. మొత్తం మీ బిల్లింగ్ సారాంశంతో సరిపోతుందో ధృవీకరించండి.' },
              { by:'By 8th', color:'bg-violet-50 border-violet-200', step:'Check Purchase Register → flag any unexpected NOT_ELIGIBLE entries. Verify supplier GSTINs are correct.', te:'పర్చేస్ రిజిస్టర్ చెక్ చేయండి → ఊహించని NOT_ELIGIBLE ఎంట్రీలను గుర్తించండి. సప్లయర్ GSTINలు సరైనవేనని ధృవీకరించండి.' },
              { by:'By 10th', color:'bg-orange-50 border-orange-200', step:'Download GSTR-2B from GST portal. Reconcile with ERP Purchase Register — follow up on unmatched invoices.', te:'GST పోర్టల్ నుండి GSTR-2B డౌన్‌లోడ్ చేయండి. ERP పర్చేస్ రిజిస్టర్‌తో రికన్సైల్ చేయండి.' },
              { by:'By 11th', color:'bg-emerald-50 border-emerald-200', step:'File GSTR-1 on the GST portal — B2B invoices, B2CL invoices, B2CS summary, HSN summary.', te:'GST పోర్టల్‌లో GSTR-1 దాఖలు చేయండి — B2B ఇన్వాయిస్‌లు, B2CL ఇన్వాయిస్‌లు, B2CS సారాంశం, HSN సారాంశం.' },
              { by:'By 18th', color:'bg-yellow-50 border-yellow-200', step:'Review GSTR-3B Summary in ERP → note Cash to Pay. Important (July 2025+): GSTR-3B Tables 3.1 & 3.2 auto-fill from your filed GSTR-1 and are not manually editable — verify GSTR-1 was correct before filing GSTR-3B.', te:'ERP లో GSTR-3B సారాంశం సమీక్షించండి. జులై 2025 నుండి: GSTR-3B పట్టికలు 3.1 & 3.2 GSTR-1 నుండి స్వయంచాలకంగా పాపులేట్ అవుతాయి, మాన్యువల్‌గా సవరించలేరు.' },
              { by:'By 20th', color:'bg-red-50 border-red-200', step:'Pay GST via GST portal cash ledger, then file GSTR-3B. Keep payment challan for records.', te:'GST పోర్టల్ కాష్ లెడ్జర్ ద్వారా GST చెల్లించండి, తరువాత GSTR-3B దాఖలు చేయండి. రికార్డ్ కోసం చెల్లింపు చలాన్ ఉంచండి.' },
            ].map(({ by, color, step, te }) => (
              <div key={by + step.slice(0,20)} className={`flex gap-3 border rounded-xl p-3 ${color}`}>
                <span className="text-[10px] font-bold text-gray-500 w-14 shrink-0 mt-0.5 whitespace-nowrap">{by}</span>
                <div>
                  <p className="text-xs text-gray-800 leading-relaxed">{step}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5" style={{ fontFamily: 'Noto Sans Telugu, sans-serif' }}>{te}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ── 12. MISTAKES ── */}
      <Section id="gst-mistakes">
        <Card>
          <SectionHeader icon={AlertTriangle} num={13} en="Common Mistakes to Avoid" te="సాధారణ తప్పులు" />
          {[
            { color:'red' as const, title:'Claiming ITC for Sec 17(5) blocked items', te:'Sec 17(5) నిరోధిత వస్తువులకు ITC క్లెయిమ్ చేయడం', en:"If the ERP marks a GRN line NOT_ELIGIBLE, don't override it to claim the ITC. Incorrect ITC claims attract interest (18% p.a.) and penalty.", teBody:'ERP ఒక GRN లైన్‌ను NOT_ELIGIBLE గా గుర్తిస్తే, ITC క్లెయిమ్ చేయడానికి దాన్ని override చేయవద్దు. తప్పుడు ITC క్లెయిమ్‌లు వడ్డీ (18% p.a.) మరియు జరిమానాకు దారితీస్తాయి.' },
            { color:'amber' as const, title:'Filing GSTR-3B without reconciling GSTR-2B', te:'GSTR-2B రికన్సైల్ చేయకుండా GSTR-3B దాఖలు చేయడం', en:'Always download GSTR-2B and match it with your Purchase Register before filing GSTR-3B. Over-claiming ITC leads to demand notices.', teBody:'GSTR-3B దాఖలు చేయడానికి ముందు ఎల్లప్పుడూ GSTR-2B డౌన్‌లోడ్ చేసి పర్చేస్ రిజిస్టర్‌తో సరిపోల్చండి.' },
            { color:'amber' as const, title:'Filing GSTR-3B before GSTR-1', te:'GSTR-1 కి ముందు GSTR-3B దాఖలు చేయడం', en:'Always file outward returns (GSTR-1) first. Filing GSTR-3B first can cause mismatches in the GST portal that are hard to correct.', teBody:'ఎల్లప్పుడూ అవుట్‌వార్డ్ రిటర్న్‌లు (GSTR-1) ముందు దాఖలు చేయండి.' },
            { color:'red' as const, title:'Missing GRN entries before filing', te:'దాఖలు చేయడానికి ముందు GRN ఎంట్రీలు మిస్ చేయడం', en:'Not entering all supplier GRNs before the 5th means you lose ITC for those invoices for that month. Enter GRNs the same day you receive goods.', teBody:'5వ తేదీ కి ముందు అన్ని సప్లయర్ GRNలు నమోదు చేయకపోవడం వల్ల ఆ నెలకు ఆ ఇన్వాయిస్‌లకు ITC కోల్పోతారు.' },
            { color:'blue' as const, title:'Wrong financial year selected in Trend Dashboard', te:'ట్రెండ్ డాష్‌బోర్డ్‌లో తప్పుడు ఆర్థిక సంవత్సరం ఎంచుకోవడం', en:'Indian FY is April to March. Always select the FY dropdown correctly — FY 2025-26 covers April 2025 to March 2026, not calendar year 2025-26.', teBody:'భారతీయ FY ఏప్రిల్ నుండి మార్చి. FY డ్రాప్‌డౌన్ ఎల్లప్పుడూ సరిగ్గా ఎంచుకోండి.' },
          ].map(m => (
            <InfoBox key={m.title} color={m.color}
              en={`${m.title}: ${m.en}`}
              te={`${m.te}: ${m.teBody}`} />
          ))}
        </Card>
      </Section>

      {/* ── 13. FAQ ── */}
      <Section id="gst-faq">
        <Card>
          <SectionHeader icon={HelpCircle} num={14} en="Frequently Asked Questions" te="తరచుగా అడిగే ప్రశ్నలు" />
          <FaqItem q="When is GSTR-3B due each month?" qte="ప్రతి నెలా GSTR-3B ఎప్పుడు దాఖలు చేయాలి?" a="By the 20th of the following month. For example, July's GSTR-3B is due by August 20th. Late filing attracts ₹50/day penalty (₹20/day for nil returns)." ate="తదుపరి నెల 20వ తేదీలోపు. జూలై GSTR-3B ఆగస్టు 20వ తేదీలోపు దాఖలు చేయాలి. ఆలస్యంగా దాఖలు చేస్తే రోజుకు ₹50 జరిమానా (నిల్ రిటర్న్‌లకు రోజుకు ₹20)." />
          <FaqItem q="What is the difference between GSTR-1 and GSTR-3B?" qte="GSTR-1 మరియు GSTR-3B మధ్య తేడా ఏమిటి?" a="GSTR-1 is the detail return of all outward supplies (sales) — invoice-by-invoice. GSTR-3B is the monthly summary of your tax liability, ITC, and net tax payable. File GSTR-1 first (by 11th), then GSTR-3B (by 20th)." ate="GSTR-1 అన్ని అవుట్‌వార్డ్ సప్లైస్ (అమ్మకాలు) యొక్క వివరణాత్మక రిటర్న్ — ఇన్వాయిస్ వారీగా. GSTR-3B మీ పన్ను బాధ్యత, ITC మరియు నికర పన్ను చెల్లించాల్సిన నెలవారీ సారాంశం." />
          <FaqItem q="What is GSTR-2B and why does it matter?" qte="GSTR-2B అంటే ఏమిటి మరియు అది ఎందుకు ముఖ్యం?" a="GSTR-2B is a read-only statement auto-generated by the GST system from your suppliers' filed GSTR-1 returns. It has 4 sections: ITC Available, ITC Not Available, ITC Reversal (Rule 37A — supplier didn't file GSTR-3B), and ITC Rejected (from Oct 2024 — invoices you rejected on the IMS Dashboard). You can only claim ITC that appears in the 'Available' section. Download it monthly and reconcile with the ERP Purchase Register." ate="GSTR-2B సప్లయర్ల GSTR-1 నుండి స్వయంచాలకంగా రూపొందించిన స్టేట్‌మెంట్. 4 విభాగాలు: ITC అందుబాటు, అందుబాటు కాదు, రివర్సల్ (Rule 37A), మరియు తిరస్కరించబడింది (అక్టోబర్ 2024 నుండి IMS డాష్‌బోర్డ్). 'Available' విభాగంలో కనిపించే ITC మాత్రమే క్లెయిమ్ చేయవచ్చు." />
          <FaqItem q="Is there a deadline to claim ITC from old invoices?" qte="పాత ఇన్వాయిస్‌ల నుండి ITC క్లెయిమ్ చేయడానికి గడువు ఉందా?" a="Yes. ITC must be claimed by the earlier of: (1) 30th November of the next financial year, or (2) the date you file your Annual Return (GSTR-9) for that year. Example: ITC for FY 2025-26 invoices must be claimed by 30 November 2026. ITC not claimed by this date is permanently lost — you cannot carry it forward further." ate="అవును. ITC ముందుగా ఏదైతే వచ్చినా క్లెయిమ్ చేయాలి: (1) తదుపరి ఆర్థిక సంవత్సరం నవంబర్ 30, లేదా (2) వార్షిక రిటర్న్ (GSTR-9) దాఖలు తేదీ. FY 2025-26 ఇన్వాయిస్‌లకు నవంబర్ 30, 2026 లోపు క్లెయిమ్ చేయాలి — లేకపోతే శాశ్వతంగా కోల్పోతారు." />
          <FaqItem q="Can I file GST returns directly from the ERP?" qte="ERP నుండి నేరుగా GST రిటర్న్‌లు దాఖలు చేయవచ్చా?" a="Not currently — use the ERP reports to get the numbers, then file manually on the GST portal (gstin.gov.in). JSON export for direct portal upload is planned for a future update." ate="ప్రస్తుతం కాదు — ERP రిపోర్ట్‌ల నుండి నంబర్లు తీసుకుని GST పోర్టల్‌లో మాన్యువల్‌గా దాఖలు చేయండి. JSON ఎగుమతి భవిష్యత్ అప్‌డేట్ కోసం ప్లాన్ చేయబడింది." />
          <FaqItem q="What happens if a supplier files their GSTR-1 late?" qte="సప్లయర్ వారి GSTR-1 ఆలస్యంగా దాఖలు చేస్తే ఏమవుతుంది?" a="Their invoices appear in a later month's GSTR-2B. You can claim that ITC in the month it appears — you don't permanently lose it, but you lose the timing benefit. Follow up with suppliers who regularly file late." ate="వారి ఇన్వాయిస్‌లు తర్వాత నెల GSTR-2B లో కనిపిస్తాయి. అది కనిపించిన నెలలో ఆ ITC క్లెయిమ్ చేయవచ్చు — శాశ్వతంగా కోల్పోరు, కానీ సమయ ప్రయోజనం పోతుంది." />
          <FaqItem q="What GST rates apply to grocery store products?" qte="కిరాణా స్టోర్ ఉత్పత్తులకు ఏ GST రేట్లు వర్తిస్తాయి?" a="0% (nil): Fresh vegetables, fruits, unbranded/unpackaged rice, wheat, milk, eggs, fresh meat. 5%: Packaged food, edible oils, tea, coffee, sugar. 12%: Ghee, butter, paneer, dry fruits. 18%: Soap, shampoo, toothpaste, biscuits, chocolates, aerated drinks. 28%: Tobacco products." ate="0%: తాజా కూరగాయలు, పండ్లు, బ్రాండ్ చేయని బియ్యం, గోధుమ, పాలు, గుడ్లు. 5%: ప్యాకేజ్డ్ ఆహారం, వంట నూనె, టీ, కాఫీ, చక్కెర. 18%: సబ్బు, షాంపూ, బిస్కెట్లు. 28%: పొగాకు ఉత్పత్తులు." />
        </Card>

        <div className="text-center text-xs text-gray-400 py-5 border-t border-gray-200 mt-2">
          ERP Platform · GST Reports Guide · July 2026
        </div>
      </Section>
    </>
  );
}
