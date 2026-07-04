-- Phase 0 Platform Core tables
-- Safe to re-run: all use CREATE TABLE IF NOT EXISTS

-- P0.1 Tenant
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId" TEXT NOT NULL UNIQUE,
  "plan"       TEXT NOT NULL DEFAULT 'STARTER',
  "status"     TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Tenant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id")
);

-- P0.2 Platform Audit Log
CREATE TABLE IF NOT EXISTS "PlatformAuditLog" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"    TEXT NOT NULL,
  "userId"        TEXT,
  "action"        TEXT NOT NULL,
  "tableName"     TEXT NOT NULL,
  "recordId"      TEXT NOT NULL,
  "before"        JSONB,
  "after"         JSONB,
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  "correlationId" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_businessId_idx" ON "PlatformAuditLog"("businessId");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_businessId_createdAt_idx" ON "PlatformAuditLog"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_tableName_recordId_idx" ON "PlatformAuditLog"("tableName", "recordId");

-- P0.3 Outbox Event
CREATE TABLE IF NOT EXISTS "OutboxEvent" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"    TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId"   TEXT NOT NULL,
  "eventType"     TEXT NOT NULL,
  "payload"       JSONB NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "correlationId" TEXT,
  "causationId"   TEXT,
  "publishedAt"   TIMESTAMPTZ,
  "retryCount"    INT NOT NULL DEFAULT 0,
  "error"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OutboxEvent_businessId_idx" ON "OutboxEvent"("businessId");
CREATE INDEX IF NOT EXISTS "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- P0.3 Inbox Event
CREATE TABLE IF NOT EXISTS "InboxEvent" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"  TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "eventType"   TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'RECEIVED',
  "processedAt" TIMESTAMPTZ,
  "error"       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "InboxEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InboxEvent_businessId_eventId_key" UNIQUE ("businessId", "eventId")
);
CREATE INDEX IF NOT EXISTS "InboxEvent_businessId_idx" ON "InboxEvent"("businessId");

-- P0.4 Rule Authority
CREATE TABLE IF NOT EXISTS "RuleAuthority" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "code"         TEXT NOT NULL UNIQUE,
  "name"         TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL DEFAULT 'IN',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "RuleAuthority_pkey" PRIMARY KEY ("id")
);

-- P0.4 Rule Set
CREATE TABLE IF NOT EXISTS "RuleSet" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "authorityId"   TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "category"      TEXT NOT NULL,
  "version"       TEXT NOT NULL DEFAULT '1',
  "effectiveFrom" TIMESTAMPTZ NOT NULL,
  "effectiveTo"   TIMESTAMPTZ,
  "sourceSection" TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RuleSet_code_effectiveFrom_key" UNIQUE ("code", "effectiveFrom"),
  CONSTRAINT "RuleSet_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "RuleAuthority"("id")
);
CREATE INDEX IF NOT EXISTS "RuleSet_code_idx" ON "RuleSet"("code");

-- P0.4 Rule
CREATE TABLE IF NOT EXISTS "Rule" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "ruleSetId" TEXT NOT NULL,
  "priority"  INT NOT NULL,
  "condition" JSONB NOT NULL,
  "effect"    JSONB NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Rule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Rule_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id")
);
CREATE INDEX IF NOT EXISTS "Rule_ruleSetId_priority_idx" ON "Rule"("ruleSetId", "priority");

-- P0.4 Business Rule Override
CREATE TABLE IF NOT EXISTS "BusinessRuleOverride" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"    TEXT NOT NULL,
  "ruleSetCode"   TEXT NOT NULL,
  "ruleSetId"     TEXT NOT NULL,
  "effect"        JSONB NOT NULL,
  "reason"        TEXT NOT NULL,
  "approvedBy"    TEXT,
  "effectiveFrom" TIMESTAMPTZ NOT NULL,
  "effectiveTo"   TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "BusinessRuleOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessRuleOverride_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id")
);
CREATE INDEX IF NOT EXISTS "BusinessRuleOverride_businessId_ruleSetCode_idx" ON "BusinessRuleOverride"("businessId", "ruleSetCode");

-- P0.5 Document
CREATE TABLE IF NOT EXISTS "Document" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"       TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "filename"         TEXT NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "sizeBytes"        INT NOT NULL,
  "storageKey"       TEXT NOT NULL,
  "sha256Hash"       TEXT NOT NULL,
  "category"         TEXT,
  "linkedTable"      TEXT,
  "linkedRecordId"   TEXT,
  "deletedAt"        TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Document_businessId_idx" ON "Document"("businessId");
CREATE INDEX IF NOT EXISTS "Document_linkedTable_linkedRecordId_idx" ON "Document"("linkedTable", "linkedRecordId");
CREATE INDEX IF NOT EXISTS "Document_sha256Hash_idx" ON "Document"("sha256Hash");

-- P0.7 AI Call Log
CREATE TABLE IF NOT EXISTS "AiCallLog" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId" TEXT NOT NULL,
  "provider"   TEXT NOT NULL,
  "model"      TEXT NOT NULL,
  "promptHash" TEXT NOT NULL,
  "tokensUsed" INT NOT NULL,
  "latencyMs"  INT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "success"    BOOLEAN NOT NULL,
  "error"      TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiCallLog_businessId_idx" ON "AiCallLog"("businessId");
