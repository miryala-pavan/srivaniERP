const YOUR_STATE_CODE = '36'; // Telangana

export function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .split(' ')
    .map((word) => {
      if (!word) return word;
      // Preserve words that contain digits (e.g., 1L, 500g, 2kg)
      if (/\d/.test(word)) return word;
      // Preserve short all-uppercase abbreviations (HUL, MRP, etc.) — 4 chars or fewer
      if (word.length <= 4 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function cleanSpaces(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

export function applyLiveCorrection(value: string): string {
  if (!value) return value;
  const endsWithSpace = value.endsWith(' ');
  const parts = value.split(' ');
  if (endsWithSpace) {
    return parts.map((w) => (w ? toTitleCase(w) : w)).join(' ');
  }
  const last = parts.pop()!;
  if (parts.length === 0) return last;
  return parts.map((w) => (w ? toTitleCase(w) : w)).join(' ') + ' ' + last;
}

export function toUpperAlpha(str: string): string {
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatPhoneDisplay(str: string): string {
  return str.replace(/\D/g, '').slice(0, 10);
}

export function validatePhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.trim());
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export type GSTINResult =
  | { valid: false; message: string }
  | { valid: true; stateCode: string; isInterstate: boolean };

export function validateGSTIN(gstin: string): GSTINResult {
  const g = gstin.trim().toUpperCase();
  if (!g) return { valid: false, message: 'GSTIN is empty' };
  if (g.length !== 15) return { valid: false, message: `Must be 15 characters (got ${g.length})` };
  if (!GSTIN_REGEX.test(g)) return { valid: false, message: 'Invalid GSTIN format' };
  const stateCode = g.slice(0, 2);
  return { valid: true, stateCode, isInterstate: stateCode !== YOUR_STATE_CODE };
}
