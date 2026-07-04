-- Phase 1: PLU Price History audit trail
-- Run: cat /tmp/phase1_plu_price_history.sql | docker exec -i srivani-db psql -U srivani -d srivani_db

CREATE TABLE IF NOT EXISTS plu_price_history (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"     TEXT        NOT NULL,
  "productPluId"   TEXT        NOT NULL REFERENCES product_plu(id),
  "productId"      TEXT        NOT NULL,
  "changeSource"   TEXT        NOT NULL,
  "grnId"          TEXT,
  "changedBy"      TEXT,
  "effectiveDate"  TIMESTAMPTZ NOT NULL,
  "recordedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Before
  "costPriceBefore"    DECIMAL(15,2),
  "basicCostBefore"    DECIMAL(15,2),
  "mrpBefore"          DECIMAL(15,2),
  "sellingPriceBefore" DECIMAL(15,2),
  "gstRateBefore"      DECIMAL(5,2),
  "hsnCodeBefore"      TEXT,
  "isDefaultBefore"    BOOLEAN,
  "isActiveBefore"     BOOLEAN,

  -- After
  "costPriceAfter"    DECIMAL(15,2),
  "basicCostAfter"    DECIMAL(15,2),
  "mrpAfter"          DECIMAL(15,2),
  "sellingPriceAfter" DECIMAL(15,2),
  "gstRateAfter"      DECIMAL(5,2),
  "hsnCodeAfter"      TEXT,
  "isDefaultAfter"    BOOLEAN,
  "isActiveAfter"     BOOLEAN,

  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_plu_price_history_plu
  ON plu_price_history("productPluId", "recordedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_plu_price_history_product
  ON plu_price_history("productId", "recordedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_plu_price_history_business
  ON plu_price_history("businessId", "effectiveDate" DESC);

CREATE INDEX IF NOT EXISTS idx_plu_price_history_grn
  ON plu_price_history("grnId")
  WHERE "grnId" IS NOT NULL;
