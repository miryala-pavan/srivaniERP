# Schema Additions Needed (Post Gap Analysis)

> These models are NOT in the current schema but are required before build starts.
> Add in next Prisma migration (do NOT deploy until locally tested).

---

## New Models to Add

### 1. CaBusinessLink — CA to Multiple Clients
```prisma
model CaBusinessLink {
  id          String   @id @default(uuid())
  caUserId    String
  businessId  String
  assignedBy  String   // SUPER_ADMIN userId
  assignedAt  DateTime @default(now())
  isActive    Boolean  @default(true)

  caUser   User     @relation("CaLinks", fields: [caUserId], references: [id])
  business Business @relation("BusinessCaLinks", fields: [businessId], references: [id])

  @@unique([caUserId, businessId])
  @@index([caUserId])
  @@index([businessId])
}
```

### 2. LossCarryForward — Brought-Forward Losses
```prisma
enum LossType {
  BUSINESS_LOSS         // Sec 72 — 8 years, business income only
  SPECULATION_LOSS      // Sec 73 — 4 years, speculation income only
  UNABSORBED_DEPRECIATION // Sec 32(2) — indefinite
  LONG_TERM_CAPITAL_LOSS  // Sec 74 — 8 years, LTCG only
  SHORT_TERM_CAPITAL_LOSS // Sec 74 — 8 years, any CG
  OTHER_SOURCE_LOSS     // Sec 71B — 8 years
}

model LossCarryForward {
  id              String   @id @default(uuid())
  businessId      String
  lossType        LossType
  assessmentYear  String   // 'AY 2024-25'
  openingBalance  Decimal  // loss at start of this year
  setOffThisYear  Decimal  @default(0)
  closingBalance  Decimal  // carried to next year
  expiresAY       String?  // null = indefinite (unabsorbed depreciation)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id])

  @@index([businessId])
}
```

### 3. ItNotice — IT Department Notices
```prisma
enum NoticeType {
  INTIMATION_143_1    // Automated processing intimation
  SCRUTINY_143_2      // Manual scrutiny selection
  DEFECTIVE_139_9     // Defective return notice
  DEMAND_156          // Tax demand
  PENALTY_274         // Penalty notice
  SHOW_CAUSE          // Show cause notice
  SUMMONS_131         // Summons
}

enum NoticeStatus {
  RECEIVED
  RESPONDED
  PAID
  DISPUTED
  CLOSED
}

model ItNotice {
  id              String       @id @default(uuid())
  businessId      String
  assessmentYear  String
  noticeType      NoticeType
  noticeDate      DateTime
  dueDate         DateTime
  demandAmount    Decimal?
  paneltyAmount   Decimal?
  description     String
  documentUrl     String?      // uploaded notice PDF
  status          NoticeStatus @default(RECEIVED)
  responseText    String?
  responseDate    DateTime?
  responseUrl     String?      // uploaded response PDF
  createdAt       DateTime     @default(now())

  business Business @relation(fields: [businessId], references: [id])
}
```

### 4. Expense Model — General Business Expenses
```prisma
enum ExpenseCategory {
  // Direct expenses
  COST_OF_GOODS_SOLD
  DIRECT_LABOUR
  FREIGHT_INWARD
  
  // Indirect expenses
  RENT                    // Section 194I/194IB
  SALARIES_WAGES          // Section 43B
  PF_ESI_CONTRIBUTION     // Section 43B
  ELECTRICITY_UTILITIES
  COMMUNICATION           // phone, internet
  REPAIRS_MAINTENANCE     // general P&M → 194J technical
  ADVERTISING
  PRINTING_STATIONERY
  PROFESSIONAL_FEES       // CA, lawyer → 194J professional
  BANK_CHARGES
  INSURANCE
  SECURITY_SERVICES
  VEHICLE_RUNNING
  TRAVELLING_CONVEYANCE
  DEPRECIATION            // auto-computed from asset register
  INTEREST_ON_LOAN        // Section 43B
  
  // Capital (disallowed as revenue)
  CAPITAL_PURCHASE        // → add to asset register instead
  
  // Other
  MISCELLANEOUS
}

model Expense {
  id           String          @id @default(uuid())
  businessId   String
  date         DateTime
  category     ExpenseCategory
  description  String
  amount       Decimal
  paymentMode  PaymentMode     // CASH, BANK, UPI, CHEQUE
  vendorName   String?
  vendorPan    String?
  billNumber   String?
  billDate     DateTime?
  isDisallowed Boolean         @default(false)  // 40A(3) or other
  disallowedSection String?    // '40A(3)', '43B', etc.
  disallowedAmount  Decimal?
  createdAt    DateTime        @default(now())

  business Business @relation(fields: [businessId], references: [id])
}
```

