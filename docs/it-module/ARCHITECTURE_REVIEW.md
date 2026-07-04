# Enterprise Direct Tax OS — Master Architecture Review

> Reviewed by: Chief Software Architect, ERP Product Architect, CA, IT Consultant, TDS Expert,
> CBDT Compliance, Enterprise SaaS, Database Architect, UX, AI, Security, DevOps, QA, PM, BA
>
> Date: July 2026
> Status: PRE-DEVELOPMENT — All findings must be resolved before a single line of code is written.

---

## THE VERDICT

The existing documentation describes a **feature list**, not an architecture.
It will produce an ITR filing helper, not an Enterprise Direct Tax OS.

**Three architectural blockers that override everything else:**

### BLOCKER 1: No General Ledger
The ERP has purchases, sales, POS transactions, and payments — but NO double-entry journal entries, NO chart of accounts, NO trial balance.

Income Tax computation requires a certified P&L and Balance Sheet.
Without a proper GL, every IT computation is an approximation.
An approximation cannot be filed as a tax return.

**This must be resolved in the architecture before any IT module code is written.**

### BLOCKER 2: Hardcoded Rules = A Deployment on Every Budget
The computation engine document hardcodes slabs, rates, thresholds, and section limits.
Finance Acts change these every year.
If they are in code, every February Budget requires a code deployment.
At 10,000 businesses on the platform, that is a live-system risk.

**A metadata-driven rule engine is not optional. It is the foundation.**

### BLOCKER 3: Year-End Computation = Reactive Tax Management
The architecture computes tax on demand, at year-end.
A business does not discover it missed advance tax in July.
It discovers it in September when the penalty starts.

**Real-time, event-driven tax computation is the only architecture that protects users.**

---

## REVISED VISION: Enterprise Direct Tax Operating System

Stop thinking of this as a module inside an ERP.

Think of it as an operating system for Indian tax compliance that runs inside an ERP.

It has four layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4 — Intelligence Layer                                    │
│  AI Copilot, Compliance Score, Risk Engine, Tax Planning         │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3 — Application Layer                                     │
│  ITR Filing, TDS Management, CA Workflow, Notice Management      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2 — Computation Layer                                     │
│  Rule Engine, Event-Driven Tax Engine, Reconciliation Engine     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1 — Foundation Layer                                      │
│  General Ledger, Document Store, Audit Log, Event Bus            │
└─────────────────────────────────────────────────────────────────┘
```

Each layer is only as good as the one below it.

---

## THE 15 QUESTIONS — ANSWERED

### Q1: Rule Engine — metadata-driven or hardcoded?
**Decision: 100% metadata-driven. No tax rate, threshold, section limit, or form name is allowed in application code.**

Design:
```
FinanceAct { id, year, gazette_date, effective_from, effective_to }

TaxRuleSet { id, finance_act_id, assessment_year, entity_type, is_active }

TaxRule {
  id, rule_set_id, category (SLAB/RATE/THRESHOLD/EXEMPTION/PENALTY/FORM),
  section, sub_section, description,
  parameters: JSONB {
    rate?: number,
    minIncome?: number, maxIncome?: number,
    threshold?: number,
    entityTypes?: string[],
    conditions?: RuleCondition[],
    formName?: string,
    dueDate?: string
  },
  priority, supersedes_rule_id, is_overridable
}
```

Every Budget update = add a new FinanceAct row + new TaxRuleSet + new TaxRule rows.
No code deployment for rate changes.
Admin UI to publish new rules.
Previous year rules preserved for historical recomputation.

### Q2: Assessment Year Versioning
Each `ItReturn`, `TdsEntry`, `AdvanceTaxPayment`, and computation is stamped with `assessmentYear`.
The rule engine receives `assessmentYear` and loads the correct `TaxRuleSet`.
Both AY 2024-25 and AY 2025-26 rules coexist in the database simultaneously.
Recomputing a 3-year-old return automatically loads the rules that were in effect that year.

### Q3: Ledger Integration — APIs/events or direct query?
**Decision: Event-driven, never direct query.**

The Tax Engine subscribes to events published by other modules:
- `invoice.created` → update revenue estimate
- `purchase.created` → update COGS, check TDS obligation
- `expense.created` → classify, check 40A(3), check 43B
- `payment.created` → trigger TDS detection
- `asset.purchased` → update asset block, recompute depreciation
- `salary.processed` → update 43B PF/ESI status
- `ais.uploaded` → trigger reconciliation job

The Tax Engine NEVER queries `SalesInvoice` or `Purchase` tables directly.
This keeps bounded contexts clean and allows the GL (when built) to replace
these source tables without touching the Tax Engine.

### Q4: General Ledger Maturity
**Current state: No GL. This is the most critical architectural gap.**

The ERP has operational data (sales, purchases, payments) but no:
- Chart of Accounts (CoA)
- Journal entries (debit/credit)
- Trial Balance
- Ledger account balances

**Impact on IT module:**
- Schedule BP (business P&L for ITR-3) cannot be auto-generated — approximated
- Schedule BS (Balance Sheet) cannot be auto-generated — manual CA entry required
- Form 3CD (tax audit) cannot be auto-populated — partially manual
- Partner capital accounts cannot be auto-reconciled

**Immediate mitigation (v1):**
- Tax Engine uses aggregated ERP data (sum of invoices, purchases, expenses)
- CA manually enters Balance Sheet in the ITR review screen
- All manual entries are locked after CA review

**Long-term (v2):**
- Build proper double-entry GL with CoA, journal entries, trial balance
- Tax Engine subscribes to `journal_entry.posted` events
- Balance Sheet and P&L auto-generate from GL
- Document this constraint clearly to CAs using v1

### Q5: Background Processing
**Decision: Redis + Bull Queue (BullMQ) — not a scheduler.**

A cron scheduler alone will not scale. Use an event queue with worker pools:

```
Queues:
- tax-computation.queue       — triggered by ERP transaction events
- tds-scan.queue              — daily overnight scan of all payments
- ais-reconciliation.queue    — triggered on AIS upload
- advance-tax.queue           — triggered on every computation update
- reminder.queue              — deadline-based notifications
- document-ocr.queue          — triggered on document upload
- pan-verification.queue      — batch PAN validation
- compliance-score.queue      — nightly recalculation for all businesses
```

Workers are separate NestJS microservices or worker threads.
Failed jobs retry with exponential backoff.
Dead letter queue for manual inspection.

### Q6: Document Management
**Decision: Centralized document service — not URL strings in model fields.**

Current schema stores `documentUrl: String` fields scattered across models.
This creates: no versioning, no access control, no OCR pipeline, no lifecycle.

Design a unified `Document` service:
```
Document {
  id, businessId, category (NOTICE/FORM_16/PARTNERSHIP_DEED/AIS/ITR_JSON/ACKNOWLEDGMENT/...),
  originalFilename, mimeType, sizeBytes,
  storageKey,       // S3/MinIO path — never exposed directly
  hash,             // SHA-256 for integrity
  uploadedBy, uploadedAt,
  ocrStatus (PENDING/PROCESSING/DONE/FAILED),
  ocrText,          // extracted text for search
  metadata: JSONB,  // form type, AY, notice section, etc.
  version, parentDocumentId, // versioning chain
  isDeleted, deletedAt, deletedBy
}
```

Every model that has a URL field gets replaced with `documentId` FK.
Pre-signed URLs for access (short-lived, audit-logged).
OCR pipeline for notices, Form 16, partnership deeds.

### Q7: Rule Explainability
**Decision: Computation lineage is mandatory — not optional.**

Every number in the tax computation must carry a `ComputationLineage` record:

```
ComputationLineage {
  computationId, outputField, outputValue,
  ruleId, ruleSection, ruleDescription,
  inputSources: [{
    sourceType (INVOICE/EXPENSE/PAYMENT/ASSET/MANUAL),
    sourceId, sourceAmount, sourceDate, sourceDescription
  }],
  adjustmentType, adjustmentAmount, adjustmentSection,
  computedAt, computedBy
}
```

When user clicks on any tax figure → drill down to:
Amount → Line items → Each source voucher → Document → Section of law

This is what makes CAs trust the system.
No explainability = no CA adoption.

### Q8: Workflow Engine
**Decision: Generic workflow engine — not custom status fields.**

Current design: `status = DRAFT | CA_REVIEW | OWNER_REPLIED | ...` — fragile.

Design a proper finite state machine workflow engine:

```
WorkflowDefinition {
  id, name, version, entity_type,
  states: JSONB [{ name, label, isTerminal, actions[] }],
  transitions: JSONB [{ from, to, trigger, conditions[], actions[] }],
  sla: JSONB { state, warnAfterHours, escalateAfterHours, escalateTo }
}

