-- Create a non-superuser application role for RLS to enforce properly.
-- The application should connect as srivani_app (not srivani superuser).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'srivani_app') THEN
    CREATE ROLE srivani_app LOGIN PASSWORD 'SrivaniApp2026';
  END IF;
END;
$$;

-- Grant access to all current and future tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO srivani_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO srivani_app;
ALTER DEFAULT PRIVILEGES FOR ROLE srivani IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO srivani_app;
ALTER DEFAULT PRIVILEGES FOR ROLE srivani IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO srivani_app;
