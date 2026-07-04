# Tax Computation Rules — Indian Income Tax

> Covers: Old regime vs New regime, surcharge, cess, rebate, partnership firm tax, HUF.
> Reference for the Computation Engine (to be built in Phase 5).

---

## Entity Type → Tax Treatment Mapping

| Entity Type | Tax Treatment | Applicable Slab |
|-------------|---------------|----------------|
| Proprietorship | Treated as individual's income | Individual slabs |
| HUF | Separate assessable entity | HUF slabs (same as individual) |
| Partnership Firm | Firm taxed at flat rate | 30% flat |
| LLP | LLP taxed at flat rate | 30% flat |
| Private Limited | Company tax | 22%/25%/30% (not in scope v1) |

---

## Individual / HUF — Regime Selection

From AY 2024-25 (FY 2023-24), **new regime is the default**.
Taxpayer must opt OUT to use old regime (Form 10-IEA for business income holders).
Once opted out from new regime for business income: opt-back is NOT allowed (once in a lifetime switch back).

---

## NEW REGIME Slabs

### AY 2026-27 (FY 2025-26) — Budget 2025 Revised ← USE THESE
| Income Range | Rate |
|-------------|------|
| Up to ₹4,00,000 | NIL |
| ₹4,00,001 – ₹8,00,000 | 5% |
| ₹8,00,001 – ₹12,00,000 | 10% |
| ₹12,00,001 – ₹16,00,000 | 15% |
| ₹16,00,001 – ₹20,00,000 | 20% |
| ₹20,00,001 – ₹24,00,000 | 25% |
| Above ₹24,00,000 | 30% |

**Section 87A Rebate (New Regime AY 2026-27):**
- If total income ≤ **₹12,00,000** → Full rebate (tax = 0)
- NOT available on special rate income (LTCG u/s 112A, STCG u/s 111A, VDA/crypto)

### AY 2025-26 (FY 2024-25) — For historical / prior year returns
| Income Range | Rate |
|-------------|------|
| Up to ₹3,00,000 | NIL |
| ₹3,00,001 – ₹7,00,000 | 5% |
| ₹7,00,001 – ₹10,00,000 | 10% |
| ₹10,00,001 – ₹12,00,000 | 15% |
| ₹12,00,001 – ₹15,00,000 | 20% |
| Above ₹15,00,000 | 30% |
- 87A rebate: income ≤ ₹7L, max ₹25,000

**Standard Deduction (New Regime AY 2026-27):**
- Salary income: ₹75,000 (increased from ₹50,000 in AY 2025-26)
- Business income: NOT available
- Family pension: ₹25,000

**NOT allowed in new regime:**
- Section 80C, 80D, 80E, 80G, 80TTA, 80TTB etc.
- HRA exemption
- LTA exemption
- Interest on housing loan (Sec 24(b)) — EXCEPT let-out property
- Professional tax

**Allowed in new regime:**
- Chapter VI-A deductions: 80JJAA (new employees), 80CCD(2) (employer NPS)
- Family pension standard deduction
- Transport allowance for specially abled

---

## OLD REGIME Slabs (AY 2024-25)

### Individual (Age < 60)
| Income Range | Rate |
|-------------|------|
| Up to ₹2,50,000 | NIL |
| ₹2,50,001 – ₹5,00,000 | 5% |
| ₹5,00,001 – ₹10,00,000 | 20% |
| Above ₹10,00,000 | 30% |

### Senior Citizen (Age 60–80)
| Income Range | Rate |
|-------------|------|
| Up to ₹3,00,000 | NIL |
| ₹3,00,001 – ₹5,00,000 | 5% |
| ₹5,00,001 – ₹10,00,000 | 20% |
| Above ₹10,00,000 | 30% |

### Super Senior Citizen (Age > 80)
| Income Range | Rate |
|-------------|------|
| Up to ₹5,00,000 | NIL |
| ₹5,00,001 – ₹10,00,000 | 20% |
| Above ₹10,00,000 | 30% |

**Section 87A Rebate (Old Regime):**
- If total income ≤ ₹5,00,000 → Rebate of lesser of tax or ₹12,500

---

## Surcharge

| Income Range | Old Regime | New Regime |
|-------------|-----------|-----------|
| Up to ₹50,00,000 | NIL | NIL |
| ₹50,00,001 – ₹1,00,00,000 | 10% | 10% |
| ₹1,00,00,001 – ₹2,00,00,000 | 15% | 15% |
| ₹2,00,00,001 – ₹5,00,00,000 | 25% | 25% |
| Above ₹5,00,00,000 | 37% | **25% (max)** |

**Marginal Relief:** When surcharge causes tax > income above threshold. Complex computation needed.

---

## Health & Education Cess
**4%** on (Basic Tax + Surcharge)
No ceiling. Applied to all entities.

---

## Alternate Minimum Tax (AMT) — Section 115JC
For non-corporate taxpayers (proprietorship, HUF, partnership, LLP):
- If regular tax < 18.5% of "adjusted total income" (income before Chapter VI-A deductions)
- AMT = 18.5% of adjusted total income + surcharge + cess
- AMT credit carried forward for 15 years (Section 115JD)
- Applies only if adjusted total income > ₹20 lakh

---

## Partnership Firm Tax

| Item | Rate |
|------|------|
| Tax on firm's income | **30% flat** |
| Surcharge (income > 1 Cr) | 12% |
| Health & Education Cess | 4% |
| No 87A rebate | Firms not eligible |
| No regime choice | Always at 30% |

