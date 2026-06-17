import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('../backend/node_modules/xlsx/lib/xlsx.js');

const FILE = '/c/Users/SriKriations/Downloads/Srivani_Subcategories_Proposed.xlsx';
const wb = XLSX.readFile(FILE);

// List sheets
console.log('Sheets:', wb.SheetNames);

const sheetName = wb.SheetNames.find(s => s.toLowerCase().includes('proposed')) ?? wb.SheetNames[0];
console.log('Using sheet:', sheetName);

const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Total rows:', rows.length);
console.log('Columns:', Object.keys(rows[0] ?? {}));
console.log('\nFirst 5 rows:');
rows.slice(0, 5).forEach((r, i) => console.log(i+1, JSON.stringify(r)));
console.log('\nLast 3 rows:');
rows.slice(-3).forEach((r, i) => console.log(rows.length-2+i, JSON.stringify(r)));

// Count Keep=Y
const keepY = rows.filter(r => {
  const k = Object.values(r).find((v, idx) => Object.keys(r)[idx].toLowerCase().includes('keep'));
  return String(k ?? '').trim().toUpperCase() === 'Y';
});
console.log('\nKeep=Y rows:', keepY.length);
