# IT Portal & Related APIs — Research Notes

> Status: Preliminary — to be updated after market research agent completes.
> Last updated: July 2026

---

## Income Tax India Portal (incometaxindiaefiling.gov.in)

### Filing Methods Available

#### 1. Online Filing (Portal)
- Direct entry on the IT portal website
- No external software needed
- Limited customization

#### 2. Offline JSON Utility
- Download Java/Excel offline utility from portal
- Fill returns offline
- Generate JSON/XML file
- Upload to portal
- **This is what our system targets for v1**

#### 3. Pre-filled JSON (Prefill)
- Portal provides pre-filled JSON based on Form 26AS, AIS, salary TDS data
- Download via portal login → "File ITR" → "Download Pre-filled JSON"
- Our system should merge pre-filled data with our computed data

#### 4. ERI (e-Return Intermediary) Integration
- Registered ERIs can file returns programmatically via API
- Requires IT dept ERI registration (separate process)
- Enables: bulk filing, automated e-verification via Aadhaar OTP API
- **Target for v2 (after ERI registration)**

---

## ERI (e-Return Intermediary) Registration

### What ERI Enables
- File ITR on behalf of multiple clients with single login
- API access to portal services
- Bulk TDS return filing
- Programmatic e-verification (Aadhaar OTP)
- PDF Form 16/16A generation from TRACES

### Who Can Register
- Any organization / individual providing IT filing services
- Must be approved by IT department
- Technical requirements: secure servers, audit trails, PAN verification

### Registration Process
1. Apply at incometax.gov.in/iec/foportal (ERI section)
2. Submit: PAN, TAN, organization details, technical infrastructure docs
3. Sign ERI agreement with IT department
4. Get ERI code after approval
5. Access API documentation (shared only with registered ERIs)

### ERI API (What We Know)
- REST-based APIs (exact endpoints not public)
- Authentication: API key + digital certificate
- Can file: ITR-1, ITR-2, ITR-3, ITR-4, ITR-5, ITR-6, ITR-7
- Can do: e-verification, status check, acknowledgment download

### ERI Timeline for Our Product
- Not feasible in v1 (needs organizational setup, compliance)
- Target: v2 after product-market fit
- Revenue model when ERI: charge per filing or subscription

---

## ITR JSON Schema

### Where to Get It
- IT portal downloads offline utility (JAR file) which contains the JSON schema
- Utility is available at: incometax.gov.in → "Download" → "ITR Forms (JSON Schema)"
- Schema changes every AY (updated after Union Budget)

### ITR-3 JSON Structure (Simplified, AY 2025-26)
```json
{
  "ITR": {
    "ITR3": {
      "CreationInfo": {
        "SWVersionNo": "1.0",
        "SWCreatedBy": "Your ERP Name",
        "JSONCreatedDate": "2025-07-28",
        "IntermediaryCity": "Hyderabad"
      },
      "Form_ITR3": {
        "AssesseeVerification": { "Capacity": "11" },
        "PartA_GEN1": {
          "PersonalInfo": {
            "AssesseeName": { "FirstName": "...", "SurName": "..." },
            "PAN": "ABCPS1234D",
            "DOB": "1975-06-15",
            "Status": "Individual-Resident",
            "ResidentialStatus": "Resident"
          },
          "FilingStatus": {
            "ReturnFileSec": "11",  // 11=original, 17=revised, 12=belated
            "OptForNewTaxRegime": "Y",
            "SeventhProvisio139": "N"
          }
        },
        "ScheduleBP": {
          "GrossProfit": 3245000,
          "TotalRevenue": 5000000,
          "Expenses": { ... },
          "NetProfit": 3245000,
          "BalanceProfit": 3245000
        },
        "ScheduleBS": { ... },
        "ScheduleDEP": {
          "DepreciationDetails": [
            {
              "BlockType": "BUILDING",
              "OpeningWDV": 500000,
              "Additions": 0,
              "Disposals": 0,
              "TotalDepr": 50000,
              "ClosingWDV": 450000
            }
          ]
        },
        "ScheduleVIA": {
          "DeductionUs80C": 0,
          "DeductionUs80D": 0,
          "TotalChapVIADed": 0
        },
        "PartB_TTI": {
          "TaxOnTotalIncome": 87450,
          "Surcharge": 0,
          "HealthEducCess": 3498,
          "TaxAndCess": 90948,
          "Relief87A": 0,
          "NetTaxLiability": 90948,
          "TaxPaid": {
            "TaxDeductSrcOnSal": 0,
            "TaxDeductSrcOnOtherThanSal": 8400,
            "AdvanceTax": 80000,
            "SelfAssessmentTax": 2548
          },
          "TaxPayable": 0,
          "Refund": 0
        },
        "Verification": {
          "Date": "2025-07-28",
          "Place": "Hyderabad",
          "NameOfPersonFiling": "...",
          "Capacity": "S",  // S=Self, R=Representative
          "Declaration": "I confirm the information is correct"
        }
      }
    }
  }
}
```