**Section 40(b) — Deductible payments to partners:**

*Salary/remuneration to working partners:*
| Book profit | Maximum salary deductible |
|------------|--------------------------|
| First ₹3,00,000 of book profit | ₹1,50,000 or 90% of book profit (whichever is more) |
| On balance book profit | 60% |
| If book profit is negative | ₹1,50,000 |

**Book profit** = net profit after all adjustments BEFORE deducting partner salary.
Only "working partners" are eligible; sleeping partners cannot receive salary.

*Interest on capital to partners:*
- Maximum deductible: **12% per annum** on capital balance
- If partnership deed specifies higher → excess disallowed in firm (taxable as firm income)
- Interest received by partner: taxable in partner's hands as "profits from firm"
- Salary received by partner: taxable as "profits from firm" (Schedule BP)

*Partner's share of profit (after salary and interest):*
- **EXEMPT** in partner's hands (no double taxation)
- Already taxed in firm's hands

---

## Section 44AD — Presumptive Taxation for Businesses

| Item | Rule |
|------|------|
| Eligible | Individual, HUF, Firm (not LLP) |
| Turnover limit | ≤ ₹2 crore (₹3 crore if 95%+ digital payments) |
| Deemed profit | 8% of turnover (6% for digital receipts) |
| Books | NOT required to maintain |
| Audit | NOT required |
| ITR form | ITR-4 (Sugam) |
| Regime restriction | Can use old or new regime |
| 5-year lock-in | If opted out before 5 years, must get audit done for 5 subsequent years |

**Cannot opt 44AD if:**
- Plying, hiring, leasing of goods carriages (use 44AE)
- Agency business
- Commission income
- LLP (use regular ITR-5)
- Turnover > threshold

---

## Section 44ADA — Presumptive for Professionals

| Item | Rule |
|------|------|
| Eligible professionals | Doctor, Lawyer, Engineer, CA, Architect, Consultant |
| Gross receipts limit | ≤ ₹50 lakh (₹75 lakh if 95%+ digital receipts) |
| Deemed profit | 50% of gross receipts |
| ITR form | ITR-4 |

---

## Chapter VI-A Deductions (Old Regime Only)

| Section | Description | Max Deduction |
|---------|-------------|--------------|
| 80C | LIC, PPF, NSC, ELSS, home loan principal, tuition fees | ₹1,50,000 |
| 80CCC | Pension fund contribution | Within 80C limit |
| 80CCD(1) | Employee NPS contribution | Within 80C limit |
| 80CCD(1B) | Additional NPS (self) | ₹50,000 (over 80C) |
| 80CCD(2) | Employer NPS contribution | 10% of salary (allowed in new regime too) |
| 80D | Health insurance premium | ₹25K (self); ₹50K (senior citizen parent) |
| 80DD | Disabled dependant medical | ₹75K or ₹1.25L (severe) |
| 80DDB | Specified disease treatment | ₹40K or ₹1L (senior citizen) |
| 80E | Education loan interest | Actual (8 years) |
| 80EE | First home loan interest | ₹50,000 (additional over 24b) |
| 80G | Donations (50%/100% as specified) | 10% of adjusted GTI |
| 80GGA | Scientific research donations | 100% or 125% as specified |
| 80GGC | Political party donation | 100% |
| 80IA/IB | Industrial undertaking profit | As per section |
| 80P | Cooperative society income | Various |
| 80TTA | Savings interest (non-senior) | ₹10,000 |
| 80TTB | Interest (senior citizen) | ₹50,000 |
| 80U | Physically handicapped taxpayer | ₹75K or ₹1.25L (severe) |

---

## Tax Computation Sequence

```
1. Gross Total Income (GTI)
   = Business Income (P&L after IT Act adjustments)
   + Salary Income (if any)
   + House Property Income (rent − 30% − interest)
   + Capital Gains (STCG/LTCG per section)
   + Other Sources (interest, dividends, etc.)

2. Deductions (Old Regime only)
   = GTI − Chapter VI-A deductions
   = Total Income (TI)

3. Tax on TI (apply slabs)
4. Add: Surcharge (if applicable)
5. Add: Cess (4%)
6. Less: Rebate u/s 87A (if applicable)
7. Less: Relief u/s 89 (salary arrears, if applicable)
8. Less: Tax deducted at source (from Form 26AS)
9. Less: Advance tax paid
10. Less: MAT/AMT credit (if applicable)
11. = Tax Payable / Refundable
12. Add: Interest u/s 234A, 234B, 234C (if applicable)
13. = Total tax demand / refund
```

---

## Capital Gains (To be built in v2 but referenced here)

| Type | Holding | Rate (AY 2026-27) | Notes |
|------|---------|-------------------|-------|
| STCG on listed equity/MF (Sec 111A) | < 12 months | **20%** | Was 15% before Finance Act 2024 |
| LTCG on listed equity (Sec 112A) | ≥ 12 months | **12.5%** above ₹1.25L | Was 10% above ₹1L |
| STCG on other assets | < 24/36 months | Slab rate | Unchanged |
| LTCG on other assets (post 23 Jul 2024) | ≥ 24/36 months | **12.5% — no indexation** | |
| LTCG on immovable property (acquired before 23 Jul 2024) | ≥ 24 months | Lower of: 12.5% (no indexation) OR 20% (with indexation) | Grandfathering clause |

> Finance Act 2024 removed indexation for ALL assets transferred after 23 July 2024.
> For real estate acquired before that date, taxpayer may choose the more beneficial option.
