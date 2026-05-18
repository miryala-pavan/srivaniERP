# Srivani Stores ERP — Complete Documentation
## Last Updated: 17 May 2026

---

### 1. PROJECT OVERVIEW

Srivani Stores ERP is a full-stack retail management system for a grocery/FMCG store in Telangana, India. It handles point-of-sale billing, goods receipt, supplier management, inventory tracking, day closure, GST reporting, and user/role management.

**Stack:**
- Backend: NestJS (Node.js), Prisma ORM v5.22.0, PostgreSQL
- Frontend: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Axios, Recharts
- Auth: JWT (Bearer token, 8-hour expiry), Argon2id password hashing
- ORM: Prisma with PostgreSQL-specific decimal types

**Ports and URLs:**
- Backend API: `http://localhost:3001` — global prefix `/api` (all routes are `/api/<controller>`)
- Frontend: `http://localhost:4000`
- Database: PostgreSQL in Docker container `srivani_postgres`, port `5555` (not 5432 — avoids native PostgreSQL conflict)
- DB name: `srivani_db`, user: `srivani`, password: `Srivani2026`

**Default Admin Credentials:**
- Username: `admin`
- Password: `Admin@2026`
- Role: SUPER_ADMIN
- Seeded automatically on first startup if no users exist

---

### 2. DATABASE SCHEMA

All models are scoped by `businessId` (multi-tenancy via single business instance). CUID is used for all primary keys unless noted.

---

#### Business

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| name | String | — | Required |
| gstin | String? | — | Optional |
| stateCode | String | "36" | Telangana default |
| stateName | String | "Telangana" | |
| address | String? | — | |
| phone | String? | — | |
| email | String? | — | |
| fssaiLicense | String? | — | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Relations: branches, users, products, suppliers, customers, taxes, departments, categories, brands, financialYears, posCounters, expenses, notifications, dayClosures, productPlus, supplierItemAliases, supplierAdvances, supplierCreditNotes, supplierPayments

Table: `business`

---

#### Branch

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| name | String | — | |
| address | String? | — | |
| phone | String? | — | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Relations: business, posCounters, salesBills, purchases, stockLedger, productBatches

Table: `branch`

---

#### FinancialYear

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| fyCode | String | — | e.g., "2526" for FY 2025-26 |
| startDate | DateTime | — | |
| endDate | DateTime | — | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |

Relations: business, billSeries, salesBills

Table: `financial_year`

---

#### User

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| username | String | — | Unique per business |
| email | String? | — | |
| passwordHash | String | — | Argon2id hash |
| fullName | String | — | |
| phone | String? | — | |
| role | UserRole | CASHIER | See enum |
| status | UserStatus | ACTIVE | See enum |
| failedLoginAttempts | Int | 0 | |
| lockedUntil | DateTime? | — | |
| lastLoginAt | DateTime? | — | |
| lastLoginIp | String? | — | |
| pin | String? | — | Argon2id hash of PIN (optional) |
| counterId | String? | — | Assigned POS counter |
| assignedCounterIds | String? | — | JSON array of counter IDs |
| createdById | String? | — | |
| createdByName | String? | — | |
| updatedById | String? | — | |
| updatedByName | String? | — | |
| deletedAt | DateTime? | — | Soft delete |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [businessId, username]

**UserRole enum:** SUPER_ADMIN, BRANCH_MANAGER, CASHIER, PURCHASE_CHECKER, ACCOUNTS_PERSON, FLOOR_SUPERVISOR, PACKING_STAFF, SALES_REP, VIEWER

**UserStatus enum:** ACTIVE, INACTIVE, SUSPENDED, LOCKED

Table: `user`

---

#### Tax

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| taxName | String | — | e.g., "GST 5%" |
| taxCode | String | — | Unique per business |
| taxRate | Decimal(5,2) | — | Percentage |
| hsnCode | String? | — | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |

Unique: [businessId, taxCode]

Table: `tax`

---

#### Department

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| name | String | — | |
| code | String | — | Unique per business, auto-slug |
| sortOrder | Int | 0 | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [businessId, code]; Index: [businessId]

Table: `department`

---

#### Category

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| departmentId | String? | — | FK → Department |
| name | String | — | |
| code | String | — | Unique per business |
| label | String | — | Display label (may include parent path) |
| parentId | String? | — | Self-referencing for sub-categories |
| sortOrder | Int | 0 | |
| isActive | Boolean | true | |
| isReturnableDefault | Boolean | true | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [businessId, code]; Index: [businessId, parentId], [businessId, departmentId]

Self-relation: "SubCategories" (parent → children)

Table: `category`

---

#### Brand

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| name | String | — | Unique per business |
| code | String? | — | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [businessId, name]; Index: [businessId]

Table: `brand`

---

#### Product

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| departmentId | String? | — | FK → Department |
| categoryId | String? | — | FK → Category |
| brandId | String? | — | FK → Brand |
| taxId | String | — | FK → Tax (required) |
| productCode | String? | — | 6-digit auto-generated, never changes |
| name | String | — | |
| shortName | String? | — | e.g., "Fortune Oil 1L" |
| barcode | String? | — | Primary barcode (backward compat) |
| hsnCode | String | — | Required |
| unitOfMeasure | String | "PCS" | |
| productType | String | "STANDARD" | STANDARD/LOOSE/REPACKED/RAW_MATERIAL/PACKAGING |
| mrp | Decimal(15,2) | — | |
| sellingPrice | Decimal(15,2) | — | |
| costPrice | Decimal(15,2)? | — | |
| gstRatePercent | Decimal(5,2)? | — | |
| reorderLevel | Decimal(15,3) | 10 | |
| minimumStockLevel | Decimal(15,3) | 0 | |
| reorderQuantity | Decimal(15,3) | 0 | |
| maximumStockLevel | Decimal(15,3) | 0 | |
| leadTimeDays | Int | 2 | |
| minSellingQty | Decimal(15,3) | 1 | |
| moqFromSupplier | Decimal(15,3) | 1 | |
| allowDecimalQty | Boolean | false | |
| allowNegativeStock | Boolean | false | |
| isForSale | Boolean | true | |
| isForPurchase | Boolean | true | |
| isRepackingItem | Boolean | false | |
| isRepackedProduct | Boolean | false | |
| repackYieldPct | Decimal(5,2) | 98 | |
| isRawMaterial | Boolean | false | |
| isPackagingMaterial | Boolean | false | |
| isPerishable | Boolean | false | |
| expiryTracking | Boolean | false | |
| shelfLifeDays | Int? | — | |
| nearExpiryAlertDays | Int? | — | |
| stockValuation | String | "FIFO" | FIFO/LIFO/WEIGHTED_AVG |
| preferredSupplierId | String? | — | |
| aisle | String? | — | |
| rackNumber | String? | — | |
| shelfPosition | String? | — | TOP/MIDDLE/BOTTOM |
| binCode | String? | — | Auto: aisle-rack-shelf |
| isReturnable | Boolean | true | |
| returnPeriodDays | Int | 7 | |
| nonReturnableReason | String? | — | |
| availableOnline | Boolean | false | |
| imageUrl | String? | — | |
| defaultPackSize | Int | 1 | |
| brandName | String? | — | Denormalized brand name |
| pluAutoBarcode | Boolean | false | |
| purchaseUnit | String | "PCS" | |
| stockUnit | String | "PCS" | |
| cessRate | Decimal(5,2) | 0 | |
| totalStock | Decimal(15,3) | 0 | Denormalized (not live) |
| isActive | Boolean | true | |
| isManuallyDisabled | Boolean | false | |
| disabledById | String? | — | |
| disabledAt | DateTime? | — | |
| disabledReason | String? | — | |
| autoInactiveReason | String? | — | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [businessId, barcode], [businessId, productCode]; Index: [businessId, isActive], [barcode], [businessId, productCode]

Table: `product`

---

#### ProductBarcode

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| productId | String | — | FK → Product |
| businessId | String | — | |
| pluId | String? | — | FK → ProductPlu |
| barcodeType | String | "EAN13" | EAN13/EAN8/CODE128/INTERNAL/SUPPLIER |
| barcodeValue | String | — | |
| isPrimary | Boolean | false | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |

Unique: [businessId, barcodeValue]; Index: [productId], [pluId]

Table: `product_barcode`

---

#### ProductPrice

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| productId | String | — | FK → Product |
| businessId | String | — | |
| priceListType | String | "RETAIL" | RETAIL/WHOLESALE/ONLINE/STAFF |
| costPrice | Decimal(15,2) | 0 | |
| sellingPrice | Decimal(15,2) | — | |
| mrp | Decimal(15,2) | — | |
| minSellingPrice | Decimal(15,2) | 0 | |
| maxDiscountPct | Decimal(5,2) | 5 | |
| effectiveFrom | DateTime | now() | |
| effectiveTo | DateTime? | — | |
| createdAt | DateTime | now() | |

Index: [productId, priceListType]

Table: `product_price`

---

