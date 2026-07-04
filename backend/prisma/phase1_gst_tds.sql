-- ─── Phase 1: GST Module Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GstReturn" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"      TEXT NOT NULL,
  "returnType"      TEXT NOT NULL,         -- GSTR1 | GSTR3B | GSTR2A | GSTR9
  "financialYear"   TEXT NOT NULL,         -- e.g. "2025-26"
  "taxPeriod"       TEXT NOT NULL,         -- e.g. "2025-07" (YYYY-MM) or "Q1-2025-26"
  "status"          TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT | COMPUTED | FILED | ACCEPTED
  -- GSTR-1 summary
  "b2bTaxable"      DECIMAL(19,4) NOT NULL DEFAULT 0,
  "b2bTax"          DECIMAL(19,4) NOT NULL DEFAULT 0,
  "b2cTaxable"      DECIMAL(19,4) NOT NULL DEFAULT 0,
  "b2cTax"          DECIMAL(19,4) NOT NULL DEFAULT 0,
  "exportTaxable"   DECIMAL(19,4) NOT NULL DEFAULT 0,
  "nilExempt"       DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- GSTR-3B summary
  "totalLiability"  DECIMAL(19,4) NOT NULL DEFAULT 0,
  "itcCgst"         DECIMAL(19,4) NOT NULL DEFAULT 0,
  "itcSgst"         DECIMAL(19,4) NOT NULL DEFAULT 0,
  "itcIgst"         DECIMAL(19,4) NOT NULL DEFAULT 0,
  "netPayableCgst"  DECIMAL(19,4) NOT NULL DEFAULT 0,
  "netPayableSgst"  DECIMAL(19,4) NOT NULL DEFAULT 0,
  "netPayableIgst"  DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- Feature-ready (for future GSTN API integration)
  "arn"             TEXT,       -- Acknowledgment Reference Number after filing
  "evcOtp"          TEXT,       -- EVC OTP method (stub)
  "apiFilingStatus" TEXT,       -- GSTN API response status (stub)
  "computationJobId" TEXT,      -- links to ComputationJob
  "filedAt"         TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "GstReturn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GstReturn_businessId_returnType_taxPeriod_key"
    UNIQUE ("businessId", "returnType", "taxPeriod")
);
CREATE INDEX IF NOT EXISTS "GstReturn_businessId_idx" ON "GstReturn"("businessId");
CREATE INDEX IF NOT EXISTS "GstReturn_businessId_taxPeriod_idx" ON "GstReturn"("businessId", "taxPeriod");

-- ITC Ledger: tracks Input Tax Credit balance per tax head
CREATE TABLE IF NOT EXISTS "ItcLedger" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"      TEXT NOT NULL,
  "taxPeriod"       TEXT NOT NULL,   -- YYYY-MM
  "sourceType"      TEXT NOT NULL,   -- PURCHASE_INVOICE | DEBIT_NOTE | ITC_CLAIM
  "sourceId"        TEXT NOT NULL,
  "cgst"            DECIMAL(19,4) NOT NULL DEFAULT 0,
  "sgst"            DECIMAL(19,4) NOT NULL DEFAULT 0,
  "igst"            DECIMAL(19,4) NOT NULL DEFAULT 0,
  "isReversed"      BOOLEAN NOT NULL DEFAULT FALSE,
  "reversalReason"  TEXT,
  -- Feature-ready: ITC category types for reversals
  "itcCategoryType" TEXT,            -- ITC-1 | ITC-2 | ITC-3 (future reversals)
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ItcLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ItcLedger_businessId_taxPeriod_idx" ON "ItcLedger"("businessId", "taxPeriod");
CREATE INDEX IF NOT EXISTS "ItcLedger_sourceId_idx" ON "ItcLedger"("sourceId");

-- GST Challan: tracks payments to government
CREATE TABLE IF NOT EXISTS "GstChallan" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"      TEXT NOT NULL,
  "taxPeriod"       TEXT NOT NULL,
  "cgstPaid"        DECIMAL(19,4) NOT NULL DEFAULT 0,
  "sgstPaid"        DECIMAL(19,4) NOT NULL DEFAULT 0,
  "igstPaid"        DECIMAL(19,4) NOT NULL DEFAULT 0,
  "interest"        DECIMAL(19,4) NOT NULL DEFAULT 0,
  "lateFee"         DECIMAL(19,4) NOT NULL DEFAULT 0,
  "totalPaid"       DECIMAL(19,4) NOT NULL DEFAULT 0,
  "cpin"            TEXT,            -- Challan payment identification number
  "bsrCode"         TEXT,
  "paidAt"          TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "GstChallan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GstChallan_businessId_taxPeriod_idx" ON "GstChallan"("businessId", "taxPeriod");

-- ─── Phase 1: TDS New Service Tables ─────────────────────────────────────────

-- TDS Challan: links deposited TDS to government challan
CREATE TABLE IF NOT EXISTS "TdsChallan" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"      TEXT NOT NULL,
  "financialYear"   TEXT NOT NULL,
  "quarter"         TEXT NOT NULL,   -- Q1 | Q2 | Q3 | Q4
  "section"         TEXT NOT NULL,
  "amountDeducted"  DECIMAL(19,4) NOT NULL DEFAULT 0,
  "amountDeposited" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "interest"        DECIMAL(19,4) NOT NULL DEFAULT 0,
  "lateFee"         DECIMAL(19,4) NOT NULL DEFAULT 0,
  "bsrCode"         TEXT,
  "challanSerial"   TEXT,
  "depositedAt"     TIMESTAMPTZ,
  -- Feature-ready: TRACES 2.0
  "ackNumber"       TEXT,            -- TRACES acknowledgment (stub)
  "filingMode"      TEXT DEFAULT 'OFFLINE',   -- OFFLINE | TRACES_API
  "provisionalReceipt" TEXT,         -- NSDL provisional receipt (stub)
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TdsChallan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TdsChallan_businessId_financialYear_idx" ON "TdsChallan"("businessId", "financialYear");
CREATE INDEX IF NOT EXISTS "TdsChallan_businessId_section_idx" ON "TdsChallan"("businessId", "section");

-- Enable RLS on new tables
ALTER TABLE "GstReturn"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GstReturn"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "ItcLedger"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItcLedger"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "GstChallan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GstChallan" FORCE  ROW LEVEL SECURITY;
ALTER TABLE "TdsChallan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TdsChallan" FORCE  ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "GstReturn_business_isolation"  ON "GstReturn";
CREATE POLICY "GstReturn_business_isolation"  ON "GstReturn"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

DROP POLICY IF EXISTS "ItcLedger_business_isolation"  ON "ItcLedger";
CREATE POLICY "ItcLedger_business_isolation"  ON "ItcLedger"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

DROP POLICY IF EXISTS "GstChallan_business_isolation" ON "GstChallan";
CREATE POLICY "GstChallan_business_isolation" ON "GstChallan"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

DROP POLICY IF EXISTS "TdsChallan_business_isolation" ON "TdsChallan";
CREATE POLICY "TdsChallan_business_isolation" ON "TdsChallan"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- Grant to app role
GRANT SELECT, INSERT, UPDATE, DELETE ON "GstReturn"  TO srivani_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ItcLedger"  TO srivani_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "GstChallan" TO srivani_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "TdsChallan" TO srivani_app;
