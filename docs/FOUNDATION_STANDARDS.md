# Foundation Standards — The Law of the Codebase

> **Status:** MANDATORY — every engineer reads this before writing line one.
> No exception. No variance without a documented ADR.
>
> **Authority:** CTO / Principal Architect
> **Last updated:** July 2026
> **Scope:** All code in this repository, now and forever.

---

## PREAMBLE

These are not suggestions. These are invariants.

An invariant is a rule that is always true. Breaking it — even once — breaks the trust
that every other module places in the parts you wrote. When the codebase has 50 modules
written by 20 engineers over 10 years, the only thing that keeps it coherent is rules
that nobody broke.

Read this document. Disagree with something? Raise an ADR (Architecture Decision Record).
Win the argument. Change the rule for everyone. But do not quietly violate it.

---

## PART 1 — TENANCY MODEL

### 1.1 What is a Tenant?

A **Tenant** is a `Business`. Every piece of data in the ERP belongs to exactly one Business.
There is no data that belongs to "the platform" and is also visible to tenants.
Platform configuration belongs to the platform. Business data belongs to the business.

```
Tenant = Business
Tenant ID = Business.id (a UUID v7)
```

There is no separate `Tenant` table. `Business` is the tenant root.

### 1.2 Tenant Isolation Rule

**Every table that contains business data MUST have a `businessId` column.**
No exception. If a table does not have `businessId`, it is a platform table.

```prisma
// ✅ Business data table — has businessId
model Sale {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  businessId String   @db.Uuid  // ← MANDATORY on all business data tables
  // ...
}

// ✅ Platform table — no businessId (shared across all tenants)
model RuleSet {
  id        String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  namespace String // INCOME_TAX / GST / PRICING / etc.
  // ...
}

// ❌ WRONG — business data without tenancy
model TdsEntry {
  id     String @id
  amount Decimal
  // Missing businessId — this would expose all TDS data to all tenants
}
```

### 1.3 The Tenant Context

Every authenticated request carries a tenant context. Services receive it via injection.
Services NEVER query without the tenant filter.

```typescript
// The tenant context is injected — never passed manually
@Injectable()
export class SaleService {
  constructor(
    private readonly repo: SaleRepository,
    private readonly tenantContext: TenantContext  // ← always injected
  ) {}

  async findAll(): Promise<Sale[]> {
    // ✅ Correct — always scoped to tenant
    return this.repo.findAll({ businessId: this.tenantContext.businessId });
  }

  async findById(id: string): Promise<Sale> {
    // ✅ Correct — includes businessId even for single-entity fetch
    return this.repo.findOne({ id, businessId: this.tenantContext.businessId });
  }
}
```

### 1.4 Row-Level Security (Database Layer)

RLS is the last line of defense. Even if application code has a bug that omits `businessId`,
the database will reject the query.

```sql
-- Template for every business data table
ALTER TABLE "<TableName>" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "<TableName>" FORCE ROW LEVEL SECURITY;

CREATE POLICY "<TableName>_tenant_isolation" ON "<TableName>"
  USING ("businessId" = current_setting('app.current_tenant_id')::uuid);
```

The application sets `app.current_tenant_id` at the start of every database transaction.
If it is not set, ALL queries return empty results. This is intentional.

### 1.5 Roles and Their Tenant Access

| Role | Tenant Access | Rule |
|------|--------------|-------|
| `SUPER_ADMIN` | All tenants (platform admin) | Set via service account, never a human user |
| `OWNER` | Own business only | `businessId = user.businessId` |
| `MANAGER` | Own business only | Same as OWNER |
| `CASHIER` | Own business, POS only | Same business, reduced module access |
| `CA` | All businesses in `CaBusinessLink` | `businessId IN (caLinkedBusinessIds)` |
| `EMPLOYEE` | Own business, HR module only | Same business, reduced module access |
| `SYSTEM_JOB` | All (background jobs) | Uses service credentials, not user session |

### 1.6 Cross-Tenant Operations

Cross-tenant operations are NEVER permitted except by `SUPER_ADMIN` or `SYSTEM_JOB`.
A CA accessing client data is NOT cross-tenant. It is CaBusinessLink-scoped.
The CA's session is scoped to the *selected client's* businessId for the duration of that tab/request.

```typescript
// CA switching to a client
async function switchToClient(caUserId: string, targetBusinessId: string): Promise<Token> {
  const link = await CaBusinessLink.findOne({ caUserId, businessId: targetBusinessId, isActive: true });
  if (!link) throw new UnauthorizedError('CA is not linked to this business');
  
  // Issue a scoped token — CA operates AS that business
  return issueToken({
    userId: caUserId,
    role: 'CA',
    businessId: targetBusinessId, // ← scoped to client
    caLinkedAs: true              // ← signals this is a CA acting on behalf
  });
}
```

