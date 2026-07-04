# RED TEAM ARCHITECTURE REVIEW
## Elite Review Board — Adversarial Findings

> **Board Composition:** SAP Chief Architect · Oracle ERP · Microsoft Dynamics · Odoo Core ·
> PostgreSQL Core Engineer · Google Distributed Systems · Security Architect · Performance Engineer ·
> Cloud Architect · DDD Expert · Event Sourcing Expert · AI Platform Architect · DevOps/SRE ·
> UX Architect · CA (India) · Tax Consultant · GST Consultant · Product Strategist · CTO
>
> **Mission:** Break this architecture. Find every flaw the previous reviews missed.
> Assume 1M businesses, 100B records, 2045. Approve nothing until every weakness is named.
>
> **Date:** July 2026

---

## BOARD VERDICT — BEFORE READING THE DETAILS

Previous reviews scored the architecture at **17% (240/1400)** and prescribed a 6-week platform sprint.

The Red Team finds that even the prescriptions contain gaps.

The Foundation Standards, Platform Architecture, and CTO Review are intellectually correct but:

1. They describe what to build. They do not describe how to build it safely.
2. They define rules. They do not define how rules are enforced or what happens when they are broken.
3. They identify missing components. They do not identify the sequencing risks of building them.
4. They name the right patterns. They miss the failure modes of those patterns.

**The architecture will fail not because the wrong things are being built.**
**It will fail because the right things will be built incorrectly or in the wrong order.**

Every finding in this document is a failure mode the previous reviews did not surface.

---

## SECTION 1 — FOUNDATION REVIEW

### 1.1 What the Foundation Standards Got Right

The Foundation Standards document establishes naming conventions, architectural rules, tenancy model,
and testing standards. This is better than 90% of ERP codebases which have none of these.

### 1.2 What the Foundation Standards Missed

**Missing: ADR (Architecture Decision Record) Process**

Rule 1-15 in Foundation Standards are decisions. But there is no process for:
- Who can propose a new rule?
- How is a rule challenged?
- What is the ADR template?
- Where are ADRs stored?
- How are ADRs discovered by new engineers?

Without a process, the rules become folklore. Folklore dies with the person who knew it.

```
Required: docs/adr/
├── 0001-use-uuid-v7-not-v4.md
├── 0002-rule-engine-must-be-platform-not-module.md
├── 0003-no-cross-module-imports.md
├── 0004-prisma-is-infrastructure-not-domain.md
└── template.md

ADR Template:
  # ADR-NNNN: {Title}
  Status: PROPOSED | ACCEPTED | DEPRECATED | SUPERSEDED BY ADR-XXXX
  Context: Why was this decision needed?
  Decision: What was decided?
  Consequences: What becomes easier? What becomes harder?
  Alternatives considered: What else was evaluated?
  Date: YYYY-MM-DD
  Approved by: {names}
```

**Missing: Architecture Fitness Functions**

Rules that cannot be automatically enforced are aspirational, not architectural.
Every invariant in the Foundation Standards must have a corresponding automated check.

```typescript
// This lives in CI and runs on every PR:

// Fitness Function 1: No cross-module imports
const crossModuleImports = await detectCrossModuleImports('src/modules/');
expect(crossModuleImports).toHaveLength(0);

// Fitness Function 2: Every Prisma model in business context has businessId
const missingTenantField = await detectMissingTenantField('prisma/schema.prisma');
expect(missingTenantField).toHaveLength(0);

// Fitness Function 3: No hardcoded tax values (numeric literals in tax module)
const hardcodedValues = await detectHardcodedTaxValues('src/modules/income-tax/');
expect(hardcodedValues).toHaveLength(0);

// Fitness Function 4: All endpoints have Idempotency-Key handling
const missingIdempotency = await detectMissingIdempotency('src/modules/');
expect(missingIdempotency).toHaveLength(0);
```

Without fitness functions: rules are broken silently. With fitness functions: PR fails.

**Missing: Definition of Done**

When is a module "done"? When is a feature "done"? When is a sprint "done"?
Without a Definition of Done, "done" means "I think it works."

```markdown
## Definition of Done — Module Level

A module is done when:
- [ ] Domain entities, value objects, aggregates exist for all concepts
- [ ] Repository interfaces defined (no Prisma in domain layer)
- [ ] All business rules in the Rule Engine (zero hardcoded in code)
- [ ] Events defined, documented in Event Catalog
- [ ] Unit tests ≥ 90% coverage of domain layer
- [ ] Integration tests cover all happy paths and primary error paths
- [ ] Golden dataset exists if module does computation
- [ ] API endpoints versioned (/api/v1/)
- [ ] Idempotency keys on all mutating endpoints
- [ ] Swagger/OpenAPI schema generated and reviewed
- [ ] Performance test: P99 < 200ms under 100 concurrent users
- [ ] RLS policy on all new tables
- [ ] Audit log integration
- [ ] Outbox pattern for all domain events
- [ ] Module manifest (publishes/subscribes) updated
- [ ] Feature flag in place
- [ ] Runbook written
- [ ] ADR filed for any non-standard decisions
```

**Missing: Deprecation Policy**

You will deprecate APIs. You will rename events. You will change table structures.
What is the process? What is the timeline? Who is notified? What is the grace period?

Without this: a schema rename breaks partner integrations with no warning.

**Missing: Complexity Budget**

Every module has a maximum allowed complexity. Beyond this, it must be split.
Without a budget: services grow to 2,000 lines, files to 500 lines, and nobody refactors.

```
Max service file size: 300 lines
Max function/method length: 30 lines
Max cyclomatic complexity: 10
Max nesting depth: 3
Enforced by: ESLint (complexity rules) in CI
```

**Missing: Timezone Policy**

Not a single rule addresses timezone handling. This is a catastrophic omission.

```
RULE: All timestamps stored as UTC in the database.
RULE: All timestamps displayed in the business's registered timezone.
RULE: All compliance deadlines computed in IST (UTC+5:30), not UTC.
RULE: never use `new Date()` directly in domain code — inject a Clock interface.
RULE: never use `Date.now()` — use Clock.now().
```

Why the Clock interface?

```typescript
// WRONG — untestable, non-deterministic
class AdvanceTaxService {
  isDue(): boolean {
    return new Date() > new Date('2026-06-15'); // depends on real time
  }
}

// CORRECT — testable, deterministic
class AdvanceTaxService {
  constructor(private readonly clock: Clock) {}
  isDue(deadline: Date): boolean {
    return this.clock.now() > deadline; // inject a mock clock in tests
  }
}
```

Every test that uses `new Date()` is non-deterministic. At 3am on March 15, it will fail.

---

## SECTION 2 — ENTERPRISE ARCHITECTURE GAPS

### 2.1 The Saga Pattern — Completely Missing

The previous reviews mention "saga readiness" without designing it.
A Saga is a sequence of local transactions coordinated by events, with compensations on failure.

**The ITR Filing Flow is a distributed transaction across 6 services:**
```
ValidateITR → ComputeTax → GenerateJSON → UploadToPortal → EVerify → RecordFiled
```

If step 4 (UploadToPortal) fails after step 3 (GenerateJSON) — what happens?
The JSON was generated. The portal does not have it. The audit log has no filing.
Without a saga: the user is stuck with inconsistent state and must call support.

```typescript
// Required: Saga Orchestrator
class FileItrSaga {
  readonly steps: SagaStep[] = [
    {
      action: () => this.itrService.validate(context),
      compensation: () => Promise.resolve(), // nothing to undo
    },
    {
      action: () => this.computationService.compute(context),
      compensation: () => this.computationService.invalidate(context.jobId),
    },
    {
      action: () => this.jsonService.generate(context),
      compensation: () => this.jsonService.delete(context.jsonId),
    },
    {
      action: () => this.portalConnector.upload(context), // can fail
      compensation: () => this.portalConnector.revoke(context), // undo upload
      retryPolicy: { attempts: 3, backoff: 'exponential' },
    },
    {
      action: () => this.verificationService.eVerify(context),
      compensation: () => Promise.resolve(), // irreversible, must succeed
    },
    {
      action: () => this.recordService.recordFiled(context),
      compensation: () => this.recordService.markFailed(context),
    }
  ];
}
```

**Impact:** Every multi-step workflow in the ERP (purchase approval, payroll run, GST filing, audit closure)
needs a saga. Without them, partial failures leave data in inconsistent states permanently.

### 2.2 Process Manager Pattern — Missing

A Saga handles one transaction. A Process Manager handles a long-running business process
that spans days, weeks, or months and reacts to multiple events.

**Example: TDS Return Filing Process (spans 3 months)**
```
April 1: Q4 TDS entries locked
↓ (event: erp.tax.quarter.closed)
April 1-31: Deductor reviews entries, corrects discrepancies
↓ (event: erp.tax.tds-entries.reviewed)
May 1-31: Challan verification
↓ (event: erp.tax.challans.verified)
May 31: TDS Return (Form 140) filed
↓ (event: erp.tax.tds-return.filed)
June 15: Form 131 (16A) generated for each deductee
↓ (event: erp.tax.form-131.generated)
```

This is a 3-month process with 5 stages, 5 events, and a deadline.
Without a Process Manager: it is tracked as manual reminders and status fields.
With a Process Manager: it is orchestrated, tracked, and escalated automatically.

