# Enterprise ERP Platform — Architect's Challenge Response

> **Reviewer Role:** Chief Platform Architect (SAP / Oracle / Odoo school of thinking)
>
> **Premise:** We are not building an Income Tax module. We are building the ERP Core Platform
> on which Income Tax is the first compliance consumer. Every decision is made for the platform.
> Income Tax is the proof of concept that validates the platform.
>
> **Date:** July 2026
> **Status:** ARCHITECTURE LOCKED — No feature code until this is resolved.

---

## OPENING VERDICT

The existing architecture is a **vertical silo masquerading as a platform**.

Every engine — rules, workflows, documents, notifications, audit — was designed specifically
for Income Tax. This is architecturally equivalent to SAP building the MM module's workflow engine
only for purchase orders, then rebuilding a separate workflow engine for the HR module.

The result is:
- Duplicated infrastructure (5 workflow engines for 5 modules)
- Inconsistent behavior (Tax audit log ≠ Inventory audit log)
- Exponential maintenance cost as modules are added
- Impossible to evolve any engine without coordinating across all modules

**The single most important decision before writing any code:**
Build the ERP Core Platform first. Income Tax is its first tenant, not its owner.

---

## SECTION 1 — PLATFORM SERVICES AUDIT

*For each of the 24 proposed services: Does it belong to IT module or ERP Core? Current state? Required redesign?*

---

### 1.1 Rule Engine

| | |
|---|---|
| **Currently designed as** | IT Module — `TaxRule`, `TaxRuleSet`, `FinanceAct` tables |
| **Should belong to** | **ERP Core Platform** |
| **Why** | GST has rules. Payroll has rules. PF/ESI has rules. Pricing has rules. Discount slabs are rules. Approval thresholds are rules. |
| **Current problem** | `TaxRule.category` enum has only TAX-SPECIFIC values. `FinanceAct` is IT-specific. |

**Redesign as Universal Rule Engine:**

```
Platform: RuleNamespace { INCOME_TAX, GST, PAYROLL, PF_ESI, PRICING, INVENTORY, APPROVAL }
Platform: RuleAuthority { finance_act_id?, statutory_order_id?, internal_policy_id? }

Platform: RuleSet {
  id, namespace, authority_id, entity_type, region, effective_from, effective_to,
  version, supersedes_id, is_active
}

Platform: Rule {
  id, rule_set_id, category, section_ref, description,
  condition: JSONB,   // when does this rule apply?
  parameters: JSONB,  // what does it compute?
  priority, is_overridable, created_by, created_at
}
```

**Every module consumes the same Rule Engine. No module owns it.**

---

### 1.2 Workflow Engine

| | |
|---|---|
| **Currently designed as** | IT Module — ITR lifecycle, TDS lifecycle, Notice lifecycle |
| **Should belong to** | **ERP Core Platform** |
| **Current problem** | Workflow states are IT-specific enums. Other modules have no workflow at all — purchases are approved informally, expenses have no approval chain. |

**Redesign as Platform Workflow Engine:**

```
Platform: WorkflowTemplate {
  id, name, namespace (PURCHASE_APPROVAL, EXPENSE_APPROVAL, ITR_REVIEW, etc.),
  trigger_event, schema_version, steps: JSONB, sla_hours, escalation_policy
}

Platform: WorkflowInstance {
  id, template_id, entity_type, entity_id, tenant_id, state,
  history: JSONB[], current_actor_id, due_at, escalated_at, completed_at
}
```

Modules register workflow templates. The platform executes them. No module builds its own FSM.

---

### 1.3 Notification Engine

| | |
|---|---|
| **Currently designed as** | Compliance Calendar deadlines for IT module |
| **Should belong to** | **ERP Core Platform** |
| **Current problem** | Low-stock alerts, payment due alerts, and salary alerts all have no notification infrastructure. Each module would invent its own. |

**Redesign:**

```
Platform: NotificationTemplate {
  id, channel (EMAIL, WHATSAPP, SMS, IN_APP, PUSH),
  namespace, trigger_event, subject_template, body_template,
  locale, version
}

Platform: NotificationSchedule {
  id, rule: JSONB, // "30 days before entity.due_date"
  template_id, recipient_resolver: JSONB
}
```

Every module declares its events. The platform handles delivery, retry, and deduplication.

---

### 1.4 Event Bus

| | |
|---|---|
| **Currently designed as** | BullMQ queues described only for Tax Engine |
| **Should belong to** | **ERP Core Platform** |
| **Current problem** | No events flow between modules today. POS sale does not tell Tax Engine. Purchase does not tell Payables Engine. Everything is point-to-point or batch. |

**Redesign — see Section 7 (Event Platform) for full design.**

Principle: Every module publishes domain events to the platform bus. Never direct calls.

---

### 1.5 Document Service

| | |
|---|---|
| **Currently designed as** | `documentUrl: String` scattered across models; Document model proposed for IT module |
| **Should belong to** | **ERP Core Platform** |
| **Current problem** | Purchase orders have attached documents. GRN has attached documents. IT notices have documents. Tax returns have documents. Each stores a URL. No central versioning, no hash, no OCR, no retention policy. |

**Redesign — see Section 8 (Document Platform) for full design.**

---

### 1.6 OCR Service

| | |
|---|---|
| **Currently designed as** | Part of AI Engine for tax documents |
| **Should belong to** | **ERP Core Platform** |
| **Why** | Invoice OCR, vendor bill OCR, purchase order OCR, GRN verification, AIS upload — all need OCR. |

**Redesign:**

```
Platform: OcrJob {
  id, document_id, provider (GOOGLE_VISION, AZURE_DI, TESSERACT),
  status, confidence, raw_output: JSONB,
  structured_output: JSONB, model_version, processed_at
}

Platform: OcrTemplate {
  id, name, field_mappings: JSONB, validation_rules: JSONB
}
```

Modules submit documents to OCR Service. OCR Service emits `OcrCompleted` event. Module reacts.

---

### 1.7 Digital Signature Service

| | |
|---|---|
| **Currently designed as** | Not designed — mentioned as gap in IT module |
| **Should belong to** | **ERP Core Platform** |
| **Why** | DSC is needed for ITR filing, GST returns, MCA filings, purchase agreements, legal notices. Same certificate, same PIN, different consumers. |

**Redesign:**

```
Platform: DigitalCertificate {
  id, tenant_id, holder_name, pan, certificate_type (CLASS_2, CLASS_3, EMUDHRA, NCODE),
  expiry, thumbprint, storage_provider (HSM, FILE), status
}

Platform: SignatureRequest {
  id, document_id, certificate_id, purpose, status,
  signed_document_id, signed_at, signature_hash
}
```

---

### 1.8 Scheduler

| | |
|---|---|
| **Currently designed as** | Compliance Calendar deadlines (IT-specific) |
| **Should belong to** | **ERP Core Platform** |

**Redesign — Unified Job Scheduler:**

```
Platform: ScheduledJob {
  id, name, cron_expression, timezone, namespace,
  payload: JSONB, handler_class, max_retries,
  last_run_at, next_run_at, status
}
```

All compliance deadlines, all batch jobs, all reports are registered here.
No module has its own cron. One place to view all scheduled work.

---

### 1.9 Background Worker

| | |
|---|---|
| **Currently designed as** | BullMQ for Tax Engine |
| **Should belong to** | **ERP Core Platform** |

**Redesign:**

```
Platform: WorkerQueue {
  name, namespace, concurrency, priority, retry_policy, dlq_name
}
```

Single BullMQ deployment. Each namespace gets its own queue with configured concurrency and retry.

---

### 1.10 Audit Engine

| | |
|---|---|
| **Currently designed as** | `TaxAuditLog` — hash-chained, IT-specific |
| **Should belong to** | **ERP Core Platform** |
| **Current problem** | Who changed a purchase price? Who modified a customer credit limit? Who approved an expense? These need audit trails too — but there is no platform audit engine. |

**Redesign:**

