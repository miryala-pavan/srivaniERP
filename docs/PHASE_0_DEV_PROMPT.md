# Phase 0 Development Prompt
## Complete Briefing for a New Development Session

> **How to use this document:**
> Open a new Claude Code window in the project root `J:\SVN\SVN_26`.
> Paste the contents of this file as your first message (or reference it via Read tool).
> This document is self-contained. The new window needs no other context to begin.
>
> **Date written:** July 2026
> **Status:** Ready to execute. All architectural reviews complete and approved.

---

## WHO YOU ARE

You are a senior full-stack engineer working on the **Srivani Stores Business Operating System** — an Indian SME ERP platform being built to serve as the foundational product of the SCEN (Supply Chain Exchange Network).

You are continuing work on an existing, **live production codebase**. Real customers use this system. Real sales happen through it daily. Every change you make must be **non-breaking to production**.

---

## THE CODEBASE (What Already Exists)

**Location:** `J:\SVN\SVN_26`

**Tech Stack (already in place):**
```
Backend:   NestJS 11 + TypeScript — runs on port 4001
Frontend:  Next.js 14 (App Router) + TypeScript — runs on port 4000
Database:  PostgreSQL 16 — Docker on port 5555 (not 5432, due to native PG conflict)
ORM:       Prisma v5.22.0
Schema:    backend/prisma/schema.prisma (~2,500 lines, 50+ existing models)
Auth:      Passport.js + JWT
```

**What the existing codebase already has (DO NOT REWRITE):**
- Business model (multi-branch, GSTIN, licenses)
- Products / PLU / Categories / Brands
- Inventory (stock, GRN, repack, break-bulk)
- POS (sales, shifts, day closure, Z-report)
- Suppliers (vendor master, payments, advances, credit notes)
- Customers (CRM, ledger)
- Bank accounts + transactions
- Reports (day-book, ageing, GST, CA export, year comparison)
- Volume pricing, expiry tracking
- Purchase Orders + GRN flow
- Online Orders (Storefront)
- WhatsApp notifications
- Users + roles (per business)

**What is MISSING (this is what you are building):**

The existing codebase has good features but was built without a formal platform architecture. It lacks:
1. A proper Platform Core layer (Rule Engine, Event Platform, Audit Platform, Document Platform, AI Platform, Notification Platform, Computation Lineage)
2. The Rule Engine — tax rates are currently hardcoded or stored informally
3. Formal double-entry General Ledger (journals, journal lines, chart of accounts)
4. The Outbox/Inbox event pattern (events are published ad-hoc, no guaranteed delivery)
5. Tenant-level Row Level Security (business isolation is app-layer only currently)
6. AI Platform foundation (no AI features exist yet)
7. TDS module (currently manual/informal)
8. GST filing module (computation exists in parts but no formal GSTR pipeline)
9. Income Tax / Advance Tax computation
10. CA Command Center

---

## THE ARCHITECTURAL DECISIONS (Non-Negotiable)

These have been decided through 10 review documents. Do NOT re-litigate. Reference the ADR if challenged.

**Read these files for full context (in this order):**
1. `docs/FOUNDATION_STANDARDS.md` — 15 architectural invariants, tenancy model, naming
2. `docs/MASTER_PLAN.md` — Phase 0 through Phase 6 build order, feature-ready matrix
3. `docs/RED_TEAM_REVIEW.md` — What the red team found; blockers already resolved
4. `docs/ENTERPRISE_EXCELLENCE_REVIEW.md` — Compliance gates, digital twins, observability
5. `docs/ENTERPRISE_PLATFORM_MATURITY_REVIEW.md` — Data governance, economics, 30-year plan
6. `docs/ENTERPRISE_OPERATING_MODEL_REVIEW.md` — Org model, AI governance, incident command

