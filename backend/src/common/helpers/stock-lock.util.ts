import { Prisma } from '@prisma/client';

/**
 * Fetches active PLUs for a product in FEFO/FIFO order, row-locked
 * (SELECT ... FOR UPDATE) for the remainder of the caller's transaction.
 *
 * Every FEFO stock-decrement loop in this codebase used to read stock via a
 * plain `findMany`, decide how much to take from each PLU in application
 * code, then write the decrement — a read-then-write window a concurrent
 * transaction could interleave into, oversell-ing the same batch. Locking
 * the candidate rows here (they stay locked until the caller's transaction
 * commits or rolls back) closes that window: a second concurrent call
 * blocks on this SELECT until the first transaction finishes, then re-reads
 * the now-current stock — the standard Postgres pattern for this class of
 * problem.
 *
 * Must be called with the same `tx` (transaction client) the caller will
 * use for the subsequent decrement writes — locking has no effect outside
 * an open transaction.
 */
export async function lockPluCandidatesForDeduction(
  tx: Prisma.TransactionClient,
  businessId: string,
  productId: string,
  expiryTracking: boolean,
): Promise<Array<{ id: string; stockOnHand: number }>> {
  const rows = expiryTracking
    ? await tx.$queryRaw<Array<{ id: string; stockOnHand: Prisma.Decimal }>>`
        SELECT id, "stockOnHand" FROM "product_plu"
        WHERE "productId" = ${productId} AND "businessId" = ${businessId}
          AND "isActive" = true AND "stockOnHand" > 0
        ORDER BY "expiryDate" ASC NULLS LAST, "createdAt" ASC
        FOR UPDATE
      `
    : await tx.$queryRaw<Array<{ id: string; stockOnHand: Prisma.Decimal }>>`
        SELECT id, "stockOnHand" FROM "product_plu"
        WHERE "productId" = ${productId} AND "businessId" = ${businessId}
          AND "isActive" = true AND "stockOnHand" > 0
        ORDER BY "createdAt" ASC
        FOR UPDATE
      `;
  return rows.map((r) => ({ id: r.id, stockOnHand: Number(r.stockOnHand) }));
}

/**
 * Row-locks (SELECT ... FOR UPDATE) a single PLU by id for the remainder of
 * the caller's transaction, ahead of a read-then-decrement. See
 * `lockPluCandidatesForDeduction` above for why this matters.
 */
export async function lockPluById(
  tx: Prisma.TransactionClient,
  pluId: string,
): Promise<{ id: string; stockOnHand: number } | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; stockOnHand: Prisma.Decimal }>>`
    SELECT id, "stockOnHand" FROM "product_plu" WHERE id = ${pluId} FOR UPDATE
  `;
  if (!rows.length) return null;
  return { id: rows[0].id, stockOnHand: Number(rows[0].stockOnHand) };
}