> **NOTE:** This is a simplified representation. The actual JSON schema is 500+ fields.
> Must download the actual schema from the portal for each AY before building the generator.

---

## Form 26AS — XML Format

### How to Download
- IT portal → e-File → Income Tax Returns → View Form 26AS
- Format: PDF or XML
- Our system needs XML version

### 26AS XML Structure (Key Parts)
```xml
<Form26AS xmlns="...">
  <AssesseePAN>ABCPS1234D</AssesseePAN>
  <AssesseeName>SRIVANI STORES</AssesseeName>
  <AssessmentYear>2025-26</AssessmentYear>
  
  <!-- Part A: TDS on Salary -->
  <PartA>
    <Details>
      <TaxDeductorName>EMPLOYER NAME</TaxDeductorName>
      <TAN>HYDB01234A</TAN>
      <TaxDeducted>0</TaxDeducted>
      <DateOfPayment>2025-03-31</DateOfPayment>
    </Details>
  </PartA>
  
  <!-- Part A1: TDS on Non-Salary (26Q) -->
  <PartA1>
    <Details>
      <TaxDeductorName>RAJAN CPA</TaxDeductorName>
      <TAN>HYDM01234B</TAN>
      <AmountCredited>50000</AmountCredited>
      <TaxDeducted>5000</TaxDeducted>
      <DateOfPayment>2025-03-15</DateOfPayment>
    </Details>
  </PartA1>
  
  <!-- Part B: TDS on Non-Salary (27Q for non-residents) -->
  <!-- Part C: TDS not in 26AS (advance tax, self-assessment) -->
  <!-- Part F: TCS (206C) -->
  <!-- Part G: TDS defaults (short deduction, etc.) -->
</Form26AS>
```

---

## TRACES (TDS Reconciliation Analysis and Correction Enabling System)

### Portal: traces.gov.in

### Accessible to Registered Deductors (Without ERI)
- View/download Form 26AS (deductor view)
- Download Form 16/16A (after filing 26Q/24Q)
- View TDS credit mismatch report
- Challan verification
- Correction filing for previous returns

### TRACES API (For ERIs)
- Bulk download of Form 16A for all deductees
- TAN/PAN verification
- Challan status check
- Not accessible without ERI code

---

## NSDL PAN Verification API

### Purpose
Verify that a supplier's PAN is valid and matches their name.
Prevents TDS at higher rate and ensures correct 26Q filing.

### Availability
- NSDL e-Governance provides PAN verification services
- Requires registration with NSDL and payment of per-verification fee
- Cost: approximately ₹0.50–₹2 per verification
- API: REST-based, requires API key

### Our Usage Plan
- v1: Manual PAN entry + visual format validation (10-char XXXXX0000X)
- v2: Batch verify all supplier PANs via NSDL API when user subscribes to premium

---

## GST-IT Reconciliation

### Why GST Turnover ≠ IT Turnover (Sometimes)

| GST Turnover | IT Turnover |
|-------------|-------------|
| Based on invoices (accrual, date of supply) | Same — accrual basis for business income |
| Includes advance receipts if supply made | Only if supply made |
| GST refunds reduce COGS | N/A (refund is capital receipt) |
| Composition tax included in turnover | Same |
| RCM self-invoices | Add to IT turnover only if expense deducted |

**Legitimate differences:**
- Export with zero-rated GST: included in IT turnover
- Non-GST items: excluded from GST but included in IT
- Advance: GST at receipt, IT only at supply

**Red flag differences:**
- IT turnover significantly lower than GST turnover → CA must explain
- Cash sales: not in GST, should be in IT → 40A(3) risk

### Auto-Reconciliation in Our System
Compare `ItReturn.grossRevenue` vs sum of `SalesInvoice.totalAmount` for the FY.
Flag if difference > configurable threshold (default: 1%).