**The 31 ADRs (summarised — full text in MASTER_PLAN.md):**
```
ADR-0001  PostgreSQL 16 as primary database (RLS, pgvector, pg_trgm)
ADR-0002  UUID v7 (time-ordered) for all NEW primary keys
ADR-0003  Modular Monolith until scale justifies otherwise
ADR-0004  BullMQ + Redis for queues (not Kafka)
ADR-0005  Prisma ORM (no raw SQL, no TypeORM)
ADR-0006  Rule Engine for ALL tax rates and thresholds (no hardcoding ever)
ADR-0007  Provider Pattern for ALL external services
ADR-0008  OutboxEvent pattern (not direct event publishing)
ADR-0009  Decimal(19,4) for ALL financial amounts
ADR-0010  DDD Bounded Contexts — no cross-module imports
ADR-0011  pgvector for AI embeddings (dimension 384, nomic-embed-text)
ADR-0012  Ollama local models first, cloud AI as fallback
ADR-0013  Domain Clock interface — no new Date() in domain code
ADR-0014  Append-only AuditLog with DB-level triggers (no UPDATE/DELETE)
ADR-0015  Document Platform — no documentUrl TEXT columns anywhere
ADR-0016  Number Series atomic PG function (no gaps, no duplicates)
ADR-0017  Monthly partitioned tables for AuditLog and AiCallLog
ADR-0018  Row Level Security on every business data table
ADR-0019  Business Glossary as first-class artifact
ADR-0020  Data classification on every DB column
ADR-0021  Customer data portability — export before first paying customer
ADR-0022  SBOM generation in CI pipeline
ADR-0023  Trust Recovery Protocol documented before Phase 1 ships
ADR-0024  GEM portal registration before Phase 2 marketing
ADR-0025  Crypto-erase as standard data purge method
ADR-0026  Shadow Architect role — always filled
ADR-0027  Integration Quirks Database — first-class artifact
ADR-0028  Bus Factor Drill quarterly
ADR-0029  Governance Board decisions documented within 48 hours
ADR-0030  CA Advisory Council input required for all compliance changes
ADR-0031  AI collaboration category tagged at build time (Categories 1-5)
```

---

## THE 15 NON-NEGOTIABLES

These apply to ALL NEW CODE. Existing code is exempt until it is refactored.
Any PR that violates these is blocked:

```
1.  EVERY new table has businessId (or has documented justification for being platform-level)
2.  EVERY financial amount is Decimal(19,4) — never float, never Int
3.  EVERY tax rate, threshold, form name is in the Rule Engine — never in application code
4.  EVERY document reference is a Document.id FK — no documentUrl TEXT fields
5.  EVERY domain event goes through OutboxEvent in the SAME DB transaction
6.  EVERY AI response carries a confidence score + source citation
7.  EVERY mutation endpoint is idempotent (same request twice = same result)
8.  EVERY posted Journal is immutable — corrections via reversal journal only
9.  EVERY sensitive field (PAN, Aadhaar, bank account number) is column-encrypted
10. EVERY external dependency is behind a typed Provider interface
11. NO new Date() in domain code — use the injectable DomainClock
12. NO cross-module imports in application code — bounded context boundaries enforced
13. NO raw SQL in application code — Prisma or typed query builders only
14. NO feature without a reversal path (every action has application-level undo)
15. NO AI agent takes irreversible financial action without human confirmation
```

---

## WHAT PHASE 0 BUILDS

Phase 0 is the **Platform Core layer**. It is ADDITIVE — it adds new tables, new modules, and new interfaces alongside the existing codebase without modifying existing production code.

Duration: 6–8 weeks.
Outcome: Every Phase 1 module has a stable, tested foundation to build on.

**The 11 Phase 0 components (P0.1 through P0.11):**

```
P0.1   Tenant & Identity Foundation (formal Tenant table + RLS pattern)
P0.2   Audit Platform (append-only AuditLog, triggers, NestJS interceptor)
P0.3   Event Platform (OutboxEvent + InboxEvent + EventRegistry + Outbox processor)
P0.4   Rule Engine (RuleAuthority + RuleSet + Rule + evaluate() + evaluateAt())
P0.5   Document Platform (Document table + storage abstraction + hash verification)
P0.6   Notification Platform (interface + Email + SMS/WhatsApp stub adapters)
P0.7   AI Platform Foundation (AiProvider interface + OllamaProvider + AiCallLog + KnowledgeChunk)
P0.8   General Ledger Foundation (AccountGroup + Account + FiscalPeriod + Journal + JournalLine)
P0.9   Number Series Engine (NumberSeries table + atomic next_number() PG function)
P0.10  Configuration Engine (BusinessConfig table with all feature-ready stubs)
P0.11  Computation Lineage Engine (ComputationJob table)
```

**Full SQL DDL and TypeScript interfaces for all P0 components are in:**
`docs/MASTER_PLAN.md` — Sections P0.1 through P0.11 (lines ~170 to ~820)

---