```
Platform: AuditLog {
  id, tenant_id, namespace, entity_type, entity_id,
  action (CREATE/UPDATE/DELETE/STATE_CHANGE/EXPORT/PRINT),
  actor_id, actor_type (USER/SYSTEM/API_KEY/JOB),
  before_state: JSONB, after_state: JSONB, delta: JSONB,
  ip_address, user_agent, session_id,
  prev_hash, current_hash, // hash chain for tamper detection
  occurred_at
}
```

Partitioned by month. Hash-chained. Immutable. Every module writes here.
IT module gets its tax-specific view. Purchase module gets its view. One table, many consumers.

---

### 1.11 Approval Engine

| | |
|---|---|
| **Currently designed as** | CA flag/response cycle in IT module |
| **Should belong to** | **ERP Core Platform** |
| **Why** | Purchase approval, expense approval, leave approval, salary revision approval, vendor onboarding approval all need the same pattern: request → review → approve/reject → notify |

This is the same as the Workflow Engine (Section 1.2). Merge them.
Approval IS a workflow. Do not build two engines.

---

### 1.12 File Storage

| | |
|---|---|
| **Currently designed as** | S3/MinIO referenced in IT module |
| **Should belong to** | **ERP Core Platform** |

**Redesign:**

```
Platform: StorageProvider {
  MINIO_LOCAL, S3_AWS, AZURE_BLOB, GCP_GCS, WASABI, BACKBLAZE
}

Platform: FileObject {
  id, tenant_id, bucket, storage_key, original_name,
  mime_type, size_bytes, sha256, encryption_key_id,
  virus_scan_status, uploaded_by, uploaded_at
}
```

All modules reference `FileObject.id`. No module stores raw URLs. No module knows the storage backend.

---

### 1.13 Search Engine

| | |
|---|---|
| **Currently designed as** | Not designed |
| **Should belong to** | **ERP Core Platform** |

**Redesign:**

```
Platform: SearchIndex {
  namespace, entity_type, entity_id, tenant_id,
  searchable_text, metadata: JSONB, rank, indexed_at
}
```

PostgreSQL full-text search initially (tsvector + GIN index).
Elasticsearch-compatible interface so migration is possible.
Every module pushes to the index when entities change.

---

### 1.14 AI Engine

| | |
|---|---|
| **Currently designed as** | IT-specific (notice explainer, expense classifier, audit risk predictor) |
| **Should belong to** | **ERP Core Platform** |
| **Why** | Demand forecasting (inventory), churn prediction (customers), supplier risk scoring, receipt OCR, expense auto-categorization — all modules need AI. |

**Redesign — see Section 9 (AI Platform) for full design.**

---

### 1.15 Integration Hub

| | |
|---|---|
| **Currently designed as** | Not designed — each module integrates independently (WhatsApp, Google Vision, IT Portal, TRACES, GSTN) |
| **Should belong to** | **ERP Core Platform** |

**Redesign:**

```
Platform: Connector {
  id, name, type (REST, SOAP, SFTP, WEBHOOK, QUEUE),
  namespace, base_url, auth_type, auth_config: JSONB (encrypted),
  rate_limit, retry_policy, circuit_breaker_config, version
}

Platform: IntegrationLog {
  id, connector_id, direction (OUTBOUND/INBOUND),
  payload_hash, status, request: JSONB, response: JSONB,
  latency_ms, occurred_at
}
```

**All external integrations pass through the Integration Hub:**
- IT Portal: one connector
- TRACES: one connector
- GSTN: one connector
- Razorpay: one connector
- WhatsApp Business: one connector
- Google Vision: one connector (OCR)
- Banks (NEFT/IMPS): one connector

No module makes external HTTP calls directly. Ever.

---

### 1.16 Compliance Engine

| | |
|---|---|
| **Currently designed as** | Income Tax compliance calendar |
| **Should belong to** | **ERP Core Platform** |

**Redesign:**

```
Platform: ComplianceDomain {
  INCOME_TAX, GST, PF_ESI, LABOUR_LAW, MCA, FSSAI, SHOPS_ACT, IMPORT_EXPORT
}

Platform: ComplianceObligation {
  id, domain, namespace, entity_type, frequency, due_date_rule: JSONB,
  consequence_if_missed, penalty_rule_id, applicable_to: JSONB (entity criteria)
}

Platform: ComplianceInstance {
  id, obligation_id, tenant_id, period, status, due_date,
  filed_at, document_id, amount_paid, penalty_incurred
}
```

---

### 1.17 Dashboard Engine, 1.18 Report Engine, 1.19 Analytics Engine

All three are currently absent or IT-specific. All three belong to ERP Core.

**Redesign:**

```
Platform: DashboardDefinition {
  id, name, namespace, layout: JSONB, widgets: JSONB,
  permissions: JSONB, is_system, tenant_id
}

Platform: ReportDefinition {
  id, name, namespace, query_template, parameters: JSONB,
  output_format (PDF, XLSX, CSV, JSON), schedule_id
}
```

Modules register their dashboards and reports. The platform renders them.
No module has its own charting library or report runner.

---

### 1.20 Feature Flag Engine

| | |
|---|---|
| **Currently designed as** | Not designed |
| **Should belong to** | **ERP Core Platform** |

```
Platform: FeatureFlag {
  key, namespace, rollout_strategy (ALL/PERCENTAGE/TENANT_LIST/PLAN_TIER),
  rollout_config: JSONB, is_enabled, kill_switch, created_at
}
```

Every new feature sits behind a flag. No dark-ship deployments. No emergency reverting features.

---

### 1.21 Settings Engine, 1.22 Metadata Engine

**Settings Engine:**
```
Platform: Setting {
  key, namespace, scope (GLOBAL/TENANT/USER),
  value_type (STRING/NUMBER/BOOLEAN/JSON), default_value,
  is_secret, description
}

Platform: SettingValue {
  setting_id, scope_id (tenant_id or user_id), value, updated_by, updated_at
}
```

**Metadata Engine:**
```
Platform: EntityMetaField {
  id, namespace, entity_type, field_name, field_type,
  is_required, validation_rule: JSONB, display_order, is_filterable
}

Platform: EntityMetaValue {
  id, entity_id, field_id, value_string, value_number, value_json, updated_at
}
```

Custom fields for any entity without schema changes. IT module uses this for custom TDS categories.
Inventory uses this for product attributes. Both consume the same Metadata Engine.

---

### 1.23 Versioning Engine

```
Platform: EntityVersion {
  id, entity_type, entity_id, tenant_id, version_number,
  snapshot: JSONB, change_summary, authored_by, authored_at,
  is_current, parent_version_id
}
```

Time travel: restore any entity to any historical state.
Tax computation replay (Section 3) depends on this.

---

### 1.24 Localization Engine, Template Engine

**Localization:**
```
Platform: Translation {
  key, locale, namespace, value, is_verified, updated_at
}
```

All UI strings, notification templates, and report labels go through this.
India today. International expansion tomorrow. No rework required.

**Template Engine:**
```
Platform: Template {
  id, name, namespace, type (EMAIL/WHATSAPP/PDF/NOTIFICATION/FORM),
  engine (HANDLEBARS/LIQUID/JINJA), template_body, variables: JSONB,
  locale, version, is_active
}
```

---

## SECTION 2 — ERP FOUNDATION COMPLETENESS AUDIT

*Rating: ✅ Exists | ⚠️ Partial | ❌ Missing | 🔴 Critical Gap*

### 2.1 Master Data