CREATE INDEX IF NOT EXISTS "AiCallLog_businessId_createdAt_idx" ON "AiCallLog"("businessId", "createdAt");

-- P0.7 AI Correction
CREATE TABLE IF NOT EXISTS "AiCorrection" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"     TEXT NOT NULL,
  "aiCallLogId"    TEXT,
  "field"          TEXT NOT NULL,
  "originalValue"  TEXT NOT NULL,
  "correctedValue" TEXT NOT NULL,
  "correctedBy"    TEXT,
  "reason"         TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AiCorrection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiCorrection_businessId_idx" ON "AiCorrection"("businessId");

-- P0.7 Knowledge Chunk
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId" TEXT,
  "source"     TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "tags"       TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_businessId_idx" ON "KnowledgeChunk"("businessId");

-- P0.8 Account Group
CREATE TABLE IF NOT EXISTS "AccountGroup" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "parentId"   TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AccountGroup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AccountGroup"("id")
);
CREATE INDEX IF NOT EXISTS "AccountGroup_businessId_idx" ON "AccountGroup"("businessId");

-- P0.8 Account
CREATE TABLE IF NOT EXISTS "Account" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"     TEXT NOT NULL,
  "accountGroupId" TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'INR',
  "isControl"      BOOLEAN NOT NULL DEFAULT FALSE,
  "description"    TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_businessId_code_key" UNIQUE ("businessId", "code"),
  CONSTRAINT "Account_accountGroupId_fkey" FOREIGN KEY ("accountGroupId") REFERENCES "AccountGroup"("id")
);
CREATE INDEX IF NOT EXISTS "Account_businessId_idx" ON "Account"("businessId");

-- P0.8 Fiscal Period
CREATE TABLE IF NOT EXISTS "FiscalPeriod" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "startDate"  TIMESTAMPTZ NOT NULL,
  "endDate"    TIMESTAMPTZ NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FiscalPeriod_businessId_idx" ON "FiscalPeriod"("businessId");

-- P0.8 Journal
CREATE TABLE IF NOT EXISTS "Journal" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"      TEXT NOT NULL,
  "fiscalPeriodId"  TEXT NOT NULL,
  "reference"       TEXT,
  "narration"       TEXT NOT NULL,
  "totalDebit"      DECIMAL(19,4) NOT NULL,
  "totalCredit"     DECIMAL(19,4) NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'DRAFT',
  "postedAt"        TIMESTAMPTZ,
  "reversedBy"      TEXT,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Journal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Journal_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id")
);
CREATE INDEX IF NOT EXISTS "Journal_businessId_idx" ON "Journal"("businessId");
CREATE INDEX IF NOT EXISTS "Journal_businessId_fiscalPeriodId_idx" ON "Journal"("businessId", "fiscalPeriodId");

-- P0.8 Journal Line
CREATE TABLE IF NOT EXISTS "JournalLine" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "journalId"    TEXT NOT NULL,
  "accountId"    TEXT NOT NULL,
  "debitAmount"  DECIMAL(19,4) NOT NULL DEFAULT 0,
  "creditAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "narration"    TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "JournalLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id"),
  CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id")
);
CREATE INDEX IF NOT EXISTS "JournalLine_journalId_idx" ON "JournalLine"("journalId");
CREATE INDEX IF NOT EXISTS "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- P0.9 Number Series
CREATE TABLE IF NOT EXISTS "NumberSeries" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"   TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "prefix"       TEXT NOT NULL,
  "padLength"    INT NOT NULL DEFAULT 6,
  "currentValue" INT NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "NumberSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NumberSeries_businessId_code_key" UNIQUE ("businessId", "code")
);
CREATE INDEX IF NOT EXISTS "NumberSeries_businessId_idx" ON "NumberSeries"("businessId");

-- P0.10 Business Config
CREATE TABLE IF NOT EXISTS "BusinessConfig" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId" TEXT NOT NULL,
  "key"        TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "BusinessConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessConfig_businessId_key_key" UNIQUE ("businessId", "key")
);
CREATE INDEX IF NOT EXISTS "BusinessConfig_businessId_idx" ON "BusinessConfig"("businessId");

-- P0.11 Computation Job
CREATE TABLE IF NOT EXISTS "ComputationJob" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"        TEXT NOT NULL,
  "jobType"           TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'RUNNING',
  "triggeredByUserId" TEXT,
  "inputSummary"      JSONB NOT NULL DEFAULT '{}',
  "outputSummary"     JSONB,
  "error"             TEXT,
  "startedAt"         TIMESTAMPTZ NOT NULL,
  "completedAt"       TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ComputationJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ComputationJob_businessId_idx" ON "ComputationJob"("businessId");
CREATE INDEX IF NOT EXISTS "ComputationJob_businessId_jobType_idx" ON "ComputationJob"("businessId", "jobType");
