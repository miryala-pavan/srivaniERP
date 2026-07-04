# IT Computation Engine — Design Spec

> The engine computes the final tax position for a business for a given FY.
> It is the core of the module — everything else feeds into this.

---

## What It Computes (Output)

```
For a given businessId + financialYear:

A. Business Income
   ├── Gross revenue (from ERP invoices)
   ├── Less: Direct expenses (COGS, wages)
   ├── Less: Indirect expenses (rent, admin, etc.)
   ├── Add/Less: IT Act adjustments (depreciation diff, 40A(3), 43B, etc.)
   └── = Net Taxable Business Income

B. Other Income Heads
   ├── Salary income (if proprietor has salary from another source)
   ├── House property income (if proprietor owns rented property)
   ├── Capital gains (v2)
   └── Income from other sources (interest, dividends)

C. Gross Total Income = A + B

D. Deductions (Old Regime only)
   └── Chapter VI-A deductions

E. Total Income = C - D

F. Tax Computation
   ├── Tax as per slabs (old or new)
   ├── Add: Surcharge
   ├── Add: Health & Education Cess (4%)
   ├── Less: Rebate u/s 87A
   └── = Total Tax Liability

G. Tax Already Paid
   ├── TDS (from Form 26AS + our TDS ledger)
   ├── Advance tax paid
   └── Self-assessment tax paid

H. Tax Payable / Refundable = F - G

I. Side-by-side: OLD vs NEW regime comparison
   └── System recommends the better regime
```

---

## P&L Adjustments for IT Act

The ERP's P&L (per books) ≠ IT Act income. These adjustments are needed:

### Add Back (Books allowed, IT doesn't)
| Item | Source |
|------|--------|
| Depreciation per books | ERP expense entries categorized as depreciation |
| Cash expenses > 10K (40A(3)) | TDS engine flags |
| TDS-default disallowance (40(a)) | TDS engine flags |
| 43B items unpaid by year-end | Payroll + payables data |
| Excessive partner salary (40(b)) | ItProfile.BusinessPartner + book profit |
| Excessive partner interest (>12%) | ItProfile.CapitalAccount |
| Personal expenses in books | CA review / manual flag |
| Capital expenditure in P&L | CA review / manual flag |

### Less (IT allows, books may not show)
| Item | Source |
|------|--------|
| IT Act depreciation | FixedAsset register + block computation |
| Additional depreciation (manufacturing only) | ItProfile flag |
| Scientific research deduction | Manual entry |
| 43B items PAID this year (from last year provision) | Payroll + payables |

### Net Result
```
IT Act Income = Books P&L (net profit)
  + Add-backs
  - Allowances
```

---

## Data Sources Per Computation Step

| Step | ERP Data Source |
|------|----------------|
| Revenue | `SalesInvoice`, `PosTransaction` |
| COGS | `Purchase`, `StockMovement` |
| Indirect expenses | `Expense` model (to build) |
| Depreciation (books) | `Expense` entries tagged as depreciation |
| Depreciation (IT Act) | `FixedAsset` + `AssetDepreciation` model |
| Cash payments | `Payment.mode = CASH` + amounts |
| TDS defaults | `TdsEntry.status = PENDING` |
| 43B PF/ESI | `Payroll.pfPayment`, `Payroll.esiPayment` (future) |
| Partner salary/interest | `BusinessPartner`, `CapitalAccount` |
| Advance tax | `AdvanceTaxPayment` |
| TDS credits | `TdsEntry` + `Form26ASEntry` |

---

## Block Depreciation Computation Algorithm

```typescript
interface BlockResult {
  block: string;
  openingWDV: number;
  additions_full: number;      // assets used >= 180 days
  additions_half: number;      // assets used < 180 days
  disposals: number;
  adjustedWDV: number;
  fullRateDepr: number;
  halfRateDepr: number;
  totalDepr: number;
  closingWDV: number;
}

function computeBlock(assets: FixedAsset[], fy: string): BlockResult {
  const rate = assets[0].block.rate;
  const fyStart = new Date(`${fy.split('-')[0]}-04-01`);
  const fyEnd = new Date(`${fy.split('-')[1]}-03-31`);

  let openingWDV = assets.reduce((s, a) => s + a.openingWdv, 0);
  let additions_full = 0;
  let additions_half = 0;
  let disposals = 0;

  for (const asset of assets) {
    if (asset.purchaseDate >= fyStart && asset.purchaseDate <= fyEnd) {
      // New acquisition this year
      const daysUsed = daysBetween(asset.putToUseDate, fyEnd);
      if (daysUsed >= 180) {
        additions_full += asset.cost;
      } else {
        additions_half += asset.cost;
      }
    }
    if (asset.disposalDate >= fyStart && asset.disposalDate <= fyEnd) {
      disposals += asset.saleProceeds;
    }
  }

  const adjustedWDV = openingWDV + additions_full + additions_half - disposals;
  const fullRateDepr = (openingWDV + additions_full) * rate;
  const halfRateDepr = additions_half * rate * 0.5;
  const totalDepr = Math.max(0, fullRateDepr + halfRateDepr);
  const closingWDV = Math.max(0, adjustedWDV - totalDepr);

  return { block, openingWDV, additions_full, additions_half, disposals,
           adjustedWDV, fullRateDepr, halfRateDepr, totalDepr, closingWDV };
}
```

