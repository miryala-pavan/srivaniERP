/**
 * generate-keywords.cjs
 * Uses the Anthropic API to generate SEO keywords for products
 * that have an empty/null keywords field.
 *
 * Prerequisites:
 *   Set ANTHROPIC_API_KEY in your environment or add to .env:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *
 * Run (from J:\SVN\SVN_26\backend):
 *   node scripts/generate-keywords.cjs
 *
 * Options:
 *   BATCH_SIZE  — products per API call  (default 20)
 *   LIMIT       — max products to process (default all)
 *   DRY_RUN     — set to "1" to print without writing to DB
 *
 * Example:
 *   BATCH_SIZE=10 DRY_RUN=1 node scripts/generate-keywords.cjs
 */

'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma      = new PrismaClient();
const API_KEY     = process.env.ANTHROPIC_API_KEY;
const BATCH_SIZE  = parseInt(process.env.BATCH_SIZE  ?? '20', 10);
const DRY_RUN     = process.env.DRY_RUN === '1';
const LIMIT       = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;

if (!API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY is not set.');
  console.error('    Add it to J:\\SVN\\SVN_26\\backend\\.env  or set it in the shell:');
  console.error('    set ANTHROPIC_API_KEY=sk-ant-...');
  process.exit(1);
}

// ── Anthropic call ───────────────────────────────────────────────────────────
async function generateKeywordsBatch(products) {
  // Build a compact list for the prompt
  const list = products
    .map((p, i) => {
      const parts = [`${i + 1}. ${p.name}`];
      if (p.category) parts.push(`(${p.category})`);
      if (p.description) parts.push(`— ${p.description.slice(0, 100)}`);
      return parts.join(' ');
    })
    .join('\n');

  const prompt = `You are a product data specialist for an Indian grocery/FMCG store.
For each product below, output a single line of 5–10 comma-separated lowercase search keywords in English.
Keywords should include: product type, brand hints (if obvious), common synonyms, use-case words.
Do NOT include the product number or any extra text — only the comma-separated keywords per line.

Products:
${list}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? '';
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  return lines; // one keywords string per product
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const biz = await prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!biz) throw new Error('No active business found');

  // Fetch products with no keywords (only those available online for relevance)
  const products = await prisma.product.findMany({
    where: {
      businessId: biz.id,
      isActive: true,
      OR: [{ keywords: null }, { keywords: '' }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      category: { select: { label: true, name: true } },
    },
    orderBy: { name: 'asc' },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(`Found ${products.length} products without keywords`);
  if (products.length === 0) { console.log('Nothing to do.'); return; }
  if (DRY_RUN) console.log('DRY RUN — no DB writes');

  let updated = 0;
  let errors  = 0;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    // Prepare for prompt
    const promptInput = batch.map(p => ({
      name:        p.name,
      description: p.description ?? '',
      category:    p.category?.label || p.category?.name || '',
    }));

    process.stdout.write(`  Processing ${i + 1}–${Math.min(i + BATCH_SIZE, products.length)} of ${products.length}...`);

    try {
      const keywordLines = await generateKeywordsBatch(promptInput);

      for (let j = 0; j < batch.length; j++) {
        const kw = keywordLines[j]?.trim();
        if (!kw) continue;

        if (!DRY_RUN) {
          await prisma.product.update({
            where: { id: batch[j].id },
            data:  { keywords: kw },
          });
        } else {
          console.log(`  ${batch[j].name} → ${kw}`);
        }
        updated++;
      }

      console.log(` ✓ (${keywordLines.length} generated)`);
    } catch (err) {
      console.error(` ✗ Error: ${err.message}`);
      errors++;
    }

    // Small delay between batches to be polite to the API
    if (i + BATCH_SIZE < products.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n━━━ Keywords generation complete ━━━`);
  console.log(`  ✅ Updated : ${updated}`);
  console.log(`  ❌ Errors  : ${errors}`);
  if (DRY_RUN) console.log('  (DRY RUN — nothing written to DB)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