---

## PART 2 — NAMING CONVENTIONS (NOMENCLATURE)

### 2.1 Database — Tables

| Rule | Example |
|------|---------|
| PascalCase, singular | `Sale` not `sales` or `Sales` |
| Full English words, no abbreviations | `BusinessPartner` not `BizPartner` |
| Junction tables: both entity names | `CaBusinessLink` not `ca_business` |
| Platform tables: no prefix | `RuleSet`, `WorkflowInstance` |
| Module tables: no prefix (module is context) | `ItReturn`, `TdsEntry`, `GstReturn` |
| Avoid generic names | `SaleInvoice` not `Invoice` (unless truly generic) |

### 2.2 Database — Columns

| Rule | Example |
|------|---------|
| camelCase | `businessId`, `createdAt`, `totalAmount` |
| Foreign keys: `{entity}Id` | `businessId`, `supplierId`, `createdById` |
| Booleans: `is` or `has` prefix | `isActive`, `hasGst`, `isPaid` |
| Timestamps: past tense | `createdAt`, `updatedAt`, `deletedAt`, `filedAt` |
| Amounts: explicit unit | `totalAmount` not `total`; `taxAmountInr` for foreign currency |
| Counts: `{noun}Count` | `itemCount`, `failureCount` |
| Never abbreviate | `description` not `desc`; `quantity` not `qty` |
| Enum columns: same name as enum | `status PaymentStatus`, `type ExpenseCategory` |

### 2.3 Database — Indexes

```sql
-- Pattern: idx_{table}_{columns}_{qualifier}
CREATE INDEX idx_sale_business_created ON "Sale" ("businessId", "createdAt" DESC);
CREATE INDEX idx_tds_entry_section_pending ON "TdsEntry" ("section") WHERE "status" = 'PENDING';
CREATE UNIQUE INDEX idx_number_series_business_name ON "NumberSeries" ("businessId", "name", "fiscalYear");
```

### 2.4 Database — Constraints

```sql
-- Pattern: {table}_{columns}_{constraint_type}
ALTER TABLE "JournalLine" ADD CONSTRAINT journalline_amounts_positive CHECK ("debit" >= 0 AND "credit" >= 0);
ALTER TABLE "JournalLine" ADD CONSTRAINT journalline_debit_xor_credit CHECK (("debit" = 0) != ("credit" = 0));
ALTER TABLE "Business" ADD CONSTRAINT business_pan_format CHECK ("pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$' OR "pan" IS NULL);
```

### 2.5 TypeScript — Files

| Type | Convention | Example |
|------|-----------|---------|
| Domain entity | `{entity}.entity.ts` | `sale.entity.ts` |
| Value object | `{name}.vo.ts` | `pan.vo.ts`, `money.vo.ts` |
| Repository interface | `{entity}.repository.ts` | `sale.repository.ts` |
| Prisma repository | `prisma-{entity}.repository.ts` | `prisma-sale.repository.ts` |
| Command | `{verb}-{noun}.command.ts` | `create-sale.command.ts` |
| Query | `get-{noun}.query.ts` | `get-sale-summary.query.ts` |
| Handler | `{command/query}.handler.ts` | `create-sale.handler.ts` |
| DTO | `{noun}.dto.ts` | `create-sale.dto.ts`, `sale-response.dto.ts` |
| Controller | `{noun}.controller.ts` | `sale.controller.ts` |
| Service | `{noun}.service.ts` | `sale.service.ts` |
| Module | `{noun}.module.ts` | `sale.module.ts` |
| Domain Event | `{noun}-{past-tense}.event.ts` | `sale-completed.event.ts` |
| Guard | `{name}.guard.ts` | `tenant.guard.ts`, `jwt-auth.guard.ts` |
| Decorator | `{name}.decorator.ts` | `current-user.decorator.ts` |
| Specification | `{condition}.spec.ts` (domain) | `msme-breach.spec.ts` |
| Test | `{name}.{unit|int|e2e}.spec.ts` | `sale.unit.spec.ts` |

### 2.6 TypeScript — Classes and Interfaces

| Type | Convention | Example |
|------|-----------|---------|
| Domain entity class | PascalCase | `Sale`, `ItReturn`, `TdsEntry` |
| Value object class | PascalCase | `Pan`, `Money`, `Gstin`, `AssessmentYear` |
| Interface | `I` prefix | `ISaleRepository`, `IEventBus` |
| Abstract class | `Abstract` prefix | `AbstractRepository` |
| DTO | PascalCase + Dto suffix | `CreateSaleDto`, `SaleResponseDto` |
| Command | PascalCase + Command suffix | `CreateSaleCommand` |
| Query | PascalCase + Query suffix | `GetSaleSummaryQuery` |
| Handler | PascalCase + Handler suffix | `CreateSaleCommandHandler` |
| Event | PascalCase + Event suffix | `SaleCompletedEvent` |
| Error | PascalCase + Error suffix | `InvalidPanError`, `TenantNotFoundError` |
| Enum | PascalCase | `PaymentMode`, `ExpenseCategory` |
| Type alias | PascalCase | `SaleId`, `BusinessId` |

