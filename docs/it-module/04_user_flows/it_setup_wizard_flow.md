# IT Setup Wizard — User Flow

> One-time setup per business to configure the IT module.
> Run by owner (guided) or CA (on behalf of owner).
> Output: Populated ItProfile, BusinessPartner records, opening balances.

---

## Step 1: Entity Type & Basic Info

```
┌─────────────────────────────────────────────────────┐
│  IT Module Setup — Step 1 of 6                      │
│  Business Type                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  What is the legal structure of your business?       │
│                                                      │
│  ○ Proprietorship (Single owner, no partners)        │
│  ○ Hindu Undivided Family (HUF)                      │
│  ○ Partnership Firm (2+ partners, deed required)     │
│  ○ LLP (Limited Liability Partnership)               │
│                                                      │
│  [→ Continue]                                        │
└─────────────────────────────────────────────────────┘
```

---

## Step 2: PAN & Registration

```
Step 2 of 6 — PAN & Tax Registration

Business PAN: [____________]  ℹ️ 10-character PAN (XXXXX0000X format)
Business Name (as per PAN): [____________________]

Goods & Service Tax (GST)
  □ Business is GST registered
  GSTIN: [__________________]  (15 characters)
  GST Scheme: ○ Regular  ○ Composition

Tax Audit (Section 44AB)
  Is business required to get tax audit? [Auto-calculated after turnover entry]

Turnover Last FY (approx): ₹[__________]
  → If > ₹1 crore: Audit required (unless 95% digital + turnover < ₹10 crore)
  → The system will auto-determine based on actual data

[← Back]  [→ Continue]
```

---

## Step 3: Tax Regime (for Individuals/HUFs only)

```
Step 3 of 6 — Tax Regime Selection

For FY 2025-26, which income tax regime do you prefer?

  ○ New Regime (default — generally better for income < ₹15L with fewer deductions)
    • Lower rates, simpler
    • No 80C, 80D, HRA, housing loan deductions
    
  ○ Old Regime (better if you have large deductions — LIC, PF, HRA, housing loan interest)
    • Higher rates
    • Can claim all Chapter VI-A deductions

  💡 Not sure? The system will compute your tax under BOTH regimes 
     and recommend which saves more after your CA reviews.
     
  ○ Let the system recommend (compute both, select best)

[← Back]  [→ Continue]
```

---

## Step 4: Partners (Partnership/LLP only)

```
Step 4 of 6 — Partner Details

Add all partners as per the Partnership Deed

Partner 1 (Managing Partner)
  Name: [________________]
  PAN:  [________________]
  Capital Contribution: ₹[________]
  Profit Sharing Ratio: [___] %
  Is Working Partner: ☑️ Yes
  Salary (as per deed): ₹[________] per year
    (Max allowed: ₹1,50,000 or 90% of book profit for first ₹3L, 60% on balance)
  Interest Rate on Capital: [12] %  (Max 12% as per IT Act)

[+ Add Another Partner]

Total Profit Sharing: [100] %  ✅

Deed Upload: [📎 Upload Partnership Deed PDF]
Deed Date: [____/____/________]

[← Back]  [→ Continue]
```

---

## Step 5: Fixed Assets — Opening Balances

```
Step 5 of 6 — Fixed Assets

Do you have any fixed assets (building, machinery, computers, vehicles, furniture)?
  ○ Yes — I'll enter them now
  ○ Yes — I'll import from previous ITR (upload ITR-3/ITR-5 JSON or Form 3CD)
  ○ No fixed assets

─────────────────────────────────────────────────────────
For existing businesses:

Enter Opening WDV (Written Down Value) per asset block
as at 1 April 2025 (start of FY 2025-26):

  Block                        Opening WDV (₹)
  ─────────────────────────────────────────────
  Buildings (10%)              [____________]
  Furniture & Fittings (10%)   [____________]
  Plant & Machinery (15%)      [____________]
  Computers & Software (40%)   [____________]
  Vehicles (15%)               [____________]
  Intangibles (25%)            [____________]

─────────────────────────────────────────────────────────
Assets purchased THIS YEAR can be added in the
Fixed Asset Register after setup.

[← Back]  [→ Continue]
```

---

## Step 6: Carried Forward Losses

```
Step 6 of 6 — Losses from Previous Years

Do you have any losses from previous assessment years that can be carried forward?

Business Loss (Sec 72)
  AY 2024-25: ₹[________]  (can be carried for 8 years)
  AY 2023-24: ₹[________]
  (Add more years if needed)

Unabsorbed Depreciation (Sec 32(2))
  AY 2024-25: ₹[________]  (can be carried INDEFINITELY)
  AY 2023-24: ₹[________]

Capital Loss
  LTCL AY 2024-25: ₹[________]  (carried 8 years, set off only against LTCG)
  STCL AY 2024-25: ₹[________]  (carried 8 years, set off against any capital gain)

💡 Where to find this? Look at your previous year's ITR — Schedule BFLA.
   Ask your CA if unsure.

[← Back]  [✅ Complete Setup]
```

---

## Completion Screen

```
┌─────────────────────────────────────────────────────┐
│  ✅ IT Module Setup Complete!                        │
│                                                      │
│  Srivani Stores — Proprietorship                     │
│  PAN: ABCPS1234D | FY 2025-26 | New Regime          │
│                                                      │
│  What's next?                                        │
│                                                      │
│  1. [Add Fixed Assets →] Enter assets bought this   │
│     year or import from last year's Form 3CD         │
│                                                      │
│  2. [Review TDS Obligations →] The system has        │
│     scanned your payments and found 3 TDS items      │
│                                                      │
│  3. [Set Up Advance Tax →] Enter your advance tax    │
│     payment schedule                                 │
│                                                      │
│  4. [Assign CA →] Link a CA to review your filing    │
│     (optional but recommended)                       │
│                                                      │
│  [Go to IT Dashboard →]                              │
└─────────────────────────────────────────────────────┘
```

---

## Data Written to DB on Completion

```typescript
// ItProfile record
{
  businessId,
  entityType: 'PROPRIETORSHIP',
  pan: 'ABCPS1234D',
  gstin: '...',
  taxRegime: 'NEW',
  financialYear: '2025-26',
  isUnderAudit: false,  // auto-computed
  setup_completed: true,
}

// BusinessPartner records (if firm)
[{ name, pan, profitRatio, salary, interestRate, isWorking }]

// CapitalAccount records (if firm, one per partner)
[{ partnerId, openingBalance, financialYear }]

// ItLossCF records (new model needed)
[{ lossType, assessmentYear, amount }]

// FixedAsset records (opening WDV as base asset)
[{ block, openingWdv, fy: '2024-25', isOpeningBalance: true }]
```

---

## Notes

- Setup can be re-run for a new FY (duplicates last year's setup with updated opening balances)
- CA can edit any setup field after the fact
- Missing data is flagged in the pre-review checklist (Step 1 of CA review)