```typescript
interface ProcessManager {
  processId: string;
  tenantId: string;
  processType: string; // 'TDS_RETURN_FILING_Q4'
  state: string;
  correlatedEvents: string[]; // event IDs that have been received
  pendingEvents: string[];    // events we are waiting for
  timeout: Date;
  compensation: SagaStep[];
}
```

### 2.3 Backend for Frontend (BFF) — Absent

The current architecture has one backend that serves both the web app and any future mobile app.
This means: every response is a compromise between what the web needs and what mobile needs.

```
Without BFF:                          With BFF:
Mobile → Backend (full response)      Mobile → Mobile BFF → Backend (lean response)
Web    → Backend (full response)      Web    → Web BFF    → Backend (rich response)
                                      CA App → CA BFF     → Backend (CA-specific response)
```

The CA App is the clearest example: a CA viewing a client return needs different data than
a business owner viewing their own return. The CA BFF aggregates data from 3 services
(ITReturn, Business Profile, CaWorkflow) into one optimized response.
Without a BFF: the frontend makes 3 separate API calls and assembles them.

### 2.4 Event Sourcing: The Wrong Decision Was Made Without Being Named

The previous reviews say "Event Sourcing readiness." They do not make a decision.

**Red Team Position:** Event Sourcing should NOT be applied to the whole system.
It should be applied SELECTIVELY to aggregates where audit trail and replay are legally required.

```
Event Source these aggregates:      Use CRUD for these:
- ItReturn (legal audit trail)       - Product catalog
- JournalEntry (immutable by law)    - Customer contact info
- TdsEntry (TDS liability record)    - Settings and configuration
- ItNotice (legal proceedings)       - Branch profiles
- ComplianceObligation
- AuditLog (already append-only)
```

Applying Event Sourcing to everything is a trap. It adds complexity to entities
(product catalog, customer address) where the benefits do not justify the cost.

**The rule that is missing from Foundation Standards:**
> "Event Sourcing applies only to aggregates with legal audit requirements or where
> full history replay is a business requirement. Justify in ADR before applying."

---

## SECTION 3 — DOMAIN DESIGN GAPS

### 3.1 Missing: Domain Clock

Documented above in Section 1. Every domain entity that references time must inject a `Clock`.
No domain class may call `new Date()`, `Date.now()`, or `performance.now()` directly.

### 3.2 Missing: Domain Invariant Documentation

Every aggregate has invariants — conditions that must always be true.
These are undocumented. An undocumented invariant is an unenforceable invariant.

```typescript
class JournalEntry {
  /**
   * INVARIANTS:
   * 1. Sum of all debits must equal sum of all credits (double-entry balance)
   * 2. A posted journal entry cannot be modified (immutability after posting)
   * 3. A journal entry must have at least 2 lines
   * 4. A journal entry cannot span multiple financial years
   * 5. All amounts must be non-negative (debit/credit direction handles sign)
   */
  
  private validateInvariants(): void {
    const debitTotal = this.lines.reduce((s, l) => s.add(l.debit), Money.ZERO);
    const creditTotal = this.lines.reduce((s, l) => s.add(l.credit), Money.ZERO);
    
    if (!debitTotal.equals(creditTotal)) throw new UnbalancedJournalError(this.id);
    if (this.isPosted) throw new ImmutablePostedJournalError(this.id);
    if (this.lines.length < 2) throw new InsufficientJournalLinesError();
  }
}
```

### 3.3 Missing: Consistency Boundaries

Which aggregates must be consistent together?
Which can be eventually consistent?

```
Synchronous (same transaction — must be consistent):
- JournalEntry + JournalLines (must balance)
- Sale + SaleItems (total must match)
- TdsEntry + ChallanPayment (deducted amount must match paid)

Asynchronous (eventually consistent — event-driven):
- Sale completed → Digital Twin revenue update (can lag 1 second)
- TDS detected → Compliance score update (can lag 30 seconds)
- ITR filed → Compliance obligation marked done (can lag 5 minutes)
```

Without documenting this: engineers make EVERYTHING synchronous (too slow) or
EVERYTHING asynchronous (wrong for financial data that must be immediately consistent).

### 3.4 Missing: Ubiquitous Language Glossary

DDD requires a ubiquitous language — every term has ONE meaning, used consistently
in code, documentation, and conversation.

**Conflicts found in existing documentation:**

| Term | Used as (document 1) | Used as (document 2) | Problem |
|------|---------------------|---------------------|---------|
| `assessmentYear` | 'AY 2025-26' (string) | AssessmentYear (value object) | Not consistent |
| `businessId` | tenant identifier | business entity identifier | Overloaded |
| `vendor` | Supplier in purchase context | Vendor in GST context | Same entity, two names |
| `partner` | Business partner | Partner in a firm (40(b)) | Completely different concepts |
| `document` | Any file attachment | Tax return document | Overloaded |
| `status` | Workflow state | Payment status | No common meaning |
| `period` | Fiscal period | GST return period | Different granularities |

**Required: Glossary at `docs/UBIQUITOUS_LANGUAGE.md`**

Every term, one definition, all code must match.

### 3.5 Missing: Aggregate Root Lifecycle Documentation

When is an aggregate created? Who creates it? Can it be deleted? When is it archived?

```
ItReturn lifecycle:
  CREATED: when business completes IT setup wizard
  DRAFT: when any schedule data is entered
  SUBMITTED_TO_CA: when owner clicks "Submit for Review"
  CA_REVIEWING: when CA opens the return
  CA_FLAGGED: when CA raises issues
  OWNER_RESPONDED: when owner replies to flags
  CA_APPROVED: when CA signs off
  FILED: when ITR JSON is submitted to portal
  ACKNOWLEDGED: when CPC processes it (143(1) intimation received)
  REVISED: if ITR-U is filed for this AY
  ARCHIVED: after retention period (7 years post filing)
  
  CANNOT BE DELETED: tax records are legally required for 7 years minimum.
  CANNOT BE MODIFIED after FILED state (ITR-U is a NEW return, not a modification).
```

This lifecycle must be in code, not only in documentation.

### 3.6 Missing Value Objects

These domain concepts are represented as raw primitives in the current design:

```typescript
// Currently a raw string — should be a value object
class TaxYear {
  // IT Act 2025: TY 2026-27 = income from 1 Apr 2026 to 31 Mar 2027
  private constructor(readonly year: number) {}
  static fromLabel(label: string): Result<TaxYear, InvalidTaxYearError>;
  get startDate(): Date;
  get endDate(): Date;
  get filingDeadline(): Date;
  get correspondingAY(): AssessmentYear; // for dual-act bridge
}

class Percentage {
  // A rate between 0 and 100. Cannot be 101%. Cannot be negative.
  private constructor(readonly value: Decimal) {
    if (value.lt(0) || value.gt(100)) throw new InvalidPercentageError();
  }
  toDecimalRate(): Decimal { return this.value.div(100); } // 10% → 0.10
  static of(n: number): Percentage;
}

class TaxRate extends Percentage {
  // Semantic type: a Percentage that represents a tax rate
  applyTo(income: Money): Money { return income.multiply(this.toDecimalRate()); }
}

class IFSCCode {
  private constructor(private readonly value: string) {}
  static create(raw: string): Result<IFSCCode, InvalidIFSCError>;
  get bankCode(): string; // first 4 chars
  get branchCode(): string; // last 6 chars
}

class PhoneNumber {
  // +91-XXXXX-XXXXX with country code
  static create(raw: string, defaultCountry: string = 'IN'): Result<PhoneNumber, InvalidPhoneError>;
  get countryCode(): string;
  get national(): string;
  toWhatsApp(): string; // format for WhatsApp API
}

class GstReturnPeriod {
  // Monthly: 'Jul-2026', Quarterly: 'Q2-2026'
  static monthly(month: number, year: number): GstReturnPeriod;
  static quarterly(quarter: 1|2|3|4, year: number): GstReturnPeriod;
  get dueDate(): Date; // 20th for 3B, 11th for 1
}

class InvoiceNumber {
  // Must be unique per tenant per FY. Gaps trigger scrutiny.
  // Format configured per business: INV-2026-00001
  static generate(series: NumberSeries): InvoiceNumber;
  hasGap(previous: InvoiceNumber): boolean;
}
```

---

## SECTION 4 — PLATFORM SERVICES — GAPS THE PREVIOUS REVIEWS MISSED

### 4.1 Identity Platform (Missing Entirely)

Authentication ≠ Identity. The previous reviews conflate them.

```
Authentication: "Who are you?" → JWT tokens, passwords, MFA
Identity:       "What is your verified identity?" → PAN-linked identity, Aadhaar-verified, GST-verified

Platform: IdentityProfile {
  id, tenantId,
  
  // Government-verified identities
  pan: Pan (verified via IT portal)
  panVerifiedAt: Date
  aadharLinked: Boolean (last 4 only stored)
  gstinVerified: Boolean
  udyamVerified: Boolean
  
  // Professional identities
  caRegistrationNumber: String (for CA users)
  caCouncilVerifiedAt: Date
  
  // Digital identity
  erpUserId: String
  lastKycAt: Date
  kycStatus: KYC_PENDING | KYC_VERIFIED | KYC_EXPIRED
}
```

Why this matters at scale: If a CA signs an ITR, the platform must verify the CA's registration
is active with ICAI. A CA with a lapsed registration cannot legally sign returns.
This is not an authentication concern — it is an identity verification concern.

### 4.2 Secret Management Platform (Gap in Execution)

The Foundation Standards say secrets go to Vault/AWS Secrets Manager. Good.
But what is the architecture for SECRET CONSUMPTION in code?

