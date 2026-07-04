# TDS Auto-Detection Engine — Design Spec

> The engine scans every payment made through the ERP and determines:
> 1. Which TDS section applies (if any)
> 2. Whether the threshold is crossed
> 3. Whether TDS was deducted
> 4. If not: flag it as a potential 40(a) disallowance
>
> This drives both real-time alerting (deduct before paying) and
> year-end tax adjustment (disallow unpaid TDS expenses).

---

## Input Data (What We Have in ERP)

| Data Source | Where in DB |
|-------------|-------------|
| Supplier/vendor payments | `Purchase`, `PurchaseOrder`, bank payments |
| Supplier category | `Supplier.category` or new `tdsCategory` field |
| Employee salary payments | `Payroll` (not yet built, but planned) |
| Rent payments | New `RentPayment` model (to add) |
| Professional service payments | Payment with type = PROFESSIONAL |
| Cash vs bank | `Payment.mode` |
| Entity type | `ItProfile.entityType` |
| Aggregate per vendor per FY | Computed on the fly |

---

## Detection Logic Per Section

### 194C — Contractors
```
trigger: payment to supplier categorized as 'CONTRACTOR'
AND (single_payment > 30,000 OR fy_aggregate > 1,00,000)
AND supplier is NOT transporter with PAN on record
AND entity type is not individual/HUF (non-audit) [for 194M instead]
rate: 1% if supplier is individual/HUF, else 2%
```

**Supplier categories → 194C:**
- Labour contractors
- Advertising agencies
- Catering services
- Printing & stationery
- Civil works / maintenance contractors
- Packaging contractors

### 194H — Commission
```
trigger: payment categorized as 'COMMISSION' or 'BROKERAGE'
AND fy_aggregate > 15,000
rate: 5%
```

### 194I — Rent (Companies and Audit-liable entities)
```
trigger: payment categorized as 'RENT'
AND annual_rent > 2,40,000
AND entity type is COMPANY, PARTNERSHIP, LLP (not individual/HUF without audit)
rate: 10% (land/building), 2% (plant/machinery)
```

### 194IB — Rent (Individual/HUF, non-audit)
```
trigger: payment categorized as 'RENT'
AND rent > 50,000 per month
AND entity type is PROPRIETORSHIP or HUF
AND entity NOT under tax audit (turnover < threshold)
rate: 5%
note: one-time deduction (at end of FY or end of tenancy)
form: 26QC (NOT 26Q — special challan-cum-statement)
```

### 194J — Professional / Technical
```
trigger: payment to supplier categorized as 'PROFESSIONAL' or 'TECHNICAL'
AND fy_aggregate > 30,000
professional_rate: 10%  (CA, doctor, lawyer, consultant)
technical_rate: 2%  (repair, IT support, maintenance)
```

**Supplier categories → 194J:**
- CA, CS, lawyers (professional → 10%)
- Repair & maintenance (technical → 2%)
- IT service providers (technical → 2%)
- Management consultants (professional → 10%)
- Security agencies (technical → 2%)

### 194A — Interest
```
trigger: payment categorized as 'INTEREST' to non-bank entities
AND fy_aggregate > 5,000 (or > 40,000 if recipient is bank)
rate: 10%
```

### 194Q — Goods Purchase (Buyer with turnover > 10Cr)
```
trigger: previous year turnover > 10 crore
AND purchase from single supplier > 50 lakh in FY
AND supplier did NOT already collect TCS u/s 206C(1H)
rate: 0.1%
note: this requires turnover check — auto-enable when IT profile shows turnover > 10Cr
```

### 40A(3) — Cash Payment Disallowance
```
trigger: payment.mode = 'CASH'
AND payment amount > 10,000 (single transaction, same party, same day)
[except: transport payments — threshold is 35,000]
flag: 40A(3) disallowance
note: this is NOT a TDS section, but tracked alongside TDS for year-end computation
```

---

## TdsEntry Model (Already in Schema)

```prisma
model TdsEntry {
  id              String   @id @default(uuid())
  businessId      String
  relatedTo       String?  // payment reference
  payeeName       String
  payeePan        String?
  section         String   // '194C', '194H', '194IB', etc.
  paymentDate     DateTime
  paymentAmount   Decimal
  tdsAmount       Decimal
  tdsRate         Decimal
  isDeducted      Boolean  @default(false)
  depositedDate   DateTime?
  challanNo       String?
  quarterFiled    String?  // 'Q1-2025-26'
  status          TdsStatus // PENDING, DEDUCTED, DEPOSITED, FILED
  ...
}
```

---

## Exemptions and Overrides (Vendor-Level)

For each vendor/supplier, store:
```typescript
{
  tdsExemptReason: 'FORM_15G' | 'FORM_15H' | 'FORM_13' | 'TRANSPORTER_PAN' | null,
  tdsExemptCertificateNo: string | null,
  tdsExemptValidTill: Date | null,
  lowerDeductionRate: number | null,  // from Form 13
  itrFilerStatus: 'FILER' | 'NON_FILER_1YR' | 'NON_FILER_2YR' | null,
  isMsme: boolean,
  msmeUdyamNumber: string | null,
}
```

If `tdsExemptReason` is set and `tdsExemptValidTill` is in the future → suppress TDS flag.
If `lowerDeductionRate` is set → use that rate instead of standard.
If `itrFilerStatus = 'NON_FILER_2YR'` → apply Section 206AB (double rate or 5%, whichever higher).

---

## Real-Time Alert Flow

```
Payment created in ERP
    ↓
TDS Detection Engine runs (synchronous check on save)
    ↓
Is this payment subject to TDS? (section lookup)
    ↓ Yes
Is vendor exempt? (check exemption flags)
    ↓ No
Is threshold crossed? (aggregate + single payment check)
    ↓ Yes
Was TDS deducted? (check tdsAmount field)
    ↓ No
→ Create TdsEntry with status = PENDING
→ Show warning badge on payment record
→ Add to CA dashboard "TDS to deduct" list
→ Block payment approval if above threshold and TDS = 0 (configurable)
```

---

## Year-End Reconciliation Steps

1. Pull all TdsEntry records for the FY
2. For PENDING entries: compute 40(a) disallowance (30% of payment)
3. For DEPOSITED entries after due date: compute interest 1.5%/month
4. For not-yet-filed returns: check 234E deadline
5. Generate:
   - Total TDS deducted (matches 26Q/24Q to file)
   - Disallowances to add back in ITR computation
   - Outstanding TDS payable

---

## Priority Order for v1 TDS Detection

| Priority | Section | Why |
|----------|---------|-----|
| P1 | 194IB (rent by individual) | Very common: shop rent for proprietors |
| P1 | 194C (contractors) | Labour, packaging, maintenance |
| P1 | 194J (professional/technical) | CA fees, repair bills |
| P2 | 194H (commission) | If business uses agents |
| P2 | 40A(3) (cash disallowance) | Very common in retail |
| P2 | 43B (late PF/ESI) | Once payroll is built |
| P3 | 194A (interest) | Less common for retail |
| P3 | 194Q (purchase > 50L) | Only relevant at higher scale |
| P3 | 206AB (non-filer) | Needs IT portal data |