#### ProductBatch

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| productId | String | — | FK → Product |
| branchId | String | — | FK → Branch |
| purchaseId | String? | — | |
| purchaseItemId | String? | — | |
| batchNumber | String? | — | |
| manufactureDate | DateTime? | — | |
| expiryDate | DateTime? | — | |
| purchaseDate | DateTime | now() | |
| quantityIn | Decimal(15,3) | — | |
| quantityOut | Decimal(15,3) | 0 | |
| remainingQty | Decimal(15,3) | — | |
| costPrice | Decimal(15,2) | — | |
| rackLocation | String? | — | |
| status | String | "ACTIVE" | ACTIVE/DEPLETED/EXPIRED |
| createdAt | DateTime | now() | |

Index: [productId, branchId], [expiryDate]

Table: `product_batch`

---

#### ProductPlu

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| productId | String | — | FK → Product |
| pluCode | String | — | 9-digit: productCode(6) + sequence(3, zero-padded) |
| displayName | String? | — | |
| costPrice | Decimal(15,2) | — | |
| basicCost | Decimal(15,2)? | — | |
| mrp | Decimal(15,2) | — | |
| sellingPrice | Decimal(15,2) | — | |
| wholesalePrice | Decimal(15,2)? | — | |
| minSellingPrice | Decimal(15,2) | 0 | |
| gstRate | Decimal(5,2)? | — | |
| cessRate | Decimal(5,2) | 0 | |
| taxInclusive | Boolean | false | |
| marginPercent | Decimal(8,4)? | — | |
| marginRs | Decimal(15,2)? | — | |
| eanCode | String? | — | |
| hsnCode | String? | — | |
| grnId | String? | — | GRN linkage |
| supplierId | String? | — | |
| batchNumber | String? | — | |
| manufacturingDate | DateTime? | — | |
| expiryDate | DateTime? | — | |
| receivedDate | DateTime | now() | |
| effectiveFrom | DateTime | now() | |
| receivedQty | Decimal(10,3) | 0 | |
| soldQty | Decimal(10,3) | 0 | |
| stockOnHand | Decimal(10,3) | 0 | |
| isDefault | Boolean | false | |
| isActive | Boolean | true | |
| isArchived | Boolean | false | |
| archivedAt | DateTime? | — | |
| archivedReason | String? | — | |
| createdById | String? | — | |
| createdByName | String? | — | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [businessId, pluCode]; Index: [productId], [businessId], [pluCode]

Table: `product_plu`

---

#### Supplier

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | FK → Business |
| name | String | — | |
| gstin | String? | — | |
| phone | String? | — | |
| email | String? | — | |
| address | String? | — | |
| stateCode | String? | — | |
| paymentTermsDays | Int | 0 | |
| creditLimit | Decimal(15,2) | 0 | |
| outstandingBalance | Decimal(15,2) | 0 | Legacy; not used for live balance |
| isGstRegistered | Boolean | true | |
| isActive | Boolean | true | |
| openingBalance | Decimal(12,2) | 0 | |
| openingBalanceDate | DateTime? | — | |
| openingBalanceType | String | "DEBIT" | DEBIT = we owe supplier |
| openingBalanceNote | String? | — | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Relations: business, purchases, itemAliases, advances, creditNotes, payments

Table: `supplier`

---

#### SupplierItemAlias

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| supplierId | String | — | FK → Supplier |
| productId | String | — | FK → Product |
| supplierCode | String? | — | Supplier's own item code |
| supplierName | String | — | Supplier's name for this product |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [supplierId, productId]; Index: [businessId, supplierId]

Table: `supplier_item_alias`

---

#### SupplierAdvance

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| supplierId | String | — | FK → Supplier |
| amount | Decimal(15,2) | — | |
| adjustedAmount | Decimal(15,2) | 0 | Total adjusted against GRNs |
| balanceAmount | Decimal(15,2) | — | Remaining advance |
| paymentMode | String | — | |
| paymentDate | DateTime | — | |
| referenceNo | String? | — | |
| notes | String? | — | |
| screenshotUrl | String? | — | |
| status | String | "AVAILABLE" | AVAILABLE/FULLY_ADJUSTED |
| createdById | String? | — | |
| createdByName | String? | — | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Index: [businessId, supplierId]

Table: `supplier_advance`

---

#### SupplierAdvanceAdjustment

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| advanceId | String | — | FK → SupplierAdvance |
| purchaseId | String | — | FK → Purchase |
| adjustedAmount | Decimal(15,2) | — | |
| adjustedAt | DateTime | now() | |
| notes | String? | — | |

Table: `supplier_advance_adjustment`

---

#### SupplierCreditNote

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| scnNumber | String | — | Unique, system-generated |
| supplierId | String | — | FK → Supplier |
| originalGrnId | String? | — | |
| originalInvoiceNo | String? | — | |
| supplierCnNumber | String? | — | Supplier's own CN number |
| cnDate | DateTime | — | |
| reason | String | — | |
| taxableAmount | Decimal(15,2) | 0 | |
| cgstAmount | Decimal(15,2) | 0 | |
| sgstAmount | Decimal(15,2) | 0 | |
| igstAmount | Decimal(15,2) | 0 | |
| cessAmount | Decimal(15,2) | 0 | |
| totalAmount | Decimal(15,2) | — | |
| itcReversal | Boolean | false | |
| status | String | "PENDING" | |
| notes | String? | — | |
| createdById | String? | — | |
| createdByName | String? | — | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Index: [businessId, supplierId]

Table: `supplier_credit_note`

---

#### SupplierCreditNoteItem

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| creditNoteId | String | — | FK → SupplierCreditNote |
| productId | String? | — | |
| productName | String | — | |
| hsnCode | String? | — | |
| quantity | Decimal(10,3) | — | |
| unitPrice | Decimal(15,2) | — | |
| gstRate | Decimal(5,2) | 0 | |
| cessRate | Decimal(5,2) | 0 | |
| gstAmount | Decimal(15,2) | 0 | |
| cessAmt | Decimal(15,2) | 0 | |
| totalAmount | Decimal(15,2) | — | |

Index: [creditNoteId]

Table: `supplier_credit_note_item`

---

#### SupplierPayment

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| supplierId | String | — | FK → Supplier |
| purchaseId | String? | — | FK → Purchase (optional) |
| invoiceReference | String? | — | |
| paymentDate | DateTime | now() | |
| amount | Decimal(15,2) | — | |
| paymentMode | String | "CASH" | |
| referenceNumber | String? | — | |
| notes | String? | — | |
| screenshotUrl | String? | — | |
| createdById | String? | — | |
| createdByName | String | — | Required |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Index: [businessId, supplierId], [businessId, purchaseId], [paymentDate]

Table: `supplier_payment`

---

#### Customer

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| name | String | — | |
| phone | String? | — | |
| email | String? | — | |
| gstin | String? | — | |
| address | String? | — | |
| stateCode | String? | — | |
| customerType | String | "REGULAR" | |
| creditLimit | Decimal(15,2) | 0 | |
| outstandingBalance | Decimal(15,2) | 0 | |
| loyaltyPoints | Int | 0 | |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Index: [businessId, phone]

Table: `customer`

---

#### BillSeries

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| financialYearId | String | — | FK → FinancialYear |
| billType | String | "TAX_INVOICE" | TAX_INVOICE/RETAIL_INVOICE/ESTIMATE/GRN |
| seriesPrefix | String | "GST/" | |
| currentNumber | Int | 0 | Auto-increments on each bill |
| numberFormat | String | "0000" | Length of zero-padded number |
| isActive | Boolean | true | |
| createdAt | DateTime | now() | |

Unique: [businessId, financialYearId, billType]

Table: `bill_series`

---

#### SalesBill

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| branchId | String | — | FK → Branch |
| financialYearId | String | — | FK → FinancialYear |
| billSeriesId | String? | — | FK → BillSeries |
| billNumber | String? | — | Auto-generated |
| billDate | DateTime | now() | |
| customerId | String? | — | FK → Customer |
| customerName | String? | — | Snapshot |
| customerPhone | String? | — | Snapshot |
| customerGstin | String? | — | Snapshot |
| supplyStateCode | String? | — | |
| saleType | SaleType | CASH | CASH/CREDIT |
| paymentMode | PaymentMode | CASH | CASH/UPI/CARD/CHEQUE/SPLIT |
| subtotalAmount | Decimal(15,2) | 0 | |
| discountAmount | Decimal(15,2) | 0 | |
| taxableAmount | Decimal(15,2) | 0 | |
| cgstTotal | Decimal(15,2) | 0 | |
| sgstTotal | Decimal(15,2) | 0 | |
| igstTotal | Decimal(15,2) | 0 | |
| totalTaxAmount | Decimal(15,2) | 0 | |
| grandTotal | Decimal(15,2) | 0 | |
| paidAmount | Decimal(15,2) | 0 | |
| balanceAmount | Decimal(15,2) | 0 | |
| billType | String | "TAX_INVOICE" | TAX_INVOICE/RETAIL_INVOICE/ESTIMATE |
| isB2B | Boolean | false | B2B if customer has GSTIN |
| estimateStatus | String? | — | OPEN/CONVERTED/EXPIRED/CANCELLED |
| validityDate | DateTime? | — | Estimate validity |
| convertedToBillId | String? | — | |
| convertedAt | DateTime? | — | |
| status | BillStatus | DRAFT | DRAFT/FINAL/CANCELLED |
| counterId | String? | — | FK → PosCounter |
| shiftId | String? | — | FK → PosShift |
| createdById | String? | — | FK → User |
| notes | String? | — | |
| cashAmount | Decimal(15,2)? | — | SPLIT breakdown |
| upiAmount | Decimal(15,2)? | — | SPLIT breakdown |
| cardAmount | Decimal(15,2)? | — | SPLIT breakdown |
| isVoided | Boolean | false | |
| voidedAt | DateTime? | — | |
| voidedById | String? | — | |
| voidedByName | String? | — | |
| voidReason | String? | — | |
| replacedByBillId | String? | — | |
| cashierName | String? | — | Immutable snapshot |
| counterName | String? | — | Immutable snapshot |
| businessName | String? | — | Immutable snapshot |
| businessGstin | String? | — | Immutable snapshot |
| businessAddress | String? | — | Immutable snapshot |
| financialYearCode | String? | — | Immutable snapshot |
| cessTotal | Decimal(15,2) | 0 | |
| isHistorical | Boolean | false | Back-dated entry flag |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