## HOW THE PLATFORM LAYERS WORK

```
┌──────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                      │
│  Next.js App | Mobile PWA | Public APIs | Partner APIs        │
└─────────────────────────────┬────────────────────────────────┘
                              │ (BFF Pattern per client type)
┌─────────────────────────────▼────────────────────────────────┐
│                       APPLICATION LAYER                        │
│  NestJS Command Handlers | Query Handlers | Event Handlers    │
│  Saga Orchestrators | Scheduled Jobs                          │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                         DOMAIN LAYER                           │
│  Aggregates | Entities | Value Objects | Domain Events        │
│  Domain Services | Repository Interfaces (not implementations)│
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                      PLATFORM CORE LAYER  ← YOU ARE BUILDING │
│  Rule Engine | Event Platform | Document Platform             │
│  AI Platform | Audit Platform | Notification Platform         │
│  Number Series | Config Engine | Computation Lineage          │
│  General Ledger Foundation                                    │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                       │
│  Prisma Repositories | Redis | BullMQ | MinIO Adapters        │
│  Provider Adapters (AI/OCR/Email/SMS/Payment/Storage)         │
│  External API Adapters (GSTN/TRACES/ERI/DigiLocker/AA)       │
└─────────────────────────────┬────────────────────────────────┘
                              │
┌─────────────────────────────▼────────────────────────────────┐
│                   DATA & INFRASTRUCTURE                        │
│  PostgreSQL 16 (port 5555) | pgvector | Redis | BullMQ       │
└──────────────────────────────────────────────────────────────┘
```

**Critical rules:**
- Domain Layer has ZERO knowledge of Infrastructure Layer
- Platform Core has ZERO knowledge of business modules (e.g. GST module must NOT be imported into Rule Engine)
- Every external system (GSTN, Razorpay, WhatsApp) is accessed ONLY through a typed Adapter

---

## THE EXISTING PRISMA MODEL TO UNDERSTAND

The existing `Business` model is the current tenant model. It has GSTIN, PAN, TAN, etc.

**The new `Tenant` table (from MASTER_PLAN.md P0.1) is a SEPARATE table** — it is the formal multi-tenancy foundation. In Phase 0, the `Tenant` table is linked to the existing `Business` table via a `businessId` field. Do NOT rename or replace the `Business` model — too much existing code depends on it. Instead:

```
Tenant (new, Phase 0)  →  1:1  →  Business (existing)
                              ↓
                         All existing tables continue referencing Business.id
```

New tables built in Phase 0+ reference `businessId` which points to `Business.id` (not Tenant.id, until a migration in Phase 3 consolidates them).

This is the pragmatic approach for an existing live codebase. It preserves all existing functionality while establishing the correct architecture for new code.

---

## DATABASE CONNECTION

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5555/svn_pos?schema=public
```

Port is **5555**, NOT the standard 5432. Native PostgreSQL was already running on 5432 so Docker runs on 5555.

When adding PgBouncer connection pooling in Phase 3, the URL becomes:
```
DATABASE_URL=...5555/svn_pos?pgbouncer=true&connect_timeout=10&statement_cache_size=0
```

---

## FOLDER STRUCTURE FOR NEW PLATFORM CODE

Create the Platform Core layer in a new folder structure. Do NOT mix with existing business modules:

```
backend/src/
  platform/                ← NEW: All Phase 0 platform components
    audit/
      audit.module.ts
      audit.service.ts
      audit.interceptor.ts   ← wraps every mutation automatically
      dto/
    events/
      events.module.ts
      outbox.service.ts      ← writes to OutboxEvent in same transaction
      inbox.service.ts       ← idempotent consumption
      outbox.processor.ts    ← BullMQ worker: polls PENDING → publishes
      event-registry.ts      ← all event type constants
      interfaces/
        domain-event.interface.ts
    rule-engine/
      rule-engine.module.ts
      rule-engine.service.ts
      rule-engine.interface.ts
      dto/
    documents/
      documents.module.ts
      documents.service.ts
      storage.provider.interface.ts
      providers/
        minio.provider.ts
        local.provider.ts    ← for dev/test
    notifications/
      notifications.module.ts
      notification.provider.interface.ts
      providers/
        email.provider.ts
        sms.provider.ts      ← stub
        whatsapp.provider.ts ← stub (existing WA module is ad-hoc, this replaces it)
        push.provider.ts     ← stub
    ai/
      ai.module.ts
      ai.provider.interface.ts
      providers/
        ollama.provider.ts
        anthropic.provider.ts ← stub
      ai-call-log.service.ts
      ai-correction.service.ts
      knowledge.service.ts    ← RAG over KnowledgeChunk
    ledger/
      ledger.module.ts
      chart-of-accounts.service.ts
      journal.service.ts
      fiscal-period.service.ts
      dto/
    number-series/
      number-series.module.ts
      number-series.service.ts
    config/
      business-config.module.ts
      business-config.service.ts
    computation/
      computation.module.ts
      computation.service.ts
    clock/
      clock.interface.ts      ← DomainClock interface
      real-clock.service.ts
      test-clock.service.ts   ← for deterministic tests

  (existing modules remain unchanged)
  auth/
  business/
  customers/
  inventory/
  pos/
  suppliers/
  ...etc