WorkflowInstance {
  id, definition_id, entity_type, entity_id,
  current_state, started_at, last_transition_at,
  history: JSONB [{ from, to, trigger, actor, timestamp, note }],
  sla_breach_at, is_escalated
}
```

Workflows to implement:
1. **IT Return lifecycle**: SETUP → DATA_COMPLETE → CA_REVIEW → ISSUES_FLAGGED → OWNER_RESPONSE → CA_APPROVED → JSON_GENERATED → FILED → ACKNOWLEDGED → UNDER_ASSESSMENT → CLOSED
2. **TDS compliance**: PAYMENT_MADE → TDS_FLAGGED → TDS_DEDUCTED → CHALLAN_PAID → RETURN_FILED → CERTIFICATE_ISSUED
3. **Notice lifecycle**: RECEIVED → ACKNOWLEDGED → UNDER_REVIEW → RESPONSE_DRAFTED → FILED → AWAITING_ORDER → ORDER_RECEIVED → CLOSED/APPEALED
4. **Advance Tax**: ESTIMATED → Q1_DUE → Q1_PAID → Q2_DUE → Q2_PAID → ...
5. **Rectification**: FILED → CPC_PROCESSED → INTIMATION_RECEIVED → RECTIFICATION_FILED → RECTIFICATION_PROCESSED → CLOSED

### Q9: Notification Engine
**Decision: Unified notification framework with channel routing.**

One service handles all notifications — not scattered alert() calls.

```
NotificationRule {
  trigger_event, entity_type, condition, template_id,
  channels: [IN_APP, EMAIL, WHATSAPP, SMS],
  recipient_roles: [OWNER, CA, ACCOUNTANT],
  advance_days, recurrence
}

NotificationLog {
  id, rule_id, entity_id, recipient_id, channel,
  status (PENDING/SENT/DELIVERED/FAILED/READ),
  sent_at, delivered_at, read_at, error_message
}
```

Built-in rules for:
- Advance tax due (30 days, 7 days, 1 day, overdue)
- TDS deposit due (7 days, 1 day, overdue)
- TDS return due (7 days, 1 day, overdue)
- ITR filing due (30 days, 7 days, 1 day, overdue)
- Notice received (immediate)
- CA flagged issue (immediate)
- Owner reply received (immediate)
- Refund processed (immediate)
- AIS mismatch detected (immediate)

### Q10: Audit Logging
**Decision: Immutable append-only audit log — separate from application tables.**

All tax-impacting changes write to an immutable log:
```
TaxAuditLog {
  id, timestamp, business_id, assessment_year,
  actor_id, actor_role, actor_ip,
  action, entity_type, entity_id,
  field, old_value, new_value, reason,
  hash, previous_hash  // blockchain-style chaining
}
```

This table is:
- INSERT only (no UPDATE or DELETE ever)
- Hash-chained (tampering is detectable)
- Partitioned by month for performance
- Exported to immutable cold storage after 6 months

### Q11: API-First Design
Every function is a NestJS controller endpoint.
No business logic in controllers — all in service classes.
Service classes are injectable and testable.
Same services power REST API, event handlers, background jobs, and future gRPC.
OpenAPI spec auto-generated and versioned.

### Q12: Event-Driven Architecture
See full design in Section 2 (Architecture).
Short answer: YES. Every financial transaction immediately triggers a tax computation event.
Tax dashboard is live, not stale.

### Q13: Compliance Rule Ownership
An `Admin → Rules` screen (SUPER_ADMIN only) allows:
- Publishing new FinanceAct entries
- Adding/editing/deprecating TaxRule rows
- Previewing rule impact before publishing
- Rolling back a rule set
- Rule audit log (who changed what, when)

No rule change requires code deployment.
Rule changes go through a review workflow (draft → review → published).

### Q14: Cross-Module Intelligence
**Decision: Shared event bus (BullMQ) — not direct service calls.**

Each module publishes to named event channels:
```
purchases:        purchase.created, purchase.paid, purchase.cancelled
sales:            invoice.created, invoice.cancelled, payment.received
expenses:         expense.created, expense.categorized
assets:           asset.purchased, asset.disposed, asset.depreciated
payroll:          salary.processed, pf.deposited, esi.deposited
gst:              gstr1.filed, gstr3b.filed, rcm.paid
banking:          payment.made, challan.paid, bank.reconciled
```

Tax Engine subscribes to all of these.
No circular dependencies.
Adding a new module = publish events. Tax Engine subscribes. No changes elsewhere.

### Q15: Testing Strategy
**Decision: Golden test dataset for every AY, entity type, and edge case.**

```
test/golden/
  proprietorship_simple_AY2526.json     // simple retail, new regime
  partnership_2partner_AY2526.json      // 40(b) limits, capital accounts
  proprietorship_44AD_AY2526.json       // presumptive, turnover < 3Cr
  proprietorship_audit_AY2526.json      // turnover > 1Cr, audit required
  firm_loss_carryforward_AY2526.json    // BFLA from AY 2324
  proprietorship_tds_default_AY2526.json // 40(a) disallowance
  individual_old_regime_AY2526.json     // 80C + 80D + housing loan
