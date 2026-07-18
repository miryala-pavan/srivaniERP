/**
 * seed-customer-lists.cjs
 *
 * Walks SHOP_LIST_DIR looking for date-named folders (YYYYMMDD), extracts
 * phone numbers from image filenames, matches them to Customer records, and
 * creates CustomerListEntry rows.  Also stamps historyToken on each matched
 * customer so a shareable link is ready to send.
 *
 * Run from J:\SVN\SVN_26\backend:
 *   node scripts/seed-customer-lists.cjs          <- live
 *   DRY_RUN=1 node scripts/seed-customer-lists.cjs <- dry run (no writes)
 *   YEAR=2024 node scripts/seed-customer-lists.cjs  <- one year only
 *
 * Env vars (all optional):
 *   SHOP_LIST_DIR  — root of order image tree  (default: D:/shop/LIST/new)
 *   BUSINESS_ID    — target business            (default: first in DB)
 *   DRY_RUN        — set to "1" to skip DB writes
 *   YEAR           — restrict to a single top-level year folder
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

// ── Config ────────────────────────────────────────────────────────────────────
const SHOP_LIST_DIR = (process.env.SHOP_LIST_DIR ?? 'D:/shop/LIST/new').replace(/\\/g, '/');
const DRY_RUN       = process.env.DRY_RUN === '1';
const ONLY_YEAR     = process.env.YEAR ?? null;

// Only images go into imageUrls; docx/txt are OCR artifacts — skip them
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.jfif', '.webp', '.pdf']);

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts a 10-digit Indian mobile number from a filename like:
 *   "Bhargavi 89854 03973.jpg"        → "8985403973"
 *   "Kumar Swamy  99891 18144.jpeg"   → "9989118144"
 *   "Ashok Kumar 9885720222.docx"     → "9885720222"
 *   "Madhu  98491 92161 1.jpeg"       → "9849192161"
 *   "J RAMULU 94406884710001.jpg"     → "9440688471"
 * Returns null if no valid phone found.
 */
function extractPhone(filename) {
  const base = path.basename(filename, path.extname(filename));
  // Match 5 digits + optional space + 5 digits starting with 6-9
  const hits = [...base.matchAll(/([6-9]\d{4})\s?(\d{5})/g)];
  if (!hits.length) return null;
  const last   = hits[hits.length - 1];
  const phone  = last[1] + last[2];
  return /^[6-9]\d{9}$/.test(phone) ? phone : null;
}

/** Returns a Date for "YYYYMMDD" directory names, or null for anything else. */
function parseDate(name) {
  if (!/^\d{8}$/.test(name)) return null;
  const dt = new Date(Date.UTC(
    parseInt(name.slice(0, 4), 10),
    parseInt(name.slice(4, 6), 10) - 1,
    parseInt(name.slice(6, 8), 10),
  ));
  return isNaN(dt.getTime()) ? null : dt;
}

/** Recursively yields { dirPath, date } for every YYYYMMDD folder found. */
function* walkDateDirs(root) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return; }

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const date = parseDate(e.name);
    if (date) {
      yield { dirPath: path.join(root, e.name), date, dirName: e.name };
    } else {
      yield* walkDateDirs(path.join(root, e.name));
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📁  Shop list dir : ${SHOP_LIST_DIR}`);
  console.log(`🔧  Mode          : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (ONLY_YEAR) console.log(`📅  Year filter   : ${ONLY_YEAR}`);
  console.log();

  // Resolve businessId
  const businessId = process.env.BUSINESS_ID
    ?? (await prisma.business.findFirst({ select: { id: true } }))?.id;
  if (!businessId) { console.error('❌  No business found in DB.'); process.exit(1); }
  console.log(`🏢  Business ID   : ${businessId}\n`);

  const stats = {
    dateDirs: 0, filesScanned: 0,
    customersMatched: 0, entriesCreated: 0, entriesSkipped: 0,
    noPhone: 0, noCustomer: 0,
  };

  // Per-phone customer cache (avoid repeated DB lookups)
  const phoneCache = new Map(); // phone → Customer | null

  // Determine which top-level dirs to scan
  const topDirs = fs.readdirSync(SHOP_LIST_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && (!ONLY_YEAR || e.name === ONLY_YEAR))
    .map(e => path.join(SHOP_LIST_DIR, e.name));

  for (const topDir of topDirs) {
    for (const { dirPath, date, dirName } of walkDateDirs(topDir)) {
      const files = fs.readdirSync(dirPath).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return IMAGE_EXTS.has(ext) && !f.startsWith('.');
      });
      if (!files.length) continue;
      stats.dateDirs++;
      stats.filesScanned += files.length;

      // Group image files by phone number
      const byPhone = new Map(); // phone → string[] (relative image paths)
      for (const file of files) {
        const phone = extractPhone(file);
        if (!phone) { stats.noPhone++; continue; }
        if (!byPhone.has(phone)) byPhone.set(phone, []);
        const rel = path.relative(SHOP_LIST_DIR, path.join(dirPath, file)).replace(/\\/g, '/');
        byPhone.get(phone).push(rel);
      }

      for (const [phone, imageUrls] of byPhone) {
        // Customer lookup (cached)
        let customer = phoneCache.get(phone);
        if (customer === undefined) {
          customer = await prisma.customer.findFirst({
            where: { businessId, phone },
            select: { id: true, name: true, phone: true, historyToken: true },
          }) ?? null;
          phoneCache.set(phone, customer);
        }
        if (!customer) { stats.noCustomer++; continue; }
        stats.customersMatched++;

        // Skip if entry already exists for this customer+date
        const already = await prisma.customerListEntry.findFirst({
          where: { customerId: customer.id, businessId, entryDate: date },
          select: { id: true },
        });
        if (already) { stats.entriesSkipped++; continue; }

        const tag = `${dirName}  👤 ${customer.name} (${phone})  📄 ${imageUrls.length}p`;
        console.log(`  ${DRY_RUN ? '[dry]' : '✅'} ${tag}`);
        stats.entriesCreated++;

        if (!DRY_RUN) {
          await prisma.customerListEntry.create({
            data: {
              businessId,
              customerId:  customer.id,
              entryDate:   date,
              imageUrls,
              pageCount:   imageUrls.length,
              source:      'MANUAL',
            },
          });

          // Stamp a historyToken if the customer doesn't have one yet
          if (!customer.historyToken) {
            const token = crypto.randomBytes(16).toString('hex');
            await prisma.customer.update({
              where: { id: customer.id },
              data:  { historyToken: token },
            });
            customer.historyToken = token;
            phoneCache.set(phone, customer);
          }
        }
      }
    }
  }

  console.log('\n──────────────────────────────────────────────');
  console.log(`📁  Date folders scanned     : ${stats.dateDirs}`);
  console.log(`📄  Files scanned            : ${stats.filesScanned}`);
  console.log(`👥  Customers matched        : ${stats.customersMatched}`);
  console.log(`✅  Entries ${DRY_RUN ? 'to create' : 'created'}          : ${stats.entriesCreated}`);
  console.log(`⏭️   Entries already existed  : ${stats.entriesSkipped}`);
  console.log(`❓  Files without phone      : ${stats.noPhone}`);
  console.log(`🔍  Phones not in DB         : ${stats.noCustomer}`);
  if (DRY_RUN) console.log('\n⚠️   DRY RUN — nothing was written to the database.');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('\n❌', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