```

---

## FIRST THREE TASKS TO START

### TASK 1: Set Up the Platform Module Structure

Create the folder structure above. Create empty module files with proper NestJS `@Module()` decorators. Register all new platform modules in `AppModule` but with no business logic yet.

**Goal:** The app still compiles and starts. `npm run start:dev` works. No existing test breaks.

### TASK 2: Add Phase 0 Tables to Prisma Schema

Add the following models to `backend/prisma/schema.prisma`:

From MASTER_PLAN.md, add these Prisma models (translate the SQL DDL into Prisma syntax):
- `AuditLog` (partitioned — use `@@map("AuditLog")`, note partitioning must be done via raw SQL migration)
- `OutboxEvent`
- `InboxEvent`
- `RuleAuthority`, `RuleSet`, `Rule`, `BusinessRuleOverride`
- `Document`
- `AiCallLog`, `AiCorrection`, `KnowledgeChunk`
- `AccountGroup`, `Account`, `FiscalPeriod`, `Journal`, `JournalLine`
- `NumberSeries`
- `BusinessConfig`
- `ComputationJob`

**Prisma rules for these models:**
- All IDs: `id String @id @default(cuid())` for compatibility with existing models (UUID v7 to be introduced when Prisma adds native support, or via a custom generator)
- All financial amounts: `Decimal` type (maps to `DECIMAL(19,4)`)
- Add `businessId String` referencing `Business.id` on all business-scoped tables
- Add `@@index([businessId])` and `@@index([businessId, createdAt])` on large tables

After adding models, run:
```bash
cd backend
npx prisma migrate dev --name "phase-0-platform-core"
```

**Watch out:** The migration must NOT modify any existing tables. It only adds new tables.

### TASK 3: Implement the Rule Engine (Highest Priority)

The Rule Engine is the most critical P0 component because everything in Phase 1 (GST computation, TDS computation, advance tax) depends on it.

**What to build:**
```typescript
// backend/src/platform/rule-engine/rule-engine.interface.ts
export interface RuleContext {
  businessId: string;
  ruleSetCode: string;       // e.g., 'TDS_SECTION_194J'
  inputs: Record<string, unknown>;  // e.g., { amount: 55000, vendorType: 'PROFESSIONAL' }
  asOf?: Date;               // if null, uses today
}

export interface RuleResult {
  ruleSetCode: string;
  firedRules: FiredRule[];
  output: Record<string, unknown>;  // e.g., { rate: 0.10, tdsAmount: 5500 }
  explanation: string;              // human-readable: "194J rate 10% on ₹55,000"
  confidence: number;               // 0.0-1.0 (1.0 for deterministic tax rules)
  computedAt: Date;
  ruleSnapshotVersion: string;
}

export interface RuleEngineService {
  evaluate(context: RuleContext): Promise<RuleResult>;
  evaluateAt(context: RuleContext, asOf: Date): Promise<RuleResult>;
  explain(result: RuleResult): string;  // plain language explanation
}
```

**Then seed the Rule Engine** with all current Indian tax rules. These are the FOUNDING seed data:

```typescript
// backend/src/platform/rule-engine/seeds/india-tax-rules.seed.ts