```

Each golden test contains:
- Input: transactions, expenses, assets, manual entries
- Expected output: line-by-line computation result
- Rules version used

Regression suite runs on every deployment.
If Finance Act changes, golden tests update and must pass before release.

---

## SECTION 1: MISSING FEATURES (Complete List)

### 1.1 Post-Filing Lifecycle — COMPLETELY MISSING

**CPC Processing & Intimation u/s 143(1)**
After ITR is filed, CPC processes it and sends an intimation.
This can show: tax payable (demand), refund, or no demand.
Users need to track this:
```
CpcIntimation {
  id, businessId, assessmentYear, itrAcknowledgmentNo,
  intimationDate, demand, refund, status
  processingRemarks, documentId
}
```

**Demand Management u/s 156**
If CPC or AO raises a demand, the taxpayer must pay within 30 days.
```
TaxDemand {
  id, businessId, assessmentYear, demandType (CPC/AO/PENALTY),
  section, demandAmount, interestAmount, totalAmount,
  demandDate, dueDate, paidAmount, paidDate, status
}
```

**Refund Tracking**
After filing, if refund is due, track status:
```
RefundTracking {
  id, businessId, assessmentYear, claimedAmount,
  issuedAmount, issuedDate, mode (BANK/CHEQUE),
  bankAccount, utrNumber, status, failureReason
}
```
Integrate with IT portal refund status API (available without ERI).

**Rectification u/s 154**
For errors apparent from record in CPC processing:
```
RectificationRequest {
  id, businessId, assessmentYear, originalItrAcknowledgmentNo,
  filedAgainst (ITR/INTIMATION/ORDER), errorType,
  description, documentId, filedDate, status,
  responseOrderId, disposalDate
}
```

### 1.2 Notice Management — MISSING

Every Indian business receives IT notices. This is not optional.

```
ItNotice {
  id, businessId, assessmentYear, noticeSection,
  noticeType (DEFECTIVE_139_9 / SCRUTINY_143_2 / DEMAND_156 /
              PENALTY_274 / REASSESSMENT_148 / INCOME_ESCAPE_148A /
              FACELESS_ASSESSMENT / SHOW_CAUSE / SUMMONS_131),
  issuedDate, dueDate, demandAmount, documentId,
  eProccedingToken, // for faceless cases
  status (RECEIVED/ACKNOWLEDGED/DRAFT_RESPONSE/RESPONSE_FILED/
          AWAITING_ORDER/ORDER_RECEIVED/APPEALED/CLOSED),
  responseText, responseDocumentId, responseFiledDate,
  orderDocumentId, orderDate, orderOutcome
}
```

**Notice Management Workflow:**
1. Notice received → upload PDF → OCR extracts section, date, demand
2. AI explains notice in plain language (Hindi + English)
3. System shows: relevant past transactions that likely triggered notice
4. CA drafts response with supporting documents
5. Response filed on portal (manual in v1, API in v2)
6. Order received → link to notice → track outcome
7. If demand raised → create TaxDemand record
8. If order unsatisfactory → initiate appeal

### 1.3 Appeals — MISSING

```
AppealFiling {
  id, businessId, noticeId or orderId,
  appealType (CIT_APPEALS / ITAT / HIGH_COURT),
  groundsOfAppeal, filedDate, admittedDate,
  hearingDates: JSONB [],
  status, orderDate, orderDocumentId, outcome,
  furtherAppeal: boolean
}
```

### 1.4 E-Proceedings / Faceless Assessment — MISSING

Since 2021, all assessments are faceless (National Faceless Assessment Centre).
The entire proceeding happens on the portal — no in-person hearings.
The system must support:

```
FacelessProceeding {
  id, businessId, assessmentYear,
  proceedingType (FACELESS_ASSESSMENT / FACELESS_PENALTY / FACELESS_APPEAL),
  dinNumber,         // Document Identification Number
  issuedDate, responseDueDate,
  submissions: JSONB [{ date, description, documentIds[] }],
  status, finalOrderDate, finalOrderDocumentId,
  taxEffect (demand/refund/nil)
}
```

### 1.5 ITR-U (Updated Return) — MISSING

Special return allowed within 2 years of end of AY.
Requires additional tax: 25% (filed within 1 year) or 50% (filed within 2 years).
Cannot be filed if: search/survey, proceedings pending, prosecution initiated.

```
// Add to ItReturn:
returnType: (ORIGINAL / REVISED / BELATED / UPDATED)
itrUAdditionalTaxPercent: Decimal?   // 25 or 50
itrUAdditionalTaxAmount: Decimal?
itrUReasonCode: String?              // CBDT prescribed reason codes
```

**Computation rule:** ITR-U cannot reduce tax. It can only INCREASE it.
System must validate: `updated_tax >= original_tax`.

### 1.6 TIS (Tax Information Summary) — MISSING

TIS is derived from AIS — it aggregates duplicate information and shows one value per transaction type.
If AIS shows two FD interest entries from the same bank → TIS combines them.

```
TisEntry {
  id, businessId, assessmentYear,
  informationCategory (SALARY / INTEREST / DIVIDEND / GST_TURNOVER / etc.),
  aggregatedAmount, processedAmount,  // taxpayer-confirmed amount
  feedbackStatus (NO_ACTION / ACCEPT / MODIFIED),
  feedbackValue, uploadedAt
}
```

The system should show BOTH AIS (granular) and TIS (aggregated) views.
CA should reconcile TIS vs our computed income — any gap must be explained.

### 1.7 SFT (Statement of Financial Transactions) — MISSING

High-value transaction reporting by third parties to IT dept.
Appears in AIS. Taxpayer must respond.
Our system should flag when an AIS entry likely came from SFT:
- Cash deposit > ₹10L in savings account
- FD interest > ₹10L
- Property purchase > ₹30L (from registrar)
- Dividend > ₹10L (from company)
- Mutual fund purchase > ₹10L
- Cash payment of insurance premium > ₹1L
- Foreign remittance > ₹10L

When these appear in AIS without matching our data → flag for CA review.

### 1.8 Tax Payments & Challan Management — MISSING

Currently only `AdvanceTaxPayment` exists. Missing:

```
TaxChallan {
  id, businessId, challanType (ADVANCE_TAX_280 / SELF_ASSESSMENT_280 / TDS_281 / TCS_281),
  assessmentYear, section (for TDS), paymentDate, amount,
  bsrCode, serialNo, tenderDate,
  mode (NET_BANKING / DEBIT_CARD / NSDL),
  verifiedOnTraces, verificationDate,
  relatedReturnType (ITR / TDS_RETURN), relatedReturnId
}
```

Challan 280: Advance tax + Self-assessment tax
Challan 281: TDS + TCS deposit
System should pre-fill challan details and allow payment via bank gateway.
After payment: auto-import BSR code + serial number.

### 1.9 Form 16 / 16A / 130 Generation — MISSING

After TDS return is filed and TRACES processes it:
- Form 16 (now Form 130): Salary TDS certificate — for employees
- Form 16A: Non-salary TDS certificate — for contractors, professional fees
- Form 27D: TCS certificate — for buyers

```
TdsCertificate {
  id, tdsReturnId, payeeName, payeePan, payerTan,
  period (Q1/Q2/Q3/Q4), financialYear,
  certificateType (FORM_16/FORM_16A/FORM_27D/FORM_130),
  totalAmountPaid, totalTdsDeducted, totalTdsDeposited,
  documentId, generatedFromTraces, issuedDate, dispatchStatus
}
```

Bulk generation → bulk dispatch via WhatsApp/email.

### 1.10 Tax Planning — MISSING

Show users: "If you invest ₹1,50,000 in 80C instruments this month, you save ₹46,800 in tax."

```
TaxPlanningScenario {
  id, businessId, assessmentYear, scenarioName,
  regime, baseIncome, baseDeductions, baseTax,
  plannedChanges: JSONB [{ section, amount, taxImpact }],
  projectedTax, projectedSaving, createdAt
}
```

"What-if" engine: user changes a deduction amount → instant tax impact shown.
CA can save and share scenarios with clients.

### 1.11 AIS Feedback Submission — MISSING

When AIS shows income we disagree with, taxpayer can submit feedback:
- Accept the transaction
- Deny / modify the amount

Currently our schema stores AIS entries but has no feedback mechanism.

```
// Add to AISEntry:
feedbackType: (NO_ACTION / INCOME_IS_CORRECT / INCOME_NOT_RECEIVED /
               INCOME_IS_OF_OTHER_PERSON / INCOME_ALREADY_TAXED /
               DUPLICATE_ENTRY / AMOUNT_IS_DIFFERENT)
feedbackValue: Decimal?   // correct amount if modified
feedbackNote: String?
feedbackFiledAt: DateTime?
itPortalFeedbackRef: String?  // reference from portal after submission
```

### 1.12 GST-IT Turnover Reconciliation Engine — PARTIALLY MISSING

Currently proposed but not designed as a proper reconciliation engine.

```
GstItReconciliation {
  id, businessId, assessmentYear,
  gstTurnover, itTurnover, variance,
  legitimateDifferences: JSONB [{ reason, amount }],
  unexplainedVariance, status, caNote
}

// Legitimate differences to auto-detect:
// - Exempt supply (not in GST, is in IT)
// - Exports (zero-rated in GST, taxable in IT)
// - Composition tax period changes
// - Cash sales (in IT, may be missing in GST)
// - Advance forfeited (income in IT, no GST)
```

If `unexplainedVariance > threshold` → flag for CA review before filing ITR.
A scrutiny notice for turnover mismatch is one of the most common in India.

### 1.13 MAT/AMT Credit Register — PARTIAL

AMT is mentioned but AMT Credit carry-forward is not designed.

```
AmtCredit {
  id, businessId, assessmentYear,
  amtPaidThisYear, regularTaxThisYear,
  amtCreditEarned,           // amtPaid - regularTax (if AMT > regular)
  amtCreditUtilized,         // used to reduce regular tax in future years
  amtCreditBalance,
  // Carry forward 15 years
  expiresAY
}
```

### 1.14 Schedule AL (Assets and Liabilities) — MISSING

Mandatory in ITR-3 if total income > ₹50 lakh.
Discloses: immovable property, movable assets, bank balances, cash, shares/MF/jewellery, loans.

```
ScheduleAL {
  id, businessId, assessmentYear,
  asOfDate,   // 31 March of FY
  immovableProperty: JSONB [{ description, value }],
  movableAssets: JSONB [{ category, value }],
  bankBalances: JSONB [{ bankName, accountNo, balance }],
  cashBalance: Decimal,
  jewelleryCost: Decimal,
  sharesDemat: Decimal,
  mutualFundsValue: Decimal,
  otherAssets: JSONB [],
  totalAssets: Decimal,
  loans: JSONB [{ lender, purpose, outstanding }],
  totalLiabilities: Decimal
}
```

### 1.15 Schedule FA (Foreign Assets) — MISSING

Mandatory for residents with foreign bank accounts, foreign assets, or foreign income.
Rare for SMEs but required for completeness.
Mark as "v2 — add when needed."

---

## SECTION 2: ARCHITECTURE REDESIGN

### 2.1 The Rule Engine (replaces hardcoded computation)

```
┌──────────────────────────────────────────────────────────────────┐
│                        RULE ENGINE                                │
├───────────────┬──────────────────┬───────────────────────────────┤
│  Rule Store   │  Rule Evaluator  │  Rule Admin UI                │
│  (Postgres    │  (stateless,     │  (SUPER_ADMIN)                │
│   JSONB)      │  injectable)     │  Draft → Review → Published   │
└───────────────┴──────────────────┴───────────────────────────────┘
```

Rule categories:
```
SLAB:           income tax slab rates (amount, rate, assessmentYear, entityType, regime)
RATE:           TDS rates (section, payeeType, rate, higherRate_noPAN)
THRESHOLD:      TDS/GST/section thresholds (section, amount, aggregationType)
EXEMPTION:      rebates, exempt limits (section, amount, condition)
SLAB_BENEFIT:   marginal relief, 87A, surcharge inflection points
PENALTY:        interest rates 234A/B/C, late fees 234E
FORM:           form names, due dates (assessmentYear: "138", oldName: "24Q")
LIMIT:          40(b) limits, partner salary formula, 43B items
ALLOWANCE:      depreciation blocks and rates (block, rate, additionalAllowed)
```

Rule evaluation is pure functions:
```typescript
interface RuleContext {
  assessmentYear: string;
  entityType: EntityType;
  regime?: TaxRegime;
  age?: number;
  income?: number;
  section?: string;
}

interface RuleResult {
  value: number | string | boolean;
  ruleId: string;
  ruleSection: string;
  ruleDescription: string;
  appliedConditions: string[];
}

// Example:
ruleEngine.evaluate('SLAB', context)          // returns tax amount + lineage
ruleEngine.evaluate('THRESHOLD', context)     // returns threshold value for given section
ruleEngine.evaluate('RATE', { section: '194C', payeeType: 'INDIVIDUAL' }) // returns 0.01
```

### 2.2 Event-Driven Tax Engine

Every financial transaction publishes an event. Tax engine subscribes.

```
Event Bus (BullMQ channels):

