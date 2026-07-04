# Research Corrections & Key Findings

> Produced after two deep research cycles (July 2026).
> These findings correct errors in earlier documentation and add critical new information.
> All existing docs have been updated to reflect these corrections.

---

## PART 1 — CRITICAL CORRECTIONS (Errors Fixed in Earlier Docs)

### C1. New Regime Tax Slabs Were Wrong

The slabs in `tax_computation_rules.md` were for AY 2024-25.
Budget 2025 changed the slabs significantly for **FY 2025-26 (AY 2026-27)**.

**WRONG (what was written):**
| Income | Rate |
|--------|------|
| Up to ₹3,00,000 | NIL |
| ₹3L – ₹7L | 5% |
| ₹7L – ₹10L | 10% |
| ₹10L – ₹12L | 15% |
| ₹12L – ₹15L | 20% |
| Above ₹15L | 30% |

**CORRECT (Budget 2025, FY 2025-26 / AY 2026-27):**
| Income | Rate |
|--------|------|
| Up to ₹4,00,000 | NIL |
| ₹4L – ₹8L | 5% |
| ₹8L – ₹12L | 10% |
| ₹12L – ₹16L | 15% |
| ₹16L – ₹20L | 20% |
| ₹20L – ₹24L | 25% |
| Above ₹24L | 30% |

**Impact:** Every tax computation in the system using the old slabs gives the wrong result.
The Rule Engine (to be built) must store slabs per Assessment Year — this is exactly why hardcoding is dangerous.

---

### C2. Section 87A Rebate Limit Was Wrong

**WRONG:** Rebate if income ≤ ₹7,00,000

**CORRECT (FY 2025-26 / AY 2026-27):** Rebate if income ≤ **₹12,00,000**

This is one of the biggest Budget 2025 changes. A person earning ₹11.9L pays zero tax in the new regime.
The rebate is NOT available on special rate income: LTCG (Sec 112A), STCG (Sec 111A), VDA/crypto.

---

### C3. Standard Deduction Increased

**WRONG:** ₹75,000 for salaried (this was actually correct for AY 2025-26)

**CORRECT (AY 2026-27):** Still ₹75,000 — but the base was ₹50,000 until AY 2025-26.
Ensure the Rule Engine stores ₹50,000 for AY 2025-26 returns and ₹75,000 for AY 2026-27.

---

### C4. TDS Threshold — Section 194I (Rent)

**WRONG:** Threshold ₹2,40,000 per year (₹20,000/month)

**CORRECT (FY 2025-26):** Threshold **₹6,00,000 per year** (₹50,000/month)

**Impact on TDS Engine:** The rent detection rule now only fires for rent > ₹50,000/month.
Many small shops paying ₹30,000–₹40,000/month rent will now fall below the threshold.
Section 194IB (individuals/HUF paying rent) threshold is unchanged: ₹50,000/month.

---

### C5. TDS Threshold — Section 194A (Interest)

**WRONG:** Threshold ₹10,000/year for banks

**CORRECT (FY 2025-26):** Threshold **₹40,000/year** for banks (for non-senior citizens)
Senior citizens: ₹50,000/year (unchanged).

---

### C6. TDS Threshold — Section 194J (Professional/Technical)

**WRONG:** Threshold ₹30,000

**CORRECT (FY 2025-26):** Threshold **₹50,000**

---

### C7. TCS Form Number Was Wrong

**WRONG:** Form 27EQ → Form 143

**CORRECT:** Form 27EQ → **Form 142**

The complete corrected form renaming table:

| Old Form | New Form | Purpose |
|----------|----------|---------|
| Form 16 | **Form 130** | TDS certificate — salary |
| Form 16A | **Form 131** | TDS certificate — non-salary |
| Form 24Q | **Form 138** | Quarterly TDS return — salary |
| Form 26Q | **Form 140** | Quarterly TDS return — non-salary |
| Form 27EQ | **Form 142** | Quarterly TCS return ← was wrong in earlier docs |
| Form 27Q | **Form 144** | Quarterly TDS return — non-residents |
| Form 26AS | **Form 168** | Annual tax statement |
| Form 15G + 15H | **Form 121** | Merged into single declaration form |
| Form 12BB | **Form 124** | Employee investment declaration |
| Form 15CB | **Form 146** | CA certificate for foreign remittances |

