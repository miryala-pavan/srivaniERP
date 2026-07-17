// Two distinct numbers, do not conflate them:
//   - Call number: a staffed mobile line, answered for regular phone calls.
//   - WhatsApp number: a landline registered with WhatsApp Cloud API only —
//     it is never answered for voice calls, WhatsApp-only.
export const STORE_CALL_NUMBER = process.env.NEXT_PUBLIC_CALL_NUMBER || '919382828484';
export const STORE_CALL_DISPLAY = process.env.NEXT_PUBLIC_CALL_DISPLAY || '+91 93828 28484';

export const STORE_WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER || '918455276355';
export const STORE_WA_DISPLAY = process.env.NEXT_PUBLIC_WA_DISPLAY || '+91 84552 76355';

export function buildWhatsAppUrl(text?: string) {
  return `https://wa.me/${STORE_WA_NUMBER}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