### 5. AISEntry — Annual Information Statement
```prisma
enum AISTransactionType {
  SALARY
  DIVIDEND
  INTEREST_SAVINGS
  INTEREST_FD
  PROPERTY_PURCHASE
  PROPERTY_SALE
  MF_REDEMPTION
  SECURITIES_SALE
  FOREIGN_REMITTANCE
  GST_TURNOVER
  OTHER
}

model AISEntry {
  id              String             @id @default(uuid())
  businessId      String
  assessmentYear  String
  transactionType AISTransactionType
  payerName       String?
  payerTan        String?
  amount          Decimal
  taxDeducted     Decimal?
  feedbackGiven   String?       // owner's feedback submitted to IT portal
  isReconciled    Boolean       @default(false)
  ourRecordAmount Decimal?      // matched amount from our ERP
  discrepancy     Decimal?      // difference
  uploadedAt      DateTime      @default(now())

  business Business @relation(fields: [businessId], references: [id])
}
```

### 6. PersonalIncome — Proprietor / HUF Non-Business Income
```prisma
enum SalaryIncomeType {
  SALARY_FROM_EMPLOYER
  PENSION
}

model PersonalIncome {
  id              String   @id @default(uuid())
  businessId      String   // the proprietorship / HUF
  assessmentYear  String   // 'AY 2025-26'
  
  // Schedule S — Salary Income
  hasSalaryIncome    Boolean  @default(false)
  employerName       String?
  employerTan        String?
  grossSalary        Decimal? @default(0)
  standardDeduction  Decimal? @default(75000)  // auto: 75000 for AY 25-26 new regime, 50000 old
  form16Url          String?  // uploaded PDF
  
  // Other Sources (Schedule OS)
  savingsBankInterest  Decimal? @default(0)   // 80TTA deductible
  fdInterest           Decimal? @default(0)
  dividendIncome       Decimal? @default(0)
  otherInterest        Decimal? @default(0)
  otherSourcesDesc     String?
  otherSourcesAmount   Decimal? @default(0)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id])
  
  @@unique([businessId, assessmentYear])
}

// Schedule HP — House Property Income
model HouseProperty {
  id              String  @id @default(uuid())
  businessId      String
  assessmentYear  String
  
  propertyAddress     String
  propertyType        String  // 'LET_OUT', 'SELF_OCCUPIED', 'DEEMED_LET_OUT'
  annualRentReceived  Decimal @default(0)
  municipalTaxPaid    Decimal @default(0)
  // Net Annual Value = annualRentReceived − municipalTaxPaid
  // Standard deduction = 30% of NAV
  homeLoanInterest    Decimal @default(0)  // deductible under 24(b): max 2L self-occ, no limit let-out
  
  createdAt  DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id])
  
  @@index([businessId, assessmentYear])
}
```

---

## Existing Models to Modify

### CaIssueFlag — Add Response Fields
```prisma
// Add to existing CaIssueFlag model:
ownerResponse      String?
ownerResponseAt    DateTime?
attachmentUrls     String[]
resolvedBy         String?
resolvedAt         DateTime?

// Change status enum to:
enum CaFlagStatus {
  OPEN
  OWNER_REPLIED
  CA_RESOLVED
  DISMISSED
}
```

### Supplier — Add TDS and MSME Fields
```prisma
// Add to existing Supplier model:
pan                     String?
tdsExemptReason         String?    // 'FORM_15G', 'FORM_15H', 'FORM_13', 'TRANSPORTER_PAN'
tdsExemptCertNo         String?
tdsExemptValidTill      DateTime?
lowerTdsRate            Decimal?   // from Form 13
itrFilerStatus          String?    // 'FILER', 'NON_FILER_1YR', 'NON_FILER_2YR'
isMsme                  Boolean    @default(false)
msmeUdyamNumber         String?
tdsCategory             String?    // '194C_CONTRACTOR', '194J_PROFESSIONAL', etc.
```

### Business — Add CA Link Relation
```prisma
// Add to Business model:
caLinks   CaBusinessLink[]  @relation("BusinessCaLinks")
```

### User — Add CA Link Relation
```prisma
// Add to User model:
caLinks   CaBusinessLink[]  @relation("CaLinks")
```

---

## Migration Order
1. Add enums: LossType, NoticeType, NoticeStatus, ExpenseCategory, AISTransactionType, CaFlagStatus
2. Add models: CaBusinessLink, LossCarryForward, ItNotice, Expense, AISEntry
3. Modify: CaIssueFlag (add fields), Supplier (add fields), Business (add relation), User (add relation)

All migrations must be tested locally before deploying to production.
