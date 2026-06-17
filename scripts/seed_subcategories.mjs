/**
 * Seed subcategories from XLSX into the category table.
 * Idempotent — skips rows where code or (name+parentId) already exists.
 * Run from: j:\SVN\SVN_26\backend  (where xlsx and pg modules live)
 *
 * Usage:  node ../scripts/seed_subcategories.mjs
 */

import { createRequire } from 'module';
import { pathToFileURL } from 'url';
// Resolve modules from backend/node_modules where xlsx and pg are installed
const requireBackend = createRequire(new URL('../backend/package.json', import.meta.url));
const XLSX = requireBackend('xlsx');
const { Client } = requireBackend('pg');
const { randomBytes } = createRequire(import.meta.url)('crypto');

// ── Config ─────────────────────────────────────────────────────────────────

const XLSX_FILE = 'C:\\Users\\SriKriations\\Favorites\\Downloads\\Srivani_Subcategories_Proposed.xlsx';
const SHEET     = 'Proposed Subcategories';

const DB = {
  host:     'localhost',
  port:     5555,
  database: 'srivani_db',
  user:     'srivani',
  password: 'Srivani2026',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function cuid() {
  const ts  = Date.now().toString(36);
  const rnd = randomBytes(10).toString('base64url').slice(0, 16);
  return `c${ts}${rnd}`;
}

function now() { return new Date(); }

// ── Main ─────────────────────────────────────────────────────────────────────

const client = new Client(DB);
await client.connect();

// 1. Get businessId
const { rows: [biz] } = await client.query(`SELECT id FROM business LIMIT 1`);
const businessId = biz.id;
console.log('businessId:', businessId);

// 2. Load all current main categories (parentId IS NULL) → map code → row
const { rows: parents } = await client.query(
  `SELECT id, code, name, "departmentId" FROM category WHERE "parentId" IS NULL AND "businessId" = $1`,
  [businessId],
);
const parentByCode = new Map(parents.map(p => [p.code, p]));
console.log('Main categories loaded:', parentByCode.size);

// 3. Load all existing subcategories → set of codes, and set of (parentId+name)
const { rows: existingSubs } = await client.query(
  `SELECT id, code, name, "parentId" FROM category WHERE "parentId" IS NOT NULL AND "businessId" = $1`,
  [businessId],
);
const existingCodes   = new Set(existingSubs.map(s => s.code));
const existingNameKey = new Set(existingSubs.map(s => `${s.parentId}::${s.name.toLowerCase()}`));
console.log('Existing subcategories:', existingSubs.length);

// 4. Read XLSX
const wb   = XLSX.readFile(XLSX_FILE);
const ws   = wb.Sheets[SHEET];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
console.log('XLSX rows:', rows.length);

const keepRows = rows.filter(r => String(r['Keep? (Y/N)'] ?? '').trim().toUpperCase() === 'Y');
console.log('Keep=Y rows:', keepRows.length, '\n');

// 5. Seed
let created = 0;
let skippedCode = 0;
let skippedName = 0;
let parentMissing = 0;

const deptCreated = {};

const insertSQL = `
  INSERT INTO category
    (id, "businessId", name, code, label, "parentId", "departmentId", "sortOrder", "isActive", "isReturnableDefault", "createdAt", "updatedAt")
  VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, true, true, $9, $9)
`;

for (const row of keepRows) {
  const catCode  = String(row['Category Code'] ?? '').trim().toUpperCase();
  const subCode  = String(row['Subcategory Code'] ?? '').trim().toUpperCase();
  const subName  = String(row['Subcategory Name'] ?? '').trim();
  const dept     = String(row['Department'] ?? '').trim();

  if (!catCode || !subName) { console.log('  SKIP blank row:', JSON.stringify(row)); continue; }

  const parent = parentByCode.get(catCode);
  if (!parent) {
    console.warn(`  WARN parent not found: ${catCode}`);
    parentMissing++;
    continue;
  }

  // Auto-gen code if blank
  const code = subCode || `${catCode}_${String(created + skippedCode + skippedName + 1).padStart(2, '0')}`;

  // Idempotent checks
  if (existingCodes.has(code)) {
    skippedCode++;
    continue;
  }
  const nameKey = `${parent.id}::${subName.toLowerCase()}`;
  if (existingNameKey.has(nameKey)) {
    skippedName++;
    continue;
  }

  const id     = cuid();
  const sortOrder = created + 1;
  await client.query(insertSQL, [
    id, businessId, subName, code, subName,
    parent.id, parent.departmentId, sortOrder, now(),
  ]);

  existingCodes.add(code);
  existingNameKey.add(nameKey);
  deptCreated[dept] = (deptCreated[dept] ?? 0) + 1;
  created++;
}

console.log(`\n=== SEED COMPLETE ===`);
console.log(`Created:       ${created}`);
console.log(`Skipped (dup code):  ${skippedCode}`);
console.log(`Skipped (dup name):  ${skippedName}`);
console.log(`Parent missing:      ${parentMissing}`);
console.log('\nPer department:');
for (const [dept, count] of Object.entries(deptCreated).sort()) {
  console.log(`  ${dept.padEnd(12)} ${count}`);
}

await client.end();