**SaleType enum:** CASH, CREDIT
**PaymentMode enum:** CASH, UPI, CARD, CHEQUE, SPLIT
**BillStatus enum:** DRAFT, FINAL, CANCELLED

Index: [branchId, billDate], [status], [customerId]

Table: `sales_bill`

---

#### SalesItem

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| billId | String | — | FK → SalesBill |
| productId | String | — | FK → Product |
| taxId | String | — | FK → Tax |
| productName | String | — | Snapshot |
| hsnCode | String? | — | |
| quantity | Decimal(15,3) | — | |
| unitPrice | Decimal(15,2) | — | |
| discountPercent | Decimal(5,2) | 0 | |
| discountAmount | Decimal(15,2) | 0 | |
| taxableAmount | Decimal(15,2) | 0 | |
| gstRatePercent | Decimal(5,2) | 0 | |
| cgstAmount | Decimal(15,2) | 0 | |
| sgstAmount | Decimal(15,2) | 0 | |
| igstAmount | Decimal(15,2) | 0 | |
| totalAmount | Decimal(15,2) | — | |
| unitOfMeasure | String? | — | |
| mrp | Decimal(15,2)? | — | Snapshot at time of sale |
| isPriceOverridden | Boolean | false | |
| originalPrice | Decimal(15,2)? | — | |
| overrideReason | String? | — | |
| cessAmount | Decimal(15,2) | 0 | |

Table: `sales_item`

---

#### Purchase (GRN)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| branchId | String | — | FK → Branch |
| supplierId | String | — | FK → Supplier |
| supplierName | String | — | Snapshot |
| supplierGstin | String? | — | Snapshot |
| grnNumber | String? | — | System-generated on PENDING |
| invoiceNumber | String | — | Supplier invoice number |
| invoiceDate | DateTime | — | |
| taxableAmount | Decimal(15,2) | 0 | |
| totalTaxAmount | Decimal(15,2) | 0 | |
| cgstTotal | Decimal(15,2) | 0 | |
| sgstTotal | Decimal(15,2) | 0 | |
| igstTotal | Decimal(15,2) | 0 | |
| grandTotal | Decimal(15,2) | 0 | |
| paidAmount | Decimal(15,2) | 0 | |
| status | PurchaseStatus | DRAFT | See enum |
| approvedById | String? | — | |
| approvedAt | DateTime? | — | |
| notes | String? | — | |
| invoiceImageUrl | String? | — | |
| invoiceControlTotal | Decimal(15,2)? | — | From invoice (for verification) |
| taxType | String | "TAX_EXCLUSIVE" | TAX_EXCLUSIVE/TAX_INCLUSIVE |
| itcEligibility | String | "ELIGIBLE" | ELIGIBLE/INELIGIBLE/PARTIAL |
| rcmApplicable | Boolean | false | Reverse Charge Mechanism |
| documentType | String | "INVOICE" | INVOICE/DEBIT_NOTE/CREDIT_NOTE |
| placeOfSupply | String? | — | |
| isInterState | Boolean | false | Auto-derived from GSTIN state codes |
| poNumber | String? | — | |
| billDiscountPercent | Decimal(5,2) | 0 | |
| billDiscountAmount | Decimal(15,2) | 0 | |
| cashDiscountPercent | Decimal(5,2) | 0 | |
| cashDiscountAmount | Decimal(15,2) | 0 | |
| freightCharges | Decimal(15,2) | 0 | |
| hamaliCharges | Decimal(15,2) | 0 | |
| otherCharges | Decimal(15,2) | 0 | |
| roundingAmount | Decimal(15,2) | 0 | |
| cessTotal | Decimal(15,2) | 0 | |
| advanceAdjusted | Decimal(15,2) | 0 | |
| amountPayable | Decimal(15,2) | 0 | grandTotal − advanceAdjusted |
| balanceAmount | Decimal(15,2) | 0 | |
| paymentDueDate | DateTime? | — | |
| paymentMode | String? | — | |
| paymentReference | String? | — | |
| paymentScreenshotUrl | String? | — | |
| paymentNotes | String? | — | |
| amendmentVersion | Int | 1 | |
| originalGrnId | String? | — | |
| isAmendment | Boolean | false | |
| amendmentDeadline | DateTime? | — | |
| amendedById | String? | — | |
| amendedByName | String? | — | |
| amendedAt | DateTime? | — | |
| approvedByName | String? | — | |
| rejectedByName | String? | — | |
| receivedDate | DateTime? | — | Actual goods received date |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

**PurchaseStatus enum:** DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED

Unique: [businessId, invoiceNumber, supplierId]; Index: [supplierId], [status]

Table: `purchase`

---

#### PurchaseItem

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| purchaseId | String | — | FK → Purchase |
| productId | String | — | FK → Product |
| taxId | String | — | FK → Tax |
| productName | String | — | Snapshot |
| hsnCode | String? | — | |
| quantity | Decimal(15,3) | — | Total received qty |
| freeQuantity | Decimal(15,3) | 0 | |
| unitPrice | Decimal(15,2) | — | Net cost price |
| schemeDiscountPercent | Decimal(5,2) | 0 | |
| retailerDiscountPercent | Decimal(5,2) | 0 | |
| taxableAmount | Decimal(15,2) | 0 | |
| gstRatePercent | Decimal(5,2) | 0 | |
| cgstAmount | Decimal(15,2) | 0 | |
| sgstAmount | Decimal(15,2) | 0 | |
| igstAmount | Decimal(15,2) | 0 | |
| totalAmount | Decimal(15,2) | — | |
| expiryDate | DateTime? | — | |
| batchNumber | String? | — | |
| pluCode | String? | — | |
| supplierProductName | String? | — | |
| mrp | Decimal(15,2)? | — | |
| sellingPrice | Decimal(15,2)? | — | |
| wsPrice | Decimal(15,2)? | — | Wholesale price |
| basicCostPrice | Decimal(15,2) | 0 | Before discounts |
| disc1Percent | Decimal(5,2) | 0 | Scheme discount 1 |
| disc2Percent | Decimal(5,2) | 0 | Scheme discount 2 |
| disc3Percent | Decimal(5,2) | 0 | Scheme discount 3 |
| disc4Percent | Decimal(5,2) | 0 | Scheme discount 4 |
| cashDiscPercent | Decimal(5,2) | 0 | |
| cashDiscAmount | Decimal(15,2) | 0 | |
| netCostPrice | Decimal(15,2) | 0 | After all discounts |
| casesReceived | Decimal(10,3) | 0 | Number of cases |
| looseQty | Decimal(10,3) | 0 | Loose units |
| packSize | Int | 1 | Units per case |
| totalReceivedQty | Decimal(10,3) | 0 | casesReceived*packSize + looseQty |
| freeCases | Decimal(10,3) | 0 | |
| freeLoose | Decimal(10,3) | 0 | |
| totalFreeQty | Decimal(10,3) | 0 | |
| totalQty | Decimal(10,3) | 0 | totalReceivedQty + totalFreeQty |
| cessRate | Decimal(5,2) | 0 | |
| cessAmount | Decimal(15,2) | 0 | |
| manufacturingDate | DateTime? | — | |
| rejectedQty | Decimal(10,3) | 0 | |
| acceptedQty | Decimal(10,3) | 0 | totalReceivedQty − rejectedQty |
| rejectionReason | String? | — | |
| rejectionAction | String? | — | |
| hamaliShare | Decimal(15,2) | 0 | Prorated hamali cost |
| freightShare | Decimal(15,2) | 0 | Prorated freight cost |
| trueCostPrice | Decimal(15,2) | 0 | netCostPrice + hamaliShare + freightShare |
| lastCostPrice | Decimal(15,2)? | — | Previous cost for comparison |
| priceChanged | Boolean | false | |
| priceChangePct | Decimal(5,2)? | — | |
| unitOfMeasure | String | "PCS" | |
| lineTotal | Decimal(15,2) | 0 | |