| Service | Status | Priority |
|---------|--------|----------|
| Master Data Management | ❌ No master data deduplication, no golden record | 🔴 Critical |
| Business Identity (PAN, GSTIN, CIN, UDYAM) | ⚠️ Partial — PAN on Business but not enforced | High |
| Multi-Company | ❌ Single-tenant only — CaBusinessLink is a CA tool, not multi-company | 🔴 Critical |
| Multi-Branch | ❌ No branch concept | High |
| Multi-Warehouse | ❌ Inventory is single-location | High |
| Chart of Accounts | ❌ No CoA — this is BLOCKER 1 | 🔴 Critical |
| Fiscal Calendar | ⚠️ Hardcoded April–March | High |
| Financial Year Engine | ⚠️ Strings like 'AY 2025-26' — no engine | High |
| Number Series Generator | ❌ Invoice numbers not from a managed series | Medium |
| Document Number Generator | ❌ Every model generates its own IDs | Medium |
| Attachment Service | ⚠️ `documentUrl: String` scattered everywhere | High |
| Currency Engine | ❌ Single currency (INR) assumed — no model for foreign currency | Medium |
| Unit Conversion | ❌ UOM task #14 still pending | Medium |

### 2.2 Tax and Financial Services

| Service | Status | Priority |
|---------|--------|----------|
| Tax Engine (GST) | ⚠️ GST computed on sale but not a formal engine | High |
| Tax Engine (IT) | ❌ To be built | 🔴 Critical |
| Ledger Engine | ❌ No double-entry ledger | 🔴 Critical |
| Approval Engine | ❌ No approval chains anywhere | High |

### 2.3 Infrastructure Services

| Service | Status | Priority |
|---------|--------|----------|
| Health Monitoring | ❌ No health endpoints | Medium |
| License Management | ❌ No license model | Low |
| Subscription Management | ❌ No subscription model | Low |
| API Gateway | ❌ Direct NestJS exposure | High |
| Integration Layer | ❌ Each module integrates independently | 🔴 Critical |
| Plugin Framework | ❌ Monolith — no plugin concept | Low |
| Extension SDK | ❌ Not applicable yet | Future |
| Custom Fields | ❌ No custom fields on any entity | High |
| Dynamic Forms | ❌ All forms are hardcoded | Medium |
| Dynamic Reports | ❌ All reports are hardcoded | Medium |
| Business Rules | ⚠️ Tax rules only — no platform rule engine | 🔴 Critical |
| Expression Engine | ❌ Not designed | Medium |
| Formula Engine | ❌ Not designed | Medium |
| Calculation Engine | ⚠️ Tax computation only | High |
| Template Engine | ❌ No platform template engine | High |
| Job Scheduler | ❌ No unified scheduler | High |
| Event Store | ❌ No event sourcing | High |
| Cache Layer | ❌ No Redis, no caching strategy | High |
| Distributed Locking | ❌ No locking mechanism | Medium |
| Search Index | ❌ No full-text search | Medium |
| Feature Toggle | ❌ No feature flags | High |
| Configuration Engine | ⚠️ .env only — no runtime config | Medium |

### 2.4 Data Management

| Service | Status | Priority |
|---------|--------|----------|
| Soft Delete | ⚠️ Some models have `isDeleted`, inconsistent | Medium |
| Version History | ❌ No entity versioning | High |
| Time Travel | ❌ Not designed | High |
| Archival | ❌ No archival policy | Medium |
| Backup | ⚠️ Manual Postgres dump only | High |
| Disaster Recovery | ❌ Not designed | High |
| Encryption | ⚠️ PAN masking mentioned but not implemented | 🔴 Critical |
| Key Management | ❌ No key rotation, no KMS | High |
| Secrets Management | ⚠️ .env files — not a proper secrets manager | High |

### 2.5 Observability

| Service | Status | Priority |
|---------|--------|----------|
| Metrics | ❌ No Prometheus/Grafana | Medium |
| Tracing | ❌ No OpenTelemetry | Medium |
| Logging | ⚠️ console.log only | High |
| Health Checks | ❌ No `/health` endpoint | Medium |
| Circuit Breakers | ❌ No resilience patterns | Medium |
| Rate Limiting | ❌ No API rate limiting | High |

### 2.6 API & Integration

| Service | Status | Priority |
|---------|--------|----------|
| API Versioning | ❌ `/api/` only — no version prefix | High |
| Idempotency | ❌ No idempotency keys | High |
| Webhooks | ❌ No webhook framework | Medium |
| Streaming Events | ❌ No streaming | Medium |
| Domain Events | ⚠️ Described for Tax Engine only | 🔴 Critical |
| Dead Letter Queue | ❌ Not designed | High |
| Saga Pattern | ❌ Not designed | Medium |
| CQRS | ❌ Not designed | Medium |

### 2.7 Infrastructure Readiness

| Capability | Status | Priority |
|---------|--------|----------|
| Container readiness | ⚠️ Docker used for Postgres only | High |
| Kubernetes readiness | ❌ PM2 on a single VPS | Medium |
| Cloud Agnostic | ⚠️ Hetzner-specific | Medium |
| Zero Downtime Deploy | ❌ Not designed | High |
| Database Partitioning | ❌ Not designed | High |
| Read Replicas | ❌ Single Postgres instance | Medium |

---

## SECTION 3 — TAX PLATFORM PRINCIPLES

Every tax computation must satisfy all 12 properties:

| Property | Current State | Required State |
|----------|--------------|----------------|
| **Explainable** | ❌ Black box | Every number shows its source rules + source vouchers |
| **Traceable** | ❌ No lineage | Every computed value traces to raw journal entry |
| **Auditable** | ⚠️ Planned for TaxAuditLog | Platform AuditLog with hash chain |
| **Replayable** | ❌ Not designed | Any computation can be re-run for any historical date |
| **Versioned** | ❌ Computations not versioned | Each computation stores the rule version and inputs snapshot |
| **Deterministic** | ❌ Not guaranteed | Same inputs + same rule version = always same output |
| **Testable** | ❌ No golden datasets | Golden test dataset per entity type per AY |
| **Rule-Driven** | ❌ Still being hardcoded | 100% metadata — no rate in code |
| **Budget Independent** | ❌ Budget change = code deploy | Rule Engine insertion only |
| **AY Independent** | ⚠️ AY strings in code | Rule Engine resolves by AY |
| **Tax Year Independent** | ❌ IT Act 2025 not handled | Dual Act support in Rule Engine |
| **Finance Act Independent** | ❌ Not designed | Every computation references FinanceAct.id |

---

## SECTION 4 — COMPUTATION LINEAGE

The most critical requirement for an Enterprise Tax Platform is reproducibility.
A computation done today must produce the exact same result if replayed in 2031.

**Design:**

```
Platform: ComputationJob {
  id, tenant_id, namespace (INCOME_TAX, GST, PAYROLL, etc.),
  entity_id, entity_type, period, triggered_by, triggered_at,
  rule_set_snapshot: JSONB,  // full copy of all rules used
  input_snapshot: JSONB,     // full copy of all inputs
  output: JSONB,
  status, version, superseded_by_job_id
}

Platform: ComputationLineageNode {
  id, job_id, node_type (SOURCE_VOUCHER | JOURNAL_ENTRY | RULE_APPLICATION | AGGREGATION | OUTPUT),
  parent_node_id, label, value, metadata: JSONB, sequence
}
```

**Every computed tax figure must be able to answer:**
- Which Finance Act? → `rule_set_snapshot.finance_act`
- Which Rule Version? → `rule_set_snapshot.version`
- Which Assessment Year? → `job.period`
- Which inputs? → `input_snapshot`
- Which source vouchers? → lineage nodes of type SOURCE_VOUCHER
- Can it be replayed? → Yes. Input snapshot + rule set snapshot → deterministic output.

**Replay guarantee:**
```typescript
async replayComputation(jobId: string): Promise<ComputationOutput> {
  const job = await this.getJob(jobId);
  // CRITICAL: Use the SNAPSHOT, not the current live rules
  const ruleSet = job.rule_set_snapshot;
  const inputs = job.input_snapshot;
  return this.computationEngine.runWithSnapshot(ruleSet, inputs);
}
```

---

## SECTION 5 — COMPLIANCE KNOWLEDGE GRAPH

Every vendor, customer, and business entity in the ERP has a compliance profile.
This profile is a graph of interconnected compliance dimensions.