**Transition rule:** Q4 FY 2025-26 (January–March 2026) still uses OLD form numbers (24Q, 26Q, etc.).
New numbers apply ONLY from Q1 TY 2026-27 onwards (first new-form return due July 2026).

---

### C8. Capital Gains Rates Were Outdated

Finance Act 2024 changed capital gains rates, effective from **23 July 2024**:

| Type | Before 23 Jul 2024 | After 23 Jul 2024 |
|------|-------------------|-------------------|
| STCG on listed equity (Sec 111A) | 15% | **20%** |
| LTCG on listed equity (Sec 112A) | 10% above ₹1L | **12.5% above ₹1.25L** |
| LTCG on other assets | 20% with indexation | **12.5% without indexation** |

**Indexation removed** for all assets transferred after 23 July 2024.
Exception: For immovable property acquired BEFORE 23 July 2024, taxpayer may choose whichever is lower — 12.5% without indexation OR 20% with indexation (grandfathering clause).

---

## PART 2 — MAJOR NEW FINDINGS

### F1. ITR-U: Finance Act 2025 Extended Window to 4 Years

Previously: ITR-U (Updated Return) allowed within 2 years of end of AY.
**Now (Finance Act 2025): 4 years (48 months)**, with a new 4-band penalty structure:

| Filing Window | Additional Tax |
|---------------|---------------|
| Within 12 months from end of AY | 25% of (tax + interest) |
| 12 to 24 months | 50% of (tax + interest) |
| 24 to 36 months | 60% of (tax + interest) |
| 36 to 48 months | **70%** of (tax + interest) — new band |

**Cannot be filed if:** search/survey initiated, assessment proceedings pending, already filed one ITR-U for that AY, Section 148/148A notice issued after 36 months.
**Cannot reduce tax or increase refund.** Must always result in higher tax payable.

**Build impact:** Our ITR-U workflow must:
- Check all exclusion conditions before allowing filing
- Auto-compute which penalty band applies based on today's date vs AY end
- Show the total additional tax clearly before submission

---

### F2. AIS Has 6 Feedback Types (Taxpayer Can Dispute Each Entry)

AIS is not read-only. Taxpayers can submit feedback on each transaction.
When AIS shows income we disagree with, feedback options are:

| Code | Meaning |
|------|---------|
| `INFORMATION_IS_CORRECT` | Accept the entry as-is |
| `INFORMATION_NOT_FULLY_CORRECT` | Dispute the amount; provide correct figure |
| `INFORMATION_RELATES_TO_OTHER` | Wrong PAN or wrong year attributed to us |
| `INFORMATION_IS_DUPLICATE` | Same transaction appears twice |
| `INFORMATION_IS_DENIED` | Transaction never occurred |
| `INFORMATION_IS_NOT_TAXABLE` | Transaction occurred but income is exempt/not taxable |

After feedback is submitted:
- TIS (Tax Information Summary) is immediately recalculated
- The reporting source (bank, MF house) is notified and may confirm or deny
- If source confirms the dispute → AIS updated. If source denies → original value stays but feedback is preserved.

**Build impact:** Our `AISEntry` model needs all 6 feedback states + a `feedbackValue` field for modified amounts + a `feedbackFiledAt` timestamp. The AIS reconciliation UI must allow CA/owner to submit feedback from within our ERP.

---

### F3. TRACES 2.0 Introduced the Unified Tax Ledger (UTL)

Launched: 1 April 2026 | Portal: `traces.tdscpc.gov.in`

The UTL replaces the old Form 26AS credit model:
- **Real-time credit push:** When a deductor files a TDS return (Form 138/140), the credit appears IMMEDIATELY in the taxpayer's UTL. No more waiting days for credit to reflect.
- Aggregates: advance tax + TDS + TCS + self-assessment tax in one running ledger.

**Impact on our reconciliation engine:**
- We no longer need to tell users "wait 3–7 days for TDS to reflect in 26AS"
- Our AIS/UTL reconciliation can be done immediately after a TDS return is filed
- The old lag-based workarounds in our design can be removed

**TRACES 2.0 also:** Merged Form 15G + Form 15H into a single Form 121. Our system should generate Form 121 for vendors who self-declare no TDS deduction.

