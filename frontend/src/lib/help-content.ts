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
  route:           string;       // e.g. '/dashboard/products/[id]/plu'
  module:          string;
  version:         string;       // bump → "Updated v2.x" shown once per user
  roles?:          string[];     // undefined = all roles; set to limit visibility
  title:           HelpField;
  summary:         HelpField;
  fields?:         Record<string, HelpField>;
  sections?:       HelpSection[];
  commonMistakes?: HelpMistake[];
  relatedTopics?:  string[];     // ids of related entries
  tags?:           string[];
}

// ─────────────────────────────────────────────────────────────────────────────

export const HELP_CONTENT: HelpEntry[] = [

  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    id:      'dashboard',
    route:   '/dashboard',
    module:  'core',
    version: '1.0',
    title:   { en: 'Dashboard', te: 'డాష్‌బోర్డ్' },
    summary: {
      en: 'Your daily command centre. Shows today\'s sales, stock alerts, pending purchase orders, and business health at a glance.',
      te: 'మీ రోజువారీ కమాండ్ సెంటర్. నేటి అమ్మకాలు, స్టాక్ హెచ్చరికలు, పెండింగ్ కొనుగోలు ఆర్డర్లు మరియు వ్యాపార ఆరోగ్యాన్ని ఒక్క చూపులో చూపిస్తుంది.',
    },
    sections: [
      {
        title: { en: 'Sales Summary Cards', te: 'అమ్మకాల సారాంశ కార్డులు' },
        body:  {
          en: 'Today\'s Sales shows the total billed amount since midnight. Gross Margin shows profit after cost. Transaction Count shows number of bills raised. These reset every midnight automatically.',
          te: 'నేటి అమ్మకాలు అర్ధరాత్రి నుండి మొత్తం బిల్ మొత్తాన్ని చూపిస్తుంది. గ్రాస్ మార్జిన్ ఖర్చు తర్వాత లాభాన్ని చూపిస్తుంది. లావాదేవీ గణన పెంచిన బిల్ల సంఖ్యను చూపిస్తుంది. ఇవి ప్రతి అర్ధరాత్రి స్వయంచాలకంగా రీసెట్ అవుతాయి.',
        },
      },
      {
        title: { en: 'Stock Alerts', te: 'స్టాక్ హెచ్చరికలు' },
        body:  {
          en: 'Red items are out of stock. Orange items are below reorder level. Click any alert to go directly to that product. A purchase order is automatically created when stock falls below the threshold.',
          te: 'ఎరుపు వస్తువులు స్టాక్ అయిపోయాయి. నారింజ వస్తువులు రీఆర్డర్ స్థాయి కంటే తక్కువగా ఉన్నాయి. ఆ ఉత్పత్తికి నేరుగా వెళ్ళడానికి ఏదైనా హెచ్చరికను క్లిక్ చేయండి. స్టాక్ పరిమితి కంటే తక్కువగా పడినప్పుడు కొనుగోలు ఆర్డర్ స్వయంచాలకంగా రూపొందించబడుతుంది.',
        },
      },
      {
        title: { en: 'Day Closure', te: 'రోజు ముగింపు' },
        body:  {
          en: 'The orange banner at the top means yesterday\'s closure is pending. Always complete day closure before starting the next day\'s billing. It locks the previous day\'s sales and generates the GST summary.',
          te: 'పైన నారింజ బ్యానర్ నిన్నటి ముగింపు పెండింగ్‌లో ఉందని అర్థం. తదుపరి రోజు బిల్లింగ్ ప్రారంభించే ముందు రోజు ముగింపు పూర్తి చేయండి. ఇది మునుపటి రోజు అమ్మకాలను లాక్ చేసి GST సారాంశాన్ని రూపొందిస్తుంది.',
        },
      },
      {
        title: { en: 'Keyboard Shortcuts', te: 'కీబోర్డ్ షార్ట్‌కట్‌లు' },
        body:  {
          en: 'Ctrl+K → Command Palette (search everything). ? → this assistant. g then d → Dashboard. g then p → Products. g then k → POS Billing. Ctrl+B → Bills. n → New (context-aware).',
          te: 'Ctrl+K → కమాండ్ పాలెట్ (అన్నీ శోధించు). ? → ఈ అసిస్టెంట్. g తర్వాత d → డాష్‌బోర్డ్. g తర్వాత p → ఉత్పత్తులు. g తర్వాత k → POS బిల్లింగ్. Ctrl+B → బిల్లులు. n → కొత్తది (సందర్భానుసారం).',
        },
      },
    ],
    relatedTopics: ['pos', 'purchase-orders'],
    tags: ['dashboard', 'sales', 'stock', 'alerts'],
  },

  // ── Products ───────────────────────────────────────────────────────────────
  {
    id:      'products',
    route:   '/dashboard/products',
    module:  'products',
    version: '1.0',
    title:   { en: 'Products', te: 'ఉత్పత్తులు' },
    summary: {
      en: 'Your master product catalog. Each product holds the name, category, HSN code, and GST rate. Pricing and stock are managed through PLUs (Price Look-Up codes) — one product can have many PLUs for different pack sizes or batches.',
      te: 'మీ మాస్టర్ ఉత్పత్తి కేటలాగ్. ప్రతి ఉత్పత్తి పేరు, వర్గం, HSN కోడ్ మరియు GST రేటును కలిగి ఉంటుంది. ధర మరియు స్టాక్ PLUల ద్వారా నిర్వహించబడతాయి — ఒక ఉత్పత్తికి వేర్వేరు ప్యాక్ సైజులు లేదా బ్యాచ్‌ల కోసం అనేక PLUలు ఉండవచ్చు.',
    },
    sections: [
      {
        title: { en: 'HSN Code', te: 'HSN కోడ్' },
        body:  {
          en: 'Harmonised System of Nomenclature code — mandatory for GST filing. 4-digit codes are acceptable; 6 or 8 digits give more precision. For groceries: Sugar = 1701, Rice = 1006, Edible Oil = 1511, Dal = 0713, Atta = 1101.',
          te: 'హార్మోనైజ్డ్ సిస్టమ్ ఆఫ్ నొమెంక్లేచర్ కోడ్ — GST ఫైలింగ్‌కు తప్పనిసరి. 4-అంకెల కోడ్‌లు ఆమోదయోగ్యం; 6 లేదా 8 అంకెలు మరింత ఖచ్చితత్వాన్ని ఇస్తాయి. కిరాణా కోసం: చక్కెర = 1701, బియ్యం = 1006, నూనె = 1511, పప్పు = 0713, ఆటా = 1101.',
        },
      },
      {
        title: { en: 'Product vs PLU', te: 'ఉత్పత్తి vs PLU' },
        body:  {
          en: 'A Product is the master record (Sugar, Rice, Sunflower Oil). A PLU is a price variant — Sugar 1kg, Sugar 5kg, Sugar 50kg bulk are three separate PLUs under the same Product. Stock is tracked at the PLU level.',
          te: 'ఒక ఉత్పత్తి మాస్టర్ రికార్డు (చక్కెర, బియ్యం, సన్‌ఫ్లవర్ ఆయిల్). PLU అనేది ధర వేరియంట్ — చక్కెర 1kg, చక్కెర 5kg, చక్కెర 50kg బల్క్ అనేవి ఒకే ఉత్పత్తి కింద మూడు వేర్వేరు PLUలు. స్టాక్ PLU స్థాయిలో ట్రాక్ చేయబడుతుంది.',
        },
      },
      {
        title: { en: 'Search Tips', te: 'శోధన చిట్కాలు' },
        body:  {
          en: 'Use * as a wildcard in the top search bar. Example: sun*oil finds Sunflower Oil, Sunpure Oil, etc. You can also search by barcode, product code, or HSN code.',
          te: 'పై శోధన బార్‌లో * ని వైల్డ్‌కార్డ్‌గా ఉపయోగించండి. ఉదాహరణ: sun*oil సన్‌ఫ్లవర్ ఆయిల్, సన్‌ప్యూర్ ఆయిల్ మొదలైనవి కనుగొంటుంది. మీరు బార్‌కోడ్, ఉత్పత్తి కోడ్ లేదా HSN కోడ్ ద్వారా కూడా శోధించవచ్చు.',
        },
      },
    ],
    relatedTopics: ['plu', 'grn'],
    tags: ['products', 'catalog', 'hsn', 'gst'],
  },

  // ── PLU Management ─────────────────────────────────────────────────────────
  {
    id:      'plu',
    route:   '/dashboard/products/[id]/plu',
    module:  'products',
    version: '2.4',
    title:   { en: 'PLU Management', te: 'PLU నిర్వహణ' },
    summary: {
      en: 'A PLU (Price Look-Up) is a price and pack variant of a product. One product can have multiple PLUs — different sizes, batches, or price points. Stock is tracked per PLU. New in v2.4: Unit of Measurement (UOM) fields for accurate break-bulk calculations.',
      te: 'PLU (ప్రైస్ లుక్-అప్) అనేది ఒక ఉత్పత్తి యొక్క ధర మరియు ప్యాక్ వేరియంట్. ఒక ఉత్పత్తికి అనేక PLUలు ఉండవచ్చు — వేర్వేరు సైజులు, బ్యాచ్‌లు లేదా ధర పాయింట్‌లు. స్టాక్ PLU స్థాయిలో ట్రాక్ చేయబడుతుంది. v2.4లో కొత్తది: ఖచ్చితమైన బ్రేక్-బల్క్ లెక్కింపుల కోసం UOM ఫీల్డ్‌లు.',
    },
    fields: {
      'MRP': {
        en: 'Maximum Retail Price as printed on the pack. Must always be ≥ Selling Price.',
        te: 'ప్యాక్‌పై ముద్రించిన గరిష్ట రిటైల్ ధర. అమ్మకపు ధర కంటే ఎల్లప్పుడూ ≥ అయి ఉండాలి.',
      },
      'Selling Price': {
        en: 'The price charged to customers at the counter. Cannot exceed MRP. GST is calculated from this price.',
        te: 'కౌంటర్‌లో కస్టమర్లకు వసూలు చేసే ధర. MRP మించకూడదు. ఈ ధర నుండి GST లెక్కించబడుతుంది.',
      },
      'Tax Inclusive': {
        en: 'ON = selling price already includes GST (most retail items). OFF = GST is added on top at billing time.',
        te: 'ON = అమ్మకపు ధరలో ఇప్పటికే GST చేర్చబడింది (చాలా రిటైల్ వస్తువులు). OFF = బిల్లింగ్ సమయంలో GST అదనంగా జోడించబడుతుంది.',
      },
      'GST Rate': {
        en: 'GST percentage applicable to this item. Used in billing and GST returns. Common rates: 0% (raw food), 5% (processed food), 12%, 18%.',
        te: 'ఈ వస్తువుకు వర్తించే GST శాతం. బిల్లింగ్ మరియు GST రిటర్న్‌లలో ఉపయోగించబడుతుంది. సాధారణ రేట్లు: 0% (ముడి ఆహారం), 5% (ప్రాసెస్డ్ ఆహారం), 12%, 18%.',
      },
      'Measure Type': {
        en: 'WEIGHT for items sold by kg or g (sugar, rice, atta). VOLUME for liquids (oil, milk). COUNT for pieces, boxes, bottles.',
        te: 'kg లేదా g లో అమ్మే వస్తువులకు WEIGHT (చక్కెర, బియ్యం, ఆటా). ద్రవాలకు VOLUME (నూనె, పాలు). ముక్కలు, పెట్టెలు, బాటిల్‌లకు COUNT.',
      },
      'Unit Symbol': {
        en: 'The specific unit: kg, g, L, ml, pcs, nos, ctn, box, doz, btl, bag, pkt. Select Measure Type first — the options filter automatically.',
        te: 'నిర్దిష్ట యూనిట్: kg, g, L, ml, pcs, nos, ctn, box, doz, btl, bag, pkt. ముందు Measure Type ఎంచుకోండి — ఎంపికలు స్వయంచాలకంగా ఫిల్టర్ అవుతాయి.',
      },
      'Pack Size': {
        en: 'Size of this pack in the selected unit. For a 50 kg bag → enter 50. For a 500 g packet → enter 500. For a 1 L bottle → enter 1.',
        te: 'ఎంచుకున్న యూనిట్‌లో ఈ ప్యాక్ సైజు. 50 kg బ్యాగ్ కోసం → 50 నమోదు చేయండి. 500 g ప్యాకెట్ కోసం → 500 నమోదు చేయండి. 1 L బాటిల్ కోసం → 1.',
      },
      'Base Qty': {
        en: 'Auto-calculated. Always in the smallest unit — grams for WEIGHT, ml for VOLUME. Used by Break Bulk to auto-fill weights. You never type this directly.',
        te: 'స్వయంచాలకంగా లెక్కించబడుతుంది. ఎల్లప్పుడూ చిన్న యూనిట్‌లో — WEIGHT కోసం గ్రాములు, VOLUME కోసం ml. బ్రేక్ బల్క్ బరువులను స్వయంచాలకంగా నింపడానికి ఉపయోగించబడుతుంది. మీరు దీన్ని నేరుగా టైప్ చేయరు.',
      },
      'GST UQC': {
        en: 'GST Unit Quantity Code — required for e-invoicing and GST annual returns. Auto-filled when you pick a unit symbol. KGS=kg, GMS=g, LTR=L, MLT=ml, PCS=pcs.',
        te: 'GST యూనిట్ పరిమాణ కోడ్ — ఇ-ఇన్‌వాయిసింగ్ మరియు GST వార్షిక రిటర్న్‌లకు అవసరం. యూనిట్ చిహ్నం ఎంచుకున్నప్పుడు స్వయంచాలకంగా నిండుతుంది. KGS=kg, GMS=g, LTR=L, MLT=ml, PCS=pcs.',
      },
      'Loose / Weigh': {
        en: 'Mark ON for counter loose items sold by weight (e.g. loose sugar, loose rice). Phase 2 will enable per-gram pricing at the billing counter.',
        te: 'బరువు ద్వారా అమ్మే కౌంటర్ లూస్ వస్తువులకు ON గుర్తించండి (ఉదా. లూస్ చక్కెర, లూస్ బియ్యం). దశ 2 బిల్లింగ్ కౌంటర్‌లో గ్రాముకు ధరను ప్రారంభిస్తుంది.',
      },
      'Opening Stock': {
        en: 'Initial quantity when creating a new PLU. Set to the actual count/weight on your shelf right now.',
        te: 'కొత్త PLU సృష్టించేటప్పుడు ప్రారంభ పరిమాణం. ఇప్పుడు మీ షెల్ఫ్‌లో ఉన్న వాస్తవ గణన/బరువుకు సెట్ చేయండి.',
      },
    },
    sections: [
      {
        title: { en: 'When to create multiple PLUs', te: 'అనేక PLUలు ఎప్పుడు సృష్టించాలి' },
        body:  {
          en: 'Create a new PLU when: (1) the same product comes in a different pack size — e.g. Sugar 1kg and Sugar 5kg. (2) A new batch arrives at a different cost price. (3) You want a different selling price for wholesale vs retail. Each PLU tracks its own stock independently.',
          te: 'కొత్త PLU సృష్టించండి: (1) అదే ఉత్పత్తి వేర్వేరు ప్యాక్ సైజులో వస్తే — ఉదా. చక్కెర 1kg మరియు చక్కెర 5kg. (2) వేర్వేరు కాస్ట్ ధరలో కొత్త బ్యాచ్ వస్తే. (3) హోల్‌సేల్ vs రిటైల్‌కు వేర్వేరు అమ్మకపు ధర కావాలంటే. ప్రతి PLU దాని స్వంత స్టాక్‌ను స్వతంత్రంగా ట్రాక్ చేస్తుంది.',
        },
      },
      {
        title: { en: 'Setting up UOM for weighable items', te: 'తూకం వేయగల వస్తువులకు UOM సెట్ అప్' },
        body:  {
          en: 'For items like Sugar 50kg bag: set Measure Type = WEIGHT, Unit = kg, Pack Size = 50. The system stores 50000 g internally. When you go to Break Bulk, the bulk weight is auto-filled — no manual entry needed. Do this once per PLU and all future break-bulk sessions are smarter.',
          te: 'చక్కెర 50kg బ్యాగ్ వంటి వస్తువులకు: Measure Type = WEIGHT, Unit = kg, Pack Size = 50 సెట్ చేయండి. సిస్టమ్ అంతర్గతంగా 50000 g నిల్వ చేస్తుంది. మీరు బ్రేక్ బల్క్‌కు వెళ్ళినప్పుడు, బల్క్ బరువు స్వయంచాలకంగా నిండుతుంది — మాన్యువల్ ఎంట్రీ అవసరం లేదు. ప్రతి PLUకు ఒకసారి చేయండి మరియు భవిష్యత్ అన్ని బ్రేక్-బల్క్ సెషన్‌లు తెలివిగా ఉంటాయి.',
        },
      },
      {
        title: { en: 'Default PLU', te: 'డిఫాల్ట్ PLU' },
        body:  {
          en: 'The star (★) PLU is the default — its price syncs back to the product master and appears on the online store. When you receive stock via GRN, a new PLU is auto-created and set as default. You can change the default anytime using the ★ button.',
          te: 'స్టార్ (★) PLU డిఫాల్ట్ — దాని ధర ప్రొడక్ట్ మాస్టర్‌కు సమకాలికీకరించబడుతుంది మరియు ఆన్‌లైన్ స్టోర్‌లో కనిపిస్తుంది. మీరు GRN ద్వారా స్టాక్ స్వీకరించినప్పుడు, కొత్త PLU స్వయంచాలకంగా సృష్టించబడి డిఫాల్ట్‌గా సెట్ చేయబడుతుంది. ★ బటన్ ఉపయోగించి మీరు ఎప్పుడైనా డిఫాల్ట్ మార్చవచ్చు.',
        },
      },
    ],
    commonMistakes: [
      {
        mistake: {
          en: 'Selling Price is higher than MRP',
          te: 'అమ్మకపు ధర MRP కంటే ఎక్కువ',
        },
        fix: {
          en: 'MRP is the maximum you can charge by law. Set MRP = the printed price on the pack, then set Selling Price ≤ MRP.',
          te: 'MRP చట్టం ప్రకారం మీరు వసూలు చేయగల గరిష్ట మొత్తం. MRP = ప్యాక్‌పై ముద్రించిన ధరగా సెట్ చేయండి, తర్వాత అమ్మకపు ధర ≤ MRP సెట్ చేయండి.',
        },
      },
      {
        mistake: {
          en: 'Creating PLU without setting UOM for weighable items',
          te: 'తూకం వేయగల వస్తువులకు UOM సెట్ చేయకుండా PLU సృష్టించడం',
        },
        fix: {
          en: 'Always set Measure Type, Unit, and Pack Size for sugar, rice, atta, oil, dal, dry fruits, and tea. This makes break-bulk automatic and GST UQC correct for returns.',
          te: 'చక్కెర, బియ్యం, ఆటా, నూనె, పప్పు, డ్రై ఫ్రూట్స్ మరియు టీ కోసం ఎల్లప్పుడూ Measure Type, Unit మరియు Pack Size సెట్ చేయండి. ఇది బ్రేక్-బల్క్‌ను స్వయంచాలకంగా చేస్తుంది మరియు రిటర్న్‌ల కోసం GST UQC సరిగ్గా ఉంటుంది.',
        },
      },
      {
        mistake: {
          en: 'GST Rate not set on a PLU',
          te: 'PLUలో GST రేటు సెట్ చేయకపోవడం',
        },
        fix: {
          en: 'Even exempt items should have GST Rate = 0%. Without it, the GST return summary will show that item under "Unknown" and cause filing issues.',
          te: 'మినహాయింపు పొందిన వస్తువులకు కూడా GST రేటు = 0% సెట్ చేయాలి. లేకుండా, GST రిటర్న్ సారాంశం ఆ వస్తువును "తెలియదు" కింద చూపిస్తుంది మరియు ఫైలింగ్ సమస్యలు తలెత్తవచ్చు.',
        },
      },
    ],
    relatedTopics: ['break-bulk', 'grn', 'products'],
    tags: ['plu', 'price', 'stock', 'uom', 'gst', 'mrp'],
  },

  // ── Break Bulk ─────────────────────────────────────────────────────────────
  {
    id:      'break-bulk',
    route:   '/dashboard/inventory/break-bulk',
    module:  'inventory',
    version: '2.3',
    title:   { en: 'Break Bulk', te: 'బ్రేక్ బల్క్' },
    summary: {
      en: 'Split large bulk items into smaller retail packs. Stock moves from the bulk PLU to individual retail PLUs. Two modes: Fixed (carton → counted units) and Variable (bulk weight → custom packs by weight).',
      te: 'పెద్ద బల్క్ వస్తువులను చిన్న రిటైల్ ప్యాక్‌లుగా విభజించండి. స్టాక్ బల్క్ PLU నుండి వ్యక్తిగత రిటైల్ PLUలకు తరలుతుంది. రెండు మోడ్‌లు: Fixed (కార్టన్ → గణించిన యూనిట్‌లు) మరియు Variable (బల్క్ బరువు → బరువు ద్వారా కస్టమ్ ప్యాక్‌లు).',
    },
    sections: [
      {
        title: { en: 'Fixed Break', te: 'ఫిక్స్‌డ్ బ్రేక్' },
        body:  {
          en: 'Use when 1 bulk unit always yields the same number of singles. Example: 1 carton of Biscuits = 12 packets, every time. Set up once (1 carton → 12 packs), then each session just needs the quantity of cartons to break. Stock maths is done automatically.',
          te: '1 బల్క్ యూనిట్ ఎల్లప్పుడూ అదే సంఖ్యలో సింగిల్‌లను ఇచ్చినప్పుడు ఉపయోగించండి. ఉదాహరణ: బిస్కెట్‌ల 1 కార్టన్ = 12 ప్యాకెట్లు, ప్రతిసారి. ఒకసారి సెట్ అప్ చేయండి (1 కార్టన్ → 12 ప్యాక్‌లు), తర్వాత ప్రతి సెషన్‌కు బ్రేక్ చేయడానికి కార్టన్‌ల పరిమాణం మాత్రమే అవసరం. స్టాక్ లెక్కింపు స్వయంచాలకంగా జరుగుతుంది.',
        },
      },
      {
        title: { en: 'Variable Break', te: 'వేరియబుల్ బ్రేక్' },
        body:  {
          en: 'Use for weighable items like Sugar, Rice, Dal, Atta, Oil. A 50 kg bag is split into custom packs — today 500g packs, tomorrow 1kg packs. Enter the pack sizes and quantities actually produced. Any remainder is recorded as wastage.',
          te: 'చక్కెర, బియ్యం, పప్పు, ఆటా, నూనె వంటి తూకం వేయగల వస్తువులకు ఉపయోగించండి. 50 kg బ్యాగ్ కస్టమ్ ప్యాక్‌లుగా విభజించబడింది — ఈరోజు 500g ప్యాక్‌లు, రేపు 1kg ప్యాక్‌లు. వాస్తవంగా ఉత్పత్తి చేసిన ప్యాక్ సైజులు మరియు పరిమాణాలు నమోదు చేయండి. ఏదైనా మిగిలినది వ్యర్థంగా నమోదు చేయబడుతుంది.',
        },
      },
      {
        title: { en: 'Inline Setup — First Time', te: 'ఇన్‌లైన్ సెటప్ — మొదటిసారి' },
        body:  {
          en: 'You never need to go to the Products page first. Search for any item, and if it has no bundle configured, the setup wizard opens right here. Set break type → select output PLU → save. Future sessions skip straight to the break screen.',
          te: 'మీరు ముందు ఉత్పత్తుల పేజీకి వెళ్ళాల్సిన అవసరం లేదు. ఏదైనా వస్తువు కోసం శోధించండి, మరియు అది బండిల్ కాన్ఫిగర్ చేయకపోతే, సెటప్ విజార్డ్ ఇక్కడే తెరుచుకుంటుంది. బ్రేక్ టైప్ సెట్ చేయండి → అవుట్‌పుట్ PLU ఎంచుకోండి → సేవ్ చేయండి. భవిష్యత్ సెషన్‌లు నేరుగా బ్రేక్ స్క్రీన్‌కు వెళ్తాయి.',
        },
      },
      {
        title: { en: 'Wastage Tracking', te: 'వ్యర్థం ట్రాకింగ్' },
        body:  {
          en: 'For variable breaks, any weight unaccounted for (dust, spillage, moisture loss) is wastage. Enter it in grams along with a reason. The Wastage Report shows cumulative losses by product and period — useful for pricing decisions.',
          te: 'వేరియబుల్ బ్రేక్‌ల కోసం, ఏ బరువు లెక్కలోకి రాకుండా ఉంటే (దుమ్ము, చిందటం, తేమ నష్టం) అది వ్యర్థం. కారణంతో పాటు గ్రాములలో నమోదు చేయండి. వ్యర్థం నివేదిక ఉత్పత్తి మరియు వ్యవధి ద్వారా సంచిత నష్టాలను చూపిస్తుంది — ధర నిర్ణయాలకు ఉపయోగకరం.',
        },
      },
      {
        title: { en: 'Reversing a Session', te: 'సెషన్ రివర్స్ చేయడం' },
        body:  {
          en: 'Mistakes happen. Open the History tab, find the session, and click Reverse. All stock movements are undone. Reversal is only possible if no stock from that session has been sold yet.',
          te: 'తప్పులు జరుగుతాయి. హిస్టరీ ట్యాబ్ తెరవండి, సెషన్ కనుగొనండి మరియు రివర్స్ క్లిక్ చేయండి. అన్ని స్టాక్ కదలికలు రద్దు చేయబడతాయి. ఆ సెషన్ నుండి ఏ స్టాక్ అమ్మబడకపోతే మాత్రమే రివర్సల్ సాధ్యమవుతుంది.',
        },
      },
    ],
    commonMistakes: [
      {
        mistake: {
          en: 'Breaking more units than available stock',
          te: 'అందుబాటులో ఉన్న స్టాక్ కంటే ఎక్కువ యూనిట్లు బ్రేక్ చేయడం',
        },
        fix: {
          en: 'The system will warn you if source quantity exceeds stock on hand. Always receive the stock via GRN before breaking bulk.',
          te: 'మూల పరిమాణం చేతిలో ఉన్న స్టాక్‌ను మించిపోతే సిస్టమ్ మిమ్మల్ని హెచ్చరిస్తుంది. బల్క్ బ్రేక్ చేయడానికి ముందు ఎల్లప్పుడూ GRN ద్వారా స్టాక్ స్వీకరించండి.',
        },
      },
      {
        mistake: {
          en: 'Total output weight exceeds bulk weight in variable break',
          te: 'వేరియబుల్ బ్రేక్‌లో మొత్తం అవుట్‌పుట్ బరువు బల్క్ బరువు మించడం',
        },
        fix: {
          en: 'Output weight + wastage cannot exceed bulk weight. Reduce quantities or correct the pack size. The running total at the bottom of the screen shows the balance remaining.',
          te: 'అవుట్‌పుట్ బరువు + వ్యర్థం బల్క్ బరువు మించకూడదు. పరిమాణాలు తగ్గించండి లేదా ప్యాక్ సైజు సరిచేయండి. స్క్రీన్ దిగువన రన్నింగ్ మొత్తం మిగిలిన బ్యాలెన్స్ చూపిస్తుంది.',
        },
      },
    ],
    relatedTopics: ['plu', 'products'],
    tags: ['break-bulk', 'stock', 'repack', 'wastage', 'inventory'],
  },

  // ── Purchase Orders ────────────────────────────────────────────────────────
  {
    id:      'purchase-orders',
    route:   '/dashboard/purchase-orders',
    module:  'purchasing',
    version: '2.2',
    title:   { en: 'Purchase Orders', te: 'కొనుగోలు ఆర్డర్లు' },
    summary: {
      en: 'Manage orders placed with suppliers. Purchase Orders are auto-created when stock falls below reorder level. You can also create them manually. A PO becomes a GRN when goods are received.',
      te: 'సరఫరాదారులతో ఉంచిన ఆర్డర్లను నిర్వహించండి. స్టాక్ రీఆర్డర్ స్థాయి కంటే తక్కువగా పడినప్పుడు కొనుగోలు ఆర్డర్లు స్వయంచాలకంగా సృష్టించబడతాయి. మీరు వాటిని మాన్యువల్‌గా కూడా సృష్టించవచ్చు. వస్తువులు స్వీకరించినప్పుడు PO GRNగా మారుతుంది.',
    },
    sections: [
      {
        title: { en: 'Auto-generated POs', te: 'స్వయంచాలక కొనుగోలు ఆర్డర్లు' },
        body:  {
          en: 'When a product\'s stock hits zero, the system creates a Purchase Order automatically and sends it to the default supplier. Check the Dashboard notification panel or this page for pending auto-POs. Review and confirm before calling the supplier.',
          te: 'ఒక ఉత్పత్తి స్టాక్ సున్నాకు చేరినప్పుడు, సిస్టమ్ స్వయంచాలకంగా కొనుగోలు ఆర్డర్ సృష్టించి డిఫాల్ట్ సరఫరాదారుకు పంపుతుంది. పెండింగ్ ఆటో-POలకు డాష్‌బోర్డ్ నోటిఫికేషన్ పానెల్ లేదా ఈ పేజీని తనిఖీ చేయండి. సరఫరాదారుకు కాల్ చేయడానికి ముందు సమీక్షించి నిర్ధారించండి.',
        },
      },
      {
        title: { en: 'PO Status Workflow', te: 'PO స్థితి వర్క్‌ఫ్లో' },
        body:  {
          en: 'DRAFT → you can still edit. SENT → communicated to supplier. RECEIVED → goods arrived, GRN created. CANCELLED → order dropped. Once a GRN is created from a PO, the PO cannot be modified.',
          te: 'DRAFT → మీరు ఇంకా సవరించవచ్చు. SENT → సరఫరాదారుకు తెలియజేయబడింది. RECEIVED → వస్తువులు వచ్చాయి, GRN సృష్టించబడింది. CANCELLED → ఆర్డర్ రద్దు. PO నుండి GRN సృష్టించిన తర్వాత PO సవరించలేరు.',
        },
      },
    ],
    relatedTopics: ['grn', 'suppliers'],
    tags: ['purchase', 'orders', 'supplier', 'po'],
  },

  // ── GRN ───────────────────────────────────────────────────────────────────
  {
    id:      'grn',
    route:   '/dashboard/grn',
    module:  'purchasing',
    version: '1.1',
    title:   { en: 'Goods Receipt Note (GRN)', te: 'వస్తువుల రసీదు నోట్ (GRN)' },
    summary: {
      en: 'Record stock received from suppliers. Each GRN creates or updates a PLU, adds stock, and creates a payable to the supplier. Approve the GRN only after physically verifying the items and quantities.',
      te: 'సరఫరాదారుల నుండి స్వీకరించిన స్టాక్‌ను నమోదు చేయండి. ప్రతి GRN PLUను సృష్టిస్తుంది లేదా అప్‌డేట్ చేస్తుంది, స్టాక్ జోడిస్తుంది మరియు సరఫరాదారుకు చెల్లించాల్సిన మొత్తాన్ని సృష్టిస్తుంది. వస్తువులు మరియు పరిమాణాలను శారీరకంగా ధృవీకరించిన తర్వాత మాత్రమే GRN ఆమోదించండి.',
    },
    sections: [
      {
        title: { en: 'Draft vs Approved', te: 'డ్రాఫ్ట్ vs ఆమోదించబడింది' },
        body:  {
          en: 'A DRAFT GRN does not affect stock. Approve it only when goods are physically verified and accepted. Once approved, stock is added and a payable is created. Approval cannot be undone — raise a new GRN for corrections.',
          te: 'DRAFT GRN స్టాక్‌ను ప్రభావితం చేయదు. వస్తువులు శారీరకంగా ధృవీకరించి అంగీకరించిన తర్వాత మాత్రమే ఆమోదించండి. ఆమోదించిన తర్వాత, స్టాక్ జోడించబడుతుంది మరియు చెల్లించాల్సిన మొత్తం సృష్టించబడుతుంది. ఆమోదాన్ని రద్దు చేయలేరు — దిద్దుబాట్లకు కొత్త GRN జారీ చేయండి.',
        },
      },
      {
        title: { en: 'Cost Price & PLU Creation', te: 'కాస్ట్ ధర & PLU సృష్టి' },
        body:  {
          en: 'Each GRN line creates a new PLU with the received cost price. The new PLU is set as default. Old PLUs remain active with their existing stock until sold out — this handles price fluctuation correctly without losing history.',
          te: 'ప్రతి GRN లైన్ స్వీకరించిన కాస్ట్ ధరతో కొత్త PLU సృష్టిస్తుంది. కొత్త PLU డిఫాల్ట్‌గా సెట్ చేయబడుతుంది. పాత PLUలు అమ్ముడయ్యే వరకు వాటి స్టాక్‌తో యాక్టివ్‌గా ఉంటాయి — ఇది చరిత్రను కోల్పోకుండా ధర హెచ్చుతగ్గులను సరిగ్గా నిర్వహిస్తుంది.',
        },
      },
    ],
    relatedTopics: ['purchase-orders', 'suppliers', 'plu'],
    tags: ['grn', 'stock', 'receipt', 'supplier', 'purchase'],
  },

  // ── POS / Billing ──────────────────────────────────────────────────────────
  {
    id:      'pos',
    route:   '/dashboard/pos',
    module:  'sales',
    version: '1.2',
    title:   { en: 'POS — Billing', te: 'POS — బిల్లింగ్' },
    summary: {
      en: 'The billing counter. Scan barcodes or search products to add to cart, apply discounts, select payment mode, and print the bill. Supports Cash, UPI, and Card. GST is calculated automatically on every item.',
      te: 'బిల్లింగ్ కౌంటర్. కార్ట్‌కు జోడించడానికి బార్‌కోడ్‌లను స్కాన్ చేయండి లేదా ఉత్పత్తులను శోధించండి, తగ్గింపులు వర్తింపజేయండి, చెల్లింపు మోడ్ ఎంచుకోండి మరియు బిల్లు ప్రింట్ చేయండి. నగదు, UPI మరియు కార్డ్‌కు మద్దతు ఇస్తుంది. ప్రతి వస్తువుపై GST స్వయంచాలకంగా లెక్కించబడుతుంది.',
    },
    sections: [
      {
        title: { en: 'Adding Items', te: 'వస్తువులు జోడించడం' },
        body:  {
          en: 'Scan barcode → item added instantly. Or type product name / PLU code in the search box and press Enter. Use quantity field to set amount before adding. For weight-sold items, enter grams in the weight field.',
          te: 'బార్‌కోడ్ స్కాన్ చేయండి → వస్తువు తక్షణం జోడించబడుతుంది. లేదా శోధన పెట్టెలో ఉత్పత్తి పేరు / PLU కోడ్ టైప్ చేసి Enter నొక్కండి. జోడించే ముందు పరిమాణాన్ని సెట్ చేయడానికి పరిమాణ ఫీల్డ్ ఉపయోగించండి. బరువు అమ్మే వస్తువులకు, బరువు ఫీల్డ్‌లో గ్రాములు నమోదు చేయండి.',
        },
      },
      {
        title: { en: 'Payment Modes', te: 'చెల్లింపు మోడ్‌లు' },
        body:  {
          en: 'Cash: enter amount tendered, change is calculated. UPI: shows QR / confirm on scanner. Card: enter terminal reference. Split payment: you can combine cash + UPI + card for one bill. Always match the physical payment before confirming.',
          te: 'నగదు: సమర్పించిన మొత్తం నమోదు చేయండి, చిల్లర లెక్కించబడుతుంది. UPI: QR చూపిస్తుంది / స్కానర్‌లో నిర్ధారించండి. కార్డ్: టర్మినల్ రిఫరెన్స్ నమోదు చేయండి. విభజిత చెల్లింపు: ఒక బిల్లుకు నగదు + UPI + కార్డ్ కలపవచ్చు. నిర్ధారించే ముందు ఎల్లప్పుడూ శారీరక చెల్లింపుతో సరిపోల్చండి.',
        },
      },
      {
        title: { en: 'POS Keyboard Shortcuts', te: 'POS కీబోర్డ్ షార్ట్‌కట్‌లు' },
        body:  {
          en: 'F5 → focus barcode scanner input. F6 → focus search. F8 → open customer select. F10 → go to payment screen. Escape → cancel current action. These shortcuts work only on the POS page.',
          te: 'F5 → బార్‌కోడ్ స్కానర్ ఇన్‌పుట్‌కు ఫోకస్. F6 → శోధనకు ఫోకస్. F8 → కస్టమర్ సెలెక్ట్ తెరవండి. F10 → చెల్లింపు స్క్రీన్‌కు వెళ్ళండి. Escape → ప్రస్తుత చర్య రద్దు చేయండి. ఈ షార్ట్‌కట్‌లు POS పేజీలో మాత్రమే పని చేస్తాయి.',
        },
      },
    ],
    commonMistakes: [
      {
        mistake: {
          en: 'Bill closed without collecting payment',
          te: 'చెల్లింపు వసూలు చేయకుండా బిల్లు మూసివేయడం',
        },
        fix: {
          en: 'Always confirm the payment screen before closing. The bill is not final until a payment mode is selected and confirmed.',
          te: 'మూసివేయడానికి ముందు ఎల్లప్పుడూ చెల్లింపు స్క్రీన్ నిర్ధారించండి. చెల్లింపు మోడ్ ఎంచుకుని నిర్ధారించే వరకు బిల్లు ఖాయం కాదు.',
        },
      },
    ],
    relatedTopics: ['dashboard'],
    tags: ['pos', 'billing', 'sales', 'payment', 'gst'],
  },

  // ── Suppliers ──────────────────────────────────────────────────────────────
  {
    id:      'suppliers',
    route:   '/dashboard/suppliers',
    module:  'purchasing',
    version: '1.0',
    title:   { en: 'Suppliers', te: 'సరఫరాదారులు' },
    summary: {
      en: 'Manage your supplier master. Each supplier holds contact, GSTIN, payment terms, bank details, and a running ledger of purchases vs payments. Accurate supplier data is needed for GST input credit claims.',
      te: 'మీ సరఫరాదారు మాస్టర్‌ను నిర్వహించండి. ప్రతి సరఫరాదారు సంప్రదింపు సమాచారం, GSTIN, చెల్లింపు నిబంధనలు, బ్యాంక్ వివరాలు మరియు కొనుగోళ్ళు vs చెల్లింపుల రన్నింగ్ లెడ్జర్ కలిగి ఉంటాడు. GST ఇన్‌పుట్ క్రెడిట్ క్లెయిమ్‌లకు ఖచ్చితమైన సరఫరాదారు డేటా అవసరం.',
    },
    sections: [
      {
        title: { en: 'GSTIN — Why It Matters', te: 'GSTIN — ఎందుకు ముఖ్యం' },
        body:  {
          en: 'A supplier\'s GSTIN is required to claim GST input credit on purchases. Without it, you pay GST but cannot offset it against your output GST. Always collect GSTIN before the first GRN from any registered supplier.',
          te: 'కొనుగోళ్ళపై GST ఇన్‌పుట్ క్రెడిట్ క్లెయిమ్ చేయడానికి సరఫరాదారు GSTIN అవసరం. లేకుండా, మీరు GST చెల్లిస్తారు కానీ మీ అవుట్‌పుట్ GST కు వ్యతిరేకంగా సర్దుబాటు చేయలేరు. ఏ నమోదిత సరఫరాదారు నుండైనా మొదటి GRN కంటే ముందు GSTIN సేకరించండి.',
        },
      },
      {
        title: { en: 'Supplier Ledger', te: 'సరఫరాదారు లెడ్జర్' },
        body:  {
          en: 'Open any supplier → Ledger tab. Shows every GRN (purchase) and every payment made. Balance Due = total purchases − payments made. Use this before making a payment to verify the correct outstanding amount.',
          te: 'ఏదైనా సరఫరాదారు తెరవండి → లెడ్జర్ ట్యాబ్. ప్రతి GRN (కొనుగోలు) మరియు చేసిన ప్రతి చెల్లింపు చూపిస్తుంది. బకాయి బ్యాలెన్స్ = మొత్తం కొనుగోళ్ళు − చేసిన చెల్లింపులు. చెల్లింపు చేయడానికి ముందు సరైన బాకీ మొత్తాన్ని ధృవీకరించడానికి దీన్ని ఉపయోగించండి.',
        },
      },
    ],
    relatedTopics: ['purchase-orders', 'grn'],
    tags: ['suppliers', 'gstin', 'ledger', 'payment'],
  },

];

// ─── Route matching ───────────────────────────────────────────────────────────

function matchRoute(pattern: string, pathname: string): boolean {
  // Escape regex special chars, then replace [param] with a wildcard segment
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\[[\w]+\\\]/g, '[^/]+');
  return new RegExp(`^${escaped}(/.*)?$`).test(pathname);
}

export function findEntry(pathname: string): HelpEntry | null {
  const matches = HELP_CONTENT.filter(e => matchRoute(e.route, pathname));
  if (!matches.length) return null;
  // Most specific match = most path segments in the pattern
  return matches.sort((a, b) => b.route.split('/').length - a.route.split('/').length)[0];
}
