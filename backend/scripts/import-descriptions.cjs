/**
 * import-descriptions.cjs
 * Reads products_categorized.csv and populates description + keywords
 * on Product rows matched by productCode (zero-padded 6-digit).
 *
 * Run (from J:\SVN\SVN_26\backend):
 *   node scripts/import-descriptions.cjs
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Robust CSV parser — handles double-quoted fields containing commas/newlines
function parseCSV(content) {
  const rows = [];
  let headers = null;
  let i = 0;

  while (i < content.length) {
    // Parse one logical row
    const cells = [];
    let cell = '';

    while (i < content.length) {
      const ch = content[i];

      if (ch === '"') {
        // quoted field
        i++;
        while (i < content.length) {
          if (content[i] === '"') {
            if (content[i + 1] === '"') { cell += '"'; i += 2; }
            else { i++; break; }
          } else {
            cell += content[i++];
          }
        }
      } else if (ch === ',') {
        cells.push(cell.trim());
        cell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        // End of logical row
        if (ch === '\r' && content[i + 1] === '\n') i++;
        i++;
        break;
      } else {
        cell += ch;
        i++;
      }
    }
    cells.push(cell.trim());

    // Skip completely blank rows
    if (cells.length === 1 && cells[0] === '') continue;

    if (!headers) {
      headers = cells;
    } else {
      const row = {};
      headers.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
      rows.push(row);
    }
  }

  return rows;
}

async function main() {
  const csvPath = path.resolve(__dirname, '../../data/products_categorized.csv');
  console.log(`Reading: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`Parsed ${rows.length} CSV rows`);

  const biz = await prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!biz) throw new Error('No active business found');

  let updated = 0, skipped = 0, noMatch = 0;

  for (const row of rows) {
    const rawCode = (row['Code'] ?? '').trim();
    if (!rawCode) { skipped++; continue; }

    const description = (row['Description'] ?? '').trim();
    const keywords    = (row['Keywords']    ?? '').trim();

    if (!description && !keywords) { skipped++; continue; }

    // Zero-pad to 6 digits to match DB productCode format
    const productCode = rawCode.padStart(6, '0');

    const product = await prisma.product.findFirst({
      where: { businessId: biz.id, productCode },
      select: { id: true },
    });

    if (!product) {
      noMatch++;
      if (noMatch <= 10) console.warn(`  No match: code=${productCode} (raw=${rawCode})`);
      continue;
    }

    const data = {};
    if (description) data.description = description;
    if (keywords)    data.keywords    = keywords;

    await prisma.product.update({ where: { id: product.id }, data });
    updated++;
    if (updated % 200 === 0) process.stdout.write(`  Updated ${updated}...\r`);
  }

  console.log(`\n━━━ Import complete ━━━`);
  console.log(`  ✅ Updated  : ${updated}`);
  console.log(`  ⏭  Skipped  : ${skipped} (no description/keywords in CSV)`);
  console.log(`  ⚠️  No match : ${noMatch} (code not found in DB)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