Table: `purchase_item`

---

#### StockLedger

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| branchId | String | — | FK → Branch |
| productId | String | — | FK → Product |
| movementType | MovementType | — | See enum |
| movementDate | DateTime | now() | |
| quantity | Decimal(15,3) | — | Positive = in, negative = out |
| referenceType | String? | — | e.g., "PURCHASE", "SALE" |
| referenceId | String? | — | ID of source record |
| notes | String? | — | |
| createdAt | DateTime | now() | |

**MovementType enum:** PURCHASE, SALE, SALE_VOID, SALE_RETURN, OPENING_STOCK, ADJUSTMENT_IN, ADJUSTMENT_OUT, TRANSFER_IN, TRANSFER_OUT, RETURN_IN, RETURN_OUT, REPACKING_IN, REPACKING_OUT

Index: [productId, branchId], [movementDate]

Table: `stock_ledger`

---

#### PosCounter

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| branchId | String | — | FK → Branch |
| name | String | — | |
| code | String | — | Unique per business |
| description | String? | — | |
| status | CounterStatus | ACTIVE | ACTIVE/INACTIVE/MAINTENANCE |
| createdAt | DateTime | now() | |

Unique: [businessId, code]

Table: `pos_counter`

---

#### PosShift

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| counterId | String | — | FK → PosCounter |
| cashierId | String | — | FK → User |
| cashierName | String? | — | Snapshot |
| branchId | String? | — | |
| shiftDate | DateTime | now() | |
| openingCash | Decimal(15,2) | 0 | |
| closingCash | Decimal(15,2)? | — | |
| expectedCash | Decimal(15,2)? | — | openingCash + totalCash |
| cashDiff | Decimal(15,2)? | — | closingCash − expectedCash |
| totalSales | Decimal(15,2) | 0 | |
| totalBills | Int | 0 | |
| totalCash | Decimal(15,2) | 0 | |
| totalUpi | Decimal(15,2) | 0 | |
| totalCard | Decimal(15,2) | 0 | |
| status | ShiftStatus | OPEN | OPEN/CLOSED/SUSPENDED |
| startTime | DateTime | now() | |
| endTime | DateTime? | — | |
| notes | String? | — | |
| createdAt | DateTime | now() | |

**ShiftStatus enum:** OPEN, CLOSED, SUSPENDED

Index: [counterId, status]

Table: `pos_shift`

---

#### HeldBill

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| holdNumber | String | — | |
| businessId | String | — | |
| branchId | String | — | |
| createdByUserId | String | — | |
| createdByName | String | — | |
| counterName | String | — | |
| billType | String | "TAX_INVOICE" | |
| customerId | String? | — | |
| customerName | String? | — | |
| customerPhone | String? | — | |
| customerGstin | String? | — | |
| isB2B | Boolean | false | |
| itemsJson | String | — | JSON-serialized cart items |
| subtotal | Decimal(15,2) | — | |
| grandTotal | Decimal(15,2) | — | |
| itemCount | Int | — | |
| status | String | "HELD" | HELD/COMPLETED/CANCELLED |
| heldAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Index: [businessId, status]

Table: `held_bill`

---

#### CreditNote (Sales Return)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| creditNoteNumber | String | — | Unique |
| businessId | String | — | |
| branchId | String | — | |
| originalBillId | String | — | |
| originalBillNumber | String | — | |
| customerId | String? | — | |
| customerName | String? | — | |
| customerPhone | String? | — | |
| reason | String | — | |
| subtotalAmount | Decimal(15,2) | — | |
| taxAmount | Decimal(15,2) | — | |
| cgstAmount | Decimal(15,2) | — | |
| sgstAmount | Decimal(15,2) | — | |
| totalAmount | Decimal(15,2) | — | |
| refundMode | String | — | CASH or STORE_CREDIT |
| refundStatus | String | "PENDING" | |
| refundCompletedAt | DateTime? | — | |
| createdById | String | — | |
| createdByName | String | — | |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Index: [businessId, originalBillId], [businessId, createdAt]

Table: `credit_note`

---

#### CreditNoteItem

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| creditNoteId | String | — | FK → CreditNote |
| productId | String | — | |
| productName | String | — | |
| hsnCode | String? | — | |
| quantity | Decimal(15,3) | — | |
| unitPrice | Decimal(15,2) | — | |
| gstRatePercent | Decimal(5,2) | — | |
| cgstAmount | Decimal(15,2) | — | |
| sgstAmount | Decimal(15,2) | — | |
| totalAmount | Decimal(15,2) | — | |
| isReturnable | Boolean | true | |

Table: `credit_note_item`

---

#### Expense

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| branchId | String? | — | |
| expenseDate | DateTime | now() | |
| category | String? | — | |
| amount | Decimal(15,2) | — | |
| paymentMode | String | "CASH" | |
| vendorName | String? | — | |
| referenceNo | String? | — | |
| description | String? | — | |
| remarks | String? | — | |
| createdAt | DateTime | now() | |

Table: `expense`

---

#### DayClosure

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| branchId | String | — | |
| closureDate | DateTime (Date) | — | Date only, no time |
| status | String | "PENDING" | PENDING/COMPLETED/AUTO_CLOSED |
| systemCash | Decimal(15,2) | 0 | Calculated from shifts |
| actualCash | Decimal(15,2)? | — | Entered by manager |
| cashDifference | Decimal(15,2)? | — | actualCash − systemCash |
| totalBills | Int | 0 | |
| totalSales | Decimal(15,2) | 0 | |
| totalCash | Decimal(15,2) | 0 | |
| totalUpi | Decimal(15,2) | 0 | |
| totalCard | Decimal(15,2) | 0 | |
| cashCounted | Boolean | false | |
| grnsPending | Int | 0 | Count of pending GRNs |
| grnsCleared | Boolean | false | |
| stockAlertsAck | Boolean | false | |
| openedById | String? | — | |
| openedByName | String? | — | |
| closedById | String? | — | |
| closedAt | DateTime? | — | |
| notes | String? | — | |
| createdAt | DateTime | now() | |

Unique: [businessId, branchId, closureDate]; Index: [businessId, closureDate]

Table: `day_closure`

---

#### Notification

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| type | String | — | OUT_OF_STOCK/LOW_STOCK/RESTOCKED/GRN_PENDING/GRN_APPROVED/GRN_REJECTED/PAYMENT_DUE/SYSTEM |
| priority | String | "NORMAL" | LOW/NORMAL/HIGH/URGENT |
| title | String | — | |
| message | String | — | |
| productId | String? | — | |
| supplierId | String? | — | |
| purchaseId | String? | — | |
| actionUrl | String? | — | |
| actionLabel | String? | — | |
| isRead | Boolean | false | |
| readAt | DateTime? | — | |
| readById | String? | — | |
| channel | String | "IN_APP" | |
| createdAt | DateTime | now() | |

Index: [businessId, isRead], [businessId, createdAt]

Table: `notification`

---

#### AuditLog

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | BigInt | autoincrement() | PK |
| userId | String? | — | FK → User |
| businessId | String? | — | |
| actionType | String | — | |
| entityType | String | — | |
| entityId | String? | — | |
| oldValues | Json? | — | |
| newValues | Json? | — | |
| ipAddress | String? | — | |
| createdAt | DateTime | now() | |

Index: [entityType, entityId], [createdAt]

Table: `audit_log`

---

#### SystemSetting

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| id | String (cuid) | cuid() | PK |
| businessId | String | — | |
| key | String | — | Setting key |
| value | String | — | Setting value (always string) |
| createdAt | DateTime | now() | |
| updatedAt | DateTime | updatedAt | |

Unique: [businessId, key]

Table: `system_setting`

---

### 3. API ENDPOINTS

All routes are prefixed with `/api`. All routes except `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/business/setup-status`, and `POST /api/business/setup` require a valid Bearer JWT token.

---

#### Auth Module (`/api/auth`)

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | POST | /api/auth/login | Login with username+password or username+PIN | No |
| 2 | POST | /api/auth/register | Register first business (blocked if any business exists) | No |
| 3 | POST | /api/auth/verify-pin | Verify current user's PIN | Yes |
| 4 | GET | /api/auth/me | Get current user profile with business info | Yes |

---

#### Business Module (`/api/business`)

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/business/setup-status | Check if business is configured | No |
| 2 | POST | /api/business/setup | Initial business setup | No |
| 3 | GET | /api/business/info | Get business details | Yes |

---

#### Suppliers Module (`/api/suppliers`)

