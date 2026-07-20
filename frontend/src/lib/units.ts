// Shared unit-of-measure helpers for ProductPlu.measureType/unitSymbol/unitSize/baseUnitQty/gstUqc.
// Single source of truth — reused by the PLU editor, GRN entry, Break Bulk, Unit Management,
// and the Product add/edit form.
//
// Grounded in two Indian government standards, not invented ad hoc:
//  - GST UQC (Unit Quantity Code) — the full ~42-code list CBIC/GSTN require on GST returns
//    (GSTR-1, e-invoices). Every code below is a real UQC code; "OTH" is the portal's own
//    fallback for anything uncovered.
//  - Legal Metrology Act 2009 / Packaged Commodities Rules 2011 — governs what can legally be
//    declared as *net quantity on packaging*: weight, volume, or a plain number/count only
//    (Rule 6, SI units only). That's why pack-size math (base-unit conversion, used by Break
//    Bulk to auto-track wastage) only runs for WEIGHT/VOLUME/COUNT — LENGTH and AREA are real,
//    selectable GST UQC categories (cloth, wire, tiles, flooring...) but Legal Metrology has no
//    "net quantity by length" packaging concept to compute wastage against, so those measure
//    types stay selectable for correct GST filing without pack-size auto-tracking.

export type MeasureType = 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'AREA' | 'COUNT';