```typescript
// WRONG — even if the secret is fetched from Vault, this is fragile
const secret = await vault.get('RAZORPAY_KEY_SECRET');
const razorpay = new Razorpay({ key_id: ..., key_secret: secret });

// RIGHT — Secrets Platform wraps the provider
interface SecretsProvider {
  get(key: string): Promise<string>;
  rotate(key: string): Promise<void>;
  onRotation(key: string, handler: (newValue: string) => void): void;
}

// Secret rotation is handled transparently — no restart required
class RazorpayConnector {
  constructor(private readonly secrets: SecretsProvider) {
    // Subscribe to rotation events
    this.secrets.onRotation('RAZORPAY_KEY_SECRET', (newKey) => {
      this.reinitialize(newKey);
    });
  }
}
```

Without hot rotation: a secrets rotation requires an application restart. At 100K users, that is downtime.

### 4.3 Rate Limiting Platform (Completely Absent)

The Foundation Standards mention "rate limiting on all public endpoints."
There is no design for HOW.

Problems with naive rate limiting:
- Per-IP limiting: a CA office with 50 users behind one IP gets rate-limited together
- Per-user limiting: a webhook consumer cannot burst
- No tenant-aware limiting: a free-plan business consumes the same limits as an enterprise tenant

```
Required: Tiered Rate Limiting

Plan: FREE
  API requests: 100/minute per tenant
  Reports: 10/hour per tenant
  AI requests: 5/hour per tenant

Plan: PROFESSIONAL
  API requests: 1,000/minute per tenant
  Reports: 100/hour per tenant
  AI requests: 100/hour per tenant

Plan: ENTERPRISE
  API requests: 10,000/minute per tenant
  Reports: unlimited
  AI requests: 1,000/hour per tenant

Implementation: Redis sliding window counter
Header response: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

### 4.4 Experimentation Platform (Missing)

How will we A/B test new features? How will we validate that a UI change improves compliance filing?
Without an experimentation platform: features ship to everyone or nobody. No learning.

```
Platform: Experiment {
  id, name, hypothesis, metric (primary/secondary),
  variants: [CONTROL, TREATMENT_A, TREATMENT_B],
  allocation: Percentage[], // 50/25/25
  targetAudience: ExperimentAudience,
  startDate, endDate, status
}

// Assignment: deterministic per user (same user always sees same variant)
function assignVariant(userId: string, experimentId: string): Variant {
  const hash = murmurhash3(`${userId}:${experimentId}`);
  return selectVariantByHash(hash, experiment.variants, experiment.allocation);
}
```

### 4.5 Data Governance Platform (Missing)

At 100B records, you cannot find all PAN numbers in the database, cannot purge a deleted user's data,
cannot produce a GDPR-style data export without a data governance platform.

```
Platform: DataClassification
  IDENTIFIER: PAN, AADHAAR, GSTIN, phone, email
  FINANCIAL: bank account, amount, tax figure
  SENSITIVE: TDS record, ITR data, salary
  PUBLIC: product names, invoice numbers, business names

Platform: DataCatalog
  table, column, classification, retention_years, purge_policy, encryption_required

Platform: DataLineage
  tracks: which column → which API → which report → which user saw it
```

Without this: a "delete my account" request requires 6 months of manual database surgery.

---

## SECTION 5 — DATABASE DESIGN GAPS (NEW FINDINGS)

### 5.1 The Prisma + PgBouncer Incompatibility (Critical)

PgBouncer in **transaction mode** is recommended for connection pooling.
Prisma uses **prepared statements** which are connection-scoped.
Transaction mode in PgBouncer does not preserve connection state between transactions.
**Prepared statements break in PgBouncer transaction mode.**

```
Solutions:
Option A: Use PgBouncer in SESSION mode (less efficient but compatible)
Option B: Disable prepared statements in Prisma: pgbouncer=true in DATABASE_URL
Option C: Use pgpool-II instead of PgBouncer (supports prepared statements)
Option D: Move to Neon / Supabase (built-in pooler compatible with Prisma)

Recommended: Option B (Prisma flag) for now, Option D for production scale
```

If this is not addressed before deploying connection pooling: prepared statements will fail
randomly and silently at high concurrency.

### 5.2 Ledger Tables — Distinct from Audit Log

Financial ledger data (journal entries, TDS entries, tax challan records) must be:
- **Append-only** (no UPDATE, no DELETE allowed at database level)
- **Immutable** (once posted, locked by database trigger)
- **Tamper-evident** (row-level hash chain)

The previous reviews combine this with the audit log. They are different:

```sql
-- Audit Log: WHO changed WHAT (operational)
-- Ledger Table: the actual financial record (legal)

CREATE TABLE "LedgerRecord" (
  id UUID NOT NULL DEFAULT gen_ulid(),
  "tenantId" UUID NOT NULL,
  "journalId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  direction VARCHAR(2) NOT NULL CHECK (direction IN ('DR', 'CR')),
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "periodClose" DATE, -- null until period is closed; after close, immutable
  row_hash TEXT, -- SHA-256 of all columns
  prev_hash TEXT  -- hash of previous record for this account
) PARTITION BY RANGE ("recordedAt");

-- Prevent modification after period close
CREATE OR REPLACE RULE no_update_closed_ledger AS
  ON UPDATE TO "LedgerRecord"
  WHERE OLD."periodClose" IS NOT NULL
  DO INSTEAD NOTHING;