Roles: SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON, PURCHASE_CHECKER

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | POST | /api/suppliers | Create supplier | Yes |
| 2 | GET | /api/suppliers | List suppliers (paginated, searchable) | Yes |
| 3 | GET | /api/suppliers/:id | Get supplier detail | Yes |
| 4 | PUT | /api/suppliers/:id | Update supplier | Yes |
| 5 | GET | /api/suppliers/:id/balance | Get live supplier balance (dynamic calculation) | Yes |
| 6 | GET | /api/suppliers/:id/ledger | Get supplier ledger (all transactions) | Yes |
| 7 | GET | /api/suppliers/:id/payments | List payments for a supplier | Yes |
| 8 | POST | /api/suppliers/:id/payments | Record a payment to supplier | Yes |
| 9 | DELETE | /api/suppliers/:id/payments/:paymentId | Delete a payment | Yes |
| 10 | PATCH | /api/suppliers/:id/opening-balance | Update opening balance | Yes |

---

#### GRN Module (`/api/grn`)

Roles: SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER, ACCOUNTS_PERSON (read/write)
Approve/Reject: SUPER_ADMIN, BRANCH_MANAGER only

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/grn/search-products | Search products for GRN entry | Yes |
| 2 | GET | /api/grn/supplier/:supplierId/advance | Get available advances for a supplier | Yes |
| 3 | GET | /api/grn/product/:productId/last-rates | Get last purchase rates for a product | Yes |
| 4 | POST | /api/grn/credit-notes | Create supplier credit note | Yes |
| 5 | GET | /api/grn/credit-notes | List supplier credit notes | Yes |
| 6 | GET | /api/grn | List all GRNs (paginated, filterable) | Yes |
| 7 | POST | /api/grn | Create a GRN (DRAFT status) | Yes |
| 8 | GET | /api/grn/:id | Get single GRN with items | Yes |
| 9 | PUT | /api/grn/:id | Update a GRN (only in DRAFT) | Yes |
| 10 | DELETE | /api/grn/:id | Delete a GRN (only in DRAFT) | Yes |
| 11 | GET | /api/grn/:id/print-data | Get GRN print data | Yes |
| 12 | GET | /api/grn/:id/payment-summary | Get payment summary for a GRN | Yes |
| 13 | POST | /api/grn/:id/submit | Submit GRN for approval (DRAFT → PENDING_APPROVAL) | Yes |
| 14 | POST | /api/grn/:id/approve | Approve GRN (PENDING_APPROVAL → APPROVED) | Yes (Manager+) |
| 15 | POST | /api/grn/:id/reject | Reject GRN | Yes (Manager+) |
| 16 | POST | /api/grn/:id/revert | Revert PENDING_APPROVAL → DRAFT | Yes |

---

#### Products Module (`/api/products`)

All authenticated users can access products. No role restriction at controller level.

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | POST | /api/products/tax/seed | Seed default GST taxes | Yes |
| 2 | GET | /api/products/taxes | List all taxes | Yes |
| 3 | GET | /api/products/brands | List all brands | Yes |
| 4 | POST | /api/products/brands | Create brand | Yes |
| 5 | POST | /api/products/categories | Create category | Yes |
| 6 | GET | /api/products/categories | List categories (optionally filter by departmentId) | Yes |
| 7 | GET | /api/products/categories/flat | List all categories flat | Yes |
| 8 | PATCH | /api/products/categories/:id | Update category | Yes |
| 9 | DELETE | /api/products/categories/:id | Delete category | Yes |
| 10 | GET | /api/products/categories/:id/products | List products in a category | Yes |
| 11 | POST | /api/products/subcategories | Create sub-category | Yes |
| 12 | GET | /api/products/subcategories | List sub-categories | Yes |
| 13 | PATCH | /api/products/subcategories/:id | Update sub-category | Yes |
| 14 | DELETE | /api/products/subcategories/:id | Delete sub-category | Yes |
| 15 | GET | /api/products/search | Search products by name/barcode/code | Yes |
| 16 | GET | /api/products/search-by-name | Search products by name only | Yes |
| 17 | POST | /api/products | Create product | Yes |
| 18 | GET | /api/products | List products (paginated) | Yes |
| 19 | GET | /api/products/:id | Get single product | Yes |
| 20 | PUT | /api/products/:id | Update product | Yes |
| 21 | PUT | /api/products/:id/toggle-status | Enable/disable product (DISABLE/ENABLE) | Yes |
| 22 | PUT | /api/products/:id/tax | Update product tax inline | Yes |
| 23 | GET | /api/products/:id/plus | Get all PLUs for a product | Yes |
| 24 | GET | /api/products/:id/plus/active | Get active PLUs only | Yes |
| 25 | POST | /api/products/:id/plus | Create a PLU for a product | Yes |
| 26 | PATCH | /api/products/:id/plus/:pluId | Update a PLU | Yes |
| 27 | POST | /api/products/:id/plus/:pluId/set-default | Set a PLU as default | Yes |
| 28 | POST | /api/products/:id/plus/:pluId/deactivate | Deactivate a PLU | Yes |

---

#### POS Module (`/api/pos`)

All authenticated users (CASHIER and above).

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | POST | /api/pos/counters | Create POS counter | Yes |
| 2 | GET | /api/pos/counters | List all counters | Yes |
| 3 | POST | /api/pos/shifts/open | Open a shift | Yes |
| 4 | GET | /api/pos/shifts/my-shift | Get current user's open shift | Yes |
| 5 | GET | /api/pos/shifts/current | Get current shift with business context | Yes |
| 6 | GET | /api/pos/shifts/today | Get today's shifts | Yes |
| 7 | PUT | /api/pos/shifts/:id/close | Close a shift | Yes |
| 8 | PUT | /api/pos/shifts/:id/force-close | Force-close a shift (manager) | Yes |
| 9 | POST | /api/pos/hold | Hold current bill | Yes |
| 10 | GET | /api/pos/hold | Get all held bills | Yes |
| 11 | DELETE | /api/pos/hold/:id | Delete a held bill | Yes |
| 12 | PUT | /api/pos/hold/:id/complete | Mark held bill as completed | Yes |
| 13 | POST | /api/pos/bills | Create a sales bill | Yes |
| 14 | GET | /api/pos/bills | List bills (paginated, filterable) | Yes |
| 15 | GET | /api/pos/bills/search | Search bills by number/phone/date/name | Yes |
| 16 | GET | /api/pos/bills/:id | Get single bill | Yes |
| 17 | GET | /api/pos/bills/:id/full | Get full bill detail for print | Yes |
| 18 | POST | /api/pos/bills/:id/void | Void a bill | Yes |
| 19 | POST | /api/pos/bills/:id/duplicate-print | Log duplicate print | Yes |
| 20 | GET | /api/pos/search | Search products for POS | Yes |
| 21 | GET | /api/pos/stock/:productId | Get current stock for a product | Yes |
| 22 | GET | /api/pos/product/:barcode/plus | Get PLU options by barcode | Yes |
| 23 | POST | /api/pos/credit-notes | Create a sales return credit note | Yes |
| 24 | GET | /api/pos/credit-notes | List credit notes | Yes |
| 25 | GET | /api/pos/credit-notes/:id | Get single credit note | Yes |
| 26 | GET | /api/pos/estimates | List estimates | Yes |
| 27 | POST | /api/pos/estimates/:id/convert | Convert estimate to invoice | Yes |
| 28 | PUT | /api/pos/estimates/:id/cancel | Cancel estimate | Yes |
| 29 | POST | /api/pos/historical-bill | Create historical bill (Manager+) | Yes |
| 30 | POST | /api/pos/historical-bills-bulk | Bulk create historical bills | Yes |
| 31 | GET | /api/pos/historical-bills | List historical bills | Yes |
| 32 | DELETE | /api/pos/historical-bills/:id | Delete historical bill (Manager+) | Yes |

---

#### Departments Module (`/api/departments`)

All authenticated users.

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/departments | List departments | Yes |
| 2 | POST | /api/departments | Create department | Yes |
| 3 | PATCH | /api/departments/:id | Update department | Yes |
| 4 | DELETE | /api/departments/:id | Delete department | Yes |
| 5 | GET | /api/departments/:id/categories | Get categories for a department | Yes |

---

#### Inventory Module (`/api/inventory`)

Roles: SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER, FLOOR_SUPERVISOR

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | POST | /api/inventory/adjust | Manual stock adjustment | Yes |
| 2 | GET | /api/inventory/movements | Get stock movement ledger | Yes |
| 3 | POST | /api/inventory/stock-take | Submit stock-take session | Yes |
| 4 | GET | /api/inventory/stock-take/template | Download CSV template for stock-take | Yes |
| 5 | GET | /api/inventory/stock-levels | Get current stock levels | Yes |
| 6 | GET | /api/inventory/opening-stock | Get opening stock summary | Yes |

---

#### Reports Module (`/api/reports`)

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/reports/sales/daily | Daily sales report (date range) | Yes (Manager roles) |
| 2 | GET | /api/reports/inventory/stock-summary | Stock summary report | Yes (Manager roles) |
| 3 | GET | /api/reports/inventory/low-stock | Low stock alerts | Yes (Manager roles) |
| 4 | GET | /api/reports/financial/profit | Profit report | Yes (SUPER_ADMIN, ACCOUNTS_PERSON, BRANCH_MANAGER) |
| 5 | GET | /api/reports/pos/cash-summary | POS cash summary (accessible by CASHIER for own shift) | Yes |
| 6 | GET | /api/reports/dashboard/today | Dashboard today overview | Yes (Manager roles) |

