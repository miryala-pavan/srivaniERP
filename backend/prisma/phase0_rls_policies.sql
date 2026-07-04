-- ─── RLS Policies — Phase 0 Platform Tables ──────────────────────────────────
-- All tables already have RLS ENABLED from previous run.
-- This script creates the business-isolation policies.
-- app.business_id must be SET by the application at the start of each transaction.

-- PlatformAuditLog
DROP POLICY IF EXISTS "PlatformAuditLog_business_isolation" ON "PlatformAuditLog";
CREATE POLICY "PlatformAuditLog_business_isolation" ON "PlatformAuditLog"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- OutboxEvent
DROP POLICY IF EXISTS "OutboxEvent_business_isolation" ON "OutboxEvent";
CREATE POLICY "OutboxEvent_business_isolation" ON "OutboxEvent"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- InboxEvent
DROP POLICY IF EXISTS "InboxEvent_business_isolation" ON "InboxEvent";
CREATE POLICY "InboxEvent_business_isolation" ON "InboxEvent"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- Journal
DROP POLICY IF EXISTS "Journal_business_isolation" ON "Journal";
CREATE POLICY "Journal_business_isolation" ON "Journal"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- FiscalPeriod
DROP POLICY IF EXISTS "FiscalPeriod_business_isolation" ON "FiscalPeriod";
CREATE POLICY "FiscalPeriod_business_isolation" ON "FiscalPeriod"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- AccountGroup
DROP POLICY IF EXISTS "AccountGroup_business_isolation" ON "AccountGroup";
CREATE POLICY "AccountGroup_business_isolation" ON "AccountGroup"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- Account
DROP POLICY IF EXISTS "Account_business_isolation" ON "Account";
CREATE POLICY "Account_business_isolation" ON "Account"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- Document
DROP POLICY IF EXISTS "Document_business_isolation" ON "Document";
CREATE POLICY "Document_business_isolation" ON "Document"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- AiCallLog
DROP POLICY IF EXISTS "AiCallLog_business_isolation" ON "AiCallLog";
CREATE POLICY "AiCallLog_business_isolation" ON "AiCallLog"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- BusinessConfig
DROP POLICY IF EXISTS "BusinessConfig_business_isolation" ON "BusinessConfig";
CREATE POLICY "BusinessConfig_business_isolation" ON "BusinessConfig"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- NumberSeries
DROP POLICY IF EXISTS "NumberSeries_business_isolation" ON "NumberSeries";
CREATE POLICY "NumberSeries_business_isolation" ON "NumberSeries"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- ComputationJob
DROP POLICY IF EXISTS "ComputationJob_business_isolation" ON "ComputationJob";
CREATE POLICY "ComputationJob_business_isolation" ON "ComputationJob"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));

-- BusinessRuleOverride
DROP POLICY IF EXISTS "BusinessRuleOverride_business_isolation" ON "BusinessRuleOverride";
CREATE POLICY "BusinessRuleOverride_business_isolation" ON "BusinessRuleOverride"
  USING ("businessId" = current_setting('app.business_id', TRUE))
  WITH CHECK ("businessId" = current_setting('app.business_id', TRUE));