**Vendor Compliance Graph:**

```
Vendor
├── Identity
│   ├── PAN (verified/unverified)
│   ├── GSTIN (active/cancelled/suspended)
│   ├── UDYAM (MSME classification)
│   └── CIN (if company)
│
├── Tax Behavior
│   ├── TDS Category (194C/194J/194H/194I/...)
│   ├── TDS Rate (normal/lower/nil)
│   ├── Form 15G/15H/13 (exemption certificates)
│   ├── ITR Filer Status (for 206AB)
│   └── TRACES UTL Balance
│
├── Transaction History
│   ├── AIS Entries (what IT dept knows about them)
│   ├── Purchase Invoices (what we paid them)
│   ├── TDS Deducted (what we deducted)
│   └── Payment History (when we paid)
│
├── Compliance Risk
│   ├── MSME Payment Risk (43B(h) — did we pay in 45 days?)
│   ├── 206AB Risk (did they file ITR for last 2 years?)
│   ├── GSTN Mismatch Risk (their GSTN status vs our record)
│   └── PAN-GSTIN Mismatch
│
└── Risk Score
    ├── TDS Risk Score
    ├── GST Risk Score
    ├── MSME Compliance Score
    └── Overall Vendor Risk Score
```

**Implementation:**

```prisma
model VendorComplianceProfile {
  id                    String   @id @default(uuid())
  supplierId            String   @unique
  panVerified           Boolean  @default(false)
  panVerifiedAt         DateTime?
  gstinStatus           String?  // ACTIVE, CANCELLED, SUSPENDED
  gstinLastChecked      DateTime?
  isMsme                Boolean  @default(false)
  msmeUdyamNo           String?
  tdsCategory           String?
  tdsRate               Decimal?
  exemptionType         String?  // 15G/15H/FORM_13/TRANSPORTER
  exemptionValidTill    DateTime?
  itrFilerStatus        String?  // FILER / NON_FILER_1YR / NON_FILER_2YR
  itrFilerCheckedAt     DateTime?
  msmePaymentRiskFlag   Boolean  @default(false)
  tdsRiskScore          Int?     // 0-100
  gstRiskScore          Int?
  overallRiskScore      Int?
  lastUpdated           DateTime @updatedAt
}
```

**This graph powers AI:**
- Auto-classify new vendors by TDS section
- Predict 206AB risk before payment is processed
- Flag MSME vendors approaching 45-day payment limit
- Surface AIS mismatches before ITR filing

---

## SECTION 6 — COMPLIANCE DIGITAL TWIN

The ERP should maintain a real-time financial and compliance mirror of every business.
Instead of computing tax once a year, the ERP continuously understands the business.

**Digital Twin = a continuously-updated snapshot of the business's compliance health.**

```prisma
model BusinessDigitalTwin {
  id                      String   @id @default(uuid())
  businessId              String   @unique
  asOfDate                DateTime
  
  // Tax Position
  estimatedTaxLiability   Decimal  @default(0) // this FY
  advanceTaxPaid          Decimal  @default(0)
  advanceTaxBalance       Decimal  @default(0) // shortfall / excess
  selfAssessmentTaxDue    Decimal  @default(0)
  pendingTdsToPay         Decimal  @default(0)
  pendingTdsReturns       Int      @default(0) // how many unfiled
  aisVariance             Decimal  @default(0) // AIS income − booked income
  
  // Compliance Health
  complianceScore         Int?     // 0-100
  tdsHealthScore          Int?
  gstHealthScore          Int?
  booksReadinessScore     Int?
  auditRiskScore          Int?
  noticeProbabilityScore  Int?
  
  // Upcoming Obligations
  nextDeadline            DateTime?
  nextDeadlineType        String?
  daysToNextDeadline      Int?
  overdueObligations      Int      @default(0)
  
  // Cash Flow Signals
  estimatedRefund         Decimal  @default(0)
  pendingDemands          Decimal  @default(0)
  
  // Business Signals
  currentFyRevenue        Decimal  @default(0)
  currentFyExpenses       Decimal  @default(0)
  currentFyNetProfit      Decimal  @default(0)
  profitTrend             String?  // UP/DOWN/FLAT
  
  // Tax Saving Opportunity
  unusedOldRegimeDeductions Decimal @default(0)
  regimeBenefit           Decimal  @default(0) // new vs old regime delta
  
  updatedAt               DateTime @updatedAt
}
```

**This powers the main dashboard:**

```
╔═══════════════════════════════════════════════════════════════════╗
║  BUSINESS COMPLIANCE TWIN                                         ║
╠═══════════════════════════════════════════════════════════════════╣
║  Estimated Tax Liability:  ₹4,23,500    ⬆ +12% from last month  ║
║  Advance Tax Balance:      ₹1,50,000    SHORT  (15 Sep deadline) ║
║  AIS Variance:             ₹45,000      UNEXPLAINED               ║
║  Compliance Score:         73/100       ⚠ 3 overdue deadlines    ║
║  Notice Probability:       MEDIUM       1 large AIS mismatch      ║
╠═══════════════════════════════════════════════════════════════════╣
║  Upcoming: Advance Tax due in 12 days   Pay ₹1,50,000 now        ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Update mechanism:**
Every ERP transaction publishes an event. The Digital Twin Service subscribes to all events
and recalculates affected metrics in real-time. No batch jobs. No stale data.

---

## SECTION 7 — EVENT PLATFORM

**Architecture Principle:** No module calls another module directly. Ever.
All cross-module communication is through domain events.

### 7.1 Event Taxonomy

```
erp.pos.sale.completed
erp.pos.sale.voided
erp.purchase.invoice.created
erp.purchase.invoice.paid
erp.inventory.stock.below_minimum
erp.payment.outward.processed
erp.vendor.tds.deducted
erp.tds.return.filed
erp.itr.filed
erp.compliance.deadline.approaching
erp.compliance.deadline.missed
erp.notice.received
erp.ais.uploaded
erp.document.ocr.completed
erp.workflow.step.completed
erp.approval.granted
erp.approval.rejected
```

### 7.2 Event Envelope

```typescript
interface DomainEvent<T = unknown> {
  eventId: string;           // UUID — idempotency key
  eventType: string;         // erp.pos.sale.completed
  aggregateType: string;     // Sale
  aggregateId: string;       // sale UUID
  tenantId: string;
  occurredAt: Date;
  payload: T;
  schemaVersion: number;
  causationEventId?: string; // what caused this event
  correlationId?: string;    // trace across multiple events
}
```

### 7.3 Outbox Pattern (Guaranteed Delivery)

```prisma
model OutboxEvent {
  id           String   @id @default(uuid())
  tenantId     String
  eventType    String
  payload      Json
  status       String   @default("PENDING") // PENDING/SENT/FAILED
  attempts     Int      @default(0)
  sentAt       DateTime?
  createdAt    DateTime @default(now())
  
  @@index([status, createdAt])
}
```

**Flow:**
1. Business operation + OutboxEvent write in the SAME database transaction
2. Background worker polls OutboxEvent table and publishes to BullMQ
3. Consumers process from BullMQ with at-least-once delivery

**This guarantees no event is lost even if the message broker goes down.**

### 7.4 Subscriber Map (Who Listens to What)

| Event | Subscriber |
|-------|-----------|
| `erp.pos.sale.completed` | Tax Engine → update Digital Twin revenue |
| `erp.purchase.invoice.paid` | TDS Engine → check if TDS deduction required |
| `erp.purchase.invoice.paid` | MSME Engine → start 45-day payment clock |
| `erp.payment.outward.processed` | TDS Engine → create TdsEntry if applicable |
| `erp.document.ocr.completed` | Expense Engine → auto-fill expense from receipt |
| `erp.ais.uploaded` | Reconciliation Engine → compare with our books |
| `erp.compliance.deadline.approaching` | Notification Engine → send alerts |
| `erp.itr.filed` | Compliance Engine → mark obligation as completed |

### 7.5 Event Replay

```
Platform: EventStore {
  id, event_type, aggregate_id, tenant_id, payload: JSONB,
  schema_version, occurred_at, sequence_number (monotonic per aggregate)
}
```

Replay capability: feed all historical events through a new subscriber to rebuild state.
Essential for: rebuilding Digital Twin, auditing, debugging computation discrepancies.

---

## SECTION 8 — ENTERPRISE DOCUMENT PLATFORM

Replace every `documentUrl: String` field in the schema.

**Current count of raw URL fields:** ~12 models. Every one is a liability.

### 8.1 Core Document Model

```prisma
model Document {
  id               String   @id @default(uuid())
  tenantId         String
  namespace        String   // INCOME_TAX / GST / PURCHASE / HR / GENERAL
  documentType     String   // TAX_RETURN / NOTICE / INVOICE / CONTRACT / ...
  originalName     String
  mimeType         String
  sizeBytes        BigInt
  storageKey       String   // path in MinIO/S3 — never exposed to client
  sha256           String   // integrity verification
  version          Int      @default(1)
  parentDocumentId String?  // for versioning chain
  
  // Classification
  classification   String?  // AI-assigned: TAX_RETURN/NOTICE/INVOICE/etc.
  classifiedAt     DateTime?
  classConfidence  Float?
  
  // OCR
  ocrStatus        String   @default("PENDING") // PENDING/PROCESSING/DONE/FAILED
  ocrText          String?  // extracted text
  ocrStructured    Json?    // structured extraction
  
  // Security
  isEncrypted      Boolean  @default(true)
  encryptionKeyId  String?
  virusScanStatus  String   @default("PENDING")
  
  // Lifecycle
  retentionYears   Int      @default(7)  // IT Act: 7 years
  legalHold        Boolean  @default(false)
  expiresAt        DateTime?
  archivedAt       DateTime?
  
  // Permissions
  accessPolicy     Json     // who can view/download/delete
  watermarkText    String?
  
  uploadedBy       String
  uploadedAt       DateTime @default(now())
  
  // Digital Signature
  signatures       DocumentSignature[]
  
  @@index([tenantId, namespace, documentType])
  @@index([sha256]) // deduplication
}

