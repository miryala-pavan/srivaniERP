# TDS Rate Chart — India (FY 2025-26 / TY 2026-27)

> Reference for auto-detection engine. Rates are for non-PAN cases: add surcharge + cess.
> All thresholds are per FY unless stated otherwise.
>
> ⚠️ FORM RENAMING (Income Tax Act 2025, effective TY 2026-27):
> Old 24Q → **Form 138** | Old 26Q → **Form 140** | Old 27EQ → **Form 142** | Old 27Q → **Form 144**
> Old Form 16 → **Form 130** | AIS has largely replaced Form 26AS
> Use new names in all code, UI labels, and return filing references.

## Core Business Sections

### Section 192 — Salary
| Item | Rate |
|------|------|
| Rate | Applicable slab rate (estimated annual income) |
| Threshold | Tax liability > 0 after standard deduction |
| Deposit deadline | 7th of next month (March: 30th April) |
| Return | Form 24Q — quarterly |
| Notes | Employer computes projected tax and deducts monthly. Include allowances, perquisites. |

### Section 194A — Interest (Other Than on Securities)
| Item | Rate |
|------|------|
| Rate | 10% |
| No-PAN rate | 20% |
| Threshold (FY 2025-26 Budget 2025) | > **₹40,000**/year (banks); > **₹5,000**/year (others) |
| (Previous threshold) | ₹10,000 for banks (increased to ₹40,000 from FY 2025-26) |
| Return | Form 26Q |
| Common payers | Banks, NBFCs, cooperative societies, companies |
| Notes | Senior citizens: ₹50,000 bank threshold. FD interest: TDS if cumulative > threshold. |

### Section 194C — Contractors
| Item | Rate |
|------|------|
| Rate (Individual/HUF) | 1% |
| Rate (Others) | 2% |
| No-PAN rate | 20% |
| Threshold | Single payment > ₹30,000 OR aggregate > ₹1,00,000 in FY |
| Return | Form 26Q |
| Covers | Transport, labour, printing, advertising, catering, civil works |
| Transporter exemption | PAN registered transporter: 0% (self-declaration required) |
| Notes | Sub-contractors count. If shop pays delivery agency > threshold → TDS applies. |

### Section 194D — Insurance Commission
| Item | Rate |
|------|------|
| Rate | 5% (individual), 10% (company) |
| Threshold | > ₹15,000 in FY |
| Return | Form 26Q |

### Section 194H — Commission or Brokerage
| Item | Rate |
|------|------|
| Rate | 5% |
| No-PAN rate | 20% |
| Threshold | > ₹15,000 in FY |
| Return | Form 26Q |
| Covers | Commission to agents, distributors, channel partners |
| Notes | Does NOT cover brokerage on securities (194D). |

### Section 194I — Rent
| Item | Rate |
|------|------|
| Rate — Land, Building, Furniture, Fittings | 10% |
| Rate — Plant, Machinery, Equipment | 2% |
| No-PAN rate | 20% |
| Threshold (FY 2025-26 Budget 2025) | > **₹6,00,000 per year** (₹50,000/month) |
| (Previous threshold) | ₹2,40,000/year — increased to ₹6L from FY 2025-26 |
| Return | Form 26Q |
| Notes | Monthly threshold check: if annual rent > 2.4L, TDS on each payment. Advance rent also covered. |

### Section 194IB — Rent by Individual/HUF (not liable for tax audit)
| Item | Rate |
|------|------|
| Rate | 5% |
| No-PAN rate | 20% |
| Threshold | Rent > ₹50,000 per month |
| Return | Form 26QC (unique: challan-cum-statement, not regular 26Q) |
| Deposit deadline | 30 days from end of month (or one-time at March 31) |
| Notes | Deduct once per year (at last month or end of tenancy). Not for companies. Common for shop rent. |

### Section 194J — Professional / Technical Services
| Item | Rate |
|------|------|
| Rate — Professional fees | 10% |
| Rate — Technical services | 2% |
| Rate — Royalty (films/songs) | 2% |
| Rate — Directors (non-salary) | 10% |
| No-PAN rate | 20% |
| Threshold (FY 2025-26 Budget 2025) | > **₹50,000** per payee per FY |
| (Previous threshold) | ₹30,000 — increased to ₹50,000 from FY 2025-26 |
| Return | Form 26Q |
| Professional = | Doctor, Lawyer, CA, Engineer, Architect, Interior Designer, Consultant |
| Technical = | IT support, call centre, repair & maintenance |
| Notes | If payer is individual/HUF not under tax audit → no TDS on professional/technical. 194M applies instead if > 50L. |

