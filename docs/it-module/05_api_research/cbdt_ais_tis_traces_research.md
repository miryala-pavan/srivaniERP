# CBDT / AIS / TIS / TRACES 2.0 / ERI — Deep Research

> Research completed July 2026. All findings verified against official sources.
> This document supplements the architecture review and corrects earlier assumptions.

---

## 1. AIS vs TIS — Full Clarification

### AIS (Annual Information Statement) — Transaction Level
Introduced November 2021 under Section 285BB. Far broader than Form 26AS.

**Part A:** PAN, Aadhaar, name, DOB, address, contact

**Part B — What AIS has that Form 26AS does NOT:**

| Category | Form 26AS | AIS |
|----------|-----------|-----|
| TDS/TCS credits | ✅ | ✅ |
| Advance tax / self-assessment tax | ✅ | ✅ |
| Refunds | ✅ | ✅ |
| Bank FD interest (even if no TDS) | ❌ | ✅ (via SFT) |
| Dividend income | ❌ | ✅ |
| Mutual fund transactions | ❌ | ✅ |
| Equity transactions | ❌ | ✅ |
| Foreign remittances (15CA/CB) | ❌ | ✅ |
| GST turnover | ❌ | ✅ (from GSTN) |
| Purchase/sale of immovable property | ❌ | ✅ (from sub-registrar) |
| Professional fee receipts (SFT) | Only if TDS deducted | ✅ |

### TIS (Taxpayer Information Summary) — Aggregated
Derived FROM AIS. Purpose: make ITR pre-filling practical.

- TIS aggregates duplicate entries and shows ONE value per income category
- Bank FD interest from 5 different banks → TIS shows one total
- **Portal uses TIS (not AIS) for ITR prefilling**
- AIS = granular (transaction level) | TIS = category-level summary
- TIS can be downloaded in PDF only; AIS available in PDF, JSON, CSV

**Which supersedes which:**
- Tax credits (TDS/TCS): **Form 168** (old Form 26AS) governs → if AIS and Form 168 differ, Form 168 is used for credit
- Income reporting: **AIS is operative** → income in AIS cannot be ignored even if not in Form 168
- ITR prefilling: **TIS is used**

### AIS JSON Schema (for parsing in our ERP)
```json
{
  "aisGeneralInformation": {
    "pan": "ABCPS1234D",
    "name": "SRIVANI STORES",
    "dob": "1975-06-15",
    "assessmentYear": "AY 2025-26"
  },
  "aisPartBInformation": [
    {
      "informationType": "TDS_INFORMATION",
      "informationDetails": [
        {
          "sourceType": "EMPLOYER",
          "sourceName": "XYZ Company",
          "sourceTAN": "HYDX01234E",
          "transactionDate": "2025-03-31",
          "reportedAmount": 500000,
          "modifiedAmount": 500000,
          "feedbackStatus": "NO_ACTION",
          "informationCode": "TDS-192"
        }
      ]
    },
    {
      "informationType": "SFT_INFORMATION",
      "informationDetails": [
        {
          "sourceType": "BANK",
          "sourceName": "SBI",
          "transactionDate": "2025-03-31",
          "reportedAmount": 45000,
          "modifiedAmount": 45000,
          "feedbackStatus": "INFORMATION_IS_CORRECT",
          "informationCode": "SFT-006"   // FD interest
        }
      ]
    }
  ]
}
```

### AIS Feedback — 6 Types (Add to AISEntry model)
```
INFORMATION_IS_CORRECT           // Accept as-is
INFORMATION_NOT_FULLY_CORRECT    // Partial dispute; provide correct amount
INFORMATION_RELATES_TO_OTHER     // Wrong PAN / year attribution
INFORMATION_IS_DUPLICATE         // Duplicate entry in AIS
INFORMATION_IS_DENIED            // Transaction never occurred
INFORMATION_IS_NOT_TAXABLE       // Occurred but exempt / not income
```

After submitting feedback:
- TIS is immediately recalculated
- Reporting source (bank, MF) is notified and may confirm or deny
- Original reported value stays; taxpayer's feedback is preserved
- AIS Mobile App (Android + iOS) also supports feedback

---

## 2. TRACES 2.0 — Full Spec

**Launched:** April 1, 2026 | Portal: `traces.tdscpc.gov.in`

### New Concepts

**Unified Tax Ledger (UTL):** Replaces the old tax credit statement model.
- Real-time credit push — when deductor files TDS return, credit appears IMMEDIATELY in UTL
- No more lag between TDS return filing and credit reflecting in "Form 26AS"
- Aggregates: advance tax + TDS + TCS + self-assessment tax in one running ledger