### 2.7 TypeScript — Methods and Variables

| Rule | Example |
|------|---------|
| camelCase | `createSale`, `findByBusinessId` |
| Verb-first methods | `create`, `update`, `delete`, `find`, `get`, `compute`, `validate` |
| Boolean methods: `is`/`has`/`can` | `isPaid()`, `hasGst()`, `canFileItr()` |
| Async methods: no `async` suffix | `findById` not `findByIdAsync` |
| No abbreviations | `supplierId` not `supId`; `assessmentYear` not `ay` |
| Constants: SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_PAGE_SIZE` |

### 2.8 API Endpoints

```
Pattern: /api/{version}/{resource}/{id?}/{sub-resource?}/{action?}

Versioning: /api/v1/, /api/v2/
Resource: plural, kebab-case
Actions: verb phrases for non-CRUD operations

Examples:
GET    /api/v1/businesses/{id}/sales                    # list sales for a business
POST   /api/v1/businesses/{id}/sales                    # create a sale
GET    /api/v1/businesses/{id}/sales/{saleId}           # get one sale
PATCH  /api/v1/businesses/{id}/sales/{saleId}           # update a sale
DELETE /api/v1/businesses/{id}/sales/{saleId}           # delete a sale

POST   /api/v1/businesses/{id}/it-returns/{ay}/compute  # action on a resource
POST   /api/v1/businesses/{id}/it-returns/{ay}/submit   # action: submit to CA
GET    /api/v1/businesses/{id}/tds-entries/detect       # action: run TDS detection
POST   /api/v1/businesses/{id}/ais/upload               # action: upload AIS

Never:
GET    /api/computeTax         ← verb in path
POST   /api/sale/create        ← action in path for CRUD
GET    /api/v1/getTdsByBusiness ← Hungarian notation
```

### 2.9 Domain Events

```
Pattern: {namespace}.{aggregate}.{past-tense-verb}

Namespace: erp.{module}
Aggregate: lowercase
Verb: past tense, lowercase

Examples:
erp.pos.sale.completed
erp.pos.sale.voided
erp.purchase.invoice.created
erp.purchase.invoice.paid
erp.purchase.order.approved
erp.inventory.stock.below-reorder-point
erp.tax.tds-entry.detected
erp.tax.it-return.submitted
erp.tax.it-return.filed
erp.tax.advance-tax.payment-due
erp.compliance.deadline.approaching
erp.compliance.deadline.missed
erp.compliance.notice.received
erp.document.ocr.completed
erp.workflow.step.completed
erp.workflow.approval.granted
erp.workflow.approval.rejected
erp.ai.classification.completed
```

### 2.10 Queue Names

```
Pattern: {namespace}.{purpose}.{priority}

erp.tax.tds-detection.high
erp.tax.computation.normal
erp.document.ocr.normal
erp.notification.whatsapp.normal
erp.notification.email.low
erp.report.generation.low
erp.integration.it-portal.normal
erp.integration.traces.normal
erp.integration.gstn.normal
erp.scheduler.deadlines.high
erp.audit.event-log.low
```

### 2.11 Environment Variables

```
Pattern: {MODULE}_{SERVICE}_{PROPERTY}

Database:
DATABASE_URL
DATABASE_POOL_SIZE
DATABASE_MAX_CONNECTIONS

Redis:
REDIS_URL
REDIS_PASSWORD

Authentication:
JWT_SECRET
JWT_ACCESS_EXPIRY
JWT_REFRESH_EXPIRY

External Integrations:
IT_PORTAL_BASE_URL
IT_PORTAL_CLIENT_ID
IT_PORTAL_CLIENT_SECRET
TRACES_BASE_URL
TRACES_API_KEY
GSTN_BASE_URL
GSTN_API_KEY
WHATSAPP_API_URL
WHATSAPP_API_TOKEN
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
GOOGLE_VISION_API_KEY

Storage:
MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET_DOCUMENTS
MINIO_BUCKET_TEMP

AI:
OPENAI_API_KEY
ANTHROPIC_API_KEY
AI_DEFAULT_MODEL
AI_MAX_TOKENS

Application:
APP_ENV          (development | staging | production)
APP_PORT
APP_LOG_LEVEL    (debug | info | warn | error)
FRONTEND_URL
BACKEND_URL
```

### 2.12 Feature Flag Keys

```
Pattern: {module}.{feature}.{variant?}

