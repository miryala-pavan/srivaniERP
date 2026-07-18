-- history_migration.sql
-- Adds customer history fields and CustomerListEntry table
-- Run ONCE on prod: cat history_migration.sql | docker exec -i srivani-db psql -U srivani -d srivani_db

BEGIN;

-- 1. New columns on Customer
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "historyToken" TEXT,
  ADD COLUMN IF NOT EXISTS "historySentAt" TIMESTAMP(3);

-- Unique constraint (only if not already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_historyToken_key'
  ) THEN
    ALTER TABLE "Customer" ADD CONSTRAINT "Customer_historyToken_key" UNIQUE ("historyToken");
  END IF;
END $$;

-- 2. CustomerListEntry table
CREATE TABLE IF NOT EXISTS "customer_list_entry" (
  "id"         TEXT        NOT NULL,
  "businessId" TEXT        NOT NULL,
  "customerId" TEXT        NOT NULL,
  "entryDate"  TIMESTAMP(3) NOT NULL,
  "imageUrls"  TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pageCount"  INTEGER     NOT NULL DEFAULT 1,
  "source"     TEXT        NOT NULL DEFAULT 'MANUAL',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_list_entry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customer_list_entry"
  ADD CONSTRAINT "customer_list_entry_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "customer_list_entry_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "customer_list_entry_customerId_idx"
  ON "customer_list_entry"("customerId");
CREATE INDEX IF NOT EXISTS "customer_list_entry_businessId_idx"
  ON "customer_list_entry"("businessId");
CREATE INDEX IF NOT EXISTS "customer_list_entry_customerId_entryDate_idx"
  ON "customer_list_entry"("customerId", "entryDate");

COMMIT;
