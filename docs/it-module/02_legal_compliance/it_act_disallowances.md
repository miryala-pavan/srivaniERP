# IT Act Disallowances — Section Reference

> These are amounts that appear in the P&L but are NOT deductible under IT Act.
> The computation engine must add these back to arrive at taxable business income.
> Each disallowance requires a data hook in the ERP to capture the triggering transaction.

---

## Section 40A(3) — Cash Payments > ₹10,000

| Rule | Detail |
|------|--------|
| Limit | ₹10,000 per day per person (₹35,000 for transport) |
| Disallowance | 100% of the payment exceeding limit |
| Applies to | Any expenditure (not for salary, TDS-deducted payments, or to banks) |
| Data hook | Every cash payment in ERP — flag if single transaction > ₹10,000 to same party same day |
| Common triggers | Cash purchases from suppliers, cash advance to employees |

**Exceptions to 40A(3):**
- Payments to RBI, LIC, Central/State Govt banks
- Payments that trigger 40A(3A) — where goods are produced by cultivators
- Salary payment (Section 40A(3) does NOT apply to salary)
- Payment via account payee cheque/DD/bank transfer/NEFT/RTGS/UPI

**ERP Integration:**
Every payment > ₹10,000 in cash should automatically be flagged in the IT module
with the 40A(3) disallowance amount pre-filled.

---

## Section 43B — Deductible Only on Payment (Cash Basis)

These items are deductible ONLY in the year they are ACTUALLY PAID,
not in the year they are accrued/provided for.

| Item | Section | Note |
|------|---------|------|
| Employee PF, ESI, gratuity contributions | 43B(b) | Must pay to fund before ITR due date |
| Bonus and commission to employees | 43B(c) | Must pay before filing ITR |
| Interest on loans from banks/public financial institutions | 43B(d) | Actual payment date governs |
| Interest on loans from scheduled banks | 43B(e) | Same as above |
| Leave encashment | 43B(f) | Must pay before ITR due date |
| Payments to MSME vendors | 43B(h) — from AY 2024-25 | Within 45 days (if agreement) or 15 days (if no agreement) of invoice |
| Custom duty, GST, cess paid | 43B | If paid before ITR due date |

### MSME Payment Rule (43B(h)) — Added Finance Act 2023
- If supplier is MSME registered (UDYAM registration)
- Payment terms in agreement: must pay within 45 days
- No agreement on terms: must pay within 15 days
- If not paid within limit → deduction disallowed in that year; allowed in year of payment
- **ERP Integration:** For MSME suppliers, track invoice date + payment date. Flag if > 15/45 days.
- Store `isMsme` and `msmeUdyamNumber` on Supplier model.

### Computation of 43B disallowance
```
Outstanding balance at year-end for each 43B item:
- PF/ESI payable but not paid = disallow this amount
- Bonus payable but not paid (if paid after ITR due date) = disallow
- MSME invoices unpaid beyond time limit = disallow
```

---

## Section 40(a) — Disallowance for TDS Default

| Rule | Detail |
|------|--------|
| If TDS not deducted | 30% of payment disallowed in the year of payment |
| If TDS deducted but not deposited | 30% disallowed until deposited |
| When deposited | Allowed as deduction in the year of deposit |
| Exception | If payee has included the income in their ITR and paid tax (Form 26A certificate) |
| Data hook | Every payment where TDS was flagged but not deducted → carry to disallowance |

---

## Section 14A — Disallowance for Exempt Income Expenses

If business earns exempt income (dividends, MF returns, partner's share of profit):
- Expenses incurred to earn that exempt income must be disallowed
- Method: Rule 8D formula (8D(2)(i) + 8D(2)(ii) + 8D(2)(iii))
- For most small businesses: usually not applicable unless they hold shares/MFs

---

## Section 37(1) — Capital vs Revenue Expenditure

| Revenue expense (deductible) | Capital expense (NOT deductible) |
|-----------------------------|---------------------------------|
| Day-to-day repairs | Major renovation that adds new asset |
| Annual subscription fees | One-time software license (capitalize) |
| Vehicle servicing | Major engine overhaul (capitalize) |
| Advertising (routine) | Brand development (long-term asset) |

**Rule of thumb:** Does it create an asset that lasts > 1 year? → Capital (add to asset block)

---

## Section 35 — Scientific Research Expenditure (Specific)

Businesses paying for in-house R&D or approved institutions get weighted deductions.
Not common for retail but may apply to ERP software development.

---

## Section 36 — Specific Deductions Allowed

| Section | What's deductible |
|---------|------------------|
| 36(1)(i) | Insurance premium on stocks |
| 36(1)(ii) | Bonus to employees (if paid before ITR due date — see 43B) |
| 36(1)(iii) | Interest on capital borrowed for business |
| 36(1)(va) | Employee PF/ESI (see 43B — if paid before due date of return) |
| 36(1)(vii) | Bad debts written off (only if previously recognised as income) |
| 36(2) | Stock in trade loss allowed |

### Bad Debts (36(1)(vii)):
- Deductible when written off in books
- Must have been previously included as income
- Recovery later → taxable in year of recovery
- ERP: Track bad debt write-offs from Accounts Receivable

---

## Common Disallowances Summary (For Computation Engine)

| Source | Auto-detected from ERP? | Manual entry needed? |
|--------|------------------------|---------------------|
| Cash payments > 10K | ✅ Flag in payments | No |
| 43B — PF/ESI unpaid | ✅ From payroll | Review |
| 43B — Bonus unpaid | ✅ From payroll | Confirm payment date |
| 43B — MSME unpaid | ✅ From payables + supplier flag | Set supplier MSME status |
| TDS default (40(a)) | ✅ From TDS detection | Confirm deduction |
| Depreciation diff | ✅ Auto from asset register | N/A |
| 40A(3) cash | ✅ From payments | Confirm cash mode |
| Capital expenditure | ❌ | CA must classify borderline items |
| 14A exempt income | ❌ | Manual if exempt income earned |
| Partner salary excess | ✅ Compute from book profit | Verify partnership deed |
| Partner interest excess (>12%) | ✅ From capital accounts | N/A |

---

## Section 43CA — Business Asset Sale at Below Stamp Duty Value

If land/building sold for less than stamp duty value (SDV):
- SDV is treated as actual consideration (higher value)
- Difference is taxable as business income
- Tolerance: up to 10% below SDV is allowed (Finance Act 2021 amendment)
- Usually not applicable to retail stores but relevant if entity owns the shop building

---

## Section 56(2)(x) — Gifts / Property Received Without Consideration

If business (or proprietor) receives property without consideration or at below FMV:
- Excess (FMV − consideration) is taxable as "Income from Other Sources"
- Threshold: > ₹50,000 aggregate in a year
- Common case: Free samples received, gifts from vendors
- Data hook: ERP receipts with zero payment should be flagged for review