**Single Tax Year:** Replaces PY/AY dual terminology. All TRACES 2.0 views use Tax Year.

**Real-Time TDS Credit Push:** Critical for our ERP — when we file a TDS return (Form 138/140), the deductee sees the credit immediately. This eliminates the "TDS deducted but not reflecting" issue.

### What TRACES 2.0 Offers

| Feature | Deductors | ERIs (Type 2) |
|---------|----------|--------------|
| TDS return filing | ✅ | ✅ |
| Correction return filing | ✅ | ✅ |
| Challan verification | ✅ | ✅ |
| Conso file download | ✅ | ✅ |
| Form 130/131 generation | ✅ (after filing) | ✅ (bulk) |
| Bulk PAN validation | ✅ | ✅ |
| Form 121 (15G/15H) consolidated | ✅ | ✅ |
| Lower deduction cert (197) | ✅ | ✅ |
| Prefill data fetch for clients | ❌ | ✅ (with consent) |
| Programmatic ITR submission | ❌ | ✅ |
| e-Verification API | ❌ | ✅ |

**Note:** TRACES 2.0 does NOT handle challan payments. Challan 281 still goes through the IT portal or authorised bank portal.

### Form 15G + 15H → Form 121 (Merged)
From TY 2026-27, Forms 15G and 15H are merged into a single **Form 121**.
Our system should generate Form 121 when a vendor self-declares no TDS deduction.

---

## 3. ERI Registration — Definitive Guide

### Types
- **Type 1:** Uses ITD portal interface directly; needs ISA/CISA due diligence certificate
- **Type 2:** Builds own software with API integration; needs software capability proof
- **Type 3:** Desktop offline tools approved by ITD

### Type 2 ERI API Endpoints (IEC 2.0 spec)

1. `POST /login` — ERI session establishment
2. `POST /addRegisteredClient` — Add existing e-filing user as client (needs taxpayer OTP)
3. `POST /registerUnregisteredClient` — Register new PAN holder + add as client
4. `POST /getPrefillDetails` — Fetch TIS/AIS-derived prefill for client (needs prior consent)
5. `POST /validateItr` — Validate ITR JSON/XML without submitting (returns error list)
6. `POST /submitItr` — Validate + submit ITR; returns acknowledgment number
7. `GET /itrStatus` — Check processing status of filed return
8. `POST /eVerify` — Trigger e-verification via Aadhaar OTP/net banking

**Technical reference:** `ERI API Specification_v1.1.pdf` at incometax.gov.in (free download)

### Registration Process
1. Apply at `incometax.gov.in` → Register → Others → e-Return Intermediary
2. Select Type 2, upload: Certificate of Incorporation, audited balance sheet, net-worth cert, software capability proof
3. Technical security review of our software by ITD team
4. Sign ERI Agreement digitally
5. Receive ERI credentials + API keys

**Timeline:** 30–60 days (straightforward) to 90+ days (new organizations)
**Annual compliance:** Data retention min 1 year post AY, client consent records, security breach reporting

---

## 4. CPC Workflow — Complete

### Processing Steps
1. ITR uploaded + e-verified
2. CPC checks: arithmetic errors, internal inconsistency, TDS matching against UTL, advance tax verification
3. Intimation u/s 143(1) issued within **9 months** from end of FY of filing
4. Typical turnaround: 20–45 working days from e-verification

### 143(1) Outcomes
- No Demand No Refund: accepted
- Refund: initiated
- Demand: demand notice + computation statement issued

**Intimation PDF password:** `<PAN><DOB in DDMMYYYY>` (e.g., AABCD1234E01011980)

### Rectification u/s 154 (Section 383 in IT Act 2025)
For "mistakes apparent from record" — NOT for disputes:
- Taxpayer can file within **4 years** from end of FY in which order was passed
- CPC must dispose within **6 months** from month of receipt
- File at: incometax.gov.in → Services → Rectification → CPC Processed Returns
- Types: No further data correction (auto-fixable), Additional information, Return data correction

### Responding to Demand
- Agree + Pay: e-Pay Tax on portal
- Disagree: select reason, provide documents → CPC re-examines

---

## 5. Faceless Assessment — Complete Workflow

**Legal basis:** Section 144B (IT Act 1961), renumbered under IT Act 2025.
**Body:** National Faceless Assessment Centre (NaFAC), Bengaluru.
**Portal:** incometax.gov.in → Pending Actions → e-Proceedings