model DocumentSignature {
  id             String   @id @default(uuid())
  documentId     String
  certificateId  String
  signedAt       DateTime
  signatureHash  String
  purpose        String   // ITR_FILING / CONTRACT / LEGAL
  isValid        Boolean
}
```

**Reference change required across the entire schema:**
Replace `documentUrl String?` with `documentId String? @relation(...)` everywhere.

---

## SECTION 9 — AI PLATFORM

Stop thinking about "an AI feature for Income Tax."
Design an **ERP AI Platform** that every module consumes.

### 9.1 Platform Capabilities

```
ERP AI Platform
├── Document Intelligence
│   ├── OCR (receipts, invoices, notices)
│   ├── Document Classification
│   ├── Key-Value Extraction
│   └── Table Extraction
│
├── Generative AI
│   ├── Copilot (natural language → ERP action)
│   ├── Notice Explainer (legal language → plain English)
│   ├── Computation Explainer (why is my tax ₹X?)
│   └── CA Assistant (help me review this return)
│
├── Predictive AI
│   ├── Cash Flow Forecasting
│   ├── Demand Forecasting (inventory)
│   ├── Tax Liability Predictor
│   ├── Churn Risk (customer)
│   ├── Audit Risk Predictor
│   └── Notice Probability Scorer
│
├── Classification AI
│   ├── Expense Auto-Categorization
│   ├── Vendor TDS Section Classifier
│   ├── Transaction Intent Classifier
│   └── Document Type Classifier
│
└── Search and Discovery
    ├── Semantic Search (find similar notices)
    ├── Embedding Store (vector DB)
    └── RAG (Retrieval Augmented Generation for tax law)
```

### 9.2 AI Infrastructure

```
Platform: AIModel {
  id, name, provider (OPENAI/ANTHROPIC/GOOGLE/LOCAL),
  model_id, capability, cost_per_token, latency_p95, version, is_active
}

Platform: AIRequest {
  id, tenant_id, model_id, capability, input_hash, output: JSONB,
  input_tokens, output_tokens, latency_ms, cost, cached, created_at
}

Platform: AIEvaluation {
  id, request_id, evaluator (HUMAN/AUTO), score, feedback, evaluated_at
}

Platform: PromptTemplate {
  id, name, namespace, capability, template, variables: JSONB, version, is_active
}
```

### 9.3 RAG for Tax Law

Build a Knowledge Base of Indian tax law, CBDT circulars, case law, and TRACES updates.
When a user asks "Why is this income taxable?" or "What section covers this payment?" →
the system retrieves relevant passages from the knowledge base and generates an answer.

```
Platform: KnowledgeDocument {
  id, namespace (INCOME_TAX_ACT/GST_ACT/CBDT_CIRCULAR/ITAT_JUDGMENT),
  source_ref, title, effective_date,
  chunks: KnowledgeChunk[]
}

Platform: KnowledgeChunk {
  id, document_id, section_ref, text, embedding: vector(1536),
  @@index via pgvector
}
```

**This replaces the static help content and makes the ERP self-explanatory.**

---

## SECTION 10 — DOMAIN-DRIVEN DESIGN

The most important structural decision before writing a single service.

### 10.1 Bounded Contexts

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Sales Context  │  │ Purchase Context │  │  Inventory Ctx  │
│  ─────────────  │  │ ─────────────── │  │ ─────────────── │
│  Sale           │  │  PurchaseOrder  │  │  Product        │
│  SaleItem       │  │  GRN            │  │  StockMovement  │
│  Customer       │  │  Supplier       │  │  Batch          │
│  POS            │  │  Payment        │  │  Warehouse      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └──────────────────Event Bus──────────────┘
                              │
         ┌──────────────┬────┘───────────────┐
         │              │                    │
┌────────┴──────┐ ┌─────┴──────────┐ ┌─────┴──────────┐
│  Tax Context  │ │  CA Context    │ │  Compliance Ctx │
│ ─────────── │ │ ─────────────  │ │ ─────────────── │
│  ItReturn   │ │  CaClient      │ │  Obligation     │
│  TdsEntry   │ │  CaWorkflow    │ │  Filing         │
│  ItNotice   │ │  IssueFlag     │ │  Calendar       │
│  LossCFwd   │ │  SignOff       │ │  Penalty        │
└───────────────┘ └──────────────┘ └─────────────────┘
```

### 10.2 Anti-Corruption Layers

Between bounded contexts, never use each other's models directly.
Use ACL translators.

**Example: Tax Context needs sale data**

```typescript
// BAD — direct coupling
const sale = await this.saleRepository.findById(saleId);
const taxableTurnover = sale.totalAmount;

// GOOD — Anti-Corruption Layer
interface TaxableTransaction {
  id: string;
  date: Date;
  amount: Decimal;
  transactionType: 'SALE' | 'PURCHASE' | 'PAYMENT';
  partyPan?: string;
}

class SaleToTaxTranslator {
  translate(sale: Sale): TaxableTransaction {
    return { id: sale.id, date: sale.createdAt, amount: sale.totalAmount, transactionType: 'SALE' };
  }
}
```

### 10.3 Aggregates

Every write must go through an aggregate root. No direct table writes bypassing business logic.

```
ItReturn (aggregate root)
  ├── ScheduleBP (business income)
  ├── ScheduleS (salary)
  ├── ScheduleHP (house property)
  ├── ScheduleCG (capital gains)
  ├── ScheduleVIA (deductions)
  └── ComputationResult

TdsEntry (aggregate root)
  ├── ChallanPayment
  └── ReturnSubmission
```

---

## SECTION 11 — DATABASE ARCHITECTURE

### 11.1 Multi-Tenancy Strategy

**Current state:** `businessId` foreign key on most models — a form of implicit multi-tenancy.

**Problem:** No enforcement. A miscoded query can access another tenant's data.