---

### F4. Dual Act Problem — IT Act 1961 and IT Act 2025 Must Coexist

**The Income Tax Act 2025** came into effect from 1 April 2026 (Tax Year 2026-27 onwards).
The **Income Tax Act 1961** continues to govern ALL income up to FY 2025-26 (AY 2026-27).

This means our system right now (July 2026) must handle both Acts simultaneously:
- AY 2026-27 return (income of FY 2025-26): **IT Act 1961** — sections 143(1), 154, 44AB, etc.
- TY 2026-27 return (income from April 2026): **IT Act 2025** — new section numbers, "Tax Year" terminology

**Key structural change in IT Act 2025:**
- "Previous Year" + "Assessment Year" replaced by a single **"Tax Year"**
- Tax Year 2026-27 = income from 1 April 2026 to 31 March 2027
- Under IT Act 1961: still AY/PY split for all pre-April 2026 filings

**When showing section references in UI:** Display both old and new numbers during transition period.
E.g.: "Section 43B (IT Act 1961) / Section 50(2) (IT Act 2025) — Payment Basis Deductions"

**Rule Engine impact:** TaxRuleSet must store both `assessmentYear` (1961 Act) and `taxYear` (2025 Act) identifiers. Computation engine selects the correct Act based on the filing period.

---

### F5. AIS vs TIS vs Form 168 (26AS) — Which Governs What

This was not clearly documented before:

| Purpose | Governing Document |
|---------|-------------------|
| Claiming TDS/TCS credits in ITR | **Form 168** (old Form 26AS) |
| Income reporting — what income you must declare | **AIS** (cannot ignore AIS income even if not in Form 168) |
| ITR prefilling on portal | **TIS** (aggregated from AIS) |

Practical consequence: A business must reconcile BOTH:
1. Form 168 credits vs our TDS ledger (for credits to claim in ITR)
2. AIS income entries vs our revenue/income records (for income declared in ITR)

If AIS shows ₹45,000 FD interest from SBI and our books show ₹0 (because we forgot to record it) → gap must be explained or income must be added before filing.

---

### F6. SFT (Statement of Financial Transactions) — What Appears in AIS

Third parties (banks, MF houses, registrars) file SFT reports to the IT department.
These appear in AIS as `SFT_INFORMATION` entries. High-value transactions trigger SFT:

| Transaction | Threshold |
|------------|-----------|
| Cash deposit in savings account | ₹10L per year per bank |
| Cash deposit in current/CC accounts | ₹50L per year |
| Fixed deposits | ₹10L per year |
| Mutual fund purchase | ₹10L per year |
| Purchase of immovable property | ₹30L per transaction |
| Cash receipt for goods/services (by a business) | ₹2L per transaction |
| Dividend received | Practically all reported |

**When AIS shows an SFT entry not in our books → CA must explain before ITR is filed.**
Our AIS reconciliation engine must flag these. Unexplained SFT entries are the most common trigger for scrutiny notices.

---

### F7. Faceless Assessment — Complete Workflow (Was Entirely Missing)

Since 2021, all income tax assessments are faceless (no face-to-face meetings, no named AO).

**Complete 10-step workflow:**
1. Case selected by risk algorithm (AIS-ITR mismatch, unexplained investments, etc.)
2. Section 143(2) scrutiny notice issued by NaFAC (no named officer, no city)
3. Taxpayer acknowledges in e-Proceedings portal
4. Assessment Unit sends Section 142(1) questionnaire
5. Taxpayer uploads documents via portal
6. Assessment Unit prepares draft order
7. Show Cause Notice sent with draft order
8. Taxpayer submits written reply (video conference if oral hearing requested — never in-person)
9. Review Unit independently reviews → if agrees, order finalized; if disagrees, fresh Assessment Unit
10. Final order issued electronically

**Notice management must track:** notice type, DIN (Document Identification Number), response due dates, submission history, SCN, final order, tax effect.

---

### F8. ERI Registration — What It Takes

**Type 2 ERI** (our target for v2): Builds own software with API integration.

**What it enables:**
- File ITR for clients programmatically
- Bulk filing (ZIP of 40 JSON files per batch)
- Fetch AIS/TIS prefill data on behalf of clients
- e-Verify returns programmatically
- Real-time status checking

