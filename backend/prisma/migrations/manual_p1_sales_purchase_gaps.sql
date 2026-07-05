-- Manual migration: P1.2 / P1.3 Gap Fill
-- Adds e-invoice stubs to SalesBill, fixes CreditNote IGST/CESS,
-- adds SalesDebitNote, PurchaseDebitNote, and Supplier TDS fields.
-- Safe to run multiple times (IF NOT EXISTS / DO blocks).

-- 1. SalesBill — GST compliance stubs
ALTER TABLE sales_bill
  ADD COLUMN IF NOT EXISTS "irnNumber"               TEXT,
  ADD COLUMN IF NOT EXISTS "eWayBillNumber"          TEXT,
  ADD COLUMN IF NOT EXISTS "reverseChargeApplicable" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "buyerAddress"            TEXT,
  ADD COLUMN IF NOT EXISTS "buyerPincode"            TEXT,
  ADD COLUMN IF NOT EXISTS "buyerStateCode"          TEXT;

-- 2. CreditNote — add IGST, CESS, B2B fields
ALTER TABLE credit_note
  ADD COLUMN IF NOT EXISTS "customerGstin" TEXT,
  ADD COLUMN IF NOT EXISTS "isB2B"         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "igstAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cessAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0;

-- 3. CreditNoteItem — add IGST, CESS, taxable amount
ALTER TABLE credit_note_item
  ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxableAmount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "igstAmount"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cessAmount"     DECIMAL(15,2) NOT NULL DEFAULT 0;

-- 4. SalesDebitNote
CREATE TABLE IF NOT EXISTS sales_debit_note (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"        TEXT NOT NULL,
  "branchId"          TEXT NOT NULL,
  "debitNoteNumber"   TEXT NOT NULL,
  "debitNoteDate"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "originalBillId"    TEXT,
  "originalBillNumber" TEXT,
  "customerId"        TEXT,
  "customerName"      TEXT,
  "customerGstin"     TEXT,
  "reason"            TEXT NOT NULL,
  "subtotalAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cgstAmount"        DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgstAmount"        DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igstAmount"        DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cessAmount"        DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalAmount"       DECIMAL(15,2) NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById"       TEXT,
  "createdByName"     TEXT,
  "notes"             TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_debit_note_pkey PRIMARY KEY ("id"),
  CONSTRAINT sales_debit_note_number_key UNIQUE ("debitNoteNumber")
);
CREATE INDEX IF NOT EXISTS sales_debit_note_biz_date_idx ON sales_debit_note ("businessId", "debitNoteDate");
CREATE INDEX IF NOT EXISTS sales_debit_note_customer_idx ON sales_debit_note ("businessId", "customerId");

-- 4b. SalesDebitNoteItem
CREATE TABLE IF NOT EXISTS sales_debit_note_item (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "debitNoteId"    TEXT NOT NULL,
  "productId"      TEXT,
  "productName"    TEXT NOT NULL,
  "hsnCode"        TEXT,
  "quantity"       DECIMAL(15,3) NOT NULL,
  "unitPrice"      DECIMAL(15,2) NOT NULL,
  "taxableAmount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "gstRatePercent" DECIMAL(5,2)  NOT NULL DEFAULT 0,
  "cgstAmount"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgstAmount"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igstAmount"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cessAmount"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalAmount"    DECIMAL(15,2) NOT NULL,
  CONSTRAINT sales_debit_note_item_pkey PRIMARY KEY ("id"),
  CONSTRAINT sales_debit_note_item_note_fk FOREIGN KEY ("debitNoteId") REFERENCES sales_debit_note("id")
);

-- 5. PurchaseDebitNote
CREATE TABLE IF NOT EXISTS purchase_debit_note (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "businessId"       TEXT NOT NULL,
  "debitNoteNumber"  TEXT NOT NULL,
  "debitNoteDate"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "supplierId"       TEXT NOT NULL,
  "supplierName"     TEXT NOT NULL,
  "supplierGstin"    TEXT,
  "originalGrnId"    TEXT,
  "originalInvoiceNo" TEXT,
  "reason"           TEXT NOT NULL,
  "taxableAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cgstAmount"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgstAmount"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igstAmount"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cessAmount"       DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalAmount"      DECIMAL(15,2) NOT NULL,
  "itcReversal"      BOOLEAN NOT NULL DEFAULT FALSE,
  "status"           TEXT NOT NULL DEFAULT 'DRAFT',
  "notes"            TEXT,
  "createdById"      TEXT,
  "createdByName"    TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT purchase_debit_note_pkey PRIMARY KEY ("id"),
  CONSTRAINT purchase_debit_note_number_key UNIQUE ("debitNoteNumber")
);
CREATE INDEX IF NOT EXISTS purchase_debit_note_biz_sup_idx ON purchase_debit_note ("businessId", "supplierId");
CREATE INDEX IF NOT EXISTS purchase_debit_note_biz_date_idx ON purchase_debit_note ("businessId", "debitNoteDate");

-- 5b. PurchaseDebitNoteItem
CREATE TABLE IF NOT EXISTS purchase_debit_note_item (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "debitNoteId"   TEXT NOT NULL,
  "productId"     TEXT,
  "productName"   TEXT NOT NULL,
  "hsnCode"       TEXT,
  "quantity"      DECIMAL(10,3) NOT NULL,
  "unitPrice"     DECIMAL(15,2) NOT NULL,
  "taxableAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "gstRate"       DECIMAL(5,2)  NOT NULL DEFAULT 0,
  "cgstAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgstAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igstAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cessAmount"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalAmount"   DECIMAL(15,2) NOT NULL,
  CONSTRAINT purchase_debit_note_item_pkey PRIMARY KEY ("id"),
  CONSTRAINT purchase_debit_note_item_note_fk FOREIGN KEY ("debitNoteId") REFERENCES purchase_debit_note("id")
);
CREATE INDEX IF NOT EXISTS purchase_debit_note_item_note_idx ON purchase_debit_note_item ("debitNoteId");

-- 6. Supplier — TDS fields
ALTER TABLE supplier
  ADD COLUMN IF NOT EXISTS "pan"              TEXT,
  ADD COLUMN IF NOT EXISTS "isTdsApplicable"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "tdsSection"       TEXT;
