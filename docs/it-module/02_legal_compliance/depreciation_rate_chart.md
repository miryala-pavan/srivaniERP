# Depreciation Rate Chart — IT Act (India)

> Income Tax Act depreciation uses the **Written Down Value (WDV) Block Method**.
> This is DIFFERENT from Companies Act (straight-line) depreciation used in books.
> Both must be maintained if entity is a company. For proprietorship/partnership, IT Act depreciation IS book depreciation.

---

## Key Rules

### WDV Block Method
- Assets are grouped into "blocks" by type and rate, not tracked individually
- Opening WDV of block + additions during year − disposals during year = closing WDV
- Depreciation = closing WDV × rate (but see 50% rule below)
- Block value never goes negative; if proceeds > block WDV → short-term capital gain

### 50% Rule (Section 32(1) Proviso)
- If asset purchased AND put to use for **less than 180 days** in the year of acquisition
- Depreciation = 50% of normal depreciation (not 50% of asset value)
- Example: Computer (40%) bought 15 November, only 136 days in year → 20% for that year
- Track individual asset dates even though depreciation is by block

### Section 32(1)(iia) — Additional Depreciation (Manufacturing/Power)
- 20% additional on plant & machinery for first year of use
- For units in backward areas (notified): 35% additional
- Applicable only to manufacturing entities, NOT trading/service businesses
- If asset used < 180 days: additional depreciation = 10% (first year), balance 10% next year
- NOT available on: second-hand assets, office equipment, vehicles

### Terminal Depreciation / Capital Gain on Block
- When ALL assets in a block are sold:
  - If proceeds < WDV → Short Term Capital Loss (deductible)
  - If proceeds > WDV → Short Term Capital Gain (taxable)
- When some assets sold from block: proceeds reduce block WDV (no immediate gain/loss)

---

## Depreciation Rate Table

### Block 1 — Buildings
| Sub-type | Rate |
|----------|------|
| Residential buildings | 5% |
| Non-residential buildings (commercial/factory) | 10% |
| Temporary structures (wooden/bamboo) | 100% |
| Hotels/boarding houses (AY 2003-04 onwards) | 10% |

### Block 2 — Furniture & Fittings
| Sub-type | Rate |
|----------|------|
| Furniture & fittings (including electrical fittings) | 10% |

### Block 3 — Plant & Machinery
| Sub-type | Rate |
|----------|------|
| General plant and machinery | 15% |
| Aeroplanes (including helicopters) | 40% |
| Motor cars (not used in business of running on hire) | 15% |
| Motor buses, lorries, taxis used in hire business | 30% |
| Ships | 20% |
| Ocean-going ships | 20% |
| Books (individual professional) | 100% |
| Books (libraries) | 60% |
| Moulds (metal/rubber/glass) | 15% |

### Block 4 — Machinery for Specified Purposes
| Sub-type | Rate |
|----------|------|
| Machinery used in manufacture of paper/glass/sugar | 15% |
| Water treatment plants | 15% |
| Air/water pollution control equipment | 100% |
| Energy-saving devices (notified) | 40% |
| Renewable energy devices (solar/wind) | 40% |

### Block 5 — Computers & Software
| Sub-type | Rate |
|----------|------|
| Computers, computer hardware | 40% |
| Computer software (including ERP, purchased) | 40% |
| Servers | 40% |

### Block 6 — Vehicles
| Sub-type | Rate |
|----------|------|
| Motor car (not for hire) | 15% |
| Motor vehicles for hire (bus, taxi) | 30% |
| Electric vehicles (all types) | 30% |
| Two-wheelers | 15% |

### Block 7 — Intangible Assets (Section 32(1)(ii))
| Sub-type | Rate |
|----------|------|
| Know-how | 25% |
| Patents | 25% |
| Copyrights | 25% |
| Trademarks | 25% |
| Licenses | 25% |
| Franchises | 25% |
| Any other business/commercial right of similar nature | 25% |
| Goodwill (self-generated) | NIL from AY 2022-23 onwards |

> **Important:** Goodwill purchased in slump sale/amalgamation — depreciation NOT available from AY 2022-23 onwards (CBDT Notification 77/2021). Self-generated goodwill was always NIL.

---

## Practical Examples for Srivani Stores / Retail

| Asset | Block | Rate | Notes |
|-------|-------|------|-------|
| Shop building (owned) | Block 1 | 10% | Commercial |
| Interior fit-out / shelving | Block 2 | 10% | Furniture & fittings |
| AC units, fans, electrical | Block 2 | 10% | Electrical fittings |
| POS machines / billing system | Block 5 | 40% | Computers |
| Barcode scanners | Block 5 | 40% | Computer hardware |
| CCTV / security systems | Block 3 | 15% | General P&M |
| Cold storage / refrigerators | Block 3 | 15% | General P&M |
| Weighing machines | Block 3 | 15% | General P&M |
| Delivery vehicle | Block 6 | 15% or 30% | 15% if own use; 30% if for hire |
| Generator / UPS | Block 3 | 15% | General P&M |
| Software (custom ERP) | Block 5 | 40% | Computer software |
| Leasehold improvements | Block 1 | 10% | Treated as building |

---

## Data to Capture Per Asset

For each asset, the system must record (for correct depreciation computation):
1. Asset description
2. Asset type / block classification
3. Date of purchase
4. Date of putting to use (for 180-day test)
5. Cost of acquisition (excluding GST if ITC claimed)
6. Whether it's a "new" asset or "second-hand" (additional depreciation)
7. Opening WDV (if migrating from previous year)
8. Year-wise additions and disposals

---

## Depreciation Computation Sequence (Per Block, Per Year)

```
Opening WDV (block)
+ Additions in block (assets put to use ≥ 180 days)
+ Additions (assets put to use < 180 days) [separate sub-total → 50% rate]
− Sales proceeds of assets sold from block
= Adjusted WDV
× Rate = Full depreciation
+ Additions < 180 days × (Rate × 50%) = Half-rate depreciation
= Total depreciation for the year
Closing WDV = Adjusted WDV − Total depreciation
```

---

## IT Act vs Companies Act Depreciation

| Item | IT Act | Companies Act (Schedule II) |
|------|--------|---------------------------|
| Method | WDV block | Straight line OR WDV per company choice |
| Grouping | By block (rate-based) | Individual asset |
| Useful life | Not specified | Specified in Schedule II |
| Extra deductions | Additional depreciation (Sec 32(1)(iia)) | None |
| Impact | Reduces taxable profit | Reduces book profit |

For proprietorship and partnership: only IT Act depreciation matters (no separate Company books).
For private limited: maintain both; difference creates deferred tax.
