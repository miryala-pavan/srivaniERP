/**
 * P0.1 RLS Cross-Tenant Isolation Test
 *
 * Verifies that RLS policies on Phase 0 tables correctly isolate tenant data.
 * Tests run as the non-superuser `srivani_app` role — superusers bypass RLS.
 * In production the application connects as srivani_app (not srivani).
 *
 * Run: npx ts-node src/platform/tests/rls-isolation.test.ts
 */

import { PrismaClient } from '@prisma/client';

// Admin client (superuser) — used only for setup/teardown
const adminPrisma = new PrismaClient();

// App client (non-superuser) — RLS applies to this role
const appDbUrl = (process.env.DATABASE_URL ?? '').replace(
  /srivani:[^@]+@/,
  'srivani_app:SrivaniApp2026@',
);
const appPrisma = new PrismaClient({ datasources: { db: { url: appDbUrl } } });

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

/** Run a query as the app role with app.business_id set */
async function queryWithBusinessId(businessId: string, eventId: string) {
  return appPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.business_id = '${businessId}'`);
    return tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "OutboxEvent" WHERE id = '${eventId}'`,
    );
  });
}

async function main() {
  console.log('\nP0.1 RLS Cross-Tenant Isolation Tests');
  console.log('(running as srivani_app — non-superuser, RLS enforced)\n');

  const businesses = await adminPrisma.business.findMany({
    take: 2,
    select: { id: true, name: true },
  });

  if (!businesses.length) {
    throw new Error('No businesses in DB. Cannot run RLS test.');
  }

  const bizA = businesses[0];
  const bizB = businesses[1] ?? { id: 'xxxxxxxx-fake-biz-id', name: 'FAKE_B' };

  // Insert a test event as bizA (via admin connection — bypasses RLS for setup)
  const testEvent = await adminPrisma.outboxEvent.create({
    data: {
      businessId: bizA.id,
      aggregateType: 'RLS_TEST',
      aggregateId: 'rls-test-1',
      eventType: 'platform.rls.test',
      payload: { test: true },
      status: 'PENDING',
    },
  });

  // ── Test 1: Business A sees its own data ─────────────────────────────────
  await runTest('Business A (app role) sees its own OutboxEvent', async () => {
    const rows = await queryWithBusinessId(bizA.id, testEvent.id);
    if (!rows.length) throw new Error('Expected 1 row but got 0 — RLS over-blocking');
  });

  // ── Test 2: Business B cannot see Business A's data ──────────────────────
  await runTest("Business B (app role) cannot see Business A's OutboxEvent", async () => {
    const rows = await queryWithBusinessId(bizB.id, testEvent.id);
    if (rows.length > 0) {
      throw new Error(
        `RLS BREACH: Business B saw ${rows.length} row(s) belonging to Business A`,
      );
    }
  });

  // ── Test 3: No business context = no rows ────────────────────────────────
  await runTest('Empty app.business_id context returns 0 rows', async () => {
    const rows = await queryWithBusinessId('', testEvent.id);
    if (rows.length > 0) {
      throw new Error(`RLS BREACH: empty context returned ${rows.length} row(s)`);
    }
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await adminPrisma.outboxEvent.delete({ where: { id: testEvent.id } });

  console.log(`\n  Business A: ${bizA.name} (${bizA.id})`);
  console.log(`  Business B: ${bizB.name} (${bizB.id})\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    await adminPrisma.$disconnect();
    await appPrisma.$disconnect();
  });