erp.transactions →
  invoice.created     → [Revenue tracking] → update IT computation draft
  purchase.created    → [COGS tracking] → update IT computation draft + TDS check
  expense.created     → [Expense tracking] → IT impact + 40A(3) check + 43B check
  payment.made        → [TDS trigger] → scan for TDS obligation
  asset.purchased     → [Asset register] → add to depreciation block
  asset.disposed      → [Asset disposal] → compute block gain/loss
  salary.processed    → [Payroll] → 43B PF/ESI tracking, TDS 192
  challan.deposited   → [Tax payment] → update advance tax position
  ais.uploaded        → [Reconciliation] → trigger AIS reconciliation job
  notice.received     → [Notice management] → alert CA + owner
  gstr3b.filed        → [GST-IT recon] → update turnover reconciliation
```

After processing each event:
1. Recompute the affected business's tax position
2. Update the advance tax deficit/surplus
3. Update the compliance score
4. Trigger notifications if thresholds crossed

```typescript
// Tax computation is now continuous, not year-end:

class TaxComputationService {

  async onTransactionEvent(event: EachMessagePayload) {
    const { businessId, assessmentYear } = event;

    // Recompute affected components only (not full recompute)
    const affected = this.getAffectedComponents(event.type);
    const draft = await this.getOrCreateDraftComputation(businessId, assessmentYear);

    await this.recomputeComponents(draft, affected);
    await this.updateAdvanceTaxPosition(draft);
    await this.updateComplianceScore(businessId, assessmentYear);
    await this.checkAndSendAlerts(draft);
  }
}
```

### 2.3 Bounded Contexts

```
┌───────────────────────────────────────────────────────────────────┐
│ BOUNDED CONTEXTS (separate NestJS modules, shared event bus only) │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│  Operations  │  Compliance  │  Filing      │  Intelligence       │
│              │              │              │                     │
│  GL (v2)     │  TDS Engine  │  ITR Builder │  Rule Engine        │
│  Inventory   │  TDS Returns │  CA Workflow │  Compliance Score   │
│  Purchases   │  Advance Tax │  Notice Mgmt │  Risk Engine        │
│  Sales       │  Depreciation│  Rectif.     │  AI Copilot         │
│  Expenses    │  AIS Recon   │  Appeals     │  Tax Planning       │
│  Assets      │  GST-IT Recon│  Demands     │  Knowledge Base     │
│  Payroll     │  Compliance  │  Refunds     │  Anomaly Detection  │
│              │  Calendar    │              │                     │
└──────────────┴──────────────┴──────────────┴─────────────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                                │
                         Shared Event Bus
                        (BullMQ + Redis)
```

### 2.4 Multi-Tenant Architecture

Current schema has `businessId` on most tables — good start.
But needs:

```
// Row Level Security on every IT module table
// PostgreSQL RLS policy:
CREATE POLICY business_isolation ON "ItReturn"
  USING (business_id = current_setting('app.current_business_id')::uuid);

// Tenant context set on each request:
SET app.current_business_id = 'uuid-here';
```

CA access: A CA can query across their assigned businesses but not others.
Enforce at query level via `CaBusinessLink`, not at application logic level.

---

## SECTION 3: DATABASE REDESIGN

### 3.1 Missing Tables (Critical)

```sql
-- Rule Engine
CREATE TABLE finance_acts (id, year, gazette_date, effective_from, effective_to, is_active);
CREATE TABLE tax_rule_sets (id, finance_act_id, assessment_year, entity_type, is_active);
CREATE TABLE tax_rules (id, rule_set_id, category, section, parameters JSONB, priority, supersedes_id);
CREATE TABLE rule_audit_log (id, rule_id, action, old_values, new_values, actor_id, timestamp);

-- Computation Lineage (explainability)
CREATE TABLE computation_lineage (
  id, computation_id, field_name, computed_value,
  rule_id, input_sources JSONB, adjusted_by, computed_at
);

-- Workflow Engine
CREATE TABLE workflow_definitions (id, name, version, entity_type, states JSONB, transitions JSONB, sla JSONB);
CREATE TABLE workflow_instances (id, definition_id, entity_id, entity_type, current_state, history JSONB);

-- Document Store
CREATE TABLE documents (
  id, business_id, category, original_filename, mime_type, size_bytes,
  storage_key, hash, uploaded_by, uploaded_at,
  ocr_status, ocr_text, metadata JSONB,
  version, parent_document_id, is_deleted
);

-- Notice Management
CREATE TABLE it_notices (
  id, business_id, assessment_year, notice_section, notice_type,
  issued_date, due_date, demand_amount, document_id,
  e_proceeding_token, workflow_instance_id, status
);
CREATE TABLE notice_submissions (
  id, notice_id, submission_date, description, document_ids JSONB,
  submitted_by, submission_type
);

-- Demand / Refund
CREATE TABLE tax_demands (id, business_id, assessment_year, source_type, source_id, section, demand_amount, due_date, paid_amount, status);
CREATE TABLE refund_tracking (id, business_id, assessment_year, claimed_amount, issued_amount, issued_date, utr, status);

-- CPC Intimation
CREATE TABLE cpc_intimations (id, business_id, assessment_year, itr_acknowledgment_no, intimation_date, demand, refund, status, document_id);

-- Rectification
CREATE TABLE rectification_requests (id, business_id, assessment_year, source_id, error_type, description, document_id, filed_date, status, response_order_id);

-- Appeals
CREATE TABLE appeal_filings (id, business_id, source_notice_id, appeal_type, grounds JSONB, filed_date, status, hearing_dates JSONB, order_document_id, outcome);

-- Tax Payment / Challan
CREATE TABLE tax_challans (id, business_id, challan_type, assessment_year, section, payment_date, amount, bsr_code, serial_no, verified_on_traces, mode);

-- TDS Certificates
CREATE TABLE tds_certificates (id, tds_return_id, payee_name, payee_pan, payer_tan, period, certificate_type, total_paid, total_deducted, document_id, dispatch_status);

-- AIS / TIS
CREATE TABLE ais_entries (id, business_id, assessment_year, ...existing...);
CREATE TABLE tis_entries (id, business_id, assessment_year, information_category, aggregated_amount, processed_amount, feedback_status, feedback_value);

-- Tax Planning
CREATE TABLE tax_planning_scenarios (id, business_id, assessment_year, scenario_name, regime, base_tax, planned_changes JSONB, projected_tax, projected_saving);

-- Schedule AL
CREATE TABLE schedule_al (id, business_id, assessment_year, as_of_date, immovable_property JSONB, movable_assets JSONB, bank_balances JSONB, cash_balance, total_assets, loans JSONB, total_liabilities);

-- Compliance Score
CREATE TABLE compliance_scores (id, business_id, assessment_year, computed_at, overall_score, tds_score, advance_tax_score, books_score, reconciliation_score, risk_level, issues JSONB);

-- AMT Credit
CREATE TABLE amt_credits (id, business_id, assessment_year, amt_paid, regular_tax, credit_earned, credit_utilized, credit_balance, expires_ay);

-- Loss Carry Forward (rename from our LossCarryForward design)
CREATE TABLE loss_carry_forwards (id, business_id, loss_type, assessment_year, opening_balance, set_off_this_year, closing_balance, expires_ay);

-- GSTxIT Reconciliation
CREATE TABLE gst_it_reconciliations (id, business_id, assessment_year, gst_turnover, it_turnover, variance, legitimate_differences JSONB, unexplained_variance, status, ca_note);

-- Immutable Audit Log
CREATE TABLE tax_audit_log (
  id, timestamp, business_id, assessment_year,
  actor_id, actor_role, actor_ip,
  action, entity_type, entity_id,
  field, old_value, new_value, reason,
  hash, previous_hash
) PARTITION BY RANGE (timestamp);

-- Notification Engine
CREATE TABLE notification_rules (id, trigger_event, entity_type, condition JSONB, template_id, channels JSONB, recipient_roles JSONB, advance_days, recurrence);
CREATE TABLE notification_log (id, rule_id, entity_id, recipient_id, channel, status, sent_at, delivered_at, error_message);

-- Faceless Proceedings
CREATE TABLE faceless_proceedings (id, business_id, assessment_year, proceeding_type, din_number, issued_date, response_due_date, submissions JSONB, status, final_order_document_id, tax_effect);
```

### 3.2 Missing Indexes

```sql
-- All IT tables need composite indexes on (business_id, assessment_year) — the most common query pattern
CREATE INDEX idx_it_return_ba ON it_returns (business_id, assessment_year);
CREATE INDEX idx_tds_entry_ba ON tds_entries (business_id, assessment_year);
CREATE INDEX idx_advance_tax_ba ON advance_tax_payments (business_id, assessment_year);
CREATE INDEX idx_it_notice_ba ON it_notices (business_id, assessment_year);
CREATE INDEX idx_compliance_score_ba ON compliance_scores (business_id, assessment_year);

