import { BadRequestException } from '@nestjs/common';

/**
 * Minimum required margin of selling price over cost (tax-inclusive).
 * Selling price must be at least this % above cost-incl-tax.
 */
export const MIN_MARGIN_PCT = 4;

/**
 * Returns the minimum legal selling price (GST-inclusive) for a given
 * tax-exclusive cost, applying GST + CESS then the 5% margin.
 * Rounded to 2 decimals.
 */
export function minSellingPrice(costExclTax: number, gstRate: number, cessRate: number): number {
  const costInclTax = costExclTax * (1 + (gstRate + cessRate) / 100);
  return Math.round(costInclTax * (1 + MIN_MARGIN_PCT / 100) * 100) / 100;
}

/**
 * Throws BadRequestException if sellingPrice is below the 5% margin floor.
 * No-op when cost is missing/zero (cannot compute a meaningful floor).
 * sellingPrice is treated as GST-inclusive; cost as GST-exclusive.
 */
export function assertMargin(params: {
  sellingPrice: number;
  costPrice?: number | null;
  gstRate?: number | null;
  cessRate?: number | null;
  label?: string;
  bypass?: boolean;
}): void {
  if (params.bypass) return; // product explicitly flagged to allow below-margin pricing
  const cost = Number(params.costPrice ?? 0);
  if (cost <= 0) return; // no real cost on record → cannot enforce
  const sp   = Number(params.sellingPrice ?? 0);
  const gst  = Number(params.gstRate ?? 0);
  const cess = Number(params.cessRate ?? 0);
  const minSp = minSellingPrice(cost, gst, cess);
  if (sp < minSp - 0.001) {
    const name = params.label ? ` for "${params.label}"` : '';
    throw new BadRequestException(
      `Selling price ₹${sp.toFixed(2)}${name} is below the minimum ${MIN_MARGIN_PCT}% margin. ` +
      `Minimum allowed: ₹${minSp.toFixed(2)} ` +
      `(cost ₹${cost.toFixed(2)} + ${gst + cess}% tax + ${MIN_MARGIN_PCT}% margin).`,
    );
  }
}
