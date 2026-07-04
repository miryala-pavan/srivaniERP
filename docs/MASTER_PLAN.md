# Business Operating System — Master Build Plan
## The Constitution of the Platform

> **What this document is:**
> Every review in this project (Platform Architecture, CTO Review, Foundation Standards, Red Team,
> Human-Centric, Black Swan) tells you WHAT to build.
> This document tells you IN WHAT ORDER and HOW to build it so that nothing built in Phase 1
> ever blocks a capability in Phase 4.
>
> **The central principle:**
> FEATURE READY ≠ FEATURE BUILT
>
> Feature Ready means: the table has the column, the interface is defined, the event is named,
> the adapter is stubbed. The feature is not shipped. The platform is not blocked.
>
> Every Phase 0 decision echoes for 25 years. Get Phase 0 right.
> Every Phase 1 shortcut costs 10x in Phase 3. Know which shortcuts are acceptable.
>
> **Date:** July 2026

---

## THE STACK (Free-First, Scale-to-Paid)

This is the full technology decision before a single line of code is written.
Every decision is reversible. Every dependency is behind an interface.

```
RUNTIME & LANGUAGE
  Backend:         NestJS (Node.js / TypeScript)     — free, open source
  Frontend:        Next.js 14 (TypeScript)            — free, open source
  Mobile:          Next.js PWA → Capacitor            — free, open source
  Runtime:         Node.js 20 LTS                     — free, open source

DATABASE
  Primary DB:      PostgreSQL 16                      — free, open source
  Connection Pool: PgBouncer (transaction mode)       — free, open source
  ORM:             Prisma v5                          — free, open source (OSS license)
  Migrations:      Prisma Migrate                    — free
  Search:          pg_trgm + tsvector (built-in PG)  — free (no Elasticsearch needed at MVP)
  Vector Search:   pgvector extension                — free, open source

QUEUE & EVENTS
  Queue:           BullMQ + Redis (self-hosted)       — free, open source
  Broker (later):  Kafka (when multi-instance needed) — free (Apache license)

CACHE
  Cache:           Redis (self-hosted)                — free, open source
  CDN:             Cloudflare (free tier)             — free at start

STORAGE
  Primary:         Hetzner Object Storage (S3-compat) — low cost
  Alternative:     MinIO (self-hosted, S3-compat)    — free, open source
  Cold:            Backblaze B2                       — very low cost

AI / ML
  LLM (primary):  Ollama + local models (Llama 3.1)  — free, self-hosted
  LLM (cloud):    Anthropic Claude API                — billed per use, when needed
  OCR:            Tesseract (self-hosted)              — free, open source
  OCR (cloud):    Google Vision API                   — billed per use, for accuracy
  Embeddings:     Ollama nomic-embed-text              — free, self-hosted
  Vector DB:      pgvector (same PostgreSQL)          — free

NOTIFICATIONS
  Email:          Nodemailer + self-hosted SMTP       — free to start
  Email (scale):  Resend or Brevo                    — low cost
  SMS:            MSG91 or Fast2SMS                  — billed per use
  WhatsApp:       Meta Business API or Interakt       — billed per use
  Push:           web-push library                   — free

AUTHENTICATION
  Auth:           Passport.js + JWT (self-built)      — free, open source
  Passkeys:       SimpleWebAuthn                     — free, open source
  MFA:            TOTP (speakeasy library)            — free
  OAuth:          Passport-Google, Passport-GitHub    — free

MONITORING & OBSERVABILITY
  Metrics:        Prometheus (self-hosted)            — free, open source
  Visualization:  Grafana (self-hosted)               — free, open source (OSS)
  Logs:           Loki (self-hosted)                  — free, open source
  Traces:         Tempo (self-hosted)                 — free, open source
  APM:            OpenTelemetry (self-hosted)         — free, open source

DEVOPS
  Containers:     Docker + Docker Compose             — free
  Orchestration:  Docker Compose (Phase 0-2)         — free
                  Kubernetes (Phase 3+, when needed)  — free (k3s for self-hosted)
  CI/CD:          GitHub Actions                      — free (for public/small private)
  IaC:            Ansible (self-hosted VPS config)    — free, open source
  Secrets:        HashiCorp Vault (self-hosted)       — free, open source (BSL license)

TESTING
  Unit:           Jest + ts-jest                     — free
  Integration:    Jest + testcontainers-node          — free
  E2E:            Playwright                          — free, open source
  Load:           k6 (self-hosted)                   — free, open source

DEVELOPER TOOLS
  Lint:           ESLint + typescript-eslint          — free
  Format:         Prettier                            — free
  API Docs:       Swagger / OpenAPI                   — free
  Architecture:   Dependency-Cruiser (fitness fns)    — free, open source
```

**Provider Change Cost:** Any provider above can be replaced by swapping one adapter file.
Zero business logic changes. This is the architecture guarantee.

---

## THE PLATFORM LAYERS

Before phases, understand the permanent structure:

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
│  Next.js Web App │ Mobile PWA │ Public APIs │ Partner APIs       │
│  Embedded Widgets │ WhatsApp Flows │ Voice │ Agent Interfaces    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ (BFF Pattern per client type)
┌──────────────────────────────▼──────────────────────────────────┐
│                          APPLICATION LAYER                       │
│  Command Handlers │ Query Handlers │ Saga Orchestrators          │
│  Process Managers │ Event Handlers │ Scheduled Jobs              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                           DOMAIN LAYER                           │
│  Aggregates │ Entities │ Value Objects │ Domain Events           │
│  Specifications │ Policies │ Domain Services │ Repositories(i)   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                        PLATFORM CORE LAYER                       │
│  Rule Engine │ Workflow Engine │ Event Platform │ Document Store │
│  Identity │ Notification │ AI Platform │ Audit Platform         │
│  Calculation Engine │ Formula Engine │ State Machine             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                       │
│  Prisma Repositories │ BullMQ Adapters │ Redis Cache Adapters   │
│  Provider Adapters (AI/OCR/Email/SMS/Payment/Storage/Auth)       │
│  External API Adapters (GSTN/TRACES/ERI/DigiLocker/AA/UPI)      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                      DATA & INFRASTRUCTURE                       │
│  PostgreSQL 16 │ pgvector │ PgBouncer │ Redis │ MinIO/Hetzner   │
│  BullMQ Queues │ Prometheus │ Grafana │ Loki │ Tempo            │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** Domain Layer has zero knowledge of Infrastructure Layer.
**Rule:** Platform Core Layer has zero knowledge of business modules.
**Rule:** Every external system is accessed through an Adapter, never directly.

---

## PHASE 0 — THE FOUNDATION
### Duration: 6–8 weeks | Priority: BLOCKING everything else

Phase 0 is not a product phase. No user sees Phase 0 output.
Phase 0 is the ground floor. Everything that follows stands on it.
A flaw in Phase 0 costs 10x to fix in Phase 2 and 100x in Phase 4.

---

### P0.1 — Tenant & Identity Foundation

**What to build:**

```sql
-- The Tenant is a Business. Every row of business data carries businessId.
-- This is not optional. This is the RLS enforcement point.

CREATE TABLE "Tenant" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "code"        TEXT NOT NULL UNIQUE,          -- human-readable: SRV001
  "displayName" TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "plan"        TEXT NOT NULL DEFAULT 'FREE',
  "country"     TEXT NOT NULL DEFAULT 'IN',
  "currency"    TEXT NOT NULL DEFAULT 'INR',
  "timezone"    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "locale"      TEXT NOT NULL DEFAULT 'en-IN',
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: Every table that belongs to a business must have this policy
ALTER TABLE "<BusinessTable>" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "<BusinessTable>"
  USING ("businessId" = current_setting('app.current_business_id')::UUID);

-- Session Context: set at the start of every request
SET LOCAL app.current_business_id = '<uuid>';
SET LOCAL app.current_user_id = '<uuid>';
SET LOCAL app.current_role = '<role>';
```

