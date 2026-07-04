-- ─── Journal Immutability Trigger ────────────────────────────────────────────
-- A POSTED journal is immutable. Corrections must be made via reversal journal.
-- This trigger enforces the rule at the database level (ADR-0014).

CREATE OR REPLACE FUNCTION prevent_posted_journal_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'POSTED' THEN
    RAISE EXCEPTION
      'Journal % is POSTED and immutable. Use a reversal journal to correct it.',
      OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_journal_immutability ON "Journal";
CREATE TRIGGER trg_journal_immutability
  BEFORE UPDATE OR DELETE ON "Journal"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_posted_journal_mutation();

-- ─── PlatformAuditLog Append-Only Trigger ────────────────────────────────────
-- Audit records are append-only. No updates or deletes ever.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'PlatformAuditLog is append-only. Mutations are not permitted.'
    USING ERRCODE = 'P0001';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutability ON "PlatformAuditLog";
CREATE TRIGGER trg_audit_log_immutability
  BEFORE UPDATE OR DELETE ON "PlatformAuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
