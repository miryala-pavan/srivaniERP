# Row-Level Security (RLS) Enablement Runbook

**Status (July 2026): RLS is DISABLED on production.** Tenant isolation is enforced at the
application layer — every service filters by `businessId` in its WHERE clauses. This document
records why, and exactly what must happen before RLS can be switched on safely.

## Why RLS is currently off

The Phase 0/1 SQL scripts (`phase0_rls*.sql`, tail of `phase1_gst_tds.sql`) create policies of
the form:

```sql
CREATE POLICY "X_business_isolation" ON "X"
  USING ("businessId" = current_setting('app.business_id', TRUE))
```

and enable **FORCE ROW LEVEL SECURITY** (applies even to the table owner).

The backend **never sets `app.business_id`** on its connections — the only code that does is
the test file `backend/src/platform/tests/rls-isolation.test.ts`. With FORCE RLS on and the
setting absent, `current_setting(..., TRUE)` returns NULL, every policy evaluates false, and:

- every SELECT returns **0 rows**
- every INSERT fails its WITH CHECK

This was observed on 4 July 2026 when `phase1_gst_tds.sql` force-enabled RLS on the four new
GST/TDS tables mid-script; RLS was disabled on those tables immediately after
(`GstReturn`, `ItcLedger`, `GstChallan`, `TdsChallan` — policies remain in place, dormant).
The script also failed at `GRANT ... TO srivani_app` because that role did not exist on prod.

## What working RLS requires

1. **A dedicated app role** (`srivani_app`) that is *not* the table owner, with table grants.
   The backend's `DATABASE_URL` must connect as this role (owner bypasses non-FORCE RLS;
   with FORCE even owner is subject, but a separate role is cleaner and lets migrations keep
   running as the owner).

2. **Per-request tenant context.** Postgres settings are per-connection; Prisma pools
   connections, so the setting must be **transaction-scoped**:

   ```ts
   // Prisma client extension — wrap every query in a transaction that first runs:
   await tx.$executeRawUnsafe(
     `SELECT set_config('app.business_id', $1, true)`, businessId
   );
   ```

   The clean implementation is a Prisma `$extends` client extension combined with
   NestJS `AsyncLocalStorage` (populated from the JWT in a middleware/interceptor) so the
   `businessId` is available wherever a query fires. Every query path — including raw SQL in
   reports — must go through the extended client. This is an invasive change; budget a full
   session with regression testing on localhost first.

3. **Public/system paths audited.** Anything that runs without a JWT (public GST share links,
   the storefront API, outbox processor, scheduled reports runner) needs either an explicit
   system context (`app.business_id` set per business as it iterates) or policies that allow
   its access pattern.

## Enablement steps (in order, on localhost first)

1. `psql -f backend/prisma/phase0_app_role.sql` — creates `srivani_app` + grants.
2. Implement the AsyncLocalStorage + Prisma-extension tenant context (step 2 above).
3. Point `DATABASE_URL` at `srivani_app`; run the full app; run
   `backend/src/platform/tests/rls-isolation.test.ts`.
4. `psql -f backend/prisma/phase0_rls.sql && psql -f backend/prisma/phase0_rls_policies.sql`
   then `phase0_rls_enable.sql` — policies before enablement.
5. Smoke-test every module (POS sale, GRN approve, reports, GST compute, storefront order,
   scheduled report run).
6. Repeat 1–5 on prod during a low-traffic window, with a rollback script ready:
   `ALTER TABLE "X" NO FORCE ROW LEVEL SECURITY; ALTER TABLE "X" DISABLE ROW LEVEL SECURITY;`

## Until then

- Application-level `businessId` filtering remains the isolation mechanism — every new
  service MUST filter by `businessId` (this is already the codebase convention).
- The `srivani_app` role is created on prod (grants only, RLS off) so future SQL scripts with
  GRANT statements don't fail.