const INDIA_TDS_RULES = [
  // Section 194J: Professional/Technical Services
  {
    ruleSetCode: 'TDS_SECTION_194J',
    category: 'TDS',
    effectiveFrom: '2021-04-01',  // reduced rate from FY 2021-22
    sourceAct: 'Income Tax Act 1961 amended by Finance Act 2020',
    sourceSection: 'Section 194J',
    rules: [
      // Technical services: 2%
      { condition: { vendorServiceType: 'TECHNICAL' }, effect: { rate: 0.02 }, priority: 1 },
      // Professional services (CA, Doctor, Lawyer, etc.): 10%
      { condition: { vendorServiceType: 'PROFESSIONAL' }, effect: { rate: 0.10 }, priority: 2 },
      // Royalty: 10%
      { condition: { vendorServiceType: 'ROYALTY' }, effect: { rate: 0.10 }, priority: 3 },
      // Threshold: ₹50,000/year after Budget 2025 (was ₹30,000)
      { condition: { cumulativeAmount: { op: 'lt', value: 50000 } }, effect: { rate: 0, exempt: true }, priority: 0 },
    ]
  },

  // Section 194C: Contractor
  {
    ruleSetCode: 'TDS_SECTION_194C',
    category: 'TDS',
    effectiveFrom: '2010-04-01',
    sourceAct: 'Income Tax Act 1961',
    sourceSection: 'Section 194C',
    rules: [
      // Individual/HUF: 1%
      { condition: { vendorEntityType: 'INDIVIDUAL' }, effect: { rate: 0.01 }, priority: 1 },
      { condition: { vendorEntityType: 'HUF' }, effect: { rate: 0.01 }, priority: 2 },
      // Others (Company, LLP, etc.): 2%
      { condition: {}, effect: { rate: 0.02 }, priority: 10 },
      // Single payment threshold: ₹30,000
      { condition: { singleAmount: { op: 'lt', value: 30000 }, cumulativeAmount: { op: 'lt', value: 100000 } }, effect: { rate: 0, exempt: true }, priority: 0 },
    ]
  },

  // Section 194I: Rent
  {
    ruleSetCode: 'TDS_SECTION_194I',
    category: 'TDS',
    effectiveFrom: '2010-04-01',
    sourceAct: 'Income Tax Act 1961',
    sourceSection: 'Section 194I',
    rules: [
      // Plant, Machinery, Equipment: 2%
      { condition: { assetType: 'PLANT_MACHINERY' }, effect: { rate: 0.02 }, priority: 1 },
      // Land, Building, Furniture: 10%
      { condition: { assetType: 'LAND_BUILDING' }, effect: { rate: 0.10 }, priority: 2 },
      { condition: { assetType: 'FURNITURE' }, effect: { rate: 0.10 }, priority: 3 },
      // Threshold: ₹2,40,000/year (₹20,000/month)
      { condition: { cumulativeAmount: { op: 'lt', value: 240000 } }, effect: { rate: 0, exempt: true }, priority: 0 },
    ]
  },

  // GST Rates (standard Indian GST slabs)
  {
    ruleSetCode: 'GST_RATE_STANDARD',
    category: 'GST',
    effectiveFrom: '2017-07-01',
    sourceAct: 'CGST Act 2017',
    sourceSection: 'Schedule I-V',
    rules: [
      { condition: { gstSlab: 'EXEMPT' }, effect: { cgst: 0, sgst: 0, igst: 0 }, priority: 1 },
      { condition: { gstSlab: 'ZERO' }, effect: { cgst: 0, sgst: 0, igst: 0 }, priority: 2 },
      { condition: { gstSlab: '5' }, effect: { cgst: 0.025, sgst: 0.025, igst: 0.05 }, priority: 3 },
      { condition: { gstSlab: '12' }, effect: { cgst: 0.06, sgst: 0.06, igst: 0.12 }, priority: 4 },
      { condition: { gstSlab: '18' }, effect: { cgst: 0.09, sgst: 0.09, igst: 0.18 }, priority: 5 },
      { condition: { gstSlab: '28' }, effect: { cgst: 0.14, sgst: 0.14, igst: 0.28 }, priority: 6 },
    ]
  },

  // Advance Tax: New Tax Regime (IT Act 2025 format)
  {
    ruleSetCode: 'ADVANCE_TAX_NEW_REGIME',
    category: 'ADVANCE_TAX',
    effectiveFrom: '2024-04-01',
    sourceAct: 'Income Tax Act 1961 amended by Finance Act 2024',
    sourceSection: 'Section 207-209',
    rules: [
      // Q1 (by 15 June): 15% of estimated annual tax
      { condition: { quarter: 'Q1' }, effect: { percentage: 0.15, dueDay: 15, dueMonth: 6 }, priority: 1 },
      // Q2 (by 15 Sep): 45% cumulative
      { condition: { quarter: 'Q2' }, effect: { percentage: 0.45, dueDay: 15, dueMonth: 9 }, priority: 2 },
      // Q3 (by 15 Dec): 75% cumulative
      { condition: { quarter: 'Q3' }, effect: { percentage: 0.75, dueDay: 15, dueMonth: 12 }, priority: 3 },
      // Q4 (by 15 Mar): 100% cumulative
      { condition: { quarter: 'Q4' }, effect: { percentage: 1.00, dueDay: 15, dueMonth: 3 }, priority: 4 },
    ]
  },

  // Income Tax Slabs: New Regime FY 2025-26 (AY 2026-27)
  // Finance Act 2025 revised slabs
  {
    ruleSetCode: 'INCOME_TAX_NEW_REGIME_2025_26',
    category: 'INCOME_TAX',
    effectiveFrom: '2025-04-01',
    effectiveTo: null,
    sourceAct: 'Finance Act 2025',
    sourceSection: 'Section 115BAC',
    rules: [
      { condition: { income: { op: 'lte', value: 400000 } }, effect: { rate: 0 }, priority: 1 },
      { condition: { income: { from: 400001, to: 800000 } }, effect: { rate: 0.05 }, priority: 2 },
      { condition: { income: { from: 800001, to: 1200000 } }, effect: { rate: 0.10 }, priority: 3 },
      { condition: { income: { from: 1200001, to: 1600000 } }, effect: { rate: 0.15 }, priority: 4 },
      { condition: { income: { from: 1600001, to: 2000000 } }, effect: { rate: 0.20 }, priority: 5 },
      { condition: { income: { from: 2000001, to: 2400000 } }, effect: { rate: 0.25 }, priority: 6 },
      { condition: { income: { op: 'gt', value: 2400000 } }, effect: { rate: 0.30 }, priority: 7 },
      // Rebate: tax nil if income <= ₹12,00,000 (Section 87A, Finance Act 2025)
      { condition: { income: { op: 'lte', value: 1200000 } }, effect: { rebate: true, maxRebate: 60000 }, priority: 0 },
      // Standard deduction: ₹75,000 for salaried
      { condition: { incomeType: 'SALARY' }, effect: { standardDeduction: 75000 }, priority: 0 },
    ]
  },

  // MSME 43B(h) Payment Obligation
  {
    ruleSetCode: 'MSME_PAYMENT_43BH',
    category: 'COMPLIANCE',
    effectiveFrom: '2023-04-01',
    sourceAct: 'Income Tax Act 1961 amended by Finance Act 2023',
    sourceSection: 'Section 43B(h)',
    rules: [
      // MSME Micro/Small: must pay within 45 days (or agreed credit period whichever is less)
      { condition: { msmeCategory: 'MICRO' }, effect: { maxPaymentDays: 45 }, priority: 1 },
      { condition: { msmeCategory: 'SMALL' }, effect: { maxPaymentDays: 45 }, priority: 2 },
      // Medium MSME: 45 days
      { condition: { msmeCategory: 'MEDIUM' }, effect: { maxPaymentDays: 45 }, priority: 3 },
    ]
  },

  // Section 40A(3): Cash payment disallowance
  {
    ruleSetCode: 'CASH_PAYMENT_40A3',
    category: 'COMPLIANCE',
    effectiveFrom: '2017-04-01',
    sourceAct: 'Income Tax Act 1961',
    sourceSection: 'Section 40A(3)',
    rules: [
      // Cash payment above ₹10,000 in single day to single person: not deductible
      { condition: { paymentMode: 'CASH', singleDayAmount: { op: 'gt', value: 10000 } }, effect: { disallowed: true, reason: 'Cash payment exceeds ₹10,000 — Section 40A(3) disallowance' }, priority: 1 },
      // Transport contractors: ₹35,000 limit
      { condition: { paymentMode: 'CASH', vendorType: 'TRANSPORT', singleDayAmount: { op: 'gt', value: 35000 } }, effect: { disallowed: true, reason: 'Cash transport payment exceeds ₹35,000 — Section 40A(3) disallowance' }, priority: 2 },
    ]
  },
];
```

**Run the seed:**
```bash
cd backend
npx ts-node src/platform/rule-engine/seeds/india-tax-rules.seed.ts
```

---

## CRITICAL PATTERNS TO FOLLOW

### Pattern 1: All domain mutations must emit OutboxEvent

```typescript
// WRONG — event can be lost if service call fails
async createInvoice(dto: CreateInvoiceDto) {
  const invoice = await this.prisma.invoice.create({ data: dto });
  await this.eventBus.publish('erp.gst.invoice.created', invoice);  // ← WRONG
  return invoice;
}

