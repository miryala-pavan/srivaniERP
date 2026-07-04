# CTO Final Review — Business Operating System for the Next 20 Years

> **Reviewer Role:** CTO, Enterprise Architect, Principal Engineer, Product Strategist, UX Director,
> Performance Engineer, Security Architect, AI Architect, Database Architect, DevOps Architect
>
> **Mandate:** Design not an ERP. Design a Business Operating System.
> Challenge every assumption. Optimize for 2045, not 2026.
>
> **Date:** July 2026

---

## PREAMBLE — THE REFRAME

Stop calling this an ERP.

SAP was built for manufacturing companies to track inventory. It became SAP.
Salesforce was built to replace a spreadsheet for salespeople. It became a platform.
Shopify was built for a single snowboard shop. It became infrastructure for 2 million merchants.

The question is not "how do we build an ERP?"
The question is: **"What is the operating system for a business?"**

A business has:
- **People** — employees, customers, vendors, partners, agents
- **Things** — inventory, assets, documents, contracts
- **Money** — income, expenses, taxes, bank accounts
- **Events** — sales, purchases, payments, approvals, filings
- **Rules** — tax law, business policy, compliance obligations, government mandates
- **Time** — fiscal years, deadlines, schedules, contracts, seasons
- **Knowledge** — what happened, why, what will happen, what should happen

An ERP tracks these. A Business Operating System *understands* them.

The architecture must answer this: Can we build something that understands any business,
in any industry, in any country, under any regulatory regime — now and 20 years from now?

If the answer is not yes — redesign it until it is.

---

## SECTION 1 — ARCHITECTURE PATTERN REVIEW

### 1.1 Clean Architecture — Verdict: ❌ VIOLATED

**Current state:**
NestJS controllers directly call services. Services directly call Prisma.
Business logic lives in services. Services contain infrastructure code.
The innermost ring (domain) has zero code. Prisma models are treated as domain entities.

**Violations:**
```
Current (wrong):
Controller → Service → PrismaClient.model.create()

Clean Architecture requires:
Controller (Adapter) → Use Case (Application) → Domain Entity → Repository Interface
                                                              ↕ (implemented by)
                                             PrismaRepository (Infrastructure)
```

**Required restructure:**
```
src/
├── domain/
│   ├── entities/           ← Pure domain objects with behavior
│   ├── value-objects/      ← Immutable typed values (PAN, GSTIN, Money)
│   ├── repositories/       ← Interfaces only — no Prisma here
│   ├── domain-services/    ← Multi-entity business logic
│   └── domain-events/      ← What changed in the domain
│
├── application/
│   ├── commands/           ← Intent to change state
│   ├── queries/            ← Intent to read state
│   ├── handlers/           ← Command/query handlers (use cases)
│   └── dtos/               ← Input/output shapes
│
├── infrastructure/
│   ├── persistence/        ← Prisma repositories implementing domain interfaces
│   ├── messaging/          ← BullMQ, event bus implementations
│   ├── storage/            ← MinIO, S3 implementations
│   └── integrations/       ← IT Portal, TRACES, GSTN connectors
│
└── presentation/
    ├── rest/               ← NestJS controllers, guards, pipes
    └── graphql/            ← Future: schema-first GraphQL
```

---

### 1.2 Domain-Driven Design — Verdict: ❌ ABSENT

**What is missing:**

**Value Objects — zero exist today:**
```typescript
// Every string that represents a domain concept should be a Value Object

class Pan {
  private constructor(private readonly value: string) {}
  
  static create(raw: string): Result<Pan, InvalidPanError> {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(raw)) return Err(new InvalidPanError(raw));
    return Ok(new Pan(raw));
  }
  
  toMasked(): string { return `${this.value.slice(0,3)}XXXXX${this.value.slice(-2)}`; }
  equals(other: Pan): boolean { return this.value === other.value; }
  toString(): string { return this.value; }
  toJSON(): never { throw new Error('Pan must not be serialized directly'); }
}

class Money {
  private constructor(readonly amount: Decimal, readonly currency: Currency) {}
  static INR(amount: number | Decimal): Money { return new Money(new Decimal(amount), Currency.INR); }
  add(other: Money): Money { this.assertSameCurrency(other); return Money.INR(this.amount.add(other.amount)); }
  multiply(factor: number): Money { return Money.INR(this.amount.mul(factor)); }
  isZero(): boolean { return this.amount.isZero(); }
}

class Gstin {
  // 15-char alphanumeric with embedded state code, PAN, entity type, suffix
  static create(raw: string): Result<Gstin, InvalidGstinError>;
  get stateCode(): number;
  get pan(): Pan;
}

class AssessmentYear {
  // 'AY 2026-27' → { startFY: 2025, endFY: 2026, label: 'AY 2026-27' }
  static fromLabel(label: string): Result<AssessmentYear, InvalidAYError>;
  get previousYear(): AssessmentYear;
  get nextYear(): AssessmentYear;
  containsDate(date: Date): boolean;
}
```

**Aggregates — none defined:**
```typescript
// An Aggregate is a cluster of entities treated as a unit for data changes.
// Only the root can be referenced from outside.

class ItReturnAggregate {
  private constructor(
    private readonly id: ItReturnId,
    private readonly businessId: BusinessId,
    private readonly assessmentYear: AssessmentYear,
    private schedules: Map<ScheduleType, Schedule>,
    private computation: ComputationResult | null,
    private state: ItReturnState,
    private readonly version: number // optimistic locking
  ) {}
  
  // Business logic lives HERE, not in a service
  submitForCaReview(): Result<void, InvalidStateTransitionError> {
    if (this.state !== ItReturnState.DRAFT) return Err(new InvalidStateTransitionError());
    this.state = ItReturnState.SUBMITTED_TO_CA;
    this.emit(new ItReturnSubmittedEvent(this.id, this.businessId));
    return Ok(undefined);
  }
  
  // Computation is done on the aggregate — it knows its own state
  computeTax(ruleSet: TaxRuleSet): ComputationResult {
    const totalIncome = this.computeTotalIncome();
    return this.computationEngine.compute(totalIncome, ruleSet, this.entityProfile);
  }
}
```

**Specifications — missing:**
```typescript
// Business rules expressed as composable predicates
class MsmePaymentDeadlineBreachedSpec implements Specification<Invoice> {
  isSatisfiedBy(invoice: Invoice): boolean {
    const deadline = invoice.hasMsmeAgreement ? 45 : 15;
    return invoice.isPending && daysBetween(invoice.date, today) > deadline;
  }
}

// Composable:
const urgentUnpaidMsme = new MsmePaymentDeadlineBreachedSpec()
  .and(new UnpaidInvoiceSpec())
  .and(new AmountExceedsSpec(10000));
```

---

### 1.3 SOLID Principles — Verdict: ⚠️ PARTIAL

**Single Responsibility:** Services mix business logic, data access, email sending, and event publishing in one class.
**Open/Closed:** Adding a new TDS section requires modifying the detection service, not extending it.
**Liskov Substitution:** No inheritance used — not applicable yet.
**Interface Segregation:** No interfaces exist — services are concrete classes.
**Dependency Inversion:** Services depend on Prisma directly, not on repository abstractions.

---

### 1.4 Hexagonal / Ports and Adapters — Verdict: ❌ NOT DESIGNED

The application has NO ports (interfaces) and NO adapters (implementations of those ports).
Storage, messaging, external APIs are called directly inside services.

**Required:**
```typescript
// Port (in the domain)
interface TaxReturnRepository {
  save(return: ItReturnAggregate): Promise<void>;
  findById(id: ItReturnId): Promise<ItReturnAggregate | null>;
  findByBusinessAndAY(businessId: BusinessId, ay: AssessmentYear): Promise<ItReturnAggregate[]>;
}

// Adapter (in the infrastructure)
class PrismaTaxReturnRepository implements TaxReturnRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async save(return: ItReturnAggregate): Promise<void> { /* Prisma implementation */ }
}

// Alternative adapter for testing:
class InMemoryTaxReturnRepository implements TaxReturnRepository {
  private store = new Map<string, ItReturnAggregate>();
  async save(return: ItReturnAggregate) { this.store.set(return.id.value, return); }
}
```

**Impact:** Without ports, every test requires a running database. Test speed = minutes, not milliseconds.

---

### 1.5 Twelve Factor App — Verdict: ⚠️ PARTIAL

| Factor | Status | Issue |
|--------|--------|-------|
| Codebase | ✅ Git | |
| Dependencies | ✅ package.json | |
| Config | ⚠️ .env files | No runtime config store; secrets in plain .env |
| Backing Services | ⚠️ | Postgres URL in .env but no service discovery |
| Build/Release/Run | ⚠️ | Manual deployment, no CI/CD |
| Processes | ⚠️ | PM2, not stateless (session memory?) |
| Port Binding | ✅ | |
| Concurrency | ❌ | Single process, no horizontal scaling |
| Disposability | ❌ | No graceful shutdown handling |
| Dev/Prod Parity | ❌ | Docker for Postgres but not app |
| Logs | ❌ | console.log, not stdout-as-event-stream |
| Admin Processes | ❌ | No database migration runner in deployment |

---

### 1.6 Event-Driven Architecture — Verdict: ❌ DESIGNED BUT NOT BUILT

The previous architecture review designed the event bus. It does not exist in code.
No module publishes events. No module subscribes to events.
Every cross-cutting concern (tax impact of a sale, MSME deadline on a purchase) is invisible.

---

### 1.7 CQRS Readiness — Verdict: ❌ NOT STARTED

