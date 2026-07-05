-- Phase 2: Scheduled report delivery (WhatsApp / email)
-- Run: cat /tmp/phase2_scheduled_reports.sql | docker exec -i srivani-db psql -U srivani -d srivani_db

CREATE TABLE IF NOT EXISTS scheduled_report (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"  TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  "reportType"  TEXT        NOT NULL,
  frequency     TEXT        NOT NULL,
  "sendAt"      TEXT        NOT NULL,
  weekday       INTEGER,
  "dayOfMonth"  INTEGER,
  channel       TEXT        NOT NULL,
  recipient     TEXT        NOT NULL,
  "isActive"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "lastRunAt"   TIMESTAMPTZ,
  "lastStatus"  TEXT,
  "lastError"   TEXT,
  "createdBy"   TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "scheduled_report_businessId_idx" ON scheduled_report("businessId");
CREATE INDEX IF NOT EXISTS "scheduled_report_isActive_idx"   ON scheduled_report("isActive");