// CORRECT — event is atomic with the DB write
async createInvoice(dto: CreateInvoiceDto) {
  return this.prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({ data: dto });
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'Invoice',
        aggregateId: invoice.id,
        eventType: 'erp.gst.invoice.created',
        payload: invoice,
        businessId: invoice.businessId,
        correlationId: this.clock.requestId(),
      }
    });
    return invoice;
  });
}
```

### Pattern 2: All tax computation through Rule Engine

```typescript
// WRONG — hardcoded rate
const tdsAmount = payment.amount * 0.10;  // ← BLOCKED by non-negotiable #3

// CORRECT — Rule Engine
const result = await this.ruleEngine.evaluate({
  businessId: payment.businessId,
  ruleSetCode: 'TDS_SECTION_194J',
  inputs: {
    amount: payment.amount,
    vendorServiceType: vendor.serviceType,
    cumulativeAmount: await this.getTdsYtd(vendor.id, businessId),
  },
});

const tdsAmount = result.output.tdsAmount;
// result.explanation = "TDS at 10% on ₹55,000 under Section 194J (professional services). Threshold ₹50,000 exceeded."
```

### Pattern 3: DomainClock instead of new Date()

```typescript
// WRONG
const postedAt = new Date();  // ← BLOCKED by non-negotiable #11

