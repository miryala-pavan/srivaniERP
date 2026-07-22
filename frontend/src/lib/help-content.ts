// ─── EAAS Help Content — Single Source of Truth ──────────────────────────────
// To add help for a new page: add one entry to HELP_CONTENT. Nothing else.
// Bump `version` when content changes — drawer shows "Updated vX.X" once.
// ─────────────────────────────────────────────────────────────────────────────

export interface HelpField {
  en: string;
  te: string;
}

export interface HelpSection {
  title: HelpField;
  body:  HelpField;
}

export interface HelpMistake {
  mistake: HelpField;
  fix:     HelpField;
}

export interface HelpEntry {
  id:              string;
  route:           string;
  module:          string;
  version:         string;
  roles?:          string[];
  title:           HelpField;
  summary:         HelpField;
  fields?:         Record<string, HelpField>;
  sections?:       HelpSection[];
  commonMistakes?: HelpMistake[];
  relatedTopics?:  string[];
  tags?:           string[];
}

// ─────────────────────────────────────────────────────────────────────────────

export const HELP_CONTENT: HelpEntry[] = [

  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    id: 'dashboard', route: '/dashboard', module: 'core', version: '2.0',
    title: { en: 'Dashboard', te: 'డాష్‌బోర్డ్' },
    summary: {
      en: 'Your daily command centre. Real-time view of today\'s sales, gross margin, pending purchase orders, low-stock alerts, and day-closure status. Every number resets at midnight.',
      te: 'మీ రోజువారీ కమాండ్ సెంటర్. నేటి అమ్మకాలు, గ్రాస్ మార్జిన్, పెండింగ్ PO లు, తక్కువ స్టాక్ హెచ్చరికలు మరియు రోజు ముగింపు స్థితిని నిజ సమయంలో చూపిస్తుంది. ప్రతి సంఖ్య అర్ధరాత్రి రీసెట్ అవుతుంది.',
    },
    sections: [
      {
        title: { en: 'KPI Cards — what each number means', te: 'KPI కార్డులు — ప్రతి సంఖ్య అర్థం' },
        body: {
          en: 'Today\'s Sales = sum of all bill totals since midnight (including GST). Gross Margin = (Net Sales − Cost of Goods Sold) ÷ Net Sales × 100 — shown as a percentage. Transaction Count = number of completed bills. Avg Bill Value = Today\'s Sales ÷ Transaction Count. These update live every 30 seconds during business hours.',
          te: 'నేటి అమ్మకాలు = అర్ధరాత్రి నుండి అన్ని బిల్ మొత్తాల మొత్తం (GST తో సహా). గ్రాస్ మార్జిన్ = (నెట్ అమ్మకాలు − వస్తువుల ధర) ÷ నెట్ అమ్మకాలు × 100 — శాతంలో చూపబడుతుంది. లావాదేవీ గణన = పూర్తయిన బిల్ల సంఖ్య. సగటు బిల్ విలువ = నేటి అమ్మకాలు ÷ లావాదేవీ గణన. వ్యాపార సమయంలో ప్రతి 30 సెకన్లకు అప్‌డేట్ అవుతాయి.',
        },
      },
      {
        title: { en: 'Gross Margin calculation', te: 'గ్రాస్ మార్జిన్ లెక్కింపు' },
        body: {
          en: 'Gross Margin % = (Net Revenue − COGS) ÷ Net Revenue × 100. Net Revenue strips GST from the selling price (SP ÷ (1 + GST Rate/100)). COGS = cost price × qty for each item sold. Example: you sell Sugar 1kg at ₹52.50 with 5% GST and cost ₹42. Net Revenue = ₹50, COGS = ₹42, Margin = (50−42)÷50×100 = 16%. A healthy grocery margin is 8–18%.',
          te: 'గ్రాస్ మార్జిన్ % = (నెట్ రెవెన్యూ − COGS) ÷ నెట్ రెవెన్యూ × 100. నెట్ రెవెన్యూ అమ్మకపు ధర నుండి GST తీసివేస్తుంది (SP ÷ (1 + GST రేటు/100)). COGS = అమ్మిన ప్రతి వస్తువుకు ధర × పరిమాణం. ఉదాహరణ: చక్కెర 1kg ₹52.50కు అమ్మారు, 5% GST, ధర ₹42. నెట్ రెవెన్యూ = ₹50, COGS = ₹42, మార్జిన్ = 16%. ఆరోగ్యకరమైన కిరాణా మార్జిన్ 8–18%.',
        },
      },
      {
        title: { en: 'Stock Alerts', te: 'స్టాక్ హెచ్చరికలు' },
        body: {
          en: 'Red = out of stock (quantity = 0). Orange = below reorder level. Click any alert to jump to that product. When stock hits zero at POS, the system auto-creates a Purchase Order for the preferred supplier — check the PO list and confirm before calling the supplier.',
          te: 'ఎరుపు = స్టాక్ అయిపోయింది (పరిమాణం = 0). నారింజ = రీఆర్డర్ స్థాయి కంటే తక్కువ. ఆ ఉత్పత్తికి వెళ్ళడానికి ఏదైనా హెచ్చరికను క్లిక్ చేయండి. POS లో స్టాక్ సున్నాకు చేరినప్పుడు, సిస్టమ్ ఆటోమేటిగ్గా ప్రెఫర్డ్ సరఫరాదారుకు కొనుగోలు ఆర్డర్ సృష్టిస్తుంది — సరఫరాదారుకు కాల్ చేయడానికి ముందు PO జాబితా తనిఖీ చేసి నిర్ధారించండి.',
        },
      },
      {
        title: { en: 'Day Closure banner', te: 'రోజు ముగింపు బ్యానర్' },
        body: {
          en: 'The orange banner at the top means yesterday\'s day closure is pending. You can still bill today, but you must complete the previous day\'s closure before reports can be generated for that day. Day closure locks the ledger, generates the GST summary, and reconciles cash.',
          te: 'పైన నారింజ బ్యానర్ నిన్నటి రోజు ముగింపు పెండింగ్‌లో ఉందని అర్థం. మీరు ఈరోజు ఇంకా బిల్ చేయవచ్చు, కానీ ఆ రోజు రిపోర్టులు రూపొందించడానికి ముందు మునుపటి రోజు ముగింపు పూర్తి చేయాలి. రోజు ముగింపు లెడ్జర్‌ను లాక్ చేస్తుంది, GST సారాంశాన్ని రూపొందిస్తుంది మరియు నగదును సమాధానపరుస్తుంది.',
        },
      },
      {
        title: { en: 'Keyboard shortcuts', te: 'కీబోర్డ్ షార్ట్‌కట్‌లు' },
        body: {
          en: 'Ctrl+K → Command Palette (search everything by name). ? → Help assistant. g d → Dashboard. g p → Products. g k → POS Billing. g r → Reports. g s → Suppliers. Ctrl+B → Bills. n → New (context-aware). These work from any page inside the dashboard.',
          te: 'Ctrl+K → కమాండ్ పాలెట్ (పేరు ద్వారా అన్నీ శోధించు). ? → సహాయ అసిస్టెంట్. g d → డాష్‌బోర్డ్. g p → ఉత్పత్తులు. g k → POS బిల్లింగ్. g r → రిపోర్టులు. g s → సరఫరాదారులు. Ctrl+B → బిల్లులు. n → కొత్తది (సందర్భానుసారం). ఇవి డాష్‌బోర్డ్ లోపల ఏ పేజీ నుండైనా పని చేస్తాయి.',
        },
      },
    ],
    relatedTopics: ['pos', 'day-closure', 'purchase-orders'],
    tags: ['dashboard', 'sales', 'margin', 'stock', 'kpi'],
  },

  // ── Products ───────────────────────────────────────────────────────────────
  {
    id: 'products', route: '/dashboard/products', module: 'products', version: '2.0',
    title: { en: 'Products', te: 'ఉత్పత్తులు' },
    summary: {
      en: 'Master product catalog. Each product is a named item with HSN code and GST rate. Pricing, stock, and pack sizes are managed via PLUs under each product. Think of Product as a brand/variety, PLU as a specific pack you stock.',
      te: 'మాస్టర్ ఉత్పత్తి కేటలాగ్. ప్రతి ఉత్పత్తి HSN కోడ్ మరియు GST రేటుతో పేరుపెట్టిన వస్తువు. ధర, స్టాక్ మరియు ప్యాక్ సైజులు ప్రతి ఉత్పత్తి కింద PLU ల ద్వారా నిర్వహించబడతాయి. ఉత్పత్తిని బ్రాండ్/రకంగా, PLU ను మీరు స్టాక్ చేసే నిర్దిష్ట ప్యాక్‌గా భావించండి.',
    },
    fields: {
      'Product Name': { en: 'The full commercial name — include brand and variant. Example: "Aashirvaad Atta" not just "Atta". This appears on bills and reports.', te: 'పూర్తి వాణిజ్య పేరు — బ్రాండ్ మరియు వేరియంట్ చేర్చండి. ఉదాహరణ: "ఆశీర్వాద్ ఆటా" అని మాత్రమే "ఆటా" కాదు. ఇది బిల్లులు మరియు రిపోర్టులలో కనిపిస్తుంది.' },
      'Product Code': { en: 'Your internal short code — optional but useful for quick POS search. Keep it short: SUG50, RICE5K, SUNFL1.', te: 'మీ అంతర్గత షార్ట్ కోడ్ — ఐచ్ఛికం కానీ POS శోధనకు ఉపయోగకరం. చిన్నగా ఉంచండి: SUG50, RICE5K, SUNFL1.' },
      'Category': { en: 'Groups products for reports and online store navigation. Create categories in Settings → Categories before adding products.', te: 'రిపోర్టులు మరియు ఆన్‌లైన్ స్టోర్ నావిగేషన్ కోసం ఉత్పత్తులను గ్రూప్ చేస్తుంది. ఉత్పత్తులు జోడించే ముందు సెట్టింగ్‌లు → వర్గాలలో వర్గాలు సృష్టించండి.' },
      'HSN Code': { en: 'Harmonised System of Nomenclature — mandatory for GST filing. Common codes: Sugar=1701, Rice=1006, Edible Oil=1511, Dal/Pulses=0713, Atta/Flour=1101, Tea=0902, Coffee=0901, Salt=2501, Biscuits=1905, Soap=3401. 4-digit minimum; 6 or 8 for precision.', te: 'హార్మోనైజ్డ్ నొమెన్‌క్లేచర్ — GST ఫైలింగ్‌కు తప్పనిసరి. సాధారణ కోడ్‌లు: చక్కెర=1701, బియ్యం=1006, నూనె=1511, పప్పు=0713, ఆటా=1101, టీ=0902, కాఫీ=0901, ఉప్పు=2501, బిస్కెట్‌లు=1905, సబ్బు=3401. కనీసం 4 అంకెలు; ఖచ్చితత్వం కోసం 6 లేదా 8.' },
      'GST Rate': { en: 'Tax rate applied at billing. 0% = fresh food (rice, atta, vegetables, milk). 5% = packaged food, edible oil. 12% = some processed foods, ghee. 18% = non-food items, soaps. 28% = luxury goods. Wrong rate means wrong GST return — verify before saving.', te: 'బిల్లింగ్‌లో వర్తించే పన్ను రేటు. 0% = తాజా ఆహారం (బియ్యం, ఆటా, కూరగాయలు, పాలు). 5% = ప్యాకేజ్డ్ ఆహారం, వంట నూనె. 12% = కొన్ని ప్రాసెస్డ్ ఆహారాలు, నెయ్యి. 18% = ఆహారేతర వస్తువులు, సబ్బులు. 28% = విలాసవంత వస్తువులు. తప్పు రేటు తప్పు GST రిటర్న్ అంటుంది — సేవ్ చేయడానికి ముందు ధృవీకరించండి.' },
      'Preferred Supplier': { en: 'The supplier auto-selected when a Purchase Order is created for this product (manual or auto-reorder). You can override it when creating the PO.', te: 'ఈ ఉత్పత్తికి కొనుగోలు ఆర్డర్ సృష్టించినప్పుడు (మాన్యువల్ లేదా ఆటో-రీఆర్డర్) స్వయంచాలకంగా ఎంచుకున్న సరఫరాదారు. PO సృష్టించేటప్పుడు మీరు దీన్ని మార్చవచ్చు.' },
      'Reorder Level': { en: 'When stock falls to this quantity, the system auto-creates a Draft Purchase Order. Set it to 1–2 weeks of typical demand. Leave blank to disable auto-reorder for this product.', te: 'స్టాక్ ఈ పరిమాణానికి పడినప్పుడు, సిస్టమ్ స్వయంచాలకంగా డ్రాఫ్ట్ కొనుగోలు ఆర్డర్ సృష్టిస్తుంది. సాధారణ డిమాండ్ యొక్క 1–2 వారాలుగా సెట్ చేయండి. ఈ ఉత్పత్తికి ఆటో-రీఆర్డర్ నిలిపివేయడానికి ఖాళీగా వదిలేయండి.' },
      'Reorder Qty': { en: 'Default quantity filled on the auto-generated PO. Typically a full case or truckload quantity — whatever you normally order at once.', te: 'ఆటో-జనరేట్ అయిన PO లో నిండిన డిఫాల్ట్ పరిమాణం. సాధారణంగా పూర్తి కేస్ లేదా ట్రక్‌లోడ్ పరిమాణం — మీరు సాధారణంగా ఒకేసారి ఆర్డర్ చేసే మొత్తం.' },
      'Pack Size / GST Unit (UQC)': { en: 'Optional — sets Measure Type, Unit Symbol and Pack Size directly on this product\'s default PLU, using the same government-standards unit list (GST UQC) as PLU Management and Unit Management. Leave blank to set it later — nothing here blocks saving the product. Setting it here is what unlocks auto-suggested quantities and automatic wastage tracking in Break Bulk for this product.', te: 'ఐచ్ఛికం — PLU Management మరియు Unit Management లో ఉపయోగించే అదే ప్రభుత్వ-ప్రమాణాల యూనిట్ జాబితా (GST UQC) ఉపయోగించి, ఈ ఉత్పత్తి యొక్క డిఫాల్ట్ PLU పై నేరుగా Measure Type, Unit Symbol మరియు Pack Size సెట్ చేస్తుంది. తర్వాత సెట్ చేయడానికి ఖాళీగా వదిలేయండి — ఇక్కడ ఏదీ ఉత్పత్తి సేవ్‌ను బ్లాక్ చేయదు. ఇక్కడ సెట్ చేయడం ఈ ఉత్పత్తికి Break Bulk లో స్వయంచాలక సూచించిన పరిమాణాలు మరియు స్వయంచాలక వ్యర్థం ట్రాకింగ్‌ను అన్‌లాక్ చేస్తుంది.' },
    },
    sections: [
      {
        title: { en: 'Product vs PLU — the key distinction', te: 'ఉత్పత్తి vs PLU — ముఖ్యమైన తేడా' },
        body: {
          en: 'A Product is the master record (Tata Salt). PLUs are variants you actually stock and sell (Tata Salt 1kg, Tata Salt 500g, Tata Salt 2kg). Stock is tracked at PLU level. Billing searches products, then shows PLUs to choose from. Always create the product first, then add PLUs. A product with no PLUs cannot be billed.',
          te: 'ఉత్పత్తి మాస్టర్ రికార్డు (టాటా ఉప్పు). PLU లు మీరు వాస్తవంగా స్టాక్ చేసి అమ్మే వేరియంట్‌లు (టాటా ఉప్పు 1kg, 500g, 2kg). స్టాక్ PLU స్థాయిలో ట్రాక్ చేయబడుతుంది. బిల్లింగ్ ఉత్పత్తులను శోధిస్తుంది, తర్వాత ఎంచుకోవడానికి PLU లను చూపిస్తుంది. ఎల్లప్పుడూ ముందు ఉత్పత్తి సృష్టించండి, తర్వాత PLU లు జోడించండి. PLU లు లేని ఉత్పత్తి బిల్ చేయలేము.',
        },
      },
      {
        title: { en: 'Search and filter tips', te: 'శోధన మరియు ఫిల్టర్ చిట్కాలు' },
        body: {
          en: 'Search by product name, product code, barcode, or HSN code. Use the Category filter to browse a section. The "Low Stock" filter shows only items at or below reorder level — useful for daily ordering. Export button generates an Excel file of the current filtered view.',
          te: 'ఉత్పత్తి పేరు, కోడ్, బార్‌కోడ్ లేదా HSN కోడ్ ద్వారా శోధించండి. ఒక విభాగాన్ని బ్రౌజ్ చేయడానికి వర్గం ఫిల్టర్ ఉపయోగించండి. "తక్కువ స్టాక్" ఫిల్టర్ రీఆర్డర్ స్థాయికి లేదా దానికంటే తక్కువగా ఉన్న వస్తువులను మాత్రమే చూపిస్తుంది — రోజువారీ ఆర్డర్ చేయడానికి ఉపయోగకరం. ఎగుమతి బటన్ ప్రస్తుత ఫిల్టర్ వీక్షణ యొక్క Excel ఫైల్‌ను రూపొందిస్తుంది.',
        },
      },
    ],
    commonMistakes: [
      {
        mistake: { en: 'Wrong HSN code entered', te: 'తప్పు HSN కోడ్ నమోదు చేయడం' },
        fix: { en: 'HSN determines GST rate for e-filing. Verify on cbic-gst.gov.in or ask your CA. Common mistake: using 2106 (food preparations) when 1701 (sugar) is correct.', te: 'HSN ఇ-ఫైలింగ్ కోసం GST రేటు నిర్ణయిస్తుంది. cbic-gst.gov.in లో ధృవీకరించండి లేదా మీ CA ని అడగండి.' },
      },
      {
        mistake: { en: 'Product added but can\'t find it at POS', te: 'ఉత్పత్తి జోడించబడింది కానీ POS లో కనుగొనలేకపోవడం' },
        fix: { en: 'A product needs at least one active PLU with stock > 0 to appear in POS search. Create a PLU under this product and set opening stock.', te: 'POS శోధనలో కనిపించడానికి ఉత్పత్తికి కనీసం ఒక యాక్టివ్ PLU స్టాక్ > 0 తో అవసరం. ఈ ఉత్పత్తి కింద PLU సృష్టించి ఓపెనింగ్ స్టాక్ సెట్ చేయండి.' },
      },
    ],
    relatedTopics: ['plu', 'unit-management', 'grn', 'categories', 'hsn'],
    tags: ['products', 'catalog', 'hsn', 'gst', 'reorder'],
  },

  // ── PLU Management ─────────────────────────────────────────────────────────
  {
    id: 'plu', route: '/dashboard/products/[id]/plu', module: 'products', version: '2.5',
    title: { en: 'PLU Management', te: 'PLU నిర్వహణ' },
    summary: {
      en: 'A PLU (Price Look-Up) is a specific pack size or batch of a product. Each PLU has its own price, cost, stock count, barcode, and UOM settings. Stock is tracked at PLU level — one product can have many PLUs across different pack sizes or batch arrivals.',
      te: 'PLU (ప్రైస్ లుక్-అప్) ఒక ఉత్పత్తి యొక్క నిర్దిష్ట ప్యాక్ సైజు లేదా బ్యాచ్. ప్రతి PLU కి దాని సొంత ధర, ధర, స్టాక్ గణన, బార్‌కోడ్ మరియు UOM సెట్టింగ్‌లు ఉంటాయి. స్టాక్ PLU స్థాయిలో ట్రాక్ చేయబడుతుంది — ఒక ఉత్పత్తికి వేర్వేరు ప్యాక్ సైజులు లేదా బ్యాచ్ రాకల అంతటా అనేక PLU లు ఉండవచ్చు.',
    },
    fields: {
      'MRP': { en: 'Maximum Retail Price as printed on the pack. By law you cannot bill above MRP. Must always be ≥ Selling Price. Enter exactly as printed — do not add or subtract GST.', te: 'ప్యాక్‌పై ముద్రించిన గరిష్ట రిటైల్ ధర. చట్టం ప్రకారం మీరు MRP కంటే ఎక్కువ బిల్ చేయలేరు. అమ్మకపు ధర కంటే ఎల్లప్పుడూ ≥ అయి ఉండాలి. ముద్రించిన విధంగా సరిగ్గా నమోదు చేయండి.' },
      'Selling Price': { en: 'Price charged at the counter. Cannot exceed MRP. GST is calculated from this price — if Tax Inclusive is ON, GST is already inside this number. Example: SP=₹52.50, GST=5% → Tax Inclusive means ₹50 is taxable and ₹2.50 is GST.', te: 'కౌంటర్‌లో వసూలు చేసే ధర. MRP మించకూడదు. ఈ ధర నుండి GST లెక్కించబడుతుంది — Tax Inclusive ON అయితే, GST ఇప్పటికే ఈ సంఖ్యలో ఉంది. ఉదాహరణ: SP=₹52.50, GST=5% → Tax Inclusive అంటే ₹50 పన్ను విధించదగినది మరియు ₹2.50 GST.' },
      'Cost Price': { en: 'What you paid the supplier per unit (excluding GST). Used for margin calculations on the dashboard and reports. Updated automatically when a GRN is approved for this PLU.', te: 'మీరు సరఫరాదారుకు యూనిట్ కు చెల్లించినది (GST మినహా). డాష్‌బోర్డ్ మరియు రిపోర్టులలో మార్జిన్ లెక్కింపుల కోసం ఉపయోగించబడుతుంది. ఈ PLU కోసం GRN ఆమోదించబడినప్పుడు స్వయంచాలకంగా అప్‌డేట్ అవుతుంది.' },
      'Tax Inclusive': { en: 'ON = selling price already includes GST (standard for retail, packaged FMCG). OFF = GST is added on top at billing. MOST grocery items are Tax Inclusive — this matches how MRP is printed on packs.', te: 'ON = అమ్మకపు ధరలో ఇప్పటికే GST చేర్చబడింది (రిటైల్, ప్యాకేజ్డ్ FMCG కోసం ప్రమాణం). OFF = బిల్లింగ్ సమయంలో GST అదనంగా జోడించబడుతుంది. చాలా కిరాణా వస్తువులు Tax Inclusive — ఇది ప్యాక్‌లపై MRP ముద్రించిన విధానంతో సరిపోతుంది.' },
      'GST Rate': { en: 'Percentage — 0, 5, 12, 18, or 28. Inherited from the product by default but can be overridden per PLU. Affects GSTR-1 and GSTR-3B filing. Even exempt items must have 0%.', te: 'శాతం — 0, 5, 12, 18, లేదా 28. డిఫాల్ట్‌గా ఉత్పత్తి నుండి వారసత్వంగా వస్తుంది కానీ PLU కు అనుగుణంగా మార్చవచ్చు. GSTR-1 మరియు GSTR-3B ఫైలింగ్‌ను ప్రభావితం చేస్తుంది. మినహాయింపు పొందిన వస్తువులు కూడా 0% కలిగి ఉండాలి.' },
      'Cess Rate': { en: 'Additional cess on top of GST — used for tobacco, pan masala, aerated drinks. Leave 0 for normal grocery items.', te: 'GST పై అదనపు సెస్ — పొగాకు, పాన్ మసాలా, వాయు పానీయాలకు ఉపయోగించబడుతుంది. సాధారణ కిరాణా వస్తువులకు 0 వదిలేయండి.' },
      'Measure Type': { en: 'One of five government-recognised categories: Weight (sugar, rice, atta, dal), Volume (oil, milk, shampoo), Count (biscuit packs, bottles, soaps), or Length/Area (cloth, wire, tiles). Governs which Unit Symbols are available — see Unit Management for the full reference table of every unit and its GST UQC code.', te: 'ఐదు ప్రభుత్వ-గుర్తింపు పొందిన వర్గాలలో ఒకటి: Weight (చక్కెర, బియ్యం, ఆటా, పప్పు), Volume (నూనె, పాలు, షాంపూ), Count (బిస్కెట్ ప్యాక్‌లు, బాటిల్‌లు, సబ్బులు), లేదా Length/Area (గుడ్డ, తీగ, టైల్స్). ఏ యూనిట్ చిహ్నాలు అందుబాటులో ఉన్నాయో నిర్ణయిస్తుంది.' },
      'Unit Symbol': { en: 'The specific unit within the chosen Measure Type — e.g. kg/g/qtl/ton for Weight, ml/L/kl for Volume, pcs/doz/box/ctn/bag for Count. Every option is a real GST UQC code, not a shortcut list — sets the GST UQC automatically, needed for GSTR-1 and e-invoices. Select Measure Type first.', te: 'ఎంచుకున్న Measure Type లోపల నిర్దిష్ట యూనిట్ — ఉదా. Weight కి kg/g/qtl/ton, Volume కి ml/L/kl, Count కి pcs/doz/box/ctn/bag. ప్రతి ఎంపిక నిజమైన GST UQC కోడ్ — స్వయంచాలకంగా GST UQC సెట్ చేస్తుంది, GSTR-1 మరియు ఇ-ఇన్‌వాయిస్‌లకు అవసరం. ముందు Measure Type ఎంచుకోండి.' },
      'Pack Size': { en: 'Quantity in the chosen unit that one pack of this PLU contains. 50kg bag → 50. 500ml bottle → 500. 1 dozen eggs → 12 (with unit=doz, size=1) — dozen/pair/gross/thousand always convert as true fixed constants. Used by Break Bulk to auto-fill the bulk weight and track wastage.', te: 'ఈ PLU యొక్క ఒక ప్యాక్‌లో ఎంచుకున్న యూనిట్‌లో పరిమాణం. 50kg బ్యాగ్ → 50. 500ml బాటిల్ → 500. 1 డజన్ గుడ్లు → 12. dozen/pair/gross/thousand ఎల్లప్పుడూ నిజమైన స్థిర స్థిరాంకాలుగా మార్చబడతాయి. Break Bulk కోసం బల్క్ బరువును స్వయంచాలకంగా నింపి వ్యర్థాన్ని ట్రాక్ చేయడానికి ఉపయోగించబడుతుంది.' },
      'Base Qty': { en: 'Auto-calculated — always in the base unit (grams for Weight, ml for Volume, cm for Length, sq.cm for Area, pieces for Count). Pack Size 50 kg → Base Qty 50000 g. This is what Break Bulk uses internally to compute wastage. You never enter this directly.', te: 'స్వయంచాలకంగా లెక్కించబడుతుంది — ఎల్లప్పుడూ బేస్ యూనిట్‌లో (Weight కోసం గ్రాములు, Volume కోసం ml, Length కోసం cm, Area కోసం sq.cm, Count కోసం ముక్కలు). ప్యాక్ సైజు 50 kg → బేస్ qty 50000 g. ఇది Break Bulk వ్యర్థాన్ని లెక్కించడానికి అంతర్గతంగా ఉపయోగించేది. మీరు దీన్ని నేరుగా నమోదు చేయరు.' },
      'Loose / Weigh': { en: 'ON for counter loose items sold by weight at POS — e.g., loose sugar, loose rice scooped from a container. When scanned at POS, a weight popup opens instead of adding qty=1. The price is calculated as: Bill Qty = Grams entered ÷ Base Qty, Bill Amount = Bill Qty × Selling Price.', te: 'POS లో బరువు ద్వారా అమ్మే కౌంటర్ లూస్ వస్తువులకు ON — ఉదా. కంటైనర్ నుండి స్కూప్ చేసిన లూస్ చక్కెర, లూస్ బియ్యం. POS లో స్కాన్ చేసినప్పుడు, qty=1 జోడించడానికి బదులుగా బరువు పాప్‌అప్ తెరుచుకుంటుంది.' },
      'EAN / Barcode': { en: 'The barcode printed on the pack — scan it here to register. Once set, scanning this barcode at POS adds the item instantly. If the pack has no barcode, leave blank and use product name search at POS.', te: 'ప్యాక్‌పై ముద్రించిన బార్‌కోడ్ — నమోదు చేయడానికి ఇక్కడ స్కాన్ చేయండి. సెట్ చేసిన తర్వాత, POS లో ఈ బార్‌కోడ్ స్కాన్ చేయడం వస్తువును తక్షణం జోడిస్తుంది. ప్యాక్‌కు బార్‌కోడ్ లేకపోతే, ఖాళీగా వదిలి POS లో ఉత్పత్తి పేరు శోధన ఉపయోగించండి.' },
      'Opening Stock': { en: 'Physical count of this PLU on your shelf right now — enter when creating a new PLU. After the first GRN is approved, stock is maintained automatically by the system. Re-entering here after setup will create a discrepancy.', te: 'ఇప్పుడు మీ షెల్ఫ్‌లో ఈ PLU యొక్క శారీరక గణన — కొత్త PLU సృష్టించేటప్పుడు నమోదు చేయండి. మొదటి GRN ఆమోదించిన తర్వాత, సిస్టమ్ స్వయంచాలకంగా స్టాక్‌ను నిర్వహిస్తుంది.' },
    },
    sections: [
      {
        title: { en: 'GST calculation at POS — Tax Inclusive', te: 'POS లో GST లెక్కింపు — Tax Inclusive' },
        body: {
          en: 'For Tax Inclusive items (most retail grocery): GST Amount = Selling Price × GST Rate ÷ (100 + GST Rate). Taxable Amount = Selling Price − GST Amount. CGST = SGST = GST Amount ÷ 2. Example: SP=₹105, GST=5%. GST = 105×5÷105 = ₹5. Taxable = ₹100. CGST = ₹2.50, SGST = ₹2.50. The bill shows ₹105 to the customer; the GST report shows ₹5 output GST.',
          te: 'Tax Inclusive వస్తువులకు (చాలా రిటైల్ కిరాణా): GST మొత్తం = అమ్మకపు ధర × GST రేటు ÷ (100 + GST రేటు). పన్ను విధించదగిన మొత్తం = అమ్మకపు ధర − GST మొత్తం. CGST = SGST = GST మొత్తం ÷ 2. ఉదాహరణ: SP=₹105, GST=5%. GST = 105×5÷105 = ₹5. పన్ను విధించదగినది = ₹100. CGST = ₹2.50, SGST = ₹2.50.',
        },
      },
      {
        title: { en: 'When to create multiple PLUs for one product', te: 'ఒక ఉత్పత్తికి అనేక PLU లు ఎప్పుడు సృష్టించాలి' },
        body: {
          en: 'Create a new PLU when: (1) Different pack size arrives — Sugar 1kg and Sugar 5kg are separate PLUs. (2) New batch at a different cost price — the new GRN auto-creates a new PLU with the new cost. (3) Different selling price for wholesale vs retail. Stock tracks independently per PLU so margins stay accurate batch by batch.',
          te: 'కొత్త PLU సృష్టించండి: (1) వేరే ప్యాక్ సైజు వచ్చినప్పుడు — చక్కెర 1kg మరియు 5kg వేర్వేరు PLU లు. (2) వేరే ధరలో కొత్త బ్యాచ్ — కొత్త GRN స్వయంచాలకంగా కొత్త ధరతో కొత్త PLU సృష్టిస్తుంది. (3) హోల్‌సేల్ vs రిటైల్‌కు వేరే అమ్మకపు ధర. స్టాక్ PLU కు స్వతంత్రంగా ట్రాక్ చేస్తుంది కాబట్టి మార్జిన్‌లు బ్యాచ్ వారీగా ఖచ్చితంగా ఉంటాయి.',
        },
      },
      {
        title: { en: 'Default PLU (★) and the online store', te: 'డిఫాల్ట్ PLU (★) మరియు ఆన్‌లైన్ స్టోర్' },
        body: {
          en: 'The ★ PLU is the one shown on your online storefront and used when a customer searches by product name. When a new GRN is approved, the new PLU becomes default automatically. Change default anytime using the ★ toggle. Only the default PLU\'s price syncs to the product master.',
          te: '★ PLU మీ ఆన్‌లైన్ స్టోర్‌ఫ్రంట్‌లో చూపబడేది మరియు కస్టమర్ ఉత్పత్తి పేరు ద్వారా శోధించినప్పుడు ఉపయోగించబడేది. కొత్త GRN ఆమోదించబడినప్పుడు, కొత్త PLU స్వయంచాలకంగా డిఫాల్ట్ అవుతుంది. ★ టోగుల్ ఉపయోగించి ఎప్పుడైనా డిఫాల్ట్ మార్చండి.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Selling Price set higher than MRP', te: 'అమ్మకపు ధర MRP కంటే ఎక్కువగా సెట్ చేయడం' }, fix: { en: 'Legal violation. Set SP ≤ MRP always. Offer discounts by reducing SP, not by inflating MRP.', te: 'చట్టపరమైన ఉల్లంఘన. SP ≤ MRP ఎల్లప్పుడూ సెట్ చేయండి.' } },
      { mistake: { en: 'UOM fields left blank for weighable items', te: 'తూకం వేయగల వస్తువులకు UOM ఫీల్డ్‌లు ఖాళీగా వదిలేయడం' }, fix: { en: 'Set Measure Type, Unit, and Pack Size for all sugar, rice, atta, oil, dal items. Without these, Break Bulk cannot auto-fill the weight and GST UQC is wrong for annual returns.', te: 'అన్ని చక్కెర, బియ్యం, ఆటా, నూనె, పప్పు వస్తువులకు Measure Type, Unit మరియు Pack Size సెట్ చేయండి.' } },
      { mistake: { en: 'GST Rate not set', te: 'GST రేటు సెట్ చేయకపోవడం' }, fix: { en: 'Even 0% exempt items must have GST Rate = 0. Blank rate causes items to appear under "Unknown" in GST reports and can trigger filing discrepancies.', te: '0% మినహాయింపు వస్తువులు కూడా GST రేటు = 0 కలిగి ఉండాలి. ఖాళీ రేటు వస్తువులు GST రిపోర్టులలో "తెలియదు" కింద కనిపించేలా చేస్తుంది.' } },
    ],
    relatedTopics: ['break-bulk', 'unit-management', 'grn', 'products'],
    tags: ['plu', 'price', 'mrp', 'stock', 'uom', 'gst', 'barcode'],
  },

  // ── GRN — List ─────────────────────────────────────────────────────────────
  {
    id: 'grn', route: '/dashboard/grn', module: 'purchasing', version: '2.1',
    title: { en: 'Goods Receipt Notes (GRN)', te: 'వస్తువుల రసీదు నోట్‌లు (GRN)' },
    summary: {
      en: 'Every stock inward movement is recorded as a GRN. A GRN captures the supplier invoice, quantities, cost prices, and GST. Approving a GRN adds stock and creates a payable. This list shows all GRNs — filter by status, supplier, or date.',
      te: 'ప్రతి స్టాక్ ఇన్‌వార్డ్ కదలిక GRN గా నమోదు చేయబడుతుంది. GRN సరఫరాదారు ఇన్‌వాయిస్, పరిమాణాలు, ధర ధరలు మరియు GST ను క్యాప్చర్ చేస్తుంది. GRN ఆమోదించడం స్టాక్ జోడిస్తుంది మరియు చెల్లించాల్సిన మొత్తం సృష్టిస్తుంది. ఈ జాబితా అన్ని GRN లను చూపిస్తుంది — స్థితి, సరఫరాదారు లేదా తేదీ ద్వారా ఫిల్టర్ చేయండి.',
    },
    sections: [
      {
        title: { en: 'GRN status workflow', te: 'GRN స్థితి వర్క్‌ఫ్లో' },
        body: {
          en: 'DRAFT → entry saved, no stock impact yet. PENDING_APPROVAL → created from PO, awaiting verification. APPROVED → stock added, payable created, locked. REJECTED → rejected at approval, can be re-submitted. CANCELLED → voided, no stock impact. Only DRAFT and PENDING_APPROVAL can be edited. Once APPROVED, an approved GRN itself is never edited — use the Return or CN button on that GRN\'s row instead (see "Return vs Credit Note" below).',
          te: 'DRAFT → ఎంట్రీ సేవ్ చేయబడింది, ఇంకా స్టాక్ ప్రభావం లేదు. PENDING_APPROVAL → PO నుండి సృష్టించబడింది, ధృవీకరణ కోసం వేచి ఉంది. APPROVED → స్టాక్ జోడించబడింది, చెల్లించాల్సిన మొత్తం సృష్టించబడింది, లాక్. REJECTED → ఆమోదం వద్ద తిరస్కరించబడింది, మళ్ళీ సమర్పించవచ్చు. CANCELLED → రద్దు, స్టాక్ ప్రభావం లేదు. DRAFT మరియు PENDING_APPROVAL మాత్రమే సవరించవచ్చు. APPROVED అయిన తర్వాత GRN నే నేరుగా సవరించరు — బదులుగా ఆ GRN వరుసలోని Return లేదా CN బటన్ ఉపయోగించండి (కింద "Return vs Credit Note" చూడండి).',
        },
      },
      {
        title: { en: 'Creating a GRN from a Purchase Order', te: 'కొనుగోలు ఆర్డర్ నుండి GRN సృష్టించడం' },
        body: {
          en: 'Fastest path: open the PO → click "Receive Goods → GRN". Items and quantities are pre-filled. Enter the supplier invoice number and date, then click Create GRN. The GRN opens in PENDING_APPROVAL status. Review quantities and costs, then Approve to update stock. You can adjust any line before approving.',
          te: 'వేగవంతమైన మార్గం: PO తెరవండి → "వస్తువులు స్వీకరించు → GRN" క్లిక్ చేయండి. వస్తువులు మరియు పరిమాణాలు ముందే నిండి ఉంటాయి. సరఫరాదారు ఇన్‌వాయిస్ నంబర్ మరియు తేదీ నమోదు చేయండి, తర్వాత GRN సృష్టించు క్లిక్ చేయండి. GRN PENDING_APPROVAL స్థితిలో తెరుచుకుంటుంది. పరిమాణాలు మరియు ధరలు సమీక్షించండి, తర్వాత స్టాక్ అప్‌డేట్ చేయడానికి ఆమోదించండి.',
        },
      },
      {
        title: { en: 'Return vs Credit Note — which button to use', te: 'Return vs Credit Note — ఏ బటన్ ఉపయోగించాలి' },
        body: {
          en: 'Each GRN row has two buttons for handling problems found after receiving. Return (a Debit Note) — use this when you are physically sending goods back to the supplier: damaged, expired, the wrong item, or a shortfall. You pick the exact product and quantity, and it reduces what you owe the supplier. Credit Note (CN) — use this when the supplier is giving money back but nothing is physically being returned: a scheme discount, a volume rebate, or a correction to the rate they charged. Tip: if you marked "Rejected Qty" on a line while receiving the GRN, the Return button automatically fills in those items for you — just double-check the numbers before submitting.',
          te: 'ప్రతి GRN వరుసలో స్వీకరించిన తర్వాత కనిపెట్టిన సమస్యలను నిర్వహించడానికి రెండు బటన్‌లు ఉంటాయి. Return (Debit Note) — సరఫరాదారుకు వస్తువులు శారీరకంగా తిరిగి పంపుతున్నప్పుడు దీన్ని ఉపయోగించండి: దెబ్బతిన్నవి, గడువు ముగిసినవి, తప్పు వస్తువు, లేదా తక్కువ సరఫరా. మీరు ఖచ్చితమైన వస్తువు మరియు పరిమాణం ఎంచుకుంటారు, ఇది సరఫరాదారుకు మీరు బాకీ ఉన్న మొత్తాన్ని తగ్గిస్తుంది. Credit Note (CN) — సరఫరాదారు డబ్బు తిరిగి ఇస్తున్నప్పుడు కానీ ఏమీ శారీరకంగా తిరిగి పంపనప్పుడు దీన్ని ఉపయోగించండి: స్కీమ్ డిస్కౌంట్, వాల్యూమ్ రిబేట్, లేదా వసూలు చేసిన రేటుకు సవరణ. చిట్కా: GRN స్వీకరించేటప్పుడు ఒక లైన్‌పై "Rejected Qty" గుర్తు పెడితే, తర్వాత Return బటన్ క్లిక్ చేసినప్పుడు ఆ వస్తువులు స్వయంచాలకంగా నింపబడతాయి — సమర్పించే ముందు సంఖ్యలు మాత్రం మళ్ళీ తనిఖీ చేయండి.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Recording a scheme or rebate credit as a Return', te: 'స్కీమ్ లేదా రిబేట్ క్రెడిట్‌ను Return గా నమోదు చేయడం' }, fix: { en: 'A Return should only be used when real goods are physically going back to the supplier. For discounts, schemes, or rate corrections with no goods movement, use Credit Note (CN) instead — Return expects item-level quantities, CN does not.', te: 'Return ను నిజమైన వస్తువులు శారీరకంగా సరఫరాదారుకు తిరిగి వెళ్తున్నప్పుడు మాత్రమే ఉపయోగించాలి. వస్తువుల కదలిక లేని డిస్కౌంట్లు, స్కీమ్‌లు, లేదా రేటు సవరణలకు బదులుగా Credit Note (CN) ఉపయోగించండి.' } },
    ],
    relatedTopics: ['grn-new', 'purchase-orders', 'suppliers', 'debit-notes', 'credit-notes', 'plu'],
    tags: ['grn', 'stock', 'receipt', 'supplier', 'purchase', 'approval', 'return', 'debit-note', 'credit-note'],
  },

  // ── GRN — New Entry ────────────────────────────────────────────────────────
  {
    id: 'grn-new', route: '/dashboard/grn/new', module: 'purchasing', version: '2.0',
    title: { en: 'New GRN — Stock Entry', te: 'కొత్త GRN — స్టాక్ ఎంట్రీ' },
    summary: {
      en: 'Create a GRN when goods arrive directly (no Purchase Order). Enter the supplier invoice details, then add each line item with quantity, cost, and GST. Save as Draft, verify physically, then Approve to push stock into the system.',
      te: 'వస్తువులు నేరుగా వచ్చినప్పుడు GRN సృష్టించండి (కొనుగోలు ఆర్డర్ లేకుండా). సరఫరాదారు ఇన్‌వాయిస్ వివరాలు నమోదు చేయండి, తర్వాత ప్రతి లైన్ వస్తువుకు పరిమాణం, ధర మరియు GST జోడించండి. డ్రాఫ్ట్‌గా సేవ్ చేయండి, శారీరకంగా ధృవీకరించండి, తర్వాత సిస్టమ్‌లో స్టాక్ పుష్ చేయడానికి ఆమోదించండి.',
    },
    fields: {
      'Supplier': { en: 'Select from your supplier master. The supplier\'s GSTIN determines intra/inter-state GST. If the supplier is not in the list, create them in Suppliers first.', te: 'మీ సరఫరాదారు మాస్టర్ నుండి ఎంచుకోండి. సరఫరాదారు GSTIN అంతర/అంతర్ రాష్ట్ర GST నిర్ణయిస్తుంది. సరఫరాదారు జాబితాలో లేకపోతే, ముందు సరఫరాదారులలో వారిని సృష్టించండి.' },
      'Invoice Number': { en: 'The supplier\'s invoice number — exactly as printed on their bill. Duplicate invoice numbers for the same supplier are blocked. This is your ITC claim reference.', te: 'సరఫరాదారు ఇన్‌వాయిస్ నంబర్ — వారి బిల్‌లో ముద్రించిన విధంగా సరిగ్గా. అదే సరఫరాదారుకు నకలు ఇన్‌వాయిస్ నంబర్లు బ్లాక్ చేయబడతాయి. ఇది మీ ITC క్లెయిమ్ రిఫరెన్స్.' },
      'Invoice Date': { en: 'Date on the supplier\'s bill — not today\'s date unless they match. GST return filing uses this date to determine the return period.', te: 'సరఫరాదారు బిల్‌లోని తేదీ — అవి సరిపోనంత వరకు ఈరోజు తేదీ కాదు. GST రిటర్న్ ఫైలింగ్ రిటర్న్ వ్యవధి నిర్ణయించడానికి ఈ తేదీ ఉపయోగిస్తుంది.' },
      'Tax Type': { en: 'TAX_EXCLUSIVE (most purchases): cost price excludes GST; system adds tax on top. TAX_INCLUSIVE: supplier invoice price already includes GST; system extracts it. Check your invoice — if it shows "Base Value" + "GST Amount" separately, use TAX_EXCLUSIVE.', te: 'TAX_EXCLUSIVE (చాలా కొనుగోళ్ళు): ధర ధరలో GST చేర్చబడలేదు; సిస్టమ్ పైన పన్ను జోడిస్తుంది. TAX_INCLUSIVE: సరఫరాదారు ఇన్‌వాయిస్ ధరలో ఇప్పటికే GST చేర్చబడింది; సిస్టమ్ దాన్ని వేరుచేస్తుంది.' },
      'ITC Eligibility': { en: 'ELIGIBLE: you can claim this GST as input credit (reduces your GST payable). INELIGIBLE: blocked credit — for items used personally or for exempted supplies. PARTIAL: mixed use. Set ELIGIBLE for all trading stock purchases.', te: 'ELIGIBLE: మీరు ఈ GST ని ఇన్‌పుట్ క్రెడిట్‌గా క్లెయిమ్ చేయవచ్చు (మీ GST చెల్లించాల్సిన మొత్తాన్ని తగ్గిస్తుంది). INELIGIBLE: బ్లాక్డ్ క్రెడిట్ — వ్యక్తిగతంగా ఉపయోగించే లేదా మినహాయింపు సరఫరాలకు. అన్ని ట్రేడింగ్ స్టాక్ కొనుగోళ్ళకు ELIGIBLE సెట్ చేయండి.' },
      'Discount %': { en: 'Line-level discount applied to the quantity × unit price before GST. Example: Unit Price=₹100, Qty=10, Disc=5% → Taxable = ₹100×10×0.95 = ₹950 (not ₹1000). Enter 0 if no discount.', te: 'GST కంటే ముందు పరిమాణం × యూనిట్ ధరకు వర్తించే లైన్-స్థాయి తగ్గింపు. ఉదాహరణ: యూనిట్ ధర=₹100, qty=10, తగ్గింపు=5% → పన్ను విధించదగినది = ₹950.' },
      'Free Quantity': { en: 'Gratis/bonus units from the supplier — e.g., "Buy 10 get 1 free". Free qty is received into stock at zero cost. The batch cost per unit is diluted across total received qty.', te: 'సరఫరాదారు నుండి ఉచిత/బోనస్ యూనిట్‌లు — ఉదా. "10 కొనండి 1 ఉచితంగా పొందండి". ఉచిత qty జీరో ధరలో స్టాక్‌లో స్వీకరించబడుతుంది.' },
      'Freight / Hamali': { en: 'Transport and loading charges to add to the purchase cost. These are apportioned across all line items proportionally to increase the landed cost. Freight GST (usually 5% or 18%) is tracked separately.', te: 'కొనుగోలు ధరకు జోడించడానికి రవాణా మరియు లోడింగ్ చార్జీలు. ల్యాండెడ్ కాస్ట్ పెంచడానికి ఇవి అన్ని లైన్ వస్తువుల అంతటా అనుపాతంలో పంపిణీ చేయబడతాయి.' },
    },
    sections: [
      {
        title: { en: 'TAX_EXCLUSIVE calculation — step by step', te: 'TAX_EXCLUSIVE లెక్కింపు — దశల వారీగా' },
        body: {
          en: 'For each line: 1) Taxable Amount = Unit Price × Qty × (1 − Discount%/100). 2) If intra-state: CGST = Taxable × GST Rate/200; SGST = same. IGST = 0. 3) If inter-state: IGST = Taxable × GST Rate/100. CGST = SGST = 0. 4) Line Total = Taxable + CGST + SGST + IGST. Example: 50kg sugar at ₹38/kg, 5% GST, intra-state. Taxable=₹1900. CGST=₹47.50, SGST=₹47.50. Line Total=₹1995.',
          te: 'ప్రతి లైన్‌కు: 1) పన్ను విధించదగిన మొత్తం = యూనిట్ ధర × qty × (1 − తగ్గింపు%/100). 2) అంతర్ రాష్ట్రమైతే: CGST = పన్ను విధించదగినది × GST రేటు/200; SGST = అదే. 3) అంతర్ రాష్ట్రమైతే: IGST = పన్ను విధించదగినది × GST రేటు/100. 4) లైన్ మొత్తం = పన్ను విధించదగినది + CGST + SGST + IGST. ఉదాహరణ: 50kg చక్కెర ₹38/kg, 5% GST. పన్ను విధించదగినది=₹1900. CGST=₹47.50, SGST=₹47.50. లైన్ మొత్తం=₹1995.',
        },
      },
      {
        title: { en: 'Intra-state vs Inter-state — how it\'s determined', te: 'అంతర్-రాష్ట్ర vs అంతరాష్ట్ర — ఎలా నిర్ణయించబడుతుంది' },
        body: {
          en: 'The system compares your business state code (from Settings → Business) with the first 2 digits of the supplier\'s GSTIN. Same state → Intra-state (CGST + SGST). Different state → Inter-state (IGST only). Example: Andhra Pradesh is state code 37. If supplier GSTIN starts with "37", intra-state. If it starts with "36" (Telangana) or any other code, inter-state.',
          te: 'సిస్టమ్ మీ వ్యాపార రాష్ట్ర కోడ్‌ను (సెట్టింగ్‌లు → వ్యాపారం నుండి) సరఫరాదారు GSTIN యొక్క మొదటి 2 అంకెలతో పోల్చుతుంది. అదే రాష్ట్రం → అంతర్-రాష్ట్ర (CGST + SGST). వేరే రాష్ట్రం → అంతరాష్ట్ర (IGST మాత్రమే). ఉదాహరణ: ఆంధ్రప్రదేశ్ స్టేట్ కోడ్ 37. సరఫరాదారు GSTIN "37" తో మొదలైతే అంతర్-రాష్ట్ర.',
        },
      },
      {
        title: { en: 'New PLU created on every GRN approval', te: 'ప్రతి GRN ఆమోదంలో కొత్త PLU సృష్టించబడుతుంది' },
        body: {
          en: 'When you approve a GRN line, if a PLU with that exact cost price already exists, stock is added to it. If the cost price is different (new batch), a new PLU is created automatically and set as the default. Old PLUs remain active until their stock is exhausted. This gives you batch-level cost tracking without any manual work.',
          te: 'మీరు GRN లైన్ ఆమోదించినప్పుడు, ఆ ఖచ్చితమైన ధర ధరతో PLU ఇప్పటికే ఉంటే, దానికి స్టాక్ జోడించబడుతుంది. ధర ధర వేరేగా ఉంటే (కొత్త బ్యాచ్), కొత్త PLU స్వయంచాలకంగా సృష్టించబడి డిఫాల్ట్‌గా సెట్ చేయబడుతుంది. పాత PLU లు వాటి స్టాక్ అయిపోయే వరకు యాక్టివ్‌గా ఉంటాయి.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Wrong invoice date — entered today instead of supplier\'s date', te: 'తప్పు ఇన్‌వాయిస్ తేదీ — సరఫరాదారు తేదీకి బదులు ఈరోజు తేదీ నమోదు చేయడం' }, fix: { en: 'Always use the date printed on the supplier\'s physical invoice. GST return periods are based on invoice date, not receipt date.', te: 'ఎల్లప్పుడూ సరఫరాదారు శారీరక ఇన్‌వాయిస్‌పై ముద్రించిన తేదీ ఉపయోగించండి. GST రిటర్న్ వ్యవధులు ఇన్‌వాయిస్ తేదీపై ఆధారపడతాయి, స్వీకరణ తేదీపై కాదు.' } },
      { mistake: { en: 'Approving GRN without checking physical stock', te: 'శారీరక స్టాక్ తనిఖీ చేయకుండా GRN ఆమోదించడం' }, fix: { en: 'Save as Draft first. Count the physical goods. Only approve after the physical count matches the GRN quantities. Approved GRNs cannot be reversed.', te: 'ముందు డ్రాఫ్ట్‌గా సేవ్ చేయండి. శారీరక వస్తువులు లెక్కించండి. శారీరక గణన GRN పరిమాణాలతో సరిపోయిన తర్వాత మాత్రమే ఆమోదించండి. ఆమోదించిన GRN లను రద్దు చేయలేరు.' } },
    ],
    relatedTopics: ['grn', 'purchase-orders', 'suppliers', 'plu'],
    tags: ['grn', 'stock', 'receipt', 'gst', 'invoice', 'itc'],
  },

  // ── Break Bulk ─────────────────────────────────────────────────────────────
  {
    id: 'break-bulk', route: '/dashboard/inventory/break-bulk', module: 'inventory', version: '3.0',
    title: { en: 'Break Bulk', te: 'బ్రేక్ బల్క్' },
    summary: {
      en: 'Split a bulk item (a 50kg sugar bag, a carton of soap) into the smaller retail packs you actually sell. Stock moves from the source (bulk) PLU to one or more output (retail) PLUs in one session — one simple 3-step flow for every kind of break, weighable or countable.',
      te: 'ఒక బల్క్ వస్తువును (50kg చక్కెర బ్యాగ్, సబ్బు కార్టన్) మీరు నిజంగా అమ్మే చిన్న రిటైల్ ప్యాక్‌లుగా విభజించండి. స్టాక్ మూల (బల్క్) PLU నుండి ఒకటి లేదా అంతకంటే ఎక్కువ అవుట్‌పుట్ (రిటైల్) PLU లకు ఒకే సెషన్‌లో తరలుతుంది — తూకం వేయగలిగినా, లెక్కించదగినా, ప్రతి రకమైన బ్రేక్‌కు ఒకే సాధారణ 3-దశల ప్రవాహం.',
    },
    sections: [
      {
        title: { en: 'The 3-step flow', te: '3-దశల ప్రవాహం' },
        body: {
          en: 'Step 1 (Search): find the bulk item by name, PLU code or barcode — or use Quick Pick if you\'ve broken this exact pair before, it loads both source and target in one click. Step 2 (Lines): enter how many bulk units you\'re opening (usually 1), then add each retail pack you produced and how many you got. Step 3 (Confirm): review the balance, add an optional wastage reason, and Commit. Stock moves atomically — the bulk PLU goes down, every pack PLU goes up, in a single transaction.',
          te: 'దశ 1 (శోధన): బల్క్ వస్తువును పేరు, PLU కోడ్ లేదా బార్‌కోడ్ ద్వారా కనుగొనండి — లేదా మీరు ఇంతకుముందు ఈ ఖచ్చితమైన జతను విరగ్గొట్టి ఉంటే Quick Pick ఉపయోగించండి, అది ఒకే క్లిక్‌లో మూలం మరియు లక్ష్యం రెండింటినీ లోడ్ చేస్తుంది. దశ 2 (లైన్‌లు): మీరు ఎన్ని బల్క్ యూనిట్‌లు తెరుస్తున్నారో నమోదు చేయండి (సాధారణంగా 1), తర్వాత మీరు ఉత్పత్తి చేసిన ప్రతి రిటైల్ ప్యాక్ మరియు ఎంత వచ్చిందో జోడించండి. దశ 3 (నిర్ధారణ): బ్యాలెన్స్ సమీక్షించి, ఐచ్ఛిక వ్యర్థం కారణం జోడించి, Commit చేయండి. స్టాక్ ఒకే లావాదేవీలో కదులుతుంది — బల్క్ PLU తగ్గుతుంది, ప్రతి ప్యాక్ PLU పెరుగుతుంది.',
        },
      },
      {
        title: { en: 'Auto-suggested quantities and automatic wastage', te: 'స్వయంచాలక సూచించిన పరిమాణాలు మరియు స్వయంచాలక వ్యర్థం' },
        body: {
          en: 'This only works when BOTH the source and the target PLU have a unit size set (Measure Type + Unit Symbol + Pack Size, in PLU Management or Unit Management). When they do, Step 2 auto-fills each pack\'s quantity from the remaining balance (always editable), and Step 3 shows a live Opened / Packed / Wastage card computed in the item\'s own base unit — grams for weight, ml for volume, pieces for count. Wastage is just what\'s left over: Opened − Packed. No manual balancing.',
          te: 'ఇది మూలం మరియు లక్ష్యం PLU రెండింటికీ యూనిట్ సైజు సెట్ చేసినప్పుడు మాత్రమే పని చేస్తుంది (Measure Type + Unit Symbol + Pack Size, PLU Management లేదా Unit Management లో). అలా అయితే, దశ 2 మిగిలిన బ్యాలెన్స్ నుండి ప్రతి ప్యాక్ పరిమాణాన్ని స్వయంచాలకంగా నింపుతుంది (ఎల్లప్పుడూ సవరించదగినది), మరియు దశ 3 వస్తువు యొక్క సొంత బేస్ యూనిట్‌లో లెక్కించిన లైవ్ Opened / Packed / Wastage కార్డు చూపిస్తుంది — బరువుకు గ్రాములు, ఘనపరిమాణానికి ml, లెక్కకు ముక్కలు. వ్యర్థం అంటే మిగిలింది: Opened − Packed. మాన్యువల్ బ్యాలెన్సింగ్ అవసరం లేదు.',
        },
      },
      {
        title: { en: 'When a unit isn\'t set yet', te: 'యూనిట్ ఇంకా సెట్ చేయనప్పుడు' },
        body: {
          en: 'You can still commit a session even if the source or target has no unit size — Step 3 shows an amber notice instead of the balance card, with a "Fix unit for X →" link that jumps straight to that product\'s PLU page. Set the unit there (Measure Type → Unit Symbol → Size, takes a few seconds), come back, and re-enter the same numbers to get the automatic balance. You only have to do this once per bulk/pack pair — it\'s remembered forever after.',
          te: 'మూలం లేదా లక్ష్యానికి యూనిట్ సైజు లేకపోయినా మీరు ఇంకా సెషన్ commit చేయవచ్చు — దశ 3 బ్యాలెన్స్ కార్డుకు బదులుగా అంబర్ నోటీసు చూపిస్తుంది, "Fix unit for X →" లింక్‌తో అది నేరుగా ఆ ఉత్పత్తి PLU పేజీకి తీసుకెళుతుంది. అక్కడ యూనిట్ సెట్ చేయండి (Measure Type → Unit Symbol → Size, కొన్ని సెకన్లు పడుతుంది), తిరిగి వచ్చి, అదే సంఖ్యలు మళ్ళీ నమోదు చేసి స్వయంచాలక బ్యాలెన్స్ పొందండి. ప్రతి బల్క్/ప్యాక్ జతకు ఇది ఒక్కసారి మాత్రమే చేయాలి — తర్వాత ఎప్పటికీ గుర్తుంచుకోబడుతుంది.',
        },
      },
      {
        title: { en: 'Reversing a session', te: 'సెషన్ రివర్స్ చేయడం' },
        body: {
          en: 'Open the History tab → find the session → click Reverse. All stock movements are undone. Reversal is only allowed if none of the output stock from that session has been sold. If partial sales occurred, the system will warn you — you must manually adjust the remaining qty instead.',
          te: 'హిస్టరీ ట్యాబ్ తెరవండి → సెషన్ కనుగొనండి → రివర్స్ క్లిక్ చేయండి. అన్ని స్టాక్ కదలికలు రద్దు చేయబడతాయి. ఆ సెషన్ నుండి అవుట్‌పుట్ స్టాక్ ఏదీ అమ్మబడకపోతే మాత్రమే రివర్సల్ అనుమతించబడుతుంది. పాక్షిక అమ్మకాలు జరిగితే, సిస్టమ్ మిమ్మల్ని హెచ్చరిస్తుంది — బదులుగా మీరు మిగిలిన qty మాన్యువల్‌గా సర్దుబాటు చేయాలి.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Output exceeds what was opened', te: 'తెరిచిన దాని కంటే అవుట్‌పుట్ ఎక్కువ' }, fix: { en: 'Total packed quantity cannot exceed the opened quantity — Step 3 blocks Commit and shows "Output exceeds what was opened" in red. Go back to Step 2 and reduce a pack quantity.', te: 'మొత్తం ప్యాక్ చేసిన పరిమాణం తెరిచిన పరిమాణాన్ని మించకూడదు — దశ 3 Commit ను బ్లాక్ చేసి ఎరుపు రంగులో హెచ్చరిక చూపిస్తుంది. దశ 2కు వెళ్లి ప్యాక్ పరిమాణం తగ్గించండి.' } },
      { mistake: { en: 'Breaking without stock in the source PLU', te: 'మూల PLU లో స్టాక్ లేకుండా విరగ్గొట్టడం' }, fix: { en: 'Receive the bulk goods via GRN first, approve the GRN, then break bulk. The system blocks sessions where the opened quantity exceeds available stock.', te: 'ముందు GRN ద్వారా బల్క్ వస్తువులు స్వీకరించండి, GRN ఆమోదించండి, తర్వాత బ్రేక్ బల్క్ చేయండి. తెరిచిన పరిమాణం అందుబాటులో ఉన్న స్టాక్‌ను మించే సెషన్‌లను సిస్టమ్ బ్లాక్ చేస్తుంది.' } },
      { mistake: { en: 'Expecting auto-wastage without setting units first', te: 'ముందుగా యూనిట్‌లు సెట్ చేయకుండా ఆటో-వ్యర్థం ఆశించడం' }, fix: { en: 'Wastage only auto-computes when both PLUs have a unit size. If you break the same bulk/pack pair often, set the units once via Unit Management and every future session for that pair gets automatic tracking for free.', te: 'రెండు PLU లకు యూనిట్ సైజు ఉన్నప్పుడు మాత్రమే వ్యర్థం స్వయంచాలకంగా లెక్కించబడుతుంది. మీరు తరచుగా అదే బల్క్/ప్యాక్ జతను విరగ్గొడితే, Unit Management ద్వారా ఒకసారి యూనిట్‌లు సెట్ చేయండి, ఆ జతకు భవిష్యత్తు సెషన్‌లన్నీ ఉచితంగా స్వయంచాలక ట్రాకింగ్ పొందుతాయి.' } },
    ],
    relatedTopics: ['plu', 'unit-management', 'grn', 'products'],
    tags: ['break-bulk', 'stock', 'repack', 'wastage', 'unit-management', 'uqc'],
  },

  // ── Unit Management ────────────────────────────────────────────────────────
  {
    id: 'unit-management', route: '/dashboard/products/unit-management', module: 'products', version: '1.0',
    title: { en: 'Unit Management', te: 'యూనిట్ నిర్వహణ' },
    summary: {
      en: 'A single audit-and-bulk-edit screen for the unit-of-measure (Measure Type, Unit Symbol, Pack Size, GST UQC) that every PLU should have. Grounded in two Indian government standards, not invented ad hoc: the full GST UQC (Unit Quantity Code) list required on GST returns, and the Legal Metrology Act\'s rules on what can be declared as net quantity. This is where you find PLUs missing units and fix many at once — nothing here is mandatory, and nothing you do here ever blocks a sale, a GRN, or a product save.',
      te: 'ప్రతి PLU కి ఉండవలసిన కొలత యూనిట్ (Measure Type, Unit Symbol, Pack Size, GST UQC) కోసం ఒకే ఆడిట్-అండ్-బల్క్-ఎడిట్ స్క్రీన్. రెండు భారత ప్రభుత్వ ప్రమాణాలలో ఆధారపడింది, తాత్కాలికంగా కనిపెట్టినది కాదు: GST రిటర్న్‌లపై అవసరమైన పూర్తి GST UQC (యూనిట్ పరిమాణ కోడ్) జాబితా, మరియు నికర పరిమాణంగా ఏమి ప్రకటించవచ్చో లీగల్ మెట్రాలజీ చట్టం నియమాలు. యూనిట్‌లు లేని PLU లను కనుగొని చాలా వాటిని ఒకేసారి సరిచేయడానికి ఇది స్థలం — ఇక్కడ ఏదీ తప్పనిసరి కాదు, మరియు మీరు ఇక్కడ చేసేది ఎప్పుడూ అమ్మకాన్ని, GRN ను, లేదా ఉత్పత్తి సేవ్‌ను బ్లాక్ చేయదు.',
    },
    fields: {
      'Measure Type': { en: 'One of five government-recognised categories: Weight, Volume, Length, Area, Count. Weight/Volume/Count are the three the Legal Metrology Act allows for declaring net quantity on packaging, so they alone drive pack-size auto-math (Break Bulk wastage tracking, base-unit conversion). Length and Area are real, selectable GST UQC categories too — for cloth, wire, tiles, flooring — but have no packaging "net quantity" concept, so they stay selectable for correct GST filing without auto-math.', te: 'ఐదు ప్రభుత్వ-గుర్తింపు పొందిన వర్గాలలో ఒకటి: Weight, Volume, Length, Area, Count. ప్యాకేజింగ్‌పై నికర పరిమాణం ప్రకటించడానికి లీగల్ మెట్రాలజీ చట్టం అనుమతించే మూడు Weight/Volume/Count మాత్రమే, కాబట్టి అవి మాత్రమే ప్యాక్-సైజు ఆటో-గణితాన్ని నడిపిస్తాయి. Length మరియు Area కూడా నిజమైన, ఎంచుకోదగిన GST UQC వర్గాలు — గుడ్డ, తీగ, టైల్స్ కోసం — కానీ ప్యాకేజింగ్ "నికర పరిమాణం" భావన లేదు.' },
      'Unit Symbol': { en: 'The specific display unit within the chosen Measure Type — e.g. kg, g, qtl, ton for Weight; ml, L, kl for Volume; pcs, doz, box, ctn, bag for Count. Every symbol here is a real GST UQC entry, not an invented shortcut — the full official list is used, uncut, across all five categories.', te: 'ఎంచుకున్న Measure Type లోపల నిర్దిష్ట డిస్‌ప్లే యూనిట్ — ఉదా. Weight కి kg, g, qtl, ton; Volume కి ml, L, kl; Count కి pcs, doz, box, ctn, bag. ఇక్కడ ప్రతి చిహ్నం నిజమైన GST UQC ఎంట్రీ, కనిపెట్టిన సత్వరమార్గం కాదు — పూర్తి అధికారిక జాబితా, కత్తిరించకుండా, అన్ని ఐదు వర్గాలలో ఉపయోగించబడుతుంది.' },
      'Pack Size': { en: 'The quantity in the chosen unit that one pack/PLU contains — 50 for a 50kg bag, 1 for a 1kg pack, 12 for a dozen. Fixed multiples (dozen=12, pair=2, gross=144, great gross=1728, thousand=1000) are true universal constants, always converted correctly. Box/carton/bag/bottle/etc. have no fixed multiple since their size genuinely varies per product — you enter the real size for each.', te: 'ఎంచుకున్న యూనిట్‌లో ఒక ప్యాక్/PLU కలిగి ఉన్న పరిమాణం — 50kg బ్యాగ్‌కు 50, 1kg ప్యాక్‌కు 1, డజన్‌కు 12. స్థిర గుణిజాలు (dozen=12, pair=2, gross=144, great gross=1728, thousand=1000) నిజమైన విశ్వవ్యాప్త స్థిరాంకాలు, ఎల్లప్పుడూ సరిగ్గా మార్చబడతాయి. Box/carton/bag/bottle మొదలైనవాటికి స్థిర గుణిజం లేదు ఎందుకంటే వాటి పరిమాణం ఉత్పత్తికి నిజంగా మారుతుంది.' },
      'GST UQC': { en: 'Auto-derived from the Unit Symbol the moment you pick it — you never type this separately. This is the exact code CBIC/GSTN require on GSTR-1 and e-invoices. Once set here, the GST report prefers this PLU-level code over the older, coarser guess made from the product\'s general Unit of Measure field.', te: 'మీరు ఎంచుకున్న క్షణమే Unit Symbol నుండి స్వయంచాలకంగా తీసుకోబడుతుంది — దీన్ని మీరు వేరుగా టైప్ చేయరు. GSTR-1 మరియు ఇ-ఇన్‌వాయిస్‌లపై CBIC/GSTN కు అవసరమైన ఖచ్చితమైన కోడ్ ఇది. ఇక్కడ సెట్ చేసిన తర్వాత, GST రిపోర్ట్ ఉత్పత్తి యొక్క సాధారణ Unit of Measure ఫీల్డ్ నుండి చేసిన పాత, స్థూలమైన అంచనా కంటే ఈ PLU-స్థాయి కోడ్‌ను ఇష్టపడుతుంది.' },
    },
    sections: [
      {
        title: { en: 'Filters and the audit view', te: 'ఫిల్టర్‌లు మరియు ఆడిట్ వీక్షణ' },
        body: {
          en: 'The summary chips at the top (No Unit Info / Weight / Volume / Length / Area / Count) both show counts and act as filters — click one to see only those PLUs. "No Unit Info" is usually the one to work through first when you\'re cleaning up a catalog. Search narrows by product name, PLU code, or barcode within the active filter.',
          te: 'పైన ఉన్న సారాంశ చిప్‌లు (No Unit Info / Weight / Volume / Length / Area / Count) గణనలు చూపిస్తాయి మరియు ఫిల్టర్‌లుగా కూడా పని చేస్తాయి — ఆ PLU లను మాత్రమే చూడటానికి ఒకదాన్ని క్లిక్ చేయండి. మీరు కేటలాగ్ శుభ్రం చేస్తున్నప్పుడు సాధారణంగా "No Unit Info" ద్వారా ముందుగా పని చేయాలి.',
        },
      },
      {
        title: { en: 'Bulk-set on selected rows', te: 'ఎంచుకున్న వరుసలపై బల్క్-సెట్' },
        body: {
          en: 'Select multiple rows with the checkboxes, then use the floating action bar to apply one Measure Type / Unit Symbol / Pack Size to all of them in a single click. Only select rows you know genuinely share the same pack size — a mixed selection (some 1kg, some 500g) would apply the wrong size to some of them. This same bulk action is also reachable from the Products page (select products → Set Units) and resolves to each product\'s default PLU.',
          te: 'చెక్‌బాక్స్‌లతో బహుళ వరుసలు ఎంచుకోండి, తర్వాత ఒకే క్లిక్‌లో వాటన్నింటికీ ఒక Measure Type / Unit Symbol / Pack Size వర్తింపజేయడానికి ఫ్లోటింగ్ యాక్షన్ బార్ ఉపయోగించండి. నిజంగా అదే ప్యాక్ సైజు పంచుకునే వరుసలను మాత్రమే ఎంచుకోండి — మిశ్రమ ఎంపిక (కొన్ని 1kg, కొన్ని 500g) కొన్నింటికి తప్పు సైజు వర్తింపజేస్తుంది.',
        },
      },
      {
        title: { en: '"Fix individually" for a single PLU', te: 'ఒకే PLU కోసం "వ్యక్తిగతంగా సరిచేయి"' },
        body: {
          en: 'Every row also has a "Fix individually →" link straight to that product\'s PLU page, for the cases where bulk-set isn\'t safe — a product with several differently-sized PLUs, or one you want to double-check against the pack in hand before setting.',
          te: 'బల్క్-సెట్ సురక్షితం కాని సందర్భాలకు, ప్రతి వరుసలో నేరుగా ఆ ఉత్పత్తి PLU పేజీకి "Fix individually →" లింక్ కూడా ఉంటుంది — వేర్వేరు సైజుల అనేక PLU లు ఉన్న ఉత్పత్తి, లేదా సెట్ చేయడానికి ముందు చేతిలో ఉన్న ప్యాక్‌తో రెండుసార్లు తనిఖీ చేయాలనుకునేది.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Bulk-setting a mixed selection', te: 'మిశ్రమ ఎంపికను బల్క్-సెట్ చేయడం' }, fix: { en: 'Selecting PLUs of different real-world sizes and bulk-applying one size stamps the wrong size on some of them. Sort/search first so your selection is genuinely uniform, or fix those rows individually instead.', te: 'వేర్వేరు నిజ-ప్రపంచ సైజుల PLU లను ఎంచుకుని ఒక సైజును బల్క్-వర్తింపజేయడం కొన్నింటికి తప్పు సైజు ముద్రిస్తుంది. మీ ఎంపిక నిజంగా ఏకరీతిగా ఉండేలా ముందు సార్ట్/శోధించండి, లేదా ఆ వరుసలను వ్యక్తిగతంగా సరిచేయండి.' } },
      { mistake: { en: 'Treating unit info as mandatory before you can save a product', te: 'ఉత్పత్తి సేవ్ చేయడానికి ముందు యూనిట్ సమాచారం తప్పనిసరి అని భావించడం' }, fix: { en: 'It never is. Units can always be added later from here, from the product/PLU edit form, or from GRN entry — nothing about product creation, GRN approval, or billing is blocked by missing unit info.', te: 'ఇది ఎప్పుడూ కాదు. యూనిట్‌లను ఎల్లప్పుడూ తర్వాత ఇక్కడి నుండి, ఉత్పత్తి/PLU ఎడిట్ ఫారమ్ నుండి, లేదా GRN ఎంట్రీ నుండి జోడించవచ్చు — ఉత్పత్తి సృష్టి, GRN ఆమోదం, లేదా బిల్లింగ్ గురించి ఏదీ లేని యూనిట్ సమాచారం వల్ల బ్లాక్ చేయబడదు.' } },
    ],
    relatedTopics: ['plu', 'break-bulk', 'products', 'grn-new'],
    tags: ['unit-management', 'uqc', 'gst', 'legal-metrology', 'measure-type', 'bulk-edit'],
  },

  // ── Purchase Orders ────────────────────────────────────────────────────────
  {
    id: 'purchase-orders', route: '/dashboard/purchase-orders', module: 'purchasing', version: '2.2',
    title: { en: 'Purchase Orders', te: 'కొనుగోలు ఆర్డర్లు' },
    summary: {
      en: 'Track what you\'ve ordered from suppliers. POs are auto-created when stock hits reorder level, or created manually. A PO becomes a GRN when goods arrive. Use POs to avoid double-ordering and to have a paper trail for every purchase.',
      te: 'మీరు సరఫరాదారుల నుండి ఏమి ఆర్డర్ చేశారో ట్రాక్ చేయండి. స్టాక్ రీఆర్డర్ స్థాయికి చేరినప్పుడు PO లు స్వయంచాలకంగా సృష్టించబడతాయి, లేదా మాన్యువల్‌గా సృష్టించబడతాయి. వస్తువులు వచ్చినప్పుడు PO GRN అవుతుంది. రెండుసార్లు ఆర్డర్ చేయకుండా ఉండటానికి మరియు ప్రతి కొనుగోలుకు పేపర్ ట్రైల్ కలిగి ఉండటానికి PO లు ఉపయోగించండి.',
    },
    sections: [
      {
        title: { en: 'Status flow', te: 'స్థితి ప్రవాహం' },
        body: {
          en: 'DRAFT → editable, not communicated. SENT → communicated to supplier via WhatsApp or marked sent. PARTIALLY_RECEIVED → some items received (GRN created). RECEIVED → all items received. CANCELLED → dropped. Auto-generated POs start as DRAFT — review and confirm before contacting the supplier.',
          te: 'DRAFT → సవరించదగినది, తెలియజేయలేదు. SENT → WhatsApp ద్వారా సరఫరాదారుకు తెలియజేయబడింది లేదా పంపినట్లు గుర్తించబడింది. PARTIALLY_RECEIVED → కొన్ని వస్తువులు స్వీకరించబడ్డాయి (GRN సృష్టించబడింది). RECEIVED → అన్ని వస్తువులు స్వీకరించబడ్డాయి. CANCELLED → రద్దు. స్వయంచాలకంగా ఉత్పత్తి చేయబడిన PO లు DRAFT గా మొదలవుతాయి — సరఫరాదారుని సంప్రదించే ముందు సమీక్షించి నిర్ధారించండి.',
        },
      },
      {
        title: { en: 'Auto-generated POs', te: 'స్వయంచాలక కొనుగోలు ఆర్డర్లు' },
        body: {
          en: 'When a product\'s stock hits zero at POS checkout, the system creates a DRAFT PO for the preferred supplier. Multiple products for the same supplier on the same day are grouped into one PO. Check the dashboard notification or this list for auto-POs. Review quantities before sending — the system uses the product\'s Reorder Qty which may need adjusting.',
          te: 'POS చెక్‌అవుట్‌లో ఒక ఉత్పత్తి స్టాక్ సున్నాకు చేరినప్పుడు, సిస్టమ్ ప్రెఫర్డ్ సరఫరాదారుకు DRAFT PO సృష్టిస్తుంది. అదే రోజు అదే సరఫరాదారుకు అనేక ఉత్పత్తులు ఒక PO లో సమూహం చేయబడతాయి. ఆటో-PO ల కోసం డాష్‌బోర్డ్ నోటిఫికేషన్ లేదా ఈ జాబితా తనిఖీ చేయండి.',
        },
      },
      {
        title: { en: 'Receiving goods (PO → GRN)', te: 'వస్తువులు స్వీకరించడం (PO → GRN)' },
        body: {
          en: 'Open the PO → click "Receive Goods → GRN". Enter the supplier\'s invoice number and date. The system pre-fills items from the PO. Review and adjust if actual quantities differ. Save and Approve to update stock. The PO status moves to PARTIALLY_RECEIVED or RECEIVED automatically based on quantities.',
          te: 'PO తెరవండి → "వస్తువులు స్వీకరించు → GRN" క్లిక్ చేయండి. సరఫరాదారు ఇన్‌వాయిస్ నంబర్ మరియు తేదీ నమోదు చేయండి. సిస్టమ్ PO నుండి వస్తువులను ముందే నింపుతుంది. వాస్తవ పరిమాణాలు వేరేగా ఉంటే సమీక్షించి సర్దుబాటు చేయండి. స్టాక్ అప్‌డేట్ చేయడానికి సేవ్ చేసి ఆమోదించండి.',
        },
      },
    ],
    relatedTopics: ['grn', 'suppliers', 'dashboard'],
    tags: ['purchase-orders', 'po', 'supplier', 'reorder', 'stock'],
  },

  // ── POS / Billing ──────────────────────────────────────────────────────────
  {
    id: 'pos', route: '/dashboard/pos', module: 'sales', version: '2.0',
    title: { en: 'POS — Billing Counter', te: 'POS — బిల్లింగ్ కౌంటర్' },
    summary: {
      en: 'The main billing screen. Scan barcodes or search items to build a cart, apply discounts, select payment mode, and complete the sale. GST is extracted automatically from every item. Supports Cash, UPI, Card, and split payments.',
      te: 'ప్రధాన బిల్లింగ్ స్క్రీన్. కార్ట్ నిర్మించడానికి బార్‌కోడ్‌లు స్కాన్ చేయండి లేదా వస్తువులు శోధించండి, తగ్గింపులు వర్తింపజేయండి, చెల్లింపు మోడ్ ఎంచుకోండి మరియు అమ్మకం పూర్తి చేయండి. ప్రతి వస్తువు నుండి GST స్వయంచాలకంగా వేరుచేయబడుతుంది.',
    },
    sections: [
      {
        title: { en: 'Adding items — 4 methods', te: 'వస్తువులు జోడించడం — 4 పద్ధతులు' },
        body: {
          en: '1. Barcode scan: point scanner at pack — item added instantly. 2. Name search: type product name, select from dropdown. 3. PLU code: type the PLU code directly. 4. Command Palette: Ctrl+K then type. For weight-sold (loose) items, a weight popup opens — enter grams and confirm. Quick-weight buttons (100g, 250g, 500g, 1kg) speed up common measurements.',
          te: '1. బార్‌కోడ్ స్కాన్: స్కానర్‌ను ప్యాక్‌వైపు చూపించండి — వస్తువు తక్షణం జోడించబడుతుంది. 2. పేరు శోధన: ఉత్పత్తి పేరు టైప్ చేయండి, డ్రాప్‌డౌన్ నుండి ఎంచుకోండి. 3. PLU కోడ్: PLU కోడ్ నేరుగా టైప్ చేయండి. 4. కమాండ్ పాలెట్: Ctrl+K తర్వాత టైప్ చేయండి. బరువు-అమ్మిన (లూస్) వస్తువులకు, బరువు పాప్‌అప్ తెరుచుకుంటుంది — గ్రాములు నమోదు చేసి నిర్ధారించండి.',
        },
      },
      {
        title: { en: 'Loose item weight calculation', te: 'లూస్ వస్తువు బరువు లెక్కింపు' },
        body: {
          en: 'For items with "Loose/Weigh = ON" in PLU settings: enter grams in the popup. Bill Qty = Grams ÷ Base Qty (e.g., 300g ÷ 1000g/kg = 0.300 kg). Bill Amount = Bill Qty × Selling Price. Example: Loose Sugar at ₹52/kg, customer wants 300g. Qty=0.300, Amount=₹15.60. Each weighing adds as a separate cart line — re-weighing the same item again adds a new line.',
          te: 'PLU సెట్టింగ్‌లలో "Loose/Weigh = ON" ఉన్న వస్తువులకు: పాప్‌అప్‌లో గ్రాములు నమోదు చేయండి. బిల్ qty = గ్రాములు ÷ బేస్ qty (ఉదా., 300g ÷ 1000g/kg = 0.300 kg). బిల్ మొత్తం = బిల్ qty × అమ్మకపు ధర. ఉదాహరణ: లూస్ చక్కెర ₹52/kg, కస్టమర్ 300g కావాలి. qty=0.300, మొత్తం=₹15.60.',
        },
      },
      {
        title: { en: 'Discount — item vs bill level', te: 'తగ్గింపు — వస్తువు vs బిల్ స్థాయి' },
        body: {
          en: 'Item discount: tap the item in cart → set discount % or amount. Affects only that line. Bill discount: the "%" button at cart total — applies across all items proportionally. Discounts reduce the taxable amount, so GST reduces automatically too. Avoid giving cash-back after billing — apply discount before completing the bill.',
          te: 'వస్తువు తగ్గింపు: కార్ట్‌లో వస్తువుపై నొక్కండి → తగ్గింపు % లేదా మొత్తం సెట్ చేయండి. ఆ లైన్ మాత్రమే ప్రభావితమవుతుంది. బిల్ తగ్గింపు: కార్ట్ మొత్తంలో "%" బటన్ — అన్ని వస్తువులకు అనుపాతంలో వర్తిస్తుంది. తగ్గింపులు పన్ను విధించదగిన మొత్తాన్ని తగ్గిస్తాయి కాబట్టి GST కూడా స్వయంచాలకంగా తగ్గుతుంది.',
        },
      },
      {
        title: { en: 'Payment modes', te: 'చెల్లింపు మోడ్‌లు' },
        body: {
          en: 'Cash: enter amount received, change is shown. UPI: QR generated — confirm payment received before clicking Complete. Card: enter terminal reference number. Split: click "+ Add Payment" to combine modes — e.g., ₹500 cash + ₹200 UPI for a ₹700 bill. Always confirm physical payment before completing. Once completed the bill is final and cannot be voided — issue a refund bill instead.',
          te: 'నగదు: స్వీకరించిన మొత్తం నమోదు చేయండి, చిల్లర చూపబడుతుంది. UPI: QR రూపొందించబడుతుంది — పూర్తి చేయడానికి క్లిక్ చేయడానికి ముందు చెల్లింపు స్వీకరించినట్లు నిర్ధారించండి. కార్డ్: టర్మినల్ రిఫరెన్స్ నంబర్ నమోదు చేయండి. స్ప్లిట్: మోడ్‌లు కలపడానికి "+ చెల్లింపు జోడించు" క్లిక్ చేయండి. పూర్తి చేయడానికి ముందు ఎల్లప్పుడూ శారీరక చెల్లింపు నిర్ధారించండి.',
        },
      },
      {
        title: { en: 'POS keyboard shortcuts', te: 'POS కీబోర్డ్ షార్ట్‌కట్‌లు' },
        body: {
          en: 'F5 → focus barcode input (start scanning). F6 → focus product search. F8 → open customer select. F10 → go to payment screen. Escape → close popup / cancel. Enter on search → add item. + / − keys on cart item → adjust quantity. Delete key on cart item → remove. These only work on the POS page.',
          te: 'F5 → బార్‌కోడ్ ఇన్‌పుట్‌కు ఫోకస్ (స్కానింగ్ ప్రారంభించు). F6 → ఉత్పత్తి శోధనకు ఫోకస్. F8 → కస్టమర్ సెలెక్ట్ తెరవండి. F10 → చెల్లింపు స్క్రీన్‌కు వెళ్ళండి. Escape → పాప్‌అప్ మూసివేయి / రద్దు చేయి. శోధనలో Enter → వస్తువు జోడించు. కార్ట్ వస్తువుపై + / − → పరిమాణం సర్దుబాటు. Delete → తీసివేయి.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Bill completed without payment confirmed', te: 'చెల్లింపు నిర్ధారించకుండా బిల్లు పూర్తి చేయడం' }, fix: { en: 'Always verify the physical cash/UPI confirmation before clicking Complete. A completed bill creates a receivable — if payment wasn\'t actually received, it shows as a shortfall in day closure.', te: 'పూర్తి చేయడానికి క్లిక్ చేయడానికి ముందు ఎల్లప్పుడూ శారీరక నగదు/UPI నిర్ధారణ ధృవీకరించండి.' } },
      { mistake: { en: 'Wrong item added by barcode mismatch', te: 'బార్‌కోడ్ మిస్‌మ్యాచ్ ద్వారా తప్పు వస్తువు జోడించడం' }, fix: { en: 'Always glance at the item name after scanning. If wrong, remove with Delete key and scan again. Barcode collisions are rare but possible on generic codes.', te: 'స్కాన్ చేసిన తర్వాత వస్తువు పేరు చూడండి. తప్పుగా ఉంటే, Delete కీతో తీసివేసి మళ్ళీ స్కాన్ చేయండి.' } },
    ],
    relatedTopics: ['bills', 'day-closure', 'customers'],
    tags: ['pos', 'billing', 'sales', 'payment', 'gst', 'barcode', 'loose'],
  },

  // ── Suppliers ──────────────────────────────────────────────────────────────
  {
    id: 'suppliers', route: '/dashboard/suppliers', module: 'purchasing', version: '2.1',
    title: { en: 'Suppliers', te: 'సరఫరాదారులు' },
    summary: {
      en: 'Your supplier master. Each supplier has contact details, GSTIN, payment terms, and a running ledger of purchases and payments. Accurate GSTIN is critical — without it you lose input tax credit on purchases from that supplier.',
      te: 'మీ సరఫరాదారు మాస్టర్. ప్రతి సరఫరాదారుకు సంప్రదింపు వివరాలు, GSTIN, చెల్లింపు నిబంధనలు మరియు కొనుగోళ్ళు మరియు చెల్లింపుల రన్నింగ్ లెడ్జర్ ఉంటాయి.',
    },
    fields: {
      'GSTIN': { en: 'Supplier\'s 15-character GST Identification Number. First 2 digits = state code; next 10 = PAN; 13th = entity number; 14th = Z; 15th = check digit. Mandatory to claim ITC. Format example: 37AAAAA0000A1Z5.', te: 'సరఫరాదారు 15-అక్షరాల GST గుర్తింపు నంబర్. మొదటి 2 = రాష్ట్ర కోడ్; తర్వాత 10 = PAN; 13వ = ఎంటిటీ నంబర్; 14వ = Z; 15వ = చెక్ డిజిట్. ITC క్లెయిమ్ చేయడానికి తప్పనిసరి.' },
      'Payment Terms': { en: 'Net 0 (cash), Net 7, Net 15, Net 30, Net 45, Net 60. Used for the Ageing Report — shows how long payables are outstanding. Net 30 is standard for most FMCG distributors.', te: 'Net 0 (నగదు), Net 7, Net 15, Net 30, Net 45, Net 60. ఏజింగ్ నివేదిక కోసం ఉపయోగించబడుతుంది — బకాయిలు ఎంత కాలంగా ఉన్నాయో చూపిస్తుంది.' },
      'Bank Details': { en: 'Account number, IFSC, bank name. Used to generate payment advice and for UPI-to-supplier transfers tracked in the system. Not mandatory but useful for reconciliation.', te: 'ఖాతా నంబర్, IFSC, బ్యాంక్ పేరు. చెల్లింపు సలహా రూపొందించడానికి మరియు సిస్టమ్‌లో ట్రాక్ చేయబడిన UPI-సరఫరాదారు బదిలీలకు ఉపయోగించబడుతుంది.' },
    },
    sections: [
      {
        title: { en: 'Supplier ledger — understanding the balance', te: 'సరఫరాదారు లెడ్జర్ — బ్యాలెన్స్ అర్థం చేసుకోవడం' },
        body: {
          en: 'Open supplier → Ledger tab. Balance Due = total approved GRNs − total payments made. Each approved GRN adds to the balance. Each payment recorded reduces it. Advance payments show as a negative balance (you paid more than you owe). Check this before making a payment to ensure the correct amount.',
          te: 'సరఫరాదారు తెరవండి → లెడ్జర్ ట్యాబ్. బాకీ బ్యాలెన్స్ = మొత్తం ఆమోదించిన GRN లు − మొత్తం చేసిన చెల్లింపులు. ప్రతి ఆమోదించిన GRN బ్యాలెన్స్‌కు జోడిస్తుంది. నమోదు చేసిన ప్రతి చెల్లింపు దానిని తగ్గిస్తుంది. అడ్వాన్స్ చెల్లింపులు నెగటివ్ బ్యాలెన్స్‌గా చూపిస్తాయి.',
        },
      },
      {
        title: { en: 'Why GSTIN matters for ITC', te: 'ITC కోసం GSTIN ఎందుకు ముఖ్యం' },
        body: {
          en: 'Input Tax Credit (ITC) means the GST you paid on purchases can be deducted from the GST you collect on sales — reducing your net GST payable. But ITC is only valid if the supplier has filed their GST return. Missing or wrong GSTIN means your ITC claim can be disallowed by the GST department. Always verify the supplier\'s GSTIN on the GST portal before the first purchase.',
          te: 'ఇన్‌పుట్ ట్యాక్స్ క్రెడిట్ (ITC) అంటే కొనుగోళ్ళపై మీరు చెల్లించిన GST అమ్మకాలపై మీరు సేకరించే GST నుండి తీసివేయబడవచ్చు — మీ నికర GST చెల్లించాల్సిన మొత్తాన్ని తగ్గిస్తుంది. కానీ సరఫరాదారు వారి GST రిటర్న్ ఫైల్ చేసినప్పుడు మాత్రమే ITC చెల్లుతుంది.',
        },
      },
      {
        title: { en: 'Credit Notes and Debit Notes — the other two things that reduce a balance', te: 'Credit Notes మరియు Debit Notes — బ్యాలెన్స్ తగ్గించే మరో రెండు అంశాలు' },
        body: {
          en: 'Besides recording a payment, there are two more ways a supplier\'s balance goes down. Debit Note — for goods you have physically returned (damaged, expired, wrong item). Click "Record Return" on this page, search for the product, enter the quantity, and submit — no need to link it to a specific GRN if the stock was already sitting in your store. Credit Note — for money the supplier owes you with no physical return: a scheme, a rebate, or a rate correction. Click "Create Credit Note" for this. Both appear in their own tab on this page (Credit Notes / Debit Notes), and both reduce the balance the moment they\'re created. Made a mistake? Both can be cancelled — cancelling instantly restores the amount.',
          te: 'చెల్లింపు నమోదు చేయడమే కాకుండా, సరఫరాదారు బ్యాలెన్స్ తగ్గే మరో రెండు మార్గాలు ఉన్నాయి. Debit Note — మీరు శారీరకంగా తిరిగి పంపిన వస్తువులకు (దెబ్బతిన్నవి, గడువు ముగిసినవి, తప్పు వస్తువు). ఈ పేజీలో "Record Return" క్లిక్ చేసి, వస్తువు వెతికి, పరిమాణం నమోదు చేసి సమర్పించండి — స్టాక్ ఇప్పటికే మీ దుకాణంలో ఉంటే ఏదైనా ప్రత్యేక GRN తో లింక్ చేయాల్సిన అవసరం లేదు. Credit Note — వస్తువులు తిరిగి రానప్పుడు సరఫరాదారు మీకు బాకీ ఉన్న డబ్బుకు: స్కీమ్, రిబేట్, లేదా రేటు సవరణ. దీని కోసం "Create Credit Note" క్లిక్ చేయండి. రెండూ ఈ పేజీలో వాటి స్వంత ట్యాబ్‌లో కనిపిస్తాయి (Credit Notes / Debit Notes), సృష్టించిన వెంటనే బ్యాలెన్స్ తగ్గిస్తాయి. పొరపాటు జరిగితే? రెండింటినీ రద్దు చేయవచ్చు — రద్దు చేయడం వెంటనే మొత్తాన్ని పునరుద్ధరిస్తుంది.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Supplier created without GSTIN', te: 'GSTIN లేకుండా సరఫరాదారు సృష్టించడం' }, fix: { en: 'Go back and add GSTIN before the first GRN. You can edit supplier at any time. GRNs created without supplier GSTIN mark ITC as ineligible automatically.', te: 'మొదటి GRN కంటే ముందు GSTIN జోడించడానికి వెనుకకు వెళ్ళండి. మీరు ఎప్పుడైనా సరఫరాదారుని సవరించవచ్చు.' } },
      { mistake: { en: 'Not sure whether to use Record Return or Create Credit Note', te: 'Record Return లేదా Create Credit Note ఏది ఉపయోగించాలో తెలియకపోవడం' }, fix: { en: 'Ask: "Am I physically sending any product back?" Yes → Record Return (Debit Note), itemized by product and quantity. No, it\'s just a discount or rebate → Create Credit Note, one lump amount.', te: '"నేను శారీరకంగా ఏదైనా వస్తువు తిరిగి పంపుతున్నానా?" అని అడగండి. అవును → Record Return (Debit Note), వస్తువు మరియు పరిమాణం వారీగా. కాదు, ఇది కేవలం డిస్కౌంట్ లేదా రిబేట్ మాత్రమే → Create Credit Note, ఒకే మొత్తంగా.' } },
    ],
    relatedTopics: ['purchase-orders', 'grn', 'payments', 'bank', 'credit-notes', 'debit-notes'],
    tags: ['suppliers', 'gstin', 'ledger', 'itc', 'payment-terms', 'return', 'credit-note', 'debit-note'],
  },

  // ── Customers ──────────────────────────────────────────────────────────────
  {
    id: 'customers', route: '/dashboard/customers', module: 'sales', version: '1.1',
    title: { en: 'Customers', te: 'కస్టమర్లు' },
    summary: {
      en: 'Manage your customer base. Customers can be attached to bills at POS for loyalty tracking, credit sales, and personalised offers. B2B customers with GSTIN get GST-compliant bills. Walk-in customers are billed without a customer record.',
      te: 'మీ కస్టమర్ బేస్ నిర్వహించండి. లాయల్టీ ట్రాకింగ్, క్రెడిట్ అమ్మకాలు మరియు వ్యక్తిగతీకరించిన ఆఫర్లకు POS లో బిల్లులకు కస్టమర్లను అటాచ్ చేయవచ్చు. GSTIN ఉన్న B2B కస్టమర్లు GST-కంప్లయంట్ బిల్లులు పొందుతారు.',
    },
    fields: {
      'Name': { en: 'Customer name as it should appear on bills and loyalty communications. For businesses, use the legal name.', te: 'బిల్లులు మరియు లాయల్టీ కమ్యూనికేషన్లలో కనిపించాల్సిన కస్టమర్ పేరు. వ్యాపారాలకు, చట్టపరమైన పేరు ఉపయోగించండి.' },
      'Phone': { en: 'Mobile number — used for WhatsApp bill delivery, loyalty updates, and customer search at POS. Must be a valid 10-digit Indian number.', te: 'మొబైల్ నంబర్ — WhatsApp బిల్ డెలివరీ, లాయల్టీ అప్‌డేట్‌లు మరియు POS లో కస్టమర్ శోధనకు ఉపయోగించబడుతుంది.' },
      'GSTIN': { en: 'For B2B customers only. Required to generate a GST-compliant invoice with the customer\'s details. Leave blank for retail/B2C customers.', te: 'B2B కస్టమర్లకు మాత్రమే. కస్టమర్ వివరాలతో GST-కంప్లయంట్ ఇన్‌వాయిస్ రూపొందించడానికి అవసరం. రిటైల్/B2C కస్టమర్లకు ఖాళీగా వదిలేయండి.' },
      'Credit Limit': { en: 'Maximum outstanding balance allowed for this customer. If set, POS will warn (or block, based on settings) when a bill would exceed the limit. Set 0 for cash-only customers.', te: 'ఈ కస్టమర్‌కు అనుమతించబడిన గరిష్ట బాకీ బ్యాలెన్స్. సెట్ చేసినప్పుడు, బిల్ పరిమితిని మించిపోయినప్పుడు POS హెచ్చరిస్తుంది. నగదు మాత్రమే కస్టమర్లకు 0 సెట్ చేయండి.' },
      'Loyalty Points': { en: 'Auto-calculated at each bill — based on the loyalty rate set in Business Settings. Points can be redeemed as discount on future bills at POS.', te: 'ప్రతి బిల్‌లో స్వయంచాలకంగా లెక్కించబడుతుంది — వ్యాపార సెట్టింగ్‌లలో సెట్ చేసిన లాయల్టీ రేటు ఆధారంగా. పాయింట్‌లు POS లో భవిష్యత్ బిల్లులపై తగ్గింపుగా రీడీమ్ చేయవచ్చు.' },
    },
    sections: [
      {
        title: { en: 'Customer ledger — outstanding balance', te: 'కస్టమర్ లెడ్జర్ — బాకీ బ్యాలెన్స్' },
        body: {
          en: 'Open any customer → Ledger tab. Shows every credit bill and every payment received. Outstanding = total credit sales − payments received. Use this to follow up on overdue amounts. The Ageing Report (Reports → Ageing) groups all customers by how long the outstanding has been pending.',
          te: 'ఏ కస్టమర్‌నైనా తెరవండి → లెడ్జర్ ట్యాబ్. ప్రతి క్రెడిట్ బిల్ మరియు స్వీకరించిన ప్రతి చెల్లింపు చూపిస్తుంది. బాకీ = మొత్తం క్రెడిట్ అమ్మకాలు − స్వీకరించిన చెల్లింపులు. గడువు మించిన మొత్తాల కోసం ఫాలో-అప్ చేయడానికి ఇది ఉపయోగించండి.',
        },
      },
      {
        title: { en: 'Store Wallet — customer credit balance', te: 'స్టోర్ వాలెట్ — కస్టమర్ క్రెడిట్ బ్యాలెన్స్' },
        body: {
          en: 'The Store Wallet (Customer 360 → side panel) holds money the store owes the customer — the opposite of outstanding balance. It fills up automatically when a paid online order is edited down (instead of a bank refund), or manually via "+ Credit" for goodwill or corrections. When the customer wants to use it, press "− Redeem" and give the equivalent discount on their purchase, noting the bill number as the reason. Every credit and debit is logged with who did it and why — the wallet can never go below zero. This is different from Loyalty Points: wallet is real money in rupees; points are a reward converted at the loyalty rate.',
          te: 'స్టోర్ వాలెట్ (కస్టమర్ 360 → సైడ్ ప్యానెల్) దుకాణం కస్టమర్‌కు బాకీ ఉన్న డబ్బు — బాకీ బ్యాలెన్స్‌కు వ్యతిరేకం. చెల్లించిన ఆన్‌లైన్ ఆర్డర్ సవరణతో తగ్గినప్పుడు (బ్యాంక్ రీఫండ్ బదులు) ఆటోమేటిక్‌గా జమ అవుతుంది, లేదా "+ Credit" తో మాన్యువల్‌గా. కస్టమర్ వాడాలనుకున్నప్పుడు "− Redeem" నొక్కి కొనుగోలుపై సమానమైన తగ్గింపు ఇవ్వండి, బిల్ నంబర్ కారణంగా రాయండి. ప్రతి జమ/ఖర్చు ఎవరు, ఎందుకు చేశారో నమోదు అవుతుంది — వాలెట్ ఎప్పుడూ సున్నా కంటే తక్కువ కాదు. ఇది లాయల్టీ పాయింట్ల కంటే భిన్నం: వాలెట్ నిజమైన రూపాయల డబ్బు.',
        },
      },
    ],
    relatedTopics: ['pos', 'bills', 'payments', 'online-orders'],
    tags: ['customers', 'loyalty', 'credit', 'ledger', 'gstin', 'wallet', 'store-credit'],
  },

  // ── Day Closure ────────────────────────────────────────────────────────────
  {
    id: 'day-closure', route: '/dashboard/day-closure', module: 'core', version: '1.0',
    title: { en: 'Day Closure', te: 'రోజు ముగింపు' },
    summary: {
      en: 'Complete each business day by reconciling cash, verifying sales, and locking the ledger. Day closure must be done before GST reports can be generated for that day. An unclosed day remains editable and appears as a warning on the dashboard.',
      te: 'నగదు సమన్వయించడం, అమ్మకాలు ధృవీకరించడం మరియు లెడ్జర్ లాక్ చేయడం ద్వారా ప్రతి వ్యాపార రోజు పూర్తి చేయండి. ఆ రోజు GST రిపోర్టులు రూపొందించడానికి ముందు రోజు ముగింపు చేయాలి.',
    },
    sections: [
      {
        title: { en: 'What happens at day closure', te: 'రోజు ముగింపులో ఏమి జరుగుతుంది' },
        body: {
          en: '1. Cash reconciliation: Expected Cash = Opening Float + Cash Sales − Cash Refunds − Withdrawals. 2. Sales are locked — no new bills can be backdated to this day. 3. GST summary is generated: Output GST = sum of GST on all bills. 4. Day book entry is created. 5. Stock movements for the day are finalised. If there\'s a cash surplus or shortage, enter the actual cash count — the difference is recorded as over/short.',
          te: '1. నగదు సమన్వయం: ఆశించిన నగదు = ఓపెనింగ్ ఫ్లోట్ + నగదు అమ్మకాలు − నగదు రీఫండ్‌లు − ఉపసంహరణలు. 2. అమ్మకాలు లాక్ చేయబడతాయి — ఈ రోజుకు కొత్త బిల్లులు బ్యాక్‌డేట్ చేయలేరు. 3. GST సారాంశం రూపొందించబడుతుంది: అవుట్‌పుట్ GST = అన్ని బిల్లులపై GST మొత్తం. 4. రోజు పుస్తక ఎంట్రీ సృష్టించబడుతుంది.',
        },
      },
      {
        title: { en: 'Cash count and reconciliation', te: 'నగదు గణన మరియు సమన్వయం' },
        body: {
          en: 'Count physical cash in the drawer. Enter denomination-wise (₹500×X + ₹200×X + ₹100×X...). System compares with expected amount. Discrepancy < ₹10 is normal (rounding). Discrepancy > ₹50 needs investigation — check if any bill was miscounted or a refund was given without recording. Record the reason for any variance.',
          te: 'డ్రాయర్‌లో శారీరక నగదు లెక్కించండి. విలువ వారీగా నమోదు చేయండి (₹500×X + ₹200×X + ₹100×X...). సిస్టమ్ ఆశించిన మొత్తంతో పోల్చుతుంది. వ్యత్యాసం < ₹10 సాధారణం (రౌండింగ్). వ్యత్యాసం > ₹50 పరిశోధన అవసరం.',
        },
      },
      {
        title: { en: 'When to do day closure', te: 'రోజు ముగింపు ఎప్పుడు చేయాలి' },
        body: {
          en: 'At the end of every business day, after the last bill of the day. Do NOT do it early if you still expect evening customers. The system allows closures up to 24 hours after midnight (so you can close the previous day if you forgot). Missing more than 3 days causes reports to be out of sync.',
          te: 'ప్రతి వ్యాపార రోజు చివరిలో, రోజులో చివరి బిల్ తర్వాత. మీరు ఇంకా సాయంత్రం కస్టమర్లను ఆశించినట్లయితే ముందుగా చేయవద్దు. సిస్టమ్ అర్ధరాత్రి తర్వాత 24 గంటల వరకు ముగింపులను అనుమతిస్తుంది. 3 రోజులకు మించి మిస్ అవడం రిపోర్టులు సింక్‌లో ఉండకుండా చేస్తుంది.',
        },
      },
    ],
    relatedTopics: ['pos', 'bills', 'reports'],
    tags: ['day-closure', 'cash', 'reconciliation', 'gst', 'shift'],
  },

  // ── Bills / Sales History ──────────────────────────────────────────────────
  {
    id: 'bills', route: '/dashboard/bills', module: 'sales', version: '1.0',
    title: { en: 'Bills', te: 'బిల్లులు' },
    summary: {
      en: 'Complete record of all sales bills. Search, filter, reprint, and analyse. Each bill shows itemised GST breakdown. Bills cannot be deleted — issue a return/refund bill to reverse a transaction.',
      te: 'అన్ని అమ్మకాల బిల్లుల పూర్తి రికార్డు. శోధించండి, ఫిల్టర్ చేయండి, రీప్రింట్ చేయండి మరియు విశ్లేషించండి. ప్రతి బిల్లు GST విచ్ఛిన్నాన్ని వివరంగా చూపిస్తుంది.',
    },
    sections: [
      {
        title: { en: 'GST on a bill — how it\'s calculated', te: 'బిల్‌లో GST — ఎలా లెక్కించబడుతుంది' },
        body: {
          en: 'For Tax Inclusive items: Taxable = SP ÷ (1 + Rate/100). CGST = SGST = Taxable × Rate/200. Bill total = SP × Qty (no extra tax, it\'s inside). Footer shows rate-wise totals for GSTR-1. Example: 2 kg sugar at ₹52.50 each, 5% GST inclusive. Taxable = 52.50/1.05 = ₹50 each. CGST = ₹1.25 each. Bill line total = ₹105 for 2 kg.',
          te: 'Tax Inclusive వస్తువులకు: పన్ను విధించదగినది = SP ÷ (1 + రేటు/100). CGST = SGST = పన్ను విధించదగినది × రేటు/200. బిల్ మొత్తం = SP × qty. ఫుటర్ GSTR-1 కోసం రేటు-వారీ మొత్తాలు చూపిస్తుంది. ఉదాహరణ: 2 kg చక్కెర ₹52.50 చొప్పున, 5% GST inclusive. పన్ను విధించదగినది = ₹50 చొప్పున. CGST = ₹1.25 చొప్పున.',
        },
      },
      {
        title: { en: 'Return / Refund', te: 'రిటర్న్ / రీఫండ్' },
        body: {
          en: 'Open the original bill → click "Return". Select items being returned and quantities. A negative bill is created — stock is added back, GST is reversed, and credit is applied to the customer. Cash refund: record separately in payments. Returns on credit bills reduce the customer\'s outstanding balance.',
          te: 'అసలు బిల్ తెరవండి → "రిటర్న్" క్లిక్ చేయండి. తిరిగి వస్తున్న వస్తువులు మరియు పరిమాణాలు ఎంచుకోండి. నెగటివ్ బిల్ సృష్టించబడుతుంది — స్టాక్ వెనుకకు జోడించబడుతుంది, GST రివర్స్ చేయబడుతుంది.',
        },
      },
    ],
    relatedTopics: ['pos', 'day-closure', 'customers'],
    tags: ['bills', 'sales', 'gst', 'reprint', 'return', 'refund'],
  },

  // ── Reports Overview ───────────────────────────────────────────────────────
  {
    id: 'reports', route: '/dashboard/reports', module: 'reports', version: '1.0',
    title: { en: 'Reports', te: 'నివేదికలు' },
    summary: {
      en: 'All business analytics — GST returns, day book, profit & loss, stock valuation, customer ageing, year-on-year comparison, and CA export. Select a date range, generate, and export to Excel or PDF.',
      te: 'అన్ని వ్యాపార విశ్లేషణలు — GST రిటర్న్‌లు, రోజు పుస్తకం, లాభ & నష్టం, స్టాక్ వాల్యుయేషన్, కస్టమర్ ఏజింగ్, సంవత్సరం-వారీ పోలిక మరియు CA ఎగుమతి.',
    },
    sections: [
      {
        title: { en: 'Which report for which purpose', te: 'ఏ అవసరానికి ఏ నివేదిక' },
        body: {
          en: 'GST filing → GST Report (GSTR-1 + GSTR-3B data). Daily cash check → Day Book. Annual review → Year Comparison. CA handoff → CA Export. Stock worth → Inventory Valuation. Overdue collections → Ageing Report. Tax errors → GST Health Check. All reports accept date range filters and export to Excel.',
          te: 'GST ఫైలింగ్ → GST నివేదిక. రోజువారీ నగదు తనిఖీ → రోజు పుస్తకం. వార్షిక సమీక్ష → సంవత్సరం పోలిక. CA హ్యాండ్‌ఆఫ్ → CA ఎగుమతి. స్టాక్ విలువ → ఇన్వెంటరీ వాల్యుయేషన్. గడువు మించిన వసూళ్ళు → ఏజింగ్ నివేదిక. పన్ను లోపాలు → GST హెల్త్ చెక్.',
        },
      },
    ],
    relatedTopics: ['reports-gst', 'reports-daybook', 'day-closure'],
    tags: ['reports', 'gst', 'analytics', 'profit', 'stock'],
  },

  // ── GST Report ─────────────────────────────────────────────────────────────
  {
    id: 'reports-gst', route: '/dashboard/reports/gst', module: 'reports', version: '1.0',
    title: { en: 'GST Report', te: 'GST నివేదిక' },
    summary: {
      en: 'GSTR-1 and GSTR-3B summary from your bills and GRNs. Select a month → the report shows outward supplies by tax rate (GSTR-1) and the net GST payable after deducting ITC (GSTR-3B). Export to Excel and share with your CA for verification before filing.',
      te: 'మీ బిల్లులు మరియు GRN ల నుండి GSTR-1 మరియు GSTR-3B సారాంశం. ఒక నెల ఎంచుకోండి → నివేదిక పన్ను రేటు వారీగా ఔట్‌వార్డ్ సరఫరాలు (GSTR-1) మరియు ITC తీసివేసిన తర్వాత నికర GST చెల్లించాల్సిన మొత్తం (GSTR-3B) చూపిస్తుంది.',
    },
    sections: [
      {
        title: { en: 'GSTR-3B net payable calculation', te: 'GSTR-3B నికర చెల్లించాల్సిన మొత్తం లెక్కింపు' },
        body: {
          en: 'Net GST Payable = Output GST (bills) − ITC (approved GRNs with eligible ITC). Example: July output GST = ₹18,500 (CGST ₹9,250 + SGST ₹9,250). July ITC from GRNs = ₹14,200 (CGST ₹7,100 + SGST ₹7,100). Net payable: CGST ₹2,150 + SGST ₹2,150 = ₹4,300. Pay via GST portal by 20th August. If ITC > Output GST, the excess carries forward to next month.',
          te: 'నికర GST చెల్లించాల్సిన మొత్తం = అవుట్‌పుట్ GST (బిల్లులు) − ITC (అర్హమైన ITC తో ఆమోదించిన GRN లు). ఉదాహరణ: జూలై అవుట్‌పుట్ GST = ₹18,500. జూలై GRN ల నుండి ITC = ₹14,200. నికర చెల్లింపు: ₹4,300. ఆగస్టు 20 లోగా GST పోర్టల్ ద్వారా చెల్లించండి.',
        },
      },
      {
        title: { en: 'HSN-wise summary — Table 12', te: 'HSN-వారీ సారాంశం — టేబుల్ 12' },
        body: {
          en: 'Groups sales by HSN code. Required for annual returns. If "Unknown HSN" items appear, go to those products and add the correct HSN code — then regenerate. Annual turnover > ₹5 Cr: 6-digit HSN mandatory. Below ₹5 Cr: 4-digit acceptable.',
          te: 'HSN కోడ్ వారీగా అమ్మకాలను గ్రూప్ చేస్తుంది. వార్షిక రిటర్న్‌లకు అవసరం. "Unknown HSN" వస్తువులు కనిపిస్తే, ఆ ఉత్పత్తులకు వెళ్ళి HSN కోడ్ జోడించండి — తర్వాత మళ్ళీ రూపొందించండి.',
        },
      },
    ],
    relatedTopics: ['reports', 'bills', 'grn', 'hsn'],
    tags: ['gst', 'gstr1', 'gstr3b', 'itc', 'filing', 'hsn'],
  },

  // ── Day Book ───────────────────────────────────────────────────────────────
  {
    id: 'reports-daybook', route: '/dashboard/reports/day-book', module: 'reports', version: '1.0',
    title: { en: 'Day Book', te: 'రోజు పుస్తకం' },
    summary: {
      en: 'Daily cash flow — what came in (sales, customer payments) and what went out (supplier payments, expenses). One row per closed day. Reconcile your physical cash and bank balance with system records each morning.',
      te: 'రోజువారీ నగదు ప్రవాహం — ఏమి వచ్చింది (అమ్మకాలు, కస్టమర్ చెల్లింపులు) మరియు ఏమి వెళ్ళింది (సరఫరాదారు చెల్లింపులు, ఖర్చులు). మూసివేసిన రోజుకు ఒక వరుస.',
    },
    sections: [
      {
        title: { en: 'Closing cash formula', te: 'ముగింపు నగదు సూత్రం' },
        body: {
          en: 'Closing Cash = Opening Cash + Cash Sales + Customer Cash Received − Supplier Cash Paid − Cash Expenses. If your physical cash ≠ Closing Cash, check: (1) any unrecorded expense, (2) a refund given without recording, (3) a day closure with wrong count. The variance field shows the difference logged at closure.',
          te: 'ముగింపు నగదు = ఆరంభ నగదు + నగదు అమ్మకాలు + కస్టమర్ నగదు స్వీకరించబడింది − సరఫరాదారు నగదు చెల్లించబడింది − నగదు ఖర్చులు. మీ శారీరక నగదు ≠ ముగింపు నగదు అయితే తనిఖీ చేయండి: (1) నమోదు చేయని ఖర్చు, (2) నమోదు చేయకుండా ఇచ్చిన రీఫండ్, (3) తప్పు గణనతో రోజు ముగింపు.',
        },
      },
    ],
    relatedTopics: ['reports', 'day-closure', 'expenses'],
    tags: ['day-book', 'cash-flow', 'daily', 'reconciliation'],
  },

  // ── Categories ─────────────────────────────────────────────────────────────
  {
    id: 'categories', route: '/dashboard/categories', module: 'products', version: '1.0',
    title: { en: 'Categories', te: 'వర్గాలు' },
    summary: {
      en: 'Group products for reports and online store navigation. Categories show in Reports filtered views and your Storefront\'s shop menu. Keep categories broad (8–12 top-level); use Subcategories for finer grouping.',
      te: 'నివేదికలు మరియు ఆన్‌లైన్ స్టోర్ నావిగేషన్ కోసం ఉత్పత్తులను గ్రూప్ చేయండి. వర్గాలు నివేదికల ఫిల్టర్ వీక్షణలలో మరియు మీ స్టోర్‌ఫ్రంట్ షాప్ మెనూలో కనిపిస్తాయి.',
    },
    sections: [
      {
        title: { en: 'Suggested grocery categories', te: 'సూచించిన కిరాణా వర్గాలు' },
        body: {
          en: 'Grains & Pulses, Edible Oils, Spices & Masalas, Beverages (Tea/Coffee/Juice), Dairy & Eggs, Packaged Foods, Cleaning & Household, Personal Care, Snacks & Biscuits, Fresh Produce (if applicable). Keep it to 10–12 categories — too many confuse online shoppers and make reports noisy.',
          te: 'ధాన్యాలు & పప్పులు, వంట నూనెలు, సుగంధ ద్రవ్యాలు & మసాలాలు, పానీయాలు (టీ/కాఫీ/జ్యూస్), పాల ఉత్పత్తులు & గుడ్లు, ప్యాకేజ్డ్ ఆహారాలు, శుభ్రత & గృహ వస్తువులు, వ్యక్తిగత సంరక్షణ, స్నాక్స్ & బిస్కెట్లు. 10–12 వర్గాలకు పరిమితం చేయండి.',
        },
      },
    ],
    relatedTopics: ['products', 'hsn'],
    tags: ['categories', 'subcategories', 'products', 'online-store'],
  },

  // ── HSN Codes ──────────────────────────────────────────────────────────────
  {
    id: 'hsn', route: '/dashboard/hsn', module: 'products', version: '1.0',
    title: { en: 'HSN Codes', te: 'HSN కోడ్‌లు' },
    summary: {
      en: 'HSN (Harmonised System of Nomenclature) codes classify goods for GST filing. Every product needs an HSN code. This master links HSN to GST rate — new products inherit the rate when you select the HSN. Keeps GST rates consistent across similar products.',
      te: 'HSN (హార్మోనైజ్డ్ నొమెన్‌క్లేచర్ వ్యవస్థ) కోడ్‌లు GST ఫైలింగ్ కోసం వస్తువులను వర్గీకరిస్తాయి. ప్రతి ఉత్పత్తికి HSN కోడ్ అవసరం. ఈ మాస్టర్ HSN ని GST రేటుకు లింక్ చేస్తుంది.',
    },
    sections: [
      {
        title: { en: 'Common HSN codes for grocery retail', te: 'కిరాణా రిటైల్ కోసం సాధారణ HSN కోడ్‌లు' },
        body: {
          en: '1006=Rice 0%, 1101=Atta 0%, 1701=Sugar 5%, 0713=Dal 0%, 1512=Sunflower oil 5%, 1511=Palm oil 5%, 0902=Tea 5%, 0901=Coffee 5%, 2501=Salt 0%, 1905=Biscuits 5%, 0401=Milk 0%, 2106=Packaged food prep 18%, 3401=Soap 18%, 3305=Shampoo 18%, 3304=Face cream 18%. Always verify at cbic-gst.gov.in — rates change with GST council notifications.',
          te: '1006=బియ్యం 0%, 1101=ఆటా 0%, 1701=చక్కెర 5%, 0713=పప్పు 0%, 1512=సన్‌ఫ్లవర్ ఆయిల్ 5%, 0902=టీ 5%, 2501=ఉప్పు 0%, 1905=బిస్కెట్లు 5%, 0401=పాలు 0%, 3401=సబ్బు 18%, 3305=షాంపూ 18%. ఎల్లప్పుడూ cbic-gst.gov.in లో ధృవీకరించండి.',
        },
      },
    ],
    relatedTopics: ['products', 'reports-gst'],
    tags: ['hsn', 'gst', 'classification', 'filing', 'rates'],
  },

  // ── Bank / Finance ─────────────────────────────────────────────────────────
  {
    id: 'bank', route: '/dashboard/bank', module: 'finance', version: '1.0',
    title: { en: 'Bank & Finance', te: 'బ్యాంక్ & ఫైనాన్స్' },
    summary: {
      en: 'Track all money movement — bank accounts, UPI receipts, supplier payments, cash. The bank module gives you a complete picture of your financial position. Every payment in and out is recorded here, linked to the underlying transaction.',
      te: 'అన్ని డబ్బు కదలికలను ట్రాక్ చేయండి — బ్యాంక్ ఖాతాలు, UPI రసీదులు, సరఫరాదారు చెల్లింపులు, నగదు. బ్యాంక్ మాడ్యూల్ మీ ఆర్థిక స్థానం యొక్క పూర్తి చిత్రాన్ని అందిస్తుంది.',
    },
    sections: [
      {
        title: { en: 'Recording a supplier payment', te: 'సరఫరాదారు చెల్లింపు నమోదు చేయడం' },
        body: {
          en: 'Bank → Supplier Payments → New Payment. Select supplier, enter amount, choose mode (Cash/NEFT/RTGS/UPI/Cheque), enter reference (UTR for NEFT, cheque number for cheques). System applies payment to oldest outstanding invoices first (FIFO). Confirm the date matches your bank statement. Always record on the actual payment date.',
          te: 'బ్యాంక్ → సరఫరాదారు చెల్లింపులు → కొత్త చెల్లింపు. సరఫరాదారు ఎంచుకోండి, మొత్తం నమోదు చేయండి, మోడ్ ఎంచుకోండి, రిఫరెన్స్ నమోదు చేయండి. సిస్టమ్ పాత బాకీ ఇన్‌వాయిస్‌లకు (FIFO) చెల్లింపు వర్తిస్తుంది. తేదీ మీ బ్యాంక్ స్టేట్‌మెంట్‌తో సరిపోలుతుందని నిర్ధారించండి.',
        },
      },
    ],
    relatedTopics: ['suppliers', 'payments', 'expenses'],
    tags: ['bank', 'payments', 'upi', 'neft', 'supplier-payment', 'finance'],
  },

  // ── Expenses ───────────────────────────────────────────────────────────────
  {
    id: 'expenses', route: '/dashboard/expenses', module: 'finance', version: '1.0',
    title: { en: 'Expenses', te: 'ఖర్చులు' },
    summary: {
      en: 'Record operating expenses — rent, electricity, salaries, packaging, transport, maintenance. These appear in the Profit & Loss report and reduce closing cash (if paid in cash). Categorise consistently so your CA can map them to the correct P&L line items.',
      te: 'నిర్వహణ ఖర్చులు నమోదు చేయండి — అద్దె, విద్యుత్, జీతాలు, ప్యాకేజింగ్, రవాణా, నిర్వహణ. ఇవి లాభ & నష్టం నివేదికలో కనిపిస్తాయి మరియు ముగింపు నగదును తగ్గిస్తాయి (నగదులో చెల్లిస్తే).',
    },
    fields: {
      'Category': { en: 'Rent, Electricity, Water, Salary, Packaging, Transport, Maintenance, Advertising, Other. Use consistent categories month-to-month so year-end reports are meaningful.', te: 'అద్దె, విద్యుత్, నీరు, జీతం, ప్యాకేజింగ్, రవాణా, నిర్వహణ, ప్రకటనలు, ఇతర. సంవత్సరం-చివర నివేదికలు అర్థవంతంగా ఉండేలా నెల-నెల స్థిరమైన వర్గాలు ఉపయోగించండి.' },
      'Payment Mode': { en: 'Cash (deducted from till at day closure), Bank Transfer (tracked in bank), or UPI. Mis-selecting the mode causes cash reconciliation errors.', te: 'నగదు (రోజు ముగింపులో టిల్ నుండి తీసివేయబడుతుంది), బ్యాంక్ బదిలీ (బ్యాంక్‌లో ట్రాక్ చేయబడుతుంది), లేదా UPI. తప్పు మోడ్ ఎంచుకోవడం నగదు సమన్వయ లోపాలకు కారణమవుతుంది.' },
    },
    relatedTopics: ['bank', 'reports', 'day-closure'],
    tags: ['expenses', 'rent', 'salary', 'profit-loss', 'operating-costs'],
  },

  // ── Shifts ─────────────────────────────────────────────────────────────────
  {
    id: 'shifts', route: '/dashboard/shifts', module: 'core', version: '1.0',
    title: { en: 'Shifts', te: 'షిఫ్ట్‌లు' },
    summary: {
      en: 'If your store runs multiple billing shifts (morning/evening), shifts let each cashier start with a float and reconcile at hand-over. Shift reports show per-cashier totals. Day closure aggregates all shifts.',
      te: 'మీ దుకాణం అనేక బిల్లింగ్ షిఫ్ట్‌లు నడుపుతే, షిఫ్ట్‌లు ప్రతి క్యాషియర్‌ను ఫ్లోట్‌తో ప్రారంభించి హ్యాండ్‌ఓవర్‌లో సమన్వయించనిస్తాయి.',
    },
    sections: [
      {
        title: { en: 'Opening and closing a shift', te: 'షిఫ్ట్ తెరవడం మరియు మూసివేయడం' },
        body: {
          en: 'New Shift → assign cashier → enter opening float. During shift: bills tagged to this shift automatically. Close Shift → count physical cash → enter amount → system shows expected vs actual variance. Investigate any variance > ₹50 before handing over. Next shift opens immediately — you can have overlapping shifts.',
          te: 'కొత్త షిఫ్ట్ → క్యాషియర్ నియమించండి → ఓపెనింగ్ ఫ్లోట్ నమోదు చేయండి. షిఫ్ట్ సమయంలో: బిల్లులు స్వయంచాలకంగా ఈ షిఫ్ట్‌కు ట్యాగ్ చేయబడతాయి. షిఫ్ట్ మూసివేయి → శారీరక నగదు లెక్కించండి → మొత్తం నమోదు చేయండి → సిస్టమ్ ఆశించినది vs వాస్తవ వ్యత్యాసం చూపిస్తుంది.',
        },
      },
    ],
    relatedTopics: ['pos', 'day-closure', 'users'],
    tags: ['shifts', 'cashier', 'float', 'reconciliation', 'hand-over'],
  },

  // ── Users & Roles ──────────────────────────────────────────────────────────
  {
    id: 'users', route: '/dashboard/users', module: 'core', version: '1.0',
    title: { en: 'Users & Roles', te: 'వినియోగదారులు & పాత్రలు' },
    summary: {
      en: 'Manage staff accounts and their access. Each role restricts access to specific modules. Give minimum access needed — a cashier needs POS only, a manager needs reports, the owner needs everything. Change roles immediately when staff leave.',
      te: 'సిబ్బంది ఖాతాలు మరియు వారి యాక్సెస్ నిర్వహించండి. ప్రతి పాత్ర నిర్దిష్ట మాడ్యూళ్ళకు యాక్సెస్‌ను పరిమితం చేస్తుంది. కనీస యాక్సెస్ ఇవ్వండి. సిబ్బంది వెళ్ళిపోయినప్పుడు వెంటనే పాత్రలు మార్చండి.',
    },
    sections: [
      {
        title: { en: 'Role permissions table', te: 'పాత్ర అనుమతుల పట్టిక' },
        body: {
          en: 'CASHIER: POS only. SALES_PERSON: POS + Bills + Customers. PURCHASE_CHECKER: GRN entry and approval. BRANCH_MANAGER: All operations except Users and Business Settings. ACCOUNTS_PERSON: Reports, Payments, Expenses, Bank — no POS. SUPER_ADMIN: Full access including Users, Settings, and Financial Year. Principle of least privilege: assign the most restrictive role that lets the person do their job.',
          te: 'CASHIER: POS మాత్రమే. SALES_PERSON: POS + బిల్లులు + కస్టమర్లు. PURCHASE_CHECKER: GRN ఎంట్రీ మరియు ఆమోదం. BRANCH_MANAGER: వినియోగదారులు మరియు వ్యాపార సెట్టింగ్‌లు మినహా అన్ని. ACCOUNTS_PERSON: నివేదికలు, చెల్లింపులు, ఖర్చులు, బ్యాంక్ — POS లేదు. SUPER_ADMIN: పూర్తి యాక్సెస్.',
        },
      },
    ],
    relatedTopics: ['shifts', 'settings'],
    tags: ['users', 'roles', 'access', 'permissions', 'staff', 'security'],
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  {
    id: 'settings', route: '/dashboard/settings', module: 'core', version: '1.0',
    title: { en: 'Settings', te: 'సెట్టింగ్‌లు' },
    summary: {
      en: 'Business configuration — bill number format, loyalty rate, print template, GST defaults, and branch details. Changes affect all future bills. Review at initial setup and before each new financial year.',
      te: 'వ్యాపార కాన్ఫిగరేషన్ — బిల్ నంబర్ ఫార్మాట్, లాయల్టీ రేటు, ప్రింట్ టెంప్లేట్, GST డిఫాల్ట్‌లు మరియు శాఖ వివరాలు. మార్పులు అన్ని భవిష్యత్ బిల్లులను ప్రభావితం చేస్తాయి.',
    },
    sections: [
      {
        title: { en: 'Bill series — number format', te: 'బిల్ సిరీస్ — నంబర్ ఫార్మాట్' },
        body: {
          en: 'Defines prefix and numbering per document type. Sales: INV/25-26/0001. GRN: GRN/25-26/0001. PO: PO-20250702-0001. Financial year code (25-26) resets at year-end. Set starting number when creating a new year. Never change series mid-year — it breaks the audit trail and confuses your CA.',
          te: 'డాక్యుమెంట్ రకానికి ప్రిఫిక్స్ మరియు నంబరింగ్ నిర్వచిస్తుంది. అమ్మకాలు: INV/25-26/0001. GRN: GRN/25-26/0001. PO: PO-20250702-0001. ఆర్థిక సంవత్సర కోడ్ (25-26) సంవత్సరం చివరిలో రీసెట్ అవుతుంది. సిరీస్ సంవత్సరం మధ్యలో మార్చవద్దు.',
        },
      },
      {
        title: { en: 'Financial year — how to close and open', te: 'ఆర్థిక సంవత్సరం — ఎలా మూసివేయాలి మరియు తెరవాలి' },
        body: {
          en: 'Before April 1: Settings → Financial Year → Create New Year (e.g. 2025-26). Current year freezes; new bills go into the new year. Stock balance carries forward automatically. Run Stock Take and reconcile before closing. Coordinate with CA for year-end P&L, balance sheet, and ITR filing.',
          te: 'ఏప్రిల్ 1 కంటే ముందు: సెట్టింగ్‌లు → ఆర్థిక సంవత్సరం → కొత్త సంవత్సరం సృష్టించు. ప్రస్తుత సంవత్సరం ఫ్రీజ్ అవుతుంది; కొత్త బిల్లులు కొత్త సంవత్సరంలోకి వెళ్తాయి. స్టాక్ బ్యాలెన్స్ స్వయంచాలకంగా ముందుకు వస్తుంది. మూసివేయడానికి ముందు స్టాక్ టేక్ నడపండి.',
        },
      },
    ],
    relatedTopics: ['users', 'reports', 'day-closure'],
    tags: ['settings', 'financial-year', 'bill-series', 'loyalty', 'configuration'],
  },

  // ── Stock Take ─────────────────────────────────────────────────────────────
  {
    id: 'stock-take', route: '/dashboard/inventory/stock-take', module: 'inventory', version: '1.0',
    title: { en: 'Stock Take', te: 'స్టాక్ టేక్' },
    summary: {
      en: 'Periodic physical count to reconcile system quantities with actual shelf quantities. Run monthly or quarterly. Discrepancies are adjusted with a reason. Approved adjustments update stock and appear in the Inventory Adjustment report.',
      te: 'సిస్టమ్ పరిమాణాలను వాస్తవ షెల్ఫ్ పరిమాణాలతో సమన్వయించడానికి ఆవర్తన శారీరక గణన. నెలవారీ లేదా త్రైమాసికంగా నడపండి. వ్యత్యాసాలు కారణంతో సర్దుబాటు చేయబడతాయి.',
    },
    sections: [
      {
        title: { en: 'Stock take process', te: 'స్టాక్ టేక్ ప్రక్రియ' },
        body: {
          en: '1. Do after day closure (frozen transactions). 2. Print count sheets. 3. Count every PLU physically — blind count (without seeing system qty) is most accurate. 4. Enter counts. System shows Expected vs Actual per PLU. 5. Review variances > 2% of expected — investigate before approving. 6. Enter reason for each adjusted PLU (theft, breakage, expired, counting error). 7. Approve to update stock.',
          te: '1. రోజు ముగింపు తర్వాత చేయండి. 2. కౌంట్ షీట్‌లు ప్రింట్ చేయండి. 3. ప్రతి PLU శారీరకంగా లెక్కించండి — బ్లైండ్ కౌంట్ (సిస్టమ్ qty చూడకుండా) అత్యంత ఖచ్చితమైనది. 4. గణనలు నమోదు చేయండి. 5. ఆమోదించే ముందు వ్యత్యాసాలు > 2% పరిశోధించండి. 6. ప్రతి PLU కారణం నమోదు చేయండి. 7. స్టాక్ అప్‌డేట్ చేయడానికి ఆమోదించండి.',
        },
      },
    ],
    relatedTopics: ['products', 'plu', 'reports'],
    tags: ['stock-take', 'inventory', 'count', 'adjustment', 'variance'],
  },

  // ── Reorder Dashboard ──────────────────────────────────────────────────────
  {
    id: 'reorder', route: '/dashboard/reorder', module: 'inventory', version: '1.0',
    title: { en: 'Reorder Dashboard', te: 'రీఆర్డర్ డాష్‌బోర్డ్' },
    summary: {
      en: 'All products at or below reorder level in one view. Bulk-create Purchase Orders for multiple items across multiple suppliers in one click. More efficient than going to each product individually.',
      te: 'రీఆర్డర్ స్థాయికి లేదా దానికంటే తక్కువగా ఉన్న అన్ని ఉత్పత్తులు ఒక వీక్షణలో. ఒక్క క్లిక్‌లో అనేక సరఫరాదారుల అంతటా అనేక వస్తువులకు కొనుగోలు ఆర్డర్లు బల్క్-సృష్టించండి.',
    },
    sections: [
      {
        title: { en: 'Bulk ordering workflow', te: 'బల్క్ ఆర్డర్ వర్క్‌ఫ్లో' },
        body: {
          en: 'Check items to order → "Create POs" button. System groups by preferred supplier, creates one Draft PO per supplier. Review each PO, adjust quantities, then send. Items without a preferred supplier are flagged — assign one in Product settings first. After ordering, items disappear from this screen once a SENT or above PO exists for them.',
          te: 'ఆర్డర్ చేయాల్సిన వస్తువులు చెక్ చేయండి → "PO లు సృష్టించు" బటన్. సిస్టమ్ ప్రెఫర్డ్ సరఫరాదారు వారీగా గ్రూప్ చేసి, సరఫరాదారుకు ఒక Draft PO సృష్టిస్తుంది. ప్రతి PO సమీక్షించండి, పరిమాణాలు సర్దుబాటు చేయండి, తర్వాత పంపండి.',
        },
      },
    ],
    relatedTopics: ['purchase-orders', 'products', 'dashboard'],
    tags: ['reorder', 'stock', 'purchase-orders', 'low-stock', 'bulk'],
  },

  // ── Online Orders ──────────────────────────────────────────────────────────
  {
    id: 'online-orders', route: '/dashboard/online-orders', module: 'sales', version: '2.0',
    title: { en: 'Online Orders', te: 'ఆన్‌లైన్ ఆర్డర్లు' },
    summary: {
      en: 'Orders from your online storefront appear here in real time. Click any order to see full details, edit items, print a picking list, and assign a packer. Stock is reserved the moment an order is placed and released if it is cancelled. Payment modes: COD (collect at door) or Razorpay (already paid online).',
      te: 'మీ ఆన్‌లైన్ స్టోర్‌ఫ్రంట్ నుండి ఆర్డర్లు ఇక్కడ నిజ సమయంలో కనిపిస్తాయి. పూర్తి వివరాలు చూడటానికి, వస్తువులు సవరించడానికి, పికింగ్ జాబితా ప్రింట్ చేయడానికి ఏదైనా ఆర్డర్‌పై క్లిక్ చేయండి. ఆర్డర్ వచ్చిన వెంటనే స్టాక్ రిజర్వ్ అవుతుంది; రద్దు చేస్తే తిరిగి వస్తుంది.',
    },
    sections: [
      {
        title: { en: 'Order status flow', te: 'ఆర్డర్ స్థితి ప్రవాహం' },
        body: {
          en: 'Pending COD → Confirm (call the customer if needed). Confirmed → Mark Processing while packing. Processing/Ready → Mark Delivered once handed over. COD orders: collect the total at the door — it is marked paid automatically on delivery. Razorpay orders arrive already paid and confirmed. Cancelling at any stage before delivery returns the reserved stock to the shelf automatically.',
          te: 'Pending COD → నిర్ధారించండి (అవసరమైతే కస్టమర్‌కు కాల్ చేయండి). Confirmed → ప్యాక్ చేసేటప్పుడు Processing గుర్తించండి. అందజేసిన తర్వాత Delivered గుర్తించండి. COD ఆర్డర్లు: డోర్ వద్ద మొత్తం వసూలు చేయండి. Razorpay ఆర్డర్లు ముందే చెల్లించబడతాయి. డెలివరీకి ముందు రద్దు చేస్తే స్టాక్ ఆటోమేటిక్‌గా తిరిగి వస్తుంది.',
        },
      },
      {
        title: { en: 'Editing an order (add / remove / change items)', te: 'ఆర్డర్ సవరించడం (వస్తువులు జోడించడం / తీసివేయడం / మార్చడం)' },
        body: {
          en: 'Open the order and use the +/− buttons to change quantities, the trash button to remove an item (tap twice to confirm), or "Add Item" to search and add a product. Stock is adjusted automatically with every change, existing items keep the price agreed when the order was placed, and the customer gets a WhatsApp with the new total. Every edit is recorded in the History panel — nothing changes silently. Orders can be edited from Confirmed until Delivered.',
          te: 'ఆర్డర్ తెరిచి +/− బటన్లతో పరిమాణం మార్చండి, వస్తువు తీసివేయడానికి ట్రాష్ బటన్ (నిర్ధారించడానికి రెండుసార్లు నొక్కండి), లేదా "Add Item" తో కొత్త వస్తువు జోడించండి. ప్రతి మార్పుతో స్టాక్ ఆటోమేటిక్‌గా సర్దుబాటు అవుతుంది, కస్టమర్‌కు కొత్త మొత్తంతో WhatsApp వెళుతుంది. ప్రతి మార్పు History ప్యానెల్‌లో నమోదు అవుతుంది.',
        },
      },
      {
        title: { en: 'Wallet settlement on paid orders', te: 'చెల్లించిన ఆర్డర్లలో వాలెట్ సర్దుబాటు' },
        body: {
          en: 'If a customer already paid online (Razorpay) and an edit makes the total SMALLER, the difference is automatically credited to their Store Wallet — no bank refund needed. They can use it on any future purchase; you can see and redeem it from their Customer 360 page. If an edit makes the total BIGGER, the order shows "Collect at delivery ₹X" and it prints on the order slip so the delivery person knows to collect it.',
          te: 'కస్టమర్ ఆన్‌లైన్‌లో (Razorpay) ముందే చెల్లించి, సవరణ వల్ల మొత్తం తగ్గితే — తేడా ఆటోమేటిక్‌గా వారి స్టోర్ వాలెట్‌కు జమ అవుతుంది, బ్యాంక్ రీఫండ్ అవసరం లేదు. భవిష్యత్ కొనుగోళ్లలో వాడుకోవచ్చు. మొత్తం పెరిగితే "Collect at delivery ₹X" ఆర్డర్‌పై చూపబడుతుంది మరియు స్లిప్‌పై ప్రింట్ అవుతుంది.',
        },
      },
      {
        title: { en: 'Picking list, packer assignment & delivery slot', te: 'పికింగ్ జాబితా, ప్యాకర్ నియామకం & డెలివరీ స్లాట్' },
        body: {
          en: '"Picking List" prints a tick-box checklist sorted by shelf location (bin code / aisle-rack), so the packer walks the store in one pass. "Assigned to" records who is packing or delivering — it prints on the picking list. The delivery slot can be edited with the pencil icon if the customer asks for a different time; the change is logged in History.',
          te: '"Picking List" షెల్ఫ్ స్థానం ప్రకారం క్రమబద్ధీకరించిన చెక్‌లిస్ట్ ప్రింట్ చేస్తుంది — ప్యాకర్ ఒకే రౌండ్‌లో దుకాణం అంతా తిరగవచ్చు. "Assigned to" ఎవరు ప్యాక్/డెలివరీ చేస్తున్నారో నమోదు చేస్తుంది. కస్టమర్ వేరే సమయం అడిగితే పెన్సిల్ ఐకాన్‌తో డెలివరీ స్లాట్ మార్చవచ్చు.',
        },
      },
    ],
    commonMistakes: [
      {
        mistake: { en: 'Refunding a paid order difference by cash or bank transfer after removing an item', te: 'వస్తువు తీసివేసిన తర్వాత నగదు లేదా బ్యాంక్ ద్వారా రీఫండ్ చేయడం' },
        fix: { en: 'You do not need to — the difference is already credited to the customer\'s Store Wallet automatically. Check the order\'s Payment card: "Wallet credited ₹X". Refunding again would pay the customer twice.', te: 'అవసరం లేదు — తేడా ఆటోమేటిక్‌గా కస్టమర్ స్టోర్ వాలెట్‌కు జమ అయింది. ఆర్డర్ Payment కార్డ్ చూడండి: "Wallet credited ₹X". మళ్లీ రీఫండ్ చేస్తే కస్టమర్‌కు రెండుసార్లు చెల్లించినట్లే.' },
      },
      {
        mistake: { en: 'Removing every item to cancel an order', te: 'ఆర్డర్ రద్దు చేయడానికి అన్ని వస్తువులు తీసివేయడం' },
        fix: { en: 'The last item cannot be removed. Use the Cancel Order button instead — it releases all reserved stock and notifies the customer properly.', te: 'చివరి వస్తువు తీసివేయలేరు. బదులుగా Cancel Order బటన్ వాడండి — ఇది రిజర్వ్ చేసిన స్టాక్ మొత్తం విడుదల చేసి కస్టమర్‌కు సరిగ్గా తెలియజేస్తుంది.' },
      },
    ],
    relatedTopics: ['pos', 'bills', 'customers'],
    tags: ['online-orders', 'storefront', 'delivery', 'razorpay', 'cod', 'wallet', 'picking-list', 'edit-order'],
  },

  // ── Estimates ──────────────────────────────────────────────────────────────
  {
    id: 'estimates', route: '/dashboard/estimates', module: 'sales', version: '1.0',
    title: { en: 'Estimates / Quotations', te: 'అంచనాలు / కోటేషన్‌లు' },
    summary: {
      en: 'Create price quotes without affecting stock. Convert to a bill when the customer confirms. Useful for bulk orders, catering, and institutional purchases. Estimates expire after 30 days by default.',
      te: 'స్టాక్‌ను ప్రభావితం చేయకుండా ధర కోటేషన్‌లు సృష్టించండి. కస్టమర్ నిర్ధారించినప్పుడు బిల్‌కు మార్చండి. బల్క్ ఆర్డర్లు, క్యాటరింగ్ మరియు సంస్థాగత కొనుగోళ్ళకు ఉపయోగకరం.',
    },
    sections: [
      {
        title: { en: 'Converting estimate to bill', te: 'అంచనాను బిల్‌కు మార్చడం' },
        body: {
          en: 'Open estimate → "Convert to Bill" → items load into POS cart. Adjust quantities if needed → complete payment. Estimate marked CONVERTED, linked to the bill. Estimates do not reserve stock — if an item sold out before conversion, POS shows a stock warning. Issue a new estimate if quantities changed significantly.',
          te: 'అంచనా తెరవండి → "బిల్‌కు మార్చు" → వస్తువులు POS కార్ట్‌లో లోడ్ అవుతాయి. అవసరమైతే పరిమాణాలు సర్దుబాటు చేయండి → చెల్లింపు పూర్తి చేయండి. అంచనా CONVERTED గా గుర్తించబడుతుంది. అంచనాలు స్టాక్‌ను రిజర్వ్ చేయవు.',
        },
      },
    ],
    relatedTopics: ['pos', 'customers', 'bills'],
    tags: ['estimates', 'quotations', 'bulk', 'wholesale', 'catering'],
  },

  // ── GST Health ─────────────────────────────────────────────────────────────
  {
    id: 'gst-health', route: '/dashboard/reports/gst-health', module: 'reports', version: '1.0',
    title: { en: 'GST Health Check', te: 'GST ఆరోగ్య తనిఖీ' },
    summary: {
      en: 'Scans your data for GST filing problems: missing HSN codes, wrong tax rates, suppliers without GSTIN, and ITC mismatches. Fix all warnings before the month\'s GST filing due date to avoid notices.',
      te: 'GST ఫైలింగ్ సమస్యల కోసం మీ డేటాను స్కాన్ చేస్తుంది: తప్పిన HSN కోడ్‌లు, తప్పు పన్ను రేట్లు, GSTIN లేని సరఫరాదారులు మరియు ITC మిస్‌మ్యాచ్‌లు. నోటీసులు నివారించడానికి నెలల GST ఫైలింగ్ గడువు తేదీ కంటే ముందు అన్ని హెచ్చరికలు పరిష్కరించండి.',
    },
    relatedTopics: ['reports-gst', 'hsn', 'products', 'suppliers'],
    tags: ['gst-health', 'errors', 'hsn', 'filing', 'compliance'],
  },

  // ── Ageing Report ─────────────────────────────────────────────────────────
  {
    id: 'ageing', route: '/dashboard/reports/ageing', module: 'reports', version: '1.0',
    title: { en: 'Ageing Report', te: 'ఏజింగ్ నివేదిక' },
    summary: {
      en: 'Shows how long receivables (customer credit) and payables (supplier dues) have been outstanding, grouped by 0–30, 31–60, 61–90, and 90+ days. Essential for cash-flow management — know who owes you and who you owe, and for how long.',
      te: 'రిసీవబుల్స్ (కస్టమర్ క్రెడిట్) మరియు పేయబుల్స్ (సరఫరాదారు బకాయిలు) ఎంత కాలంగా బాకీ ఉన్నాయో 0–30, 31–60, 61–90 మరియు 90+ రోజులుగా గ్రూప్ చేసి చూపిస్తుంది.',
    },
    sections: [
      {
        title: { en: 'How to use the ageing report', te: 'ఏజింగ్ నివేదికను ఎలా ఉపయోగించాలి' },
        body: {
          en: 'Customer Ageing: Red (90+ days) = call immediately. Orange (61–90) = send WhatsApp reminder. Supplier Ageing: Overdue (past payment terms) in red — pay before the supplier stops supply. Sort by amount to prioritise largest first. Export to Excel for your weekly collections meeting. Payment terms for each supplier are set in the Supplier master.',
          te: 'కస్టమర్ ఏజింగ్: ఎరుపు (90+ రోజులు) = వెంటనే కాల్ చేయండి. నారింజ (61–90) = WhatsApp రిమైండర్ పంపండి. సరఫరాదారు ఏజింగ్: గడువు మించిన (చెల్లింపు నిబంధనలు దాటిన) ఎరుపులో — సరఫరాదారు సరఫరాను ఆపడానికి ముందు చెల్లించండి.',
        },
      },
    ],
    relatedTopics: ['customers', 'suppliers', 'payments'],
    tags: ['ageing', 'receivables', 'payables', 'credit', 'cash-flow'],
  },

  // ── Opening Stock ──────────────────────────────────────────────────────────
  {
    id: 'opening-stock', route: '/dashboard/inventory/opening-stock', module: 'inventory', version: '1.0',
    title: { en: 'Opening Stock', te: 'ఓపెనింగ్ స్టాక్' },
    summary: {
      en: 'Set initial stock quantities when first setting up the ERP or at new financial year start. Run once — after that, GRNs and bills maintain stock automatically. Use Stock Adjustment (not this page) for mid-year corrections.',
      te: 'ERP మొదటిసారి సెటప్ చేసేటప్పుడు లేదా కొత్త ఆర్థిక సంవత్సరం ప్రారంభంలో ప్రారంభ స్టాక్ పరిమాణాలు సెట్ చేయండి. ఒకసారి నడపండి — ఆ తర్వాత, GRN లు మరియు బిల్లులు స్వయంచాలకంగా స్టాక్‌ను నిర్వహిస్తాయి.',
    },
    sections: [
      {
        title: { en: 'Entering correctly', te: 'సరిగ్గా నమోదు చేయడం' },
        body: {
          en: 'Count physical stock as of the cut-off date (day before go-live). Enter qty and cost price per PLU. If multiple batches at different costs exist, create separate PLUs before entering. Verify totals match your physical inventory sheet before saving. After approval, opening stock is locked and cannot be re-entered.',
          te: 'కట్-ఆఫ్ తేదీ నాటికి శారీరక స్టాక్ లెక్కించండి. PLU కు qty మరియు ధర ధర నమోదు చేయండి. వేర్వేరు ధరలలో అనేక బ్యాచ్‌లు ఉంటే, నమోదు చేయడానికి ముందు వేర్వేరు PLU లు సృష్టించండి. సేవ్ చేయడానికి ముందు మొత్తాలు మీ శారీరక ఇన్వెంటరీ షీట్‌తో సరిపోలుతున్నాయని ధృవీకరించండి.',
        },
      },
    ],
    relatedTopics: ['stock-take', 'plu', 'grn'],
    tags: ['opening-stock', 'inventory', 'setup', 'valuation', 'go-live'],
  },

  // ── CA Export ─────────────────────────────────────────────────────────────
  {
    id: 'ca-export', route: '/dashboard/reports/ca-export', module: 'reports', version: '1.0',
    title: { en: 'CA Export — Complete Guide for Chartered Accountants', te: 'CA ఎగుమతి — చార్టర్డ్ అకౌంటెంట్ల కోసం పూర్తి గైడ్' },
    summary: {
      en: 'One-click Excel workbook for your CA containing 9 structured sheets: Purchase Register (ITC), Sales Register (Output GST), Bank Transactions, Bank Reconciliation, Expense Summary, Supplier Outstanding, Stock Register, GST Summary, and a cover Summary. Select the date range (typically the full financial year or a quarter) and download. Share this file monthly for GST filing or yearly for ITR.',
      te: 'మీ CA కోసం ఒక్క క్లిక్‌లో 9 సిద్ధంగా ఉన్న షీట్‌లతో Excel వర్క్‌బుక్ తయారవుతుంది: కొనుగోలు రిజిస్టర్ (ITC కోసం), విక్రయ రిజిస్టర్ (అవుట్‌పుట్ GST కోసం), బ్యాంక్ లావాదేవీలు, బ్యాంక్ సయోధ్య, ఖర్చుల సారాంశం, సరఫరాదారు బకాయి, స్టాక్ రిజిస్టర్, GST సారాంశం మరియు కవర్ పేజీ. తేదీ పరిధి ఎంచుకోండి — GST ఫైలింగ్ కోసం ఒక నెల మొత్తం, ITR కోసం పూర్తి ఆర్థిక సంవత్సరం (01-ఏప్రిల్ నుండి 31-మార్చి) — డౌన్‌లోడ్ చేసి CA కి పంపించండి. మీ CA కి కావలసిన అన్నీ ఒక ఫైల్‌లో ఉంటాయి.',
    },
    fields: {
      dateFrom: { en: 'Start date for the export. For GST filing: first day of the month. For ITR: 01-April of the financial year. Format: YYYY-MM-DD.', te: 'ఎగుమతి కాలం ప్రారంభ తేదీ. నెల GST ఫైలింగ్ కోసం: ఆ నెల 1వ తేదీ వాడండి (ఉదా: 01-జూన్-2025). వార్షిక ITR కోసం: ఆర్థిక సంవత్సరం 01-ఏప్రిల్ వాడండి.' },
      dateTo:   { en: 'End date. For GST: last day of the month. For ITR: 31-March of the financial year.', te: 'ముగింపు తేదీ. నెల GST కోసం: ఆ నెల చివరి రోజు (ఉదా: 30-జూన్-2025). ITR కోసం: ఆర్థిక సంవత్సరం 31-మార్చి. తేదీ తప్పులు రాకుండా Quick Presets బటన్లు వాడండి.' },
    },
    sections: [
      {
        title: { en: 'Sheet 0 — Summary (Cover Page)', te: 'షీట్ 0 — సారాంశం (కవర్ పేజీ)' },
        body:  {
          en: 'Totals at a glance for the selected period: Total Sales (taxable + GST), Total Purchases (taxable + GST), Gross Profit estimate, Total Expenses, Net Payable GST. CA uses this as a quick sanity check before diving into details. If any figure looks wildly off vs the previous period, investigate before filing.',
          te: 'ఎంచుకున్న కాలానికి ఒక్క చూపులో అన్నీ కనిపించే సారాంశం: మొత్తం విక్రయాలు (పన్ను + GST), మొత్తం కొనుగోళ్ళు (పన్ను + GST), స్థూల లాభం అంచనా, నమోదైన మొత్తం ఖర్చులు మరియు చెల్లించాల్సిన నికర GST. మీ CA మొదటగా ఈ పేజీ చూసి వేగంగా తనిఖీ చేస్తారు — ఉదాహరణకు అమ్మకాలు గత త్రైమాసికం కంటే తక్కువగా ఉంటే, లేదా GST ఆశించిన దానికంటే ఎక్కువగా ఉంటే, ఫైల్ చేయడానికి ముందే విచారణ చేస్తారు. వివరాల షీట్లు తెరవడానికి ముందు ఒక్కసారి చూసే డాష్‌బోర్డ్ అని అర్థం చేసుకోండి.',
        },
      },
      {
        title: { en: 'Sheet 1 — Purchase Register (ITC Workbook)', te: 'షీట్ 1 — కొనుగోలు రిజిస్టర్ (ITC వర్క్‌బుక్)' },
        body:  {
          en: 'Every GRN (goods receipt) in the period: Supplier name, GSTIN, Invoice number, Invoice date, HSN, Taxable amount, CGST, SGST, IGST, Total. CA uses this to:\n• Claim Input Tax Credit (ITC) in GSTR-3B Table 4\n• Match against supplier GSTR-1 in GSTR-2B reconciliation\n• File GSTR-2A/2B reconciliation report\n• Verify that IGST was charged for inter-state purchases (supplier GSTIN starts with a different state code than 36 = Telangana)\nImportant: ITC is claimable only if the supplier has filed their GSTR-1 and the invoice appears in your GSTR-2B. Ask CA to do GSTR-2B matching every month.',
          te: 'కాలంలో నమోదైన ప్రతి GRN (సరుకు అందుకోవడం) జాబితా: సరఫరాదారు పేరు, సరఫరాదారు GSTIN, ఇన్‌వాయిస్ నంబర్, ఇన్‌వాయిస్ తేదీ, HSN కోడ్, పన్ను విధించదగిన మొత్తం, CGST, SGST, IGST, మొత్తం ఇన్‌వాయిస్ విలువ. మీ CA ఈ షీట్‌ను ఇలా ఉపయోగిస్తారు:\n• ఇన్‌పుట్ టాక్స్ క్రెడిట్ (ITC) క్లెయిమ్ చేయడానికి — సరఫరాదారులకు చెల్లించిన CGST+SGST లేదా IGST ప్రతి రూపాయి ప్రభుత్వానికి చెల్లించాల్సిన GST తగ్గిస్తుంది (GSTR-3B Table 4)\n• GSTR-2B తో ప్రతి ఇన్‌వాయిస్ సరిచూడడానికి — GSTR-2B లో కనిపించే ఇన్‌వాయిస్‌లకు మాత్రమే ITC క్లెయిమ్ చేయవచ్చు\n• రాష్ట్రాంతర కొనుగోళ్ళకు IGST సరిగ్గా వేయబడిందో తనిఖీ చేయడానికి — సరఫరాదారు GSTIN 36 (తెలంగాణ) తప్ప వేరే స్టేట్ కోడ్‌తో మొదలైతే IGST వేయాల్సింది\n• ERP లో నమోదు కాని ఇన్‌వాయిస్‌లు గుర్తించడానికి — GRN లేకుండా వదిలిపెట్టిన ఇన్‌వాయిస్‌లు అంటే పోగొట్టుకున్న ITC\nముఖ్యమైన నియమం: మీ సరఫరాదారు GSTR-1 ఫైల్ చేయకపోతే, ఆ ఇన్‌వాయిస్ మీ GSTR-2B లో కనిపించదు, ఆ నెలలో ITC క్లెయిమ్ చేయలేరు. GSTR-2B లో పదేపదే కనిపించని సరఫరాదారులను అనుసరించండి.',
        },
      },
      {
        title: { en: 'Sheet 2 — Sales Register (Output GST)', te: 'షీట్ 2 — విక్రయ రిజిస్టర్ (అవుట్‌పుట్ GST)' },
        body:  {
          en: 'Every sales bill: Bill number, Date, Customer name, Customer GSTIN (if B2B), Payment mode (Cash/UPI/Card/Credit), Taxable amount, CGST, SGST, IGST, Grand Total. CA uses this to:\n• File GSTR-1 (outward supplies) — B2B invoices with customer GSTIN go to Table 4; B2C invoices above Rs.2.5 lakh go to Table 5; rest aggregate into Table 7\n• Compute Output GST rate-wise for GSTR-3B Table 3.1\n• Verify that all credit sales are recorded (match against customer outstanding)\n• Detect missing GST if a B2B customer gave a GSTIN but was billed as B2C',
          te: 'ప్రతి విక్రయ బిల్లు జాబితా: బిల్లు నంబర్, తేదీ, కస్టమర్ పేరు, కస్టమర్ GSTIN (ఇచ్చినట్లయితే), చెల్లింపు విధానం (నగదు/UPI/కార్డ్/క్రెడిట్), పన్ను విధించదగిన మొత్తం, CGST, SGST, IGST, మొత్తం బిల్లు విలువ. మీ CA ఇలా ఉపయోగిస్తారు:\n• GSTR-1 ఫైల్ చేయడానికి (తదుపరి నెల 11వ తేదీలోపు) — కస్టమర్ GSTIN ఇచ్చిన B2B ఇన్‌వాయిస్‌లు Table 4 లో వేస్తారు; రూ.2.5 లక్షలు దాటిన B2C బిల్లులు Table 5 లో వేస్తారు; మిగతా చిన్న B2C బిల్లులు Table 7 లో కలిపి చూపిస్తారు\n• GSTR-3B Table 3.1 కోసం రేటు వారీగా (5%, 12%, 18%) మొత్తం అవుట్‌పుట్ GST లెక్కించడానికి\n• క్రెడిట్ విక్రయాలు సరిచూడడానికి — క్రెడిట్ విధానంలో చేసిన బిల్లుల మొత్తం పుస్తకాల్లో కస్టమర్ బకాయిగా చూపించాల్సింది\n• B2B కస్టమర్ GSTIN ఇచ్చినా B2C గా బిల్లు చేసిన కేసులు పట్టుకోవడానికి — అటువంటి ఇన్‌వాయిస్‌లను GSTR-1 లో వేరుగా B2B గా నివేదించాలి',
        },
      },
      {
        title: { en: 'Sheet 3 — Bank Transactions', te: 'షీట్ 3 — బ్యాంక్ లావాదేవీలు' },
        body:  {
          en: 'Complete bank ledger across all accounts: Date, Description, Credit, Debit, Balance, Match status (Matched / Unmatched), Reference. CA uses this to:\n• Verify cash flow — total credits should reconcile with Sales + Supplier payments received\n• Identify unaccounted deposits (possible income not entered in ERP)\n• Detect duplicate payments\n• Support Form 26AS / AIS reconciliation for income tax\n• Prepare books of accounts for tax audit if turnover > Rs.1 crore',
          te: 'అన్ని లింక్ చేసిన బ్యాంక్ ఖాతాల పూర్తి లెడ్జర్: తేదీ, వివరణ, క్రెడిట్ మొత్తం, డెబిట్ మొత్తం, నడుస్తున్న బ్యాలెన్స్, మ్యాచ్ స్థితి (Matched = ERP లో బిల్లు/చెల్లింపు/ఖర్చుకు అనుసంధానించబడింది; Unmatched = ఇంకా అనుసంధానించలేదు). మీ CA ఇలా ఉపయోగిస్తారు:\n• నమోదైన విక్రయాలు + ఇతర ఆదాయంతో మొత్తం బ్యాంక్ క్రెడిట్‌లు సరిపోతున్నాయా తనిఖీ చేయడానికి — వివరించలేని డిపాజిట్ ERP లో నమోదు కాని ఆదాయాన్ని సూచిస్తుంది\n• నకిలీ చెల్లింపులు కనుగొనడానికి — అదే సరఫరాదారుకు రెండుసార్లు చెల్లించినట్లయితే అదే తేదీలో అదే మొత్తంలో రెండు డెబిట్‌లు కనిపిస్తాయి\n• Form 26AS/AIS రీకాన్సిలేషన్‌కు మద్దతివ్వడానికి — ఆదాయపు పన్ను శాఖ నిర్దిష్ట పరిమితులకు మించిన అన్ని బ్యాంక్ క్రెడిట్‌లను సేకరిస్తుంది\n• Sec 44AB కింద పన్ను ఆడిట్‌కు (టర్నోవర్ రూ.1 కోటి మించినట్లయితే తప్పనిసరి) అవసరమైన లెక్కల పుస్తకాలు నిర్మించడానికి',
        },
      },
      {
        title: { en: 'Sheet 4 — Bank Reconciliation', te: 'షీట్ 4 — బ్యాంక్ సయోధ్య (BRS)' },
        body:  {
          en: 'Per-account summary: Opening balance (from bank statement), Closing balance (from bank statement), Book balance (from ERP), Difference, List of unmatched transactions. CA uses this to:\n• Ensure books agree with the bank — a difference means either a transaction was not entered in ERP, or a bank charge/interest was missed\n• Prepare the Bank Reconciliation Statement (BRS) required for audit\n• Identify unclaimed cheques (issued but not encashed)\nTarget: difference should be zero or explained by timing (cheques in transit, bank charges not yet in ERP).',
          te: 'ఖాతా వారీ సారాంశం: ప్రారంభ బ్యాలెన్స్ (బ్యాంక్ స్టేట్‌మెంట్ ప్రకారం), ముగింపు బ్యాలెన్స్ (బ్యాంక్ స్టేట్‌మెంట్ ప్రకారం), పుస్తకాల బ్యాలెన్స్ (ERP ప్రకారం), తేడా మరియు అన్‌మ్యాచ్డ్ లావాదేవీల జాబితా. మీ CA ఇలా ఉపయోగిస్తారు:\n• ERP పుస్తకాలు వాస్తవ బ్యాంక్‌కు సరిపోతున్నాయో నిర్ధారించడానికి — ఏదైనా తేడా అంటే ఒక లావాదేవీ ERP లో నమోదు కాలేదు (ఉదా: బ్యాంక్ చార్జ్ లేదా వడ్డీ) లేదా రెండుసార్లు నమోదైంది\n• బ్యాంక్ రీకాన్సిలేషన్ స్టేట్‌మెంట్ (BRS) తయారు చేయడానికి — ఆడిట్‌కు తప్పనిసరి పత్రం; ఆడిటర్ తప్పక అడుగుతారు\n• వాడుకోని చెక్కులు గుర్తించడానికి — మీరు సరఫరాదారులకు ఇచ్చిన చెక్కులు వారు వేయకపోతే, ERP లో చెల్లింపుగా కనిపించినా బ్యాంక్ బ్యాలెన్స్ తగ్గదు\nలక్ష్యం: తేడా కాలమ్ సున్నా ఉండాలి, లేదా స్పష్టమైన కారణం వివరించబడాలి. వివరించలేని తేడా ఆడిటర్‌కు హెచ్చరిక సంకేతం.',
        },
      },
      {
        title: { en: 'Sheet 5 — Expense Summary', te: 'షీట్ 5 — ఖర్చుల సారాంశం' },
        body:  {
          en: 'Month-wise breakdown of all expenses by category: Rent, Electricity, Salaries, Packaging, Transport, Bank Charges, Maintenance, Other. CA uses this to:\n• Map to P&L line items (above-the-line vs below-the-line)\n• Verify allowability under Income Tax Act — rent paid to a relative requires a proper agreement; salary to family members must be at market rate\n• Identify expenses that need TDS deduction: Rent > Rs.50,000/month requires TDS @ 5% u/s 194IB; Contractor payments > Rs.30,000 per contract require TDS @ 1% u/s 194C\n• Check if any capital expenditure (CCTV, refrigerator, computer) was entered as expense instead of asset',
          te: 'అన్ని ఖర్చులను నెల వారీగా వర్గం ప్రకారం విభజన: అద్దె, విద్యుత్, జీతాలు & వేతనాలు, ప్యాకేజింగ్, రవాణా, బ్యాంక్ చార్జీలు, నిర్వహణ మరియు ఇతరాలు. మీ CA ఇలా ఉపయోగిస్తారు:\n• ప్రతి వర్గాన్ని P&L లైన్ అంశాలకు మ్యాప్ చేయడానికి — Above-the-line (అమ్మిన వస్తువుల వ్యయం) vs Below-the-line (నిర్వహణ ఖర్చులు)\n• ఆదాయపు పన్ను చట్టం కింద అనుమతి ధృవీకరించడానికి — కుటుంబ సభ్యులకు అద్దె చెల్లింపు సరైన అద్దె ఒప్పందం మరియు మార్కెట్ రేటుతో ఉండాలి\n• TDS బాధ్యత ఉండే ఖర్చులు గుర్తించడానికి: నెలకు రూ.50,000 కంటే ఎక్కువ అద్దె అంటే Section 194IB కింద 5% TDS; ఒక ఒప్పందానికి రూ.30,000 మించిన కాంట్రాక్టర్ చెల్లింపులు Section 194C కింద 1% TDS అవసరం\n• ఖర్చులుగా తప్పుగా నమోదైన మూలధన వ్యయాలు పట్టుకోవడానికి — CCTV కెమెరాలు, రిఫ్రిజిరేటర్లు, కంప్యూటర్లు Fixed Asset Register లో ఉండాలి, నేరుగా ఖర్చులుగా వేయకూడదు',
        },
      },
      {
        title: { en: 'Sheet 6 — Supplier Outstanding (Creditors Ageing)', te: 'షీట్ 6 — సరఫరాదారు బకాయి (క్రెడిటర్స్ ఏజింగ్)' },
        body:  {
          en: 'All suppliers with outstanding balance, bucketed by age: 0–30 days, 31–60 days, 61–90 days, 90+ days. Also shows last invoice date and last payment date. CA uses this to:\n• Prepare Creditors Schedule for Balance Sheet\n• Identify unpaid invoices where TDS should have been deducted but payment is pending\n• Assess working capital — large 90+ day balances may signal cash flow stress\n• Verify that supplier advances (if any) are netted correctly',
          te: 'బకాయి బ్యాలెన్స్ ఉన్న అన్ని సరఫరాదారులు, అత్యంత పాత చెల్లించని ఇన్‌వాయిస్ ఆధారంగా వయసు బకెట్‌లలో: 0-30 రోజులు (ప్రస్తుతం), 31-60 రోజులు, 61-90 రోజులు, 90+ రోజులు (గడువు మించింది). సరఫరాదారు వారీగా చివరి ఇన్‌వాయిస్ తేదీ మరియు చివరి చెల్లింపు తేదీ కూడా చూపిస్తుంది. మీ CA ఇలా ఉపయోగిస్తారు:\n• బ్యాలెన్స్ షీట్ కోసం క్రెడిటర్స్ షెడ్యూల్ (Trade Payables Schedule) తయారు చేయడానికి — బ్యాలెన్స్ ఉన్న ప్రతి సరఫరాదారు జాబితాలో ఉండాలి\n• 90+ రోజుల బకెట్‌లో చెల్లింపు జరిగినప్పుడు TDS తీసివేయాల్సిన ఇన్‌వాయిస్‌లు గుర్తించడానికి — చెల్లింపు జరిగిన తర్వాత 7 రోజులలోపు TDS జమ చేయాలి\n• వర్కింగ్ క్యాపిటల్ ఆరోగ్యం అంచనా వేయడానికి — పెద్ద 90+ రోజుల బకెట్ అంటే సరఫరాదారుల సంబంధాలు దెబ్బతింటాయి, నగదు ప్రవాహ సమస్య సూచిస్తుంది\n• సంవత్సరంలో చెల్లించిన సరఫరాదారు అడ్వాన్సులు GRN లకు సరిగ్గా సర్దుబాటు అయ్యాయో నిర్ధారించడానికి',
        },
      },
      {
        title: { en: 'Sheet 7 — Stock Register', te: 'షీట్ 7 — స్టాక్ రిజిస్టర్' },
        body:  {
          en: 'All stock movements in the period: Product, Date, Movement type (Purchase In / Sale Out / Adjustment), Quantity, Cost per unit, Total value. CA uses this to:\n• Compute Closing Stock value for Balance Sheet — Opening Stock + Purchases − Sales (at cost) = Closing Stock\n• Verify COGS (Cost of Goods Sold) for P&L: COGS = Opening Stock + Purchases − Closing Stock\n• Identify write-offs or adjustment entries that reduce stock without a corresponding sale\n• Check for shrinkage — if COGS % of sales is unusually high vs prior year, investigate pilferage or data entry errors',
          te: 'కాలంలోని అన్ని స్టాక్ కదలికలు: ఉత్పత్తి పేరు, తేదీ, కదలిక రకం (కొనుగోలు వచ్చింది / అమ్మకం వెళ్ళింది / సర్దుబాటు / రైటాఫ్), పరిమాణం, యూనిట్ వ్యయం, వ్యయం ప్రకారం మొత్తం విలువ. మీ CA ఇలా ఉపయోగిస్తారు:\n• బ్యాలెన్స్ షీట్ కోసం ముగింపు స్టాక్ లెక్కించడానికి: ప్రారంభ స్టాక్ + కొనుగోళ్ళు (వ్యయం ప్రకారం) − అమ్మిన వస్తువుల వ్యయం = ముగింపు స్టాక్. ఇది ఫిజికల్ స్టాక్ లెక్కింపు విలువకు సరిపోవాలి\n• P&L లో COGS ధృవీకరించడానికి: COGS = ప్రారంభ స్టాక్ + కొనుగోళ్ళు − ముగింపు స్టాక్. COGS అమ్మకాల శాతం గత సంవత్సరం కంటే అసాధారణంగా ఎక్కువగా ఉంటే పాడైపోవడం, దొంగతనం లేదా తప్పు వ్యయ ధరలు కావచ్చు\n• స్టాక్ రైటాఫ్ లేదా మాన్యువల్ సర్దుబాటు ఎంట్రీలు గుర్తించడానికి — ఇవి అమ్మకం లేకుండా స్టాక్ తగ్గిస్తాయి, P&L లో shrinkage లేదా write-off గా నష్టాలు కనిపించాలి\n• స్టాక్ విలువను బ్యాలెన్స్ షీట్‌లోని ఇన్వెంటరీ ఖాతా బ్యాలెన్స్‌తో సరిపోల్చడానికి',
        },
      },
      {
        title: { en: 'Sheet 8 — GST Summary (Month-wise)', te: 'షీట్ 8 — GST సారాంశం (నెల వారీగా)' },
        body:  {
          en: 'Each month shows: Output GST (from sales) rate-wise (0%, 5%, 12%, 18%), Input GST (from purchases) rate-wise, Net GST Payable = Output − ITC, Cumulative payable. CA uses this to:\n• Cross-verify against GSTR-3B before filing — the system-computed figure should match what GSTN portal shows\n• Identify months where ITC exceeded Output GST (refund may be available for exporters; carry-forward for regular traders)\n• Spot months with unusually high or low tax — may indicate missing invoices\n• GSTR-3B filing deadline: 20th of the following month. Late filing attracts Rs.50/day late fee + 18% interest on unpaid tax',
          te: 'ఎంచుకున్న పరిధిలోని ప్రతి నెలలో: అవుట్‌పుట్ GST (విక్రయాల నుండి) రేటు వారీగా — 0%, 5%, 12%, 18%; ఇన్‌పుట్ GST (కొనుగోళ్ళు/ITC నుండి) రేటు వారీగా; చెల్లించాల్సిన నికర GST = అవుట్‌పుట్ GST − అర్హమైన ITC; మరియు సంవత్సరానికి సంచిత బకాయి. మీ CA ఇలా ఉపయోగిస్తారు:\n• ఫైలింగ్ కోసం GSTR-3B లెక్క ముందే తనిఖీ చేయడానికి — ఇక్కడ లెక్కించిన నికర GST GSTR-1 డేటా నమోదు చేసిన తర్వాత GSTN పోర్టల్ చూపించే దానికి సరిపోవాలి\n• ITC అవుట్‌పుట్ GST కంటే ఎక్కువైన నెలలు గుర్తించడానికి — సాధారణ వ్యాపారులకు ఈ అదనపు మొత్తం తదుపరి నెలకు carry forward అవుతుంది\n• అసాధారణంగా ఎక్కువ లేదా తక్కువ GST ఉన్న నెలలు గుర్తించడానికి — ఆ నెలలో కొన్ని బిల్లులు system లో లేకపోయి ఉండవచ్చు\nఫైలింగ్ గడువు: GSTR-3B తదుపరి నెల 20వ తేదీ లోపు ఫైల్ చేయాలి. ఆలస్య ఫైలింగ్ జరిమానా: రోజుకు రూ.50 (నిల్ రిటర్న్ అయితే రూ.20/రోజు). పన్ను ఆలస్య చెల్లింపు: సంవత్సరానికి 18% వడ్డీ రోజువారీ లెక్కించబడుతుంది. ఉదాహరణ: 20-జూలై గడువు రూ.10,000 GST 20-ఆగష్టున ఫైల్ చేస్తే = 30 రోజులు × 18%/365 × రూ.10,000 = రూ.148 వడ్డీ.',
        },
      },
      {
        title: { en: 'How to use for GST Filing (Monthly Workflow)', te: 'GST ఫైలింగ్ కోసం ఎలా ఉపయోగించాలి (నెల వారీ వర్క్‌ఫ్లో)' },
        body:  {
          en: 'Step 1 — Day after month-end: Owner downloads CA Export for that month (e.g., 01-Jun to 30-Jun). Shares file with CA via WhatsApp or email.\nStep 2 — CA opens Sheet 2 (Sales Register). Filters by B2B customers (those with GSTIN). Uploads to GSTN portal → GSTR-1 → B2B Invoices section. Remaining B2C bills go to B2C aggregate.\nStep 3 — CA opens Sheet 1 (Purchase Register). Cross-checks against GSTR-2B (downloaded from GST portal). Marks invoices that appear in GSTR-2B as eligible ITC. If a supplier invoice is NOT in GSTR-2B, ITC cannot be claimed that month — follow up with supplier.\nStep 4 — CA opens Sheet 8 (GST Summary) for that month. Computes: Net GST = Output GST (Sheet 2 total) − Eligible ITC (verified from Sheet 1). Files GSTR-3B with this figure.\nStep 5 — CA verifies Sheet 4 (Bank Reconciliation) to confirm tax payments are reflected in bank.',
          te: 'దశ 1 (నెల 1-3 తేదీ): Owner ERP లో లాగిన్ అయి → నివేదికలు → CA Export కి వెళ్తారు. తేదీ పరిధి గత నెలకు సెట్ చేసి (ఉదా: 01-జూన్ నుండి 30-జూన్) Excel ఫైల్ డౌన్‌లోడ్ చేసి అదే రోజు WhatsApp లేదా email ద్వారా CA కి పంపిస్తారు.\nదశ 2 (8వ తేదీలోపు): CA షీట్ 2 (విక్రయ రిజిస్టర్) తెరిచి "కస్టమర్ GSTIN" కాలమ్ ప్రకారం సార్ట్ చేస్తారు — GSTIN ఉన్న వరుసలు B2B ఇన్‌వాయిస్‌లు. GST పోర్టల్‌లో GSTR-1 → B2B Invoices table లో ప్రతి B2B ఇన్‌వాయిస్ నమోదు చేస్తారు. GSTIN లేని మిగతా వరుసలు B2C Others table లో రేటు వారీగా కలిపి చూపిస్తారు.\nదశ 3 (10వ తేదీలోపు): CA GST పోర్టల్ నుండి ఆ నెల GSTR-2B డౌన్‌లోడ్ చేసి షీట్ 1 (కొనుగోలు రిజిస్టర్) తో సరిచూస్తారు. GSTR-2B లో ఉన్న ఇన్‌వాయిస్‌లు = అర్హమైన ITC. GSTR-2B లో లేనివి = ఆ నెల క్లెయిమ్ చేయలేరు. CA లేని వాటిని నోట్ చేసుకుని ఆ సరఫరాదారులను సంప్రదిస్తారు.\nదశ 4 (18వ తేదీలోపు): CA షీట్ 8 (GST సారాంశం) తెరిచి ఆ నెల నికర GST తీసుకుని దశ 3 లో క్లెయిమ్ చేయలేని ITC తీసివేసి GSTR-3B ఫైల్ చేస్తారు. GST పోర్టల్‌లో ఈ మొత్తం చెల్లిస్తారు.\nదశ 5 (20వ తేదీలోపు): GSTR-3B ఫైల్ అయింది, GST చెల్లించబడింది. CA owner కి నిర్ధారణ ఇస్తారు. Owner షీట్ 4 (బ్యాంక్ సయోధ్య) చూసి GST చెల్లింపు బ్యాంక్‌లో డెబిట్‌గా కనిపిస్తుందో ధృవీకరిస్తారు.',
        },
      },
      {
        title: { en: 'How to use for Annual ITR Filing', te: 'వార్షిక ITR ఫైలింగ్ కోసం ఎలా ఉపయోగించాలి' },
        body:  {
          en: 'Select full financial year (01-Apr to 31-Mar). Download CA Export. CA uses:\n• Sheet 2 — Gross Sales for ITR turnover\n• Sheet 7 — Opening and Closing Stock values (confirmed by physical stock-take)\n• Sheet 1 — Total Purchases (gross)\n• Sheet 5 — Total Expenses (mapped to Schedule BP — Business Profession)\n• Sheet 3 — Bank statement cross-check for cash withdrawals and deposits\nCA will then prepare: P&L Statement (Sales − COGS − Expenses = Net Profit), Balance Sheet (Capital + Liabilities = Assets), and file ITR-3 (proprietorship) or ITR-4 (presumptive — if turnover < Rs.2 crore and 8%/6% profit claimed).\nFor tax audit (turnover > Rs.1 crore): CA needs Form 3CD — supply all GRN invoices, bank statements, and expense bills physically. The ERP data gives the summary; physical bills are the supporting documents.',
          te: 'పూర్తి ఆర్థిక సంవత్సరం ఎంచుకోండి (FY 2024-25 కోసం 01-ఏప్రిల్-2024 నుండి 31-మార్చి-2025). CA Export డౌన్‌లోడ్ చేయండి. మీ CA ఇలా ఉపయోగిస్తారు:\n• షీట్ 2 (విక్రయ రిజిస్టర్) — ITR కోసం స్థూల టర్నోవర్ లెక్క. రూ.2.5 లక్షలు మించిన B2C బిల్లు ఆ నెలలో GSTR-1 లో వేరుగా నివేదించారో తనిఖీ చేస్తారు\n• షీట్ 7 (స్టాక్ రిజిస్టర్) — ప్రారంభ స్టాక్ విలువ (గత సంవత్సరం ముగింపు స్టాక్‌కు సరిపోవాలి) మరియు ముగింపు స్టాక్ విలువ. CA దీన్ని సంవత్సరాంతంలో చేసిన ఫిజికల్ స్టాక్ లెక్కింపుతో సరిపోల్చుతారు\n• షీట్ 1 (కొనుగోలు రిజిస్టర్) — COGS లెక్కకు మొత్తం కొనుగోళ్ళు: ప్రారంభ స్టాక్ + కొనుగోళ్ళు − ముగింపు స్టాక్\n• షీట్ 5 (ఖర్చుల సారాంశం) — ITR యొక్క Schedule BP కి అనుమతించదగిన అన్ని తగ్గింపులు. CA ప్రతి ఖర్చు అనుమతి మరియు TDS సమ్మతి తనిఖీ చేస్తారు\n• షీట్ 3 (బ్యాంక్ లావాదేవీలు) — నివేదించబడని ఆదాయం కోసం అన్ని నగదు డిపాజిట్‌లు తనిఖీ చేస్తారు\nCA తర్వాత ITR-3 (proprietorship, అసలు పుస్తకాలు నిర్వహించేవారికి) లేదా ITR-4 Sugam (టర్నోవర్ రూ.2 కోట్లు తక్కువగా ఉంటే presumptive taxation — digital అందుకున్న వాటిపై 6%, నగదుపై 8% లాభం) ఫైల్ చేస్తారు.\nటర్నోవర్ రూ.1 కోటి మించినట్లయితే: Sec 44AB కింద పన్ను ఆడిట్ తప్పనిసరి. CA Form 3CD తయారు చేస్తారు. దీనికి CA కి ఫిజికల్ GRN ఇన్‌వాయిస్‌లు, ఫిజికల్ ఖర్చుల బిల్లులు, బ్యాంక్ స్టేట్‌మెంట్‌లు అందించండి.',
        },
      },
      {
        title: { en: 'What is NOT in the CA Export', te: 'CA Export లో లేనివి — విడిగా అందించాలి' },
        body:  {
          en: 'The following must be supplied separately by the owner:\n• TDS certificates received from customers (Form 16A) — enter manually in ITR\n• Physical cash counted at year-end — reconcile with ERP closing cash\n• Fixed asset register (CCTV, AC, refrigerators, computers) — depreciation calculation is outside ERP\n• Loan accounts (bank loans, owner capital) — not tracked in ERP\n• Personal drawings by the owner — note separately\n• GST advance paid (if any month had cash crunch) — enter challan numbers\nAlso note: TDS deducted on rent or contractor payments must be deposited on NSDL and Form 26Q/27Q filed quarterly — this is not in the ERP. CA handles this separately.',
          te: 'ERP మీ వ్యాపార కార్యకలాపాలను కవర్ చేస్తుంది. కింది వాటి ERP పరిధిలో లేవు, విడిగా మీ CA కి అందించాలి:\n• కస్టమర్ల నుండి అందుకున్న TDS సర్టిఫికేట్‌లు (Form 16A) — ఏదైనా కస్టమర్ మీకు చెల్లింపులపై TDS తీసివేసినట్లయితే, వారి నుండి Form 16A సేకరించి CA కి ఇవ్వండి\n• సంవత్సరాంతంలో ఫిజికల్ నగదు లెక్కింపు — 31-మార్చి రోజు డ్రాయర్‌లో ఉన్న నగదు లెక్కించి ERP తో సరిపోల్చండి\n• స్థిర ఆస్తి రిజిస్టర్ — CCTV, AC, రిఫ్రిజిరేటర్లు, కంప్యూటర్లు, ఫర్నిచర్ — CA ప్రత్యేకంగా depreciation చెడ్యూల్ నిర్వహిస్తారు. ERP depreciation ట్రాక్ చేయదు\n• Proprietor మూలధన ఖాతా మరియు డ్రాయింగ్‌లు — వ్యక్తిగత అవసరాల కోసం వ్యాపారం నుండి డబ్బు తీసుకుంటే అది "drawings" అవుతుంది, బ్యాలెన్స్ షీట్‌లో మూలధన తగ్గింపుగా చూపిస్తారు\n• బ్యాంక్ లోన్ ఖాతాలు — వ్యాపార రుణం ఉంటే, బకాయి బ్యాలెన్స్ మరియు EMI చెడ్యూల్ ERP లో లేవు\n• GST అడ్వాన్స్ పన్ను చెల్లించినట్లయితే — ఏదైనా నెలలో challan ద్వారా ముందస్తుగా GST చెల్లిస్తే, challan నంబర్ CA కి ఇవ్వండి\nముఖ్య గమనిక: అద్దె లేదా కాంట్రాక్టర్ చెల్లింపులపై తీసివేసిన TDS, Form 26Q త్రైమాసికంగా ఫైల్ చేయాలి — ఇది ERP లో లేదు. CA ప్రత్యేకంగా నిర్వహిస్తారు.',
        },
      },
      {
        title: { en: 'CA Role Access in ERP', te: 'మీ CA కి ERP యాక్సెస్ ఎలా ఇవ్వాలి' },
        body:  {
          en: 'Give your CA the "CA" role (Settings → Users → Add User → Role: CA). CA role can access: All Reports (GST, Day Book, CA Export, Year Comparison, Ageing), Read-only Bills view, Read-only GRN view, Bank Transactions. CA cannot: process POS sales, raise GRNs, add products, change settings, or see staff details. This ensures your CA can verify data at any time without disrupting operations.',
          te: 'Settings → Users → Add User కి వెళ్ళండి. మీ CA పేరు, మొబైల్ నంబర్ నమోదు చేసి Role ని "CA" గా సెట్ చేయండి. CA పాత్ర ఇవి చదవడానికి మాత్రమే అనుమతిస్తుంది: అన్ని నివేదికలు (GST నివేదిక, రోజు పుస్తకం, CA Export, సంవత్సరం పోలిక, ఏజింగ్ నివేదిక, GST హెల్త్, GST రీకాన్సిలేషన్), Bills జాబితా (చదవడం మాత్రమే), GRN జాబితా (చదవడం మాత్రమే), బ్యాంక్ లావాదేవీలు (చదవడం మాత్రమే). CA పాత్ర ఇవి చేయలేదు: POS బిల్లు చేయడం, GRN సృష్టించడం లేదా ఆమోదించడం, ఉత్పత్తులు జోడించడం/సవరించడం, వ్యాపార సెట్టింగ్‌లు మార్చడం, సిబ్బంది వేతన లేదా వ్యక్తిగత వివరాలు చూడడం. అంటే మీ CA ఆర్థిక సంవత్సరంలో ఎప్పుడైనా లాగిన్ అయి డేటా తనిఖీ చేయవచ్చు — మీ రోజువారీ కార్యకలాపాలకు ఎటువంటి ముప్పు లేకుండా.',
        },
      },
    ],
    commonMistakes: [
      {
        mistake: { en: 'Sending CA Export for the wrong date range', te: 'తప్పు తేదీ పరిధిలో CA Export పంపడం' },
        fix:     { en: 'For monthly GST: use 1st to last day of the exact calendar month. For ITR: use 01-Apr to 31-Mar of the financial year. Always use the Quick Presets (This Month / Last Month / This FY) to avoid manual date errors.', te: 'నెల GST ఫైలింగ్ కోసం: From = ఆ నెల 1వ తేదీ, To = ఆ నెల చివరి రోజు (ఉదా: 01-జూన్ నుండి 30-జూన్). వార్షిక ITR కోసం: From = 01-ఏప్రిల్, To = 31-మార్చి. Quick Preset బటన్లు (This Month, Last Month, This FY, Last FY) ఎల్లప్పుడూ వాడండి — అవి తేదీలు స్వయంచాలకంగా సెట్ చేస్తాయి, తప్పులు రాకుండా చేస్తాయి.' },
      },
      {
        mistake: { en: 'Supplier invoice not in GSTR-2B — trying to claim ITC anyway', te: 'GSTR-2B లో లేని సరఫరాదారు ఇన్‌వాయిస్‌కు ITC క్లెయిమ్ చేయడం' },
        fix:     { en: 'ITC is claimable only when the invoice appears in your GSTR-2B (i.e., your supplier filed their GSTR-1). If missing: call supplier, check if they filed late. You can claim ITC in a later month once it appears. Claiming ITC for missing invoices leads to GST demand + 18% interest + penalty.', te: 'ఇన్‌వాయిస్ మీ GSTR-2B లో కనిపించినప్పుడు మాత్రమే ITC క్లెయిమ్ చేయవచ్చు — అంటే మీ సరఫరాదారు మొదట వారి GSTR-1 ఫైల్ చేసి ఉండాలి. ఇన్‌వాయిస్ GSTR-2B లో కనిపించకపోతే: సరఫరాదారుకు ఫోన్ చేసి వారి పెండింగ్ GSTR-1 ఫైల్ చేయమని అడగండి. కనిపించిన తర్వాత తదుపరి నెలలో ITC క్లెయిమ్ చేయవచ్చు. GSTR-2B లో లేకుండా ITC క్లెయిమ్ చేస్తే GST డిమాండ్ నోటీసు, 18% వడ్డీ, మరియు జరిమానా వస్తుంది. ఫిజికల్ ఇన్‌వాయిస్ ఉందని మాత్రమే క్లెయిమ్ చేయకండి.' },
      },
      {
        mistake: { en: 'Expenses entered without categorisation — CA cannot map to P&L', te: 'అన్ని ఖర్చులను "ఇతర" వర్గంలో నమోదు చేయడం' },
        fix:     { en: 'Always select the correct expense category when entering. Never use "Other" for recurring items like rent or salary. If wrong category was used, edit the expense and change the category — it will update in the next export.', te: '"ఇతర" వర్గాన్ని CA నిర్దిష్ట P&L లైన్ అంశాలకు మ్యాప్ చేయలేరు — ITR కి ఖర్చులు వర్గీకరించాలి (అద్దె, విద్యుత్, వేతనాలు, మొదలైనవి). ఖర్చు నమోదు చేసేటప్పుడు ఎల్లప్పుడూ సరైన వర్గం ఎంచుకోండి. గతంలో తప్పు వర్గాలు వాడినట్లయితే, Expenses కి వెళ్ళి ప్రతి ఎంట్రీ సవరించి వర్గం మార్చండి — తదుపరి CA Export లో వెంటనే అప్‌డేట్ అవుతుంది.' },
      },
      {
          mistake: { en: 'Thinking the ERP files GST automatically', te: 'ERP స్వయంచాలకంగా GST లేదా ITR ఫైల్ చేస్తుందని అనుకోవడం' },
        fix:     { en: 'The ERP generates all the data your CA needs — it does not file on the GST portal. Your CA must log into GSTN portal separately and use the export data to file GSTR-1 and GSTR-3B. Deadline for GSTR-3B: 20th of every month.', te: 'ERP మీ CA కి కావలసిన అన్ని డేటా తయారు చేస్తుంది కానీ ప్రభుత్వ పోర్టల్‌లో ఏదీ ఫైల్ చేయదు. మీ CA GSTR-1 మరియు GSTR-3B ఫైల్ చేయడానికి GSTN పోర్టల్‌లో (gst.gov.in) వేరుగా లాగిన్ అవ్వాలి, ITR ఫైల్ చేయడానికి ఆదాయపు పన్ను పోర్టల్‌లో (incometax.gov.in) లాగిన్ అవ్వాలి. ERP మీ డేటా వనరు; మీ CA ఫైలర్. గడువులు: GSTR-1 ప్రతి నెల 11వ తేదీ, GSTR-3B ప్రతి నెల 20వ తేదీ.' },
      },
      {
        mistake: { en: 'Not sharing export promptly — CA misses filing deadline', te: 'నెల 18 లేదా 19వ తేదీన CA Export పంచుకోవడం' },
        fix:     { en: 'Share the CA Export within the first 3 days of every month for the previous month. GSTR-1 due: 11th. GSTR-3B due: 20th. If you share on the 18th, your CA has only 2 days — errors are more likely. Set a monthly reminder.', te: 'GSTR-1 గడువు 11వ తేదీ, GSTR-3B గడువు 20వ తేదీ. 18వ తేదీన ఫైల్ పంచుకుంటే, మీ CA కి సమీక్షించడానికి, GSTR-2B మ్యాచింగ్ చేయడానికి, ITC లెక్కించడానికి కేవలం 2 రోజులు మాత్రమే ఉంటాయి — ఆ ఒత్తిడిలో తప్పులు జరిగే అవకాశం చాలా ఎక్కువ. ప్రతి నెల 1వ తేదీన ఫోన్ రిమైండర్ పెట్టుకోండి. 3వ తేదీలోపు పంచుకుంటే, GSTR-3B గడువుకు ముందు CA కి పూర్తి 17 రోజులు ఉంటాయి.' },
      },
    ],
    relatedTopics: ['reports-gst', 'reports', 'bills', 'grn', 'bank', 'expenses'],
    tags: ['ca-export', 'accountant', 'tds', 'gst', 'income-tax', 'excel', 'itr', 'audit', 'gstr-1', 'gstr-3b', 'itc', 'p-and-l', 'brs', 'form-16a', '194c', '194ib', 'presumptive'],
  },

  // ── Year Comparison ────────────────────────────────────────────────────────
  {
    id: 'year-comparison', route: '/dashboard/reports/year-comparison', module: 'reports', version: '1.0',
    title: { en: 'Year-on-Year Comparison', te: 'సంవత్సరం-వారీ పోలిక' },
    summary: {
      en: 'Compare this financial year vs last year, month by month — Sales, Gross Margin, Transactions, and Avg Bill. Identify seasonal patterns and growth rates. Use for annual review and supplier negotiations.',
      te: 'ఈ ఆర్థిక సంవత్సరాన్ని నెల వారీగా గత సంవత్సరంతో పోల్చండి — అమ్మకాలు, గ్రాస్ మార్జిన్, లావాదేవీలు మరియు సగటు బిల్. సీజనల్ నమూనాలు మరియు వృద్ధి రేట్లు గుర్తించండి.',
    },
    sections: [
      {
        title: { en: 'Growth rate formula', te: 'వృద్ధి రేటు సూత్రం' },
        body: {
          en: 'Growth % = (This Year − Last Year) ÷ Last Year × 100. Example: June sales ₹8,50,000 this year vs ₹7,20,000 last year. Growth = (8,50,000 − 7,20,000) ÷ 7,20,000 × 100 = 18.1%. Months with no last-year data show N/A. Use this to identify your strongest and weakest months and plan inventory accordingly.',
          te: 'వృద్ధి % = (ఈ సంవత్సరం − గత సంవత్సరం) ÷ గత సంవత్సరం × 100. ఉదాహరణ: జూన్ అమ్మకాలు ₹8,50,000 ఈ సంవత్సరం vs ₹7,20,000 గత సంవత్సరం. వృద్ధి = 18.1%. గత సంవత్సరం డేటా లేని నెలలు N/A చూపిస్తాయి.',
        },
      },
    ],
    relatedTopics: ['reports', 'reports-daybook'],
    tags: ['year-comparison', 'growth', 'seasonal', 'analysis', 'annual'],
  },

  // ── Product Labels ─────────────────────────────────────────────────────────
  {
    id: 'product-labels', route: '/dashboard/products/labels', module: 'products', version: '1.0',
    title: { en: 'Product Labels', te: 'ఉత్పత్తి లేబుల్‌లు' },
    summary: {
      en: 'Print price or barcode labels for shelf display and loose pack labelling. Select products and PLUs, choose label size (58mm×30mm thermal or A4 sheet), set quantity, and print. Labels include: name, MRP, selling price, barcode, and pack size.',
      te: 'షెల్ఫ్ డిస్‌ప్లే మరియు లూస్ ప్యాక్ లేబెలింగ్ కోసం ధర లేదా బార్‌కోడ్ లేబుల్‌లు ప్రింట్ చేయండి. ఉత్పత్తులు మరియు PLU లు ఎంచుకోండి, లేబుల్ సైజు ఎంచుకోండి, పరిమాణం సెట్ చేయండి మరియు ప్రింట్ చేయండి.',
    },
    relatedTopics: ['products', 'plu'],
    tags: ['labels', 'barcode', 'print', 'mrp', 'shelf', 'thermal'],
  },

  // ── Credit Notes ───────────────────────────────────────────────────────────
  {
    id: 'credit-notes', route: '/dashboard/credit-notes/[id]', module: 'purchasing', version: '1.0',
    title: { en: 'Credit Notes', te: 'Credit Notes' },
    summary: {
      en: 'A Credit Note records money a supplier owes you back when no goods are physically being returned — a promotional scheme, a volume rebate, or a correction to a rate that was charged incorrectly. It is one lump amount, not itemized by product, and it reduces what you owe that supplier the moment it is created. Create one from a GRN row (the "CN" button) or directly from the supplier\'s page.',
      te: 'ఏ వస్తువులు శారీరకంగా తిరిగి రానప్పుడు సరఫరాదారు మీకు తిరిగి ఇవ్వాల్సిన డబ్బును Credit Note నమోదు చేస్తుంది — ప్రమోషనల్ స్కీమ్, వాల్యూమ్ రిబేట్, లేదా తప్పుగా వసూలు చేసిన రేటుకు సవరణ. ఇది వస్తువు వారీగా కాకుండా ఒకే మొత్తం, మరియు సృష్టించిన వెంటనే ఆ సరఫరాదారుకు మీరు బాకీ ఉన్న మొత్తాన్ని తగ్గిస్తుంది. GRN వరుసలోని "CN" బటన్ నుండి లేదా నేరుగా సరఫరాదారు పేజీ నుండి దీన్ని సృష్టించండి.',
    },
    fields: {
      'Reason': { en: 'Why the supplier is giving you this credit. Pick the closest match — Rate Difference, Scheme / Promotional Credit, Volume Rebate, Short Supply, Quality Issue, or Other — then add a short description of what actually happened.', te: 'సరఫరాదారు ఈ క్రెడిట్ ఎందుకు ఇస్తున్నారు. దగ్గరగా సరిపోయే దాన్ని ఎంచుకోండి — Rate Difference, Scheme / Promotional Credit, Volume Rebate, Short Supply, Quality Issue, లేదా Other — తర్వాత ఏం జరిగిందో చిన్న వివరణ జోడించండి.' },
      'Taxable Amount': { en: 'The credit amount before GST. Example: supplier agrees to a ₹500 scheme discount at 18% GST → Taxable Amount = ₹500, GST = ₹90, Total Credit Note = ₹590.', te: 'GST కంటే ముందు క్రెడిట్ మొత్తం. ఉదాహరణ: సరఫరాదారు 18% GST వద్ద ₹500 స్కీమ్ డిస్కౌంట్‌కు అంగీకరిస్తారు → Taxable Amount = ₹500, GST = ₹90, మొత్తం Credit Note = ₹590.' },
      'Supplier CN#': { en: 'Optional. If the supplier has issued their own credit note document with a reference number, enter it here so the two records can be matched up later.', te: 'ఐచ్ఛికం. సరఫరాదారు రిఫరెన్స్ నంబర్‌తో వారి స్వంత క్రెడిట్ నోట్ డాక్యుమెంట్ జారీ చేసి ఉంటే, తర్వాత రెండు రికార్డులను సరిపోల్చుకోవడానికి దీన్ని ఇక్కడ నమోదు చేయండి.' },
      'ITC Reversal': { en: 'Turn this on if the credit relates to goods you already claimed input tax credit on — the GST portion of this credit note may need to be reversed in your GST return. Check with your accountant if unsure.', te: 'మీరు ఇప్పటికే ఇన్‌పుట్ ట్యాక్స్ క్రెడిట్ క్లెయిమ్ చేసిన వస్తువులకు సంబంధించిన క్రెడిట్ అయితే దీన్ని ఆన్ చేయండి — ఈ క్రెడిట్ నోట్ యొక్క GST భాగం మీ GST రిటర్న్‌లో రివర్స్ చేయాల్సి రావచ్చు. తెలియకపోతే మీ అకౌంటెంట్‌ను సంప్రదించండి.' },
    },
    sections: [
      {
        title: { en: 'When to use a Credit Note instead of a Debit Note', te: 'Debit Note కి బదులు Credit Note ఎప్పుడు ఉపయోగించాలి' },
        body: {
          en: 'Use a Credit Note when nothing physical is being sent back — the supplier is simply reducing your bill for a reason unrelated to a return (a scheme, a rebate, a pricing correction). If you are physically returning goods — damaged, expired, wrong item — use a Debit Note instead, from the Return button on the GRN or "Record Return" on the supplier\'s page, so the exact products and quantities are recorded, not just an amount.',
          te: 'ఏమీ శారీరకంగా తిరిగి పంపనప్పుడు Credit Note ఉపయోగించండి — సరఫరాదారు రిటర్న్‌తో సంబంధం లేని కారణానికి (స్కీమ్, రిబేట్, ధర సవరణ) మీ బిల్‌ను తగ్గిస్తున్నారు అంతే. మీరు శారీరకంగా వస్తువులు తిరిగి పంపుతుంటే — దెబ్బతిన్నవి, గడువు ముగిసినవి, తప్పు వస్తువు — బదులుగా GRN లోని Return బటన్ నుండి లేదా సరఫరాదారు పేజీలో "Record Return" నుండి Debit Note ఉపయోగించండి, తద్వారా కేవలం మొత్తం కాకుండా ఖచ్చితమైన వస్తువులు మరియు పరిమాణాలు నమోదు అవుతాయి.',
        },
      },
      {
        title: { en: 'Cancelling a Credit Note', te: 'Credit Note రద్దు చేయడం' },
        body: {
          en: 'Credit notes cannot be edited once created — standard accounting practice treats them as permanent documents. If you made a mistake, cancel it instead using the Cancel button on this page, or from the Credit Notes tab on the supplier\'s page. Cancelling restores the full amount to what you owe the supplier and cannot be undone, but you can always create a new, correct one afterwards.',
          te: 'Credit notes సృష్టించిన తర్వాత సవరించలేరు — ప్రామాణిక అకౌంటింగ్ పద్ధతి వాటిని శాశ్వత డాక్యుమెంట్‌లుగా పరిగణిస్తుంది. పొరపాటు జరిగితే, ఈ పేజీలోని Cancel బటన్ ఉపయోగించి లేదా సరఫరాదారు పేజీలోని Credit Notes ట్యాబ్ నుండి దాన్ని రద్దు చేయండి. రద్దు చేయడం సరఫరాదారుకు మీరు బాకీ ఉన్న మొత్తానికి పూర్తి మొత్తాన్ని పునరుద్ధరిస్తుంది మరియు దీన్ని వెనక్కి తీసుకోలేరు, కానీ తర్వాత మీరు ఎప్పుడైనా కొత్త, సరైనదాన్ని సృష్టించవచ్చు.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Using a Credit Note for a physical return', te: 'శారీరక రిటర్న్ కోసం Credit Note ఉపయోగించడం' }, fix: { en: 'If real products are going back to the supplier, use a Debit Note instead so the return is tracked item by item, not just as a lump sum.', te: 'నిజమైన ఉత్పత్తులు సరఫరాదారుకు తిరిగి వెళ్తుంటే, రిటర్న్ ఒకే మొత్తంగా కాకుండా వస్తువు వారీగా ట్రాక్ అవ్వడానికి బదులుగా Debit Note ఉపయోగించండి.' } },
    ],
    relatedTopics: ['suppliers', 'grn', 'debit-notes'],
    tags: ['credit-note', 'supplier', 'scheme', 'rebate', 'gst', 'itc', 'balance'],
  },

  // ── Debit Notes (Returns) ─────────────────────────────────────────────────
  {
    id: 'debit-notes', route: '/dashboard/debit-notes/[id]', module: 'purchasing', version: '1.0',
    title: { en: 'Debit Notes (Returns)', te: 'Debit Notes (రిటర్న్‌లు)' },
    summary: {
      en: 'A Debit Note is the document you issue when physically returning goods to a supplier — damaged, expired, the wrong item, or a shortfall. Unlike a Credit Note, it is itemized: you record exactly which products and how many units went back, not just a total amount. This matches standard accounting practice for purchase returns and gives you a real record of what was actually sent back, not just how much money changed hands.',
      te: 'సరఫరాదారుకు వస్తువులు శారీరకంగా తిరిగి పంపేటప్పుడు మీరు జారీ చేసే డాక్యుమెంట్ Debit Note — దెబ్బతిన్నవి, గడువు ముగిసినవి, తప్పు వస్తువు, లేదా తక్కువ సరఫరా. Credit Note కి భిన్నంగా, ఇది వస్తువు వారీగా ఉంటుంది: మొత్తం కాకుండా ఖచ్చితంగా ఏ ఉత్పత్తులు, ఎన్ని యూనిట్‌లు తిరిగి వెళ్ళాయో మీరు నమోదు చేస్తారు. ఇది కొనుగోలు రిటర్న్‌లకు ప్రామాణిక అకౌంటింగ్ పద్ధతికి సరిపోతుంది మరియు ఎంత డబ్బు మారిందో కాకుండా నిజంగా ఏం తిరిగి పంపారో అసలైన రికార్డు ఇస్తుంది.',
    },
    fields: {
      'Reason': { en: 'Pick the closest match — Goods Returned (damaged), Goods Returned (expired), Quality Issue, Short Supply, or Other — then describe what happened.', te: 'దగ్గరగా సరిపోయే దాన్ని ఎంచుకోండి — Goods Returned (damaged), Goods Returned (expired), Quality Issue, Short Supply, లేదా Other — తర్వాత ఏం జరిగిందో వివరించండి.' },
      'Quantity / Rate / GST%': { en: 'Entered per product line, not as one lump sum. If a line was flagged as "Rejected Qty" while receiving the GRN, these fields are pre-filled automatically — just double-check them before submitting.', te: 'ఒకే మొత్తంగా కాకుండా ప్రతి వస్తువు లైన్‌కు నమోదు చేయబడుతుంది. GRN స్వీకరించేటప్పుడు ఒక లైన్‌ను "Rejected Qty" గా గుర్తు పెడితే, ఈ ఫీల్డ్‌లు స్వయంచాలకంగా నింపబడతాయి — సమర్పించే ముందు మాత్రం వాటిని మళ్ళీ తనిఖీ చేయండి.' },
      'Supplier CN#': { en: 'Optional. Fill this in only if the supplier has separately issued their own credit note for this return, so you can match the two records.', te: 'ఐచ్ఛికం. ఈ రిటర్న్ కోసం సరఫరాదారు వేరుగా వారి స్వంత క్రెడిట్ నోట్ జారీ చేసి ఉంటేనే దీన్ని నింపండి, తద్వారా మీరు రెండు రికార్డులను సరిపోల్చవచ్చు.' },
      'ITC Reversal': { en: 'Turn this on if you had already claimed input tax credit on the returned goods — the GST on this debit note may need to be reversed in your GST return. Check with your accountant if unsure.', te: 'తిరిగి పంపిన వస్తువులపై మీరు ఇప్పటికే ఇన్‌పుట్ ట్యాక్స్ క్రెడిట్ క్లెయిమ్ చేసి ఉంటే దీన్ని ఆన్ చేయండి — ఈ డెబిట్ నోట్‌పై GST మీ GST రిటర్న్‌లో రివర్స్ చేయాల్సి రావచ్చు. తెలియకపోతే మీ అకౌంటెంట్‌ను సంప్రదించండి.' },
    },
    sections: [
      {
        title: { en: 'Two ways to record a return', te: 'రిటర్న్ నమోదు చేయడానికి రెండు మార్గాలు' },
        body: {
          en: '1) At receiving time — while entering a GRN, mark a line\'s "Rejected Qty" with a reason. Once the GRN is approved, click the Return button on that GRN\'s row and the item details are filled in for you automatically. 2) For stock already in your store — if you discover damaged or expired goods later, not tied to any specific GRN, go to the supplier\'s page and click "Record Return". Search for the product, enter the quantity being sent back, and submit — no GRN link is required.',
          te: '1) స్వీకరించే సమయంలో — GRN నమోదు చేసేటప్పుడు, ఒక లైన్ యొక్క "Rejected Qty" ని కారణంతో గుర్తు పెట్టండి. GRN ఆమోదించిన తర్వాత, ఆ GRN వరుసలోని Return బటన్ క్లిక్ చేయండి, వస్తువు వివరాలు మీ కోసం స్వయంచాలకంగా నింపబడతాయి. 2) మీ దుకాణంలో ఇప్పటికే ఉన్న స్టాక్ కోసం — ఏదైనా నిర్దిష్ట GRN తో సంబంధం లేకుండా, తర్వాత దెబ్బతిన్న లేదా గడువు ముగిసిన వస్తువులు కనిపెడితే, సరఫరాదారు పేజీకి వెళ్ళి "Record Return" క్లిక్ చేయండి. వస్తువు వెతికి, తిరిగి పంపుతున్న పరిమాణం నమోదు చేసి సమర్పించండి — GRN లింక్ అవసరం లేదు.',
        },
      },
      {
        title: { en: 'Why itemized, not a lump amount', te: 'మొత్తంగా కాకుండా వస్తువు వారీగా ఎందుకు' },
        body: {
          en: 'Recording exactly which products and quantities were returned — instead of just a rupee total — means you always have a real answer to "what did we actually send back?" months later, and it matches what your GST filing and accountant will expect to see for a purchase return.',
          te: 'కేవలం రూపాయిల మొత్తానికి బదులుగా ఖచ్చితంగా ఏ ఉత్పత్తులు, ఎన్ని పరిమాణాలు తిరిగి వెళ్ళాయో నమోదు చేయడం అంటే నెలల తర్వాత కూడా "మేము నిజంగా ఏం తిరిగి పంపాము?" అనే దానికి నిజమైన సమాధానం ఎప్పుడూ మీ దగ్గర ఉంటుంది, మరియు ఇది కొనుగోలు రిటర్న్ కోసం మీ GST ఫైలింగ్ మరియు అకౌంటెంట్ ఆశించే దానికి సరిపోతుంది.',
        },
      },
      {
        title: { en: 'Cancelling a Debit Note', te: 'Debit Note రద్దు చేయడం' },
        body: {
          en: 'Like Credit Notes, Debit Notes cannot be edited once created — only cancelled. Cancelling restores the full amount to what you owe the supplier. Use the Cancel button on this page, or from the Debit Notes tab on the supplier\'s page.',
          te: 'Credit Notes లాగే, Debit Notes సృష్టించిన తర్వాత సవరించలేరు — రద్దు చేయడం మాత్రమే చేయవచ్చు. రద్దు చేయడం సరఫరాదారుకు మీరు బాకీ ఉన్న మొత్తానికి పూర్తి మొత్తాన్ని పునరుద్ధరిస్తుంది. ఈ పేజీలోని Cancel బటన్ లేదా సరఫరాదారు పేజీలోని Debit Notes ట్యాబ్ ఉపయోగించండి.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Recording a scheme or rate-correction credit as a Return', te: 'స్కీమ్ లేదా రేటు-సవరణ క్రెడిట్‌ను Return గా నమోదు చేయడం' }, fix: { en: 'A Debit Note is only for goods you are physically sending back. For credits the supplier gives you with no return of goods — a scheme, rebate, or rate correction — use a Credit Note instead.', te: 'Debit Note కేవలం మీరు శారీరకంగా తిరిగి పంపుతున్న వస్తువుల కోసమే. వస్తువుల రిటర్న్ లేకుండా సరఫరాదారు మీకు ఇచ్చే క్రెడిట్‌లకు — స్కీమ్, రిబేట్, లేదా రేటు సవరణ — బదులుగా Credit Note ఉపయోగించండి.' } },
      { mistake: { en: 'Not double-checking pre-filled quantities and rates', te: 'ముందే నింపిన పరిమాణాలు మరియు రేట్లను మళ్ళీ తనిఖీ చేయకపోవడం' }, fix: { en: 'When items are auto-filled from a GRN\'s rejected quantities, the numbers come from what was flagged at receiving time — always verify them against what is physically being sent back before submitting.', te: 'GRN యొక్క తిరస్కరించిన పరిమాణాల నుండి వస్తువులు స్వయంచాలకంగా నింపబడినప్పుడు, సంఖ్యలు స్వీకరించే సమయంలో గుర్తు పెట్టినవి — సమర్పించే ముందు శారీరకంగా తిరిగి పంపుతున్న దానికి వ్యతిరేకంగా వాటిని ఎల్లప్పుడూ ధృవీకరించండి.' } },
    ],
    relatedTopics: ['suppliers', 'grn', 'credit-notes'],
    tags: ['debit-note', 'return', 'supplier', 'itemized', 'gst', 'itc', 'balance'],
  },

];

// ─── Route matching ───────────────────────────────────────────────────────────

function matchRoute(pattern: string, pathname: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[[\w]+\\\]/g, '[^/]+');
  return new RegExp(`^${escaped}(/.*)?$`).test(pathname);
}

export function findEntry(pathname: string): HelpEntry | null {
  const matches = HELP_CONTENT.filter(e => matchRoute(e.route, pathname));
  if (!matches.length) return null;
  return matches.sort((a, b) => b.route.split('/').length - a.route.split('/').length)[0];
}
