/**
 * Import Description + Keywords from products_categorized.csv into the product table.
 * Run: npx ts-node --project tsconfig.json ../data/import-desc-keywords.ts
 * (run from backend folder)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  const rows: Record<string, string>[] = [];
  let i = 1;
  while (i < lines.length) {
    const fields: string[] = [];
    let line = lines[i];
    let field = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    // handle multi-line quoted fields
    while (inQuotes && i + 1 < lines.length) {
      i++;
      line = lines[i];
      field += '\n';
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { fields.push(field.trim()); field = ''; }
        else { field += ch; }
      }
    }
    fields.push(field.trim());

    if (fields.length >= headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = fields[idx] ?? ''; });
      rows.push(row);
    }
    i++;
  }
  return rows;
}

async function main() {
  const csvPath = path.join(__dirname, 'products_categorized.csv');
  console.log('Reading CSV...');
  const rows = parseCSV(csvPath);
  console.log(`Found ${rows.length} rows`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const row of rows) {
    const code = (row['Code'] ?? '').trim().padStart(6, '0');
    const description = (row['Description'] ?? '').trim();
    const keywords = (row['Keywords'] ?? '').trim();

    if (!code || code === '000000') { skipped++; continue; }
    if (!description && !keywords) { skipped++; continue; }

    const product = await prisma.product.findFirst({
      where: { productCode: code },
      select: { id: true, productCode: true },
    });

    if (!product) { notFound++; continue; }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        ...(description ? { description } : {}),
        ...(keywords    ? { keywords }    : {}),
      },
    });
    updated++;

    if (updated % 100 === 0) console.log(`  Updated ${updated}...`);
  }

  console.log(`\nDone!`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped} (no description/keywords)`);
  console.log(`  NotFound: ${notFound} (product code not in DB)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