-- Status indexes for queue-based processing
CREATE INDEX idx_tds_entry_status ON tds_entries (status) WHERE status != 'FILED';
CREATE INDEX idx_it_return_status ON it_returns (status) WHERE status != 'FILED';
CREATE INDEX idx_notice_status ON it_notices (status) WHERE status != 'CLOSED';

-- Due date indexes for reminder engine
CREATE INDEX idx_advance_tax_due ON advance_tax_payments (due_date) WHERE status = 'PENDING';
CREATE INDEX idx_tds_deposit_due ON tds_entries (payment_date) WHERE status = 'PENDING';

-- CA link for multi-client query
CREATE INDEX idx_ca_link_ca_user ON ca_business_links (ca_user_id) WHERE is_active = true;

-- Document store for OCR queue
CREATE INDEX idx_doc_ocr ON documents (ocr_status) WHERE ocr_status IN ('PENDING', 'FAILED');

-- Tax audit log partitioning
CREATE INDEX idx_audit_log_business ON tax_audit_log (business_id, timestamp);
```

### 3.3 Critical Schema Fixes

**All IT tables must have:**
```sql
-- Soft delete
is_deleted BOOLEAN DEFAULT false,
deleted_at TIMESTAMP,
deleted_by UUID,

-- Optimistic locking (prevent concurrent overwrites)
version INTEGER DEFAULT 1,

-- Full timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP,
created_by UUID,
updated_by UUID,
```

**ItReturn must have:**
```sql
-- Assessment year stamped (not just financial year)
assessment_year VARCHAR(10) NOT NULL,  -- 'AY 2025-26'
financial_year VARCHAR(10) NOT NULL,   -- '2025-26'

-- Return type
return_type VARCHAR(20) DEFAULT 'ORIGINAL',  -- ORIGINAL/REVISED/BELATED/UPDATED

-- ITR-U fields
itr_u_reason_code VARCHAR(10),
itr_u_additional_tax_percent DECIMAL(5,2),
itr_u_additional_tax DECIMAL(15,2),

-- Workflow
workflow_instance_id UUID,

-- Acknowledgment
acknowledgment_number VARCHAR(30),
filed_at TIMESTAMP,
e_verified_at TIMESTAMP,
e_verify_mode VARCHAR(20),  -- AADHAAR_OTP / NET_BANKING / DSC / EVC

-- Frozen after filing
is_locked BOOLEAN DEFAULT false,
locked_at TIMESTAMP,
locked_by UUID,
```

---

## SECTION 4: COMPLIANCE REVIEW

### 4.1 Critical Compliance Gaps

**AY 2026-27 Form Renaming — MUST update all code**

Form 24Q → Form 138 | Form 26Q → Form 140 | Form 27EQ → Form 143 | Form 27Q → Form 144
Form 16 → Form 130 | Form 16A → Form 16A (unchanged for now)

**Section 43B(h) — MSME Payment (from AY 2024-25)**
Payments to MSME vendors not made within 45 days (agreement) or 15 days (no agreement):
- Disallowed in the year of accrual
- Allowed in the year of actual payment
- Current schema marks supplier `isMsme` but no payment aging check against MSME vendors is designed

**Section 115BAC (New Tax Regime) — Annual opt-in/opt-out**
Business income holders: opt-in once per year via Form 10-IEA.
If opted out of new regime: cannot opt back in the same year.
Carry forward: the regime is per assessment year, not a permanent choice.
System must track regime choice per AY, not per business.

**Section 234F — Late Filing Fee**
₹1,000 if income ≤ ₹5L, ₹5,000 if income > ₹5L.
Currently mentioned in compliance calendar but NOT in computation sequence.
Must be added as a line item in the final tax computation.

**Section 140B — Additional Tax for ITR-U**
When filing updated return (ITR-U):
- If filed within 1 year from end of relevant AY: additional tax = 25% of (tax + interest)
- If filed after 1 year but within 2 years: additional tax = 50% of (tax + interest)
- Plus 1% interest per month under Section 234AB
This is not in any existing document. Must be in computation engine.

**Section 43CA — Stamp Duty Value for Business Assets**
If business sells land/building below stamp duty value → SDV is the deemed consideration.
Currently documented but NOT in the schema (no `stampDutyValue` field on asset disposal).

**Partner Taxation Complexity — Book Profit Circularity**
The 40(b) partner salary computation has a circular dependency issue:
Book profit is BEFORE partner salary, but partner salary affects profit.
The circular computation must be resolved iteratively (or analytically).
Currently the computation engine doc shows a simplified version — needs full formula:

```
Step 1: Book Profit (before partner salary/interest) = P&L net of all other adjustments
Step 2: Allowed salary = max(1,50,000, 90% × first 3L of BP) + 60% × remaining BP
Step 3: Allowed interest = 12% of partner capital balance
Step 4: Taxable income of firm = BP − Allowed salary − Allowed interest
Step 5: If result negative = loss of firm (carry forward u/s 72)
```

**Minimum Alternate Tax (AMT) for Partnership Firms**
AMT (Section 115JC) applies to non-corporate taxpayers.
For partnership firms: if regular tax < 18.5% of adjusted total income → AMT applies.
AMT credit (Section 115JD) is carry-forwardable for 15 years.
Firms with large Chapter VI-A deductions or special deductions may trigger AMT.
Currently mentioned but not in the computation sequence for partnership.

**Section 40A(3A) — Deemed Profit**
If a payment was disallowed u/s 40A(3) in a previous year and it is now paid in cash in the current year → the 40A(3) disallowance of previous year reverses, but the new cash payment triggers a fresh 40A(3).
Complex cross-year adjustment — not in current design.

### 4.2 Finance Act 2025 / New Income Tax Code

The Income Tax Act 2025 (new code replacing the 1961 Act) introduces:
- All form renaming (already captured)
- Simplified language and structure
- Some section number changes (TBD — not all implemented yet)
- New assessment year nomenclature: "Tax Year" instead of "Assessment Year" in some contexts

**Our response:** The Rule Engine handles this naturally. Add new TaxRuleSet for AY 2026-27 with new form names. Old rules remain intact for historical returns. No code changes needed after rule engine is built.

---

## SECTION 5: COMPLETE WORKFLOW

### 5.1 Full Lifecycle (What's Missing at Each Step)

```
STEP 1: Business Onboarding
  ✅ Entity type, PAN, regime, partners (designed)
  ❌ Chart of Accounts setup (no GL module)
  ❌ Opening balance import from previous IT portal login (fetch pre-fill)
  ❌ PAN verification with NSDL on entry

STEP 2: Daily Transactions
  ✅ Sales invoices, purchases, stock
  ❌ Journal entries (no GL)
  ❌ Real-time tax impact (no event-driven engine yet)
  ❌ MSME vendor payment aging tracker

STEP 3: Expense Recording
  ✅ Expense model designed
  ❌ Bank statement import + auto-categorize (AI opportunity)
  ❌ Receipt OCR for expense bills
  ❌ Capital vs revenue classification engine

STEP 4: TDS Management
  ✅ Detection engine designed
  ❌ Challan generation and payment
  ❌ Challan verification on TRACES
  ❌ TDS return (Form 138/140) generation
  ❌ Form 16/16A generation and dispatch

STEP 5: Fixed Assets
  ✅ WDV block depreciation designed
  ❌ Asset tagging (physical barcode/QR)
  ❌ Company Act depreciation (parallel track)
  ❌ Insurance value tracking

STEP 6: Advance Tax
  ✅ Quarterly tracking designed
  ❌ Continuous estimate update (should update on every transaction)
  ❌ 234B/C interest auto-calculation after each shortfall

STEP 7: GST Compliance (parallel)
  ✅ GST in ERP (existing module)
  ❌ GST-IT turnover reconciliation
  ❌ RCM identification and ITC block check

STEP 8: AIS / TIS
  ✅ AIS upload designed
  ❌ TIS entry and reconciliation
  ❌ AIS feedback submission to portal
  ❌ Automatic AIS download (ERI v2)

STEP 9: CA Review
  ✅ Multi-client dashboard designed
  ✅ Flag and response workflow designed
  ❌ Trial balance import from Tally (v1 interim until GL built)
  ❌ Balance Sheet manual entry screen
  ❌ Form 3CD auto-population from ERP data
  ❌ Tax audit checklist per 3CD clause

STEP 10: ITR Preparation
  ✅ Computation engine designed
  ✅ Old/new regime comparison
  ❌ Schedule BS (Balance Sheet) auto-generation
  ❌ Schedule CYLA/BFLA (loss set-off) — only manual entry designed, no auto-set-off engine
  ❌ Schedule AMT / AMTC
  ❌ Schedule AL (assets & liabilities for income > 50L)
  ❌ Schedule 80G (donation deductions — limit computation per charity)

