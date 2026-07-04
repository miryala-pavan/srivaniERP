# Gap Analysis — What We Need to Resolve Before Building

> This document tracks all open questions and gaps identified before build starts.
> ✅ = resolved  ❓ = open  🔨 = design decision made, need to implement

---

## SECTION A — Business & Income Gaps

### A1. Expense Categorization Model ❓
**Gap:** The ERP currently has no general `Expense` model (only purchases/supplier bills exist).
For IT computation, we need ALL expenses categorized:
- Direct (COGS): materials, labour
- Indirect: rent, utilities, admin salaries, repairs
- Capital (not expense): asset purchases

**Resolution needed:**
- Build an Expense ledger with categories
- Map categories to IT Act heads (43B, 40A(3), revenue, capital)
- Or infer from existing Purchase data + payment data?

**Recommendation:** Add `ExpenseCategory` enum and `Expense` model. Map each category to an IT treatment.

---

### A2. Opening Balance / Migration of Old Business ✅ (Decision made)
**Gap:** Existing businesses have historical ITRs and asset blocks.
**Resolution:** Upload previous ITR (PDF or JSON) to extract:
- Opening WDV of each asset block
- Carried-forward losses (BFLA)
- Advance tax credits

Build an "IT Migration Wizard" that lets CA enter these manually if upload fails.

---

### A3. Brought-Forward Losses ❓
**Gap:** If business had losses in previous years, they can be set off:
- Business loss: carry forward 8 years (set off against business income only)
- Speculation loss: carry forward 4 years (set off against speculation only)
- Capital loss: carry forward 8 years (LTCL only against LTCG)
- Unabsorbed depreciation: carry forward INDEFINITELY

**Resolution needed:** 
- Add `LossCarryForward` model to schema (not yet added)
- During migration wizard, enter losses FY-wise
- Each year's computation automatically sets off available losses

---

### A4. Stock Valuation Method ❓
**Gap:** IT Act requires consistent stock valuation (FIFO or weighted average). Composition changes the value.
Our ERP already uses weighted average (FIFO in practice via batch costing).
**Resolution:** Confirm: does our ERP's closing stock value = IT Act acceptable method?

---

### A5. Proprietor's Personal Income ❓
**Gap:** For a proprietor's ITR-3, ALL income sources must be combined (salary from spouse's job, rental income, interest from FD).
Our ERP only has business data.

**Resolution needed:**
- Add "Personal Income" section to IT module (separate from business)
- Let proprietor/CA enter salary slips, Form 16, bank interest certificates
- These feed into the ITR-3 computation alongside business income

---

### A6. Advance Received Treatment ✅ (Decision made)
Flag advances > 90 days or at year-end for CA review. Do not auto-include as income.
Match against pending customer orders in ERP.

---

## SECTION B — Partnership-Specific Gaps

### B1. Book Profit Calculation for 40(b) ❓
**Gap:** "Book profit" for Section 40(b) salary calculation has a specific definition:
- Start from net profit (books)
- Add back: partner salary, interest, donations, taxes
- This is a CIRCULAR computation (partner salary is being computed USING book profit which INCLUDES partner salary)

**Resolution:** Two-step computation:
1. Compute P&L without partner salary/interest → preliminary book profit
2. Apply 40(b) limits to get allowed partner salary
3. Add partner interest (max 12%)
4. Final P&L = preliminary P&L − allowed salary − allowed interest
5. Firm's taxable income = this final P&L

---

### B2. Partner Separately Files ITR ❓
**Gap:** Each partner files their own ITR (ITR-2 or ITR-3) showing:
- Schedule EI: Partner's exempt profit share from firm
- Schedule BP: Partner's salary from firm (taxable)
- Interest income from firm (taxable as other sources)

**Resolution:** The IT module for the FIRM must also generate:
- Per-partner certificate showing: profit share, salary, interest
- These become inputs to each partner's personal ITR
- Do we build partner individual ITR support? → Mark as v2 initially.

---

### B3. Partnership Deed Requirements ❓
**Gap:** Section 40(b) salary is ONLY deductible if:
- Partnership deed authorizes partner salary
- Deed specifies the salary amount or basis
- Working partner status is documented

**Resolution:** Add `partnershipDeedUrl` and `deedDate` to `ItProfile`.
Flag if deed is missing/expired when computing 40(b).

---

## SECTION C — TDS Gaps

### C1. Payee PAN Verification ❓
**Gap:** TDS certificates (Form 16A) must show payee PAN. If payee doesn't give PAN:
- TDS rate doubles (usually 20%)
- Form 16A shows "PANNOTAVBL"

**Resolution:** Store PAN for every supplier. Flag "PAN missing" when TDS is flagged.
Add `supplierPan` to Supplier model (not yet present).

---

### C2. TDS Certificate Generation (Form 16A) ❓
**Gap:** After deducting and depositing TDS, the payer must issue Form 16A to payee.
This is generated from TRACES portal after the TDS return is filed.

**Resolution:** 
- v1: Tell user to download from TRACES after filing 26Q
- v2: Integrate TRACES API to auto-download + store Form 16A

---

