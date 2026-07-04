-- Manual migration: P0 Gap Fill
-- Adds PlanStatus enum, expands tenant with subscription + feature-ready columns,
-- creates UserBusinessMembership table.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- 1. PlanStatus enum (using text column approach compatible with existing schema)
-- Note: tenant table uses lowercase column names in this DB

ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS "planstatus"        TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "planstartedat"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "planexpiresat"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "trialendsat"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "legalentitytype"   TEXT,
  ADD COLUMN IF NOT EXISTS "industrycode"      TEXT,
  ADD COLUMN IF NOT EXISTS "employeecount"     INTEGER,
  ADD COLUMN IF NOT EXISTS "annualrevenueband" TEXT,
  ADD COLUMN IF NOT EXISTS "parenttenantid"    TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingstatus"  TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "healthscore"       DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "featureflags"      JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "integrations"      JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "aiconfig"          JSONB NOT NULL DEFAULT '{}';

-- Add check constraint for planstatus valid values
DO $$ BEGIN
  ALTER TABLE tenant ADD CONSTRAINT tenant_planstatus_check
    CHECK ("planstatus" IN ('TRIAL','ACTIVE','EXPIRED','SUSPENDED','CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. UserBusinessMembership table
CREATE TABLE IF NOT EXISTS "UserBusinessMembership" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "userId"     TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "role"       TEXT NOT NULL,
  "scopes"     TEXT[] NOT NULL DEFAULT '{}',
  "branchId"   TEXT,
  "status"     TEXT NOT NULL DEFAULT 'ACTIVE',
  "invitedBy"  TEXT,
  "joinedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt"  TIMESTAMPTZ,
  CONSTRAINT "UserBusinessMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserBusinessMembership_userId_businessId_key" UNIQUE ("userId", "businessId")
);

CREATE INDEX IF NOT EXISTS "UserBusinessMembership_businessId_idx"
  ON "UserBusinessMembership" ("businessId");

CREATE INDEX IF NOT EXISTS "UserBusinessMembership_tenantId_idx"
  ON "UserBusinessMembership" ("tenantId");
