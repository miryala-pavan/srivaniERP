# Compliance Calendar — India Income Tax & Related

> This drives the automated deadline reminders in the IT module.
> All dates below are for a standard FY (April 1 – March 31).
> If a deadline falls on a public holiday, it shifts to the next working day.

---

## Monthly Recurring Deadlines

| Day | Obligation | Section | Who |
|-----|-----------|---------|-----|
| 7th | TDS/TCS deposit (Apr–Feb deductions) | 200/204 | All deductors |
| 10th | GSTR-7 (TDS under GST) | GST | Specified deductors |
| 11th | GSTR-1 (outward supplies, turnover > 5Cr) | GST | Regular dealers |
| 13th | GSTR-1 (QRMP scheme) | GST | Quarterly filers |
| 13th | IFF (Invoice Furnishing Facility, QRMP) | GST | Quarterly filers |
| 20th | GSTR-3B (monthly return) | GST | Monthly filers |
| 25th | PMT-06 challan (QRMP scheme) | GST | Quarterly filers |
| 28th | GSTR-11 (UIN holders) | GST | Unique ID holders |

---

## Quarterly TDS Return Deadlines

| Quarter | Period | TDS Return Due | Correction window |
|---------|--------|---------------|------------------|
| Q1 | Apr 1 – Jun 30 | **31 July** | Within 1 year of original |
| Q2 | Jul 1 – Sep 30 | **31 October** | |
| Q3 | Oct 1 – Dec 31 | **31 January** | |
| Q4 | Jan 1 – Mar 31 | **31 May** | |

Forms (TY 2026-27 new names): **Form 138** (salary), **Form 140** (non-salary), **Form 144** (non-resident), **Form 142** (TCS)
Old names for reference: 24Q, 26Q, 27Q, 27EQ
Note: Form 16A → **Form 131** | Form 26AS → **Form 168** | Form 15G/15H merged into **Form 121**
Transition: Q4 FY 2025-26 (Jan–Mar 2026) still uses OLD forms. New forms from Q1 TY 2026-27 onwards.

---

## Advance Tax Deadlines

> Applicable when tax liability > ₹10,000 after TDS deduction.
> Partnerships and companies: same schedule.

| Installment | Due Date | Cumulative % |
|------------|----------|-------------|
| 1st | **15 June** | 15% of estimated tax |
| 2nd | **15 September** | 45% of estimated tax |
| 3rd | **15 December** | 75% of estimated tax |
| 4th | **15 March** | 100% of estimated tax |

### Interest on Advance Tax (Section 234C)
Shortfall below each percentage triggers 1% per month interest:
- Not paid 15% by 15 June → 1% for 3 months on shortfall
- Not paid 45% by 15 Sep → 1% for 3 months on shortfall
- Not paid 75% by 15 Dec → 1% for 3 months on shortfall
- Not paid 100% by 15 Mar → 1% per month until paid (Section 234B)

### Section 234B — Interest for Non-Payment of Advance Tax
If advance tax paid < 90% of assessed tax:
- 1% per month from April 1 of assessment year until payment date

### Section 234A — Interest for Late Filing of ITR
- 1% per month from original due date to actual filing date on tax payable

---

## Annual Compliance Deadlines

### Income Tax Returns (ITR)

| Category | Due Date | Form |
|----------|----------|------|
| Individual/HUF (no audit) | **31 July** | ITR-1/2/3/4 |
| Partnership firm (no audit) | **31 July** | ITR-5 |
| Tax audit cases (turnover > 1Cr or 10Cr) | **31 October** | ITR-3/5/6 |
| Transfer pricing cases | **30 November** | |
| Belated return (with penalty) | **31 December** | Any ITR |
| Updated return (with additional tax) | Within **4 years** of AY end (Finance Act 2025) | ITR-U |

### Tax Audit Reports

| Report | Due Date | Who |
|--------|----------|-----|
| Form 3CA + 3CD (existing business, mandatory audit) | **30 September** | CA certifying |
| Form 3CB + 3CD (first-time audit or non-mandatory) | **30 September** | CA certifying |
| Form 29B (MAT, companies only) | With ITR | CA certifying |

**Audit threshold (Section 44AB):**
- Business income: Turnover > ₹1 crore (₹10 crore if 95%+ transactions are digital)
- Professionals: Gross receipts > ₹50 lakh
- Presumptive opt-out: If 44AD/44ADA opted then opted out before 5 years

### GST Annual Returns

| Return | Due Date | Who |
|--------|----------|-----|
| GSTR-9 (annual return) | **31 December** | Turnover > 2Cr |
| GSTR-9C (reconciliation/audit) | **31 December** | Turnover > 5Cr |
| GSTR-4 (composition annual return) | **30 June** | Composition dealers |

### Other Annual Filings

| Filing | Due Date | Who |
|--------|----------|-----|
| Equalization levy statement (Form 1) | 30 June | Businesses paying to foreign digital cos |
| Statement of financial transactions (SFT / Form 61A) | 31 May | Banks, registrars, MF (not usually businesses) |
| Directors' report (companies) | AGM date | Companies only |
| ROC annual return (companies/LLPs) | 60 days from AGM | Companies/LLPs only |

---

## Deadline Alert System (For IT Module)

The system should send alerts:
- **30 days before:** Major annual deadlines (ITR, audit report, advance tax)
- **7 days before:** All deadlines (TDS deposit, GST, quarterly TDS returns)
- **1 day before:** All pending deadlines
- **Day of:** Last call alert
- **Overdue:** Interest/penalty calculation starts immediately

Alert recipients:
- Owner / business admin
- Assigned CA (if any)
- Configurable via notification settings

---

## Penalties Quick Reference

| Violation | Penalty |
|-----------|---------|
| Late TDS deposit | 1.5%/month from deduction date (Sec 201(1A)) |
| Non-deduction of TDS | Interest 1%/month + penalty up to TDS amount |
| Late TDS return | ₹200/day (max = TDS amount) (Sec 234E) |
| Incorrect TDS return | ₹10K–₹1L (Sec 271H) |
| Late ITR (income ≤ 5L) | ₹1,000 (Sec 234F) |
| Late ITR (income > 5L) | ₹5,000 (Sec 234F) |
| Advance tax shortfall | 1%/month on shortfall per installment (Sec 234C) |
| Net advance tax < 90% | 1%/month from April 1 (Sec 234B) |
| Late ITR filing | 1%/month from due date on tax payable (Sec 234A) |
| Under-reporting income | 50% of tax on under-reported income (Sec 270A) |
| Misreporting income | 200% of tax on misreported income (Sec 270A) |
| Not getting audit done | Lower of ₹1.5L or 0.5% of turnover (Sec 271B) |
| Late GSTR-9 | ₹200/day (₹100 CGST + ₹100 SGST) max 0.25% of turnover |
