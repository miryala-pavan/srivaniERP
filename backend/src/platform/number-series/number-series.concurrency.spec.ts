/**
 * GAP 4 — Concurrency test for next_number()
 *
 * Verifies the FOR UPDATE lock in the DB-level next_number() function
 * guarantees uniqueness under concurrent calls. 100 parallel calls must
 * produce exactly 100 distinct, gapless numbers.
 *
 * Requires: a running PostgreSQL on DATABASE_URL (Docker port 5555).
 * Run with: npx jest number-series.concurrency --testTimeout=30000
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BUSINESS_ID = 'test-concurrent-biz-' + Date.now();
const SERIES_CODE = 'TEST_CONCURRENT';
const FY = '2026-27';
const CONCURRENCY = 100;

beforeAll(async () => {
  // Seed a NumberSeries row for the test business
  await prisma.numberSeries.create({
    data: {
      businessId: BUSINESS_ID,
      code: SERIES_CODE,
      prefix: 'TST-',
      padLength: 5,
      currentValue: 0,
    },
  });
});

afterAll(async () => {
  await prisma.numberSeries.deleteMany({ where: { businessId: BUSINESS_ID } });
  await prisma.$disconnect();
});

test(`${CONCURRENCY} concurrent next_number() calls produce ${CONCURRENCY} unique numbers`, async () => {
  const calls = Array.from({ length: CONCURRENCY }, () =>
    prisma.$queryRaw<{ next_number: string }[]>`
      SELECT next_number(${BUSINESS_ID}::text, ${SERIES_CODE}::text, ${FY}::text) AS next_number
    `.then((rows) => rows[0].next_number),
  );

  const results = await Promise.all(calls);

  const unique = new Set(results);
  expect(unique.size).toBe(CONCURRENCY);

  // Also verify they are TST-00001 through TST-00100
  for (let i = 1; i <= CONCURRENCY; i++) {
    expect(unique.has(`TST-${String(i).padStart(5, '0')}`)).toBe(true);
  }
}, 30_000);