pos.loose-weighing.enabled
pos.multi-payment.enabled
inventory.expiry-tracking.enabled
tax.ais-reconciliation.enabled
tax.itr-filing.enabled
tax.ai-notice-explainer.enabled
platform.ai-copilot.enabled
platform.dark-mode.enabled
platform.graphql.enabled
```

### 2.13 Error Codes

```
Pattern: {MODULE}_{ENTITY}_{ERROR_TYPE}

TAX_RETURN_NOT_FOUND
TAX_RETURN_INVALID_STATE_TRANSITION
TAX_RULE_NOT_FOUND_FOR_ASSESSMENT_YEAR
TDS_ENTRY_THRESHOLD_NOT_MET
TDS_ENTRY_VENDOR_PAN_REQUIRED
PURCHASE_INVOICE_CANNOT_DELETE_PAID
AUTH_TOKEN_EXPIRED
AUTH_TENANT_NOT_FOUND
DOCUMENT_UPLOAD_VIRUS_DETECTED
WORKFLOW_STEP_ACTOR_UNAUTHORIZED
INTEGRATION_IT_PORTAL_TIMEOUT
INTEGRATION_TRACES_RATE_LIMITED

// Error response shape (always consistent)
{
  "error": {
    "code": "TAX_RETURN_NOT_FOUND",
    "message": "Income tax return for AY 2025-26 not found",
    "details": {},
    "traceId": "abc123",
    "timestamp": "2026-07-03T10:30:00Z"
  }
}
```

### 2.14 Module Folder Names

```
Pattern: kebab-case, plural for collections, singular for platform services

src/
├── platform/
│   ├── rule-engine/
│   ├── workflow-engine/
│   ├── event-bus/
│   ├── document-service/
│   ├── audit-engine/
│   ├── notification-engine/
│   ├── ai-platform/
│   ├── integration-hub/
│   ├── scheduler/
│   └── search-engine/
│
├── erp-core/
│   ├── general-ledger/
│   ├── master-data/
│   ├── digital-twin/
│   └── compliance-engine/
│
└── modules/
    ├── income-tax/
    ├── gst/
    ├── pos/
    ├── inventory/
    ├── purchases/
    ├── sales/
    ├── customers/
    ├── suppliers/
    └── reports/
```

---

## PART 3 — ARCHITECTURAL RULES

These are invariants. Breaking one requires an ADR that gets merged to `main`.

### Rule 1: No Cross-Module Imports

A module CANNOT import from another module's internals.
All cross-module communication goes through:
(a) Domain Events on the Event Bus
(b) The shared Public API (`index.ts` barrel)

```typescript
// ❌ FORBIDDEN — income-tax importing from purchases internals
import { PurchaseRepository } from '@modules/purchases/repositories/purchase.repository';

// ✅ ALLOWED — consuming a public event
@OnEvent('erp.purchase.invoice.paid')
async handleInvoicePaid(event: PurchaseInvoicePaidEvent): void { ... }

// ✅ ALLOWED — consuming a public DTO from the barrel
import { SupplierDto } from '@modules/suppliers'; // from index.ts only
```

**ESLint enforcement:**
```json
"no-restricted-imports": ["error", {
  "patterns": [
    "@modules/*/repositories/*",
    "@modules/*/services/*",
    "@modules/*/handlers/*"
  ]
}]
```

### Rule 2: No Hardcoded Tax Rates, Thresholds, or Form Names

No number representing a tax rate, threshold, section limit, or percentage lives in code.
No string representing a form name lives in code.

```typescript
// ❌ FORBIDDEN
const TDS_194J_THRESHOLD = 50000;
const TDS_194J_RATE = 0.10;
const FORM_24Q_NEW_NAME = 'Form 138';

// ✅ REQUIRED — all values come from the Rule Engine
const rule = await this.ruleEngine.getRule({
  namespace: 'INCOME_TAX',
  category: 'TDS_THRESHOLD',
  section: '194J',
  assessmentYear: context.assessmentYear
});
const threshold = rule.parameters.threshold;
```

**The only exception:** AY format validation regex (`/^AY [0-9]{4}-[0-9]{2}$/`) may live in a value object.

### Rule 3: No documentUrl String Fields

No Prisma model stores a file path or URL as a raw String.
All document references go through the Document Platform.

```prisma
// ❌ FORBIDDEN
model ItNotice {
  documentUrl String?  // raw URL — forbidden
}