STEP 11: JSON Generation & Filing
  ✅ ITR JSON generation (partially designed)
  ❌ JSON validation against IT portal schema
  ❌ Offline utility compatibility check
  ❌ E-verification: Aadhaar OTP / net banking / DSC (ERI v2)

STEP 12: Post-Filing
  ❌ Acknowledgment download and storage
  ❌ CPC intimation tracking (143(1))
  ❌ Refund tracking
  ❌ Demand payment

STEP 13: Notices & Proceedings
  ❌ Notice management (ENTIRELY MISSING)
  ❌ Faceless assessment workflow
  ❌ E-proceedings response
  ❌ Rectification u/s 154
  ❌ Appeals (CIT(A), ITAT)

STEP 14: Next Year Preparation
  ❌ Auto-carry-forward of losses (BFLA from current to next AY)
  ❌ Rule engine update for new Budget (admin UI)
  ❌ Depreciation closing WDV becomes next year opening WDV (auto-rollover)
  ❌ Partner capital account rollover
```

---

## SECTION 6: UX REDESIGN

### 6.1 Tax Health Dashboard (Replace simple compliance list)

Instead of separate pages for each function, a unified Tax Health screen:

```
┌─────────────────────────────────────────────────────────────────────┐
│  SRIVANI STORES — TAX HEALTH                        AY 2025-26     │
│                                                                      │
│  Overall Score: 78/100 🟡                 Due in: 23 days (31 Jul)  │
├──────────────┬───────────────┬────────────────┬─────────────────────┤
│ TDS          │ Advance Tax   │ Books          │ Filing Readiness    │
│ 92/100 🟢    │ 65/100 🟡     │ 71/100 🟡      │ 54/100 🔴           │
│ ₹0 overdue   │ ₹12K deficit  │ 3 uncategorized│ Balance Sheet ❌    │
│              │ Next: 15 Sep  │ ₹45K cash pay. │ AIS not uploaded ❌ │
└──────────────┴───────────────┴────────────────┴─────────────────────┘

TODAY'S ACTIONS:
→ 3 expenses need category classification
→ TDS on rent due for deposit by 7 Aug (₹8,400)
→ Advance tax Q2 estimate updated — ₹12K additional needed by 15 Sep

ESTIMATED TAX POSITION (live):
  New Regime: ₹87,450 | Old Regime: ₹94,200
  ✅ NEW REGIME SAVES ₹6,750
  Paid so far: ₹80,000 | Balance: ₹7,450
```

### 6.2 Every Number Must Be Drillable

Click any amount on any screen → full explanation:
```
₹3,245 TDS on rent
  ↓
Section 194IB — Rent by Individual (> ₹50,000/month)
  ↓
Rent paid to: Suresh Landlord | ₹64,900/month × 12 = ₹7,78,800/year
  ↓
TDS rate: 5% × ₹64,900 = ₹3,245 (one-time deduction, last month of tenancy)
  ↓
Threshold: Crossed (> ₹50,000/month)
  ↓
Status: PENDING DEDUCTION
  ↓
[Mark as Deducted] [View Rent Payments]
```

### 6.3 CA UX Improvements

**Current design:** CA sees client list → clicks → enters that client's context.
**Better:** CA sees a unified command center:

```
┌────────────────────────────────────────────────────────────────────┐
│  CA COMMAND CENTER — Rajan CPA          AY 2025-26   14 clients   │
│  31 Jul deadline: 21 days away                                      │
├─────────────────────────────────────────────────────────────────────┤
│  🔴 URGENT (4)     🟡 IN PROGRESS (6)     🟢 DONE (4)              │
├──────────────────────────┬─────────────┬─────────┬────────────────┤
│  Client                  │ Status      │ ITR     │ Action          │
├──────────────────────────┼─────────────┼─────────┼────────────────┤
│  Krishna Traders         │🔴 Data Pend │ ITR-5   │ [Request Data] │
│  Lakshmi Medical         │🔴 CA Review │ ITR-3   │ [Start Review] │
│  Sri Durga Hardware      │🔴 My Flags  │ ITR-3   │ [2 queries]    │
│  Balaji Textiles         │🟡 Owner Rep │ ITR-5   │ [View Reply]   │
│  Srivani Stores          │🟢 Filed     │ ITR-3   │ [View Ack]     │
└──────────────────────────┴─────────────┴─────────┴────────────────┘

BULK ACTIONS: [Send data request to 4 clients] [Download all acknowledgments]
```

**Global CA shortcuts:**
- `G + C` → go to client search
- `G + R` → go to reviews queue
- `G + D` → go to deadline tracker
- `Alt+Enter` → mark current return as reviewed

---

## SECTION 7: AI OPPORTUNITIES

### 7.1 AI Copilot (High Value, Practical)

**1. Notice Plain-Language Explainer**
When a notice is uploaded:
- OCR extracts text
- AI summarizes: "The IT department noticed that your GST turnover (₹42L) doesn't match the income reported in your ITR-3 (₹38L). They want an explanation for the ₹4L difference."
- AI suggests: "This may be because of export sales that are zero-rated in GST but taxable in IT. Check if you have any export invoices during FY 2024-25."
- Shows relevant precedents and CBDT circulars

**2. Expense Auto-Classifier**
When expense is entered with description "Paid to Raju Plumber ₹15,000":
- AI classifies: category = REPAIRS_MAINTENANCE, TDS section = 194J (technical), flagged for 40A(3) if cash
- Confidence score shown — user can override
- Learns from corrections over time (per-business model)

**3. Anomaly Detection**
Flag unusual patterns:
- "Your repairs expense this year is 340% of last year. Typical range: ₹2–5L. This year: ₹19L. CA review recommended."
- "This payment to Suresh Enterprises is 3× your average purchase. Verify it's legitimate."
- "Your cash expenses are ₹38L this year — 40A(3) disallowances may reach ₹8L."

**4. Tax Planning Assistant**
"Based on your projected income of ₹24L, investing ₹50,000 in NPS (80CCD(1B)) would save ₹15,600 in old regime. New regime saves ₹6,200 more even without this investment. My recommendation: stick with new regime and skip the NPS lock-in."

**5. Audit Risk Predictor**
Before filing:
"Risk Score: MEDIUM (62/100). Top factors:
- GST-IT variance > 5%: ₹2.4L unexplained
- Cash expenses > 15% of total: unusual for this industry
- TDS default on 2 payments: may trigger 40(a) disallowance query
Recommendation: Get CA to explain the GST-IT variance in a statement before filing."

**6. Section Prediction**
As CA adds a manual adjustment → AI suggests the correct section:
"This looks like a disallowance under Section 40A(3) for cash payments. Should I tag it as that?"

**7. Document OCR + Auto-Population**
Upload Form 16 → auto-extract: employer name, TAN, salary, TDS, standard deduction.
Upload bank interest certificate → auto-populate Schedule OS.
Upload partnership deed → extract: partner names, profit sharing, salary clause, interest clause.
Upload previous ITR JSON → extract: opening WDV of each block, brought-forward losses.

---

## SECTION 8: AUTOMATION OPPORTUNITIES

### 8.1 What Should NEVER require manual action

| Trigger | Auto-action |
|---------|------------|
| Invoice created | Revenue updated in IT draft |
| Purchase > threshold to specific vendor category | TDS obligation flagged |
| Cash payment > ₹10,000 | 40A(3) disallowance flagged |
| MSME invoice aging > 15/45 days | 43B disallowance flagged |
| Asset purchased | Added to depreciation block, 180-day rule checked |
| 1 April of new FY | Previous year closing WDV becomes new year opening WDV |
| 1 April of new FY | New AY's compliance calendar populated |
| 15 days before advance tax due | Estimate recalculated, alert sent |
| AIS uploaded | Auto-reconciliation against our records |
| ITR filed | Acknowledgment tracking started |
| CPC intimation received (upload) | Demand/refund auto-extracted via OCR |
| Notice uploaded | OCR → section extracted → workflow created → CA alerted |
| TDS return filed | Form 16A generation queue triggered |
| Partner capital transaction | Capital account auto-updated |
| FY end (31 March) | Schedule AL prompt if income > ₹50L |
| Budget day (1 February) | Alert: "New Finance Act — rules will be updated. Please review." |

---

## SECTION 9: SECURITY REVIEW

### 9.1 Current Gaps

**Role-based is insufficient — need ABAC (Attribute-Based Access Control)**

Current: CA can access their assigned businesses.
Problem: If CA is removed from a business, can they still access historical data?
Problem: Can an accounts person see partner capital details (sensitive)?

Add to every sensitive query:
```typescript
// Instead of just checking role:
@RequiresPermission({ action: 'READ', resource: 'IT_RETURN', condition: 'is_assigned_ca OR is_business_owner' })
```

**Immutable Audit Log** (designed above — critical for CA compliance)

**Document Encryption**
All uploaded documents (notices, Form 16, partner deeds): encrypt at rest.
Key management: per-business encryption keys, stored in HSM or KMS.

**PAN Data Masking**
PAN shown as `ABCPS****D` by default. Full PAN visible only to SUPER_ADMIN and assigned CA.
Exception: during TDS filing, full PAN needed.

**ITR JSON Encryption in Transit + At Rest**
ITR JSON contains complete financial picture of a business. Treat it as Level 1 sensitive data.
Encrypt in DB, decrypt only for authorized export.

**CA Firewall**
A CA should never be able to:
- Download raw ERP transaction data (they get the tax view, not the operations view)
- Access payroll amounts for individual employees
- See customer-level pricing details

**Session Management for CA Multi-Client**
When CA switches clients, previous client's data must be cleared from browser memory.
Implement: client switch = fresh API session + browser memory clear.

### 9.2 Penetration Testing Requirements
Before go-live with any IT module:
- Test: can a CA access another CA's clients?
- Test: can a business see another business's tax data?
- Test: can someone extract audit logs?
- Test: is the ITR JSON download behind proper auth?
- Test: is the PAN visible via API to unauthorized roles?

---

## SECTION 10: PERFORMANCE REVIEW

### 10.1 Scale Requirements

| Scale | Target | Architecture needed |
|-------|--------|-------------------|
| 1 business | ✅ Any approach works | Current design fine |
| 100 businesses | ✅ Standard NestJS | OK |
| 1,000 businesses | ⚠️ Needs caching | Redis for rule cache, computation cache |
| 10,000 businesses | ❌ Will fail | Need queued processing, background jobs |
| 1,00,000 businesses | ❌ Complete redesign needed | Horizontal scaling, read replicas, partitioned tables |

### 10.2 Critical Performance Scenarios

**Advance tax deadline (15 Sep, 15 Dec, 15 Mar)**
Thousands of businesses need reminders sent simultaneously.
Naive approach: loop through all businesses and send.
Correct approach: fan-out via notification queue → parallel workers.
Message queue handles spike without blocking API.

**Budget Day (1 February)**
New Finance Act published. Admins update rule engine.
System recomputes tax for all active AYs across all businesses.
This is a massive background job — must be queued, not synchronous.
Estimate: 10,000 businesses × 2 AYs = 20,000 recomputation jobs.
At 1 second per job: 5.5 hours. Must use parallel workers (10 workers = 33 minutes).

**AIS Reconciliation**
Each AIS file can have hundreds of entries.
Reconciliation against ERP data = many-to-many matching.
Use a dedicated queue + worker, not synchronous on upload.

**ITR JSON Generation**
One JSON per business — computationally intensive.
Pre-generate in background when computation is finalized.
Cache the JSON (invalidate only on data change).

### 10.3 Database Performance

**Partitioning:**
- `tax_audit_log` → RANGE partition by month (append-only, query by time range)
- `tds_entries` → RANGE partition by financial_year (most queries are within a year)
- `computation_lineage` → RANGE partition by computed_at

**Materialized Views:**
```sql
-- Compliance score inputs (expensive to compute live)
CREATE MATERIALIZED VIEW mv_tds_summary AS
  SELECT business_id, assessment_year,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
    SUM(tds_amount) FILTER (WHERE status = 'PENDING') as pending_amount,
    COUNT(*) FILTER (WHERE status = 'OVERDUE') as overdue_count
  FROM tds_entries
  GROUP BY business_id, assessment_year;