**Required:** PostgreSQL Row-Level Security on ALL tables.

```sql
-- Enable RLS on every table
ALTER TABLE "ItReturn" ENABLE ROW LEVEL SECURITY;

-- Create policy — tenant can only see their own rows
CREATE POLICY tenant_isolation ON "ItReturn"
  USING ("businessId" = current_setting('app.current_tenant_id', true));

-- Application sets this on each connection
SET LOCAL app.current_tenant_id = '<tenant-uuid>';
```

**This is a platform-level requirement, not just for IT module.**
Enforce on: Sale, Purchase, Inventory, Customer, Supplier, ItReturn, TdsEntry — everything.

### 11.2 Missing Platform Tables

In addition to the 8 new IT-specific models, these platform tables must be built first:

```sql
-- 1. General Ledger (BLOCKER 1 from previous review)
CREATE TABLE "Account" (
  id UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL, -- ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE
  "parentId" UUID REFERENCES "Account"(id),
  "isSystem" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  UNIQUE ("businessId", code)
);

CREATE TABLE "JournalEntry" (
  id UUID PRIMARY KEY,
  "businessId" UUID NOT NULL,
  date DATE NOT NULL,
  reference VARCHAR(100),
  description TEXT,
  "sourceType" VARCHAR(50), -- SALE/PURCHASE/PAYMENT/ADJUSTMENT/DEPRECIATION
  "sourceId" UUID,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "JournalLine" (
  id UUID PRIMARY KEY,
  "journalEntryId" UUID NOT NULL REFERENCES "JournalEntry"(id),
  "accountId" UUID NOT NULL REFERENCES "Account"(id),
  "debit" NUMERIC(18,2) DEFAULT 0,
  "credit" NUMERIC(18,2) DEFAULT 0,
  narration TEXT,
  CONSTRAINT "debit_or_credit" CHECK (("debit" = 0) != ("credit" = 0))
);

-- 2. Rule Engine (Platform)
CREATE TABLE "RuleAuthority" (
  id UUID PRIMARY KEY,
  namespace VARCHAR(50) NOT NULL, -- INCOME_TAX/GST/PAYROLL/PRICING
  name VARCHAR(200) NOT NULL,     -- 'Finance Act 2025'
  effective_from DATE NOT NULL,
  effective_to DATE,
  gazette_ref VARCHAR(100)
);

CREATE TABLE "RuleSet" (
  id UUID PRIMARY KEY,
  authority_id UUID NOT NULL REFERENCES "RuleAuthority"(id),
  entity_type VARCHAR(50),
  period_label VARCHAR(20),       -- 'AY 2026-27' or 'TY 2026-27'
  version INT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE "Rule" (
  id UUID PRIMARY KEY,
  rule_set_id UUID NOT NULL REFERENCES "RuleSet"(id),
  category VARCHAR(50) NOT NULL,
  section_ref VARCHAR(50),
  description TEXT NOT NULL,
  condition JSONB,
  parameters JSONB NOT NULL,
  priority INT DEFAULT 0,
  supersedes_id UUID REFERENCES "Rule"(id)
);

-- 3. Event Store
CREATE TABLE "EventStore" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "eventType" VARCHAR(100) NOT NULL,
  "aggregateType" VARCHAR(50) NOT NULL,
  "aggregateId" UUID NOT NULL,
  payload JSONB NOT NULL,
  "schemaVersion" INT NOT NULL DEFAULT 1,
  "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sequenceNumber" BIGSERIAL
) PARTITION BY RANGE ("occurredAt");

CREATE INDEX ON "EventStore" ("tenantId", "aggregateId", "sequenceNumber");
CREATE INDEX ON "EventStore" ("eventType", "occurredAt");
```

### 11.3 Partitioning Strategy

```sql
-- Partition large tables by month
-- AuditLog
CREATE TABLE "AuditLog_2026_07" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- EventStore
CREATE TABLE "EventStore_2026_07" PARTITION OF "EventStore"
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- Automate with pg_partman extension
```

### 11.4 Missing Indexes

```sql
-- TDS detection — the engine scans payments by vendor/section/FY frequently
CREATE INDEX "idx_tds_entry_vendor_fy" ON "TdsEntry" ("supplierId", "financialYear");
CREATE INDEX "idx_tds_entry_section_status" ON "TdsEntry" ("section", "status");

-- IT Return by AY — very common filter
CREATE INDEX "idx_it_return_business_ay" ON "ItReturn" ("businessId", "assessmentYear");

-- Expense disallowance scanning
CREATE INDEX "idx_expense_disallowed" ON "Expense" ("businessId", "isDisallowed") WHERE "isDisallowed" = true;

-- Compliance deadline scanning
CREATE INDEX "idx_compliance_due" ON "ComplianceInstance" ("tenantId", "status", "dueDate");

-- Outbox polling
CREATE INDEX "idx_outbox_status_created" ON "OutboxEvent" ("status", "createdAt") WHERE "status" = 'PENDING';
```

---

## SECTION 12 — MICROSERVICES vs MODULAR MONOLITH

**Recommendation: Modular Monolith first. Extract when pain appears.**

The current NestJS application is a monolith. This is correct for the current scale.
However, within the monolith, enforce module boundaries:

```
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
│   └── scheduler/
│
├── erp-core/
│   ├── general-ledger/
│   ├── master-data/
│   ├── compliance-engine/
│   └── digital-twin/
│
├── modules/
│   ├── income-tax/
│   ├── gst/
│   ├── pos/
│   ├── inventory/
│   ├── purchase/
│   ├── customers/
│   └── reports/
```

**Module boundary rules:**
- `platform/` can import nothing from `modules/` or `erp-core/`
- `erp-core/` can import from `platform/` only
- `modules/` can import from `platform/` and `erp-core/` only
- Modules CANNOT import from each other — use events instead

**When to extract to microservice:**
- Rule Engine: when it needs separate deployment for zero-downtime Budget updates
- AI Platform: when GPU/inference costs need isolated billing
- Integration Hub: when third-party rate limits need independent scaling
- Document Service: when storage backend needs independent scaling

---

## SECTION 13 — TESTING STRATEGY

### 13.1 Golden Dataset

One canonical dataset per entity type per Assessment Year with known-correct outputs.

```
test/golden/
├── AY-2025-26/
│   ├── proprietorship_basic.json        // individual, new regime, no capital gains
│   ├── proprietorship_old_regime.json   // deductions claimed
│   ├── partnership_firm.json            // 40(b) computation
│   ├── huf_basic.json
│   └── expected_outputs/
│       ├── proprietorship_basic_expected.json
│       └── ...
├── AY-2026-27/
│   ├── proprietorship_new_slabs.json    // Budget 2025 slabs
│   └── expected_outputs/
```

Every computation test:
1. Load golden input
2. Run computation engine
3. Assert output matches golden expected output exactly
4. Any mismatch = test failure = no merge

### 13.2 Budget Regression Testing

After every Budget update (new TaxRule rows added):
```bash
npm run test:budget-regression -- --fy=2026-27
```

Runs all golden datasets against the new rules. Flags unexpected changes.
Prevents silent bugs where a Budget update breaks a prior year's computation.

### 13.3 Replay Testing

```typescript
describe('Computation Replay', () => {
  it('should produce identical output when replayed', async () => {
    const job = await runComputation({ businessId, ay: 'AY-2025-26' });
    const replayed = await replayComputation(job.id);
    expect(replayed.output).toEqual(job.output);
  });
  
  it('should produce identical output 5 years later using snapshot', async () => {
    const job = await runComputation({ businessId, ay: 'AY-2025-26' });
    // Simulate rule changes (add Budget 2030 rules)
    await addFutureRules();
    // Replay MUST use the snapshot, not current rules
    const replayed = await replayComputation(job.id);
    expect(replayed.output).toEqual(job.output); // Must not change
  });
});
```

### 13.4 Finance Act Regression

```bash
npm run test:finance-act -- --act=2025
```

