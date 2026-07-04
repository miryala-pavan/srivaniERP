# ITR Form Selection Guide

> Determines which form to file based on income type and entity type.
> The IT setup wizard should auto-select and explain the choice.

---

## Selection Decision Tree

```
Entity type?
├── Individual / HUF
│   ├── Only salary + bank interest (no business) → ITR-1 (Sahaj)
│   ├── Capital gains OR foreign income OR multiple properties → ITR-2
│   ├── Business / professional income (regular books) → ITR-3
│   └── Business / professional income (presumptive) → ITR-4 (Sugam)
│
├── Partnership Firm / LLP → ITR-5
├── Company → ITR-6 (not in scope v1)
└── Trust / AOP / BOI → ITR-7 (not in scope v1)
```

---

## ITR-1 (Sahaj)

| Criteria | Details |
|----------|---------|
| Eligible for | Resident individuals ONLY |
| Income sources | Salary + one house property + other sources (interest) |
| Agricultural income | Up to ₹5,000 |
| Income limit | Up to ₹50 lakh total income |
| NOT for | Business income, capital gains, foreign income, director in company |
| Regime | Old or new |

---

## ITR-2

| Criteria | Details |
|----------|---------|
| Eligible for | Individual + HUF |
| Income sources | Salary, multiple house properties, capital gains, foreign income |
| NOT for | Business / professional income (use ITR-3) |
| When to use | If ITR-1 doesn't qualify |

---

## ITR-3 (Most Common for Business Owners)

| Criteria | Details |
|----------|---------|
| Eligible for | Individual + HUF with business / professional income (NOT presumptive) |
| When to use | Regular books of accounts; turnover > threshold; opted out of 44AD before 5 years |
| Includes | All income heads: salary, house property, business, capital gains, other |
| Audit required | If turnover > ₹1Cr (₹10Cr digital) or opted out of presumptive after 5 years |

**Schedules in ITR-3 (key ones):**
- Schedule BP: Business/profession income (P&L summary)
- Schedule BS: Balance sheet
- Schedule DEP: Depreciation
- Schedule CYLA/BFLA: Current year + brought forward losses
- Schedule CG: Capital gains
- Schedule OS: Other sources
- Schedule VIA: Chapter VI-A deductions
- Schedule AMT: Alternate minimum tax
- Schedule IT: Advance tax and self-assessment payments
- Schedule TDS1/TDS2: TDS details from 26AS
- Schedule FA: Foreign assets (if any)
- Schedule AL: Assets and liabilities (if income > ₹50L)

---

## ITR-4 (Sugam) — Presumptive

| Criteria | Details |
|----------|---------|
| Eligible for | Individual, HUF, Firm (NOT LLP) |
| Business income | Section 44AD (turnover ≤ ₹3Cr with 95% digital, or ₹2Cr otherwise) |
| Professional income | Section 44ADA (receipts ≤ ₹75L / ₹50L) |
| Transport | Section 44AE (up to 10 goods carriages) |
| NOT for | Capital gains, foreign income, partner in firm, director in company |
| Simplification | No detailed P&L/balance sheet required |

---

## ITR-5 — Firms, LLPs, AOPs

| Criteria | Details |
|----------|---------|
| Eligible for | Partnership firm, LLP, AOP, BOI, cooperative society |
| Key schedules | Schedule BP, BS, DEP, partners' info |
| Partners' income | Salary/interest to partners: deducted in firm's ITR-5 |
| Partner files | Separately in ITR-3 or ITR-2 (partner's share of profit is EXEMPT) |
| Audit | If firm turnover > ₹1Cr (₹10Cr digital) |

### ITR-5 Partner Schedule (must fill for each partner)
- Partner name, PAN
- Capital balance at beginning and end
- Profit sharing ratio
- Salary paid (under 40(b))
- Interest paid (under 40(b))
- Share of profit (exempt in partner's hands)

---

## Auto-Selection Logic for IT Module

```typescript
function selectItrForm(entityType, hasBusinessIncome, isPresumptive, hasCapitalGains, hasForeignIncome, itr3Opted): string {
  if (entityType === 'PARTNERSHIP' || entityType === 'LLP') return 'ITR-5';
  if (entityType === 'HUF' || entityType === 'PROPRIETORSHIP') {
    if (!hasBusinessIncome && !hasCapitalGains && !hasForeignIncome) return 'ITR-1'; // if income < 50L
    if (!hasBusinessIncome) return 'ITR-2'; // capital gains, no business
    if (isPresumptive && !itr3Opted) return 'ITR-4';
    return 'ITR-3';
  }
}
```

---

## Filing Modes

| Mode | Description | Who |
|------|-------------|-----|
| Self filing on portal | incometaxindiaefiling.gov.in | Any taxpayer |
| CA filing (with DSC) | CA logs in as ERI, files on behalf | CA with ERI registration |
| JSON offline utility | Download XML/JSON prefill, fill offline, upload | Power users |
| Third-party software JSON | Generate ITR JSON, upload to portal | Via software like ClearTax, Gen IT |

### ITR JSON Schema
The IT portal accepts a JSON file with the exact ITR structure. The file is:
- Downloaded as a template from portal
- Filled by software
- Validated against schema
- Uploaded by taxpayer or ERI

Our system must generate this JSON correctly. See `05_api_research/itr_json_schema.md`.

---

## Pre-Filing Checklist

Before filing, ensure:
- [ ] Form 26AS downloaded and reconciled
- [ ] AIS (Annual Information Statement) reviewed
- [ ] All TDS credits match 26AS
- [ ] All advance tax challans entered
- [ ] Depreciation computed (IT Act rates)
- [ ] Partner salary/interest computed (for firms)
- [ ] Losses from previous years checked (Schedule BFLA)
- [ ] Chapter VI-A deductions documents collected
- [ ] Bank account validated on portal (for refund)
- [ ] Aadhaar-PAN linked (mandatory for individuals)
- [ ] CA sign-off completed (if applicable)