-- Refresh: nightly via background job

-- Advance tax position
CREATE MATERIALIZED VIEW mv_advance_tax_position AS ...
```

---

## SECTION 11: ENTERPRISE READINESS

### 11.1 Multi-Entity / Group Support

A business group may have:
- 1 proprietorship
- 1 partnership firm
- 1 LLP
- All under same family / CA

```
BusinessGroup {
  id, name, primaryContactId
}

Business {
  ...existing...
  groupId: String?  // optional group membership
}
```

Group-level view shows:
- Total tax liability across all entities
- Consolidated compliance score
- Group-level tax planning (are all entities optimized?)
- Intra-group transactions (related party — may need 40A disclosure)

### 11.2 CA Firm Support (v2)

```
CaFirm {
  id, firmName, membershipNo, address, partnerIds[]
}

CaFirmMember {
  id, firmId, userId, role (PARTNER / MANAGER / ARTICLE_ASSISTANT), assignments[]
}
```

CA firm workflow:
- Partner assigns clients to managers
- Manager does review, partner signs off
- Article assistant does data entry
- Each level sees only what their role permits

---

## SECTION 12: REPORTING (Complete List)

### 12.1 Real-Time Dashboards

1. **Tax Health Dashboard** (designed above)
2. **TDS Compliance Dashboard**: section-wise deduction status, challan deposits pending, return filing status
3. **Advance Tax Dashboard**: Q1-Q4 paid vs required, 234C interest accumulating, projection to year-end
4. **CA Client Portfolio Dashboard**: all clients, status, deadline countdown
5. **Compliance Calendar Dashboard**: all deadlines for next 90 days across all compliance types
6. **AIS Reconciliation Dashboard**: matched vs unmatched items, feedback pending
7. **Notice Management Dashboard**: open notices, response due dates, overdue items
8. **Filing History Dashboard**: multi-year trend — income, deductions, tax, refunds

### 12.2 Reports

1. **TDS Deduction Register**: party-wise, section-wise, date-wise
2. **Challan Register**: all Challan 280/281 deposits with BSR codes
3. **Depreciation Schedule**: block-wise, asset-wise, opening/closing WDV
4. **Partner Capital Account Statement**: per partner, per year
5. **40A(3) Disallowance Report**: all cash payments that will be disallowed
6. **43B Compliance Report**: PF/ESI/bonus/MSME payment status vs due dates
7. **Loss Register**: brought-forward losses by type, AY-wise, utilization
8. **GST-IT Reconciliation Report**: turnover comparison with explanation
9. **Tax Computation Summary**: line-by-line old vs new regime comparison
10. **Form 26AS / AIS Reconciliation Report**: matched, unmatched, disputed
11. **Advance Tax Workings**: installment-wise computation, interest for shortfall
12. **CA Review Audit Report**: what CA changed, when, why (for professional accountability)
13. **Filing Status Report**: multi-business, multi-year filing status for CA firm
14. **TDS Certificate Register**: Form 16/16A/130 issued, dispatched, acknowledged
15. **Demand & Refund Tracker**: all demands raised, paid, disputed; all refunds expected vs received

### 12.3 Exports

Every report: PDF, Excel, CSV
TDS returns: .fvu file (TRACES format), JSON
ITR: JSON (IT portal format), PDF (human-readable computation)
Form 3CD: PDF, editable docx
Partner certificates: PDF, one per partner

---

## SECTION 13: PRODUCT STRATEGY

### 13.1 Our Moat

**The competitors' gap:** Every Indian CA today uses Tally for accounting and then exports to KDK/Gen IT for ITR and Saral for TDS returns. Three products, three subscriptions, three data entry points, three places for errors.

**Our moat:** We close the loop. One system captures the transaction, auto-detects TDS, computes tax, generates the return, notifies the CA, and tracks the filing — all without export/import.

**Secondary moat:** We are built on the new Income Tax Act 2025 form numbering (138/140/143/144) from day one. Legacy tools are retrofitting 30-year-old codebases.

**Tertiary moat:** WhatsApp-native workflow. India runs on WhatsApp. CAs send notice copies on WhatsApp. Clients respond on WhatsApp. Our notification layer integrates with the WhatsApp module already in this ERP.

### 13.2 Pricing Strategy

**Do not compete on price with Gen IT (₹7,000/year).**

Charge per PAN or per business per month:
- **Starter** (1 business, basic filing): ₹999/month per business
- **Growth** (1 business, full compliance): ₹2,499/month per business
- **CA Solo** (up to 25 clients, all features): ₹4,999/month
- **CA Firm** (unlimited clients, team features): ₹12,999/month
- **Enterprise** (group consolidation, API access, white-label): Custom

ERI filing surcharge: ₹199/return (when ERI is set up in v2)

### 13.3 Roadmap

**Critical Before Any Code:**
- [ ] GL architecture decision (build or defer?)
- [ ] Rule engine schema finalized
- [ ] Event bus design finalized
- [ ] Document service design finalized
- [ ] Schema migrations (all tables above)

**V1 (must-have for launch):**
- [ ] IT Setup Wizard
- [ ] Expense Ledger
- [ ] Fixed Asset Register + Block Depreciation
- [ ] TDS Detection + Challan tracking
- [ ] Advance Tax Tracker
- [ ] Tax Computation (old + new regime)
- [ ] AIS Upload + Reconciliation
- [ ] CA Multi-Client Dashboard
- [ ] ITR JSON Generation (ITR-3, ITR-4, ITR-5)
- [ ] Notice Upload + Tracking (basic)
- [ ] Compliance Calendar + Reminders
- [ ] Tax Health Dashboard
- [ ] Form 16A Generation

**V1.5:**
- [ ] TDS Return (Form 138/140) generation
- [ ] Form 130 bulk generation + dispatch
- [ ] CPC Intimation tracking
- [ ] Demand Management
- [ ] Refund Tracking
- [ ] Rectification u/s 154
- [ ] GST-IT Reconciliation Engine
- [ ] TIS integration
- [ ] AI: Expense auto-classifier
- [ ] AI: Notice explainer
- [ ] Schedule AL (assets & liabilities)
- [ ] Tax Planning What-If

**V2:**
- [ ] ERI Registration + API filing
- [ ] GL Module (double-entry bookkeeping)
- [ ] Faceless Assessment workflow
- [ ] Appeals (CIT(A), ITAT)
- [ ] CA Firm support (team + delegation)
- [ ] TRACES direct integration
- [ ] Form 3CD auto-population
- [ ] AI: Audit Risk Predictor
- [ ] AI: Tax Planning Advisor
- [ ] Capital Gains module
- [ ] DTAA provisions

**Enterprise (V3):**
- [ ] Group consolidation
- [ ] Multi-entity tax planning
- [ ] Private Limited company (ITR-6, MAT, ind AS)
- [ ] XBRL for listed companies
- [ ] Transfer pricing (Section 92)
- [ ] White-label CA portal

---

## SECTION 14: RULE ENGINE — FINAL DESIGN

No rate, threshold, section limit, or form name is ever in application code.

The computation engine becomes a rule interpreter:

```typescript
class RuleEngine {
  async evaluate(category: RuleCategory, context: RuleContext): Promise<RuleResult> {
    const rules = await this.ruleStore.load({
      category,
      assessmentYear: context.assessmentYear,
      entityType: context.entityType,
      isActive: true
    });

    const applicableRules = rules
      .filter(r => this.evaluateConditions(r, context))
      .sort((a, b) => b.priority - a.priority);

    if (applicableRules.length === 0) throw new NoRuleFoundError(category, context);

    const rule = applicableRules[0];
    const value = this.computeRuleValue(rule, context);

    return {
      value,
      ruleId: rule.id,
      section: rule.section,
      description: rule.description,
      appliedConditions: rule.parameters.conditions
    };
  }
}
```

Budget update process:
1. Admin uploads Finance Act gazette notification
2. AI/admin extracts changed rates/limits (AI can parse gazette text)
3. Admin creates new FinanceAct + TaxRuleSet in the UI
4. Admin marks changed rules as superseded, adds new rules
5. Admin runs "Impact Preview" — shows how many businesses are affected + estimated tax change
6. Admin publishes the rule set
7. Background job: recompute all active draft computations with new rules
8. Notify CAs: "New Finance Act rules applied — please review your clients' tax positions"

---

## SECTION 15: EVENT-DRIVEN TAX ENGINE — FINAL DESIGN

### State: The Live Tax Position

For every (businessId, assessmentYear), maintain a `LiveTaxPosition`:

```
LiveTaxPosition {
  businessId, assessmentYear, lastUpdatedAt,

  // Revenue
  grossRevenue, advanceReceived, returnsSalesAllowances, netRevenue,

  // Expenses (by category)
  cogs, directLabour, rent, salariesWages, pfEsi, repairs,
  professionalFees, electricity, advertising, depreciation, otherExpenses,
  totalExpenses,

  // Adjustments (auto-computed)
  addbacks40A3, addbacks43B, addbacks40a, addbacksPartnerSalaryExcess,
  allowanceDepreciation,

  // Income Heads
  taxableBusinessIncome, salaryIncome, housePropertyIncome, otherSources,
  grossTotalIncome,

  // Deductions (old regime)
  chapterVIADeductions, totalIncome,

  // Tax
  taxOldRegime, taxNewRegime, recommendedRegime,
  surcharge, cess, rebate87A,
  totalTaxOld, totalTaxNew,

  // Payments
  tdsCredits, advanceTaxPaid, selfAssessmentPaid,

  // Position
  taxPayableOld, taxPayableNew, isRefundable,

  // Compliance
  advanceTaxDeficit, nextInstallmentDue, nextInstallmentAmount,
  complianceScore, riskLevel
}
```

This position updates on every qualifying ERP event.
The tax dashboard is a live view of this record — always current.
ITR is generated from this position when CA approves.

---

## SECTION 16: TAX INTELLIGENCE LAYER

### Compliance Score Algorithm

```
ComplianceScore = weighted average of:
  TDS Compliance (25%):
    - 100 if no pending TDS obligations
    - −10 per overdue TDS deposit
    - −20 per unfiled TDS return
  
  Advance Tax (25%):
    - 100 if on track with advance tax schedule
    - −30 if Q1 shortfall > 20%
    - −20 if Q2 shortfall > 20%
  
  Books Readiness (25%):
    - 100 if all expenses categorized
    - −5 per uncategorized expense
    - −20 if closing stock not entered
    - −15 if AIS not uploaded
  
  Filing Readiness (25%):
    - 100 if ITR is filed
    - 70 if CA approved
    - 50 if CA reviewing
    - 30 if data complete, CA not started
    - 0 if data incomplete