// ✅ REQUIRED
model ItNotice {
  documentId String?   @db.Uuid
  document   Document? @relation(fields: [documentId], references: [id])
}
```

### Rule 4: No Direct External API Calls from Services

Services NEVER call `axios.get('https://incometax.gov.in/...')` directly.
All external calls go through the Integration Hub.

```typescript
// ❌ FORBIDDEN
async fetchAis(pan: string): Promise<AisData> {
  const response = await axios.get(`${IT_PORTAL_URL}/ais/${pan}`, { headers: { ... } });
  return response.data;
}

// ✅ REQUIRED
async fetchAis(pan: Pan): Promise<AisData> {
  return this.integrationHub.call('IT_PORTAL', 'fetchAis', { pan: pan.toString() });
}
```

### Rule 5: No console.log in Application Code

All logging goes through the Logger service.
Log levels must be appropriate. Every log line includes context (traceId, tenantId, module).

```typescript
// ❌ FORBIDDEN
console.log('Creating sale', sale);
console.error('TDS detection failed');

// ✅ REQUIRED
this.logger.log('Sale created', { saleId: sale.id, amount: sale.totalAmount.toFixed(2) });
this.logger.error('TDS detection failed', { error: err.message, paymentId: payment.id });
```

### Rule 6: All Mutations are Idempotent

Every POST/PATCH/DELETE endpoint accepts an `Idempotency-Key` header.
Processing the same key twice returns the same result without side effects.

```typescript
// Required in every mutating controller method
@Post()
async create(
  @Body() dto: CreateExpenseDto,
  @Headers('Idempotency-Key') idempotencyKey: string
): Promise<ExpenseDto> {
  const existing = await this.idempotency.get(idempotencyKey);
  if (existing) return existing as ExpenseDto;
  
  const result = await this.handler.handle(new CreateExpenseCommand(dto));
  await this.idempotency.set(idempotencyKey, result);
  return result;
}
```

### Rule 7: Events Must Be Written to Outbox in the Same Transaction

Any database write that should produce an event must write to `OutboxEvent` in the same transaction.
Never publish to BullMQ directly from a service.

```typescript
// ❌ FORBIDDEN — event published separately, can be lost
await this.prisma.sale.create({ data: saleData });
await this.eventBus.publish(new SaleCompletedEvent(sale)); // may fail

// ✅ REQUIRED — atomic with the data write
await this.prisma.$transaction(async (tx) => {
  const sale = await tx.sale.create({ data: saleData });
  await tx.outboxEvent.create({
    data: {
      eventType: 'erp.pos.sale.completed',
      aggregateId: sale.id,
      payload: { saleId: sale.id, amount: sale.totalAmount, businessId: sale.businessId }
    }
  });
});
```

### Rule 8: All Aggregates Have Optimistic Locking

Every aggregate root table has a `version` column.
Updates must include `WHERE version = $expectedVersion`. Mismatch = retry.

```prisma
model ItReturn {
  id      String @id
  version Int    @default(0)
  // ...
}
```

```typescript
// Update with version check
await this.prisma.itReturn.update({
  where: { id, version: expectedVersion }, // ← optimistic lock
  data: { ...updates, version: { increment: 1 } }
});
// If no rows updated → version conflict → throw OptimisticLockError → caller retries
```

### Rule 9: PAN is Never Logged, Never in URLs, Never Serialized Raw

PAN is a `Pan` value object. It serializes to a masked form by default.
Logging a `Pan` object produces the masked version automatically.
Displaying full PAN in UI requires explicit `canViewFullPan` permission check.

```typescript
// ❌ FORBIDDEN
this.logger.log('Processing TDS for PAN: ' + vendor.pan);  // full PAN in logs
res.redirect(`/vendor/${vendor.pan}/tds`);                  // PAN in URL
JSON.stringify({ pan: vendor.pan });                        // raw PAN in response

// ✅ REQUIRED — Pan value object masks automatically
const pan = Pan.create(vendor.pan).unwrap();
this.logger.log('Processing TDS', { pan: pan.toMasked() }); // ABCXX1234X
```

### Rule 10: No `any` Type in TypeScript

`any` disables the type checker. It is banned.
Use `unknown` when the type is truly unknown, then narrow it.

```typescript
// ❌ FORBIDDEN
function processRuleOutput(output: any): void { ... }

// ✅ REQUIRED
function processRuleOutput(output: unknown): void {
  if (!isRuleOutput(output)) throw new InvalidRuleOutputError();
  // now output is typed
}
```

ESLint rule: `"@typescript-eslint/no-explicit-any": "error"`

### Rule 11: No Raw Strings for Domain Concepts

Domain concepts are value objects or branded types, not raw strings.

```typescript
// ❌ FORBIDDEN
function computeTax(businessId: string, assessmentYear: string): TaxResult

// ✅ REQUIRED
function computeTax(businessId: BusinessId, assessmentYear: AssessmentYear): TaxResult