// CORRECT
@Injectable()
export class JournalService {
  constructor(private readonly clock: DomainClock) {}

  async postJournal(journalId: string) {
    const postedAt = this.clock.now();  // injectable, testable, mockable
    // ...
  }
}
```

### Pattern 4: Provider pattern for external services

```typescript
// WRONG
import OpenAI from 'openai';  // ← direct SDK import in domain code

// CORRECT
@Injectable()
export class TdsAiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,  // interface, not implementation
  ) {}

  async classifyVendor(description: string): Promise<TdsClassification> {
    const result = await this.ai.complete({
      prompt: `Classify this vendor for TDS purposes: "${description}"...`,
    });
    return result;
  }
}
```

### Pattern 5: Decimal for financial amounts

```typescript
// In Prisma schema
amount    Decimal  @db.Decimal(19, 4)

// In TypeScript — use Prisma's Decimal type, never number
import { Decimal } from '@prisma/client/runtime/library';

const amount = new Decimal('55000.00');
const tds = amount.mul(new Decimal('0.10'));  // exact: 5500.00
// NEVER: const tds = 55000 * 0.10;  ← floating point error risk
```

---

## PHASE 0 COMPLETION CHECKLIST

Do not proceed to Phase 1 until ALL of these are green:

```
□ P0.1  Tenant table created. RLS policy template tested (cross-tenant query returns 0 rows).
□ P0.1  UserBusinessMembership table created.
□ P0.2  AuditLog table with append-only triggers (direct SQL UPDATE/DELETE throws exception).
□ P0.2  AuditInterceptor wraps all POST/PUT/PATCH/DELETE endpoints automatically.
□ P0.3  OutboxEvent + InboxEvent tables created.
□ P0.3  Outbox processor polls PENDING events and publishes to BullMQ queue.
□ P0.3  EventRegistry has all event types defined as constants.
□ P0.4  Rule Engine: evaluate() works for TDS_SECTION_194J with test inputs.
□ P0.4  Rule Engine: evaluateAt() returns historical rate for date before 2021 (8% rate).
□ P0.4  Rule Engine seeded with all 8 rule sets listed in the seed file above.
□ P0.5  Document table created. File upload → storage → SHA-256 hash → DB record flow works.
□ P0.5  No documentUrl TEXT column exists anywhere in schema (fitness function confirms).
□ P0.6  Notification platform: EmailProvider sends test email. SMS/WhatsApp return stub success.
□ P0.7  AI platform: OllamaProvider.complete() returns a response (requires Ollama running locally).
□ P0.7  AiCallLog records every AI call with latency, tokens, confidence.
□ P0.8  AccountGroup + Account seeded with standard Indian Chart of Accounts.
□ P0.8  Journal posted → immutability trigger → subsequent UPDATE throws exception.
□ P0.8  Trial balance: sum(DEBIT journal lines) = sum(CREDIT journal lines) for any period.
□ P0.9  next_number() function: 100 concurrent calls → 100 unique numbers (no duplicates).
□ P0.10 BusinessConfig table created with all feature stubs defaulting to FALSE.
□ P0.11 ComputationJob table created.
□ ALL   Architecture fitness functions pass in CI:
          - No cross-module imports (dependency-cruiser)
          - No documentUrl TEXT columns (custom AST rule)
          - No hardcoded tax rates (grep for common patterns: 0.18, 0.05, 0.10 in computation)
          - No new Date() in src/platform/ or src/domain/
          - No financial amounts as number type (grep for : number in financial DTOs)