---

#### GST Reports Module (`/api/reports/gst`)

Roles: SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/reports/gst/sales-register | Sales register for month/year | Yes |
| 2 | GET | /api/reports/gst/sales-register/excel | Download sales register as Excel | Yes |
| 3 | GET | /api/reports/gst/purchase-register | Purchase register for month/year | Yes |
| 4 | GET | /api/reports/gst/purchase-register/excel | Download purchase register as Excel | Yes |
| 5 | GET | /api/reports/gst/gstr3b | GSTR-3B summary for month/year | Yes |
| 6 | GET | /api/reports/gst/hsn-summary | HSN code summary | Yes |
| 7 | GET | /api/reports/gst/gstr1-json | GSTR-1 JSON export | Yes |

---

#### Day Closure Module (`/api/day-closure`)

All authenticated users.

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/day-closure/today | Get today's closure status | Yes |
| 2 | GET | /api/day-closure/yesterday-status | Check yesterday's closure status | Yes |
| 3 | GET | /api/day-closure/history | Get closure history | Yes |
| 4 | POST | /api/day-closure/open | Open day for business | Yes |
| 5 | POST | /api/day-closure/force-close-shifts | Force-close all open shifts | Yes |
| 6 | POST | /api/day-closure/close | Close the day with actual cash count | Yes |

---

#### Users Module (`/api/users`)

Roles: SUPER_ADMIN, BRANCH_MANAGER

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/users | List all staff users | Yes |
| 2 | GET | /api/users/counters | List POS counters | Yes |
| 3 | GET | /api/users/:id | Get single user | Yes |
| 4 | POST | /api/users | Create user | Yes |
| 5 | PUT | /api/users/:id | Update user | Yes |
| 6 | PUT | /api/users/:id/reset-pin | Reset user PIN | Yes |
| 7 | PUT | /api/users/:id/toggle-active | Activate/deactivate user | Yes |

---

#### Settings Module (`/api/settings`)

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/settings/features | Get feature flags | Yes (Admin/Manager/Accounts) |
| 2 | PUT | /api/settings/features | Update feature flags | Yes (SUPER_ADMIN only) |
| 3 | GET | /api/settings/billing | Get billing settings | Yes (Admin/Manager) |
| 4 | PUT | /api/settings/billing | Update billing settings | Yes (Admin/Manager) |
| 5 | GET | /api/settings/pos | Get POS settings | Yes |
| 6 | PUT | /api/settings/pos | Update POS settings | Yes (Admin/Manager) |
| 7 | GET | /api/settings/system | Get system settings | Yes (Admin/Manager) |
| 8 | PUT | /api/settings/system | Update system settings | Yes (Admin/Manager) |
| 9 | GET | /api/settings/pos-shortcuts | Get POS keyboard shortcuts | Yes |
| 10 | PUT | /api/settings/pos-shortcuts | Update POS shortcuts | Yes (Admin/Manager) |
| 11 | GET | /api/settings/gst | Get GST settings | Yes (Admin/Manager) |
| 12 | PUT | /api/settings/gst | Update GST settings | Yes (Admin/Manager) |

---

#### Notifications Module (`/api/notifications`)

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/notifications/unread-count | Get unread notification count | Yes |
| 2 | GET | /api/notifications | List notifications (paginated, filterable) | Yes |
| 3 | PUT | /api/notifications/mark-all-read | Mark all as read (alias) | Yes |
| 4 | PUT | /api/notifications/read-all | Mark all as read | Yes |
| 5 | PUT | /api/notifications/:id/read | Mark single notification as read | Yes |

---

#### Expenses Module (`/api/expenses`)

Roles: SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/expenses/categories | Get expense categories | Yes |
| 2 | POST | /api/expenses | Create expense | Yes |
| 3 | GET | /api/expenses | List expenses | Yes |

---

#### Customers Module (`/api/customers`)

Roles: SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON, FLOOR_SUPERVISOR, SALES_REP, CASHIER

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | POST | /api/customers | Create customer | Yes |
| 2 | GET | /api/customers | List customers | Yes |
| 3 | GET | /api/customers/:id | Get customer | Yes |
| 4 | PUT | /api/customers/:id | Update customer | Yes |

---

#### Admin Module (`/api/admin`)

Roles: SUPER_ADMIN only (except /admin/taxes which also allows Manager/Checker/Accounts/Viewer)

| S.No | Method | Path | Purpose | Auth Required |
|------|--------|------|---------|---------------|
| 1 | GET | /api/admin/taxes | List all taxes (broader role access) | Yes |
| 2 | POST | /api/admin/seed | Seed default data | Yes (SUPER_ADMIN) |
| 3 | POST | /api/admin/fix-product-data | Fix product data inconsistencies | Yes (SUPER_ADMIN) |
| 4 | POST | /api/admin/seed-departments | Seed default departments | Yes (SUPER_ADMIN) |
| 5 | POST | /api/admin/repair-product-plus | Repair PLU records | Yes (SUPER_ADMIN) |
| 6 | POST | /api/admin/migrate-orphans-phase-1 | Migrate orphaned records | Yes (SUPER_ADMIN) |
| 7 | POST | /api/admin/reset-bill-series | Reset bill series numbers | Yes (SUPER_ADMIN) |

---

### 4. FRONTEND PAGES

All pages are under the Next.js App Router at `J:\SVN\SVN_26\frontend\src\app\`.

| Route | File Path | Purpose | Role Restriction |
|-------|-----------|---------|-----------------|
| /login | app/login/page.tsx | Login form | Public |
| /dashboard | app/dashboard/page.tsx | Control Tower — today's KPIs, sales chart, alerts | All |
| /dashboard/pos | app/dashboard/pos/page.tsx | Full POS terminal — cart, payment, shift, hold, print | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/bills | app/dashboard/bills/page.tsx | Bill search, view, void, reprint, return | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/estimates | app/dashboard/estimates/page.tsx | List estimates, convert to invoice, cancel | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/grn | app/dashboard/grn/page.tsx | GRN list with status tabs, credit notes tab | SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER |
| /dashboard/grn/new | app/dashboard/grn/new/page.tsx | Create new GRN | Same as GRN |
| /dashboard/grn/v2 | app/dashboard/grn/v2/page.tsx | GRN entry v2 (alternate form) | Same as GRN |
| /dashboard/grn/[id] | app/dashboard/grn/[id]/page.tsx | GRN detail view, status actions | Same as GRN |
| /dashboard/grn/[id]/print | app/dashboard/grn/[id]/print/page.tsx | GRN print layout | Same as GRN |
| /dashboard/products | app/dashboard/products/page.tsx | Product list, create/edit, toggle status | SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER |
| /dashboard/products/[id]/plu | app/dashboard/products/[id]/plu/page.tsx | PLU management for a specific product | Same as Products |
| /dashboard/products/labels | app/dashboard/products/labels/page.tsx | Print product labels | Same as Products |
| /dashboard/plu | app/dashboard/plu/page.tsx | PLU management (all products view) | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/departments | app/dashboard/departments/page.tsx | Manage departments | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/categories | app/dashboard/categories/page.tsx | Manage categories | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/subcategories | app/dashboard/subcategories/page.tsx | Manage sub-categories | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/suppliers | app/dashboard/suppliers/page.tsx | Supplier list and management | SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON |
| /dashboard/suppliers/[id] | app/dashboard/suppliers/[id]/page.tsx | Supplier detail — balance, ledger, payments, GRNs | Same |
| /dashboard/payments | app/dashboard/payments/page.tsx | Supplier payment recording and history | SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON |
| /dashboard/inventory/opening-stock | app/dashboard/inventory/opening-stock/page.tsx | Enter opening stock by branch | SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER |
| /dashboard/inventory/stock-take | app/dashboard/inventory/stock-take/page.tsx | Stock-take via manual or CSV import | Same |
| /dashboard/day-closure | app/dashboard/day-closure/page.tsx | Day open/close, cash count, shift summary | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/shifts | app/dashboard/shifts/page.tsx | Today's shifts view, force-close | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/reports | app/dashboard/reports/page.tsx | Reports dashboard — 4 report types | SUPER_ADMIN, BRANCH_MANAGER, VIEWER |
| /dashboard/reports/gst | app/dashboard/reports/gst/page.tsx | GST reports — sales/purchase register, GSTR-3B, HSN | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/historical-bills | app/dashboard/historical-bills/page.tsx | Enter pre-ERP historical bills | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/users | app/dashboard/users/page.tsx | Staff management — create, edit, PIN reset | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/settings | app/dashboard/settings/page.tsx | Billing, POS, and keyboard shortcut settings | SUPER_ADMIN, BRANCH_MANAGER |
| /dashboard/notifications | app/dashboard/notifications/page.tsx | Notification centre | All |

---

### 5. SIDEBAR NAVIGATION

Sidebar is defined in `J:\SVN\SVN_26\frontend\src\components\layout\Sidebar.tsx`. Color: `#1B4F8A` (dark blue). Version: `v1.0.0 · Telangana, India`.

