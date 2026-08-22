/**
 * bulk-optin-existing-customers.cjs
 *
 * One-off: marks every existing Customer row as whatsappOptIn = true (new
 * customer defaults already flip to true in code — this catches everyone
 * created before that change). Stamps consentGivenAt for rows that didn't
 * already have one, same convention as the bulk opt-in API endpoint.
 *
 * Run from J:\SVN\SVN_26\backend:
 *   DRY_RUN=1 node scripts/bulk-optin-existing-customers.cjs   <- count only
 *   node scripts/bulk-optin-existing-customers.cjs             <- live write
 */
'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
  console.log(`Found ${businesses.length} business(es):`, businesses.map(b => b.name).join(', '));

  const toFlip = await prisma.customer.count({ where: { whatsappOptIn: false } });
  console.log(`Customers currently opted out: ${toFlip}`);

  if (DRY_RUN) {
    console.log('DRY_RUN=1 — no writes performed.');
    return;
  }
  if (toFlip === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Two passes so a customer who genuinely opted in before and later opted
  // out keeps their real historical consentGivenAt instead of it being
  // overwritten by today's administrative bulk-flip date.
  const freshConsent = await prisma.customer.updateMany({
    where: { whatsappOptIn: false, consentGivenAt: null },
    data: { whatsappOptIn: true, consentGivenAt: new Date() },
  });
  const restoredOptIn = await prisma.customer.updateMany({
    where: { whatsappOptIn: false, consentGivenAt: { not: null } },
    data: { whatsappOptIn: true },
  });
  console.log(`Updated ${freshConsent.count + restoredOptIn.count} customer(s) to whatsappOptIn = true `
    + `(${freshConsent.count} first-time consent stamp, ${restoredOptIn.count} kept their original consent date).`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
