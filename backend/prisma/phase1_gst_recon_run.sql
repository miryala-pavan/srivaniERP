-- GstReconRun: persists GSTR-2B reconciliation results so they can be
-- accessed from any device without re-uploading the file.

CREATE TABLE IF NOT EXISTS "GstReconRun" (
  "id"          TEXT        NOT NULL,
  "businessId"  TEXT        NOT NULL,
  "uploadedBy"  TEXT,
  "fileName"    TEXT        NOT NULL,
  "period"      TEXT        NOT NULL,
  "runAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "window"      JSONB       NOT NULL DEFAULT '{}',
  "summary"     JSONB       NOT NULL DEFAULT '{}',
  "matched"     JSONB       NOT NULL DEFAULT '[]',
  "mismatch"    JSONB       NOT NULL DEFAULT '[]',
  "onlyIn2B"    JSONB       NOT NULL DEFAULT '[]',
  "onlyInBooks" JSONB       NOT NULL DEFAULT '[]',

  CONSTRAINT "GstReconRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GstReconRun_businessId_runAt_idx"
  ON "GstReconRun"("businessId", "runAt" DESC);