```

### 5.3 Temporal Tables — Missing

The database stores current state. It does not store historical state.

**Business problem:** A business changes its GST registration from regular to composition
scheme on July 1. What was the GST treatment of a sale made on June 15?
Without temporal tables: unknown. The registration shows "composition" and the June 15 sale
would be recomputed with the wrong GST rate.

```sql
-- Temporal table: stores valid_from and valid_to for every state change
CREATE TABLE "BusinessRegistration" (
  id UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "registrationType" VARCHAR(50) NOT NULL, -- REGULAR/COMPOSITION/EXPORT
  "gstinStatus" VARCHAR(20),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ, -- NULL = currently active
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query "what was the registration on June 15?"
SELECT * FROM "BusinessRegistration"
WHERE "businessId" = $1
  AND valid_from <= '2026-06-15'
  AND (valid_to IS NULL OR valid_to > '2026-06-15');
```

**Tables that must be temporal (not just soft-deleted):**
- `BusinessRegistration` (GST type, composition status)
- `TaxRegimeSelection` (old vs new regime per AY)
- `VendorComplianceProfile` (TDS category can change)
- `EmployeeSalaryGrade` (salary changes are historical for payroll)
- `PriceList` (price on the day of sale, not today's price)
- `TaxRuleSet` (already designed correctly with effective_from/to)

### 5.4 The Invoice Number Gap Problem

When an invoice number series has a gap (INV-0001, INV-0002, INV-0004 — missing INV-0003),
the Income Tax department treats gaps as a red flag for suppressed sales.

There is no mechanism in the current design to:
- Detect gaps in invoice number series
- Require a cancellation record when an invoice is voided (gaps must be explained)
- Audit the sequence integrity

```prisma
model NumberSeriesAudit {
  id          String   @id
  seriesId    String
  numberUsed  BigInt
  purpose     String   // 'INVOICE_CREATED' | 'INVOICE_CANCELLED' | 'VOID_WITH_REASON'
  entityId    String?  // invoice ID
  voidReason  String?  // required if purpose = VOID
  issuedAt    DateTime @default(now())
  issuedBy    String
  
  @@index([seriesId, numberUsed])
}
```

A gap scanner runs nightly and flags series with unexplained gaps to the CA dashboard.

### 5.5 JSONB Overuse Warning

JSONB is a powerful escape hatch. But it becomes a trap when queried at scale.

**Dangerous patterns found in the designed schema:**

```prisma
// This is searchable per review, but JSONB is not indexed by default
model Rule {
  parameters JSONB  // ← if you query parameters->>'threshold' often, add a GIN index
}

model WorkflowTemplate {
  steps JSONB  // ← if you search inside workflow steps, this needs a generated column
}
```

**Rule:** If a JSONB field is queried with a condition more than once per week, extract to a column.

```sql
-- Bad: full table scan on JSONB
SELECT * FROM "Rule" WHERE parameters->>'threshold' > '50000';

-- Better: GIN index on JSONB
CREATE INDEX idx_rule_params ON "Rule" USING GIN (parameters);

-- Best: generated column for frequently queried fields
ALTER TABLE "Rule" ADD COLUMN threshold_value NUMERIC
  GENERATED ALWAYS AS ((parameters->>'threshold')::NUMERIC) STORED;
CREATE INDEX idx_rule_threshold ON "Rule" (threshold_value);
```

### 5.6 Missing: Sequence Guarantee for Financial Operations

Two concurrent requests create journal entries at the same millisecond.
Both get the same `sequence_number` in the EventStore.
Now the replay order is ambiguous.

```sql
-- Monotonic sequence per aggregate — not per table
CREATE SEQUENCE journal_entry_seq;

-- Assign at insertion time using database sequence (not application-generated)
INSERT INTO "JournalEntry" (..., sequence_number)
VALUES (..., nextval('journal_entry_seq'));
```

Application-generated sequence numbers are not safe under concurrent writes.
Only database sequences are safe.

---

## SECTION 6 — EVENT ARCHITECTURE GAPS

### 6.1 Event Versioning Strategy — Critical Gap

Events are published to the event bus. Consumers subscribe.
What happens when an event's shape changes in version 2?

```typescript
// v1 event (existing consumers rely on this)
interface SaleCompletedEventV1 {
  saleId: string;
  amount: number; // ← was number
  businessId: string;
}

// v2 event (amount is now Money object)
interface SaleCompletedEventV2 {
  saleId: string;
  amount: { value: string; currency: string }; // ← changed shape
  businessId: string;
  branchId: string; // ← new field
}
```

Without a versioning strategy: deploying v2 breaks every v1 consumer simultaneously.

**Required: Event Schema Registry with versioning**

```typescript
// Events are versioned. Old consumers continue receiving v1 until they upgrade.
// The Event Bus auto-upconverts or dual-publishes during migration window.

interface EventEnvelope {
  eventId: string;
  eventType: string;   // 'erp.pos.sale.completed'
  schemaVersion: number; // 1, 2, 3...
  publishedAt: Date;
  payload: unknown;
}

// Schema Registry validates every published event against its registered schema
class SchemaRegistry {
  validate(eventType: string, version: number, payload: unknown): ValidationResult;
  getSchema(eventType: string, version: number): JSONSchema;
  upconvert(event: EventEnvelope, toVersion: number): EventEnvelope;
}
```

**Migration procedure (mandatory before any event shape change):**
1. Register v2 schema (additive changes only: add fields, do not remove/rename)
2. Publish both v1 and v2 for 30 days (dual-publish window)
3. Monitor: all consumers upgraded to v2?
4. Deprecate v1 (stop publishing)
5. Delete v1 schema after 90 days

If a field must be REMOVED: it cannot be removed from the event. Mark it as `@deprecated`.
Events are a public API. Breaking changes require a major version bump and migration window.

### 6.2 Event Catalog — Missing

There is no registry of all events in the system.
At 50 modules and 500 events, no engineer knows what events exist, who publishes them, who consumes them.

```
Required: docs/events/CATALOG.md (auto-generated from module manifests)

| Event | Publisher | Consumers | Schema Version | SLA |
|-------|-----------|-----------|----------------|-----|
| erp.pos.sale.completed | pos | digital-twin, tax, inventory | v2 | <500ms |
| erp.purchase.invoice.paid | purchases | tds, msme-checker | v1 | <2s |
| erp.tax.tds-entry.detected | tax | notifications, compliance | v1 | <5s |

Generated by: npm run generate:event-catalog
Enforced by: CI fails if module publishes an unregistered event
```

### 6.3 Event Ordering Problem

BullMQ does not guarantee ordered delivery within a queue by default.
Two events for the same aggregate (Sale.created, Sale.voided) could arrive out of order.

```typescript
// Problem: void processed before create → stock never reduced, then phantom increase
Sale.created  (published at T+0ms)
Sale.voided   (published at T+5ms)
              → Consumer receives: Sale.voided at T+10ms (first!)
              → Consumer receives: Sale.created at T+15ms (second!)
              → State: sale exists as voided (wrong — should not exist at all)

// Solution: Use optimistic version on aggregate
interface DomainEvent {
  aggregateVersion: number; // increment with each event
}

// Consumer: if event version < currentVersion → it's late, discard or replay
// Consumer: if event version > currentVersion + 1 → out of order, hold and wait
```

### 6.4 Inbox Pattern — Missing

The Outbox Pattern ensures events are NOT lost during publishing.
The Inbox Pattern ensures events are NOT processed twice by consumers.

Without an Inbox: a consumer processes an event, crashes before acknowledging, receives it again, processes it twice. Two TDS entries created for one payment.

```prisma
model InboxEvent {
  id           String   @id // the eventId from the event envelope (idempotency key)
  eventType    String
  processedAt  DateTime @default(now())
  status       String   // PROCESSING | COMPLETED | FAILED
  error        String?
  
  @@index([eventId]) // fast dedup check
}

// Consumer pattern:
async processEvent(event: DomainEvent): Promise<void> {
  const alreadyProcessed = await this.inbox.exists(event.eventId);
  if (alreadyProcessed) return; // idempotent
  
  await this.prisma.$transaction(async (tx) => {
    await tx.inboxEvent.create({ data: { id: event.eventId, status: 'PROCESSING', eventType: event.eventType } });
    await this.doProcess(event, tx);
    await tx.inboxEvent.update({ where: { id: event.eventId }, data: { status: 'COMPLETED' } });
  });
}
```

---

## SECTION 7 — USER EXPERIENCE GAPS (PERSONA-BASED FINDINGS)

### 7.1 The Accountant's Missing Power Tools

An accountant managing 500+ journal entries per day needs:

```
MISSING: Journal Entry Batch Import
  → Upload Excel/CSV → map columns → validate → post all entries
  → Common workflow: accountant gets bank statement, bulk-imports as journal

MISSING: Keyboard-only journal entry
  → Tab between fields: Date → Account → Debit → Credit → Narration → Next line
  → Ctrl+Enter to save and start next entry
  → Currently: every field requires a mouse click

MISSING: Trial Balance with drill-down
  → Click any account balance → see underlying journal lines
  → Click any journal line → see the source document (invoice, payment)
  → This is the core workflow of every audit

MISSING: Period lock
  → Once a month is finalized (e.g., all March entries done), lock it
  → No modifications to locked periods — prevent retroactive changes
  → Critical for audit integrity
```

### 7.2 The CA's Missing Workflow Tools

```
MISSING: Client comparison view
  → View two clients' tax positions side by side
  → Useful when CA is advising on firm restructuring or merger

MISSING: CA's own P&L for billing clients
  → Track time spent per client → auto-bill client
  → CA Practice Management is a gap nobody fills in India

MISSING: Bulk operations
  → Select 20 clients → send reminder email for all → "Advance tax due in 10 days"
  → Currently: send one by one

MISSING: Client-level access delegation
  → CA allows a junior CA to access ONLY specific clients
  → Currently: all or nothing access

MISSING: Return filing history by CA (not by business)
  → CA needs a report: "How many returns did I file this year? By when?"
```

### 7.3 The Offline Problem — No Strategy Exists

The previous reviews mention "offline mode" without any design.

```
Offline strategy must answer:
1. What data is available offline? (read-only: today's sales, product catalog)
2. What operations are permitted offline? (POS sales — yes; ITR filing — no)
3. How are offline mutations synced? (Conflict resolution: last-write-wins? Server-wins?)
4. What happens if two cashiers on the same network make offline sales that conflict?

Recommended approach:
  PWA (Service Worker) + IndexedDB for POS only
  Sync strategy: optimistic UI → sync when online → server reconciles
  Conflict: invoice number conflict → reassign from server sequence
  NEVER allow offline journal entries — financial data must be online-only
```

### 7.4 Missing: Accessibility Compliance

There is no accessibility strategy. At scale, this is both a legal requirement and a market:
- Screen reader support for visually impaired accountants
- High contrast mode
- Keyboard-only navigation (no mouse required for any action)
- Font size control
- WCAG 2.1 AA compliance

In India, the Rights of Persons with Disabilities Act 2016 applies to digital services.
At 1M businesses, some of those businesses are run by persons with disabilities.

---

## SECTION 8 — SECURITY GAPS (RED TEAM FINDINGS)

### 8.1 IDOR (Insecure Direct Object Reference) — Not Addressed

The Foundation Standards define RLS. But RLS works at the database level.
There is a gap between what the controller accepts and what the database enforces.

```typescript
// Attack vector: IDOR
// User A (businessId: aaa) sends:
GET /api/v1/businesses/bbb/it-returns/xyz
                       ^^^ wrong business

// Controller extracts businessId from URL param, not from JWT
// If businessId in JWT ≠ businessId in URL, the request should be rejected at controller level
// NOT relied upon to be rejected by RLS (defense in depth)

// Required: every controller validates URL params against JWT claims
@Get(':businessId/it-returns')
async getReturns(
  @Param('businessId') businessId: string,
  @CurrentUser() user: AuthUser
): Promise<ItReturnDto[]> {
  // Validate URL param matches JWT before hitting service/DB
  if (!user.canAccessBusiness(businessId)) throw new ForbiddenException();
  return this.service.findAll(businessId);
}
```

### 8.2 Mass Assignment — Not Protected

If a DTO directly maps to a Prisma model, an attacker can set fields they should not.

```typescript
// Attack vector: mass assignment
// Attacker sends: POST /expenses { amount: 1000, businessId: 'OTHER_TENANT_ID', isDisallowed: false }
// If service does: await prisma.expense.create({ data: dto }) → businessId is overwritten

// Required: whitelist only allowed fields
class CreateExpenseDto {
  @IsNumber() amount: number;        // ← allowed
  @IsString() category: string;     // ← allowed
  // businessId: NEVER in DTO — always from JWT
  // isDisallowed: NEVER from client — computed by system
}
```

### 8.3 Timing Attack on PAN Verification

```typescript
// Vulnerable to timing attack
async verifyPan(pan: string, expectedPan: string): Promise<boolean> {
  return pan === expectedPan; // early exit if first char differs → timing leak
}

// Required: constant-time comparison
import { timingSafeEqual } from 'crypto';
async verifyPan(pan: string, expectedPan: string): Promise<boolean> {
  const a = Buffer.from(pan.toUpperCase());
  const b = Buffer.from(expectedPan.toUpperCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

### 8.4 CA Session Elevation — Not Designed

When a CA switches to client mode (CaBusinessLink), their JWT is re-scoped.
**What prevents a CA from manipulating their JWT to claim a higher role than allowed?**

```
Attack: CA decodes JWT, notices role: 'CA' and businessId: 'client-123'
        CA replays the token but with businessId: 'different-client-456' (also their client)
        
This is not an attack if the JWT is signed by the server. 
But it IS an attack if the JWT claim validation only checks that businessId exists,
not that the CA is actually linked to that businessId.

Required: On every CA request:
1. Validate JWT signature (standard)
2. Validate that CA.userId is linked to JWT.businessId via CaBusinessLink
3. Validate that CaBusinessLink.isActive = true
4. Validate that CaBusinessLink has not expired

Cache this check in Redis (invalidate when CaBusinessLink is deactivated).
```

### 8.5 Audit Log Completeness — The Six Missing Audit Events

The audit log documents data changes. But these events are not audited:

| Missing Audit Event | Why Critical |
|--------------------|-------------|
| CA accessed client data | CA may have viewed data without any write action |
| Report downloaded | A P&L report download is data leaving the system |
| Document exported / printed | Same |
| Password reset requested | Could indicate account compromise |
| MFA disabled | Security downgrade — must be logged |
| CA-client link created or removed | Administrative action with data access implications |

### 8.6 Threat Model — Not Documented

There is no threat model for this system. A threat model answers:
- Who are the adversaries? (competitors, disgruntled employees, script kiddies, nation states?)
- What do they want? (customer financial data, PAN numbers, trade secrets?)
- What are the attack vectors? (phishing, SQL injection, social engineering, API abuse?)
- What are the consequences? (reputational, financial, legal?)

Without a threat model: security controls are chosen randomly and may miss the most likely attacks.

---

## SECTION 9 — PERFORMANCE GAPS

### 9.1 The N+1 Problem — A System-Level Risk

The previous reviews do not mention N+1 queries as a specific risk.
In a NestJS + Prisma application, N+1 queries are extremely easy to introduce silently.

```typescript
// Subtle N+1 — appears to be one query
async getSalesSummary(businessId: string): Promise<SaleSummaryDto[]> {
  const sales = await this.prisma.sale.findMany({ where: { businessId } }); // 1 query
  
  return Promise.all(sales.map(async (sale) => ({
    ...sale,
    customer: await this.prisma.customer.findUnique({ where: { id: sale.customerId } }) // N queries
  })));
}
// 1 + N queries. For 1000 sales: 1001 queries.
```

**Required: Prisma query analyzer in CI**

```typescript
// Custom middleware that detects N+1 patterns
// Fires during integration tests
const queryCount = new Map<string, number>();

prisma.$on('query', (e) => {
  const key = `${e.model}_${e.action}`;
  queryCount.set(key, (queryCount.get(key) ?? 0) + 1);
  
  // Flag if same query pattern runs >10 times per request
  if (queryCount.get(key) > 10) {
    logger.warn(`Potential N+1: ${key} called ${queryCount.get(key)} times`);
  }
});
```

### 9.2 Report Generation — No Strategy for Large Reports

A P&L for 3 years with 100M journal entries will time out.
There is no report generation architecture.

```
Required: Async Report Generation

1. User clicks "Generate Annual Report"
2. Controller: create ReportJob { status: PENDING } → return jobId immediately
3. Background worker processes the report (may take 5 minutes)
4. Worker: update ReportJob { status: COMPLETED, documentId: ... }
5. User: polls /reports/jobs/{jobId} or receives WebSocket notification
6. User: downloads from Document Platform

NEVER: block the HTTP response for report generation
NEVER: generate reports in the controller thread
```

### 9.3 Hot Partition Problem

At 1M businesses, if businesses are partitioned by `createdAt` month,
ALL new businesses in July 2026 write to the same partition.
This creates a "hot partition" — one partition takes 80% of all writes.

```
Required: Partition by tenant ID range, not by time

-- Shard businesses into 16 buckets by UUID prefix
-- This distributes writes evenly regardless of when businesses sign up
PARTITION BY RANGE (SUBSTRING("businessId"::text FROM 1 FOR 1)) 

-- Or: consistent hashing on businessId
-- All data for businessId-aaa goes to shard 0
-- All data for businessId-bbb goes to shard 1
```

### 9.4 The "First Business of the Day" Cold Start

When the first POS sale happens each morning after Redis cache is cold:
- Rule Engine loads all rules from DB → 200ms
- Session token validated against DB (no Redis cache) → 50ms
- Digital Twin loaded from DB → 100ms
- Total: 350ms for the first sale

**Required: Cache warming on application startup**

```typescript
@Injectable()
export class CacheWarmingService implements OnApplicationBootstrap {
  async onApplicationBootstrap(): Promise<void> {
    await this.ruleEngine.preloadCurrentRules(); // load all active rule sets
    await this.featureFlags.preload();
    logger.log('Cache warmed in', Date.now() - startTime, 'ms');
  }
}
```

---

## SECTION 10 — OBSERVABILITY GAPS

### 10.1 Architecture Drift Detection

How do we know if engineers are violating the Foundation Standards rules?
Manual code review catches violations after the fact. What catches them before?

```
Architecture Drift Detection:
1. Fitness Functions (documented in Section 1) — automated, per PR
2. Dependency analysis weekly: detect new cross-module imports
3. Database schema analysis: detect new tables without businessId
4. Code complexity analysis: detect functions exceeding complexity budget
5. Test coverage analysis: detect modules below 80% coverage
6. Dead code detection: detect exported functions never imported

Tool: ts-arch (TypeScript architecture testing library)
Tool: eslint-plugin-import (import restriction enforcement)
Tool: jest --coverage (coverage gates)
```

### 10.2 Business Metric Alerts — Not Designed

Technical observability (latency, errors, memory) is documented.
But there are no alerts for business anomalies:

| Business Metric Alert | Threshold | Implication |
|-----------------------|-----------|-------------|
| Daily sales 50% below 7-day average | Any day | System outage or fraud? |
| TDS entries with 0 amount | More than 0 | Bug in threshold logic |
| ITR computations where tax < 0 | Any | Computation engine bug |
| Advance tax due in 7 days AND no payment recorded | Any business | CA hasn't noticed |
| AIS variance > ₹1L | Any business | High scrutiny risk |
| Compliance deadline missed | Any business | Legal liability |

These are the most important alerts for a financial platform. They are entirely absent.

### 10.3 Dead Events and Dead APIs

At year 5, some events will no longer have consumers. Some APIs will no longer have callers.
Without detection: they accumulate as confusion and maintenance surface.

```
Required: Usage tracking for every event and API

// Tag every API call
@Get('businesses/:id/it-returns/:ay')
@ApiTag('v1') // mark the version
async getReturn(...) { ... }

// Tag every event subscription
@OnEvent('erp.pos.sale.completed')
@EventConsumer('income-tax', 'update-digital-twin') // module, purpose
async handleSaleCompleted(...) { ... }

// Weekly job: find events with 0 consumers in the last 30 days → flag for deprecation
// Weekly job: find API endpoints with 0 calls in the last 30 days → candidate for removal
```

---

## SECTION 11 — AI ARCHITECTURE GAPS

### 11.1 MCP (Model Context Protocol) Readiness — Not Addressed

MCP is the emerging standard (Anthropic, 2024) for connecting LLMs to tools.
An ERP that is MCP-ready can be operated by any AI agent that supports MCP.

```typescript
// MCP Server exposes ERP tools to any LLM
const mcpServer = new McpServer({
  name: 'srivani-erp',
  tools: [
    {
      name: 'get_business_pulse',
      description: 'Get real-time business health metrics for a business',
      inputSchema: { businessId: string },
      handler: async ({ businessId }) => this.digitalTwinService.getPulse(businessId)
    },
    {
      name: 'detect_tds_liability',
      description: 'Analyze a payment and detect TDS obligation',
      inputSchema: { amount: number, vendorPan: string, category: string },
      handler: async (input) => this.tdsEngine.detect(input)
    },
    {
      name: 'create_expense',
      description: 'Record a business expense',
      inputSchema: CreateExpenseSchema,
      requiresHumanApproval: true, // MCP-level human-in-the-loop
      handler: async (input) => this.expenseService.create(input)
    }
  ]
});
```

An MCP-ready ERP can be integrated with Claude, ChatGPT, Gemini, or any future agent
without building custom integrations for each AI provider.

### 11.2 AI Memory — Not Designed

The AI copilot knows the current conversation but not:
- What the CA did last month for this client
- That this business always pays rent on the 5th of the month
- That this business uses the old tax regime (keep recommending it)
- That the owner prefers WhatsApp notifications over email

```
Required: AI Memory Store
{
  tenantId, scope (USER | BUSINESS | CA_CLIENT),
  memoryType (PREFERENCE | PATTERN | FACT | CORRECTION),
  key, value, confidence, observedCount, lastObservedAt,
  expiresAt (some memories expire — tax rates, compliance deadlines)
}

// The AI reads memory before responding
async getCopilotContext(userId: string, businessId: string): Promise<CopilotContext> {
  return {
    businessProfile: await this.digitalTwin.getPulse(businessId),
    userPreferences: await this.aiMemory.get(userId, 'PREFERENCE'),
    businessPatterns: await this.aiMemory.get(businessId, 'PATTERN'),
    recentActions: await this.auditLog.recent(userId, 10),
  };
}
```

### 11.3 Hallucination Risk in Tax Advice — Not Mitigated Enough

The previous reviews mention guardrails. The Red Team finds the risk is underestimated.

**Concrete failure scenario:**
User asks: "Can I claim my home office rent as a business expense?"
AI says: "Yes, you can deduct home office rent as a business expense under Section 30."
Fact: Section 30 covers rent for a building used for business. For a home used partly for business,
only the proportionate amount is deductible, and it must be documented.
The AI's answer is close enough to sound correct but wrong in the specifics.

**Required: Tax advice confidence gating**

```typescript
interface TaxAdviceResponse {
  answer: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  citations: LawCitation[];
  disclaimer: string;
  recommendCa: boolean; // if LOW confidence → always recommend CA verification
}

// Confidence levels:
// HIGH: answer is directly from the Rule Engine + law text match
// MEDIUM: answer is inferred from related sections
// LOW: answer is general guidance without specific law match → must show disclaimer
```

---

## SECTION 12 — DEVOPS GAPS

### 12.1 The Runbook Gap

There are no runbooks. When the system goes down at 2am, what does the on-call engineer do?

```
Required: runbooks/
├── 001-postgres-disk-full.md
├── 002-redis-oom.md
├── 003-bullmq-dlq-full.md
├── 004-tds-return-filing-failed.md
├── 005-it-portal-integration-timeout.md
├── 006-outbox-worker-stuck.md
└── 007-certificate-expiry.md

Each runbook must have:
  Symptoms: how will you know this is the problem?
  Impact: what is broken for users?
  Steps: numbered, executable commands
  Verification: how do you confirm the fix worked?
  Prevention: how do we prevent this next time?
```

### 12.2 SLO (Service Level Objectives) — Not Defined

Without SLOs: there is no agreement on what "acceptable" means.
Every outage is a negotiation. Every slowness is a subjective complaint.

```
Required SLOs:

POS (highest priority — real-time sales):
  Availability: 99.95% (≤22 minutes downtime/month)
  Latency: P99 < 500ms (sale creation end-to-end)
  Error rate: < 0.1%

Tax Computation:
  Availability: 99.9%
  Latency: P99 < 5s (full ITR computation)
  Error rate: < 0.01% (wrong computation is catastrophic)

Reports:
  Availability: 99%
  Latency: P99 < 30s (annual P&L)
  Error rate: < 1%

Integrations (IT Portal, TRACES):
  Availability: dependent on CBDT's SLA (~99%)
  Latency: circuit-break at 10s timeout
```

### 12.3 Error Budget Policy — Not Defined

If we burn 50% of the POS error budget in week 1, deployments must stop.
Without an error budget policy: deploys continue and the service degrades further.

---

## SECTION 13 — PRODUCT STRATEGY GAPS

### 13.1 The On-Premise Problem

Large businesses (manufacturing, hospital chains) cannot use cloud ERP due to:
- Data residency requirements
- IT policy (no external cloud)
- Connectivity concerns (remote factories)

The current architecture has no on-premise path. Every dependency is cloud-native.

```
Required: On-Premise Deployment Mode
  Docker Compose for all services (already close — add app to Docker)
  MinIO instead of S3 (already chosen ✓)
  Self-hosted Redis ✓
  Self-hosted PostgreSQL ✓
  On-premise AI: Ollama for local LLM (no data leaves premises)
  Licensing: air-gapped license server (no internet required for validation)
```

### 13.2 The Government Edition Gap

India's Central Government and State Governments are the largest ERP buyers.
GEM (Government e-Marketplace) is the procurement channel.
Without a GEM listing and a "Government Edition" feature set: this market is closed.

```
Government Edition requirements:
  Data residency: NIC cloud or on-premise (not foreign cloud)
  Audit: CERT-In empaneled auditor report
  Accessibility: WCAG 2.1 AA compliance
  Integration: PFMS (Public Financial Management System) API
  Procurement: GEM listing with MSE certification
  Compliance: GFR (General Financial Rules) reporting formats
```

---

## SECTION 14 — ENGINEERING GOVERNANCE GAPS

### 14.1 Module Ownership — Not Defined

Who owns the `income-tax` module? Who reviews PRs to it?
Without CODEOWNERS: everyone's module is nobody's responsibility.

```
Required: .github/CODEOWNERS

# Income Tax module owned by tax team
/src/modules/income-tax/ @tax-team-lead @senior-tax-dev

# Platform services: stricter review
/src/platform/ @principal-architect @tech-lead

# Database migrations: always requires architect sign-off
/prisma/migrations/ @principal-architect @db-admin

# Foundation Standards: requires CTO sign-off
/docs/FOUNDATION_STANDARDS.md @cto
```

### 14.2 Technical Debt Register — Not Started

The previous reviews identify technical debt. But there is no register.
Unregistered debt is forgotten debt.

```
Required: docs/TECH_DEBT.md (or Linear/Jira labels)

Format:
| ID | Description | Impact | Cost to Fix | Priority | Owner | Due |
|----|-------------|--------|-------------|----------|-------|-----|
| TD001 | UUID v4 on existing tables | B-tree fragmentation at 10M rows | High | P2 | DB team | Q3 2026 |
| TD002 | documentUrl String fields (12) | No versioning, no encryption | High | P1 | Platform | Week 1 |
| TD003 | console.log throughout | No structured logs, no tracing | Medium | P2 | All | Platform Sprint |

Review: monthly. Age out items fixed. Never let the list exceed 50 items without action.
```

### 14.3 Package and Dependency Policy — Not Defined

At 50 modules and 200 engineers, dependency sprawl kills the codebase.

```
Required rules:
  - No new npm packages without tech lead approval
  - Package MUST have: active maintenance, MIT/Apache license, >100K weekly downloads
  - Packages with security vulnerabilities must be updated within 7 days (high severity)
  - No two packages that do the same thing (e.g., both lodash and underscore)
  - All packages pinned to exact version in package.json (not ^semver)
  - Renovate bot for automated update PRs with passing tests
```

---

## SECTION 15 — WHAT IS STILL MISSING (RED TEAM LIST)

Items not mentioned in any previous document:

### Platform Level
- **Domain Clock / Testable Time** — No domain code may use `new Date()` directly
- **Idempotency Key Store** — Designed but not architected (Redis TTL-based)
- **Webhook Signature Verification** — When we receive webhooks from banks, how do we verify?
- **Circuit Breaker State Dashboard** — Which integrations are currently open/closed/half-open?
- **API Deprecation Registry** — Listing of deprecated endpoints with sunset dates
- **Cross-cutting Concern Library** — Shared decorators: `@Auditable`, `@Idempotent`, `@RateLimited`, `@RequiresMfa`

### Database Level
- **Ledger Tables** (append-only financial records, distinct from audit log)
- **Temporal Tables** (point-in-time query for registration status, prices)
- **Sequence Integrity** (invoice number gap detection)
- **NumberSeriesAudit** (every issued number tracked, voids require reason)
- **Period Lock** (closed financial periods cannot be modified)
- **Compensation Table** (for saga rollback — what was the state before?)

### Domain Level
- **Ubiquitous Language Glossary** (one term, one definition, enforced in code)
- **Aggregate Invariant Documentation** (written in domain objects, not docs)
- **Consistency Boundary Map** (what is synchronous vs eventually consistent)
- **Process Manager** for long-running business processes
- **Domain Clock** (injectable, testable time abstraction)

### Missing Value Objects
- `TaxYear` (IT Act 2025 concept, distinct from AssessmentYear)
- `Percentage` and `TaxRate` (semantic, range-validated)
- `IFSCCode`, `PhoneNumber`, `EmailAddress`, `GstReturnPeriod`
- `InvoiceNumber` (with gap detection capability)
- `TaxableAmount` vs `ExemptAmount` (semantic money)

### Missing Domain Events
- Security events: `UnusualLoginDetected`, `DataExportRequested`, `MfaDisabled`
- Financial events: `PeriodClosed`, `TrialBalanceGenerated`, `AuditCompleted`
- AI events: `HallucinationDetected`, `LowConfidenceResponse`, `HumanOverrideRequired`
- Business lifecycle: `BusinessOnboarded`, `BusinessUpgraded`, `BusinessChurned`
- Compliance: `InvoiceGapDetected`, `PenaltyAccrued`, `LegalHoldPlaced`

### Missing Business Capability Map
- **Not designed:** A business capability map shows WHAT the system does, independent of technology.
- Without it: engineers optimize the code, not the business outcome.

### Missing Mobile Strategy
- No React Native / Capacitor plan for the mobile app
- No offline-first POS design
- No push notification platform (FCM / APNs)
- No biometric authentication for mobile (Face ID, fingerprint)

### Missing Data Quality Framework
- No data validation at the ERP layer (beyond Prisma constraints)
- No data quality scoring per tenant (% complete profiles, % verified PANs)
- No duplicate detection (same vendor entered twice with slightly different names)
- No master data deduplication workflow

---

## SECTION 16 — CHALLENGING EVERY RULE IN FOUNDATION STANDARDS

| Rule | Gap / Challenge |
|------|----------------|
| Rule 1: No cross-module imports | ESLint rule defined. But what about `@types` imports? Schema types? |
| Rule 2: No hardcoded tax values | How do we detect violations automatically? No lint rule proposed. |
| Rule 3: No documentUrl String | Migration path for EXISTING models with documentUrl not specified. |
| Rule 4: No direct external API calls | What if Integration Hub is down? No fallback design. |
| Rule 5: No console.log | console.error in catch blocks? Allowed during startup? |
| Rule 6: All mutations idempotent | What is the TTL strategy? What if same key used for different operations? |
| Rule 7: Events to Outbox in same transaction | What about events generated in a read-only query (forbidden by design)? |
| Rule 8: Optimistic locking on aggregates | No retry policy defined. How many retries? With what backoff? |
| Rule 9: PAN never logged | What about error messages that include context? Regex scrubber needed. |
| Rule 10: No `any` type | What about third-party library types that return `any`? How to wrap? |
| Rule 11: No raw strings for domain concepts | Migration path from existing raw string IDs in Prisma schema? |
| Rule 12: Decimal not float | What about calculations in the Rule Engine expression evaluator? |
| Rule 13: Forward-only migrations | Who enforces this during code review? Automated check needed. |
| Rule 14: UUID v7 on new tables | Hybrid state (v4 on old tables, v7 on new) creates join complications. |
| Rule 15: DLQ for every job | Who monitors the DLQ? How long before items are purged? What is the alert threshold? |

**The deepest challenge:** Rules that require automated enforcement but have no automation are wishes, not rules.
Every rule must have a corresponding fitness function or it is unenforceable at scale.

---

## FINAL DELIVERABLE — 30 CATEGORIES

### 1. Critical Architecture Issues (Must Fix Before Any Feature Code)

| # | Issue | Severity |
|---|-------|----------|
| CA1 | No Saga/Compensation pattern for multi-step operations | 🔴 Critical |
| CA2 | PgBouncer + Prisma prepared statement incompatibility | 🔴 Critical |
| CA3 | No Event Versioning strategy — first event schema change will break consumers | 🔴 Critical |
| CA4 | No Domain Clock — all domain code uses `new Date()` directly | 🔴 Critical |
| CA5 | No Architecture Fitness Functions — rules are unenforceable | 🔴 Critical |
| CA6 | No IDOR protection in controllers — RLS is last line, not only line | 🔴 Critical |
| CA7 | No Inbox Pattern — events can be processed twice under failures | 🔴 Critical |
| CA8 | Hot partition risk on UUID v4 → UUID v7 mixed state | 🔴 Critical |
| CA9 | No period lock — financial periods can be retroactively modified | 🔴 Critical |
| CA10 | No aggregate invariant enforcement in domain layer | 🔴 Critical |

### 2. Missing Enterprise Concepts

- Saga / Orchestration for distributed transactions
- Process Manager for long-running business processes
- Backend for Frontend (BFF) per user persona
- Ubiquitous Language Glossary
- Consistency Boundary Map (sync vs async)
- Business Capability Map
- Temporal Tables (point-in-time state)
- Ledger Tables (append-only financial records)
- Identity Platform (distinct from Authentication)
- Experimentation Platform (A/B testing)

### 3. Missing Platform Components

- MCP Server (AI agent integration standard)
- Circuit Breaker State Dashboard
- API Deprecation Registry
- Cross-cutting Concern Library (`@Auditable`, `@Idempotent`)
- Data Governance Platform (classification, lineage, retention)
- Secret Rotation with hot-reload (no restart required)
- Webhook Signature Verification
- Rate Limiting Platform (tiered by plan)
- Mobile Push Notification Platform (FCM/APNs)

### 4. Missing Database Features

- Ledger Tables (append-only with row-level hash)
- Temporal Tables (valid_from / valid_to on registration data)
- Period Lock mechanism (closed periods = read-only)
- Sequence Integrity tracking (NumberSeriesAudit)
- Compensation Tables (saga rollback support)
- Database-level sequence numbers (not application-generated)
- Generated columns for frequently-queried JSONB paths
- GIN indexes on all queried JSONB columns

### 5. Missing Domain Concepts

- Domain Clock (injectable time abstraction)
- Aggregate Invariant documentation and enforcement
- `TaxYear` value object (IT Act 2025)
- `Percentage` / `TaxRate` value objects
- `InvoiceNumber` with gap detection
- `GstReturnPeriod` value object
- `IFSCCode`, `PhoneNumber` value objects
- Specification pattern for complex queries

### 6. Missing User Experience Features

- Keyboard-only journal entry workflow
- Trial Balance with drill-down to source document
- Offline POS with conflict resolution
- CA sub-delegation (junior CA → specific clients only)
- CA practice management (billing clients for time)
- Bulk CA operations (send reminders to all clients)
- Accessibility: WCAG 2.1 AA compliance
- Voice commands for mobile (WhatsApp-native)
- Period comparison views (July 2026 vs July 2025)

### 7. Missing Security Controls

- IDOR protection at controller layer (not only RLS)
- Mass assignment protection (explicit DTO allowlist)
- Timing-safe comparison for sensitive values (PAN, tokens)
- CA session elevation validation (re-check CaBusinessLink on every request)
- Log scrubbing (regex redact PAN from any error message that slips through)
- Threat Model documentation
- Penetration testing schedule (quarterly)
- CERT-In incident reporting process (mandatory for breaches)
- Consent management (data processing consent from business owner)

### 8. Missing Performance Optimizations

- Cache warming on startup
- Async report generation (no blocking HTTP)
- Stream-based export (no in-memory load of 1M rows)
- Consistent hash sharding to avoid hot partitions
- Query result cache for tax computations (same input → same output, cache 24h)
- N+1 query detection in CI (automated)
- Materialized views for all dashboard queries

### 9. Missing DevOps Practices

- Runbooks for every known failure mode
- SLO/SLA definitions per service tier
- Error budget policy (burn too fast → deployments stop)
- Chaos engineering schedule (monthly, controlled)
- Database backup restore verification (weekly, automated)
- Certificate expiry monitoring (30-day advance alert)
- Secrets rotation automation
- CODEOWNERS file

### 10. Missing AI Capabilities

- MCP Server (standard tool interface for LLMs)
- AI Memory Store (per-user, per-business patterns and preferences)
- Confidence gating for tax advice (LOW confidence → require CA verification)
- AI audit log (every AI action with prompt hash, response, confidence)
- Local LLM support (Ollama for on-premise edition)
- Agent Framework (multi-agent for complex workflows)
- Hallucination detection on financial outputs

### 11. Missing Product Strategy

- Government Edition (NIC cloud, GEM listing, GFR compliance)
- On-premise deployment mode (Docker Compose)
- CA Practice Management (CA's own billing and workflow)
- SDK for third-party module developers
- Partner Program (CA resellers, regional integrators)
- GEM listing for government procurement
- International expansion plan (UAE, Sri Lanka, Bangladesh as first targets)

### 12. Missing Governance

- ADR Process and template (docs/adr/)
- Definition of Done (module level and feature level)
- Deprecation Policy (API, events, tables)
- Complexity Budget per module
- CODEOWNERS file
- Error Budget Policy
- Technical Debt Register with monthly review
- Architecture Review Board cadence

### 13. Missing Engineering Standards

- Architecture Fitness Functions (automated enforcement of all invariants)
- Timezone Policy (UTC storage, IST display, injectable Clock)
- Domain Clock rule (no `new Date()` in domain code)
- Event versioning rules (additive only, migration window)
- Schema registry requirement for all events
- Runbook requirement for all background jobs
- Chaos testing requirement before any new infrastructure

### 14. Missing Documentation

- Ubiquitous Language Glossary
- Business Capability Map
- Consistency Boundary Map
- Event Catalog (auto-generated from manifests)
- Module Ownership Map
- Data Classification Catalog
- Threat Model
- Runbooks (all failure modes)
- On-call Playbook
- Incident Response Process
- Postmortem Template

### 15. Missing Testing

- Architecture Fitness Function tests (in CI)
- Temporal Table tests (point-in-time correctness)
- Saga compensation tests (every compensation path)
- Event ordering tests (out-of-order event handling)
- Concurrency tests (two simultaneous ITR computations for same business)
- N+1 detection tests (automated in CI)
- Chaos tests (Redis down, Postgres down, BullMQ down — what happens?)
- Accessibility tests (axe-core automated scan)

### 16. Missing Automation

- Invoice number gap scanner (nightly, flags gaps to CA dashboard)
- Vendor ITR filer status batch refresh (weekly via TRACES API)
- MSME payment risk scanner (daily, flags vendors approaching 45-day limit)
- AIS auto-import (scheduled once portal API is available)
- Period auto-close (monthly journal auto-post: depreciation, accruals)
- Certificate expiry scanner (30 days before → alert)
- Secrets expiry scanner (rotate 7 days before expiry)
- DLQ auto-triage (classify failure type, route to appropriate team)

### 17. Missing Business Intelligence

- Business Anomaly Detection (sales 50% below average → alert)
- Tax Computation Anomaly Detection (tax < 0 → alert engineers)
- Peer Benchmarking (compare business metrics against industry average)
- Cash Flow Forecasting (30/60/90 day)
- Tax Saving Opportunity Calculator (old vs new regime with what-if)
- Audit Probability Score (based on AIS mismatches, cash transactions, filing history)
- Vendor Concentration Risk (one vendor is 80% of purchases → business risk)

### 18. Missing Compliance

- GFR (Government Financial Rules) reporting for government edition
- Schedule AL (assets and liabilities — mandatory for income > ₹50L)
- Form 3CA/3CB (tax audit report formats)
- Form 3CD (tax audit annexure — 44 clauses, all must be answered)
- Period lock enforcement in accounting (Section 44AA books)
- Books of accounts retention policy (7 years minimum under IT Act)
- Electronic books requirements (Section 44AA digital record keeping)

### 19. Long-term Technical Debt Risks

| Risk | Timeline to Crisis | Mitigation |
|------|-------------------|------------|
| UUID v4 B-tree fragmentation | 5M rows per table | UUID v7 migration plan by Q4 2026 |
| PgBouncer + Prisma prepared statements | First high-traffic day | Fix in Week 1 |
| No event versioning | First event schema change | Schema registry before first event |
| Mixed UUID versions (v4 on old tables) | When joins span old + new tables | Document migration timeline |
| JSONB fields queried without indexes | 1M rows per table | Generated column policy now |
| No temporal tables for registration data | First regulatory audit | Phase 1 after GL |
| No period lock | First multi-user concurrent accounting | Before any GL feature goes live |
| No saga for multi-step workflows | First partial ITR filing failure | Before ITR filing feature |
| console.log everywhere | First security audit | Platform sprint Week 1 |

### 20. Architecture Smells

1. Rules living in both Foundation Standards (docs) and architecture docs — single source of truth needed
2. Platform sprint tasks conflict with feature tasks — sequencing is unclear
3. The Digital Twin depends on the Event Bus, which depends on BullMQ, which depends on Redis — but Redis is not in the infrastructure yet
4. Audit Log is designed to be immutable, but Prisma does not prevent UPDATE/DELETE — database trigger needed
5. ComputationJob replay uses "rule_set_snapshot" — but what if the expression evaluator itself has a bug? The snapshot cannot fix the evaluator.

### 21. Design Smells

1. `businessId` called `tenantId` in some platform tables and `businessId` in module tables — inconsistent (pick one)
2. AssessmentYear stored as both a string ('AY 2025-26') and computed (`AssessmentYear` class) — not consistent
3. `status` is overloaded: workflow status, payment status, health status, OCR status — each should be a specific enum
4. Error codes are a string pattern (MODULE_ENTITY_ERROR) but no enum or registry exists — typos will occur
5. "Partner" means two completely different things: BusinessPartner (40(b) salary) and CaBusinessLink (CA-client relationship)

### 22. Scalability Risks

- Single PostgreSQL instance fails at ~10,000 concurrent users without pooling + read replicas
- No sharding strategy — at 100M businesses (future), single-server Postgres is insufficient
- BullMQ on Redis: Redis is single-threaded; at 100K events/second, a dedicated queue solution (Kafka) is needed
- Search Engine (currently no FTS) — PostgreSQL FTS is good to ~10M records; beyond that, Elasticsearch is needed
- AI inference costs scale linearly with usage — no cost controls designed (per-tenant AI budget)

### 23. Maintainability Risks

- No module ownership → any engineer can modify any module without specialist review
- No complexity budget → services will grow without bound
- No dead code detection → obsolete code accumulates
- No deprecation policy → old APIs run forever alongside new ones
- Event schema has no versioning → breaking changes are impossible to manage safely

### 24. Operational Risks

- No runbooks → incidents resolved by trial and error
- No SLO → no agreement on acceptable downtime
- No error budget policy → deploys continue when system is degrading
- No database failover → Postgres down = system down
- No on-call rotation documented → who gets called at 3am?

### 25. Suggested ADRs (File These First)

| ADR | Decision |
|-----|----------|
| ADR-0001 | Use UUID v7 / ULID for all new primary keys |
| ADR-0002 | Rule Engine is Platform (not IT module) |
| ADR-0003 | Events require Schema Registry entry before publishing |
| ADR-0004 | Domain Clock: no `new Date()` in domain code |
| ADR-0005 | Saga/Orchestration required for all multi-step workflows |
| ADR-0006 | Ledger tables are append-only at database level |
| ADR-0007 | Temporal tables required for any state that must be queried point-in-time |
| ADR-0008 | MCP Server is the AI integration standard (not custom per-LLM APIs) |
| ADR-0009 | BFF pattern for CA App, Mobile POS, and Web App |
| ADR-0010 | Architecture Fitness Functions must exist for every Foundation Standard rule |

### 26. Suggested New Platform Services

| Service | Why |
|---------|-----|
| MCP Server | AI agent integration standard |
| Experimentation Platform | A/B testing for features |
| Data Governance Platform | PII tracking, lineage, purge |
| Secret Rotation Service | Hot rotation without restart |
| Rate Limiting Platform | Tiered by plan, not just global |
| Mobile Push Platform | FCM/APNs abstraction |
| Webhook Signature Verification | For incoming webhooks (banks, portals) |
| Business Anomaly Detector | AI-powered business metric alerts |

### 27. Suggested New Core Tables

| Table | Purpose |
|-------|---------|
| `LedgerRecord` | Append-only financial ledger |
| `PeriodLock` | Locks financial period from modification |
| `NumberSeriesAudit` | Tracks every issued number, flags gaps |
| `BusinessRegistrationHistory` | Temporal: GST type, regime, status by date |
| `CompensationRecord` | Saga rollback tracking |
| `InboxEvent` | Idempotent event processing |
| `ArchivePointer` | Points to archived data in cold storage |
| `DataQualityScore` | Per-tenant per-entity completeness score |
| `ConsentRecord` | Data processing consent per business/user |
| `ExperimentAssignment` | A/B test variant per user |
| `AiMemory` | Per-user/business AI context memory |
| `McpToolCall` | Audit log for AI agent tool calls |

### 28. Suggested New Value Objects

`TaxYear`, `Percentage`, `TaxRate`, `IFSCCode`, `PhoneNumber`, `GstReturnPeriod`,
`InvoiceNumber`, `TaxableAmount`, `ExemptAmount`, `FiscalPeriod`, `CostCenterCode`,
`EmployeeId` (branded), `VendorId` (branded), `CustomerId` (branded)

### 29. Suggested New Domain Events

`SaleVoided`, `PeriodClosed`, `PeriodReopened`, `AuditStarted`, `AuditCompleted`,
`InvoiceGapDetected`, `PenaltyAccrued`, `LegalHoldPlaced`, `LegalHoldLifted`,
`BusinessOnboarded`, `BusinessChurned`, `PlanUpgraded`, `PlanDowngraded`,
`UnusualLoginDetected`, `MfaDisabled`, `DataExportRequested`, `ConsentGranted`, `ConsentRevoked`,
`AiHallucinationDetected`, `HumanOverrideApplied`, `AgentTaskCompleted`, `AgentTaskFailed`,
`SecretRotated`, `CertificateExpiring`, `CertificateExpired`,
`VendorItrStatusChanged`, `VendorGstinSuspended`, `MsmePaymentRiskFlagged`

### 30. Suggested New Engineering Principles

1. **The Clock Principle:** No domain code uses wall time directly. All time is injected via `Clock`.
2. **The Snapshot Principle:** Every computation stores its input snapshot. Replay must be deterministic.
3. **The Consistency Principle:** Document synchronous vs eventual consistency for every aggregate pair. Default is eventual.
4. **The Gap Principle:** Financial sequences must have no unexplained gaps. Every void must have a reason.
5. **The Ledger Principle:** Financial records are append-only. Corrections create new entries, not overwrites.
6. **The Period Principle:** Closed financial periods are immutable. Reopening requires two-person authorization.
7. **The Schema Principle:** Events are public contracts. Breaking changes require a migration window.
8. **The Invariant Principle:** Every aggregate's invariants are documented in code, not only in documentation.
9. **The Fitness Principle:** Every architectural rule has an automated fitness function in CI.
10. **The Debt Principle:** Every piece of identified technical debt is registered. The register is reviewed monthly. Debt never disappears by being forgotten.

---

## RED TEAM FINAL SCORE

| Category | Previous Score | Red Team Adjustment | Reason |
|----------|---------------|--------------------|---------| 
| Foundation | — | -5% | Rules without fitness functions are not rules |
| Architecture | 10% | +5% (corrected) | DDD concepts added in FOUNDATION_STANDARDS |
| Database | 35% | -5% | PgBouncer incompatibility, no temporal tables, no ledger tables |
| Events | 15% | -5% | No versioning, no inbox, no ordering guarantee |
| Security | 20% | -5% | IDOR gap, mass assignment, timing attacks, no threat model |
| Performance | 10% | +0% | Cold start, N+1 risk identified |
| Domain | 5% | +0% | Missing clock, invariants, value objects still absent |
| **Adjusted Total** | **240/1400 (17%)** | **~205/1400 (15%)** | New gaps reduce the adjusted score |

**The architecture improved with each document. But each improvement also revealed more gaps.**
**This is not a sign of failure. It is a sign that the review process is working.**

---

## CLOSING STATEMENT FROM THE BOARD

The previous reviews prescribed what to build. This review prescribes how not to break it.

The three categories of failure for a 20-year platform:

**Category 1: Building the wrong thing.** The previous reviews addressed this.
**Category 2: Building the right thing incorrectly.** This review addresses this.
**Category 3: Building it correctly but not being able to maintain it.** ADRs, fitness functions, ownership, and debt registers address this.

The architecture has good bones. The Foundation Standards are a genuine improvement over 90% of ERP codebases. The platform-first thinking is correct.

What it lacks is the infrastructure of self-correction:
- Fitness functions catch violations automatically
- ADRs record why decisions were made
- Runbooks handle failures without panic
- SLOs define what success looks like
- Debt register ensures nothing is forgotten

A system that corrects itself survives 20 years.
A system that relies on individual discipline does not.

Build the self-correction infrastructure before you build the features.

---

*Red Team Review Complete.*
*No approval granted until ADR-0001 through ADR-0010 are filed and the architecture fitness functions pass in CI.*