export const MEASURE_TYPES: MeasureType[] = ['WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'COUNT'];

export const MEASURE_TYPE_LABELS: Record<MeasureType, string> = {
  WEIGHT: 'Weight',
  VOLUME: 'Volume',
  LENGTH: 'Length',
  AREA:   'Area',
  COUNT:  'Count',
};

// Display symbol -> official GST UQC code, grouped by measure type. Keyed by plain string
// (not MeasureType) since callers generally hold measureType as free-form component state.
export const UNIT_SYMBOLS: Record<string, string[]> = {
  WEIGHT: ['g', 'kg', 'qtl', 'ton'],
  VOLUME: ['ml', 'L', 'kl', 'ccm', 'cbm'],
  LENGTH: ['cm', 'm', 'km', 'yd', 'gyd'],
  AREA:   ['sqft', 'sqm', 'sqyd'],
  COUNT:  [
    'pcs', 'nos', 'unt', 'doz', 'pair', 'gross', 'greatgross', 'set',
    'box', 'ctn', 'bag', 'pkt', 'btl', 'can', 'tub', 'drm', 'rol', 'bdl',
    'bal', 'bkl', 'bun', 'tbs', 'thousand', 'billion',
  ],
};

export const UQC_MAP: Record<string, string> = {
  // WEIGHT
  g: 'GMS', kg: 'KGS', qtl: 'QTL', ton: 'TON',
  // VOLUME
  ml: 'MLT', L: 'LTR', kl: 'KLR', ccm: 'CCM', cbm: 'CBM',
  // LENGTH
  cm: 'CMS', m: 'MTR', km: 'KME', yd: 'YDS', gyd: 'GYD',
  // AREA
  sqft: 'SQF', sqm: 'SQM', sqyd: 'SQY',
  // COUNT
  pcs: 'PCS', nos: 'NOS', unt: 'UNT', doz: 'DOZ', pair: 'PRS', gross: 'GRS',
  greatgross: 'GGK', set: 'SET', box: 'BOX', ctn: 'CTN', bag: 'BAG', pkt: 'PAC',
  btl: 'BTL', can: 'CAN', tub: 'TUB', drm: 'DRM', rol: 'ROL', bdl: 'BDL',
  bal: 'BAL', bkl: 'BKL', bun: 'BUN', tbs: 'TBS', thousand: 'THD', billion: 'BOU',
};

// Human-readable name per UQC code — for the Unit Definitions reference table.
export const UQC_NAMES: Record<string, string> = {
  GMS: 'Grammes', KGS: 'Kilograms', QTL: 'Quintal', TON: 'Tonnes',
  MLT: 'Millilitre', LTR: 'Litres', KLR: 'Kilolitre', CCM: 'Cubic Centimeters', CBM: 'Cubic Meters',
  CMS: 'Centimeters', MTR: 'Meters', KME: 'Kilometre', YDS: 'Yards', GYD: 'Gross Yards',
  SQF: 'Square Feet', SQM: 'Square Meters', SQY: 'Square Yards',
  PCS: 'Pieces', NOS: 'Numbers', UNT: 'Units', DOZ: 'Dozens', PRS: 'Pairs', GRS: 'Gross',
  GGK: 'Great Gross', SET: 'Sets', BOX: 'Box', CTN: 'Cartons', BAG: 'Bags', PAC: 'Packs',
  BTL: 'Bottles', CAN: 'Cans', TUB: 'Tubes', DRM: 'Drums', ROL: 'Rolls', BDL: 'Bundles',
  BAL: 'Bale', BKL: 'Buckles', BUN: 'Bunches', TBS: 'Tablets', THD: 'Thousands', BOU: 'Billion of Units',
  OTH: 'Others',
};

// Universal, fixed conversions for COUNT-type units that represent a known multiple of pieces
// (unlike box/ctn/bag/pkt/btl/..., whose size genuinely varies per product). Every entry here is
// a real, government-defined multiple (a dozen is always 12, a gross is always 144), not a
// per-catalog assumption.
export const FIXED_COUNT_MULTIPLIERS: Record<string, number> = {
  doz: 12,
  pair: 2,
  gross: 144,      // 12 dozen
  greatgross: 1728, // 12 gross
  thousand: 1000,
};

// Fixed conversions to the base unit within WEIGHT/VOLUME/LENGTH/AREA — either clean SI
// multiples (kg->g, L->ml) or precise physical constants (sqft->sqcm). Base unit per measure
// type: grams (WEIGHT), millilitres (VOLUME), centimetres (LENGTH), square centimetres (AREA).
const WEIGHT_MULTIPLIERS: Record<string, number> = { g: 1, kg: 1000, qtl: 100000, ton: 1000000 };
const VOLUME_MULTIPLIERS: Record<string, number> = { ml: 1, L: 1000, kl: 1000000, ccm: 1, cbm: 1000000 };
const LENGTH_MULTIPLIERS: Record<string, number> = { cm: 1, m: 100, km: 100000, yd: 91.44 };
const AREA_MULTIPLIERS: Record<string, number>   = { sqft: 929.0304, sqm: 10000, sqyd: 8361.2736 };

export function calcBaseUnitQty(unitSymbol: string, unitSize: number): number {
  if (unitSymbol in WEIGHT_MULTIPLIERS) return unitSize * WEIGHT_MULTIPLIERS[unitSymbol];
  if (unitSymbol in VOLUME_MULTIPLIERS) return unitSize * VOLUME_MULTIPLIERS[unitSymbol];
  if (unitSymbol in LENGTH_MULTIPLIERS) return unitSize * LENGTH_MULTIPLIERS[unitSymbol];
  if (unitSymbol in AREA_MULTIPLIERS)   return unitSize * AREA_MULTIPLIERS[unitSymbol];
  if (FIXED_COUNT_MULTIPLIERS[unitSymbol]) return unitSize * FIXED_COUNT_MULTIPLIERS[unitSymbol];
  // gyd (gross yards, a compound trade quantity) and the remaining COUNT pack-units (box, ctn,
  // bag, ...) have no universal multiplier — their size is per-product/per-package, not a
  // government-fixed constant, so the raw entered size IS the base quantity.
  return unitSize;
}

export function fmtBaseQty(symbol: string, qty: number): string {
  if (symbol in WEIGHT_MULTIPLIERS) return `${qty.toLocaleString('en-IN')} g`;
  if (symbol in VOLUME_MULTIPLIERS) return `${qty.toLocaleString('en-IN')} ml`;
  if (symbol in LENGTH_MULTIPLIERS) return `${qty.toLocaleString('en-IN')} cm`;
  if (symbol in AREA_MULTIPLIERS)   return `${qty.toLocaleString('en-IN')} sq.cm`;
  return `${qty}`;
}

export function deriveUqc(unitSymbol: string): string | null {
  return UQC_MAP[unitSymbol] ?? null;
}

// Flat list of every fixed conversion, for display on the Unit Management page's
// "Unit Definitions" reference table — built from the same constants the math above uses,
// so the displayed definitions can never drift out of sync with what's actually computed.
export interface UnitDefinition { symbol: string; uqc: string; equals: string }
export const UNIT_DEFINITIONS: UnitDefinition[] = [
  { symbol: 'kg',  uqc: 'KGS', equals: '1000 g' },
  { symbol: 'qtl', uqc: 'QTL', equals: '100,000 g (100 kg)' },
  { symbol: 'ton', uqc: 'TON', equals: '1,000,000 g (1000 kg)' },
  { symbol: 'L',   uqc: 'LTR', equals: '1000 ml' },
  { symbol: 'kl',  uqc: 'KLR', equals: '1,000,000 ml (1000 L)' },
  { symbol: 'cbm', uqc: 'CBM', equals: '1,000,000 ml (1 cubic metre)' },
  { symbol: 'm',   uqc: 'MTR', equals: '100 cm' },
  { symbol: 'km',  uqc: 'KME', equals: '100,000 cm' },
  { symbol: 'yd',  uqc: 'YDS', equals: '91.44 cm' },
  { symbol: 'sqft', uqc: 'SQF', equals: '929.03 sq.cm' },
  { symbol: 'sqm',  uqc: 'SQM', equals: '10,000 sq.cm' },
  { symbol: 'sqyd', uqc: 'SQY', equals: '8,361.27 sq.cm' },
  { symbol: 'doz',  uqc: 'DOZ', equals: '12 pcs' },
  { symbol: 'pair', uqc: 'PRS', equals: '2 pcs' },
  { symbol: 'gross', uqc: 'GRS', equals: '144 pcs (12 doz)' },
  { symbol: 'greatgross', uqc: 'GGK', equals: '1,728 pcs (12 gross)' },
  { symbol: 'thousand', uqc: 'THD', equals: '1000 pcs' },
];

export interface SuggestedUnit {
  measureType: 'WEIGHT' | 'VOLUME';
  unitSymbol: string;
  unitSize: number;
}

// Parses a trailing "number+unit" pattern out of a product name, e.g. "SUGAR 50KG" -> WEIGHT/kg/50,
// "Santoor Soap 100G" -> WEIGHT/g/100, "Oil 1L" -> VOLUME/L/1. Always a suggestion to confirm/edit,
// never applied automatically. Scoped to weight/volume only — real product names overwhelmingly
// follow this pattern; count/length/area units aren't reliably encoded in names, so guessing there
// would be more likely wrong than helpful. (Historical GRN packSize data was evaluated as a free
// pre-fill source too — only ~10% of records had it set, too sparse to be a reliable input.)
const NAME_PATTERN = /(\d+(?:\.\d+)?)\s*(kgs?|gms?|g|ltrs?|l|mls?|ml)\b/i;

export function suggestUnitFromName(productName: string): SuggestedUnit | null {
  const match = NAME_PATTERN.exec(productName);
  if (!match) return null;
  const size = parseFloat(match[1]);
  if (!size || size <= 0) return null;
  const rawUnit = match[2].toLowerCase();
  if (rawUnit.startsWith('kg')) return { measureType: 'WEIGHT', unitSymbol: 'kg', unitSize: size };
  if (rawUnit.startsWith('g')) return { measureType: 'WEIGHT', unitSymbol: 'g', unitSize: size };
  if (rawUnit.startsWith('l')) return { measureType: 'VOLUME', unitSymbol: 'L', unitSize: size };
  if (rawUnit.startsWith('ml')) return { measureType: 'VOLUME', unitSymbol: 'ml', unitSize: size };
  return null;
}