Runs all affected computations after a Finance Act update and reports:
- Which entity types are affected
- What changed (tax delta)
- Whether penalty/interest impacts changed

### 13.5 Mutation Testing

Modify rule parameters by small amounts (1%) and verify the computation output changes.
Confirms that the computation actually uses the rule, not a hardcoded value.

---

## SECTION 14 — SECURITY ARCHITECTURE

### 14.1 ABAC (Attribute-Based Access Control)

Current: Simple role-based (ADMIN/CA/OWNER). This is insufficient.

**Correct model:**

```
Subject: { userId, role, tenantId, caLinkedTenants[] }
Resource: { entityType, entityId, tenantId, classification }
Action: { READ/WRITE/DELETE/EXPORT/PRINT/APPROVE }
Environment: { ipAddress, deviceTrusted, mfaVerified, time }

Permission granted if: Subject + Resource + Action + Environment → policy match
```

Example policy:
- CA can READ ItReturn for ANY of their caLinkedTenants
- CA can WRITE CaIssueFlag for ANY of their caLinkedTenants
- CA CANNOT DELETE any entity
- Owner can EXPORT their own ItReturn only if workflow state = OWNER_APPROVED
- ADMIN can read audit logs but CANNOT modify them

### 14.2 PAN and Sensitive Data

```typescript
// PAN must NEVER appear in logs
class PanField {
  private readonly value: string;
  
  constructor(pan: string) {
    if (!PAN_REGEX.test(pan)) throw new InvalidPanError(pan);
    this.value = pan;
  }
  
  toMasked(): string { return `${this.value.slice(0,3)}XXXXXX${this.value.slice(-1)}`; }
  toFull(actor: AuthenticatedUser): string {
    if (!actor.canViewFullPan) throw new ForbiddenError();
    return this.value;
  }
  
  toJSON() { return this.toMasked(); } // Never serialize the full PAN
}
```

### 14.3 Encryption at Rest

All sensitive fields encrypted at the column level (not just disk encryption):

```
PAN            → AES-256-GCM (application-level)
Bank Account   → AES-256-GCM
DSC PIN        → HSM (never stored in plaintext)
API Keys       → Vault / AWS Secrets Manager (never in DB)
Tax Documents  → Encrypted before upload to MinIO
```

### 14.4 CA Firewall

CA should see client data but NOT personal/banking data they don't need:

```typescript
// CA accessing a client's ItReturn
const returnForCa = await this.itReturnService.findForCa(caUserId, clientId, ay);
// Output: full tax computation, but bank account masked, owner's Aadhaar not included
```

---

## SECTION 15 — PRODUCT STRATEGY (10-YEAR HORIZON)

### 15.1 Scale Targets

| Metric | Year 1 | Year 3 | Year 5 | Year 10 |
|--------|--------|--------|--------|---------|
| Businesses | 50 | 5,000 | 50,000 | 1,000,000 |
| CAs | 5 | 500 | 5,000 | 100,000 |
| Filings/year | 50 | 5,000 | 50,000 | 1,000,000 |
| Finance Acts supported | 2 | 5 | 10 | 20+ |
| Assessment Years | 3 | 5 | 10 | 20+ |
| Rule Versions | 10 | 50 | 100 | 500+ |
| AI Models | 1 | 5 | 20 | 50+ |

**Does the current architecture support this?**
- 1M businesses: ❌ Single Postgres instance, no partitioning, no sharding strategy
- 100K CAs: ❌ CaBusinessLink scales, but there is no CA marketplace/directory
- 10 Finance Acts: ✅ Rule Engine handles this if built correctly
- 20 AYs: ✅ Rule Engine handles this if built correctly
- 100 Rule Versions: ✅ Rule Engine handles this
- 50 AI Models: ❌ No AI Platform, no model registry

### 15.2 Pricing and Licensing Model

```
Plan: FREE
  - 1 Business
  - Current AY only
  - Basic TDS detection
  - No CA access
  - No ITR filing

Plan: STARTER (₹3,999/year per PAN)
  - 1 Business
  - 2 AY history
  - TDS detection + reminders
  - CA invite (1 CA)
  - PDF downloads

Plan: PROFESSIONAL (₹9,999/year per PAN)
  - 1 Business
  - Full AY history
  - Full IT module
  - CA workflow
  - AIS reconciliation
  - WhatsApp alerts

Plan: CA_OFFICE (₹24,999/year)
  - 50 client businesses
  - CA command center
  - Bulk filing
  - ERI integration
  - White-label option

Plan: ENTERPRISE (custom)
  - Unlimited clients
  - API access
  - Custom integrations
  - Dedicated support
  - SLA guarantee
```

### 15.3 ERI as Competitive Moat

Register as ERI Type 2 in Year 1 (30-60 day process).
This allows programmatic ITR filing for clients.
No competitor (except KDK and ClearTax) has ERI status.
ClearTax is exiting the CA market (shut down TaxCloud March 2026).
This is a 6-month window to capture migrating CAs.

### 15.4 International Expansion Design

Even though we build for India today, the architecture must not bake in India-specific assumptions:

```
❌ BAD: AssessmentYear (Indian concept)
✅ GOOD: FiscalPeriod { country, startDate, endDate, label }

❌ BAD: FinanceAct (Indian concept)
✅ GOOD: LegislativeAct { jurisdiction, name, effectiveFrom }

❌ BAD: Section 194C (Indian TDS)
✅ GOOD: WithholdingRule { jurisdiction, code, description }
```

When expanding to UAE, Singapore, or Sri Lanka, only add:
1. New LegislativeAct rows
2. New RuleSet + Rule rows
3. New UI translations

No core code changes.

---

## SECTION 16 — FINAL DELIVERABLE: PRIORITY MATRIX

### CRITICAL (Must complete before any feature code)

| # | Item | Why Critical |
|---|------|-------------|
| C1 | Build ERP Core Platform module structure | Every feature sits on this — skip it and rebuild everything |
| C2 | General Ledger (Chart of Accounts + Journal Entry) | ITR is impossible without it |
| C3 | Universal Rule Engine (platform, not IT-specific) | Every computation uses it; wrong design = rewrite |
| C4 | Event Bus (Outbox pattern + BullMQ) | Digital Twin depends on it; TDS detection depends on it |
| C5 | Platform Audit Engine (hash-chained, multi-module) | Compliance requirement; must be there from day 1 |
| C6 | Row-Level Security on all Postgres tables | Multi-tenant data isolation; cannot retrofit later |
| C7 | Document Platform (replace all `documentUrl` strings) | 12 models affected; the longer we wait, the bigger the refactor |
| C8 | Platform Workflow Engine (replaces IT-specific FSM) | Purchase approval, ITR workflow, expense approval all need it |
| C9 | Integration Hub (centralize all external API calls) | IT Portal, TRACES, GSTN — all need it; direct integration = unmaintainable |
| C10 | ComputationJob + ComputationLineage tables | No replay = no audit = no enterprise grade |

### HIGH (Complete before v1 launch)

| # | Item |
|---|------|
| H1 | Compliance Digital Twin (BusinessDigitalTwin model + real-time update) |
| H2 | Vendor Compliance Knowledge Graph |
| H3 | Notification Engine (platform) |
| H4 | Platform Scheduler (unified job runner) |
| H5 | Feature Flag Engine |
| H6 | Search Engine (PostgreSQL FTS with pgvector readiness) |
| H7 | API versioning (`/api/v1/`) |
| H8 | Idempotency keys on all mutating endpoints |
| H9 | Structured logging (JSON format, correlation IDs) |
| H10 | Health check endpoints |
| H11 | PAN encryption at column level |
| H12 | Rate limiting on all public endpoints |
| H13 | Soft delete standardized across all entities |
| H14 | Entity versioning (EntityVersion table) |
| H15 | DDD bounded context enforcement (no cross-module imports) |

### MEDIUM (v1.5)

