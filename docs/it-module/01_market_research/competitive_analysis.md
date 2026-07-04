# Competitive Analysis — Indian IT Filing & Accounting Tools

> Research completed: July 2026. Sources cited at end.

---

## Market Landscape Summary

The Indian market has a hard structural split:

| Category | Tools | What they do | What they can't do |
|----------|-------|-------------|-------------------|
| **Accounting software** | Tally Prime, Busy, Zoho Books | Generate P&L, Balance Sheet, TDS ledgers, GST returns | Cannot file ITR at all |
| **Tax filing software** | KDK Spectrum, Gen IT, CompuTax | File ITR-1 to ITR-7, compute tax, AIS reconciliation | Need data imported from accounting software |
| **TDS-only** | Saral TDS | File TDS returns (24Q, 26Q), generate Form 16A | No ITR, no accounting |

**No single tool does accounting + TDS + ITR filing in one integrated workflow.**
This is the gap our ERP closes. The CA's current workflow is:

```
Tally/Busy → export Excel/PDF → import into KDK/Gen IT → file ITR
            → export TDS data → import into Saral TDS → file TDS returns
```

Our ERP makes this one pipeline: same data, no exports, no imports.

---

## ⚠️ CRITICAL UPDATE — New Income Tax Act 2025

**Effective TY 2026-27 (AY 2026-27): All TDS/TCS form numbers have changed.**

| Old Form | New Form | Purpose |
|----------|----------|---------|
| Form 24Q | **Form 138** | Quarterly TDS return — salary |
| Form 26Q | **Form 140** | Quarterly TDS return — non-salary |
| Form 27Q | **Form 144** | TDS on payments to non-residents |
| Form 27EQ | **Form 143** | TCS quarterly return |
| Form 16 (salary TDS cert) | **Form 130** | Annual salary TDS certificate |
| Form 26AS | Subsumed by AIS | Consolidated tax statement |

**Due dates unchanged**: 31 Jul (Q1), 31 Oct (Q2), 31 Jan (Q3), 31 May (Q4).

Our ERP must use the new form numbers from the start. Most legacy tools are scrambling to update.
Building on new numbering from day one is a structural advantage.

---

## Tool-by-Tool Analysis

### 1. ClearTax TaxCloud — SHUT DOWN March 2026
- Was the market leader for CA multi-client ITR filing
- Supported all ITR forms, AIS fetch, bulk client upload, ERI-registered
- Priced at ₹45,000+/year — became unsustainable
- **Shut down in March 2026** — 60,000+ CA users are now migrating
- Primary beneficiary: KDK Spectrum Cloud
- **What we learn:** Price, reliability, and cloud performance matter as much as features

### 2. KDK Spectrum Cloud — Current Market Leader
- Auto-fetch from AIS and Form 26AS in seconds
- Multi-tab filing (work on multiple clients simultaneously)
- Old vs new tax regime real-time comparison
- Historical data from AY 2022-23 (prior year carry-forward)
- AIS vs computation mismatch flagging before filing
- GST portal integration (fetches GSTN turnover directly)
- Role-based access control per form/PAN
- Estimated ₹15,000–25,000/year, unlimited returns
- **Gaps:** TDS return filing is still a separate product; desktop-era UX transitioning to cloud

### 3. Gen IT by SAG Infotech — Most Popular Among Mid-Size CAs
- Cheapest professional-grade: ₹7,000 install + ₹4,500/year
- WhatsApp integration for sending documents to clients (manual, not automated)
- Advance tax estimation for upcoming year
- **Gaps:** Desktop-only (Windows), no mobile/browser, dated UI, no AIS import

### 4. CompuTax — Legacy Workhorse
- ₹7,000–12,250/year, full suite
- Rectification upload (u/s 154), notice management
- **Gaps:** Internet Explorer-era engine, no cloud, no AIS import

### 5. Saral TDS — Best-in-Class for TDS Only
- 1.3 lakh+ TANs, 14 lakh+ TDS returns filed annually
- Automated challan mapping, TRACES integration
- Bulk PAN validation, conso file download, Form 16A bulk generation
- **Gaps:** TDS only — no ITR, no accounting integration

### 6. Tally Prime — Accounting, Not Filing
- Dominant accounting software; 18,000/year (Silver), 54,000/year (Gold)
- TDS ledgers, WDV depreciation, P&L, Balance Sheet
- Generates .fvu files for TRACES but does NOT file TDS returns or ITR
- CAs using Tally still need a separate filing tool
- **Our advantage:** Our ERP accounting data directly feeds IT computation — no Tally required

