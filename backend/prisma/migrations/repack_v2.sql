-- ─── Repack v2 migration ─────────────────────────────────────────────────────
-- Columns use camelCase (Prisma default — no individual @map on fields)

-- 1. PluBundle: replace single-column unique with composite
--    so one bulk PLU can link to multiple singles (sugar 50kg → 1kg, 500g, 250g)
ALTER TABLE plu_bundle DROP CONSTRAINT IF EXISTS "plu_bundle_bulkPluId_key";
ALTER TABLE plu_bundle ADD CONSTRAINT plu_bundle_bulk_single_unique
  UNIQUE ("bulkPluId", "singlePluId");

-- 2. RepackSession: new columns
ALTER TABLE repack_session
  ADD COLUMN IF NOT EXISTS "bulkWeightG"       DECIMAL(10,3),
  ADD COLUMN IF NOT EXISTS "wastageUnits"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reversed            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reversedAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reversedById"      TEXT,
  ADD COLUMN IF NOT EXISTS "reversedByName"    TEXT,
  ADD COLUMN IF NOT EXISTS "reversedSessionId" TEXT;

-- 3. RepackSession: unique on (businessId, sessionNo) prevents race-condition duplicates
ALTER TABLE repack_session
  ADD CONSTRAINT repack_session_business_sessionno_unique
  UNIQUE ("businessId", "sessionNo");

SELECT 'repack_v2 migration complete' AS status;
