# Decisions Log

> All architecture decisions locked before build starts.
> Format: Decision → Impact on build.

---

## Architect Recommendations (from README)
| # | Decision | Choice |
|---|----------|--------|
| Q1 | Target CA profile | Solo CA 10–20 clients (v1), CA firm (v2) |
| Q2 | Multi-client CA view | YES — mandatory for v1 |
| Q3 | Salary / other income | Follow IT Act rules fully |
| Q4 | GST composition scheme | Full support |
| Q5 | Advance received | Liability, flag if > 90 days |
| Q6 | Testing | Local first, always |

---

## User Decisions (July 2026)

### D1: Expense Ledger
**Decision: Full expense module**

Build a complete `Expense` model in the ERP. Owner enters all non-purchase expenses:
rent, utilities, salaries, repairs, professional fees, insurance, advertising, etc.

System maps each `ExpenseCategory` to:
- IT Act treatment (revenue vs capital)
- TDS obligation (194C, 194J, 194IB, etc.)
- 43B applicability (PF, bonus, MSME)
- 40A(3) cash limit check

**Build impact:**
- Add `Expense` model and `ExpenseCategory` enum (see schema_additions_needed.md)
- Build Expense entry UI (similar to Purchase entry — date, amount, mode, vendor)
- Add expense categories to TDS detection engine
- Expense total feeds into P&L computation

---

### D2: Personal Income
**Decision: Add to ERP — Personal Income section in IT module**

For proprietors and HUF karta, add a "Personal Income" section that collects:
- Salary from another employer (upload Form 16 or manual entry)
- House property: rent received, interest on home loan (24b deduction)
- Other sources: bank FD interest, savings interest, dividends

This is combined with business income to produce full ITR-3.

**Build impact:**
- Add `PersonalIncome` model (not yet in schema — add in next revision)
- Add `HouseProperty` model for rental income / 24(b) deduction
- Add UI section inside IT module: "Personal Income & Deductions"
- System combines: Business Income + Personal Income + Deductions = GTI
- Note: This section only appears for PROPRIETORSHIP and HUF entity types

---

### D3: Partner ITRs
**Decision: Generate partner certificate only (v1)**

The IT module handles firm-level ITR-5 only.
For each working partner, generate a certificate PDF showing:
- Partner name and PAN
- Profit sharing ratio
- Share of profit (exempt — not taxable in partner's hands)
- Salary received from firm (taxable under "profits from firm")
- Interest on capital received from firm (taxable as "other sources")

Partners take this certificate to their own CA or file independently.
Full partner individual ITR support → v2 roadmap.

**Build impact:**
- Partner certificate PDF generator (reportlab-style or HTML-to-PDF)
- CA can download all partner certificates in one click
- Link in filing history: "Download Partner Certificates"

---

### D4: Year Coverage
**Decision: Current + 1 past year**

Support at launch:
- AY 2025-26 (FY 2025-26: Apr 2025 – Mar 2026) — current year
- AY 2024-25 (FY 2024-25: Apr 2024 – Mar 2025) — for belated/revised returns

Notes:
- Different slabs for each AY are already coded in computation engine
- AY 2024-25 original due date passed (Jul 2025) but belated filing possible till Dec 2025
- Revised return for AY 2024-25 possible till Dec 2025
- Must maintain separate `ItReturn` record per businessId + assessmentYear

**Build impact:**
- AY selector in IT dashboard (dropdown: AY 2024-25 | AY 2025-26)
- Computation engine takes `assessmentYear` parameter, loads correct slabs
- Each return record is per (businessId, assessmentYear) — not just per business
- Carry-forward losses from AY 2024-25 auto-populate into AY 2025-26 BFLA schedule

---

## Remaining Open Decisions (Low Priority — Decide Before Building That Feature)

| Item | Status | When to decide |
|------|--------|----------------|
| Housing loan interest (24b) | Open | When building HouseProperty model |
| Capital gains (shares/MF) | v2 | Before v2 build |
| Private Limited support | v2 | Before v2 build |
| ERI registration | v2 | After product-market fit |
| NSDL PAN verification API | v2 | When premium tier is built |
| AIS reconciliation | v1.5 | After basic filing works |
| Demand notice tracker | v1 | Low effort — add with CA dashboard |