**What CQRS enables:**
- Read models optimized for reporting (denormalized, precomputed)
- Write models optimized for consistency (normalized, transactional)
- Independent scaling of reads vs writes
- Event sourcing as natural write model

**Minimum viable CQRS pattern:**
```typescript
// Commands mutate state — go through the domain
class CreateExpenseCommand {
  constructor(
    readonly businessId: string, readonly amount: Money,
    readonly category: ExpenseCategory, readonly paymentMode: PaymentMode,
    readonly vendorPan?: Pan
  ) {}
}

// Queries read projections — bypass domain for speed
class GetExpenseSummaryQuery {
  constructor(readonly businessId: string, readonly fy: string) {}
}

// Command Handler — enforces business rules
class CreateExpenseCommandHandler {
  async handle(cmd: CreateExpenseCommand): Promise<ExpenseId> {
    const expense = Expense.create(cmd); // domain aggregate
    await this.repository.save(expense);
    await this.eventBus.publish(expense.pullEvents());
    return expense.id;
  }
}

// Query Handler — reads from a read-optimized view
class GetExpenseSummaryQueryHandler {
  async handle(query: GetExpenseSummaryQuery): Promise<ExpenseSummaryDto> {
    return this.readDb.query(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM expense_summary_mv  -- Materialized view, refreshed by events
      WHERE business_id = $1 AND fy = $2
      GROUP BY category
    `, [query.businessId, query.fy]);
  }
}
```

---

### 1.8 Modular Monolith — Verdict: ❌ NOT ENFORCED

The codebase is a monolith but without modular boundaries.
Any module can import any other module's internals.
This means: when we extract a module to a microservice, we will discover hidden coupling.

**Required: Barrel export discipline**
```typescript
// Every module exports ONLY its public contract
// income-tax/index.ts
export { ItReturnDto } from './dto/it-return.dto';
export { ItReturnService } from './it-return.service'; // public API only
// NOT exported: internal repositories, helpers, private types

// ESLint rule to enforce:
// "@typescript-eslint/no-restricted-imports": cross-module internal imports banned
```

---

## SECTION 2 — PLATFORM ENGINE REVIEW

*For 30 engines: does a generic, reusable implementation exist or is it module-specific or absent?*

### Tier 1: Foundation Engines (must exist before any module is built)

| Engine | Status | Owner | Reusable? |
|--------|--------|-------|-----------|
| Rule Engine | ❌ Designed, not built | IT Module plan | Must be Platform |
| Workflow Engine | ❌ Not designed as platform | IT Module only | Must be Platform |
| State Machine Engine | ❌ Not designed | — | Must be Platform |
| Approval Engine | ❌ Not designed | — | Must be Platform |
| Event Bus | ❌ Not built | — | Must be Platform |
| Event Store | ❌ Not built | — | Must be Platform |
| Audit Engine | ❌ Not built | — | Must be Platform |
| Scheduler | ❌ Not built | — | Must be Platform |
| Background Worker | ⚠️ BullMQ mentioned | — | Must be Platform |

### Tier 2: Intelligence Engines (month 3-6)

| Engine | Status | Owner | Reusable? |
|--------|--------|-------|-----------|
| Formula Engine | ❌ Missing | — | Platform |
| Calculation Engine | ⚠️ Tax only | IT Module | Must be Platform |
| Expression Engine | ❌ Missing | — | Platform |
| Policy Engine | ❌ Missing | — | Platform |
| Compliance Engine | ⚠️ IT only | IT Module | Must be Platform |
| Business Digital Twin | ❌ Designed, not built | — | Platform |
| Knowledge Engine | ❌ Missing | — | Platform |

### Tier 3: Content and Communication (month 6-12)

| Engine | Status | Owner | Reusable? |
|--------|--------|-------|-----------|
| Document Engine | ❌ Designed, not built | — | Platform |
| OCR Engine | ⚠️ Google Vision mentioned | IT Module | Must be Platform |
| Storage Engine | ⚠️ MinIO/S3 referenced | Scattered | Must be Platform |
| Notification Engine | ❌ Not built | — | Platform |
| Communication Engine | ❌ Missing | — | Platform |
| Template Engine | ❌ Missing | — | Platform |
| Search Engine | ❌ Missing | — | Platform |

### Tier 4: Analytics and Intelligence (year 2)

| Engine | Status | Owner | Reusable? |
|--------|--------|-------|-----------|
| Dashboard Engine | ❌ Missing | — | Platform |
| Analytics Engine | ❌ Missing | — | Platform |
| Report Engine | ❌ Missing | — | Platform |
| Business Intelligence Engine | ❌ Missing | — | Platform |
| AI Platform | ❌ Missing | — | Platform |
| Metadata Engine | ❌ Missing | — | Platform |
| Configuration Engine | ⚠️ .env only | — | Platform |
| Feature Flag Engine | ❌ Missing | — | Platform |

**Summary: 28 of 30 engines are missing or module-specific. Only Background Worker and Rule Engine are partially designed.**

### The Formula / Expression Engine (most undervalued engine)

This is the engine that makes everything else configurable without code.

```typescript
// Every rule, every formula, every condition in the ERP runs through this engine
interface ExpressionEngine {
  evaluate(expression: string, context: Record<string, unknown>): unknown;
  validate(expression: string): ValidationResult;
  extractVariables(expression: string): string[];
}

// Examples of what this powers:
// TDS threshold check:
//   "payment.amount > rule.threshold AND vendor.tdsExempt == false"
// Approval routing:
//   "expense.amount > 50000 AND expense.category == 'CAPITAL'"
// Pricing rule:
//   "basePrice * (1 - discount.rate) + logistics.charge"
// Tax computation:
//   "max(income * 0.185, income * slab.rate) + surcharge * cess_rate"
// Alert condition:
//   "inventory.currentStock < inventory.reorderPoint * 0.8"
```

Using `mathjs` or a custom AST evaluator. Zero JS `eval()` — security requirement.

---

## SECTION 3 — DATABASE ARCHITECTURE REVIEW

### 3.1 Normalization vs Denormalization

**Current state:** Mostly normalized 3NF with JSONB for flexibility. Correct for an OLTP system.

**Problem:** Reports and dashboards run against normalized OLTP tables. At 500M journal entries, a P&L report joins 4 tables and takes 45 seconds. This is not acceptable.

**Required: Dual Model Strategy**

```
Write Side (OLTP)          →  Event  →  Projection Builder  →  Read Side (OLAP)
Normalized, Consistent         Bus                              Denormalized, Fast

JournalEntry (normalized)                                     ProfitLossSnapshot
JournalLine (FK to Account)                                   BalanceSheetSnapshot  
Account (hierarchy)                                           ExpenseSummaryMV
                                                              TdsSummaryMV
```

Read-side projections are rebuilt from events when they go stale.
Reports hit the read side. Users never wait.

---

### 3.2 UUID Strategy — Warning

**Current:** `@id @default(uuid())` — random UUID v4.

**Problem at scale:**
Random UUIDs cause B-tree index fragmentation. At 100M rows, insert performance degrades by 40-60%.

**Solution:** UUID v7 (time-ordered) or ULID
```typescript
// UUID v7 is time-ordered → sequential inserts → no B-tree fragmentation
import { uuidv7 } from 'uuidv7';

// Or ULID (Universally Unique Lexicographically Sortable Identifier)
import { ulid } from 'ulid';

// Both are:
// - Time-sortable
// - Globally unique
// - B-tree friendly
// - URL-safe
```

**This change must be made BEFORE any data is in production.** Retroactive migration is painful.

---

### 3.3 Missing Critical Indexes

```sql
-- Current state: only @id index (primary key) on most tables
-- What is missing:

-- Tenant isolation queries (runs on every request)
CREATE INDEX CONCURRENTLY idx_sale_business_created 
  ON "Sale" ("businessId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY idx_purchase_business_date 
  ON "Purchase" ("businessId", "date" DESC);

-- TDS detection (payment scanning)
CREATE INDEX CONCURRENTLY idx_payment_tds_scan 
  ON "Payment" ("businessId", "date", "amount") 
  WHERE "tdsDeducted" = false;

-- Compliance deadline scanner
CREATE INDEX CONCURRENTLY idx_compliance_due_pending
  ON "ComplianceInstance" ("dueDate", "tenantId")
  WHERE "status" IN ('PENDING', 'OVERDUE');
  
-- MSME payment risk (43B(h) scanner)  
CREATE INDEX CONCURRENTLY idx_invoice_msme_unpaid
  ON "PurchaseInvoice" ("businessId", "invoiceDate")
  WHERE "isMsme" = true AND "isPaid" = false;

-- Audit log query (hash verification)
CREATE INDEX CONCURRENTLY idx_audit_entity
  ON "AuditLog" ("entityType", "entityId", "occurredAt" DESC);

-- Full-text search (business name, product name, vendor name)
CREATE INDEX CONCURRENTLY idx_product_fts
  ON "Product" USING GIN (to_tsvector('english', "name" || ' ' || COALESCE("description", '')));

-- JSONB fields that are queried
CREATE INDEX CONCURRENTLY idx_rule_parameters
  ON "Rule" USING GIN ("parameters" jsonb_path_ops);
  
-- Partial index for active rules only
CREATE INDEX CONCURRENTLY idx_rule_active
  ON "Rule" ("ruleSetId", "category", "priority")
  WHERE "isActive" = true;
```

---

### 3.4 Partitioning Strategy

```sql
-- All high-volume tables must be partitioned from day 1.
-- Retrofitting partitioning onto a live table is extremely painful.

-- AuditLog: partition by month
CREATE TABLE "AuditLog" (
  id UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ NOT NULL,
  -- ... other fields
) PARTITION BY RANGE ("occurredAt");

-- Automate monthly partition creation:
CREATE EXTENSION IF NOT EXISTS pg_partman;
SELECT partman.create_parent(
  p_parent_table := 'public.AuditLog',
  p_control := 'occurredAt',
  p_interval := '1 month'
);

-- EventStore: partition by month
-- JournalLine: partition by financial year (tax queries are FY-scoped)
-- Sale: partition by month (POS volume is very high)
-- OutboxEvent: partition by day (polling table, old rows archived)
```

---

### 3.5 Missing Constraints

```sql
-- Double-entry constraint: every journal entry must balance
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT ABS(SUM(debit) - SUM(credit))
    FROM "JournalLine"
    WHERE "journalEntryId" = NEW."journalEntryId"
  ) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry % is not balanced', NEW."journalEntryId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER enforce_journal_balance
  AFTER INSERT OR UPDATE ON "JournalLine"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_journal_balance();

