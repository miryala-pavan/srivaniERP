import { BadRequestException } from '@nestjs/common';

/**
 * Validates Indian GSTIN format: 2-digit state code + 10-char PAN + entity
 * number + 'Z' + check digit. Mirrors GstService.validateGstin — kept as a
 * standalone, dependency-free function (matching validateHsn's pattern in
 * pos.service.ts) so callers that shouldn't need a GstService dependency
 * just for format validation don't have to take one on.
 */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_PATTERN.test(gstin.toUpperCase());
}

/**
 * Returns the 2-digit state code from a GSTIN if it's well-formed, else
 * throws. Use this instead of a raw `.substring(0, 2)` anywhere a GSTIN's
 * state code feeds into an interstate/intrastate GST determination — an
 * unvalidated substring silently produces a wrong tax head on a malformed
 * or mistyped GSTIN.
 */
export function gstinStateCode(gstin: string, context: string): string {
  if (!isValidGstinFormat(gstin)) {
    throw new BadRequestException(
      `${context} has an invalid GSTIN ("${gstin}") — fix it before recording a GST transaction against it, since it determines whether CGST+SGST or IGST applies.`,
    );
  }
  return gstin.substring(0, 2);
}