### Workflow (10 Steps)
1. Case selected by RMS/CASS (risk parameters: AIS-ITR mismatch, high-value unexplained)
2. Section 143(2) notice sent (within 6 months of end of AY) — from "NaFAC", no named AO
3. Taxpayer acknowledges receipt in e-Proceedings
4. Assessment Unit (AU) sends Section 142(1) questionnaire (documents, explanations)
5. Taxpayer uploads documents via e-Proceedings portal
6. AU prepares draft assessment order (if additions/disallowances proposed)
7. NaFAC sends draft + Show Cause Notice (SCN) to taxpayer
8. Taxpayer files written reply (no physical hearing; video conference on request)
9. Review Unit (RvU) independently reviews — if agrees with AU, order finalized; if disagrees, sent to fresh AU
10. Final order issued electronically; demand appears in Pending Actions

**Key:** No face-to-face. Complete anonymity. Taxpayer doesn't know which city's AU handled.

---

## 6. ITR-U — CRITICAL CORRECTION

**Finance Act 2025 EXTENDED the window from 2 years to 4 years (48 months).**

### Updated Additional Tax Table
| Filing Window | Additional Tax Rate |
|---------------|---------------------|
| Within 12 months from end of relevant AY | **25%** of (tax + interest) |
| 12 to 24 months | **50%** of (tax + interest) |
| 24 to 36 months | **60%** of (tax + interest) |
| 36 to 48 months | **70%** of (tax + interest) |

**Cannot be filed if:**
- Search u/s 132 initiated
- Survey u/s 133A conducted
- Assessment/reassessment proceedings pending or completed
- Already filed ONE ITR-U for same AY (only one permitted)
- Section 148 notice issued
- Section 148A notice issued after 36 months (with one exception)
- Prosecution u/s 276C or 276CC initiated

**Cannot reduce tax or claim new refund. Must result in additional tax.**

---

## 7. Form Renaming — FINAL CORRECT LIST (IT Act 2025, from TY 2026-27)

⚠️ CORRECTION TO EARLIER DOCS: Form 27EQ → Form **142** (not 143 as previously stated)

| Old Form | New Form | Purpose |
|----------|----------|---------|
| Form 16 | **Form 130** | TDS certificate — salary |
| Form 16A | **Form 131** | TDS certificate — non-salary |
| Form 24Q | **Form 138** | Quarterly TDS return — salary |
| Form 26Q | **Form 140** | Quarterly TDS return — non-salary |
| Form 27EQ | **Form 142** | Quarterly TCS return |
| Form 27Q | **Form 144** | Quarterly TDS return — non-residents |
| Form 26AS | **Form 168** | Annual tax statement |
| Form 15G + 15H | **Form 121** (merged) | Non-deduction declaration |
| Form 12BB | **Form 124** | Employee investment declaration |
| Form 15CB | **Form 146** | CA certificate for foreign remittances |

**Transition rule:** Q4 FY 2025-26 TDS returns (Jan-Mar 2026) still use OLD forms (24Q, 26Q).
New form numbers apply ONLY from Q1 TY 2026-27 (first return due July 2026).

---

## 8. Budget 2025 — Tax Slabs CORRECTION

⚠️ CRITICAL: The new regime slabs in `tax_computation_rules.md` are WRONG (they were for AY 2024-25).
The correct slabs for **FY 2025-26 (AY 2026-27)** are:

### New Regime (Default) — Budget 2025 Revised
| Income Range | Tax Rate |
|-------------|----------|
| Up to ₹4,00,000 | NIL |
| ₹4,00,001 – ₹8,00,000 | 5% |
| ₹8,00,001 – ₹12,00,000 | 10% |
| ₹12,00,001 – ₹16,00,000 | 15% |
| ₹16,00,001 – ₹20,00,000 | 20% |
| ₹20,00,001 – ₹24,00,000 | 25% |
| Above ₹24,00,000 | 30% |

**Section 87A Rebate (New Regime FY 2025-26):**
- Full rebate up to income of **₹12,00,000** (was ₹7L in AY 2024-25)
- For income > ₹12L: no rebate
- Rebate NOT available on special rate income (LTCG, STCG on equity, VDA/crypto)

**Standard Deduction (New Regime FY 2025-26):**
- Salaried: **₹75,000** (was ₹50,000)
- Family pension: ₹25,000

### Old Regime — Unchanged
Slabs same as before. 87A rebate: income ≤ ₹5L, max ₹12,500.

