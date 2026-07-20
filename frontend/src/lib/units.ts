// Shared unit-of-measure helpers for ProductPlu.measureType/unitSymbol/unitSize/baseUnitQty/gstUqc.
// Single source of truth — reused by the PLU editor, GRN entry, Break Bulk, and Unit Management.

export const UNIT_SYMBOLS: Record<string, string[]> = {
  WEIGHT: ['kg', 'g'],
  VOLUME: ['L', 'ml'],
  COUNT:  ['pcs', 'nos', 'ctn', 'box', 'doz', 'btl', 'bag', 'pkt'],
};

export const UQC_MAP: Record<string, string> = {
  kg: 'KGS', g: 'GMS', L: 'LTR', ml: 'MLT',
  pcs: 'PCS', nos: 'NOS', ctn: 'CTN', box: 'BOX',
  doz: 'DOZ', btl: 'BTL', bag: 'BAG', pkt: 'PAC',
};

// Universal, fixed conversions for COUNT-type units that represent a known multiple of pieces
// (unlike ctn/box/bag/pkt, whose size varies per product). Add gross/pair/score here (and to
// UNIT_SYMBOLS.COUNT + UQC_MAP) if this catalog ever needs them.
export const FIXED_COUNT_MULTIPLIERS: Record<string, number> = {
  doz: 12,
};

export function calcBaseUnitQty(unitSymbol: string, unitSize: number): number {
  if (unitSymbol === 'kg' || unitSymbol === 'L') return unitSize * 1000;
  if (FIXED_COUNT_MULTIPLIERS[unitSymbol]) return unitSize * FIXED_COUNT_MULTIPLIERS[unitSymbol];
  return unitSize;
}

export function fmtBaseQty(symbol: string, qty: number): string {
  if (symbol === 'kg' || symbol === 'g') return `${qty.toLocaleString('en-IN')} g`;
  if (symbol === 'L' || symbol === 'ml') return `${qty.toLocaleString('en-IN')} ml`;
  return `${qty}`;
}

export function deriveUqc(unitSymbol: string): string | null {
  return UQC_MAP[unitSymbol] ?? null;
}

export interface SuggestedUnit {
  measureType: 'WEIGHT' | 'VOLUME' | 'COUNT';
  unitSymbol: string;
  unitSize: number;
}

// Parses a trailing "number+unit" pattern out of a product name, e.g. "SUGAR 50KG" -> WEIGHT/kg/50,
// "Santoor Soap 100G" -> WEIGHT/g/100, "Oil 1L" -> VOLUME/L/1. Always a suggestion to confirm/edit,
// never applied automatically. (Historical GRN packSize data was evaluated as a free pre-fill source
// too — only ~10% of records had it set, too sparse to be a reliable input — so it's not used here.)
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
