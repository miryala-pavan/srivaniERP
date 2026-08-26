/**
 * ─── PLU "current batch" resolution ────────────────────────────────────────
 *
 * Single source of truth for "what is the current batch/price of this
 * product right now" — used by GRN's Product-cache sync, product search,
 * the storefront, and PO reorder suggestions, so none of them can disagree
 * about which ProductPlu is authoritative.
 *
 * `isDefault` is a MANUAL PIN only, set exclusively by an explicit staff
 * action (ProductsService.setDefaultPlu). Nothing else — least of all GRN —
 * should auto-set or auto-promote it. This function is what everything else
 * uses instead of trusting `isDefault: true` blindly.
 *
 * Priority:
 *   1. A manually-pinned PLU (isDefault: true) among active PLUs that still
 *      have stock.
 *   2. Else, if the product is expiry-tracked: the active in-stock PLU with
 *      the nearest (soonest) expiryDate — FEFO.
 *   3. Else, the active in-stock PLU with the most recent receivedDate.
 *   4. If nothing has stock at all, fall back to the most-recently-received
 *      active PLU regardless of stock (so there's still something to show),
 *      or null if the product has no PLUs at all.
 *
 * Pure and DB-agnostic on purpose: callers that already have a batch of
 * `ProductPlu` rows in hand (e.g. a storefront listing page rendering many
 * products at once) can call this directly with no extra queries, instead
 * of resolving one product at a time.
 */

export interface PluResolutionCandidate {
  stockOnHand: unknown;
  isDefault: boolean;
  expiryDate: Date | string | null;
  receivedDate: Date | string;
}

function toMillis(d: Date | string): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime();
}

export function pickCurrentPlu<T extends PluResolutionCandidate>(
  activePlus: T[],
  expiryTracking: boolean,
): T | null {
  if (activePlus.length === 0) return null;

  const inStock = activePlus.filter((p) => Number(p.stockOnHand) > 0);

  // 1. Manual pin — only honoured while it still has stock. A pinned batch
  // that's sold out falls through to the same rules as everything else.
  const pinned = inStock.find((p) => p.isDefault);
  if (pinned) return pinned;

  if (inStock.length > 0) {
    // Treat the product as expiry-tracked either via the explicit product
    // flag, or defensively, if any in-stock batch actually carries an
    // expiry date — matches the convention already used for FEFO/FIFO
    // stock deduction (see common/helpers/stock-lock.util.ts).
    const isExpiryTracked = expiryTracking || inStock.some((p) => p.expiryDate != null);

    if (isExpiryTracked) {
      const withExpiry = inStock.filter((p) => p.expiryDate != null);
      if (withExpiry.length > 0) {
        // 2. FEFO — nearest (soonest) expiry first.
        return withExpiry.reduce((soonest, cur) =>
          toMillis(cur.expiryDate as Date | string) < toMillis(soonest.expiryDate as Date | string) ? cur : soonest,
        );
      }
      // Expiry-tracked but no in-stock batch actually has an expiryDate set
      // — fall through to most-recently-received rather than return nothing.
    }

    // 3. Most recently received in-stock batch.
    return inStock.reduce((latest, cur) =>
      toMillis(cur.receivedDate) > toMillis(latest.receivedDate) ? cur : latest,
    );
  }

  // 4. Nothing in stock — still surface the most-recently-received PLU so
  // there's something to display (e.g. an "out of stock" card with its
  // last-known price), rather than nothing at all.
  return activePlus.reduce((latest, cur) =>
    toMillis(cur.receivedDate) > toMillis(latest.receivedDate) ? cur : latest,
  );
}
