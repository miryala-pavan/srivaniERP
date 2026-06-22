/**
 * Minimum margin of selling price over cost (tax-inclusive).
 * Below this threshold a visual warning is shown, but the sale is NOT blocked.
 */
export const MIN_MARGIN_PCT = 4;

/**
 * Returns the minimum selling price (GST-inclusive) that achieves MIN_MARGIN_PCT.
 * Rounded to 2 decimals.
 */
export function minSellingPrice(costExclTax: number, gstRate: number, cessRate: number): number {
  const costInclTax = costExclTax * (1 + (gstRate + cessRate) / 100);
  return Math.round(costInclTax * (1 + MIN_MARGIN_PCT / 100) * 100) / 100;
}

/**
 * Checks whether the selling price meets the minimum margin.
 * Returns a human-readable warning string if below, null if OK.
 * Never throws — use this wherever you want a soft warning instead of a block.
 */
export function checkMargin(params: {
  sellingPrice: number;
  costPrice?: number | null;
  gstRate?: number | null;
  cessRate?: number | null;
  label?: string;
  bypass?: boolean;
}): string | null {
  if (params.bypass) return null;
  const cost = Number(params.costPrice ?? 0);
  if (cost <= 0) return null;
  const sp   = Number(params.sellingPrice ?? 0);
  const gst  = Number(params.gstRate ?? 0);
  const cess = Number(params.cessRate ?? 0);
  const minSp = minSellingPrice(cost, gst, cess);
  if (sp < minSp - 0.001) {
    const name = params.label ? ` for "${params.label}"` : '';
    return (
      `Low margin${name}: selling ₹${sp.toFixed(2)} — ` +
      `minimum for ${MIN_MARGIN_PCT}% margin is ₹${minSp.toFixed(2)} ` +
      `(cost ₹${cost.toFixed(2)} + ${gst + cess}% tax).`
    );
  }
  return null;
}

/**
 * @deprecated Constraint removed — below-margin sales are now allowed.
 * Call checkMargin() instead to get a non-blocking warning string.
 */
export function assertMargin(_params: Parameters<typeof checkMargin>[0]): void {
  // No longer throws. Left in place so existing call-sites compile without changes.
}