### Section 194M — Payment by Individual/HUF to Contractors/Professionals
| Item | Rate |
|------|------|
| Rate | 5% |
| Threshold | Aggregate > ₹50,00,000 in FY |
| Return | Form 26QD |
| Notes | Applies when 194C/194J don't apply (payer is individual/HUF not under audit). High-value payments only. |

### Section 194N — Cash Withdrawal from Banks
| Item | Rate |
|------|------|
| Rate (filer) | 2% on amount above ₹1 crore |
| Rate (non-filer 2+ years) | 2% above ₹20L, 5% above ₹1Cr |
| Return | Form 26Q |
| Notes | Bank deducts. Important to track in 26AS reconciliation. |

### Section 194Q — Purchase of Goods
| Item | Rate |
|------|------|
| Rate | 0.1% |
| No-PAN rate | 5% |
| Threshold | Buyer's turnover > ₹10Cr previous year AND purchase from single seller > ₹50L |
| Return | Form 26Q |
| Notes | Buyer deducts, not seller. If TCS u/s 206C(1H) already applied, 194Q doesn't apply. |

### Section 206C(1H) — TCS on Sale of Goods
| Item | Rate |
|------|------|
| Rate | 0.1% |
| No-PAN rate | 1% |
| Threshold | Seller's turnover > ₹10Cr AND sale to single buyer > ₹50L |
| Return | Form 27EQ |
| Notes | Seller collects. 194Q takes precedence if buyer is liable. Cannot apply both. |

---

## Lower / Nil Deduction Certificates
Section 197 / 197A: Payee can apply for lower/nil TDS certificate from AO.
- Form 13: Application for lower deduction
- Form 15G: Self-declaration (income below taxable limit, for individuals < 60)
- Form 15H: Self-declaration (for senior citizens ≥ 60)
- Store these against the vendor to auto-suppress TDS flags.

---

## TDS Deposit Deadlines
| Month of deduction | Deposit by |
|-------------------|-----------|
| April to February | 7th of next month |
| March | 30th April |
| Government deductor | Same day (no grace) |

### Penalty for Late Deposit
- **Interest u/s 201(1A):** 1.5% per month from date of deduction (not from due date)
- **Penalty u/s 271C:** Equal to TDS amount (if failed to deduct, not just late)
- **Prosecution:** Section 276B for wilful default

---

## TDS Return Due Dates
| Quarter | Period | Due Date |
|---------|--------|----------|
| Q1 | Apr–Jun | 31 July |
| Q2 | Jul–Sep | 31 October |
| Q3 | Oct–Dec | 31 January |
| Q4 | Jan–Mar | 31 May |

### Forms (new numbering effective TY 2026-27)
- **Form 138** (was 24Q): TDS on salary (Section 192)
- **Form 140** (was 26Q): TDS other than salary (most business payments)
- **Form 144** (was 27Q): TDS on payments to non-residents
- **Form 142** (was 27EQ): TCS returns ← CORRECTION: earlier docs stated 143, correct is 142

### Penalty for Late Filing
- **Section 234E:** ₹200 per day until return filed (max = TDS amount)
- **Section 271H:** ₹10,000 to ₹1,00,000 for incorrect returns

---

## Section 206AB / 206CCA — Higher TDS for Non-Filers (from July 2021)
If payee has NOT filed ITR for 2 preceding years AND TDS > ₹50,000 per year in each year:
- TDS rate = HIGHER of: twice the normal rate OR 5%
- System must check: did this vendor file IT returns? (manual flag or IT portal check)
- This creates a new field on vendor/supplier: `itrFilerStatus`

---

## Auto-Detection Logic (for TDS Engine)
The system should scan each payment and flag TDS if:
1. Payment section is identifiable from payment description/category
2. Vendor is not exempt (Form 15G/15H/13, or transporter with PAN)
3. Threshold is crossed (single payment OR aggregate in FY)
4. Payer's entity type makes the section applicable (e.g., 194IB only for individual/HUF)

See `03_system_design/tds_detection_rules.md` for implementation spec.