| # | Item |
|---|------|
| M1 | AI Platform (OCR, classification, RAG for tax law) |
| M2 | Custom Fields / Metadata Engine |
| M3 | Dynamic Forms Engine |
| M4 | Cache Layer (Redis for computed results and session) |
| M5 | Distributed locking (prevent double-computation) |
| M6 | Partitioning on AuditLog and EventStore |
| M7 | Read replicas for reporting queries |
| M8 | Backup and disaster recovery plan |
| M9 | Multi-branch support |
| M10 | Number Series Generator |

### LOW (v2)

| # | Item |
|---|------|
| L1 | Currency Engine (multi-currency) |
| L2 | Plugin Framework / Extension SDK |
| L3 | Blue-Green deployment |
| L4 | Kubernetes readiness |
| L5 | Multi-company support |
| L6 | International tax jurisdiction support |
| L7 | Elastic Search migration |
| L8 | Event Sourcing (CQRS read side) |
| L9 | Saga pattern for long-running workflows |
| L10 | AI Evaluation Framework and Model Registry |

### FUTURE

| # | Item |
|---|------|
| F1 | Database sharding |
| F2 | Global CDN |
| F3 | Offline sync and conflict resolution |
| F4 | ERP SDK for third-party extensions |
| F5 | Marketplace for CA/consultant profiles |

---

## SECTION 17 — TECHNICAL DEBT TO AVOID

These patterns exist in the codebase today. Each one, if left unchecked, becomes expensive.

| Debt | Current State | Consequence if Not Fixed |
|------|--------------|--------------------------|
| `documentUrl: String` | 12+ model fields | No versioning, no OCR, no hash, no encryption |
| `assessmentYear: String` | Raw string like 'AY 2025-26' | No validation, no Year Engine, no indexing |
| Cross-module direct imports | Unknown — must audit | Prevents independent module evolution |
| No error codes | Generic `throw new Error()` | Impossible to handle errors in frontend or retry logic |
| Hardcoded tax slabs | In computation engine docs | Budget 2026 = emergency deploy |
| `isMsme: Boolean` on Supplier | No MSME payment tracking | 43B(h) violations go undetected |
| Status fields as strings | e.g., `status: String` | No FSM, invalid states possible |
| No idempotency | All POST endpoints | Duplicate data on retry |
| `console.log()` | Throughout | No structured logging, no tracing |
| `.env` secrets | `GOOGLE_VISION_API_KEY` etc. | Secret rotation impossible without downtime |

---

## SECTION 18 — ARCHITECTURAL RISKS

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| GL is built later but Tax Engine is built now | HIGH | Critical — Tax reports are wrong | Build GL first, always |
| Rule Engine stays IT-specific | HIGH | All other modules build separate engines | Platform Rule Engine must be designed before ANY module uses it |
| Budget 2026 changes a rate that's hardcoded | HIGH | Emergency deploy, potential wrong filings | Zero hardcoding from day 1 |
| Single Postgres instance at 10K businesses | HIGH | Performance degradation, downtime | Partitioning + read replicas in v1.5 |
| No idempotency at scale | HIGH | Duplicate TDS entries, double filings | Add idempotency keys before v1 |
| CA data isolation failure | MEDIUM | Legal liability, data breach | RLS before any CA feature |
| ERI registration takes 90 days | MEDIUM | v1 without direct filing | Start registration on day 1 of build |
| IT Act 2025 new form numbers not supported | MEDIUM | Wrong return filing | Validate Rule Engine stores new form names |
| AIS feedback not tracked | MEDIUM | Disputes lost, reconciliation fails | AISEntry model needs feedback fields from day 1 |
| Event Bus not implemented | HIGH | Digital Twin cannot exist; TDS detection is manual | Implement before Tax Engine |

---

## SECTION 19 — DESIGN SMELLS IN CURRENT ARCHITECTURE

These are patterns that indicate the architecture is thinking too small.

**Smell 1: Module-owned infrastructure**
`TaxAuditLog` should be `AuditLog` (platform).
`TaxWorkflow` should be `WorkflowInstance` (platform).
If the pattern repeats in the next module, it's a platform service.

**Smell 2: String-typed domain concepts**
`assessmentYear: String`, `noticeType: String`, `status: String`
These should be enums or value objects with validation.
A `String` field has infinite invalid states.

**Smell 3: Direct URL storage**
`documentUrl: String` is a file system pointer, not a document model.
When the storage backend changes (MinIO → S3), every URL breaks.
When the retention policy changes, there is no way to find affected files.

**Smell 4: Flat TDS detection**
The TDS detection engine described in `tds_detection_rules.md` is triggered by scanning payments manually.
It should be event-driven: `PaymentProcessed` event → TDS Engine reacts.
The push model eliminates polling and lag.

**Smell 5: No failure modes designed**
The architecture describes the happy path exclusively.
What happens if:
- The Rule Engine returns no matching rule?
- The OCR service is down when a notice is uploaded?
- The IT portal is unavailable when ITR is being filed?
- BullMQ is down and an event is lost?

Every operation needs a defined failure mode. Outbox pattern addresses event loss.
Circuit breakers address external service failure.

**Smell 6: Computation not isolated from state mutation**
The computation engine both reads state and modifies state (saves ItReturn).
Computation should be a pure function.
State mutation should be a separate step after computation is verified.

---

## THE REVISED BUILD ORDER

Replace the original 13-step IT Module build order with:

### Phase 0 — ERP Core Platform (4 weeks, no IT features)

1. Platform module structure (bounded contexts enforced)
2. General Ledger (Account, JournalEntry, JournalLine)
3. Platform Audit Engine (hash-chained AuditLog)
4. Event Bus (Outbox + BullMQ + EventStore)
5. Platform Rule Engine (RuleAuthority, RuleSet, Rule)
6. Document Platform (Document model, MinIO integration, hash)
7. Platform Workflow Engine (WorkflowTemplate, WorkflowInstance)
8. Integration Hub (Connector model, circuit breaker wrapper)
9. Notification Engine (templates, channels, scheduler)
10. Row-Level Security (all tables)

### Phase 1 — IT Foundation (after Phase 0)

11. Seed Rule Engine with all AY 2025-26 and AY 2026-27 rules (zero hardcoding from day 1)
12. IT Setup Wizard (entity type, PAN, regime, partners, assets, losses)
13. Digital Twin model (BusinessDigitalTwin + real-time update service)
14. TDS Detection Engine (event-driven from payment events)
15. Expense Ledger module

### Phase 2 — IT Computation (after Phase 1)

16. Fixed Asset Register + Block Depreciation
17. ComputationJob + ComputationLineage
18. Tax Computation Engine (deterministic, replayable, rule-driven)
19. Advance Tax Tracker
20. AIS upload + reconciliation (with feedback model)

### Phase 3 — IT Workflows (after Phase 2)

21. CA Multi-Client Dashboard (CaBusinessLink, CA Workflow)
22. ITR JSON generation (ITR-3, ITR-4, ITR-5)
23. Notice tracking (ItNotice + Workflow)
24. Compliance Calendar (ComplianceObligation + ComplianceInstance)
25. Tax Health Dashboard (from Digital Twin)

### Phase 4 — Intelligence (after Phase 3)

26. AI Platform foundation (OCR, classification)
27. Notice Explainer (RAG on tax law)
28. Expense auto-categorizer
29. Audit risk predictor
30. Tax planning what-if engine

---

## CLOSING STATEMENT

The Income Tax module, designed as a standalone product, would be finished in 6 months
and replaced in 3 years when the next module needs a workflow engine.

The Enterprise Compliance Platform, designed correctly, will run unchanged for 20 years
while new modules, new jurisdictions, and new compliance domains are added as consumers.

The only irreversible architectural mistake is building the wrong foundation.

Platform first. Income Tax second.

---

*This document supersedes the original `ARCHITECTURE_REVIEW.md` for platform-level decisions.*
*Module-level IT decisions remain in `ARCHITECTURE_REVIEW.md`.*
*Both must be resolved before any feature code is written.*
