# IT Module — Documentation Hub

> **Status:** Pre-build research phase. DO NOT deploy any IT module features until locally tested.
> Schema migration (15 tables) is already in production DB as of June 2026.

## Folder Structure

| Folder | Contents |
|--------|----------|
| `01_market_research/` | Analysis of ClearTax, Tally, KDK, Saral, Zoho, Busy |
| `02_legal_compliance/` | IT Act rules, TDS rates, depreciation, compliance calendar |
| `03_system_design/` | Data model, computation engine spec, TDS detection rules |
| `04_user_flows/` | Setup wizard, CA dashboard, filing workflow |
| `05_api_research/` | IT portal APIs, TRACES, ERI, 26AS schema, ITR JSON schema |
| `06_gap_analysis/` | Identified gaps before we can build each feature |

## Key Decisions (Architect Recommendations)

### Q1: Target CA Profile
**Recommendation: Solo CA with 10–20 clients (v1), CA firm (v2)**

Solo CAs are underserved — the big tools (Tally, ClearTax CA) are over-engineered for them. They need:
- One login, see all assigned businesses
- Status at a glance (who is pending, who is overdue)
- Flag-and-review workflow without complex team management
- Simple ITR sign-off before filing

CA firms (multiple CAs, delegation, review hierarchy) are a v2 feature.

### Q2: Multi-Client CA View
**Recommendation: YES — mandatory for v1**

CAs hate logging in per client. Our CA role should show:
- All businesses assigned to that CA
- Filing status per business per year
- Pending issues flagged by the system
- Deadline countdown for each entity

This is the #1 differentiator vs Tally (which forces per-company login).

### Q3: Salary / Other Income
Follow IT Act rules. Proprietor income from business is business income only.
Salary from a second employer is Schedule S. Interest income is Schedule OS.
Build each income head as a separate section within the ITR. No simplification.

### Q4: GST Composition Scheme
Full support. Composition dealers are common in retail. Treatment:
- Composition tax is NOT ITC; it's a business expense
- GST turnover = IT turnover (no ITC adjustment to remove)
- GSTR-4 (annual) instead of GSTR-3B for GST compliance tracking

### Q5: Advance Received Treatment
Industry standard: advance received is a liability (deferred revenue). It is
NOT income until delivery. Flag for CA review if outstanding > 90 days or at
year end. Match against customer orders in our ERP to auto-detect.

### Q6: Testing Approach
Local first. All IT module features tested on localhost before any deployment.

---

## Build Order (Post-Documentation)

1. IT Setup Wizard (entity type, PAN, partners, regime)
2. Fixed Asset Register UI + auto-depreciation
3. TDS Auto-Detection Engine
4. P&L + Balance Sheet computation
5. Tax computation (old vs new regime)
6. Advance Tax dashboard
7. Form 26AS upload + reconciliation
8. ITR data assembly + JSON export
9. CA Review dashboard
10. Yearly filing history dashboard

## Schema
Already migrated: 15 tables, 12 enums. See `backend/prisma/schema.prisma` (ItProfile and below).
Migration SQL: `it_module_migration.sql` in project root.