### Capital Gains Changes (Finance Act 2024/2025)
| Type | Old Rate | New Rate |
|------|----------|----------|
| LTCG on listed equity (Sec 112A) | 10% (above ₹1L) | **12.5%** (above ₹1.25L) |
| STCG on listed equity (Sec 111A) | 15% | **20%** |
| LTCG on other assets | 20% with indexation | **12.5% without indexation** (for transfers after 23 Jul 2024) |

Indexation benefit removed for all assets transferred after **23 July 2024**.
For immovable property acquired BEFORE 23 Jul 2024: taxpayer may choose 20% with indexation OR 12.5% without (whichever is lower) under grandfathering provision.

### TDS Threshold Changes (Budget 2025) — CORRECTIONS
| Section | Old Threshold | New Threshold (FY 2025-26) |
|---------|-------------|--------------------------|
| 194A — Bank interest (non-senior) | ₹10,000 | **₹40,000** |
| 194A — Bank interest (senior citizen) | ₹50,000 | ₹50,000 (unchanged) |
| 194I — Rent | ₹2,40,000/year | **₹6,00,000/year** |
| 194J — Professional/technical fees | ₹30,000 | **₹50,000** |

---

## 9. SFT — Statement of Financial Transactions

**Filed by:** Banks, NBFCs, AMCs, stock exchanges, registrars, insurance companies, companies
**Form:** Form 61A (to be renumbered Form 237 under IT Rules 2026)
**Due date:** 31 May annually for prior FY transactions

### Key SFT Codes (appear in AIS Part B)
| Code | Transaction | Threshold |
|------|------------|-----------|
| SFT-001 | Cash deposit in savings account | ₹10L per year per bank |
| SFT-002 | Cash deposit in current/CC/OD accounts | ₹50L per year |
| SFT-006 | Fixed deposit with bank | ₹10L per year |
| SFT-007 | Credit card bill payment (cash) | ₹1L; other: ₹10L |
| SFT-008 | Mutual fund purchase | ₹10L per year |
| SFT-011 | Purchase of immovable property | ₹30L per transaction |
| SFT-012 | Sale of immovable property | ₹30L per transaction |
| SFT-013 | Cash receipt for goods/services | ₹2L per transaction |
| SFT-015 | Dividend | Practically all dividends reported |

**When AIS shows an SFT entry → check if we have matching income in our records → if not → CA must explain before filing.**

---

## 10. Income Tax Act 2025 — Transition Rules

### The Duality Problem
- **IT Act 1961:** Applies to ALL income up to FY 2025-26 (i.e., up to AY 2026-27)
- **IT Act 2025:** Applies from Tax Year 2026-27 (income from 1 April 2026 onwards)

Our system must handle BOTH simultaneously:
- A business filing AY 2026-27 in July 2026: uses IT Act 1961
- A business filing TY 2026-27 returns: uses IT Act 2025

**Section numbers change:** 143(1) → 270, 144B → (new number), 154 → 383.
When showing section references in the UI, show BOTH for transition period.

### New Concept: Tax Year vs Assessment Year
- Tax Year 2026-27 = income earned from 1 April 2026 to 31 March 2027
- Under IT Act 2025: no "Previous Year" + "Assessment Year" split
- Under IT Act 1961: still PY/AY for all pre-April 2026 income

Our Rule Engine must store BOTH `assessmentYear` (for 1961 Act) and `taxYear` (for 2025 Act) on TaxRuleSet.

---

## Summary: What Must Change in Our Docs Immediately

| Document | What to Fix |
|----------|------------|
| `tax_computation_rules.md` | New regime slabs WRONG — see Section 8 above |
| `tax_computation_rules.md` | 87A rebate limit is ₹12L (not ₹7L) |
| `tds_rate_chart.md` | 194I threshold: ₹6L (not ₹2.4L) |
| `tds_rate_chart.md` | 194A threshold: ₹40,000 (not ₹10,000) |
| `tds_rate_chart.md` | 194J threshold: ₹50,000 (not ₹30,000) |
| `tds_rate_chart.md` | Form 27EQ → Form 142 (not 143) |
| `compliance_calendar.md` | Form 27EQ → Form 142 |
| `schema_additions_needed.md` | Add Form 121 (merged 15G/15H) to TdsCertificate |
| `ARCHITECTURE_REVIEW.md` | ITR-U is 48 months, 4 bands (25/50/60/70%) |
| All docs | AIS feedback has 6 types (document above) |
| All docs | Form 168 = new name for 26AS from TY 2026-27 |
| All docs | Dual Act handling: 1961 Act for AY ≤ 2026-27, 2025 Act for TY ≥ 2026-27 |