**API endpoints (IEC 2.0 spec):**
1. Login / session
2. Add registered client (existing e-filing user, needs OTP consent)
3. Register unregistered client (new PAN holder)
4. Get prefill data
5. Validate ITR JSON (without submitting)
6. Submit ITR
7. ITR processing status
8. e-Verify return

**Registration timeline:** 30–60 days for established organisations; 90+ days for new ones.
**Annual compliance:** Data retention (1 year post AY), client consent records, security breach reporting.

---

## PART 3 — ARCHITECTURE REVIEW HIGHLIGHTS

*(From `ARCHITECTURE_REVIEW.md` — the 3 blockers and key decisions)*

### The 3 Blockers (Must Resolve Before Writing Any Code)

**Blocker 1 — No General Ledger**
ERP has sales, purchases, POS — but no journal entries, no chart of accounts, no trial balance.
ITR requires a certified P&L and Balance Sheet.
Decision needed: build GL in v1, or CA manually fills Balance Sheet while GL is built in v2.

**Blocker 2 — All Tax Rules Must Be Metadata-Driven**
The slab corrections above prove why: Budget changes every year.
No rate, threshold, section limit, or form name is allowed in application code.
The Rule Engine is the first thing to build — before any computation code.

**Blocker 3 — Year-End Batch is Not Enough**
Tax computation cannot happen only at year-end. Every transaction must update the tax position.
If advance tax shortfall builds up across the year, the business needs to know in September — not in March.

### What Was Missing (Major Items Found in Review)

These features were completely absent from all earlier documentation:

| Missing Feature | Why Critical |
|-----------------|-------------|
| CPC Intimation tracking (u/s 143(1)) | Every filed return gets an intimation — must track |
| Demand management | IT dept raises demands — must track and pay |
| Refund tracking | Refunds take months — must show status |
| Notice management | Every business gets notices — workflow needed |
| Faceless Assessment workflow | All assessments are now faceless since 2021 |
| Rectification u/s 154 | Errors in CPC processing — must be correctable |
| Appeals (CIT(A), ITAT) | After adverse orders — must track |
| ITR-U (Updated Return) | Extended to 4 years now — major feature |
| TIS reconciliation | Companion to AIS — governs prefilling |
| AIS feedback submission | Taxpayers can dispute AIS entries — must enable |
| Tax planning what-if | Biggest differentiator vs competitors |
| Schedule AL | Mandatory for income > ₹50L — was missing |
| Form 16A/131 generation | After TDS return filing — was not designed |
| Challan 280/281 tracking | Tax payment record — not modelled |
| GST-IT reconciliation engine | Proper engine — was just mentioned, not designed |
| AMT credit carry-forward | 15-year carry-forward register — missing |

### Our Competitive Moat

ClearTax TaxCloud shut down in March 2026. 60,000+ CA users are migrating.
Every Indian CA today uses 3 separate products:
- Tally/Busy → accounting
- KDK/Gen IT → ITR filing
- Saral TDS → TDS returns

No single product integrates all three. We do.
We are also built on the new IT Act 2025 form numbering from day one — all legacy tools are retrofitting.

---

## SUMMARY: What to Do Before Writing a Single Line of IT Module Code

1. **Decide the GL question** — build now or defer to v2 with CA manual Balance Sheet?
2. **Build the Rule Engine first** — TaxRuleSet + TaxRule tables + Admin UI
3. **Design the Event Bus** — BullMQ queues for all cross-module events
4. **Run the schema migration** (8 new models from `schema_additions_needed.md`)
5. **Set up golden test datasets** — one per entity type per AY with known correct outputs
6. **Register all correct form names** in the Rule Engine (new IT Act 2025 names)
7. **Ensure TRACES 2.0 Form 121** is supported (merged 15G/15H)
8. **Plan for Dual Act** — both IT Act 1961 and IT Act 2025 simultaneously

---

*All errors above have been corrected in the original documents.*
*Architecture review is in `ARCHITECTURE_REVIEW.md`.*
*CBDT / AIS / TIS / TRACES deep research is in `05_api_research/cbdt_ais_tis_traces_research.md`.*