// Branded types at minimum
type BusinessId = string & { readonly __brand: 'BusinessId' };
type AssessmentYear = string & { readonly __brand: 'AssessmentYear' };
```

### Rule 12: All Financial Amounts Use Decimal, Never Float

`number` / `float` cannot represent ₹2,45,678.50 exactly.
All money uses Prisma's `Decimal` type (maps to PostgreSQL `NUMERIC(18,2)`).
All computation uses `Decimal.js`.

```typescript
// ❌ FORBIDDEN
const tax = income * 0.10; // floating point error

// ✅ REQUIRED
const tax = income.mul(new Decimal('0.10')); // exact
```

```prisma
// ❌ FORBIDDEN
totalAmount Float

// ✅ REQUIRED
totalAmount Decimal @db.Decimal(18, 2)
```

### Rule 13: Database Migrations are Forward-Only

Never write a migration that drops a column, drops a table, or renames a column on a live database.
Use the expand-contract pattern:

```
Phase 1 (Expand):
  → Add new column (nullable)
  → Deploy new code that writes to both old and new columns
  
Phase 2 (Migrate):
  → Backfill old data to new column
  → Make new column non-nullable
  
Phase 3 (Contract):
  → Remove writes to old column
  → Deploy
  
Phase 4 (Cleanup):
  → Drop old column (now safe)
```

Never run Phase 4 without verifying Phase 3 has been in production for at least one week.

### Rule 14: UUIDs are v7 (Time-Ordered)

All new `@id` fields generate UUID v7. Never UUID v4 (random).

```prisma
model Sale {
  id String @id @default(dbgenerated("gen_ulid()")) @db.Char(26) // ULID preferred
  // OR
  id String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid // UUID v7
}
```

**Exception:** Existing tables that already have UUID v4 primary keys are not migrated (too disruptive).
All NEW tables use UUID v7 or ULID from day one.

### Rule 15: Every Background Job Has a Dead Letter Queue

No fire-and-forget jobs. Every job that can fail must have a DLQ.

```typescript
const queue = new Queue('erp.tax.computation', {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: false // keep failed jobs for inspection
  }
});

const dlqQueue = new Queue('erp.tax.computation.dlq');
```

Failed jobs after exhausting retries move to the DLQ.
A dashboard shows DLQ depth. Ops team reviews and re-queues or dismisses.

---

## PART 4 — MODULE BOUNDARY RULES

### 4.1 What Each Layer Can Import

```
platform/     → imports: nothing from modules/, nothing from erp-core/
erp-core/     → imports: from platform/ only
modules/      → imports: from platform/, from erp-core/, from shared-kernel/ only
              → NEVER imports from another module's internals
```

### 4.2 What a Module Exports (Public Contract)

Each module has an `index.ts` that is the ONLY import point for other modules.

```typescript
// modules/suppliers/index.ts — PUBLIC CONTRACT
export { SupplierDto } from './dto/supplier.dto';
export { SupplierSummaryDto } from './dto/supplier-summary.dto';
export { SupplierModule } from './supplier.module';
// NOT exported: repositories, handlers, internal services, domain entities
```

### 4.3 Module Registration

Every module declares its events (published and subscribed) in a manifest:

```typescript
// modules/income-tax/it.module.ts
@Module({
  // ...
  exports: [ItReturnService], // only public services
})
export class IncomeTaxModule implements OnModuleInit {
  // Events this module publishes
  static readonly PUBLISHES = [
    'erp.tax.it-return.submitted',
    'erp.tax.it-return.filed',
    'erp.tax.tds-entry.detected',
  ];
  
  // Events this module subscribes to
  static readonly SUBSCRIBES = [
    'erp.purchase.invoice.paid',
    'erp.pos.sale.completed',
    'erp.compliance.deadline.approaching',
  ];
}
```

---

## PART 5 — TESTING RULES

### 5.1 Test Types and Their Rules

| Type | Location | DB? | Speed | Required For |
|------|----------|-----|-------|-------------|
| Unit | `*.unit.spec.ts` | No (in-memory) | <1ms/test | Domain entities, value objects, pure functions |
| Integration | `*.int.spec.ts` | Yes (test DB) | <100ms/test | Repositories, services |
| E2E | `*.e2e.spec.ts` | Yes (test DB) | <5s/test | Controllers, full flow |
| Golden | `test/golden/` | Yes | <30s | Tax computation per AY |
| Budget Regression | `test/regression/` | Yes | <2min | After every rule change |

### 5.2 Test Naming

```typescript
describe('ItReturn', () => {
  describe('computeTax', () => {
    it('should return zero tax when income is below ₹4L under new regime AY 2026-27', () => {});
    it('should apply 87A rebate when income is exactly ₹12L under new regime AY 2026-27', () => {});
    it('should throw when assessment year is not in the Rule Engine', () => {});
  });
});
```

Test names must describe the BEHAVIOR, not the implementation.
Bad: `it('should work correctly')`. Good: `it('should disallow 40A3 cash payment above ₹10,000')`.

### 5.3 Test Data Rules

- No production PAN numbers in test data. Use `TESTX1234T` pattern.
- No production GSTIN numbers. Use `27TESTX1234T1Z1` pattern.
- No production bank accounts. Use `000012345678` pattern.
- Golden datasets live in `test/golden/` and are committed to git.
- One golden dataset file = one business scenario (not one module).

---

## PART 6 — GIT AND DEPLOYMENT RULES

### 6.1 Branch Strategy

```
main           → production. Protected. Merge via PR only. CI must pass.
staging        → staging environment. Auto-deployed from PRs.
feat/{ticket}  → feature branches. Branch from main. PR to main.
fix/{ticket}   → bug fix branches.
chore/{topic}  → non-feature changes (deps, docs, config).
```

### 6.2 Commit Message Format

```
{type}({scope}): {subject}