□ ALL   npm run build passes. npm run test passes. App starts on port 4001.
□ ALL   No existing API endpoint breaks (run existing E2E suite if present, or manual smoke test).
```

---

## WHAT NOT TO CHANGE

To protect production:

1. **Do NOT modify** any existing Prisma model (Business, Product, Supplier, Customer, PosSession, GRN, etc.)
2. **Do NOT rename** any existing table
3. **Do NOT change** any existing API endpoint URL or response shape
4. **Do NOT remove** any existing module from AppModule
5. **Do NOT change** port numbers (backend: 4001, frontend: 4000, PostgreSQL: 5555)
6. **Do NOT commit** `.env` or `.env.local` files (they contain production secrets)

---

## ENVIRONMENT & SECRETS (DO NOT COMMIT)

The `.env` file in `backend/` contains production secrets. Never expose or commit them.

Known environment variables that must be present:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5555/svn_pos
JWT_SECRET=<secret>
```

For Google Vision API (OCR), WhatsApp Business API keys: they are in `backend/.env` already.
Reference the memory file `C:\Users\SriKriations\.claude\projects\J--SVN-SVN-26\memory\project_srivani_secrets.md` for the full list of required env vars (do NOT print them, just know they exist).

For new Phase 0 environment variables you add (e.g., OLLAMA_BASE_URL, MINIO_ENDPOINT), add them to `.env.example` and document them in a comment. Never hardcode values.

---

## WHEN TO ASK FOR CLARIFICATION

Before asking the user anything, check these documents:
- `docs/MASTER_PLAN.md` for build decisions
- `docs/FOUNDATION_STANDARDS.md` for architectural invariants
- `docs/ENTERPRISE_OPERATING_MODEL_REVIEW.md` for org/process decisions
- `docs/RED_TEAM_REVIEW.md` for security decisions

Only ask if:
1. A technical implementation detail is genuinely ambiguous and has business consequences
2. A proposed change would modify an existing production table (always confirm)
3. You are about to do something irreversible (dropping a column, deleting a migration)

For most implementation choices (file names, method signatures, folder structures, test strategies): decide based on the NestJS and TypeScript best practices and the patterns already in the codebase. No need to ask.

---

## QUICK REFERENCE: NAMING CONVENTIONS

From `docs/FOUNDATION_STANDARDS.md`:

```
Modules:           PascalCase        GstModule, TdsModule, RuleEngineModule
Services:          PascalCase        RuleEngineService, OutboxService
Controllers:       PascalCase + Ctrl GstController
DTOs:              descriptive       CreateInvoiceDto, UpdateVendorDto
Event types:       dot-separated     erp.gst.invoice.created, platform.rule.updated
Table names:       PascalCase (Prisma) Journal, JournalLine, OutboxEvent
Column names:      camelCase (Prisma) businessId, createdAt, effectiveFrom
API routes:        kebab-case        /api/rule-engine/evaluate, /api/audit-log
Environment vars:  SCREAMING_SNAKE   DATABASE_URL, OLLAMA_BASE_URL
```

---

## FIRST COMMAND TO RUN

```bash
cd J:/SVN/SVN_26/backend
npm run start:dev
```

Confirm the existing app starts without errors. That is your baseline. Every change you make must preserve this baseline.

Then begin with **Task 1** (folder structure), then **Task 2** (Prisma schema), then **Task 3** (Rule Engine).

Good luck. Build Phase 0 as if you will regret every shortcut. Because you will.