**Section 1 (no label):**

| Label | Route | Roles |
|-------|-------|-------|
| Dashboard | /dashboard | All (no restriction) |
| POS | /dashboard/pos | SUPER_ADMIN, BRANCH_MANAGER |
| Bills | /dashboard/bills | SUPER_ADMIN, BRANCH_MANAGER |
| Estimates | /dashboard/estimates | SUPER_ADMIN, BRANCH_MANAGER |
| GRN | /dashboard/grn | SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER |
| Opening Stock | /dashboard/inventory/opening-stock | SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER |
| Stock Take | /dashboard/inventory/stock-take | SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER |
| Products | /dashboard/products | SUPER_ADMIN, BRANCH_MANAGER, PURCHASE_CHECKER |

**Section 2 (Catalogue):**

| Label | Route | Roles |
|-------|-------|-------|
| Departments | /dashboard/departments | SUPER_ADMIN, BRANCH_MANAGER |
| Categories | /dashboard/categories | SUPER_ADMIN, BRANCH_MANAGER |
| Sub-Categories | /dashboard/subcategories | SUPER_ADMIN, BRANCH_MANAGER |
| PLU Management | /dashboard/plu | SUPER_ADMIN, BRANCH_MANAGER |

**Section 3 (no label):**

| Label | Route | Roles |
|-------|-------|-------|
| Suppliers | /dashboard/suppliers | SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON |
| Sup. Payments | /dashboard/payments | SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTS_PERSON |
| Day Closure | /dashboard/day-closure | SUPER_ADMIN, BRANCH_MANAGER |
| Shifts | /dashboard/shifts | SUPER_ADMIN, BRANCH_MANAGER |
| Reports | /dashboard/reports | SUPER_ADMIN, BRANCH_MANAGER, VIEWER |
| GST Reports | /dashboard/reports/gst | SUPER_ADMIN, BRANCH_MANAGER |
| Historical Bills | /dashboard/historical-bills | SUPER_ADMIN, BRANCH_MANAGER |
| Staff | /dashboard/users | SUPER_ADMIN, BRANCH_MANAGER |
| Settings | /dashboard/settings | SUPER_ADMIN, BRANCH_MANAGER |

Active state: exact match for `/dashboard`, prefix match for all others.

---

### 6. USER ROLES

Defined in `UserRole` enum in schema.prisma.

| Role | Label (UI) | Description | Key Access |
|------|-----------|-------------|------------|
| SUPER_ADMIN | Owner | Full system access | Everything, including admin tools and reset |
| BRANCH_MANAGER | Manager | Day-to-day management | All except admin seed/repair tools |
| CASHIER | Cashier | POS billing only | POS module, own shift, bill creation |
| PURCHASE_CHECKER | Purchase Checker | GRN entry (not approval) | GRN create/edit, products, inventory, opening stock |
| ACCOUNTS_PERSON | Accounts | Supplier finance | Suppliers, payments, GRN view, reports, expenses |
| FLOOR_SUPERVISOR | Floor Supervisor | Inventory/stock | Inventory adjustments, stock reports |
| PACKING_STAFF | Repacking Staff | Not in sidebar | (Not assigned any sidebar routes currently) |
| SALES_REP | Sales Rep | Not in sidebar | Customer access, cash summary report |
| VIEWER | Viewer | Read-only reports | Reports only |

**Role-based visibility in Sidebar:** Items with `roles` array only show if user's role is in that array. Items without a `roles` array show to everyone.

**Role token in JWT:** The JWT payload contains `sub`, `username`, `role`, `businessId`, and `counterId`. The frontend stores token and user in `localStorage` under keys `srivani_token` and `srivani_user`.

**Session duration:** JWT expires in 8 hours. On 401 response, the frontend automatically clears token and redirects to `/login`.

---

### 7. KEY BUSINESS RULES

#### PLU Code Format
PLU code is exactly 9 digits: first 6 digits are the `productCode` (zero-padded), last 3 digits are the PLU sequence within that product (zero-padded). Example: productCode `000007`, 2nd PLU → `000007002`.

#### Supplier Balance Calculation
The supplier balance is **not stored**. It is dynamically calculated as:
`balance = openingBalance + sum(GRN grandTotals for APPROVED GRNs) − sum(payments) − sum(creditNotes)`
The `outstandingBalance` field in the Supplier model is a legacy field, not used for live balance.

#### GRN Approval Flow
- GRNs are created in **DRAFT** status. No stock movement occurs.
- Submitting (`POST /grn/:id/submit`) moves DRAFT → **PENDING_APPROVAL** and generates the GRN number.
- Approval (`POST /grn/:id/approve`) moves PENDING_APPROVAL → **APPROVED**. Only SUPER_ADMIN and BRANCH_MANAGER can approve.
- On approval, stock is added via StockLedger (PURCHASE movement), and product PLU records are created/updated.
- Rejection moves to **REJECTED** status.
- Revert moves PENDING_APPROVAL back to **DRAFT** (GRN number may remain).
- A GRN cannot be approved if its status is not PENDING_APPROVAL.
- A GRN cannot be edited or deleted unless it is in DRAFT status.
- Duplicate check: same invoiceNumber + supplierId combination is rejected.

#### Inter-State GST Detection
When creating a GRN, the system compares the first 2 digits of the supplier's GSTIN against the business's `stateCode`. If different, `isInterState = true` and IGST is applied instead of CGST+SGST.

#### Bill Types
- **TAX_INVOICE**: Full GST tax invoice with CGST/SGST breakdown. Used for B2B and standard retail.
- **RETAIL_INVOICE**: Simplified bill without GST breakup. Used for cash retail.
- **ESTIMATE**: Quotation/proforma. Has a validity date. Can be converted to TAX_INVOICE or RETAIL_INVOICE.

#### Estimates
Estimates have `estimateStatus`: OPEN → CONVERTED (when converted to bill) / EXPIRED / CANCELLED.
Default validity: configured in settings (`estimateValidityDays`, default 3 days).

#### Bill Void
A bill can be voided. A void creates a SALE_VOID stock ledger entry to reverse stock. Voided bills remain in the database with `isVoided = true`. The bill cannot be re-voided.

#### Held Bills
Held bills are stored in `HeldBill` with `itemsJson` (JSON-serialized cart). They can be recalled and completed from any counter. Status: HELD → COMPLETED/CANCELLED.

#### Historical Bills
Back-dated bills entered for periods before the ERP go-live. Marked with `isHistorical = true`. Only SUPER_ADMIN and BRANCH_MANAGER can create/delete. Used for GST compliance during transition.

#### Day Closure
Each day must be opened (`POST /day-closure/open`) before sales begin. At end of day, manager enters actual cash and closes (`POST /day-closure/close`). Day closure records total sales, cash, UPI, card, and cash difference. Unique per [businessId, branchId, closureDate].

#### Stock Ledger
Stock is tracked via the `StockLedger` table only — there is no stored current stock field that is kept live (the `Product.totalStock` field is denormalized and not reliably updated). Current stock is computed by summing `quantity` in StockLedger for a product+branch.

#### POS Shift
A cashier must have an open shift to create bills. Shift tracks opening cash, and accumulates totalBills, totalSales, totalCash, totalUpi, totalCard. On close, expectedCash = openingCash + totalCash and cashDiff = closingCash − expectedCash.

#### Payment Modes
POS supports: CASH, UPI, CARD, SPLIT. SPLIT allows entering cash, UPI, and card amounts independently. Supplier payments support: CASH, UPI, BANK_TRANSFER, CHEQUE, NEFT, RTGS.

#### B2B Detection
If a customer has a GSTIN and `autoB2BOnGstin` setting is `"true"`, the bill is automatically marked as B2B. B2B bills include full GSTIN details for GSTR-1 filing.

#### Product Code Generation
`productCode` is a 6-digit auto-incremented code (e.g., `000001`, `000002`). Once assigned, it never changes, even if the product is updated.

#### Advance Adjustment in GRN
When creating a GRN, an `advanceAdjusted` amount can be specified. The `amountPayable = grandTotal − advanceAdjusted`. A `SupplierAdvanceAdjustment` record is created linking the advance to the GRN.

#### Freight and Hamali Distribution
Freight charges and hamali (loading/unloading) charges in a GRN are distributed across line items proportionally (based on taxable amount). The `freightShare` and `hamaliShare` fields in `PurchaseItem` record each item's allocated share. `trueCostPrice = netCostPrice + hamaliShare + freightShare`.

#### GRN Number Generation
GRN number format: `{seriesPrefix}{fyCode}/{zero-padded-number}`. Example: `GRN/2526/0001`. The series must be configured via Admin → Seed or Admin → Reset Bill Series.