-- Tax computation must be positive
ALTER TABLE "ItReturn" 
  ADD CONSTRAINT positive_tax CHECK ("totalTaxPayable" >= 0);

-- AY must be valid format
ALTER TABLE "ItReturn"
  ADD CONSTRAINT valid_ay CHECK ("assessmentYear" ~ '^AY [0-9]{4}-[0-9]{2}$');

-- PAN format enforcement at DB level
ALTER TABLE "Business"
  ADD CONSTRAINT valid_pan CHECK ("pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$' OR "pan" IS NULL);

-- Money cannot be negative on sales
ALTER TABLE "SaleItem"
  ADD CONSTRAINT non_negative_price CHECK ("unitPrice" >= 0 AND "quantity" > 0);
```

---

### 3.6 Missing Tables — Comprehensive List

Beyond what was covered in previous documents, these platform tables are required:

```sql
-- MASTER DATA MANAGEMENT
CREATE TABLE "MasterEntity" (
  id UUID PRIMARY KEY, type VARCHAR(50), -- PRODUCT/VENDOR/CUSTOMER/EMPLOYEE
  golden_record_id UUID, -- points to the canonical version
  source_system VARCHAR(50), source_id VARCHAR(100),
  confidence_score FLOAT, merge_status VARCHAR(20)
);

-- MULTI-BRANCH
CREATE TABLE "Branch" (
  id UUID PRIMARY KEY, "businessId" UUID NOT NULL,
  name VARCHAR(200), code VARCHAR(20), address JSONB,
  gstin VARCHAR(15), is_headquarters BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true
);

-- CHART OF ACCOUNTS (General Ledger - BLOCKER)
CREATE TABLE "AccountGroup" (
  id UUID PRIMARY KEY, "businessId" UUID NOT NULL,
  code VARCHAR(20) NOT NULL, name VARCHAR(200),
  type VARCHAR(20) NOT NULL, -- ASSET/LIABILITY/EQUITY/INCOME/EXPENSE
  parent_group_id UUID REFERENCES "AccountGroup"(id),
  is_system BOOLEAN DEFAULT false, -- system accounts cannot be deleted
  display_order INT
);

CREATE TABLE "Account" (
  id UUID PRIMARY KEY, "businessId" UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES "AccountGroup"(id),
  code VARCHAR(20) NOT NULL, name VARCHAR(200),
  opening_balance DECIMAL(18,2) DEFAULT 0,
  opening_balance_type VARCHAR(2), -- DR/CR
  is_bank_account BOOLEAN DEFAULT false,
  bank_account_number VARCHAR(50), ifsc VARCHAR(11),
  tax_type VARCHAR(20), -- GST/TDS/NONE
  is_reconcilable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true
);

-- JOURNAL (General Ledger)
CREATE TABLE "Journal" (
  id UUID PRIMARY KEY, "businessId" UUID NOT NULL,
  "branchId" UUID REFERENCES "Branch"(id),
  journal_date DATE NOT NULL,
  number VARCHAR(50) NOT NULL, -- generated from NumberSeries
  narration TEXT,
  reference VARCHAR(100),
  source_type VARCHAR(50), source_id UUID, -- which module generated this
  is_posted BOOLEAN DEFAULT false,
  posted_by UUID, posted_at TIMESTAMPTZ,
  is_reversed BOOLEAN DEFAULT false,
  reversed_by_journal_id UUID
) PARTITION BY RANGE (journal_date);

CREATE TABLE "JournalLine" (
  id UUID PRIMARY KEY, journal_id UUID NOT NULL REFERENCES "Journal"(id),
  account_id UUID NOT NULL REFERENCES "Account"(id),
  dr DECIMAL(18,2) DEFAULT 0, cr DECIMAL(18,2) DEFAULT 0,
  narration TEXT, cost_center VARCHAR(50),
  party_type VARCHAR(20), party_id UUID, -- vendor/customer/employee
  CONSTRAINT dr_xor_cr CHECK ((dr = 0) != (cr = 0)),
  CONSTRAINT non_negative CHECK (dr >= 0 AND cr >= 0)
);

-- NUMBER SERIES (invoice numbers, voucher numbers, document numbers)
CREATE TABLE "NumberSeries" (
  id UUID PRIMARY KEY, "businessId" UUID NOT NULL,
  name VARCHAR(100), -- 'SALES_INVOICE', 'PURCHASE_ORDER', 'JOURNAL_VOUCHER'
  prefix VARCHAR(20), suffix VARCHAR(20),
  current_value BIGINT DEFAULT 0,
  padding INT DEFAULT 6, -- zero-padding length
  fiscal_year VARCHAR(10), -- reset per FY if needed
  UNIQUE ("businessId", name, fiscal_year)
);

-- COST CENTER
CREATE TABLE "CostCenter" (
  id UUID PRIMARY KEY, "businessId" UUID NOT NULL,
  name VARCHAR(200), code VARCHAR(20),
  parent_id UUID REFERENCES "CostCenter"(id),
  is_active BOOLEAN DEFAULT true
);

-- MULTI-CURRENCY
CREATE TABLE "Currency" (
  code CHAR(3) PRIMARY KEY, name VARCHAR(50), symbol VARCHAR(5),
  decimal_places INT DEFAULT 2, is_active BOOLEAN DEFAULT true
);

CREATE TABLE "ExchangeRate" (
  id UUID PRIMARY KEY, from_currency CHAR(3), to_currency CHAR(3),
  rate DECIMAL(18,6), rate_date DATE NOT NULL,
  source VARCHAR(50), -- RBI/MANUAL/FOREX_API
  UNIQUE (from_currency, to_currency, rate_date)
);

-- PLATFORM CONFIGURATION
CREATE TABLE "ConfigKey" (
  id UUID PRIMARY KEY, namespace VARCHAR(50),
  key VARCHAR(200) NOT NULL, data_type VARCHAR(20),
  description TEXT, default_value TEXT,
  is_secret BOOLEAN DEFAULT false,
  validation_regex VARCHAR(500),
  UNIQUE (namespace, key)
);

CREATE TABLE "ConfigValue" (
  id UUID PRIMARY KEY, config_key_id UUID REFERENCES "ConfigKey"(id),
  scope VARCHAR(20), -- GLOBAL/TENANT/USER/BRANCH
  scope_id UUID, value TEXT, -- encrypted if is_secret
  updated_by UUID, updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (config_key_id, scope, scope_id)
);

-- FEATURE FLAGS
CREATE TABLE "FeatureFlag" (
  key VARCHAR(100) PRIMARY KEY, namespace VARCHAR(50),
  description TEXT, is_enabled BOOLEAN DEFAULT false,
  rollout_strategy VARCHAR(30), -- ALL/PERCENTAGE/ALLOWLIST/PLAN_TIER
  rollout_config JSONB,
  kill_switch BOOLEAN DEFAULT false, -- emergency disable
  enabled_at TIMESTAMPTZ, disabled_at TIMESTAMPTZ
);

CREATE TABLE "FeatureFlagOverride" (
  flag_key VARCHAR(100) REFERENCES "FeatureFlag"(key),
  tenant_id UUID, is_enabled BOOLEAN,
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (flag_key, tenant_id)
);

-- DIGITAL TWIN
CREATE TABLE "BusinessPulse" (
  id UUID PRIMARY KEY, "businessId" UUID NOT NULL UNIQUE,
  -- Financial health
  mrr DECIMAL(18,2), arr DECIMAL(18,2),
  current_month_revenue DECIMAL(18,2),
  current_month_expenses DECIMAL(18,2),
  current_month_profit DECIMAL(18,2),
  profit_margin DECIMAL(5,2),
  revenue_growth_mom DECIMAL(5,2), -- month-over-month %
  -- Cash position
  bank_balance DECIMAL(18,2), accounts_receivable DECIMAL(18,2),
  accounts_payable DECIMAL(18,2), cash_runway_days INT,
  -- Tax health
  estimated_tax_liability DECIMAL(18,2), advance_tax_paid DECIMAL(18,2),
  tds_payable DECIMAL(18,2), pending_tds_returns INT,
  gst_liability DECIMAL(18,2), pending_gst_returns INT,
  ais_variance DECIMAL(18,2),
  -- Risk signals
  overdue_invoices_count INT, overdue_invoices_amount DECIMAL(18,2),
  msme_breach_risk INT, -- count of vendors at risk of 43B(h) breach
  compliance_score INT, tds_health_score INT, gst_health_score INT,
  books_readiness_score INT, audit_risk_score INT,
  -- AI signals
  notice_probability_score INT, -- 0-100
  cash_flow_forecast_30d DECIMAL(18,2),
  tax_saving_opportunity DECIMAL(18,2),
  -- System
  computed_at TIMESTAMPTZ DEFAULT now(),
  compute_version INT DEFAULT 1
);
```

---

## SECTION 4 — DOMAIN MODEL REVIEW

### 4.1 Missing Aggregates Across All Planned Modules

```
ERP Domain
├── Core
│   ├── Business (aggregate root)
│   ├── Branch (entity, child of Business)
│   ├── Fiscal Period (value object)
│   └── NumberSeries (entity)
│
├── Financial
│   ├── JournalEntry (aggregate root — immutable once posted)
│   ├── Account (entity in GL context)
│   └── ReconciliationSession (aggregate root)
│
├── Purchase
│   ├── PurchaseOrder (aggregate root) — MISSING lifecycle FSM
│   ├── GoodsReceipt (aggregate root) — MISSING
│   ├── PurchaseInvoice (aggregate root) — MISSING
│   └── Vendor (aggregate root in Vendor context)
│
├── Sales
│   ├── SalesOrder (aggregate root) — MISSING
│   ├── SaleInvoice (aggregate root) — currently "Sale" but no aggregate
│   └── Customer (aggregate root)
│
├── Inventory
│   ├── StockLot (aggregate root — FIFO/LIFO/WAC valuation)
│   ├── Batch (entity — for expiry tracking)
│   └── WarehouseTransfer (aggregate root)
│
├── Tax
│   ├── ItReturn (aggregate root)
│   ├── TdsDeduction (aggregate root — not entry, it's a lifecycle)
│   ├── GstReturn (aggregate root — MISSING)
│   └── AdvanceTax (aggregate root)
│
└── Compliance
    ├── ComplianceObligation (aggregate root)
    ├── ItNotice (aggregate root with notice + SCN + reply + order lifecycle)
    └── AisReconciliation (aggregate root)
```

### 4.2 Shared Kernel

Objects shared between bounded contexts without translation:

```typescript
// shared-kernel/
export { Money } from './value-objects/money';
export { Pan } from './value-objects/pan';
export { Gstin } from './value-objects/gstin';
export { TenantId } from './value-objects/tenant-id';
export { FiscalYear } from './value-objects/fiscal-year';
export { AssessmentYear } from './value-objects/assessment-year';
export { Result, Ok, Err } from './result';
export type { DomainEvent } from './domain-event';
```

### 4.3 Context Map

```
Sales Context        [Upstream]  →  ACL  →  Tax Context [Downstream]
Purchase Context     [Upstream]  →  ACL  →  Tax Context [Downstream]
Purchase Context     [Upstream]  →  ACL  →  TDS Context [Downstream]
Vendor Context       [Upstream]  →  ACL  →  TDS Context [Downstream]
Tax Context          [Upstream]  →  ACL  →  Compliance Context [Downstream]
All Contexts                     →  Event Bus  →  Digital Twin Context [Subscriber]
```

---

## SECTION 5 — APPLICATION LAYER REVIEW

### 5.1 Missing Patterns

**No Result type — errors are thrown, not returned:**
```typescript
// Current (bad): throws exceptions that are not typed
async createExpense(dto: CreateExpenseDto): Promise<Expense> {
  if (!dto.amount) throw new Error('Amount required'); // untyped error
  return this.prisma.expense.create({ data: dto });
}

// Required: typed, composable results
async createExpense(cmd: CreateExpenseCommand): Promise<Result<ExpenseId, ExpenseError>> {
  const amount = Money.INR(cmd.amount);
  if (amount.isNegative()) return Err(new InvalidAmountError(cmd.amount));
  
  const pan = cmd.vendorPan ? Pan.create(cmd.vendorPan) : Ok(null);
  if (pan.isErr()) return Err(new InvalidPanError(cmd.vendorPan));
  
  const expense = Expense.create({ amount, pan: pan.value, ...cmd });
  await this.repository.save(expense);
  await this.eventBus.publish(expense.pullEvents());
  return Ok(expense.id);
}
```

**No idempotency keys on any endpoint:**
```typescript
// Required on all mutating endpoints
@Post('expenses')
async createExpense(
  @Body() dto: CreateExpenseDto,
  @Headers('Idempotency-Key') idempotencyKey: string
): Promise<ExpenseDto> {
  // Check if already processed
  const existing = await this.idempotencyStore.get(idempotencyKey);
  if (existing) return existing;
  
  const result = await this.handler.handle(new CreateExpenseCommand(dto));
  await this.idempotencyStore.set(idempotencyKey, result, 86400); // 24h
  return result;
}
```

**No saga/compensation for multi-step operations:**
```typescript
// ITR Filing is multi-step: validate → compute → generate JSON → upload → verify → store
// If step 4 fails, steps 1-3 must be undoable or retryable
class FileItrSaga {
  async execute(command: FileItrCommand): Promise<SagaResult> {
    const steps = [
      new ValidateItrStep(),
      new ComputeTaxStep(),
      new GenerateItrJsonStep(),
      new UploadToPortalStep(),     // can fail — external system
      new VerifyUploadStep(),
      new RecordFilingStep(),
    ];
    
    return this.sagaOrchestrator.run(steps, command, {
      compensate: true,            // run compensations on failure
      retryPolicy: { maxAttempts: 3, backoff: 'exponential' }
    });
  }
}
```

---

## SECTION 6 — USER EXPERIENCE REVIEW

### 6.1 Persona Analysis

**Owner / Business Principal (Srivani Stores context)**
- Checks ERP from mobile during business hours, never at a desktop
- Wants: "How much did we sell today? What is my tax this year? What is due?"
- Pain: too many tabs, too many numbers, no summary
- Required: Owner Dashboard with ≤5 widgets, WhatsApp digest, offline mobile

**Cashier / POS Operator**
- Must complete a sale in ≤8 seconds (customer is waiting at counter)
- Cannot be distracted by complex UI
- Required: Full-screen POS mode, keyboard shortcuts for every action, barcode scan, touch optimized
- Pain point: any pop-up or alert during checkout = customer friction

**CA / Tax Consultant**
- Manages 50+ clients simultaneously; context-switches between clients constantly
- Wants: Quick client switch, status at a glance, bulk downloads, keyboard navigation
- Pain: must remember where to click for each client
- Required: CA Command Center with client roster, status colors, keyboard shortcuts, bulk export

**Store Manager / Purchase Executive**
- Tracks purchase orders, stock levels, payments
- Pain: cannot see which purchase invoices are pending payment, which MSME vendors are at 43B(h) risk
- Required: Priority inbox showing "action needed" items sorted by urgency

**Accountant / Auditor**
- Deep in data: journal entries, reconciliations, trial balance
- Needs: keyboard-first interface, bulk reconciliation, Excel export
- Pain: clicking through UI for each journal entry — they want power-user tools

**AI-Assisted Personas (2027+)**
- Every persona should be able to ask in natural language: "Show me all TDS pending for Q2"
- Voice command: "Mark this purchase as paid" from mobile while at the warehouse
- The ERP should be as easy to use as asking someone a question

### 6.2 UX Architecture Requirements

**Command Palette (Ctrl+K / Cmd+K)**
```
Every action in the ERP is available via keyboard-first command palette.
> "New Sale"             → opens POS
> "Create Expense"       → opens expense form
> "Switch to client"     → shows client search
> "Run TDS check"        → scans for missed TDS
> "Tax summary AY 26-27" → opens computation result
```

**Zero-click defaults:**
- New sale: auto-selects today, auto-focuses product search
- New expense: auto-fills today, auto-focuses amount
- TDS detection: runs automatically on every payment saved, no manual trigger
- Advance tax: auto-computes quarterly obligation when any income/expense changes

**Smart autosave:**
- Every form saves a draft on every keystroke (localStorage)
- User can close browser and return to find form intact
- Conflict resolution: if server state changed while form was open → show diff, let user choose

**Progressive Disclosure:**
- New user sees: 3 actions (New Sale, New Purchase, View Dashboard)
- Power user sees: all shortcuts visible
- Accountant mode: dense tables, keyboard navigation, no unnecessary whitespace

**Undo (critical for financial software):**
- Every mutating action is undoable for 24 hours (soft delete + event log)
- "You deleted invoice INV-2024-001. Undo?" — 5 second window, then archived not deleted
- CA can see full edit history with timestamp and actor for any document

---

## SECTION 7 — PERFORMANCE ARCHITECTURE

### Targets
- 1 million businesses
- 100,000 concurrent users
- 100 million invoices
- 500 million journal lines
- P99 API latency: <200ms
- P99 report latency: <3s (even for annual P&L)
- POS sale completion: <500ms end-to-end

### 7.1 Caching Strategy

```
Layer 1 — In-Process (milliseconds)
  - Rule Engine rule sets (read-only after Budget; invalidate on rule update)
  - Feature flags (cache 60 seconds)
  - Exchange rates (cache 1 hour)

Layer 2 — Redis (sub-millisecond network)
  - Session tokens (TTL = session expiry)
  - Idempotency key store (TTL = 24 hours)
  - BusinessPulse (Digital Twin) — cached and refreshed by events
  - Computed tax results (key = businessId + AY + inputHash)
  - Rate limiter counters
  - Distributed locks (for computation jobs)

Layer 3 — Materialized Views (seconds, refreshed by events)
  - ProfitLossMV — by month, by year
  - TdsSummaryMV — by quarter, by section
  - ExpenseSummaryMV — by category, by month
  - CustomerBalanceMV — outstanding receivables
  - VendorBalanceMV — outstanding payables
  - InventoryValueMV — by product, by warehouse
```

### 7.2 Query Patterns at Scale

```sql
-- At 500M journal lines, a P&L query must NOT scan the table
-- WRONG:
SELECT account_id, SUM(dr - cr) 
FROM "JournalLine" jl
JOIN "Journal" j ON j.id = jl.journal_id
WHERE j.business_id = $1 
  AND j.journal_date BETWEEN $2 AND $3;

-- RIGHT: Query the materialized view
SELECT account_id, total_dr, total_cr
FROM "account_balance_mv"
WHERE business_id = $1 AND fy = $2;

-- The MV is refreshed by a background job after every journal posting
-- The background job is triggered by the JournalPosted event
```

### 7.3 Connection Pooling

```
Application → PgBouncer (connection pooler) → PostgreSQL

PgBouncer config:
  pool_mode = transaction        # one server connection per transaction, not per request
  max_client_conn = 5000         # handles 100K concurrent users
  default_pool_size = 50         # per user per database
  max_db_connections = 200       # total Postgres connections
```

Without connection pooling, 100K concurrent users = 100K Postgres connections = OOM crash.

### 7.4 Streaming for Large Exports

```typescript
// WRONG — loads all 1M rows into memory
async exportAllSales(businessId: string): Promise<Buffer> {
  const sales = await this.prisma.sale.findMany({ where: { businessId } }); // OOM
  return generateExcel(sales);
}

// RIGHT — stream rows, pipe to Excel stream
async streamSalesExport(businessId: string, res: Response): Promise<void> {
  const stream = this.prisma.$queryRawUnsafe<Sale>(
    `SELECT * FROM "Sale" WHERE "businessId" = $1 ORDER BY "createdAt"`,
    businessId
  ) as AsyncIterable<Sale>;
  
  const excelStream = new ExcelWriteStream(res, SALES_HEADERS);
  for await (const sale of stream) {
    excelStream.writeRow(sale);
  }
  excelStream.end();
}
```

---

## SECTION 8 — SECURITY ARCHITECTURE

### 8.1 Current State: Critically Under-Secured

The application processes PAN numbers, bank account numbers, and financial data of real businesses.
Current security posture: JWT tokens + role field on User model.
This is a startup prototype, not a financial platform.

### 8.2 Complete Security Architecture Required

**Authentication:**
```
Phase 1: JWT + Refresh Tokens (current — basic, acceptable for MVP)
Phase 2: Add MFA (TOTP via Google Authenticator / SMS OTP)
Phase 3: Passkeys (WebAuthn) — passwordless, phishing-resistant
Phase 4: Device trust (remember trusted devices, flag new device logins)
```

**Authorization — Policy-Based Access Control:**
```typescript
// Define policies, not just roles
const policies: AccessPolicy[] = [
  {
    subject: { role: 'CA', caLinkedTenants: '*' },
    resource: { entityType: 'ItReturn', tenantId: 'IN(caLinkedTenants)' },
    actions: ['READ', 'COMMENT', 'FLAG'],
    conditions: { workflowState: ['SUBMITTED_TO_CA', 'CA_REVIEWING'] }
  },
  {
    subject: { role: 'OWNER' },
    resource: { entityType: 'ItReturn', tenantId: 'SELF' },
    actions: ['READ', 'SUBMIT_TO_CA', 'RESPOND_TO_FLAG'],
    conditions: {}
  },
  {
    subject: { role: 'SYSTEM_JOB' },
    resource: { entityType: '*' },
    actions: ['READ', 'WRITE'],
    conditions: { ipRange: ['127.0.0.1/8', 'internal-vpc-cidr'] }
  }
];
```

**Data Protection:**
```
PAN: encrypted AES-256-GCM, masked in all logs, never in URLs
Bank Account: encrypted at rest, displayed as **** XXXX last 4
Aadhaar: never stored (if needed, store only last 4 digits)
Documents: encrypted in MinIO with customer-managed keys
Audit Logs: hash-chained, tamper-evident, append-only
```

**OWASP Top 10 Coverage:**
```
A01 Broken Access Control: PBAC + RLS covers this
A02 Crypto Failures: column-level encryption + TLS 1.3 + HSTS
A03 Injection: Prisma parameterized queries; raw queries banned unless reviewed
A04 Insecure Design: PBAC + domain model validation
A05 Security Misconfiguration: Dockerfile hardening + no debug in production
A06 Vulnerable Components: Dependabot + npm audit in CI
A07 Auth Failures: rate limiting + lockout + MFA
A08 Software Integrity: npm lockfile + subresource integrity
A09 Logging Failures: structured logging + security event alerting
A10 SSRF: Integration Hub validates all outbound URLs + allowlist
```

**Supply Chain Security:**
```yaml
# .github/workflows/security.yml
- uses: anchore/sbom-action@v0          # Generate SBOM
- uses: aquasecurity/trivy-action@v0.14 # Scan dependencies
- uses: trufflesecurity/trufflehog@v3   # Scan for committed secrets
```

---

## SECTION 9 — AI ARCHITECTURE

### 9.1 The Right AI Architecture for an ERP

Do not build features. Build an AI operating layer.

```
AI Operating Layer
├── Perception (what's happening)
│   ├── Document OCR + extraction
│   ├── Voice command recognition
│   ├── Receipt photo → expense entry
│   └── Bank statement → journal entries
│
├── Reasoning (what does it mean)
│   ├── Expense categorization
│   ├── TDS section classification
│   ├── AIS variance explanation
│   ├── Notice risk assessment
│   └── Cash flow prediction
│
├── Action (what to do)
│   ├── Auto-categorize and record
│   ├── Auto-schedule advance tax
│   ├── Auto-reconcile bank statement
│   ├── Draft notice reply
│   └── Suggest tax saving options
│
└── Learning (getting better)
    ├── Feedback loop on corrections
    ├── Business-specific pattern learning
    ├── Industry benchmark comparison
    └── Model evaluation and retraining
```

### 9.2 RAG Architecture for Indian Tax Law

```
Knowledge Base Builder (offline)
  1. Download IT Act 1961 + IT Act 2025 (full text)
  2. Download CBDT Circulars + Notifications (all years)
  3. Download ITAT judgments (important ones)
  4. Download GST Act + CGST Rules
  5. Download Budget speeches (all years)
  ↓
  Chunk into 500-token segments with overlap
  ↓
  Generate embeddings (text-embedding-3-small or local model)
  ↓
  Store in pgvector table

Query Flow (real-time)
  User asks: "Is this CA bill TDS deductible?"
  ↓
  Embed the question
  ↓
  Vector search → top 5 relevant chunks (Section 194J, related circulars)
  ↓
  Prompt = "[chunks] + User question: Is this CA bill TDS deductible?"
  ↓
  LLM generates answer with section references
  ↓
  Answer is grounded in actual law text (not hallucination)
```

### 9.3 Guardrails

```typescript
class TaxAdviceGuardrail {
  async validate(response: AiResponse): Promise<GuardrailResult> {
    const checks = [
      // Never claim certainty on tax outcomes
      this.checkNoCertainClaims(response),
      // Always cite the law section
      this.checkHasCitation(response),
      // Flag if answer differs from our Rule Engine's output
      this.checkConsistencyWithRuleEngine(response),
      // Never recommend illegal tax avoidance
      this.checkNoIllegalAdvice(response),
    ];
    
    const results = await Promise.all(checks);
    if (results.some(r => r.failed)) {
      return { passed: false, reason: results.find(r => r.failed)?.reason };
    }
    return { passed: true };
  }
}
```

### 9.4 AI Permissions Model

```
AI can READ anything the requesting user can READ.
AI can WRITE only with explicit human approval.
AI audit log: every AI action is logged with: model, prompt (hashed), response, confidence, human_approved.
AI cannot: send emails, file returns, make payments — these require human confirmation always.
```

---

## SECTION 10 — BUSINESS INTELLIGENCE

### Can the ERP Answer These Questions?

| Question | Current | Required Architecture |
|----------|---------|----------------------|
| What happened? | ⚠️ Partial (sales reports) | Event Store → BI layer |
| Why? | ❌ No explanation | Computation Lineage + AI explanation |
| What is happening now? | ❌ No real-time view | Digital Twin (event-driven) |
| What will happen? | ❌ No forecasting | AI Prediction Engine |
| What should happen? | ❌ No recommendations | Rule Engine + AI recommendations |
| What can be automated? | ❌ Not analyzed | Automation Engine (pattern detection) |
| What is risky? | ❌ No risk model | Risk Score Engine |
| Where is money leaking? | ❌ Not designed | Expense analysis + benchmark |
| How to improve profit? | ❌ Not designed | Margin analysis + AI |
| How to reduce tax legally? | ❌ Not designed | Tax planning what-if engine |
| How to improve cash flow? | ❌ Not designed | AR/AP analysis + forecast |
| What is next due? | ⚠️ Compliance calendar only | Digital Twin next deadline |
| What needs attention? | ❌ No priority inbox | Intelligence Feed |

### The Intelligence Feed

Every morning, the business owner gets (WhatsApp + in-app):

```
📊 Business Pulse — 3 July 2026

🟢 Today's target: ₹45,000 (Yesterday: ₹52,300)
🔴 Advance tax due in 12 days — pay ₹1,50,000 now to avoid penalty
🟡 3 MSME vendors approaching 45-day payment deadline
🟡 AIS shows ₹45,000 FD interest not in your books — verify
🟢 TDS for June paid ✓  |  GST 3B filed ✓
💡 Switching to old regime saves ₹22,000 this year — review

→ Tap to act on each item
```

---

## SECTION 11 — ERP INTELLIGENCE SCORES

Every entity in the ERP has a health score. Scores update continuously via events.

```
BusinessHealthScore (0-100)
├── RevenueScore: Is revenue growing? Consistent? Predictable?
├── ProfitScore: Are margins healthy? Improving?
├── CashFlowScore: Is cash flow positive? Runway sufficient?
├── ComplianceScore: All filings on time? No demands pending?
├── TdsHealthScore: All TDS deducted? Returns filed?
├── GstHealthScore: All returns filed? Reconciled?
├── BooksReadinessScore: Is GL maintained? Reconciled? Audit-ready?
├── AuditRiskScore: Any AIS mismatches? Any unexplained transactions?
├── VendorHealthScore: Payment terms honored? MSME risk managed?
├── CustomerHealthScore: AR aging healthy? No bad debts?
└── DataQualityScore: Complete PAN? GSTIN? Documents attached?

VendorScore (0-100)
├── ComplianceScore: GST active? PAN verified? ITR filer?
├── PaymentScore: How reliable are our payments to them?
├── TdsRiskScore: 206AB risk? Lower TDS certificate valid?
└── MsmeRiskScore: Udyam registered? Payment within 45 days?

CustomerScore (0-100)
├── PaymentScore: Do they pay on time?
├── LoyaltyScore: Repeat purchases? Lifetime value?
└── RiskScore: Outstanding balance vs credit limit
```

---

## SECTION 12 — AUTOMATION

Every manual, repetitive action in the ERP must have an automation path.

| Manual Action Today | Automation Design |
|--------------------|-------------------|
| Check if TDS should be deducted on payment | Auto-detect on every payment save |
| Remind about advance tax | Auto-schedule at FY start for each due date |
| Reconcile bank statement | AI reads statement, matches transactions, flags gaps |
| Categorize expenses | AI classifies from description + amount |
| Remind about MSME payment deadline | Event-driven: alert 7 days before 45-day breach |
| Check vendor ITR filer status | Batch job weekly + flag before payment |
| Pull AIS from portal | Scheduled auto-download (with ERI integration) |
| Generate Form 16A | Auto-generate after TDS return is filed |
| Fill ITR from books | Auto-fill from GL + events + AIS |
| Send payment reminders to customers | Auto-schedule from invoice due date |
| Reorder stock | Auto-PO when stock falls below reorder point |
| Close financial month | Guided checklist + auto-post depreciation |
| GST reconciliation | Auto-match GSTR-2A/2B with purchase invoices |

**Automation rule:**
```typescript
// Every automation is a Rule in the Rule Engine
// This means it can be configured, enabled/disabled, and audited

const msmeAlertAutomation: AutomationRule = {
  trigger: 'DAILY_SCHEDULER',
  condition: 'vendor.isMsme AND invoice.isPending AND daysOverdue(invoice) > 38',
  action: 'NOTIFY(owner, CA, "MSME_PAYMENT_RISK", invoice)',
  namespace: 'PURCHASE',
  isEnabled: true
};
```

---

## SECTION 13 — OBSERVABILITY ARCHITECTURE

```
Three Pillars of Observability

METRICS (Prometheus + Grafana)
  Business Metrics:
    erp.sale.count (by business, by day)
    erp.sale.amount (by business, by day)
    erp.tds.detected.count (by section, by month)
    erp.compliance.overdue.count (by domain, by business)
    erp.ai.request.count (by capability, by model)
    
  Technical Metrics:
    http.request.duration_seconds (p50/p95/p99 by endpoint)
    db.query.duration_seconds (p50/p95/p99 by query)
    queue.job.duration_seconds (by queue, by job type)
    rule.evaluation.duration_ms (by rule set)
    cache.hit.rate (by cache layer)
    
TRACES (OpenTelemetry → Jaeger/Tempo)
  Every request gets a trace ID.
  Trace spans: HTTP → Service → Repository → DB → Cache → External API
  Business traces: "User filed ITR" → spans through every service involved
  AI traces: LLM request → embedding search → response → guardrail check
  
LOGS (Structured JSON → Loki/Elasticsearch)
  Every log line is a JSON object:
  {
    "timestamp": "2026-07-03T10:30:00Z",
    "level": "info",
    "traceId": "abc123",
    "tenantId": "uuid",
    "userId": "uuid",
    "module": "income-tax",
    "event": "tds_detected",
    "payload": { "section": "194J", "amount": 55000, "vendorPan": "ABCDE1234F" }
  }
  NEVER log: PAN (unmasked), bank accounts, passwords, API keys
```

**Business Observability Dashboard:**
```
Real-time ERP Health (visible to CTO/engineering):
├── Active sessions: 342
├── API error rate: 0.02% (threshold: 0.5%)
├── Slow queries: 3 (threshold: 10)
├── Queue depth: 127 jobs (threshold: 1000)
├── Rule evaluations/sec: 1,240
├── AI requests/min: 84
├── Background jobs running: 12
└── Failed jobs (last 1hr): 0
```

---

## SECTION 14 — DEVOPS ARCHITECTURE

### Current: A Single VPS with PM2

**Production Architecture Today:**
```
User → Nginx → PM2 (Next.js on :4000, NestJS on :4001) → PostgreSQL (:5555)
```

This is a single point of failure. Postgres goes down → everything stops.
PM2 crashes → no automatic recovery.
Disk full → data loss.

**Required Architecture (phased):**

**Phase 1 (immediate): Resilience on Single VPS**
```
User
  → Cloudflare (DDoS protection + SSL termination)
  → Nginx (rate limiting + request logging)
  → PM2 (cluster mode — 2 processes per app)
  → PostgreSQL (with WAL archiving to remote storage)
  → MinIO (for documents)
  → Redis (for cache + queues)

Monitoring: Prometheus + Grafana Cloud (free tier)
Backup: pg_dump to Hetzner Object Storage every 6 hours
```

**Phase 2 (500 businesses): Managed Database**
```
App (Docker on VPS)
  → AWS RDS PostgreSQL / Supabase / Neon
  → Redis Cloud
  → MinIO → S3

Benefits: automated backups, read replicas, failover, patches
```

**Phase 3 (5,000 businesses): Horizontal Scaling**
```
Load Balancer (AWS ALB / Cloudflare)
  → Backend Container (ECS/k8s, auto-scale 2-10 instances)
  → PostgreSQL Primary + 1 Read Replica
  → Redis Cluster
  → S3 for storage

CI/CD: GitHub Actions → Docker build → push to ECR → ECS rolling deploy
```

**Phase 4 (50,000+ businesses): Kubernetes**
```
Kubernetes (EKS / GKE)
  Services: backend, worker, scheduler, ai-service, integration-hub
  Ingress: Nginx ingress + cert-manager
  Databases: RDS Multi-AZ + Aurora Serverless for read
  Cache: ElastiCache Redis Cluster
  Queues: SQS (or keep BullMQ on Valkey)
  Storage: S3 + CloudFront for document previews
  Secrets: AWS Secrets Manager
  Observability: DataDog / Grafana Cloud
```

**CI/CD Pipeline (implement now):**
```yaml
# .github/workflows/deploy.yml
jobs:
  test:
    - npm run test:unit        # milliseconds
    - npm run test:integration # ~2 minutes (real DB)
    - npm run test:budget      # regression tests
  
  security:
    - npm audit --audit-level=high
    - trufflehog scan
    - trivy image scan
  
  build:
    - docker build + push to registry
  
  deploy:
    - Blue-green swap (zero downtime)
    - Run smoke tests against new version
    - If smoke tests fail → auto-rollback
    - If pass → traffic shift to new version
```

---

## SECTION 15 — API ARCHITECTURE

### 15.1 REST Design Principles

```typescript
// Current problems:
GET /customers                     // OK
GET /inventory                     // OK  
POST /pos/sale                     // OK
// But no versioning, no consistent pagination, no filtering standard

// Required:
GET /api/v1/businesses/{id}/sales
  ?page=1&pageSize=50
  &sort=createdAt:desc
  &filter=amount:gt:1000,status:eq:COMPLETED
  &fields=id,amount,customer.name,createdAt   // sparse fieldsets
  
// Consistent response envelope:
{
  "data": [...],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 1247,
    "hasMore": true
  },
  "links": {
    "self": "/api/v1/...",
    "next": "/api/v1/...?page=2"
  }
}
```

### 15.2 GraphQL Readiness

For partner and mobile integrations, GraphQL reduces over-fetching:
```graphql
query BusinessDashboard($businessId: ID!) {
  business(id: $businessId) {
    pulse {
      currentMonthRevenue
      estimatedTaxLiability
      complianceScore
    }
    upcomingDeadlines(limit: 5) {
      type dueDate daysRemaining amount
    }
    recentAlerts(limit: 3) {
      severity message actionUrl
    }
  }
}
```

Design for GraphQL from the beginning. REST controllers delegate to the same use cases.

### 15.3 Webhook Framework

```prisma
model WebhookEndpoint {
  id          String   @id @default(uuid())
  tenantId    String
  url         String
  secret      String   // for HMAC signature verification
  events      String[] // which events to receive
  isActive    Boolean  @default(true)
  retryPolicy Json
}

model WebhookDelivery {
  id             String   @id @default(uuid())
  endpointId     String
  eventType      String
  payload        Json
  status         String   // PENDING/SUCCESS/FAILED
  httpStatus     Int?
  attempts       Int      @default(0)
  nextRetryAt    DateTime?
  createdAt      DateTime @default(now())
}
```

---

## SECTION 16 — FRONTEND ARCHITECTURE

### 16.1 Design System (must be built before frontend grows)

```
Design System
├── Tokens (color, spacing, typography, shadow, radius)
│   ├── primitive: --color-blue-500: #3B82F6
│   ├── semantic: --color-primary: var(--color-blue-500)
│   └── component: --button-bg: var(--color-primary)
│
├── Components (atomic, molecule, organism)
│   ├── DataTable (virtualized, sortable, filterable, selectable)
│   ├── Form (schema-driven, validation, autosave)
│   ├── Chart (line, bar, donut, heatmap)
│   ├── CommandPalette (Ctrl+K)
│   ├── ActivityFeed (events timeline)
│   ├── StatusBadge (states with colors)
│   └── AmountDisplay (locale-aware, sign-aware, diff-aware)
│
└── Patterns (page layouts, navigation, modals)
    ├── MasterDetail (table + side panel)
    ├── Wizard (multi-step with progress)
    ├── InlineForms (edit-in-place)
    └── SplitView (CA dashboard: client list + client detail)
```

### 16.2 Metadata-Driven UI

```typescript
// The Form engine reads a schema and renders a form — no hardcoded forms
interface FormSchema {
  fields: FieldDefinition[];
  layout: 'SINGLE_COLUMN' | 'TWO_COLUMN' | 'WIZARD';
  validation: ValidationRule[];
  submitAction: string;
}

// Example: Expense form schema (stored in DB, not hardcoded)
const expenseFormSchema: FormSchema = {
  fields: [
    { name: 'date', type: 'DATE', label: 'Date', required: true, defaultValue: 'TODAY' },
    { name: 'category', type: 'SELECT', label: 'Category', 
      options: { source: 'ENUM', enum: 'ExpenseCategory' },
      onChange: 'triggerTdsCheck' },
    { name: 'amount', type: 'MONEY', label: 'Amount', required: true },
    { name: 'vendorPan', type: 'PAN', label: 'Vendor PAN', 
      visibleWhen: 'amount > 10000', validatedOnBlur: true },
    { name: 'paymentMode', type: 'RADIO', label: 'Payment Mode',
      warnWhen: 'paymentMode == CASH AND amount > 10000', 
      warnMessage: 'Cash payments above ₹10,000 may be disallowed under Section 40A(3)' }
  ]
};
```

**Impact:** Adding a new field to an expense form = database record insertion. No code deployment.

### 16.3 Virtualization for Large Lists

```typescript
// 100,000 sale records in a table — cannot render all DOM nodes
// Use virtual scrolling: render only the 20 visible rows

import { useVirtualizer } from '@tanstack/react-virtual';

// DataTable component always uses virtualization
// User sees smooth scrolling through 1M rows
// DOM never has more than ~50 nodes
```

---

## SECTION 17 — PRODUCT STRATEGY

### 17.1 The Platform Moat

**Year 1 Moat:** Only ERP that integrates POS + Purchase + Income Tax in one workflow.
**Year 2 Moat:** ERI registration → programmatic ITR filing. Others cannot match without approval.
**Year 3 Moat:** Business Digital Twin — every competitor shows data, we show understanding.
**Year 5 Moat:** Network effects — when 10,000 CAs use the platform, vendor data, benchmarks, and peer comparison become proprietary data.
**Year 10 Moat:** AI trained on anonymized ERP data from 100,000 businesses. No competitor can train on this data.

### 17.2 The Ecosystem Play

```
Core ERP (our product)
    ↓
Plugin Marketplace (third-party modules)
    ↓
Developer SDK (build on our platform)
    ↓
Partner Network (CA/consultant directory)
    ↓
Data Marketplace (anonymized benchmarks, industry data)
```

When businesses can buy payroll, HR, or manufacturing modules from our marketplace — we become infrastructure. Infrastructure is defensible.

### 17.3 Distribution Strategy

```
Government as Customer (highest trust):
  - Build for e-Invoice mandate compliance first
  - Government tender for school ERP (once School module exists)
  - State GST department partnerships

CA as Channel:
  - CA adopts for one client → introduces to 50 clients
  - CA Marketplace listing → CA finds us, not vice versa

WhatsApp as Growth:
  - Send daily business pulse via WhatsApp
  - Accept voice commands via WhatsApp
  - Every touchpoint is a re-engagement
```

---

## SECTION 18 — FUTURE READINESS (2045 TEST)

### Challenge: Will This Architecture Support These?

**AI Agents (2027):**
"An AI agent manages purchase orders — raising POs, following up on deliveries, flagging discrepancies."
→ The architecture supports this IF: event-driven (agent subscribes to events), tool-use API available (agent calls ERP APIs), human-approval gates exist (agent cannot act without confirmation).
→ Required: Agent permission model, tool registry, human-in-the-loop hooks. ❌ Not designed.

**Voice ERP (2028):**
"Owner speaks: 'How much did we sell yesterday?' or 'Mark this invoice as paid' while driving."
→ Required: Intent recognition → command dispatch → response synthesis.
→ The API-first architecture supports this. Voice is just another input adapter. ✅ Supported IF API-first.

**IoT / RFID / Computer Vision (2029):**
"Camera at warehouse entrance counts incoming stock automatically. RFID tag on asset tracks location."
→ Required: IoT event ingestion endpoint. High-frequency event handling (1000+ events/second per store).
→ The Event Bus supports this IF designed for high throughput. ⚠️ Designed for business events, not IoT telemetry. Separate IoT ingestion service needed.

**Blockchain for Supply Chain (2030):**
"Every GRN is anchored on a blockchain for tamper-proof proof of delivery."
→ Only worth doing if multiple parties (supplier, transporter, buyer) need shared truth.
→ Our architecture: hash chain in the Document Platform provides tamper-evidence for single-party. For multi-party supply chain, add blockchain anchoring as an Integration Hub connector. ✅ Supportable.

**Digital Identity (2031):**
"Business identity is a DID (Decentralized Identifier). No more username/password."
→ Replace authentication with DID resolution. The auth layer is an adapter — can be replaced without touching domain code. ✅ Supportable IF hexagonal architecture is implemented.

**Quantum Data Volume (2035):**
"1 trillion journal entries. 10 billion customers."
→ The CQRS + Event Sourcing + partitioned database design handles this.
→ Horizontal sharding by tenant is the next step. Key: shard key must be `tenantId` from day 1 (it is — every table has `businessId`). ✅ Supportable IF partitioning is done correctly.

**Future Tax Law Changes:**
"India introduces a completely new tax — a Digital Services Tax or Carbon Tax."
→ Add a new RuleNamespace to the Rule Engine.
→ Add a new ComplianceDomain to the Compliance Engine.
→ Add a new bounded context (module).
→ Zero changes to existing modules. ✅ Fully supported IF platform Rule Engine is built.

**Unknown Compliance Requirements:**
"We don't know what law will be passed in 2035."
→ This is why the architecture must be metadata-driven and not law-specific.
→ The Rule Engine, Workflow Engine, and Compliance Engine must be completely law-agnostic.
→ Only configuration changes, not code changes, for any new law.

---

## SECTION 19 — WHAT IS MISSING — COMPREHENSIVE LIST

### Missing Platform Components
1. General Ledger (Chart of Accounts, Journal, Trial Balance)
2. Universal Rule Engine (platform-level, not IT-specific)
3. Platform Workflow Engine with FSM
4. Formula/Expression Engine (for configurable business rules)
5. Platform Audit Engine (hash-chained)
6. Integration Hub (centralized external API management)
7. Document Platform (versioned, encrypted, OCR-capable)
8. AI Platform (OCR, RAG, classification, copilot)
9. Business Digital Twin (real-time pulse)
10. Compliance Knowledge Graph
11. Notification Engine (multi-channel)
12. Platform Scheduler (unified job runner)
13. Search Engine (FTS + semantic)
14. Feature Flag Engine
15. Metadata Engine (custom fields)
16. Number Series Generator
17. Configuration Engine (runtime, not .env)
18. Event Store (for replay and CQRS)
19. Connection Pooler (PgBouncer)
20. Redis (cache + distributed locks + queues)

### Missing ERP Modules
1. GST Module (GSTR-1, 3B, 2A reconciliation)
2. Payroll Module (salary, PF, ESI, professional tax)
3. HRMS (employee master, leave, attendance)
4. Fixed Asset Register (full IT Act + Companies Act depreciation)
5. Banking Module (bank accounts, reconciliation, payments)
6. Manufacturing Module (BOM, production orders, work-in-progress)
7. School ERP (admissions, fees, timetable, grades)
8. Hospital ERP (appointments, OPD, pharmacy, billing)
9. Hotel ERP (reservations, housekeeping, F&B, billing)
10. Transport ERP (fleet, trips, fuel, maintenance)
11. CRM (leads, opportunities, pipelines, activities)
12. MCA / Secretarial Compliance (ROC filings, board meetings, share registry)
13. Project/Construction Module (work orders, billing, subcontractors)
14. Import/Export (customs, IGST, shipping documents)
15. Multi-Currency Treasury

### Missing Tables (beyond previously documented)
1. Account, AccountGroup (GL)
2. Journal, JournalLine (GL)
3. Budget, BudgetLine (financial planning)
4. CostCenter, Profit Center
5. Branch, Warehouse
6. NumberSeries
7. Currency, ExchangeRate
8. BankAccount, BankTransaction, BankReconciliation
9. Employee, EmployeePayroll, SalaryRegister
10. LeavePolicy, LeaveBalance, LeaveApplication
11. GstReturn, GstLine (GSTR-1/3B/2A)
12. GstReconciliation
13. FixedAsset, AssetDepreciation (Companies Act + IT Act)
14. InventoryLot (FIFO/LIFO/WAC valuation)
15. SalesOrder, SalesOrderLine
16. PurchaseContract, SupplierPriceList
17. CustomerCreditLimit, CustomerAgingBucket
18. Alert, AlertRule, AlertHistory
19. AIModel, AIRequest, AIEvaluation
20. KnowledgeChunk (for RAG)
21. WebhookEndpoint, WebhookDelivery
22. Tenant (proper multi-tenancy model)
23. Subscription, SubscriptionPlan
24. BusinessPulse (Digital Twin — covered above)
25. CompetitorBenchmark (industry peer data)

### Missing Security
1. Column-level encryption (PAN, bank account)
2. MFA (TOTP + SMS)
3. Session management (device tracking, concurrent session limits)
4. API rate limiting
5. Passkeys / WebAuthn
6. Audit log tamper detection
7. Secrets rotation policy
8. Penetration testing process

### Missing UX
1. Command Palette (Ctrl+K)
2. Keyboard shortcuts for every action
3. Bulk operations (bulk pay, bulk file, bulk reconcile)
4. Dark mode
5. Offline mode (Service Worker + IndexedDB)
6. Mobile-optimized POS (touch-first)
7. Undo/redo for all actions
8. Form autosave (draft)
9. Guided onboarding wizard
10. Contextual help (hover for explanation of every field)
11. Progress indicators for long operations (ITR computation, report generation)
12. Personalized dashboard
13. Pinned / recently used screens
14. AI assistant (natural language ERP interaction)

### Missing Testing Infrastructure
1. Unit test suite (domain entities)
2. Integration test suite (repositories with real DB)
3. E2E test suite (Playwright for UI)
4. Golden dataset per entity type per AY
5. Budget regression test runner
6. Performance test suite (k6 for load testing)
7. Security test suite (OWASP ZAP)
8. AI evaluation framework
9. Chaos testing (Chaos Monkey equivalent)

### Missing DevOps
1. CI/CD pipeline (GitHub Actions)
2. Docker for app (not just Postgres)
3. Automated database backups + restore verification
4. Monitoring stack (Prometheus + Grafana)
5. Log aggregation (Loki or ELK)
6. Distributed tracing (OpenTelemetry)
7. Secrets management (Vault or AWS Secrets Manager)
8. Disaster recovery procedure (documented + tested)
9. Health check endpoints + synthetic monitoring

---

## SECTION 20 — FINAL CHALLENGE: THE 2045 SCORECARD

### Critical Blockers (stop everything — fix these first)

| # | Blocker |
|---|---------|
| 🔴 B1 | No General Ledger — ITR is impossible without it |
| 🔴 B2 | No Platform Rule Engine — every module hardcodes rules |
| 🔴 B3 | No Event Bus — Digital Twin is impossible, TDS detection is manual |
| 🔴 B4 | No Row-Level Security — tenant data isolation not enforced |
| 🔴 B5 | Random UUID v4 — will cause B-tree fragmentation at scale (fix before data enters) |
| 🔴 B6 | No CI/CD — deploying to production is a manual risk |
| 🔴 B7 | PAN in plaintext — regulatory risk, data breach risk |
| 🔴 B8 | No Integration Hub — external APIs called directly from services |
| 🔴 B9 | No connection pooler — cannot scale beyond ~50 concurrent users |
| 🔴 B10 | No Outbox Pattern — events can be lost if app crashes mid-transaction |

### Architecture Smells

| Smell | Description |
|-------|-------------|
| 🟠 A1 | God Services — services contain 500+ lines mixing business logic, data access, email, events |
| 🟠 A2 | Direct Prisma in controllers — no repository abstraction |
| 🟠 A3 | String-typed domain concepts — `status: String` instead of enums + value objects |
| 🟠 A4 | `documentUrl: String` — 12 models storing raw file paths |
| 🟠 A5 | No domain layer — business logic has no home; it lives in services |
| 🟠 A6 | Cross-module imports — if any exist, must be removed before modules grow |
| 🟠 A7 | Computation is stateful — computation engine modifies state; should be pure |
| 🟠 A8 | Assessment Year as raw string — no validation, no engine, no type safety |

### Design Smells

| Smell | Description |
|-------|-------------|
| 🟡 D1 | IT-specific engines — Rule Engine, Workflow Engine designed for IT only |
| 🟡 D2 | Module-level notification — no platform notification engine |
| 🟡 D3 | Manual TDS detection — should be event-driven, not triggered by user |
| 🟡 D4 | No idempotency anywhere — retry = duplicate data |
| 🟡 D5 | Forms are hardcoded — adding a field requires code + deploy |
| 🟡 D6 | Reports are hardcoded — new report = 2 days of development |
| 🟡 D7 | No API versioning — breaking change = all clients break simultaneously |
| 🟡 D8 | Audit log is IT-specific — no platform audit |
| 🟡 D9 | No error codes — frontend cannot distinguish error types |
| 🟡 D10 | console.log everywhere — not auditable, not structured, not searchable |

### Technical Debt

| Debt | Compound Interest If Not Fixed |
|------|-------------------------------|
| 💸 T1 | No GL → every financial report is an approximation |
| 💸 T2 | Hardcoded rules → emergency deploy after every Budget |
| 💸 T3 | `documentUrl: String` → 12 models need refactoring when storage changes |
| 💸 T4 | No module boundaries → extracting any module = untangle spaghetti imports |
| 💸 T5 | Random UUIDs → B-tree fragmentation, need costly VACUUM at 10M rows |
| 💸 T6 | No event bus → every new cross-module feature requires direct coupling |
| 💸 T7 | PM2 on single VPS → one hardware failure = hours of downtime |
| 💸 T8 | Secrets in .env → rotation requires deployment, breach = all secrets leaked |
| 💸 T9 | No tests → every change is a gamble |
| 💸 T10 | No API versioning → cannot evolve API without breaking all clients |

---

## FINAL ARCHITECTURE SCORE

| Domain | Score | Max | Notes |
|--------|-------|-----|-------|
| Clean Architecture | 10 | 100 | No domain layer, no ports |
| DDD | 5 | 100 | No aggregates, no value objects, no bounded contexts |
| Event-Driven | 15 | 100 | Designed but not built |
| CQRS | 0 | 100 | Not started |
| Security | 20 | 100 | Basic JWT; PAN unencrypted |
| Database Design | 35 | 100 | Prisma correct; UUID, indexes, partitioning missing |
| Performance Architecture | 10 | 100 | No cache, no pooler, no MV |
| Testing | 5 | 100 | No test suite exists |
| DevOps | 10 | 100 | PM2 on single VPS; no CI/CD |
| UX Architecture | 30 | 100 | Frontend exists; no design system, no keyboard nav |
| AI Architecture | 10 | 100 | Designed; not built |
| Platform Services | 10 | 100 | 28/30 engines missing |
| Product Strategy | 55 | 100 | Clear vision; no moat yet |
| Future Readiness | 25 | 100 | Good foundation intent; execution gaps |
| **TOTAL** | **240** | **1400** | **17% — Early Prototype** |

*17% is not a failure. A prototype that knows what it doesn't know is worth more than a product that doesn't.*

---

## FINAL RECOMMENDATION

### The Honest Assessment

The codebase is a well-intentioned prototype that processes real transactions for a real business.
It is NOT an enterprise platform. It is NOT ready for 1,000 businesses, let alone 1 million.
The gap between where it is and where it needs to be is large but bridgeable.

The dangerous path: keep adding features on top of the current foundation.
At 500 businesses: the tech debt collapses. Schema changes break prod. New modules duplicate infrastructure.
The safe path: 6-week platform sprint before adding any more features.

### The Platform Sprint (6 Weeks — Do This Before Anything Else)

```
Week 1: Foundation
  → UUID v7 migration (critical — do before data grows)
  → Row-Level Security on all tables
  → Structured logging (JSON, correlation IDs)
  → Health check endpoints
  → CI/CD pipeline (GitHub Actions → deploy to Hetzner)
  → PgBouncer connection pooling

Week 2: Event Bus
  → BullMQ + Redis setup
  → OutboxEvent table + polling worker
  → Domain event base class
  → POS sale event (first real event)
  → Digital Twin listener (proves the bus works)

Week 3: Rule Engine
  → RuleAuthority, RuleSet, Rule tables
  → Rule evaluator (expression engine with mathjs)
  → Seed all AY 2025-26 and AY 2026-27 tax rules
  → Unit tests for rule evaluation
  → Zero hardcoded tax values from this point

Week 4: General Ledger
  → AccountGroup, Account, Journal, JournalLine tables
  → Auto-post journal from Sale event
  → Auto-post journal from Purchase event
  → Trial Balance query
  → P&L query

Week 5: Document Platform
  → Document model (replace all documentUrl String fields)
  → MinIO integration with hash verification
  → OCR job queue
  → Document access control

Week 6: Platform Hardening
  → Redis cache layer
  → API versioning (/api/v1/)
  → Idempotency keys
  → PAN column encryption
  → Golden test dataset (one per entity type)
  → Load test (k6, baseline at 100 concurrent users)
```

After the platform sprint: build features on a foundation that will last.
Before the platform sprint: every feature is built on sand.

### The North Star

In 2035, a business owner in Vizag, Delhi, or Dubai should be able to say:
*"I don't manage my business. The ERP manages it for me. I just approve things."*

That is the Business Operating System.
That is what this architecture must be capable of becoming.

Build the foundation right. The features will follow.

---

*This document is the final architectural authority.*
*All decisions in conflict with this document must be escalated before implementation.*
*Review quarterly. Update after every Finance Act, every major module addition, every 10x growth.*