**User & Role tables:**
```sql
CREATE TABLE "User" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "email"       TEXT UNIQUE,
  "phone"       TEXT UNIQUE,
  "displayName" TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "UserBusinessMembership" (
  "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId"     UUID NOT NULL REFERENCES "User"("id"),
  "businessId" UUID NOT NULL REFERENCES "Tenant"("id"),
  "role"       TEXT NOT NULL,                   -- OWNER, ACCOUNTANT, CASHIER, CA, etc.
  "scopes"     TEXT[] NOT NULL DEFAULT '{}',    -- fine-grained permissions
  "branchId"   UUID,                            -- NULL = access to all branches
  "status"     TEXT NOT NULL DEFAULT 'ACTIVE',
  "joinedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId", "businessId")
);
```

**Feature-ready columns to add now (even if unused):**

```sql
-- On Tenant table: future-proof columns
"parentTenantId"     UUID,           -- for franchise/group company hierarchy
"legalEntityType"    TEXT,           -- PROPRIETORSHIP, PARTNERSHIP, LLP, PVT_LTD, etc.
"gstin"              TEXT,           -- future: auto-populated from GSTN API
"pan"                TEXT,           -- future: KYC verification
"udyamNumber"        TEXT,           -- MSME registration
"cinNumber"          TEXT,           -- MCA: Company Identification Number
"industryCode"       TEXT,           -- NIC code for industry classification
"employeeCount"      INTEGER,        -- plan tier and analytics
"annualRevenueBand"  TEXT,           -- for benchmarking
"onboardingStatus"   TEXT NOT NULL DEFAULT 'PENDING',
"healthScore"        DECIMAL(5,2),   -- business health score (computed)
"featureFlags"       JSONB NOT NULL DEFAULT '{}',  -- feature flag overrides
"integrations"       JSONB NOT NULL DEFAULT '{}',  -- which external systems connected
"aiConfig"           JSONB NOT NULL DEFAULT '{}',  -- AI preferences and budget
```

**Why now:** Once tenants have data, adding a column is a migration. Adding a column to an empty table is free.

---

### P0.2 — The Audit Platform

**This must exist before the first voucher is posted. Audit cannot be retrofitted.**

