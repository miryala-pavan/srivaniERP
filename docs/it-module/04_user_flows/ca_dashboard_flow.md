# CA Dashboard — User Flow & Design Spec

> CA = Chartered Accountant (or tax professional) using our ERP to manage client IT filing.
> This covers: multi-client view, review workflow, sign-off, filing handover.

---

## CA Login Experience

1. CA logs in with their credentials (role = CA)
2. If CA is assigned to multiple businesses → sees **Client Portfolio** dashboard
3. If CA is assigned to exactly one business → goes to that business's IT dashboard

---

## Client Portfolio Dashboard (Multi-Business CA View)

```
┌─────────────────────────────────────────────────────────────────┐
│  CA Dashboard — Rajan CPA                                        │
│  AY 2025-26  ▼  (year selector)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Search clients... [🔍]              Total: 14 clients          │
├──────────────┬──────────────┬───────────────┬──────────────────┤
│  Business    │  Type        │  Filing Status │  Deadline        │
├──────────────┼──────────────┼───────────────┼──────────────────┤
│  Srivani Stores │ Proprietorship │ 🟡 CA Review   │  31 Jul (12d) │
│  Krishna Traders │ Partnership   │ 🔴 Data Pending│  31 Jul (12d) │
│  Lakshmi Medicals │ Proprietorship │ 🟢 Filed    │  ✅ Done       │
│  Ram Enterprises │ Proprietorship │ 🔵 Draft     │  31 Jul (12d) │
│  ...         │              │               │                  │
└──────────────┴──────────────┴───────────────┴──────────────────┘
```

### Status Colors
| Color | Status | Meaning |
|-------|--------|---------|
| 🔴 Red | DATA_PENDING | Owner hasn't completed data entry |
| 🟡 Yellow | CA_REVIEW | Data complete, CA needs to review |
| 🔵 Blue | DRAFT | CA is working on it |
| 🟠 Orange | OWNER_REPLY_NEEDED | CA flagged issues, waiting for owner |
| 🟢 Green | FILED | ITR submitted and acknowledged |
| ⚫ Grey | NOT_STARTED | AY setup not done yet |

---

## Inside One Client's IT Module (CA View)

When CA clicks on a client, they see that business's full IT dashboard with elevated permissions:

### CA-Only Capabilities (vs Owner)
- Can add/edit adjustments in the computation
- Can flag issues with comments (CaIssueFlag)
- Can mark computation as "reviewed"
- Can generate ITR JSON for download
- Can see full audit trail of all changes
- Cannot modify sales/purchase data (read-only for business operations)

---

## CA Review Workflow

### Step 1: Check Data Completeness
The system shows a checklist before CA can start review:

```
Pre-Review Checklist for Srivani Stores — AY 2025-26

Business Setup
  ✅ Entity type configured (Proprietorship)
  ✅ PAN entered
  ✅ Tax regime selected (New — Recommended)
  ✅ Partnership deed uploaded (if firm)

Financial Data
  ✅ Sales data complete (1 Apr – 31 Mar)
  ✅ Purchase data complete
  ❌ Expense ledger: 3 uncategorized expenses found
  ✅ Closing stock value entered

Assets
  ✅ Fixed asset register complete
  ✅ Additions/disposals for FY entered
  ✅ Depreciation computed

TDS
  ✅ All payments scanned for TDS
  ⚠️ 2 TDS entries pending deposit (₹8,400)
  ✅ Form 26AS uploaded and reconciled (or manual entry done)

Advance Tax
  ✅ All 4 instalments entered

[Proceed to Review →]
```

### Step 2: Computation Review Screen

Shows the full P&L → Tax computation breakdown.
CA can click any line to expand detail.

Key sections:
- **Revenue:** Compare to GST turnover (auto-pulled from ERP's GST data)
- **Purchases:** Verify against supplier invoices
- **Expenses:** Review uncategorized items → assign category
- **Adjustments:** See all 40A(3), 43B, 40(b) add-backs
- **Depreciation:** Block-wise summary with individual assets
- **Final income:** Confirm reasonable (compare to prior years)

### Step 3: Flag Issues (CaIssueFlag)

CA can flag any item:
```
[+ Add Flag]
Section: Expenses → Repairs & Maintenance
Amount: ₹45,000 (paid to Raju Construction)
Issue: Cash payment exceeds ₹10,000 threshold (40A(3))
Recommended action: Ask owner for payment mode clarification
→ Send to owner ✉️
```

### Step 4: Owner Responds to Flags
Owner sees "Pending CA Queries" on their dashboard:
```
CA Rajan has 3 questions for you:
1. "₹45,000 cash payment to Raju Construction — what was the payment mode?"
   [Your answer:] _______________  [Reply]
2. "PF payment for March — was this deposited before April 30?"
   [Your answer:] _______________  [Reply]
3. "Please provide rent receipt for Q4 from Landlord Suresh"
   [Attach document] [Reply]
```

### Step 5: CA Final Review & Sign-Off
After all flags resolved:
1. CA reviews final computation summary
2. Compares AY 2025-26 tax with AY 2024-25 (year-on-year)
3. Confirms: "I have reviewed and this return is ready for filing"
4. Status → `CA_APPROVED`

### Step 6: ITR JSON Download / Filing
1. System generates ITR JSON in portal format
2. Owner downloads JSON
3. Owner logs into incometaxindiaefiling.gov.in
4. Owner uploads JSON utility, e-verifies
5. System records: `acknowledgmentNumber`, `filingDate`, `filedBy`
6. Status → `FILED`

---

## CA Issue Flag Schema (Required Addition)

Current schema has `CaIssueFlag` but needs these fields added:

```prisma
model CaIssueFlag {
  // ... existing fields ...
  ownerResponse        String?
  ownerResponseAt      DateTime?
  attachmentUrls       String[]   // array of uploaded file URLs
  status               CaFlagStatus  // OPEN, OWNER_REPLIED, RESOLVED, DISMISSED
  resolvedBy           String?    // userId
  resolvedAt           DateTime?
}

enum CaFlagStatus {
  OPEN
  OWNER_REPLIED
  RESOLVED
  DISMISSED
}
```

---

## CA Dashboard Access Model

### Required: CaBusinessLink Table (New Model Needed)

```prisma
model CaBusinessLink {
  id          String   @id @default(uuid())
  caUserId    String
  businessId  String
  assignedBy  String   // SUPER_ADMIN who assigned
  assignedAt  DateTime @default(now())
  isActive    Boolean  @default(true)

  caUser   User     @relation(fields: [caUserId], references: [id])
  business Business @relation(fields: [businessId], references: [id])
  
  @@unique([caUserId, businessId])
}
```

SUPER_ADMIN can assign a CA to any number of businesses.
CA sees all their assigned businesses on login.

---

## Filing History Dashboard

For each business, show:
```
Filing History — Srivani Stores

AY 2025-26 | Proprietorship | ITR-3 | New Regime
  Status: ✅ Filed on 28 Jul 2025
  Acknowledgment: ABC1234567890
  Tax paid: ₹87,450 | Refund: NIL
  Gross Income: ₹32,45,000 | Taxable: ₹30,20,000
  CA: Rajan CPA

AY 2024-25 | Proprietorship | ITR-3 | Old Regime  
  Status: ✅ Filed on 30 Jul 2024
  Acknowledgment: DEF9876543210
  Tax paid: ₹72,200 | Refund: NIL
  Gross Income: ₹28,50,000 | Taxable: ₹26,80,000
  CA: Rajan CPA

AY 2023-24 | ...
```

Year-on-year comparison chart: income trend, tax trend, refund/payable trend.
