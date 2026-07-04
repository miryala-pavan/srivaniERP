-- ─── Row Level Security (RLS) — Phase 0 Platform Tables ─────────────────────
-- Pattern: every session sets app.business_id before querying.
-- The policy returns rows only where businessId = current_setting('app.business_id').
-- Application code is responsible for calling SET LOCAL app.business_id = '...'
-- at the start of every transaction (via PrismaService middleware in Phase 3).
--
-- Phase 0: we DEFINE the policies and test them. We do NOT enforce them yet on
-- existing tables (that happens in Phase 3 when PrismaService middleware is wired).
-- New Platform tables are enabled here so all new code is RLS-ready from day one.

-- ── helper: safely enable RLS without throwing if already enabled ─────────────
CREATE OR REPLACE FUNCTION enable_rls_if_not(table_name TEXT) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
EXCEPTION WHEN others THEN
  -- Table may already have RLS; ignore
  RAISE NOTICE 'RLS already configured on %', table_name;
END;
$$ LANGUAGE plpgsql;

-- ── macro: create the standard businessId policy for a table ─────────────────
CREATE OR REPLACE FUNCTION create_business_rls_policy(table_name TEXT, col TEXT DEFAULT 'businessId') RETURNS VOID AS $$
DECLARE
  policy_name TEXT := table_name || '_business_isolation';
BEGIN
  -- Drop existing policy first (idempotent)
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);

  EXECUTE format($$
    CREATE POLICY %I ON %I
      USING (%I = current_setting('app.business_id', TRUE))
      WITH CHECK (%I = current_setting('app.business_id', TRUE))
  $$, policy_name, table_name, col, col);

  RAISE NOTICE 'RLS policy created: %', policy_name;
END;
$$ LANGUAGE plpgsql;

-- ── Apply RLS to all Phase 0 businessId-scoped tables ────────────────────────

-- PlatformAuditLog
SELECT enable_rls_if_not('"PlatformAuditLog"');
SELECT create_business_rls_policy('"PlatformAuditLog"', '"businessId"');

-- OutboxEvent
SELECT enable_rls_if_not('"OutboxEvent"');
SELECT create_business_rls_policy('"OutboxEvent"', '"businessId"');

-- InboxEvent
SELECT enable_rls_if_not('"InboxEvent"');
SELECT create_business_rls_policy('"InboxEvent"', '"businessId"');

-- Journal
SELECT enable_rls_if_not('"Journal"');
SELECT create_business_rls_policy('"Journal"', '"businessId"');

-- FiscalPeriod
SELECT enable_rls_if_not('"FiscalPeriod"');
SELECT create_business_rls_policy('"FiscalPeriod"', '"businessId"');

-- AccountGroup
SELECT enable_rls_if_not('"AccountGroup"');
SELECT create_business_rls_policy('"AccountGroup"', '"businessId"');

-- Account
SELECT enable_rls_if_not('"Account"');
SELECT create_business_rls_policy('"Account"', '"businessId"');

-- Document
SELECT enable_rls_if_not('"Document"');
SELECT create_business_rls_policy('"Document"', '"businessId"');

-- AiCallLog
SELECT enable_rls_if_not('"AiCallLog"');
SELECT create_business_rls_policy('"AiCallLog"', '"businessId"');

-- BusinessConfig
SELECT enable_rls_if_not('"BusinessConfig"');
SELECT create_business_rls_policy('"BusinessConfig"', '"businessId"');

-- NumberSeries
SELECT enable_rls_if_not('"NumberSeries"');
SELECT create_business_rls_policy('"NumberSeries"', '"businessId"');

-- ComputationJob
SELECT enable_rls_if_not('"ComputationJob"');
SELECT create_business_rls_policy('"ComputationJob"', '"businessId"');

-- BusinessRuleOverride
SELECT enable_rls_if_not('"BusinessRuleOverride"');
SELECT create_business_rls_policy('"BusinessRuleOverride"', '"businessId"');