#### Notifications
Notifications are created automatically by the system for events like: OUT_OF_STOCK, LOW_STOCK, GRN_PENDING, GRN_APPROVED, GRN_REJECTED, PAYMENT_DUE. They are stored in the `Notification` table. The frontend polls for `unread-count`. Notifications are IN_APP channel only (no email/SMS implemented).

#### Tax Calculation (GRN)
GRN supports `TAX_EXCLUSIVE` (tax added on top of cost) and `TAX_INCLUSIVE` (tax included in the entered price). The `GrnCalculationsService` handles both modes. For TAX_INCLUSIVE: `taxable = price / (1 + gstRate/100)`.

#### POS Keyboard Shortcuts (Configurable Defaults)
- F5: Pay with Cash
- F6: Pay with UPI
- F7: Pay with Card
- F8: Print Bill
- F9: Save as Estimate
- Ctrl+H: Hold Bill
- Ctrl+B: View Held Bills
- Ctrl+N: New Bill
- Ctrl+E: Toggle Estimate Mode

---

### 8. PENDING FEATURES

The following features are referenced in the schema or code but are not fully implemented or exposed in the frontend:

1. **Expense Tracking UI**: `Expense` model exists in schema and `ExpensesController` has create/list endpoints, but there is no `/dashboard/expenses` page in the frontend sidebar or pages list.

2. **Customer Loyalty Points**: `Customer.loyaltyPoints` field exists but no endpoints or UI for earning/redeeming points.

3. **Product Batch Tracking**: `ProductBatch` model exists and is populated via GRN, but no batch-selection UI exists in POS for selling specific batches (FIFO/LIFO is specified in product but not implemented in pick logic).

4. **PACKING_STAFF and SALES_REP roles**: Defined in UserRole enum and `users/page.tsx` labels/colors, but no sidebar access and no dedicated feature module.

5. **Product Price List**: `ProductPrice` model (RETAIL/WHOLESALE/ONLINE/STAFF price types) is in schema but no endpoint or UI manages it; the `ProductPlu` approach is used instead.

6. **Multi-Branch Operations**: Schema supports multiple branches per business (Branch model, branchId on most tables) but the frontend does not expose branch switching or branch-level filtering in most pages.

7. **Opening Stock — Branch API**: The opening-stock page calls `/branches` to list branches, but no dedicated branches endpoint is documented in the controller files found. This endpoint may exist in a branches module not listed in app.module.ts, or the page falls back to a single-branch assumption.

8. **Product Repacking**: `isRepackingItem`, `isRepackedProduct`, `repackYieldPct` fields exist, and `REPACKING_IN`/`REPACKING_OUT` movement types exist, but no repacking workflow UI is present.

9. **Stock Transfer Between Branches**: `TRANSFER_IN`/`TRANSFER_OUT` movement types exist in enum, but no transfer UI or endpoint is present.

10. **GRN Amendment**: `isAmendment`, `amendmentVersion`, `originalGrnId`, `amendmentDeadline` fields exist in Purchase model but the amendment workflow has no dedicated frontend or explicit backend endpoint.

11. **Credit Notes (Sales Returns) UI**: The `CreditNote` model and POS controller endpoint (`POST /pos/credit-notes`) exist, but there is no dedicated `/dashboard/credit-notes` page visible in the sidebar.

12. **Financial Year Management**: `FinancialYear` model is present; the currently active FY is used for bill series and GRN numbering, but no UI exists to create or switch financial years.

13. **Historical Bills — B2C Consolidated Entry**: The historical-bills page supports B2C (day-level aggregate) entry, which is a GST-specific pattern. B2B entry for historical period is also supported via the same page.

---

### 9. KNOWN ISSUES

1. **Product.totalStock is denormalized**: The `totalStock` field on Product is not reliably kept in sync with the StockLedger. Live stock queries aggregate the StockLedger, but some parts of the system may read `totalStock` directly, which may be stale.

2. **GRN number seeding required**: If the Admin seed has not been run, GRN submission fails with `BadRequestException: GRN bill series not configured. Run Admin → Seed.` New installations must run `POST /api/admin/seed` after first login.

3. **No active financial year guard**: If no `FinancialYear` is marked `isActive = true`, GRN submission and bill creation will fail with `BadRequestException: No active financial year. Complete business setup first.` Financial years must be created manually.

4. **Opening Stock page calls /branches**: The opening-stock page calls `/api/branches` which is not documented in the controllers found. This endpoint may not exist or may be served by an undocumented route.

5. **Supplier outstandingBalance field is misleading**: The `Supplier.outstandingBalance` column exists in the DB (legacy) but is not updated by any current code path. The real balance is always computed dynamically. The field should be considered deprecated.

6. **Authentication stores token in localStorage**: JWT is stored in `localStorage` (not HttpOnly cookie), making it susceptible to XSS. This is a known security consideration for the current development stage.

7. **All roles allowed for product read**: The `ProductsController` only uses `JwtAuthGuard`, not `RolesGuard`, meaning any authenticated user (including CASHIER, VIEWER) can call product create/update endpoints. Role restriction is only enforced in the Sidebar for navigation, not at the API level for the products module.

8. **Admin endpoints not protected against production misuse**: `POST /api/admin/seed`, `POST /api/admin/fix-product-data`, etc., are SUPER_ADMIN-only but are destructive/data-modifying. No rate limiting or confirmation step is enforced.

9. **Hardcoded financial year start in historical-bills page**: `const FY_START = new Date('2026-04-01')` is hardcoded in `J:\SVN\SVN_26\frontend\src\app\dashboard\historical-bills\page.tsx`. This will be incorrect for future financial years.

10. **`verifyPin` fallback**: If a user has no PIN set, `verifyPin` falls back to verifying the provided PIN against the user's password hash. This may cause unexpected behavior if the user's password happens to match.

11. **GRN v2 page**: A `/dashboard/grn/v2/page.tsx` exists alongside `/dashboard/grn/new/page.tsx`. It is unclear which is canonical. The sidebar links to `/dashboard/grn` (the list page), not directly to a create route.

---

### 10. ENVIRONMENT SETUP

#### Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL)
- npm or yarn

#### Step 1: Start PostgreSQL
```
docker run -d \
  --name srivani_postgres \
  -e POSTGRES_DB=srivani_db \
  -e POSTGRES_USER=srivani \
  -e POSTGRES_PASSWORD=Srivani2026 \
  -p 5555:5432 \
  postgres:16
```

#### Step 2: Backend Setup
```
cd J:\SVN\SVN_26\backend
npm install
```

Create `.env` at `J:\SVN\SVN_26\backend\.env`:
```
DATABASE_URL="postgresql://srivani:Srivani2026@localhost:5555/srivani_db"
JWT_SECRET=srivani_jwt_super_secret_key_2026_hyderabad_telangana
JWT_EXPIRES_IN=8h
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:4000
```

Run Prisma migrations:
```
npx prisma migrate deploy
```

Or for development (creates migration from schema diff):
```
npx prisma migrate dev
```

Generate Prisma client:
```
npx prisma generate
```

Start backend:
```
npm run start:dev
```

Backend starts on `http://localhost:3001`. The admin user (`admin` / `Admin@2026`) is auto-seeded on first startup.

#### Step 3: Run Admin Seed (first time only)
After starting the backend, call:
```
POST http://localhost:3001/api/admin/seed
Authorization: Bearer <admin_token>
```
This seeds default taxes, departments, financial year, bill series (including GRN series), and POS counters.

#### Step 4: Frontend Setup
```
cd J:\SVN\SVN_26\frontend
npm install
```

Create `.env.local` at `J:\SVN\SVN_26\frontend\.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

Start frontend:
```
npm run dev -- --port 4000
```

Frontend starts on `http://localhost:4000`.

#### Step 5: Login
Navigate to `http://localhost:4000/login`.
- Username: `admin`
- Password: `Admin@2026`

#### Useful Prisma Commands
```
npx prisma studio        # Opens DB browser at localhost:5555
npx prisma db push       # Push schema without migration (dev only)
npx prisma migrate status # Check migration status
```

#### Key File Locations

| File | Purpose |
|------|---------|
| J:\SVN\SVN_26\backend\prisma\schema.prisma | Database schema (source of truth) |
| J:\SVN\SVN_26\backend\.env | Backend environment variables |
| J:\SVN\SVN_26\backend\src\app.module.ts | NestJS module registry |
| J:\SVN\SVN_26\frontend\src\lib\api.ts | Axios instance, base URL, auth interceptors |
| J:\SVN\SVN_26\frontend\src\lib\auth.ts | Token/user storage in localStorage |
| J:\SVN\SVN_26\frontend\src\components\layout\Sidebar.tsx | Navigation definition and role guards |
| J:\SVN\SVN_26\frontend\src\app\dashboard\page.tsx | Dashboard home (Control Tower) |
| J:\SVN\SVN_26\frontend\src\app\dashboard\pos\page.tsx | POS terminal (largest frontend file) |
| J:\SVN\SVN_26\frontend\next.config.mjs | Next.js configuration (minimal, no overrides) |

---