### 7. Zoho Books — GST Strength, No IT
- Excellent GST: GSTR-1, 3B, e-invoice, direct portal filing
- **Zero IT capability:** No ITR, no TDS returns, no 26AS/AIS, no advance tax, no audit forms
- No depreciation block method (only book depreciation)

### 8. Busy Accounting — MSME Accounting, No Filing
- Direct GST filing from Saffron plan
- Basic TDS tracking
- **Zero ITR/TDS return filing capability**

---

## What CAs Actually Want (Pain Points Across All Tools)

| Pain Point | Severity |
|-----------|---------|
| Must use 2–3 separate tools (accounting + ITR + TDS) | Very High |
| Manual data export/import between tools | Very High |
| AIS reconciliation is manual and time-consuming | High |
| No real-time old vs new regime comparison during the year | High |
| Desktop-only tools (no remote access) | High |
| Pricing shock / renewal costs | High |
| Peak filing season performance crashes | High |
| Notice tracking is separate from the return | Medium |
| No WhatsApp/email dispatch integrated | Medium |
| No multi-entity consolidated view | Medium |
| Form 16/16A generation requires TRACES login | Medium |

---

## ERI Integration — Critical for v2

An ERI (e-Return Intermediary) Type 2 enables:
- Filing ITR programmatically via API (no portal login)
- Bulk ZIP upload (40 JSONs per batch)
- Fetch pre-filled data on behalf of clients
- e-Verify returns programmatically
- Download acknowledgments in bulk

**Registration:** Apply to CBDT, meet data security standards, annual renewal.
**Cost/timeline:** 3–6 months process, feasible once product has traction.
**v1 plan:** Generate JSON → user uploads manually → e-verifies on portal.
**v2 plan:** Register as ERI or partner with existing ERI → one-click filing.

---

## Our Competitive Position

| Feature | ClearTax (dead) | KDK Spectrum | Gen IT | Our ERP |
|---------|----------------|-------------|--------|---------|
| Integrated accounting + ITR | ❌ | ❌ | ❌ | ✅ |
| Native TDS detection from payments | ❌ | ❌ | ❌ | ✅ |
| Built on new form numbering (138/140/143/144) | N/A | In progress | In progress | ✅ from start |
| WhatsApp-native workflow | ❌ | ❌ | Basic | ✅ (via existing WhatsApp module) |
| FMCG / retail-specific TDS auto-mapping | ❌ | ❌ | ❌ | ✅ |
| Mobile / PWA access | ❌ | Partial | ❌ | ✅ |
| CA multi-client dashboard | ✅ | ✅ | ✅ | ✅ (v1) |
| Old vs new regime comparison | ✅ | ✅ | ✅ | ✅ |
| AIS reconciliation | ✅ | ✅ | ❌ | ✅ (v1.5) |
| ERI filing | ✅ | ✅ | ✅ | v2 |
| Pricing (per year) | ₹45,000+ | ₹15,000–25,000 | ₹7,000–20,000 | TBD |

---

## Immediate Impact on Our Build

1. **Use new form numbers from day one**: Form 138, 140, 143, 144 — NOT the old 24Q/26Q/27EQ/27Q
2. **AIS is the primary source**, not Form 26AS — build AIS upload/reconciliation, not just 26AS
3. **KDK Spectrum is the benchmark to beat** on CA multi-client UX
4. **Saral TDS is the benchmark for TDS workflow** (challan mapping, TRACES integration, bulk Form 16)
5. **ERI registration is a future moat** — plan for it from product architecture

---

## Sources

- ClearTax TaxCloud (cleartax.in/taxcloud)
- KDK Spectrum Cloud (kdksoftware.com/spectrum-cloud/itr)
- Gen IT SAG Infotech (saginfotech.com/genit.aspx)
- SAG Blog — Best IT Software 2026 (blog.saginfotech.com)
- Saral TDS (saraltds.com)
- CompuTax (computaxsoftware.com)
- Tally Prime for CAs (cloudfysystems.com)
- Zoho Books (zoho.com/in/books)
- Busy Accounting (busy.in)
- ERI Services — IT Dept (incometax.gov.in/iec/foportal/servicesavailable)
- New TDS Forms 138/140/143/144 (blog.saginfotech.com/tds-returns-forms-138-140-144-143)
- TRACES 2.0 (easyofficesoftware.com/blog/traces-portal-2-0-tds-filing-india)
- Income Tax Act 2025 Form Renumbering (ebizfiling.com)
- AIS Guide (cleartax.in/s/new-annual-information-statement-ais)
