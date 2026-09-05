-- Adds settlement tracking to purchase_debit_note (purchase/damage/shortage
-- returns to a supplier): how the claim gets settled (balance adjustment,
-- replacement stock, or a cash/bank refund) and whether it's still pending.
ALTER TABLE "purchase_debit_note"
  ADD COLUMN "settlementType"   TEXT NOT NULL DEFAULT 'ADJUST_BALANCE',
  ADD COLUMN "settlementStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "settledAt"        TIMESTAMP(3),
  ADD COLUMN "replacementGrnId" TEXT,
  ADD COLUMN "refundReference"  TEXT;

CREATE INDEX "purchase_debit_note_businessId_settlementStatus_idx"
  ON "purchase_debit_note" ("businessId", "settlementStatus");

-- Backfill existing rows: every debit note issued before this feature
-- existed only ever settled via balance adjustment, and that happens
-- instantly at creation — so mark them settled retroactively.
UPDATE "purchase_debit_note"
  SET "settlementStatus" = 'SETTLED', "settledAt" = "createdAt"
  WHERE "settlementStatus" = 'PENDING';
