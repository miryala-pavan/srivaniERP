/**
 * Generates and executes subcategory seed SQL.
 * Idempotent — uses INSERT ... ON CONFLICT DO NOTHING on the (businessId, code) unique key.
 * Run from:  j:\SVN\SVN_26\backend
 *   node scripts/seed_subcategories.cjs
 */

'use strict';
const XLSX   = require('xlsx');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { execSync, spawnSync } = require('child_process');

const XLSX_FILE = 'C:\\Users\\SriKriations\\Favorites\\Downloads\\Srivani_Subcategories_Proposed.xlsx';
const SHEET     = 'Proposed Subcategories';
const SQL_OUT   = path.join(__dirname, 'seed_subcategories_generated.sql');

// ── Helpers ───────────────────────────────────────────────────────────────────

function cuid() {
  const ts  = Date.now().toString(36);
  const rnd = crypto.randomBytes(10).toString('base64url').slice(0, 16);
  return `c${ts}${rnd}`;
}

function esc(s) { return String(s ?? '').replace(/'/g, "''"); }

function runPsql(sql) {
  const result = spawnSync('docker', [
    'exec', '-i', 'srivani_postgres',
    'psql', '-U', 'srivani', '-d', 'srivani_db', '-t', '-c', sql,
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

function runPsqlFile(file) {
  // pipe file into docker stdin using cat + pipe
  const result = spawnSync('docker', [
    'exec', '-i', 'srivani_postgres',
    'psql', '-U', 'srivani', '-d', 'srivani_db', '--set=ON_ERROR_STOP=1',
  ], { input: fs.readFileSync(file, 'utf8'), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

// ── Step 1: fetch DB state ────────────────────────────────────────────────────

const bizId = runPsql('SELECT id FROM business LIMIT 1').split('\n')[0].trim();
console.log('businessId:', bizId);

// parent categories: id | code | departmentId
const parentRaw = runPsql(
  `SELECT id, code, "departmentId" FROM category WHERE "parentId" IS NULL AND "businessId" = '${bizId}' ORDER BY code`
);
const parentByCode = new Map();
for (const line of parentRaw.split('\n').map(l => l.trim()).filter(Boolean)) {
  const parts = line.split('|').map(s => s.trim());
  if (parts.length >= 3) parentByCode.set(parts[1], { id: parts[0], code: parts[1], departmentId: parts[2] || null });
}
console.log('Parent categories loaded:', parentByCode.size);

// existing subcategory codes (for reporting only — ON CONFLICT handles idempotency)
const subRaw = runPsql(
  `SELECT code FROM category WHERE "parentId" IS NOT NULL AND "businessId" = '${bizId}'`
);
const existingCodes = new Set(
  subRaw.split('\n').map(l => l.trim()).filter(Boolean)
);
console.log('Existing subcategory codes:', existingCodes.size);

// ── Step 2: parse XLSX ────────────────────────────────────────────────────────

const wb       = XLSX.readFile(XLSX_FILE);
const ws       = wb.Sheets[SHEET];
const allRows  = XLSX.utils.sheet_to_json(ws, { defval: '' });
console.log('XLSX rows:', allRows.length);

const keepRows = allRows.filter(r => String(r['Keep? (Y/N)'] ?? '').trim().toUpperCase() === 'Y');
console.log('Keep=Y rows:', keepRows.length, '\n');

// ── Step 3: build SQL ─────────────────────────────────────────────────────────

const lines = [];
lines.push('BEGIN;');

let planned = 0;
let wouldSkip = 0;
let parentMissing = 0;
const deptPlanned = {};

const ts = new Date().toISOString();

for (const row of keepRows) {
  const catCode = String(row['Category Code'] ?? '').trim().toUpperCase();
  const subCode = String(row['Subcategory Code'] ?? '').trim().toUpperCase();
  const subName = String(row['Subcategory Name'] ?? '').trim();
  const dept    = String(row['Department'] ?? '').trim();

  if (!catCode || !subName) continue;

  const parent = parentByCode.get(catCode);
  if (!parent) {
    console.warn('  WARN parent not found:', catCode);
    parentMissing++;
    continue;
  }

  const code = subCode || `${catCode}_${String(planned + 1).padStart(2, '0')}`;

  if (existingCodes.has(code)) {
    wouldSkip++;
    continue;
  }

  const id = cuid();
  const deptId = parent.departmentId ? `'${parent.departmentId}'` : 'NULL';
  lines.push(
    `INSERT INTO category (id,"businessId",name,code,label,"parentId","departmentId","sortOrder","isActive","isReturnableDefault","createdAt","updatedAt")` +
    ` VALUES ('${id}','${bizId}','${esc(subName)}','${esc(code)}','${esc(subName)}','${parent.id}',${deptId},${planned + 1},true,true,'${ts}','${ts}')` +
    ` ON CONFLICT ("businessId",code) DO NOTHING;`
  );
  existingCodes.add(code); // prevent duplicate within this run
  deptPlanned[dept] = (deptPlanned[dept] ?? 0) + 1;
  planned++;
}

lines.push('COMMIT;');

// ── Step 4: write + execute SQL ───────────────────────────────────────────────

fs.writeFileSync(SQL_OUT, lines.join('\n'), 'utf8');
console.log(`SQL written: ${SQL_OUT}  (${lines.length} lines, ${planned} INSERTs)`);

if (planned === 0) {
  console.log('Nothing to insert — all already exist.');
  process.exit(0);
}

console.log('\nExecuting...');
const out = runPsqlFile(SQL_OUT);
if (out.includes('ERROR')) {
  console.error('psql errors:\n', out);
  process.exit(1);
}

// ── Step 5: report ────────────────────────────────────────────────────────────

console.log(`\n=== SEED COMPLETE ===`);
console.log(`Inserted:           ${planned}`);
console.log(`Skipped (pre-exist):${wouldSkip}`);
console.log(`Parent missing:     ${parentMissing}`);
console.log('\nPer department:');
for (const [dept, count] of Object.entries(deptPlanned).sort()) {
  console.log(`  ${dept.padEnd(14)} ${count}`);
}