### C3. Section 194Q and 206C(1H) Conflict ❓
**Gap:** If both buyer (194Q) and seller (206C) are above threshold, only 194Q applies.
**Resolution:** When 194Q is flagged on a purchase, check if supplier is collecting TCS.
If yes: suppress 194Q flag. If no: 194Q applies to buyer.

---

### C4. Challan (TDS Deposit) Verification ❓
**Gap:** After TDS is deposited (Challan 281), the challan details must be entered in the TDS return.
TRACES allows verification of challan via the portal.
**Resolution:** Store challan number, date, BSR code, serial number in TdsEntry model (fields already in schema ✅).

---

## SECTION D — Compliance Calendar Gaps

### D1. State-Specific GST Deadlines ❓
**Gap:** Some states have different GSTR due dates.
**Resolution:** Fetch from GST portal notification. For now, use central deadlines.

### D2. Revised Return Filing ✅ (Decision made)
Revised return = Re-file ITR before 31 December of assessment year.
Build as a separate "Revise" workflow on the existing ItReturn record.
Status: ORIGINAL → REVISED.

### D3. Demand Notices from IT Dept ❓
**Gap:** After assessment, IT dept may issue a demand notice (e.g., Section 143(1) intimation, Section 156 demand).
User needs to track these and make payment.

**Resolution:** Add `ItNotice` model:
```
{ businessId, ay, section, amount, dueDate, status: PENDING|PAID|DISPUTED }
```
Not in current schema — add in next schema revision.

---

## SECTION E — CA Workflow Gaps

### E1. CA Access to Multiple Business Accounts ❓
**Gap:** A CA assigned to multiple businesses needs ONE login to see all their clients.
**Resolution:** 
- CA user can be linked to multiple businesses (not just one)
- Need `CaBusinessLink` table: `{ caUserId, businessId, accessLevel }`
- CA dashboard shows all businesses with filing status

---

### E2. Owner Review of CA Flags ❓
**Gap:** When CA flags an issue (`CaIssueFlag`), the owner must respond.
**Resolution:** 
- Owner sees "Pending CA queries" on their dashboard
- Owner can reply with clarification or attach document
- CA can mark as resolved

**Not designed yet — add to CaIssueFlag model:**
```
ownerResponse: string?
ownerResponseDate: DateTime?
attachmentUrl: string?
status: OPEN | OWNER_REPLIED | CA_RESOLVED | ESCALATED
```

---

### E3. DSC / e-Sign for Filing ❓
**Gap:** ITR filing requires either:
- Digital Signature Certificate (DSC) — physical dongle
- Aadhar OTP (e-Verify) — most common
- Net banking verification

**Resolution:** 
- Our system generates the ITR JSON
- Filing (DSC/OTP) happens on incometaxindiaefiling.gov.in
- We cannot automate this without ERI integration
- v1: Export JSON → user uploads manually + e-verifies
- v2: ERI integration → we file programmatically

---

### E4. AIS (Annual Information Statement) Reconciliation ❓
**Gap:** AIS (replaced 26AS for most data) shows:
- All income sources the IT dept knows about
- TDS credits
- High-value transactions (property, shares, FD)
- SFT (Statement of Financial Transactions) data

**Resolution:**
- Add `AISEntry` model similar to `Form26ASEntry`
- Let CA upload AIS JSON (downloadable from IT portal)
- System reconciles AIS vs our records
- Flag discrepancies (income in AIS not in our books)

---

## SECTION F — Technology Gaps

### F1. ITR JSON Format ❓
**Gap:** We need the exact JSON schema for ITR-3, ITR-4, ITR-5 to generate the filing file.
**Resolution:** Research needed — see `05_api_research/itr_json_schema.md` (to be filled by market research agent).

### F2. Form 26AS JSON/XML Format ❓
**Gap:** 26AS can be downloaded in XML format from IT portal. We need to parse it.
**Resolution:** Research the schema and build a parser.

### F3. TRACES API ❓
**Gap:** TRACES (TDS Reconciliation Analysis and Correction Enabling System) has APIs for:
- Verifying TDS credits
- Downloading Form 26AS
- Generating Form 16/16A

**Resolution:** Research access requirements (only for ERIs? or open to registered taxpayers?)

### F4. PAN Verification API ❓
**Gap:** We should verify supplier PANs are valid.
**Resolution:** NSDL/UTI have PAN verification APIs. Check if they're accessible without ERI.

---

## SECTION G — Scope Questions (Decisions Needed)

| Question | Current Status | Recommended Answer |
|----------|---------------|-------------------|
| Support salaried proprietors with Form 16? | ❓ | Yes — add Schedule S to personal income entry |
| Support interest on housing loan (24b)? | ❓ | Yes — common for proprietors with home loans |
| Support capital gains from MF/shares? | ❓ | v2 — mark in schema, UI later |
| Support clubbing of spouse income? | ❓ | v2 — complex, defer |
| Build partner's individual ITR? | ❓ | v2 — generate PDF certificate for partner, they file separately |
| Support AY 2024-25 (last year) in parallel with 2025-26? | ❓ | Yes — must support multi-year |
| Belated/revised return workflow? | ❓ | Yes — same as original, different status |
| Foreign income / DTAA? | ❓ | Out of scope v1 |
| Private Limited company tax? | ❓ | v2 roadmap item |
