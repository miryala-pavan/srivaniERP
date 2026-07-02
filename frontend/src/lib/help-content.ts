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
    relatedTopics: ['plu', 'grn', 'categories', 'hsn'],
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
      'Measure Type': { en: 'WEIGHT for items sold by kg/g (sugar, rice, atta, dal, dry fruits). VOLUME for liquids (oil, milk, shampoo). COUNT for pieces/boxes (biscuit packs, bottles, soaps). Governs which Unit Symbols are available.', te: 'kg/g లో అమ్మే వస్తువులకు WEIGHT (చక్కెర, బియ్యం, ఆటా, పప్పు, డ్రై ఫ్రూట్స్). ద్రవాలకు VOLUME (నూనె, పాలు, షాంపూ). ముక్కలు/పెట్టెలకు COUNT (బిస్కెట్ ప్యాక్‌లు, బాటిల్‌లు, సబ్బులు). ఏ యూనిట్ చిహ్నాలు అందుబాటులో ఉన్నాయో నిర్ణయిస్తుంది.' },
      'Unit Symbol': { en: 'The specific unit: kg, g, L, ml, pcs, nos, ctn, box, doz, btl, bag, pkt. Sets the GST UQC (Unit Quantity Code) automatically — needed for GSTR-1 annual returns. Select Measure Type first.', te: 'నిర్దిష్ట యూనిట్: kg, g, L, ml, pcs, nos, ctn, box, doz, btl, bag, pkt. స్వయంచాలకంగా GST UQC (యూనిట్ పరిమాణ కోడ్) సెట్ చేస్తుంది — GSTR-1 వార్షిక రిటర్న్‌లకు అవసరం. ముందు Measure Type ఎంచుకోండి.' },
      'Pack Size': { en: 'Quantity in the chosen unit that one pack of this PLU contains. 50kg bag → 50. 500ml bottle → 500. 1 dozen eggs → 12 (with unit=doz, size=1 OR unit=pcs, size=12). Used by Break Bulk to auto-fill the bulk weight.', te: 'ఈ PLU యొక్క ఒక ప్యాక్‌లో ఎంచుకున్న యూనిట్‌లో పరిమాణం. 50kg బ్యాగ్ → 50. 500ml బాటిల్ → 500. 1 డజన్ గుడ్లు → 12. Break Bulk కోసం బల్క్ బరువును స్వయంచాలకంగా నింపడానికి ఉపయోగించబడుతుంది.' },
      'Base Qty': { en: 'Auto-calculated — always in the base unit (grams for WEIGHT, ml for VOLUME, units for COUNT). Pack Size 50 kg → Base Qty 50000 g. This is what Break Bulk uses internally. You never enter this directly.', te: 'స్వయంచాలకంగా లెక్కించబడుతుంది — ఎల్లప్పుడూ బేస్ యూనిట్‌లో (WEIGHT కోసం గ్రాములు, VOLUME కోసం ml, COUNT కోసం యూనిట్‌లు). ప్యాక్ సైజు 50 kg → బేస్ qty 50000 g. ఇది Break Bulk అంతర్గతంగా ఉపయోగించేది. మీరు దీన్ని నేరుగా నమోదు చేయరు.' },
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
    relatedTopics: ['break-bulk', 'grn', 'products'],
    tags: ['plu', 'price', 'mrp', 'stock', 'uom', 'gst', 'barcode'],
  },

  // ── GRN — List ─────────────────────────────────────────────────────────────
  {
    id: 'grn', route: '/dashboard/grn', module: 'purchasing', version: '2.0',
    title: { en: 'Goods Receipt Notes (GRN)', te: 'వస్తువుల రసీదు నోట్‌లు (GRN)' },
    summary: {
      en: 'Every stock inward movement is recorded as a GRN. A GRN captures the supplier invoice, quantities, cost prices, and GST. Approving a GRN adds stock and creates a payable. This list shows all GRNs — filter by status, supplier, or date.',
      te: 'ప్రతి స్టాక్ ఇన్‌వార్డ్ కదలిక GRN గా నమోదు చేయబడుతుంది. GRN సరఫరాదారు ఇన్‌వాయిస్, పరిమాణాలు, ధర ధరలు మరియు GST ను క్యాప్చర్ చేస్తుంది. GRN ఆమోదించడం స్టాక్ జోడిస్తుంది మరియు చెల్లించాల్సిన మొత్తం సృష్టిస్తుంది. ఈ జాబితా అన్ని GRN లను చూపిస్తుంది — స్థితి, సరఫరాదారు లేదా తేదీ ద్వారా ఫిల్టర్ చేయండి.',
    },
    sections: [
      {
        title: { en: 'GRN status workflow', te: 'GRN స్థితి వర్క్‌ఫ్లో' },
        body: {
          en: 'DRAFT → entry saved, no stock impact yet. PENDING_APPROVAL → created from PO, awaiting verification. APPROVED → stock added, payable created, locked. REJECTED → rejected at approval, can be re-submitted. CANCELLED → voided, no stock impact. Only DRAFT and PENDING_APPROVAL can be edited. Once APPROVED, raise a new GRN for corrections (a debit note process).',
          te: 'DRAFT → ఎంట్రీ సేవ్ చేయబడింది, ఇంకా స్టాక్ ప్రభావం లేదు. PENDING_APPROVAL → PO నుండి సృష్టించబడింది, ధృవీకరణ కోసం వేచి ఉంది. APPROVED → స్టాక్ జోడించబడింది, చెల్లించాల్సిన మొత్తం సృష్టించబడింది, లాక్. REJECTED → ఆమోదం వద్ద తిరస్కరించబడింది, మళ్ళీ సమర్పించవచ్చు. CANCELLED → రద్దు, స్టాక్ ప్రభావం లేదు. DRAFT మరియు PENDING_APPROVAL మాత్రమే సవరించవచ్చు.',
        },
      },
      {
        title: { en: 'Creating a GRN from a Purchase Order', te: 'కొనుగోలు ఆర్డర్ నుండి GRN సృష్టించడం' },
        body: {
          en: 'Fastest path: open the PO → click "Receive Goods → GRN". Items and quantities are pre-filled. Enter the supplier invoice number and date, then click Create GRN. The GRN opens in PENDING_APPROVAL status. Review quantities and costs, then Approve to update stock. You can adjust any line before approving.',
          te: 'వేగవంతమైన మార్గం: PO తెరవండి → "వస్తువులు స్వీకరించు → GRN" క్లిక్ చేయండి. వస్తువులు మరియు పరిమాణాలు ముందే నిండి ఉంటాయి. సరఫరాదారు ఇన్‌వాయిస్ నంబర్ మరియు తేదీ నమోదు చేయండి, తర్వాత GRN సృష్టించు క్లిక్ చేయండి. GRN PENDING_APPROVAL స్థితిలో తెరుచుకుంటుంది. పరిమాణాలు మరియు ధరలు సమీక్షించండి, తర్వాత స్టాక్ అప్‌డేట్ చేయడానికి ఆమోదించండి.',
        },
      },
    ],
    relatedTopics: ['grn-new', 'purchase-orders', 'suppliers', 'plu'],
    tags: ['grn', 'stock', 'receipt', 'supplier', 'purchase', 'approval'],
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
    id: 'break-bulk', route: '/dashboard/inventory/break-bulk', module: 'inventory', version: '2.3',
    title: { en: 'Break Bulk', te: 'బ్రేక్ బల్క్' },
    summary: {
      en: 'Split large bulk stock into smaller retail packs. Stock moves from the source (bulk) PLU to output (retail) PLUs. Two modes: Fixed (always the same split ratio) and Variable (weighable items split to custom pack sizes each time).',
      te: 'పెద్ద బల్క్ స్టాక్‌ను చిన్న రిటైల్ ప్యాక్‌లుగా విభజించండి. స్టాక్ మూల (బల్క్) PLU నుండి అవుట్‌పుట్ (రిటైల్) PLU లకు తరలుతుంది. రెండు మోడ్‌లు: Fixed (ఎల్లప్పుడూ అదే స్ప్లిట్ నిష్పత్తి) మరియు Variable (ప్రతిసారి కస్టమ్ ప్యాక్ సైజులకు తూకం వేయగల వస్తువులు విభజించబడతాయి).',
    },
    sections: [
      {
        title: { en: 'Fixed Break — how it works', te: 'Fixed Break — ఎలా పని చేస్తుంది' },
        body: {
          en: 'Setup once: source PLU (e.g. Biscuits 1-Carton) maps to output PLU (Biscuits 1-Packet) with ratio 12. At each session, enter number of cartons to break. Math: Cartons × 12 = Packets added to stock. Cartons subtracted from source. Ratio never changes unless you edit the bundle configuration.',
          te: 'ఒకసారి సెటప్ చేయండి: మూల PLU (ఉదా. బిస్కెట్‌లు 1-కార్టన్) అవుట్‌పుట్ PLU (బిస్కెట్‌లు 1-ప్యాకెట్) కి నిష్పత్తి 12 తో మ్యాప్ అవుతుంది. ప్రతి సెషన్‌లో, విరగ్గొట్టడానికి కార్టన్‌ల సంఖ్య నమోదు చేయండి. గణిత: కార్టన్‌లు × 12 = స్టాక్‌కు ప్యాకెట్‌లు జోడించబడతాయి.',
        },
      },
      {
        title: { en: 'Variable Break — calculation', te: 'Variable Break — లెక్కింపు' },
        body: {
          en: 'For weighable items. Bulk input weight (e.g. 50 kg bag = 50000 g). You produce: 30 × 1kg packs (30000 g) + 20 × 500g packs (10000 g) + wastage (e.g. 500 g dust/moisture). Check: 30000 + 10000 + 500 = 40500 g used. But bulk was 50000 g — remaining 9500 g must also be accounted for (more packs or wastage). The screen shows remaining balance live as you enter values.',
          te: 'తూకం వేయగల వస్తువులకు. బల్క్ ఇన్‌పుట్ బరువు (ఉదా. 50 kg బ్యాగ్ = 50000 g). మీరు ఉత్పత్తి చేస్తారు: 30 × 1kg ప్యాక్‌లు (30000 g) + 20 × 500g ప్యాక్‌లు (10000 g) + వ్యర్థం (ఉదా. 500 g). తనిఖీ: 30000 + 10000 + 500 = 40500 g ఉపయోగించబడింది. కానీ బల్క్ 50000 g — మిగిలిన 9500 g కూడా వివరించాలి. మీరు విలువలు నమోదు చేస్తున్నప్పుడు స్క్రీన్ మిగిలిన బ్యాలెన్స్ లైవ్‌గా చూపిస్తుంది.',
        },
      },
      {
        title: { en: 'Wastage tracking and reporting', te: 'వ్యర్థం ట్రాకింగ్ మరియు రిపోర్టింగ్' },
        body: {
          en: 'Enter wastage in grams with a reason (moisture, dust, spillage, packing material). Wastage reduces the source stock without creating output stock. The Wastage Report (Reports → Inventory) shows cumulative losses by product over any date range. Use this quarterly to adjust selling prices if wastage is consistently high.',
          te: 'కారణంతో పాటు గ్రాములలో వ్యర్థం నమోదు చేయండి (తేమ, దుమ్ము, చిందటం, ప్యాకింగ్ మెటీరియల్). వ్యర్థం అవుట్‌పుట్ స్టాక్ సృష్టించకుండా మూల స్టాక్‌ను తగ్గిస్తుంది. వ్యర్థం నివేదిక (రిపోర్టులు → ఇన్వెంటరీ) ఏ తేదీ పరిధిలోనైనా ఉత్పత్తి వారీగా సంచిత నష్టాలను చూపిస్తుంది.',
        },
      },
      {
        title: { en: 'Reversing a session', te: 'సెషన్ రివర్స్ చేయడం' },
        body: {
          en: 'Open History tab → find the session → click Reverse. All stock movements are undone. Reversal is only allowed if none of the output stock from that session has been sold. If partial sales occurred, the system will warn you — you must manually adjust the remaining qty instead.',
          te: 'హిస్టరీ ట్యాబ్ తెరవండి → సెషన్ కనుగొనండి → రివర్స్ క్లిక్ చేయండి. అన్ని స్టాక్ కదలికలు రద్దు చేయబడతాయి. ఆ సెషన్ నుండి అవుట్‌పుట్ స్టాక్ ఏదీ అమ్మబడకపోతే మాత్రమే రివర్సల్ అనుమతించబడుతుంది.',
        },
      },
    ],
    commonMistakes: [
      { mistake: { en: 'Output weight exceeds bulk weight', te: 'అవుట్‌పుట్ బరువు బల్క్ బరువు మించడం' }, fix: { en: 'Total output + wastage cannot exceed bulk weight. Reduce quantities. The screen shows the remaining balance — it must reach zero before you can save.', te: 'మొత్తం అవుట్‌పుట్ + వ్యర్థం బల్క్ బరువు మించకూడదు. పరిమాణాలు తగ్గించండి. స్క్రీన్ మిగిలిన బ్యాలెన్స్ చూపిస్తుంది — సేవ్ చేయడానికి ముందు అది సున్నాకు చేరాలి.' } },
      { mistake: { en: 'Breaking without stock in the source PLU', te: 'మూల PLU లో స్టాక్ లేకుండా విరగ్గొట్టడం' }, fix: { en: 'Receive the bulk goods via GRN first, approve the GRN, then break bulk. The system blocks sessions where source quantity > available stock.', te: 'ముందు GRN ద్వారా బల్క్ వస్తువులు స్వీకరించండి, GRN ఆమోదించండి, తర్వాత బ్రేక్ బల్క్ చేయండి.' } },
    ],
    relatedTopics: ['plu', 'grn', 'products'],
    tags: ['break-bulk', 'stock', 'repack', 'wastage', 'variable', 'fixed'],
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
    id: 'suppliers', route: '/dashboard/suppliers', module: 'purchasing', version: '2.0',
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
    ],
    commonMistakes: [
      { mistake: { en: 'Supplier created without GSTIN', te: 'GSTIN లేకుండా సరఫరాదారు సృష్టించడం' }, fix: { en: 'Go back and add GSTIN before the first GRN. You can edit supplier at any time. GRNs created without supplier GSTIN mark ITC as ineligible automatically.', te: 'మొదటి GRN కంటే ముందు GSTIN జోడించడానికి వెనుకకు వెళ్ళండి. మీరు ఎప్పుడైనా సరఫరాదారుని సవరించవచ్చు.' } },
    ],
    relatedTopics: ['purchase-orders', 'grn', 'payments', 'bank'],
    tags: ['suppliers', 'gstin', 'ledger', 'itc', 'payment-terms'],
  },

  // ── Customers ──────────────────────────────────────────────────────────────
  {
    id: 'customers', route: '/dashboard/customers', module: 'sales', version: '1.0',
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
    ],
    relatedTopics: ['pos', 'bills', 'payments'],
    tags: ['customers', 'loyalty', 'credit', 'ledger', 'gstin'],
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
    id: 'online-orders', route: '/dashboard/online-orders', module: 'sales', version: '1.0',
    title: { en: 'Online Orders', te: 'ఆన్‌లైన్ ఆర్డర్లు' },
    summary: {
      en: 'Orders from your online storefront appear here in real time. Accept, pack, and dispatch. An accepted order can be converted to a POS bill — this deducts stock and creates a sales record. Payment modes: COD, Razorpay (auto-confirmed), or UPI.',
      te: 'మీ ఆన్‌లైన్ స్టోర్‌ఫ్రంట్ నుండి ఆర్డర్లు ఇక్కడ నిజ సమయంలో కనిపిస్తాయి. అంగీకరించండి, ప్యాక్ చేయండి మరియు పంపండి. అంగీకరించిన ఆర్డర్‌ను POS బిల్‌కు మార్చవచ్చు — ఇది స్టాక్ తీసివేసి అమ్మకాల రికార్డు సృష్టిస్తుంది.',
    },
    sections: [
      {
        title: { en: 'Order status flow', te: 'ఆర్డర్ స్థితి ప్రవాహం' },
        body: {
          en: 'NEW → accept or reject (within 30 min for good customer experience). ACCEPTED → print pick list, pack items. If any item out of stock: edit order to reduce qty or remove item and notify customer. PACKED → assign for delivery or mark ready for pickup. DELIVERED → complete. If COD: collect payment at door and record. Razorpay orders: payment already captured online.',
          te: 'NEW → 30 నిమిషాల్లో అంగీకరించండి లేదా తిరస్కరించండి. ACCEPTED → పిక్ జాబితా ప్రింట్ చేయండి, వస్తువులు ప్యాక్ చేయండి. స్టాక్ అయిపోయిన వస్తువు ఉంటే: ఆర్డర్ సవరించి కస్టమర్‌కు తెలియజేయండి. PACKED → డెలివరీ నియమించండి. DELIVERED → పూర్తి.',
        },
      },
    ],
    relatedTopics: ['pos', 'bills', 'customers'],
    tags: ['online-orders', 'storefront', 'delivery', 'razorpay', 'cod'],
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
    title: { en: 'CA Export', te: 'CA ఎగుమతి' },
    summary: {
      en: 'Export structured financial data for your Chartered Accountant. Generates Excel files with: all bills (GST breakup), GRNs (ITC details), supplier payments, customer outstanding, and P&L summary. Share monthly for TDS, GST reconciliation, and income tax filing.',
      te: 'మీ చార్టర్డ్ అకౌంటెంట్ కోసం నిర్మాణాత్మక ఆర్థిక డేటా ఎగుమతి చేయండి. అన్ని బిల్లులు (GST విచ్ఛిన్నం), GRN లు (ITC వివరాలు), సరఫరాదారు చెల్లింపులు, కస్టమర్ బాకీ మరియు P&L సారాంశంతో Excel ఫైల్‌లు రూపొందిస్తుంది.',
    },
    relatedTopics: ['reports-gst', 'reports', 'bills', 'grn'],
    tags: ['ca-export', 'accountant', 'tds', 'gst', 'income-tax', 'excel'],
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
