/**
 * Clean up raw bank statement descriptions into short readable labels.
 * SBI uses verbose prefixes like "TO TRANSFER-INB NEFT UTR NO: SBIN..." — strip them.
 */
export function cleanDesc(description: string, refNumber?: string): string {
  const d = description.trim();

  // ── OUTGOING (Debits) ────────────────────────────────
  // "TO TRANSFER-INB NEFT UTR NO: SBIN326157287426--Dvs agencies"
  const toNeftName = d.match(/TO TRANSFER-INB NEFT UTR NO:[^-]+-+(.+)$/i)?.[1]?.trim();
  if (toNeftName) return `NEFT → ${toNeftName}`;

  // "TO TRANSFER-INB 2316 dt 20260527--" (older format, name in refNumber)
  if (/TO TRANSFER-INB\s+\d+\s+dt\s+/i.test(d)) {
    const refName = refNumber?.match(/TRANSFER TO \d+ \/ (.+)$/i)?.[1]?.trim()
      ?? refNumber?.match(/([A-Z][A-Z &.]+)$/)?.[1]?.trim();
    return refName ? `NEFT → ${refName}` : 'NEFT → (see ref)';
  }

  // "TO TRANSFER-INB NEFT UTR NO: ..." any other TO
  if (/^TO TRANSFER/i.test(d)) {
    const name = d.match(/--(.+)$/)?.[1]?.trim()
      ?? refNumber?.match(/TRANSFER TO \d+ \/ (.+)/i)?.[1]?.trim()
      ?? '';
    return name ? `NEFT → ${name}` : 'NEFT → (outgoing)';
  }

  // ── INCOMING (Credits) ───────────────────────────────
  // "BY TRANSFER-NEFT*UTIB0001506*AXNPN...*PHONEPE LIMITED---"
  if (/PHONEPE|PHONE PE/i.test(d))  return 'NEFT ← PhonePe';
  if (/PINE LABS|PINELABS/i.test(d)) return 'NEFT ← Pine Labs (POS)';
  if (/PAYTM/i.test(d))             return 'NEFT ← Paytm';
  if (/RAZORPAY/i.test(d))          return 'NEFT ← Razorpay';

  // "BY TRANSFER-UPI/CR/615203234394/MIRIYALA/CNRB/miryala.pa/UPI--"
  const upiName = d.match(/UPI\/CR\/\d+\/([^/]+)/i)?.[1]?.trim();
  if (upiName) return `UPI ← ${upiName}`;

  // "BY TRANSFER-NEFT*...*PINE LABS..." generic NEFT credit
  if (/^BY TRANSFER-NEFT/i.test(d)) {
    // extract last segment after last *
    const parts = d.split('*').map(s => s.replace(/-+$/, '').trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length > 2 && !/^\d+$/.test(last)) return `NEFT ← ${last}`;
    return 'NEFT ← (incoming)';
  }

  // "BY TRANSFER-IMPS/..."
  if (/^BY TRANSFER-IMPS/i.test(d)) {
    const impsName = d.match(/IMPS\/\d+\/([^/]+)/i)?.[1]?.trim();
    return impsName ? `IMPS ← ${impsName}` : 'IMPS ← (incoming)';
  }

  // "CASH DEPOSIT-CASH DEPOSIT SELF--"
  if (/CASH DEPOSIT/i.test(d)) return 'Cash Deposit';

  // "BY TRANSFER-UPI/..." generic
  if (/^BY TRANSFER/i.test(d)) return 'Transfer ← (incoming)';

  // IDBI patterns
  if (/^NEFT-SBIN.*SRI VANI STORES/i.test(d)) return 'NEFT ← Own (SBI→IDBI)';
  if (/^NEFT-AX.*GOOGLE.*DIGITAL/i.test(d))   return 'NEFT ← Google Pay';
  if (/^UPI\//i.test(d)) {
    const upi = d.match(/^UPI\/\d+\/(.+)$/i)?.[1]?.trim();
    return upi ? `UPI ${upi.startsWith('CRED') ? '→' : '←'} ${upi}` : 'UPI transfer';
  }
  if (/TRV_CHARGE/i.test(d))  return 'Bank Charge';
  if (/CRED.*CLUB/i.test(d))  return 'Credit Card Payment';

  // Fallback: just clean up the raw string
  return d.replace(/^(TO|BY) TRANSFER-/i, '').replace(/\*+/g, ' ').replace(/-{2,}/g, ' ').trim().slice(0, 60);
}