---

## Tax Computation Algorithm

```typescript
function computeTax(income: number, regime: 'OLD' | 'NEW', age: number, isFirm: boolean): TaxResult {

  if (isFirm) {
    const baseTax = income * 0.30;
    const surcharge = income > 1_00_00_000 ? baseTax * 0.12 : 0;
    const cess = (baseTax + surcharge) * 0.04;
    return { tax: baseTax, surcharge, cess, total: baseTax + surcharge + cess };
  }

  let slabs: [number, number][];
  if (regime === 'NEW') {
    slabs = [
      [300000, 0],
      [700000, 0.05],
      [1000000, 0.10],
      [1200000, 0.15],
      [1500000, 0.20],
      [Infinity, 0.30],
    ];
  } else {
    const nil = age >= 80 ? 500000 : age >= 60 ? 300000 : 250000;
    slabs = [
      [nil, 0],
      [500000, 0.05],
      [1000000, 0.20],
      [Infinity, 0.30],
    ];
  }

  // Compute slab-wise tax
  let baseTax = 0;
  let prev = 0;
  for (const [limit, rate] of slabs) {
    if (income <= prev) break;
    baseTax += (Math.min(income, limit) - prev) * rate;
    prev = limit;
  }

  // Rebate 87A
  let rebate = 0;
  if (regime === 'NEW' && income <= 700000) rebate = Math.min(baseTax, 25000);
  if (regime === 'OLD' && income <= 500000) rebate = Math.min(baseTax, 12500);
  baseTax -= rebate;

  // Surcharge
  let surchargeRate = 0;
  if (income > 5_00_00_000) surchargeRate = regime === 'NEW' ? 0.25 : 0.37;
  else if (income > 2_00_00_000) surchargeRate = 0.25;
  else if (income > 1_00_00_000) surchargeRate = 0.15;
  else if (income > 50_00_000) surchargeRate = 0.10;

  const surcharge = baseTax * surchargeRate;
  // TODO: marginal relief computation
  const cess = (baseTax + surcharge) * 0.04;

  return {
    regime,
    income,
    baseTax: baseTax + surcharge,
    cess,
    total: baseTax + surcharge + cess,
    rebate,
    surcharge,
  };
}
```

---

## Old vs New Regime Comparison

The engine computes BOTH and presents:

```
┌──────────────────────────────────────────────────────────┐
│                  TAX COMPARISON — FY 2025-26             │
├──────────────────────────┬───────────────────────────────┤
│                          │  OLD REGIME  │  NEW REGIME    │
├──────────────────────────┼──────────────┼────────────────┤
│ Total Income             │  ₹18,50,000  │  ₹20,00,000   │
│ Deductions (80C etc.)    │  (₹1,50,000) │  NIL           │
│ Taxable Income           │  ₹17,00,000  │  ₹20,00,000   │
│ Basic Tax                │  ₹3,37,500   │  ₹3,37,500    │
│ Surcharge                │  NIL         │  NIL           │
│ Cess (4%)                │  ₹13,500     │  ₹13,500      │
│ Total Tax Payable        │  ₹3,51,000   │  ₹3,51,000    │
├──────────────────────────┴──────────────┴────────────────┤
│ RECOMMENDATION: New Regime saves ₹X this year            │
└──────────────────────────────────────────────────────────┘
```

---

## ItReturn Model Storage

After computation, the result is saved in `ItReturn`:
```
{
  businessId, financialYear, status: DRAFT,
  grossRevenue, grossExpenses, bookProfitLoss,
  addbacksTotal, allowancesTotal,
  taxableBusinessIncome,
  otherIncomeTotal, grossTotalIncome,
  oldRegimeDeductions, totalIncomeOld, taxOld,
  totalIncomeNew, taxNew,
  recommendedRegime: 'OLD' | 'NEW',
  tdsCreditTotal, advanceTaxTotal,
  taxPayableOld, taxPayableNew,
  caReviewStatus: 'PENDING_CA_REVIEW',
  computedAt: now(),
  ...
}
```

CA can then:
- Review each line
- Add corrections / manual adjustments
- Flag issues (CaIssueFlag model)
- Approve and sign off