{body — optional, explain WHY not WHAT}

{footer — optional, closes #123}

Types: feat, fix, refactor, chore, test, docs, perf, security
Scopes: pos, purchase, income-tax, platform, rule-engine, auth, db, ci

Examples:
feat(income-tax): add AIS reconciliation upload flow
fix(tds): correct 194I threshold to ₹6L per Budget 2025
chore(db): add missing index on expense.businessId
security(auth): enforce RLS on ItReturn table
perf(pos): add materialized view for daily sales summary
```

### 6.3 PR Rules

- PR must have a description explaining what and why.
- PR must link to a ticket/task.
- No PR merges with failing tests.
- No PR merges with `eslint` errors.
- No PR merges with `npm audit` high severity issues.
- Schema changes: include the Prisma migration file + review the generated SQL.
- No direct push to `main`. Ever.

### 6.4 Deployment Rules

- All deployments go through CI/CD. No manual `ssh + git pull + pm2 restart`.
- Database migrations run BEFORE the new code is deployed (backward compatible).
- If a migration is not backward compatible → use expand-contract (Rule 13).
- After deployment: run smoke tests. If any fail → auto-rollback.
- Never deploy on Friday afternoon. Deploy Monday–Thursday before 3pm.

---

## PART 7 — FINANCIAL CALCULATION RULES

### 7.1 Rounding Rules

Indian tax law specifies rounding rules. These are codified here:

```typescript
enum RoundingRule {
  NEAREST_RUPEE,    // tax amounts rounded to nearest ₹1
  NEAREST_10,       // some penalties rounded to nearest ₹10
  TRUNCATE,         // TDS computed: fractions dropped (not rounded)
  CEILING,          // some surcharge computations
}

class IndianTaxRounder {
  static roundToNearestRupee(amount: Decimal): Decimal {
    return amount.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  }
  
  static truncate(amount: Decimal): Decimal {
    return amount.toDecimalPlaces(0, Decimal.ROUND_DOWN);
  }
}
```

### 7.2 Assessment Year vs Financial Year vs Tax Year

These are defined once, used everywhere:

```typescript
// Financial Year: the year of income (April to March)
// Assessment Year: the year in which income is assessed (= FY + 1)
// Tax Year (IT Act 2025): same period as FY but new terminology

class AssessmentYear {
  // 'AY 2026-27' means: FY 2025-26 income, assessed in 2026-27
  static fromFY(fy: string): AssessmentYear  // 'FY 2025-26' → 'AY 2026-27'
  static fromLabel(label: string): AssessmentYear  // 'AY 2026-27'
  static current(): AssessmentYear  // based on today's date
  
  get financialYear(): string  // 'FY 2025-26'
  get taxYear(): string        // 'TY 2026-27' (IT Act 2025 terminology)
  get startDate(): Date        // 2025-04-01
  get endDate(): Date          // 2026-03-31
  get assessmentEndDate(): Date // 2026-03-31 (when returns must be filed)
  get actApplicable(): 'IT_ACT_1961' | 'IT_ACT_2025'
}
```

### 7.3 Currency Handling

All amounts are stored in INR (Paisa-precision: `NUMERIC(18,2)`).
Foreign currency amounts are stored as-is with a `currencyCode` column + the INR equivalent.

```prisma
model PurchaseInvoice {
  amount         Decimal  @db.Decimal(18, 2) // original currency
  currencyCode   String   @default("INR") @db.Char(3)
  amountInr      Decimal  @db.Decimal(18, 2) // always INR equivalent
  exchangeRate   Decimal? @db.Decimal(18, 6) // rate used for conversion
  exchangeRateId String?  // reference to ExchangeRate table
}
```

---

## PART 8 — COMPLIANCE CODING RULES

### 8.1 Compliance = Configuration, Not Code

Any behavior that is mandated by law and can change is configuration.
If a Budget change would require a code change → it is a design defect.

| Example | Wrong | Right |
|---------|-------|-------|
| TDS threshold for 194J | `const THRESHOLD = 50000` | Rule Engine: `rule.parameters.threshold` |
| New regime tax slab | `if (income > 400000 && income <= 800000) tax = income * 0.05` | Rule Engine: slab computation |
| Form 24Q renamed to Form 138 | `const FORM_NAME = 'Form 138'` | Rule Engine: `rule.parameters.formName` |
| ITR-U penalty bands | `const PENALTY = 0.25` (12 months), `0.50` (24 months) | Rule Engine: penalty schedule |

### 8.2 Every Computation Must Be Explainable

No black box computations. Every computed number must trace to:
1. Which rule was applied (Rule.id)
2. Which Finance Act (RuleSet.authorityId)
3. Which inputs were used (ComputationJob.inputSnapshot)
4. When it was computed (ComputationJob.computedAt)

### 8.3 Dual Act Support (IT Act 1961 + IT Act 2025)

AY 2026-27 and earlier: IT Act 1961 section numbering.
TY 2026-27 and later: IT Act 2025 section numbering.

Every `Rule` record has:
```prisma
model Rule {
  sectionRef1961 String?  // 'Section 194J' — for AY ≤ 2026-27
  sectionRef2025 String?  // equivalent section in IT Act 2025 — for TY ≥ 2026-27
}
```

UI always displays the section relevant to the filing period being worked on.

---

## QUICK REFERENCE CARD

```
WHEN IN DOUBT, ASK:

1. Does this belong to a tenant?
   YES → add businessId column
   NO  → it's a platform table

2. Is this a tax rate, threshold, or form name?
   YES → it goes in the Rule Engine, not in code

3. Am I storing a file?
   YES → use Document model, not documentUrl String

4. Am I calling an external API?
   YES → go through Integration Hub

5. Am I communicating with another module?
   YES → use an event, not a direct import

6. Is this an amount of money?
   YES → use Decimal, not number/float

7. Is this a PAN, GSTIN, or other sensitive identifier?
   YES → use a Value Object, not a raw string

8. Am I publishing an event?
   YES → write to OutboxEvent in the SAME transaction

9. Am I writing a test?
   YES → describe the BEHAVIOR in the test name

10. Am I ready to deploy?
    ONLY IF → CI passes, no eslint errors, migration is backward-compatible,
              it's Mon–Thu before 3pm, you have a rollback plan
```

---

*This document is the law. When code conflicts with this document, the code is wrong.*
*When this document is wrong, file an ADR and update this document.*
*The goal: any engineer, on any day, reading this document knows exactly how to write code for this platform.*

---

## PART N — ARCHITECTURE FITNESS FUNCTIONS (CI Gates)

Run these before every merge. All must return exit 0 / empty output.

```bash
# 1. No documentUrl columns in schema
grep -rn "documentUrl\|fileUrl\|attachmentUrl" backend/prisma/schema.prisma
# Expected: no output (exit 0)

# 2. No new Date() in platform code (excluding clock service and test files)
grep -rn "new Date()" backend/src/platform/ \
  --include="*.ts" \
  --exclude="*clock*" \
  --exclude="*.spec.ts" \
  --exclude="*.seed.ts"
# Expected: no output

# 3. TypeScript build must pass
cd backend && npm run build
# Expected: exit 0

# 4. No hardcoded tax rates — check for suspicious number literals in services
grep -rEn "\b0\.(05|10|12|18|28)\b" backend/src/ \
  --include="*.ts" \
  --exclude-dir="rule-engine" \
  --exclude="*.spec.ts"
# Expected: no output
```

---

## PART N+1 — SUBSCRIPTION / PLAN ENFORCEMENT

Every `Business` gets a `Tenant` row on signup (created by `OnboardingService`).

| Plan | planExpiresAt | Behaviour |
|------|--------------|-----------|
| FREE | null | Always accessible (feature-limited by featureFlags) |
| STARTER / PROFESSIONAL | Set to +1 year from signup | Access blocked after expiry |
| ENTERPRISE | null or custom | Manual control |

`PlanGuard` (`src/platform/billing/plan.guard.ts`) runs on every authenticated request:
- If `planExpiresAt` has passed → sets `planStatus = EXPIRED`, returns `403 PLAN_EXPIRED`
- If `planStatus` is already `EXPIRED` or `SUSPENDED` → returns `403` immediately

**Renewal rule:** Extend `planExpiresAt` by the purchased duration from **today**, not from the old expiry date.
This prevents accidental "time credit" accumulation on late renewals.