```sql
CREATE TABLE "AuditLog" (
  "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"   UUID,                          -- null = platform-level event
  "userId"       UUID,
  "sessionId"    TEXT,
  "ipAddress"    INET,
  "userAgent"    TEXT,
  "eventType"    TEXT NOT NULL,                 -- ENTITY_CREATED, ENTITY_UPDATED, etc.
  "entityType"   TEXT NOT NULL,                 -- e.g., "Journal", "Invoice"
  "entityId"     TEXT NOT NULL,
  "action"       TEXT NOT NULL,                 -- CREATE, UPDATE, DELETE, VIEW, EXPORT
  "before"       JSONB,                         -- state before change (null for CREATE)
  "after"        JSONB,                         -- state after change (null for DELETE)
  "diff"         JSONB,                         -- only changed fields
  "reason"       TEXT,                          -- required for sensitive changes
  "correlationId" TEXT,                         -- ties events in one request
  "causationId"   TEXT,                         -- which event caused this
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE ("createdAt");

-- CRITICAL: Audit log is append-only. These triggers prevent modification:
CREATE RULE audit_no_update AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING;

-- Partition by month:
CREATE TABLE "AuditLog_2026_07" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

**NestJS Audit Interceptor (wraps every mutation automatically):**
```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler) {
    const before = await this.captureState(context);
    const result = await firstValueFrom(next.handle());
    const after = await this.captureState(context);
    await this.auditService.log({ before, after, ...context });
    return result;
  }
}
```

---

### P0.3 — The Event Platform

**Every domain event flows through this. Cannot be added later without replaying all history.**

```sql
-- Outbox: events written in same DB transaction as the business change
CREATE TABLE "OutboxEvent" (
  "id"            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"    UUID,
  "aggregateType" TEXT NOT NULL,    -- e.g., "Invoice"
  "aggregateId"   TEXT NOT NULL,
  "eventType"     TEXT NOT NULL,    -- e.g., "erp.accounting.invoice.created"
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "payload"       JSONB NOT NULL,
  "metadata"      JSONB NOT NULL DEFAULT '{}',
  "correlationId" TEXT,
  "causationId"   TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING, PROCESSING, DELIVERED, FAILED
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "scheduledAt"   TIMESTAMPTZ,
  "processedAt"   TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inbox: idempotent consumption tracking
CREATE TABLE "InboxEvent" (
  "id"            UUID PRIMARY KEY,             -- same as OutboxEvent id
  "eventType"     TEXT NOT NULL,
  "consumerId"    TEXT NOT NULL,                -- which consumer is processing this
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "processedAt"   TIMESTAMPTZ,
  "error"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("id", "consumerId")
);
```

**Domain Event Envelope (TypeScript):**
```typescript
interface DomainEvent<T = unknown> {
  eventId:       string;          // UUID v7 (time-ordered)
  eventType:     string;          // erp.{module}.{aggregate}.{verb}
  schemaVersion: number;          // increment when payload shape changes
  aggregateType: string;
  aggregateId:   string;
  businessId:    string | null;   // null for platform events
  correlationId: string;          // trace through system
  causationId:   string;          // which command caused this
  occurredAt:    Date;            // when the fact occurred (not system time)
  payload:       T;
  metadata:      Record<string, unknown>;
}
```

**Event Registry (every event type must be registered):**
```typescript
// src/platform/events/event-registry.ts
export const EVENT_TYPES = {
  // Accounting domain
  'erp.accounting.journal.posted':           { schemaVersion: 1 },
  'erp.accounting.period.closed':            { schemaVersion: 1 },
  // Tax domain
  'erp.gst.invoice.created':                { schemaVersion: 1 },
  'erp.tax.tds.deducted':                   { schemaVersion: 1 },
  // Commerce domain
  'erp.pos.sale.completed':                 { schemaVersion: 1 },
  // Platform events (no businessId)
  'platform.tenant.created':               { schemaVersion: 1 },
  'platform.rule.updated':                 { schemaVersion: 1 },
} as const satisfies EventRegistry;
```

---

### P0.4 — The Rule Engine

**The most important platform decision. Every tax rate, threshold, and policy lives here.**

```sql
CREATE TABLE "RuleAuthority" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "code"        TEXT NOT NULL UNIQUE,    -- e.g., "INDIA_INCOME_TAX"
  "name"        TEXT NOT NULL,
  "country"     TEXT NOT NULL DEFAULT 'IN',
  "description" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE "RuleSet" (
  "id"              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "authorityId"     UUID NOT NULL REFERENCES "RuleAuthority"("id"),
  "code"            TEXT NOT NULL UNIQUE,   -- e.g., "TDS_SECTION_194J"
  "name"            TEXT NOT NULL,
  "category"        TEXT NOT NULL,          -- TDS | GST | ADVANCE_TAX | etc.
  "effectiveFrom"   DATE NOT NULL,
  "effectiveTo"     DATE,                   -- null = currently effective
  "sourceAct"       TEXT,                   -- "Finance Act 2025"
  "sourceSection"   TEXT,                   -- "Section 194J"
  "description"     TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "Rule" (
  "id"              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "ruleSetId"       UUID NOT NULL REFERENCES "RuleSet"("id"),
  "priority"        INTEGER NOT NULL DEFAULT 100,
  "conditionType"   TEXT NOT NULL,         -- AMOUNT_THRESHOLD | ENTITY_TYPE | DATE_RANGE | etc.
  "condition"       JSONB NOT NULL,        -- {"field": "amount", "op": "gte", "value": 50000}
  "effectType"      TEXT NOT NULL,         -- RATE | AMOUNT | FLAG | EXEMPT
  "effect"          JSONB NOT NULL,        -- {"rate": 0.10, "roundingRule": "ROUND_NEAREST"}
  "effectiveFrom"   DATE NOT NULL,
  "effectiveTo"     DATE,
  "notes"           TEXT
);

-- Feature-ready: Business-level rule overrides (for special categories, exemptions)
CREATE TABLE "BusinessRuleOverride" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"  UUID NOT NULL,
  "ruleSetId"   UUID NOT NULL REFERENCES "RuleSet"("id"),
  "reason"      TEXT NOT NULL,            -- mandatory: why is this override needed?
  "approvedBy"  TEXT,
  "overrideData" JSONB NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo"   DATE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Rule Engine Interface:**
```typescript
interface RuleEngine {
  evaluate(context: RuleContext): Promise<RuleResult>;
  evaluateAt(context: RuleContext, asOf: Date): Promise<RuleResult>;
  explain(result: RuleResult): RuleExplanation;
  // Returns: which rules fired, in what order, with what values
}

// INVARIANT: No module may import a tax rate directly.
// ALL tax computations go through RuleEngine.evaluate()
```

---

### P0.5 — The Document Platform

**Every document in the system (invoice PDF, bank statement, notice) flows through this.**

```sql
CREATE TABLE "Document" (
  "id"              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"      UUID NOT NULL,
  "type"            TEXT NOT NULL,    -- INVOICE | BANK_STATEMENT | NOTICE | WORKPAPER | etc.
  "subType"         TEXT,             -- for finer classification
  "sourceType"      TEXT NOT NULL,    -- UPLOAD | OCR_SCAN | SYSTEM_GENERATED | EXTERNAL_API
  "storageKey"      TEXT NOT NULL,    -- path in object storage (never expose directly)
  "mimeType"        TEXT NOT NULL,
  "fileName"        TEXT NOT NULL,
  "fileSizeBytes"   BIGINT NOT NULL,
  "sha256Hash"      TEXT NOT NULL,    -- integrity verification
  "storageClass"    TEXT NOT NULL DEFAULT 'HOT',  -- HOT | WARM | COLD | ARCHIVED
  "encryptionKeyId" TEXT,
  -- OCR Results
  "ocrStatus"       TEXT NOT NULL DEFAULT 'PENDING',
  "ocrProvider"     TEXT,
  "ocrConfidence"   DECIMAL(5,2),
  "extractedData"   JSONB,           -- structured data from OCR
  -- Linking
  "linkedEntityType" TEXT,           -- what this document is attached to
  "linkedEntityId"   TEXT,
  -- Metadata
  "tags"            TEXT[] NOT NULL DEFAULT '{}',
  "legalHold"       BOOLEAN NOT NULL DEFAULT FALSE,
  "retentionPolicy" TEXT NOT NULL DEFAULT 'STANDARD_7YEARS',
  "deletedAt"       TIMESTAMPTZ,     -- soft delete; hard delete only after retention period
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INVARIANT: No table may have a `documentUrl TEXT` column.
-- All document references must go through Document.id.
-- Violation caught by architecture fitness function.
```

---

### P0.6 — The Notification Platform

**Provider-agnostic from day one.**

```typescript
// src/platform/notifications/notification-provider.interface.ts
interface NotificationProvider {
  send(notification: Notification): Promise<NotificationResult>;
  getStatus(notificationId: string): Promise<NotificationStatus>;
}

// Available implementations:
//   EmailProvider (Nodemailer → later Resend/Brevo)
//   SmsProvider (Fast2SMS → later MSG91)
//   WhatsAppProvider (Meta Business API or Interakt)
//   PushProvider (web-push)
//   InAppProvider (WebSocket to frontend)

// Notification Router: selects provider based on user preference and availability
// If WhatsApp fails → fallback to SMS → fallback to email
// Never fail silently; always log notification attempt and result
```

---

### P0.7 — The AI Platform Foundation

**Provider-agnostic from day one. Local model first, cloud as fallback.**

```typescript
// src/platform/ai/ai-provider.interface.ts
interface AiProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
  embed(text: string): Promise<number[]>;
  classify(text: string, categories: string[]): Promise<ClassificationResult>;
}

// Implementations:
//   OllamaProvider (free, self-hosted, default)
//   AnthropicProvider (paid, when needed for accuracy)
//   OpenAiProvider (paid, fallback)

// AI Router: tries OllamaProvider first; escalates to cloud on failure or confidence < threshold
// All AI calls logged to AiCallLog table with: prompt, model, tokens, cost, latency, confidence
// Monthly AI cost report per business and per feature
```

```sql
-- Feature-ready tables for AI (define now, populate as AI features are built)
CREATE TABLE "AiCallLog" (
  "id"            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"    UUID,
  "userId"        UUID,
  "feature"       TEXT NOT NULL,         -- e.g., "TDS_CLASSIFICATION"
  "provider"      TEXT NOT NULL,
  "model"         TEXT NOT NULL,
  "promptTokens"  INTEGER,
  "outputTokens"  INTEGER,
  "costUsd"       DECIMAL(10,6),
  "latencyMs"     INTEGER,
  "confidence"    DECIMAL(5,2),
  "inputHash"     TEXT,                  -- for cache lookup
  "cachedResult"  BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE ("createdAt");

CREATE TABLE "AiCorrection" (
  "id"            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "callLogId"     UUID REFERENCES "AiCallLog"("id"),
  "businessId"    UUID NOT NULL,
  "correctedBy"   UUID NOT NULL,         -- userId
  "correctorRole" TEXT NOT NULL,         -- USER | CA | AUDITOR
  "originalValue" JSONB NOT NULL,
  "correctedValue" JSONB NOT NULL,
  "feature"       TEXT NOT NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "KnowledgeChunk" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "source"      TEXT NOT NULL,           -- RULE_ENGINE | FAQ | COMPLIANCE_DOC | etc.
  "sourceId"    TEXT,
  "content"     TEXT NOT NULL,
  "embedding"   vector(384),             -- pgvector; nomic-embed-text dimension
  "metadata"    JSONB NOT NULL DEFAULT '{}',
  "validFrom"   DATE,
  "validTo"     DATE,
  "language"    TEXT NOT NULL DEFAULT 'en',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON "KnowledgeChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
```

---

### P0.8 — The General Ledger Foundation

**BLOCKER: Nothing in accounting works without this. Must be defined before any financial module.**

```sql
CREATE TABLE "AccountGroup" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"  UUID NOT NULL,
  "code"        TEXT NOT NULL,           -- e.g., "1000"
  "name"        TEXT NOT NULL,           -- e.g., "Assets"
  "type"        TEXT NOT NULL,           -- ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
  "parentId"    UUID REFERENCES "AccountGroup"("id"),
  "isSystem"    BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  UNIQUE("businessId", "code")
);

CREATE TABLE "Account" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"  UUID NOT NULL,
  "groupId"     UUID NOT NULL REFERENCES "AccountGroup"("id"),
  "code"        TEXT NOT NULL,           -- e.g., "110001"
  "name"        TEXT NOT NULL,           -- e.g., "Trade Receivables — Domestic"
  "type"        TEXT NOT NULL,           -- mirrors parent group type
  "currency"    TEXT NOT NULL DEFAULT 'INR',
  "isSystem"    BOOLEAN NOT NULL DEFAULT FALSE,
  "isClosed"    BOOLEAN NOT NULL DEFAULT FALSE,
  "tags"        TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE("businessId", "code")
);

CREATE TABLE "FiscalPeriod" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"  UUID NOT NULL,
  "name"        TEXT NOT NULL,           -- e.g., "April 2026"
  "periodType"  TEXT NOT NULL DEFAULT 'MONTH',
  "startDate"   DATE NOT NULL,
  "endDate"     DATE NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'OPEN',  -- OPEN | CLOSED | LOCKED
  "closedBy"    UUID,
  "closedAt"    TIMESTAMPTZ
);

CREATE TABLE "Journal" (
  "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"   UUID NOT NULL,
  "periodId"     UUID NOT NULL REFERENCES "FiscalPeriod"("id"),
  "number"       TEXT NOT NULL,          -- JNL-2026-07-00001
  "type"         TEXT NOT NULL,          -- SALES | PURCHASE | PAYMENT | RECEIPT | JOURNAL | etc.
  "reference"    TEXT,
  "narration"    TEXT,
  "status"       TEXT NOT NULL DEFAULT 'DRAFT',  -- DRAFT | POSTED | CANCELLED
  "postedAt"     TIMESTAMPTZ,
  "postedBy"     UUID,
  "version"      INTEGER NOT NULL DEFAULT 1,    -- optimistic locking
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "JournalLine" (
  "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "journalId"    UUID NOT NULL REFERENCES "Journal"("id"),
  "accountId"    UUID NOT NULL REFERENCES "Account"("id"),
  "type"         TEXT NOT NULL,          -- DEBIT | CREDIT
  "amount"       DECIMAL(19,4) NOT NULL CHECK ("amount" > 0),
  "currency"     TEXT NOT NULL DEFAULT 'INR',
  "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1.0,
  "baseAmount"   DECIMAL(19,4) NOT NULL,  -- amount in INR always
  "taxCode"      TEXT,                   -- future: GST/TDS code
  "costCenter"   TEXT,                   -- future: department/branch allocation
  "projectCode"  TEXT,                   -- future: project accounting
  "sortOrder"    INTEGER NOT NULL DEFAULT 0
);

-- LEDGER INVARIANT: Posted journals are immutable.
-- Corrections via reversal journal + new journal only.
CREATE OR REPLACE FUNCTION prevent_posted_journal_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'POSTED' THEN
    RAISE EXCEPTION 'Posted journals cannot be modified. Create a reversal entry.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_journal_immutability
  BEFORE UPDATE OR DELETE ON "Journal"
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_modification();
```

---

### P0.9 — The Number Series Engine

**Every invoice number, journal number, PO number flows through this.**

```sql
CREATE TABLE "NumberSeries" (
  "id"            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"    UUID NOT NULL,
  "seriesCode"    TEXT NOT NULL,         -- SALES_INVOICE | PURCHASE | JOURNAL | etc.
  "prefix"        TEXT NOT NULL DEFAULT '',
  "suffix"        TEXT NOT NULL DEFAULT '',
  "currentNumber" BIGINT NOT NULL DEFAULT 0,
  "padLength"     INTEGER NOT NULL DEFAULT 5,
  "financialYear" TEXT,                  -- e.g., "2026-27" (null = perpetual)
  "resetOnFY"     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE("businessId", "seriesCode", "financialYear")
);

-- Atomic next-number: no gaps, no duplicates, even under concurrent inserts
CREATE OR REPLACE FUNCTION next_number(
  p_business_id UUID,
  p_series_code TEXT,
  p_financial_year TEXT
) RETURNS TEXT AS $$
DECLARE
  v_series "NumberSeries"%ROWTYPE;
  v_number BIGINT;
BEGIN
  SELECT * INTO v_series
  FROM "NumberSeries"
  WHERE "businessId" = p_business_id
    AND "seriesCode" = p_series_code
    AND "financialYear" = p_financial_year
  FOR UPDATE;  -- row-level lock guarantees no concurrent duplicates

  v_number := v_series."currentNumber" + 1;
  UPDATE "NumberSeries" SET "currentNumber" = v_number
  WHERE "id" = v_series."id";

  RETURN v_series."prefix"
      || LPAD(v_number::TEXT, v_series."padLength", '0')
      || v_series."suffix";
END;
$$ LANGUAGE plpgsql;
```

---

### P0.10 — The Configuration Engine

**Every business has its own settings. Features can be turned on/off per tenant.**

```sql
CREATE TABLE "BusinessConfig" (
  "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"  UUID NOT NULL UNIQUE,
  -- Financial Year
  "fyStartMonth"  INTEGER NOT NULL DEFAULT 4,  -- April = 4 (Indian FY)
  "fyStartDay"    INTEGER NOT NULL DEFAULT 1,
  -- Tax Registrations
  "isGstRegistered"   BOOLEAN NOT NULL DEFAULT FALSE,
  "gstin"             TEXT,
  "gstRegDate"        DATE,
  "gstScheme"         TEXT DEFAULT 'REGULAR',  -- REGULAR | COMPOSITION
  "isTdsDeductor"     BOOLEAN NOT NULL DEFAULT FALSE,
  "tan"               TEXT,
  "isAdvanceTaxPayer" BOOLEAN NOT NULL DEFAULT FALSE,
  -- Accounting
  "defaultCurrency"   TEXT NOT NULL DEFAULT 'INR',
  "roundingRule"      TEXT NOT NULL DEFAULT 'ROUND_NEAREST',
  -- Compliance
  "isAuditRequired"   BOOLEAN NOT NULL DEFAULT FALSE,
  "isMcaFiling"       BOOLEAN NOT NULL DEFAULT FALSE,
  -- AI
  "aiEnabled"         BOOLEAN NOT NULL DEFAULT TRUE,
  "aiMonthlyBudgetInr" DECIMAL(10,2) DEFAULT 500.00,
  -- Feature Flags
  "modules"           JSONB NOT NULL DEFAULT '{}',
  -- Future fields (stub now)
  "isPayrollEnabled"  BOOLEAN NOT NULL DEFAULT FALSE,
  "isHrmEnabled"      BOOLEAN NOT NULL DEFAULT FALSE,
  "isManufacturingEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "isMultiBranch"     BOOLEAN NOT NULL DEFAULT FALSE,
  "multiCurrencyEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### P0.11 — The Computation Lineage Engine

**Every computed value must be replayable and explainable.**

```sql
CREATE TABLE "ComputationJob" (
  "id"            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "businessId"    UUID NOT NULL,
  "jobType"       TEXT NOT NULL,         -- TDS_COMPUTATION | GST_LIABILITY | ADVANCE_TAX | etc.
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "inputSnapshot" JSONB NOT NULL,        -- ALL inputs at time of computation
  "ruleSnapshot"  JSONB NOT NULL,        -- ALL rule versions used
  "output"        JSONB,
  "error"         TEXT,
  "computedAt"    TIMESTAMPTZ,
  "computedByEngine" TEXT NOT NULL,      -- engine version
  "replayable"    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### P0 Checklist (Must be 100% before Phase 1 starts)

```
□ Tenant table with all feature-ready columns
□ User + UserBusinessMembership tables
□ RLS policy template in place and tested
□ Domain Clock implementation (injectable, no new Date() in domain)
□ UUID v7 generator configured globally
□ AuditLog table with append-only triggers
□ OutboxEvent + InboxEvent tables
□ Event types registry
□ Outbox processor job (polls PENDING events, publishes to BullMQ)
□ Rule Engine: RuleAuthority + RuleSet + Rule tables
□ Rule Engine: evaluate() and evaluateAt() implementations
□ Rule Engine: seeded with TDS rates, GST rates, advance tax bands
□ Document table (no documentUrl anywhere)
□ Notification platform: interface + Email adapter + stub SMS/WhatsApp adapters
□ AI platform: interface + OllamaProvider + stub AnthropicProvider
□ AiCallLog + AiCorrection + KnowledgeChunk tables
□ General Ledger: AccountGroup + Account + FiscalPeriod + Journal + JournalLine
□ Ledger immutability triggers
□ Chart of Accounts seeded (standard Indian CoA)
□ NumberSeries engine tested for concurrency (no duplicates under load)
□ BusinessConfig table with all feature stubs
□ ComputationJob table
□ BusinessRuleOverride table
□ FOUNDATION_STANDARDS.md ESLint rules active in CI
□ Architecture fitness functions running in CI:
    - no cross-module imports
    - no documentUrl TEXT columns
    - no hardcoded rates or thresholds
    - no new Date() in src/domain/
    - no any type
    - all financial amounts as Decimal
```

---

## PHASE 1 — ERP CORE (MVP)
### Duration: 8–10 weeks | Priority: Ship to real users

Phase 1 is the minimum viable ERP. A business can run entirely on Phase 1.
Phase 1 does NOT include AI, does NOT include IT module, does NOT include marketplace.
Phase 1 includes everything a small business needs to manage money, goods, and compliance.

---

### P1.1 — Chart of Accounts & Opening Balances

```
Build:
  Standard Indian CoA (pre-seeded per business on signup)
  Account CRUD (create custom accounts)
  Account Group hierarchy
  Opening balance entry (migration wizard)
  Trial Balance report (live, from journal lines)
  
Feature-ready:
  Multi-currency columns on Account (currency, exchangeRate)
  costCenter and projectCode on JournalLine (null for now)
  Consolidation flag on AccountGroup (for group companies later)
```

### P1.2 — Sales Module

```
Build:
  Customer master (with GSTIN, PAN, credit limit)
  Sales Invoice (with GST computation via Rule Engine)
  Credit Note
  Sales Receipt (payment against invoice)
  Customer ledger
  AR Aging report
  
Feature-ready:
  Customer table columns: loyaltyPoints, tier, segment, lifetimeValue
  Customer.isGstExempt (for future exempt supplies)
  Invoice.exportType (for future export invoices: EXPORT_WITH_IGST etc.)
  Invoice.eInvoiceIrn (for future e-invoice integration — column exists, null now)
  Invoice.eWayBillNumber (for future e-way bill)
  Invoice.b2bB2c (B2B | B2C | B2CL — needed for GSTR-1)
```

### P1.3 — Purchase Module

```
Build:
  Vendor master (with GSTIN, PAN, TDS category, MSME status)
  Purchase Invoice
  Debit Note
  Purchase Payment
  Vendor ledger
  AP Aging report
  Auto-TDS detection on payment (Rule Engine)
  
Feature-ready:
  Vendor.isRelatedParty (for Form 3CD disclosures)
  Vendor.creditRating (for future supplier risk)
  Vendor.udyamStatus (MSME verification)
  PurchaseInvoice.poReference (for future 3-way matching)
  PurchaseInvoice.grnReference (for future GRN-based matching)
```

### P1.4 — Inventory Module

```
Build:
  Product/PLU master
  Godown/Location master
  Stock receipt (linked to purchase)
  Stock issue (linked to sales)
  Stock transfer (inter-location)
  Stock valuation (FIFO — implemented via Rule Engine, method configurable)
  Current stock report
  
Feature-ready:
  Product.batchTracking (Pharma/FMCG: lot numbers)
  Product.serialTracking (Electronics: serial numbers)
  Product.shelfLife (Pharma: expiry tracking)
  Product.hsCode (Customs: HS code for export)
  Product.mrp (Retail: Maximum Retail Price)
  Product.isLoose (POS: weight-based sale)
  Location.locationType (GODOWN | FLOOR | SHELF | BIN — warehouse hierarchy)
```

### P1.5 — POS Module

```
Build:
  POS session (open/close)
  Sale transaction (barcode scan → add to cart → tender → receipt)
  Cash/UPI/card tender
  Receipt (SMS/WhatsApp/print)
  Day-end Z report
  
Feature-ready:
  POSSale.loyaltyPoints (earned/redeemed)
  POSSale.offlineId (created offline, synced when online)
  POSSale.tableNumber (for hospitality: table billing)
  POSSale.waiterCode (for hospitality)
  POSTender.cbdcAmount (Digital Rupee — column exists, null now)
```

### P1.6 — GST Module

```
Build:
  GSTIN validation (format check; API verification stub)
  GST rate master (seeded via Rule Engine)
  Input Tax Credit tracking
  GSTR-1 computation (from sales invoices)
  GSTR-3B computation (liability vs ITC)
  GST payment (challan entry)
  GST portal JSON export
  
Feature-ready:
  GstReturn.apiFilingStatus (for future GSTN API filing)
  GstReturn.evcOtp (for EVC filing method)
  GstReturn.arn (Acknowledgment Reference Number from portal)
  ItcLedger.itcCategoryType (ITC-1 / ITC-2 / ITC-3 — reversals)
```

### P1.7 — TDS Module

```
Build:
  TDS deduction (auto from Rule Engine on payment)
  TDS challan payment
  TDS ledger by section
  Form 26Q data (quarterly return data)
  Form 27Q data (NRI payments)
  26AS fetch placeholder (manual for now)
  
Feature-ready:
  TdsDeduction.ackNumber (from TRACES 2.0 when available)
  TdsReturn.filingMode (OFFLINE | TRACES_API)
  TdsReturn.provisionalReceipt (from NSDL)
```

### P1.8 — Bank & Cash Module

```
Build:
  Bank account master
  Bank payment entry
  Bank receipt entry
  Bank transfer
  Cash book
  Bank Reconciliation (manual statement upload → match suggestions → confirm)
  
Feature-ready:
  BankAccount.aaConsent (Account Aggregator consent status — stub)
  BankAccount.aaLinked (whether AA is connected)
  BankAccount.upiId (for UPI payments)
  BankStatement.importSource (MANUAL | PDF_PARSE | ACCOUNT_AGGREGATOR)
```

### P1.9 — Reports (Phase 1)

```
Build:
  Trial Balance
  Balance Sheet (from CoA + journal lines)
  Profit & Loss
  Cash Flow Statement
  Customer Ledger
  Vendor Ledger
  Stock Summary
  GST Summary
  TDS Summary
  
Feature-ready:
  All reports: export to PDF, Excel, CSV (PDF/Excel stubs initially)
  All reports: filter by branch (branchId parameter exists, single branch returns all)
  All reports: multi-company consolidation parameter (exists, returns single-company data)
  All reports: as-at-date parameter (queries use <= date filter on all reports)
```

### P1.10 — User Management & Permissions

```
Build:
  Role-based access: OWNER, ACCOUNTANT, CASHIER, MANAGER, VIEWER
  Fine-grained permissions per module
  Branch-scoped access
  Invitation flow (email invite → accept → join)
  
Feature-ready:
  UserBusinessMembership.delegatedAiCapabilities (for Agent delegation later)
  UserBusinessMembership.caLinkId (for CA cross-business access later)
  Permission scopes designed to extend to ABAC without restructuring
```

---

## PHASE 2 — COMPLIANCE & INTELLIGENCE
### Duration: 8–10 weeks | Priority: CA adoption + advance tax

Phase 2 turns the ERP into a compliance platform.
A CA firm can manage 50 client businesses from Phase 2.
The AI begins providing real value in Phase 2.

---

### P2.1 — Income Tax Module

```
Build:
  Business income computation (from GL data, Books Profit)
  Advance tax computation (by quarter, by regime)
  Advance tax challan entry
  Digital Twin: real-time income tax estimate on home screen
  Old regime vs new regime comparison
  
  Tax computation provenance: every number links to its source journal line.
  ComputationJob used for every ITR computation.
  
Feature-ready:
  ItComputation.itrFormType (ITR-1 | ITR-3 | ITR-5 | ITR-6)
  ItComputation.aiRegimeRecommendation (AI suggests optimal regime)
  ItComputation.eriFilingStatus (for future ERI integration)
```

### P2.2 — CA Command Center

```
Build:
  CaFirm + CaUser model
  CaBusinessLink: CA linked to N businesses
  Instant client switch (Ctrl+K)
  CA compliance calendar (all clients, all deadlines)
  Workpaper folder per client per AY (9-file structure)
  Document request system (CA requests → client uploads via link)
  Client Health Score (ComplianceStatus + DataQuality)
  
Feature-ready:
  CaWorkpaper.seniorReviewStatus (review hierarchy)
  CaWorkpaper.digitalSignature (CA DSC sign-off)
  CaWorkpaper.eriSubmissionId (for when ERI is live)
```

### P2.3 — Notice Management

```
Build:
  Notice upload (PDF → OCR extracts AY, section, demand amount)
  Notice response tracking (status: RECEIVED | UNDER_REVIEW | RESPONDED | CLOSED)
  Notice deadline tracking (response due date alert)
  AIS variance detection (where does AIS differ from books?)
  Notice AI assistant (explain this notice in plain language)
  
Feature-ready:
  Notice.facelessAssessmentStage (10-step faceless workflow)
  Notice.demandAmount (for Section 156 demand notices)
  Notice.appealStatus (for CIT(A) / ITAT filing later)
```

### P2.4 — Business Health Dashboard

```
Build:
  Business Health Score (4 dimensions: Financial, Compliance, Operational, Data Quality)
  Business Survival Score (cash runway, concentration risk, compliance stress)
  Compliance Timeline (all events, chronological, auditable)
  30-second pulse screen for owner (sales, profit, cash, alerts)
  AI Daily Briefing (WhatsApp summary at 7 AM)
  
Feature-ready:
  BusinessPulse.industryBenchmarks (will populate when anonymized aggregation is ready)
  BusinessPulse.forecastedRevenue (AI model — stub with linear extrapolation initially)
  BusinessPulse.fraudScore (continuous auditing — add anomaly rules incrementally)
```

### P2.5 — AI Tax Assistant

```
Build:
  RAG over Knowledge Chunks (Rule Engine + compliance docs + FAQ)
  Role-aware responses (owner gets plain language; CA gets section citations)
  TDS auto-classification (vendor payment type → correct TDS section)
  GL account auto-suggestion (expense description → CoA account)
  Bank statement auto-match (AI suggests which transactions match)
  
  All responses: confidence score. Below 0.7 → "Review recommended."
  All responses: source citation (which rule, which section)
  All corrections captured in AiCorrection table.
  
Feature-ready:
  AI prompt versioning (PromptVersion table — every prompt has a version)
  AI model registry (ModelRegistry — can switch model without code change)
  AI agent memory (AgentMemory table — context across sessions)
```

### P2.6 — Document Intelligence

```
Build:
  Invoice OCR (Tesseract self-hosted → Google Vision for accuracy when needed)
  Auto-populate purchase invoice from scanned/uploaded PDF
  Document hash verification (tamper detection)
  Document expiry tracking (license renewals, registration certificates)
  
Feature-ready:
  Document.ocrValidatedBy (human confirmation of OCR accuracy)
  Document.signatureValid (DSC signature verification)
  Document.digilockerVerified (DigiLocker-sourced documents)
```

---

## PHASE 3 — SCALE & ECOSYSTEM
### Duration: 10–12 weeks | Priority: 10K businesses, partner ecosystem

Phase 3 turns the product into a platform.
External developers and CA firms can build on top of Phase 3.

---

### P3.1 — Multi-Branch & Multi-Company

```
Build:
  Branch model (full implementation of branchId scoping)
  Branch-scoped permissions (Branch Manager sees only their branch)
  Inter-branch stock transfer with accounting
  Consolidated reporting (group P&L, group Balance Sheet)
  CIN-level company structure (holding company + subsidiaries)
  
Feature-ready:
  Branch.gstinOverride (for branches registered under different GSTIN)
  Company.consolidationMethod (FULL | PROPORTIONATE — for future IFRS)
```

### P3.2 — Plugin & Marketplace Architecture

```
Build:
  Plugin manifest schema (what a plugin declares)
  Plugin sandbox (isolated execution, resource limits)
  Plugin API (events, read API, command API)
  Developer portal (documentation + sandbox access)
  Marketplace UI (browse, install, uninstall plugins)
  Plugin billing (revenue share — 70/30 default)
  
Feature-ready:
  Plugin.certificationLevel (COMMUNITY | VERIFIED | CERTIFIED)
  Plugin.dataAccessScopes (exactly what data a plugin can read)
  Plugin.trustedExecutionEnvironment (for future confidential computing)
```

### P3.3 — Account Aggregator Integration

```
Build:
  AA consent flow (user authorizes bank data sharing)
  Bank statement auto-import (daily, from AA)
  Auto-reconciliation (AI matches AA transactions to journal entries)
  AA-sourced bank balance on pulse screen
  
This eliminates manual bank statement upload for AA-connected accounts.
```

### P3.4 — Horizontal Scaling & Performance

```
Build:
  Read replicas for reporting queries (all GET queries → replica)
  Query performance baseline (every slow query > 200ms investigated)
  Materialized views for expensive aggregations (Dashboard, Health Score)
  Background report generation (large reports are jobs, not synchronous HTTP)
  Streaming export (large exports streamed, not buffered in memory)
  
Feature-ready:
  Multi-region read replicas
  Database sharding strategy documented (by businessId range)
  Cache warming on deployment
```

### P3.5 — HRMS Foundation (Feature-Ready)

```
Feature-ready tables (no UI yet, tables exist):
  Employee (with PAN, Aadhaar, bank account, designation, department)
  Department + Designation
  EmployeeContract (CTC, salary structure, effective dates)
  LeavePolicy + LeaveBalance
  AttendanceRecord
  Payroll (monthly computation, Form 16 generation readiness)
  
Why now: Payroll TDS (192) affects existing TDS module.
         Employee PAN must link to existing PAN infrastructure.
         Not defining these tables now = migration pain later.
```

---

## PHASE 4 — VERTICALS
### Duration: 12+ weeks per vertical | Priority: After 10K businesses in core

Phase 4 is the vertical expansion. Each vertical is a set of bounded contexts
built on top of the Phase 0-3 platform. The platform never changes for a vertical.
Only new modules are added.

---

### P4.A — HRMS & Payroll (Full)

```
Build on top of P3.5 skeleton:
  Payroll computation (monthly, all deductions)
  Statutory compliance (PF, ESI, PT, LWF)
  Form 16 generation (linked to IT module)
  Leave management (apply, approve, carry forward)
  Expense reimbursement (photo-to-claim workflow)
  Employee self-service (mobile: payslip, leave, expense)
```

### P4.B — Manufacturing

```
New bounded contexts:
  Bill of Materials (BOM)
  Work Order
  Production Batch
  Quality Control
  Cost Sheet (materials + labour + overhead)
  Waste tracking
  
Uses existing:
  Inventory (raw material, WIP, finished goods — same module, new stock types)
  Journal entries (production cost → GL via Rule Engine)
  Document platform (quality certificates, inspection reports)
```

### P4.C — School ERP

```
New bounded contexts:
  Student (enrollment, grade, section, roll number)
  Academic Year + Term
  Fee Structure + Fee Collection
  Examination + Result
  Transport Route + Vehicle + Student-Route mapping
  Library Management
  
Uses existing:
  Accounting (fee collection → GL, teacher payroll → Payroll module)
  HR (teacher as Employee)
  Document platform (admit cards, marksheets, certificates)
  Notification platform (fee reminders, result SMS)
```

### P4.D — Healthcare / Clinic

```
New bounded contexts:
  Patient (with Aadhaar consent for eKYC, health ID — Abdm readiness)
  Appointment
  Prescription
  Lab Report
  IPD / OPD management
  Insurance Claim
  
Uses existing:
  Accounting (consulting fees, pharmacy billing → same GL)
  Inventory (pharmacy stock → same inventory module)
  Document platform (prescriptions, reports, consent forms)
  Notification (appointment reminders, report ready)
```

### P4.E — NGO

```
New bounded contexts:
  Donor management
  Grant management
  Project/Programme
  Fund accounting (donor-restricted vs unrestricted)
  FCRA compliance (foreign contribution tracking)
  Form 10B / 80G receipts
  
Uses existing:
  Accounting (fund accounting is a CoA configuration, not a new module)
  IT module (12A, 80G, Form 10B filings)
  Document platform (grant agreements, donor receipts)
```

---

## PHASE 5 — INTELLIGENCE PLATFORM
### Duration: Ongoing | Priority: After product-market fit per vertical

Phase 5 is the AI flywheel. This phase makes the ERP learn, predict, and recommend.
The infrastructure for this was laid in P0 (AiCallLog, AiCorrection, KnowledgeChunk).
Phase 5 activates it at scale.

---

### P5.1 — AI Agents (Per Role)

```
Each agent is a NestJS service with:
  Memory:       AgentMemory table (context persists across sessions)
  Knowledge:    KnowledgeChunk RAG (relevant context per query)
  Tools:        MCP tool registry (read data, compute, file)
  Permissions:  Agent capability scopes (cannot exceed user's permissions)
  Audit:        Every agent action logged to AgentActionLog
  Confidence:   Below threshold → human approval required
  
Agent Roster (Phase 5):
  OwnerAgent    — pulse, decisions, plain-language everything
  AccountantAgent — triage pending work, auto-classify, flag anomalies
  CaAgent       — client management, computation review, notice response
  GstAgent      — GSTR computation, ITC reconciliation, filing
  TdsAgent      — deduction detection, return compilation, TRACES
  InventoryAgent — reorder, dead stock, demand forecast
  AuditAgent    — continuous audit, exception detection, fraud indicators
```

### P5.2 — Predictive Intelligence

```
Build:
  Cash Flow Forecast (ML model on historical cash patterns)
  Revenue Forecast (trend + seasonality)
  Tax Forecast (income estimate → advance tax recommendation)
  Churn Prediction (customer health → renewal probability)
  Fraud Score (transaction anomaly detection)
  Inventory Demand Forecast (per SKU, per location)
  
All predictions:
  Confidence interval displayed (not just point estimate)
  Explanation required ("Revenue forecast is ₹12L because...")
  Feedback loop: user marks prediction as wrong → model improves
```

### P5.3 — Industry Intelligence (Anonymized Aggregation)

```
Build:
  Anonymous aggregation pipeline (no business data in aggregate)
  Industry benchmark computation (by NIC code, by revenue band)
  Peer comparison on Health Score
  "Businesses like yours that do X grow Y% faster"
  
Privacy guarantee:
  Aggregation only on cohorts of N >= 50 businesses
  No individual business identifiable from any aggregate
  Data minimization: only the computed metric, not the source data
  DPDP Act 2023 compliant data handling
```

---

## PHASE 6 — FUTURE PLATFORM
### Duration: 2030–2035 | Priority: When technologies are ready

---

### P6.1 — Agentic ERP (Autonomous Operations)

```
When ready:
  AI agents execute full workflows autonomously with human oversight
  "Pay all invoices due this week" → agent lists, proposes, user approves, agent pays
  "File GSTR-3B for June" → agent computes, prepares, user reviews, agent files
  "Reconcile July bank statement" → agent matches, proposes, user confirms
  
Requires:
  Delegation model (already designed in FOUNDATION_STANDARDS.md)
  Human-in-the-loop approval system
  Agent audit trail (every action reversible)
  Agent safety guardrails (cannot exceed budget limits, cannot delete)
```

### P6.2 — Voice-First Interface

```
When ready:
  "What were my sales today?" → spoken answer
  "Create a receipt for ₹5,000 from Priya" → ERP creates it
  "What's my GST due this month?" → spoken, WhatsApp, or in-app
  
Requires:
  Whisper (self-hosted STT) or cloud STT
  NLP intent extraction (can start with cloud LLM)
  Action confirmation before execution (always)
  Telugu + Hindi language support (India-specific requirement)
```

### P6.3 — Quantum-Safe Cryptography

```
When NIST PQC standards are adopted in India (expected 2028-2030):
  Swap CryptoProvider to CRYSTALS-Kyber (key encapsulation)
  Swap signature to CRYSTALS-Dilithium
  Re-encrypt all PAN, Aadhaar, bank account fields
  All this is possible because CryptoProvider is an interface (Phase 0 design)
  
Migration window: 2 years
Business disruption: zero (swap the adapter, run the migration job)
```

### P6.4 — CBDC / Digital Rupee Integration

```
When RBI mandates or enables:
  e-Rupee as a payment method (column already exists in P1)
  Programmable payments (condition-based payment via CBDC protocol)
  Offline payment acceptance
  Automatic tax reconciliation (GST payment via CBDC = GSTN auto-notified)
```

---

## THE FEATURE-READY MATRIX

This is the single most important table in this document.
It shows what is BUILT vs what is DESIGNED (schema + interface exists, no UI/logic).

```
CAPABILITY                    P0    P1    P2    P3    P4    P5    P6
─────────────────────────────────────────────────────────────────────
FOUNDATION
  Tenant isolation (RLS)     ✅
  Audit log                  ✅
  Domain events (Outbox)     ✅
  Rule Engine                ✅
  Document platform          ✅
  AI provider interface      ✅
  Notification interface     ✅
  General Ledger             ✅
  Number Series              ✅

ERP CORE
  Sales + GST                      ✅
  Purchases + TDS                  ✅
  Inventory                        ✅
  POS                              ✅
  Bank reconciliation              ✅
  Basic reports                    ✅
  User roles                       ✅
  Multi-branch schema        🔲    ✅  (schema ready P0; UI in P3)
  HR/Payroll schema          🔲         ✅
  Manufacturing schema       🔲              ✅

COMPLIANCE
  Income Tax / Advance Tax               ✅
  CA Command Center                      ✅
  Notice Management                      ✅
  ERI integration (ITR filing)     🔲    ✅  (stub in P2; live in P3)

INTELLIGENCE
  Business Health Score                  ✅
  AI Tax Assistant                       ✅
  Document OCR                           ✅
  Cash Flow Forecast               🔲         ✅
  AI Agents                        🔲              ✅
  Industry Benchmarks              🔲              ✅

ECOSYSTEM
  Plugin API                       🔲         ✅
  Developer Portal                            ✅
  Marketplace                                 ✅

INDIA STACK
  UPI payment                            ✅
  GSTN e-invoice               🔲    ✅  (column ready P1; API in P2)
  Account Aggregator           🔲         ✅
  DigiLocker                   🔲              ✅
  ERI (ITR filing)             🔲    ✅
  ONDC buyer app               🔲                   🔲         ✅

FUTURE
  Agentic AI                   🔲                              ✅
  Voice-first                  🔲                              ✅
  CBDC (e-Rupee)               🔲         🔲                   ✅
  Quantum-safe crypto          🔲                              ✅

Legend:  ✅ Built in this phase   🔲 Schema/interface ready, not built
```

---

## THE NON-NEGOTIABLES (Applies To Every Phase)

These cannot be deferred. If discovered missing in any PR review, the PR is blocked.

```
1. EVERY TABLE has a businessId (or is a platform table with explicit justification why not)

2. EVERY FINANCIAL AMOUNT is Decimal(19,4), never float, never integer

3. EVERY TAX RATE, THRESHOLD, FORM NAME is in the Rule Engine. Not in code.

4. EVERY DOCUMENT REFERENCE is a Document.id foreign key. Not a URL string.

5. EVERY DOMAIN EVENT goes through the OutboxEvent table in the same DB transaction.

6. EVERY AI RESPONSE carries a confidence score and a source citation.

7. EVERY MUTATION is idempotent. Same request twice = same result.

8. EVERY POSTED JOURNAL is immutable. Corrections via reversal only.

9. EVERY SENSITIVE FIELD (PAN, Aadhaar, bank account) is encrypted at column level.

10. EVERY EXTERNAL DEPENDENCY is behind a typed interface with a documented escape plan.

11. NO new Date() in domain code. Domain Clock is the only source of time.

12. NO cross-module imports. Module boundaries enforced by ESLint + dependency-cruiser.

13. NO raw SQL in application code. All queries through Prisma or typed query builders.

14. NO feature built without a reversal path (every action has an undo at the application level).

15. NO AI agent takes an irreversible financial action without human confirmation.
```

---

## OPEN SOURCE ALTERNATIVES (Every Paid Tool)

This table is used when a paid service is too expensive or needs to be replaced.

```
Paid / Cloud Tool          Free / Self-hosted Alternative
─────────────────────────────────────────────────────────
Anthropic Claude API    →  Ollama + Llama 3.1 / Mistral
Google Vision OCR       →  Tesseract + PaddleOCR
Algolia (search)        →  PostgreSQL pg_trgm + tsvector
Elastic APM             →  OpenTelemetry + Grafana Tempo
Datadog                 →  Prometheus + Grafana + Loki
AWS S3                  →  MinIO (S3-compatible)
Auth0                   →  Passport.js + JWT (self-built)
SendGrid                →  Nodemailer + self-hosted Postfix
Twilio                  →  Fast2SMS / MSG91
Stripe                  →  Razorpay / PayU (or direct UPI)
HashiCorp Vault (paid)  →  HashiCorp Vault (OSS) or Infisical
LaunchDarkly            →  Unleash (self-hosted feature flags)
PlanetScale             →  Supabase (if Postgres, not MySQL)
Vercel                  →  Self-hosted Next.js on Hetzner
Elastic Search          →  Meilisearch (self-hosted)
Segment (analytics)     →  Jitsu (self-hosted)
Metabase (analytics)    →  Grafana (already in stack)
Tableau                 →  Apache Superset (self-hosted)
```

---

## THE DECISION REGISTER

These are the high-stakes architectural decisions. Every one has a canonical ADR.
If a decision is challenged, reference the ADR. Do not re-litigate without new information.

```
ADR-0001: PostgreSQL as primary database (not MySQL, not MongoDB)
  Reason: RLS (Row Level Security) is a PostgreSQL feature. Multi-tenant isolation
  requires RLS. Without RLS, tenant isolation is at the application layer — which has
  historically been breached. pgvector, pg_trgm, JSONB are also PostgreSQL-specific.

ADR-0002: UUID v7 for all new primary keys (not v4, not auto-increment)
  Reason: Time-ordered IDs prevent B-tree index fragmentation at scale.
  Random UUID v4 causes 50% page splits at >1M rows. Auto-increment cannot be
  distributed across nodes.

ADR-0003: Modular Monolith (not microservices)
  Reason: At <100K businesses, microservices overhead exceeds benefit. Module
  boundaries in a monolith can be extracted to services when justified by scale.
  The reverse (breaking apart a distributed system into a monolith) is not possible.

ADR-0004: BullMQ + Redis for queues (not Kafka)
  Reason: Kafka requires ZooKeeper and has 15-minute minimum replication latency.
  BullMQ on Redis is operationally simpler, lower latency, sufficient for <1M jobs/day.
  Event contracts designed to be Kafka-compatible for future migration.

ADR-0005: Prisma ORM (not raw SQL, not TypeORM)
  Reason: Type-safe queries, migration history, schema diffing. TypeORM has known issues
  with complex relations. Raw SQL loses type safety and schema coupling detection.

ADR-0006: Rule Engine over hardcoded rates (no exceptions)
  Reason: Finance Act changes annually. Hardcoded rates require code deployments for
  legal changes. Rule Engine allows configuration changes without deployments.
  Documented in FOUNDATION_STANDARDS.md as a non-negotiable invariant.

ADR-0007: Provider Pattern for all external services
  Reason: Vendor lock-in is an existential risk for a 25-year platform. Every external
  service is replaceable without domain logic changes.

ADR-0008: OutboxEvent pattern (not direct event publishing)
  Reason: Direct event publishing (publish then DB write) creates dual-write problems:
  DB write fails after event publish → event fired for transaction that never completed.
  Outbox guarantees atomicity: event fires if and only if DB write commits.

ADR-0009: Decimal(19,4) for all financial amounts (not float, not integer)
  Reason: IEEE 754 float has rounding errors. ₹99.99 stored as float = ₹99.98999999.
  Indian tax computation rounds to the nearest rupee. Rounding errors in intermediate
  computations produce incorrect final amounts. Decimal is exact.

ADR-0010: DDD Bounded Contexts with no cross-module imports
  Reason: 1000 developers cannot work on a system where any module can call any other.
  Module independence is the only scalable team organization structure.
```

---

## THE MEASURE OF DONE

For each phase, "done" means all of these:

```
PHASE 0 DONE when:
  □ Every Non-Negotiable passes ESLint + fitness function checks
  □ A new business can be created and isolated via RLS (pen test verified)
  □ An event can be published and consumed end-to-end
  □ A rule can be evaluated with historical dates (evaluateAt)
  □ The audit log cannot be modified (tested with direct SQL attempt)
  □ A posted journal cannot be modified (tested with direct SQL attempt)
  □ A document can be stored, retrieved, and hash-verified

PHASE 1 DONE when:
  □ A business can run for 1 full month (sales, purchases, bank, GST) on Phase 1 alone
  □ Trial balance balances
  □ GSTR-3B figures match the underlying transaction data
  □ TDS is correctly computed on all qualifying payments
  □ No tax rate is hardcoded anywhere in Phase 1 code
  □ 100 simulated concurrent POS transactions → zero duplicate transactions

PHASE 2 DONE when:
  □ A CA firm can manage 10 client businesses
  □ The advance tax estimate is within 5% of the actual ITR computation
  □ AI TDS classification is >85% accurate on test dataset
  □ Notice management flow is end-to-end (upload → track → respond)
  □ A non-accountant can onboard a new business in <2 hours

PHASE 3 DONE when:
  □ A CA firm publishes a working plugin on the marketplace
  □ Account Aggregator bank import works for at least 3 banks
  □ 1,000 concurrent users → p99 latency < 500ms for all read endpoints
  □ A business with 3 branches can view consolidated reports

PHASE 4+ is vertical-specific. Each vertical defines its own "done" criteria
before construction begins.
```

---

## THE FINAL PRINCIPLE

This document will be wrong in some places.
Some phases will take longer. Some decisions will need to be revisited.
The Black Swan document describes what we cannot predict.

**But the Phase 0 decisions are different.**

Phase 0 decisions are not wrong until a clear, measurable cost emerges and a clear, measurable alternative is available. They cannot be revisited for convenience, for speed, or for personal preference. They can only be revisited with an RFC, a new ADR, and a clear migration path.

The reason Phase 0 exists is precisely because it is expensive to change later.
The cost of getting Phase 0 right is 6–8 weeks.
The cost of getting Phase 0 wrong is 2–3 years.

**Build Phase 0 as if you will regret every shortcut. Because you will.**

---

*This document supersedes all previous phase plans.*
*Previous review documents (Platform Architecture, CTO Review, Foundation Standards,*
*Red Team, Human-Centric, Black Swan) remain valid as reference architecture.*
*This document governs build order and the feature-ready contract.*
