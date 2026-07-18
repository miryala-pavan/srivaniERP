/**
 * stage-shop-files.cjs
 *
 * Copies customer-matched order files from SHOP_LIST_DIR to STAGING_DIR,
 * ready for upload to the Hetzner VPS.
 *
 * Priority per customer+date folder:
 *   1. Images (jpg/jpeg/png/jfif/webp/tif/tiff/heic/heif/bmp) + PDF → always copy
 *   2. Docx / doc                                                     → copy ONLY as
 *      fallback when no image or pdf exists for that customer+date
 *   Everything else (exe, mp4, zip, xlsx, txt…)                      → skipped
 *
 * For docx-only matches that have no CustomerListEntry yet, a DB record is
 * created so the history page can show them.
 *
 * Run from J:\SVN\SVN_26\backend:
 *   node scripts/stage-shop-files.cjs            <- live
 *   DRY_RUN=1 node scripts/stage-shop-files.cjs  <- preview only (no copies, no DB writes)
 *   YEAR=2024  node scripts/stage-shop-files.cjs  <- one year only
 *
 * Env vars (all optional):
 *   SHOP_LIST_DIR  — source tree         (default: D:/shop/LIST/new)
 *   STAGING_DIR    — copy destination    (default: D:/shop/LIST/upload-ready)
 *   BUSINESS_ID    — target business     (default: first in DB)
 *   DRY_RUN        — "1" to skip all writes
 *   YEAR           — restrict to one top-level year folder
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

// ── Config ────────────────────────────────────────────────────────────────────
const SHOP_LIST_DIR = (process.env.SHOP_LIST_DIR ?? 'D:/shop/LIST/new').replace(/\\/g, '/');
const STAGING_DIR   = (process.env.STAGING_DIR   ?? 'D:/shop/LIST/upload-ready').replace(/\\/g, '/');
const DRY_RUN       = process.env.DRY_RUN === '1';
const ONLY_YEAR     = process.env.YEAR ?? null;

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.jfif', '.webp', '.tif', '.tiff', '.heic', '.heif', '.bmp', '.pdf']);
const DOCX_EXTS  = new Set(['.docx', '.doc']);

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPhone(filename) {
  const base = path.basename(filename, path.extname(filename));
  const hits = [...base.matchAll(/([6-9]\d{4})\s?(\d{5})/g)];
  if (!hits.length) return null;
  const last  = hits[hits.length - 1];
  const phone = last[1] + last[2];
  return /^[6-9]\d{9}$/.test(phone) ? phone : null;
}

function parseDate(name) {
  if (!/^\d{8}$/.test(name)) return null;
  const dt = new Date(Date.UTC(
    parseInt(name.slice(0, 4), 10),
    parseInt(name.slice(4, 6), 10) - 1,
    parseInt(name.slice(6, 8), 10),
  ));
  return isNaN(dt.getTime()) ? null : dt;
}

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

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📁  Source  : ${SHOP_LIST_DIR}`);
  console.log(`📦  Staging : ${STAGING_DIR}`);
  console.log(`🔧  Mode    : ${DRY_RUN ? 'DRY RUN (no copies, no DB writes)' : 'LIVE'}`);
  if (ONLY_YEAR) console.log(`📅  Year    : ${ONLY_YEAR}`);
  console.log();

  const businessId = process.env.BUSINESS_ID
    ?? (await prisma.business.findFirst({ select: { id: true } }))?.id;
  if (!businessId) { console.error('❌  No business found in DB.'); process.exit(1); }
  console.log(`🏢  Business ID : ${businessId}`);

  // Load all customers with a phone number into a map
  const customerRows = await prisma.customer.findMany({
    where:  { businessId, phone: { not: null } },
    select: { id: true, name: true, phone: true, historyToken: true },
  });
  const phoneMap = new Map(customerRows.map(c => [c.phone, c]));
  console.log(`👥  Customers in DB : ${phoneMap.size}\n`);

  const stats = {
    dateDirs: 0,
    imagesCopied: 0,
    docxFallbackCopied: 0,
    docxEntriesCreated: 0,
    alreadyInStaging: 0,
    bytesTotal: 0,
  };

  const topDirs = fs.readdirSync(SHOP_LIST_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && (!ONLY_YEAR || e.name === ONLY_YEAR))
    .map(e => path.join(SHOP_LIST_DIR, e.name));

  for (const topDir of topDirs) {
    for (const { dirPath, date, dirName } of walkDateDirs(topDir)) {
      const allFiles = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));

      // Group by phone: separate images/pdfs from docx
      const byPhone = new Map(); // phone → { images: string[], docx: string[] }

      for (const file of allFiles) {
        const ext   = path.extname(file).toLowerCase();
        const phone = extractPhone(file);
        if (!phone || !phoneMap.has(phone)) continue;
        if (!IMAGE_EXTS.has(ext) && !DOCX_EXTS.has(ext)) continue;

        if (!byPhone.has(phone)) byPhone.set(phone, { images: [], docx: [] });
        const bucket = byPhone.get(phone);
        if (IMAGE_EXTS.has(ext)) bucket.images.push(file);
        else                      bucket.docx.push(file);
      }

      if (!byPhone.size) continue;
      stats.dateDirs++;

      for (const [phone, { images, docx }] of byPhone) {
        const customer       = phoneMap.get(phone);
        const isDocxFallback = images.length === 0 && docx.length > 0;
        const filesToCopy    = images.length > 0 ? images : docx;

        if (!filesToCopy.length) continue;

        // Collect ALL valid relative paths for this customer+date (used for DB entry)
        const relPaths = [];

        for (const file of filesToCopy) {
          const srcPath  = path.join(dirPath, file);
          const rel      = path.relative(SHOP_LIST_DIR, srcPath).replace(/\\/g, '/');
          const destPath = path.join(STAGING_DIR, rel);

          if (fs.existsSync(destPath)) {
            stats.alreadyInStaging++;
            relPaths.push(rel); // already staged — still track for DB creation
            continue;
          }

          let size;
          try { size = fs.statSync(srcPath).size; }
          catch {
            console.warn(`  ⚠️  Cannot stat (encoding issue, skipping): ${srcPath}`);
            stats.encodingSkipped = (stats.encodingSkipped ?? 0) + 1;
            continue;
          }
          stats.bytesTotal += size;

          const icon = isDocxFallback ? '📄' : '🖼️ ';
          console.log(`  ${DRY_RUN ? '[dry]' : '✅'} ${icon} ${dirName} | ${customer.name} (${phone}) | ${file}`);

          if (!DRY_RUN) {
            try { copyFile(srcPath, destPath); }
            catch {
              console.warn(`  ⚠️  Cannot copy (encoding issue, skipping): ${file}`);
              stats.encodingSkipped = (stats.encodingSkipped ?? 0) + 1;
              continue;
            }
          }

          relPaths.push(rel);
          if (isDocxFallback) stats.docxFallbackCopied++;
          else                 stats.imagesCopied++;
        }

        // For docx-only matches: create a DB entry if one doesn't exist yet
        if (isDocxFallback && relPaths.length > 0 && !DRY_RUN) {
          const already = await prisma.customerListEntry.findFirst({
            where:  { customerId: customer.id, businessId, entryDate: date },
            select: { id: true },
          });
          if (!already) {
            await prisma.customerListEntry.create({
              data: {
                businessId,
                customerId: customer.id,
                entryDate:  date,
                imageUrls:  relPaths,
                pageCount:  relPaths.length,
                source:     'MANUAL',
              },
            });
            stats.docxEntriesCreated++;
          } else {
            stats.docxEntriesAlreadyExist = (stats.docxEntriesAlreadyExist ?? 0) + 1;
          }

          // Stamp historyToken if missing
          if (!customer.historyToken) {
            const token = crypto.randomBytes(16).toString('hex');
            await prisma.customer.update({
              where: { id: customer.id },
              data:  { historyToken: token },
            });
            customer.historyToken = token;
            phoneMap.set(phone, customer);
          }
        }
      }
    }
  }

  const mb = (stats.bytesTotal / 1024 / 1024).toFixed(1);
  const gb = (stats.bytesTotal / 1024 / 1024 / 1024).toFixed(2);

  console.log('\n──────────────────────────────────────────────');
  console.log(`📁  Date dirs processed    : ${stats.dateDirs}`);
  console.log(`🖼️   Image/PDF files copied : ${stats.imagesCopied}`);
  console.log(`📄  Docx fallback copied   : ${stats.docxFallbackCopied}`);
  console.log(`🗂️   Docx DB entries created: ${stats.docxEntriesCreated}`);
  if (stats.docxEntriesAlreadyExist) console.log(`🗂️   Docx entries already existed: ${stats.docxEntriesAlreadyExist}`);
  console.log(`⏭️   Already in staging     : ${stats.alreadyInStaging}`);
  if (stats.encodingSkipped) console.log(`⚠️   Encoding errors skipped : ${stats.encodingSkipped}`);
  console.log(`💾  Total staged size      : ${mb} MB (${gb} GB)`);
  if (DRY_RUN) console.log('\n⚠️   DRY RUN — nothing was copied or written to the database.');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('\n❌', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