Risk Score = based on:
  - GST-IT variance > 5%: HIGH risk
  - Unexplained AIS entries: MEDIUM-HIGH
  - 40A(3) disallowances > 15% of expenses: MEDIUM
  - Audit threshold close to turnover: MEDIUM (flag early)
  - TDS default > 2 payments: MEDIUM
  - No advance tax paid: HIGH if expected tax > ₹10K
```

---

## SECTION 17: EXPLAINABILITY REQUIREMENT

Every number must link to its source. The lineage chain:

```
Any displayed amount
  → Which computation it belongs to (ItReturn.id)
  → Which rule was applied (TaxRule.id + TaxRule.section)
  → Which input records were used (ComputationLineage.inputSources)
  → Which ERP records those inputs came from (SalesInvoice.id / Expense.id / etc.)
  → Which documents (Document.id → download link)
  → Which section of law applies (KnowledgeBase.articleId)
```

This is how you build trust with CAs. They do not trust black-box calculations.
If they can drill into every number and verify it, they will adopt the product and recommend it to peers.

---

## SECTION 18: KNOWLEDGE BASE

Build a structured law library inside the product:

```
KnowledgeBaseArticle {
  id, section, actName, title, summary,
  fullText,               // original law text
  simplifiedExplanation,  // plain language version
  example,                // worked numerical example
  cbdtCirculars: JSONB,  // relevant CBDT circulars
  caseLaws: JSONB,        // notable judgments
  erpExample,             // how this applies in our ERP
  relatedSections: [],
  effectiveFrom, effectiveTo,
  lastUpdatedAt
}
```

Accessible from:
- Any flag or disallowance (click to read the section)
- TDS obligation notification (click to understand why)
- Tax computation line item (click to see the rule)
- Search: "What is 40A(3)?" → instant article
- AI Copilot uses this as its context for answering questions

---

## SUMMARY: CRITICAL RISKS

| Risk | Severity | Mitigation |
|------|---------|-----------|
| No GL → Balance Sheet manually entered by CA | CRITICAL | Accept in v1, build GL in v2. Document clearly. |
| Hardcoded rules → Budget requires code deploy | CRITICAL | Build rule engine FIRST before any computation |
| Year-end batch → no real-time visibility | HIGH | Build event-driven engine from the start |
| No notice management → CA loses track of notices | HIGH | Build in v1.5 |
| ITR JSON schema changes every AY | HIGH | Schema validator + version check on generation |
| Multi-tenant data leakage between businesses | CRITICAL | Row-level security + ABAC from day one |
| CA assigned to wrong business sees all data | HIGH | CaBusinessLink + row-level security |
| 40(b) circular computation gives wrong result | HIGH | Test with golden dataset including partnerships |
| 43B(h) MSME rule — many businesses unaware | MEDIUM | Proactive education via notification |
| Form renaming (24Q→138) — wrong form filed | HIGH | Rule engine handles; validate against AY before generation |
| Missing AIS feedback → AIS mismatch scrutiny | HIGH | Build AIS feedback in v1.5 |
| No immutable audit log → CA cannot certify | HIGH | Build from day one |

---

## TECHNICAL DEBT TO AVOID

1. Never put any tax rate, threshold, or section limit in application code
2. Never query accounting tables directly from the Tax module (use events)
3. Never store document files as URL strings (use Document service)
4. Never use status string fields for lifecycle management (use workflow engine)
5. Never send notifications from business logic (use notification service)
6. Never compute tax synchronously on API request for large datasets (use queues)
7. Never expose pre-signed document URLs without expiry and audit log
8. Never allow DELETE on tax records — only soft delete with reason
9. Never let two services write to the same tax record simultaneously (optimistic locking)
10. Never hardcode the list of assessment years — derive from rule engine

---

*End of Architecture Review*
*Next step: Resolve the 3 blockers (GL decision, Rule Engine build, Event Bus design) before writing any IT module code.*
