--
-- PostgreSQL database dump
--

\restrict 7auZPTVYbLLQvYmkao6ViPlWPWKI0sl1kMARprikLapq6lUdkbvBv4dDULn9L0f

-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: srivani
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO srivani;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: srivani
--

COMMENT ON SCHEMA public IS '';


--
-- Name: BillStatus; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."BillStatus" AS ENUM (
    'DRAFT',
    'FINAL',
    'CANCELLED'
);


ALTER TYPE public."BillStatus" OWNER TO srivani;

--
-- Name: CounterStatus; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."CounterStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'MAINTENANCE'
);


ALTER TYPE public."CounterStatus" OWNER TO srivani;

--
-- Name: CustomerChannel; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."CustomerChannel" AS ENUM (
    'POS',
    'ONLINE',
    'BOTH'
);


ALTER TYPE public."CustomerChannel" OWNER TO srivani;

--
-- Name: CustomerStatus; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."CustomerStatus" AS ENUM (
    'ACTIVE',
    'BLOCKED',
    'INACTIVE'
);


ALTER TYPE public."CustomerStatus" OWNER TO srivani;

--
-- Name: MovementType; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."MovementType" AS ENUM (
    'PURCHASE',
    'SALE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'RETURN_IN',
    'RETURN_OUT',
    'REPACKING_IN',
    'REPACKING_OUT',
    'SALE_VOID',
    'SALE_RETURN',
    'OPENING_STOCK'
);


ALTER TYPE public."MovementType" OWNER TO srivani;

--
-- Name: PaymentMode; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."PaymentMode" AS ENUM (
    'CASH',
    'UPI',
    'CARD',
    'CHEQUE',
    'SPLIT'
);


ALTER TYPE public."PaymentMode" OWNER TO srivani;

--
-- Name: PurchaseStatus; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."PurchaseStatus" AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
);


ALTER TYPE public."PurchaseStatus" OWNER TO srivani;

--
-- Name: SaleType; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."SaleType" AS ENUM (
    'CASH',
    'CREDIT'
);


ALTER TYPE public."SaleType" OWNER TO srivani;

--
-- Name: ShiftStatus; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."ShiftStatus" AS ENUM (
    'OPEN',
    'CLOSED',
    'SUSPENDED'
);


ALTER TYPE public."ShiftStatus" OWNER TO srivani;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."UserRole" AS ENUM (
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'CASHIER',
    'PURCHASE_CHECKER',
    'ACCOUNTS_PERSON',
    'FLOOR_SUPERVISOR',
    'PACKING_STAFF',
    'SALES_REP',
    'VIEWER'
);


ALTER TYPE public."UserRole" OWNER TO srivani;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: srivani
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'LOCKED'
);


ALTER TYPE public."UserStatus" OWNER TO srivani;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    "userId" text,
    "businessId" text,
    "actionType" text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text,
    "oldValues" jsonb,
    "newValues" jsonb,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_log OWNER TO srivani;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: srivani
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_log_id_seq OWNER TO srivani;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: srivani
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: bill_series; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.bill_series (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "financialYearId" text NOT NULL,
    "seriesPrefix" text DEFAULT 'GST/'::text NOT NULL,
    "currentNumber" integer DEFAULT 0 NOT NULL,
    "numberFormat" text DEFAULT '0000'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "billType" text DEFAULT 'TAX_INVOICE'::text NOT NULL
);


ALTER TABLE public.bill_series OWNER TO srivani;

--
-- Name: branch; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.branch (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.branch OWNER TO srivani;

--
-- Name: brand; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.brand (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    code text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.brand OWNER TO srivani;

--
-- Name: business; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.business (
    id text NOT NULL,
    name text NOT NULL,
    gstin text,
    "stateCode" text DEFAULT '36'::text NOT NULL,
    "stateName" text DEFAULT 'Telangana'::text NOT NULL,
    address text,
    phone text,
    email text,
    "fssaiLicense" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    cin text,
    "drugLicense" text,
    "drugLicenseExpiry" timestamp(3) without time zone,
    "fireSafetyNoc" text,
    "fireSafetyNocExpiry" timestamp(3) without time zone,
    "fssaiExpiry" timestamp(3) without time zone,
    "iecCode" text,
    "liquorLicense" text,
    "liquorLicenseExpiry" timestamp(3) without time zone,
    pan text,
    "professionalTaxNo" text,
    "shopEstablishmentExpiry" timestamp(3) without time zone,
    "shopEstablishmentLicense" text,
    tan text,
    "tradeLicense" text,
    "tradeLicenseExpiry" timestamp(3) without time zone,
    "udyamRegistration" text,
    "weightsAndMeasuresExpiry" timestamp(3) without time zone,
    "weightsAndMeasuresLicense" text
);


ALTER TABLE public.business OWNER TO srivani;

--
-- Name: category; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.category (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    "parentId" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isReturnableDefault" boolean DEFAULT true NOT NULL,
    "departmentId" text
);


ALTER TABLE public.category OWNER TO srivani;

--
-- Name: credit_note; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.credit_note (
    id text NOT NULL,
    "creditNoteNumber" text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text NOT NULL,
    "originalBillId" text NOT NULL,
    "originalBillNumber" text NOT NULL,
    "customerId" text,
    "customerName" text,
    "customerPhone" text,
    reason text NOT NULL,
    "subtotalAmount" numeric(15,2) NOT NULL,
    "taxAmount" numeric(15,2) NOT NULL,
    "cgstAmount" numeric(15,2) NOT NULL,
    "sgstAmount" numeric(15,2) NOT NULL,
    "totalAmount" numeric(15,2) NOT NULL,
    "refundMode" text NOT NULL,
    "refundStatus" text DEFAULT 'PENDING'::text NOT NULL,
    "refundCompletedAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "createdByName" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.credit_note OWNER TO srivani;

--
-- Name: credit_note_item; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.credit_note_item (
    id text NOT NULL,
    "creditNoteId" text NOT NULL,
    "productId" text NOT NULL,
    "productName" text NOT NULL,
    "hsnCode" text,
    quantity numeric(15,3) NOT NULL,
    "unitPrice" numeric(15,2) NOT NULL,
    "gstRatePercent" numeric(5,2) NOT NULL,
    "cgstAmount" numeric(15,2) NOT NULL,
    "sgstAmount" numeric(15,2) NOT NULL,
    "totalAmount" numeric(15,2) NOT NULL,
    "isReturnable" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.credit_note_item OWNER TO srivani;

--
-- Name: customer; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.customer (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    gstin text,
    address text,
    "stateCode" text,
    "customerType" text DEFAULT 'REGULAR'::text NOT NULL,
    "creditLimit" numeric(15,2) DEFAULT 0 NOT NULL,
    "outstandingBalance" numeric(15,2) DEFAULT 0 NOT NULL,
    "loyaltyPoints" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    anniversary timestamp(3) without time zone,
    "billingAddress" text,
    channel public."CustomerChannel" DEFAULT 'POS'::public."CustomerChannel" NOT NULL,
    "companyName" text,
    "consentGivenAt" timestamp(3) without time zone,
    "customerCode" text,
    "customerGroup" text,
    "dateOfBirth" timestamp(3) without time zone,
    "emailOptIn" boolean DEFAULT false NOT NULL,
    "isSystemDefault" boolean DEFAULT false NOT NULL,
    "openingBalance" numeric(15,2) DEFAULT 0 NOT NULL,
    "passwordHash" text,
    "smsOptIn" boolean DEFAULT false NOT NULL,
    status public."CustomerStatus" DEFAULT 'ACTIVE'::public."CustomerStatus" NOT NULL,
    "whatsappOptIn" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.customer OWNER TO srivani;

--
-- Name: customer_address; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.customer_address (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text NOT NULL,
    label text,
    line1 text NOT NULL,
    line2 text,
    city text,
    state text,
    pincode text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.customer_address OWNER TO srivani;

--
-- Name: customer_payment; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.customer_payment (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "customerId" text NOT NULL,
    amount numeric(15,2) NOT NULL,
    "paymentMode" text NOT NULL,
    reference text,
    notes text,
    "billId" text,
    "paymentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" text NOT NULL,
    "createdByName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.customer_payment OWNER TO srivani;

--
-- Name: day_closure; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.day_closure (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text NOT NULL,
    "closureDate" date NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "systemCash" numeric(15,2) DEFAULT 0 NOT NULL,
    "actualCash" numeric(15,2),
    "cashDifference" numeric(15,2),
    "totalBills" integer DEFAULT 0 NOT NULL,
    "totalSales" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalCash" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalUpi" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalCard" numeric(15,2) DEFAULT 0 NOT NULL,
    "cashCounted" boolean DEFAULT false NOT NULL,
    "grnsPending" integer DEFAULT 0 NOT NULL,
    "grnsCleared" boolean DEFAULT false NOT NULL,
    "stockAlertsAck" boolean DEFAULT false NOT NULL,
    "closedById" text,
    "closedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "openedById" text,
    "openedByName" text
);


ALTER TABLE public.day_closure OWNER TO srivani;

--
-- Name: department; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.department (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.department OWNER TO srivani;

--
-- Name: expense; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.expense (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text,
    "expenseDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    category text,
    amount numeric(15,2) NOT NULL,
    "paymentMode" text DEFAULT 'CASH'::text NOT NULL,
    "vendorName" text,
    "referenceNo" text,
    description text,
    remarks text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.expense OWNER TO srivani;

--
-- Name: financial_year; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.financial_year (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "fyCode" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.financial_year OWNER TO srivani;

--
-- Name: held_bill; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.held_bill (
    id text NOT NULL,
    "holdNumber" text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text NOT NULL,
    "createdByUserId" text NOT NULL,
    "createdByName" text NOT NULL,
    "counterName" text NOT NULL,
    "billType" text DEFAULT 'TAX_INVOICE'::text NOT NULL,
    "customerId" text,
    "customerName" text,
    "customerPhone" text,
    "customerGstin" text,
    "isB2B" boolean DEFAULT false NOT NULL,
    "itemsJson" text NOT NULL,
    subtotal numeric(15,2) NOT NULL,
    "grandTotal" numeric(15,2) NOT NULL,
    "itemCount" integer NOT NULL,
    status text DEFAULT 'HELD'::text NOT NULL,
    "heldAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.held_bill OWNER TO srivani;

--
-- Name: notification; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.notification (
    id text NOT NULL,
    "businessId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    "productId" text,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "actionLabel" text,
    "actionUrl" text,
    channel text DEFAULT 'IN_APP'::text NOT NULL,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    "purchaseId" text,
    "readAt" timestamp(3) without time zone,
    "readById" text,
    "supplierId" text
);


ALTER TABLE public.notification OWNER TO srivani;

--
-- Name: pos_counter; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.pos_counter (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    status public."CounterStatus" DEFAULT 'ACTIVE'::public."CounterStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text
);


ALTER TABLE public.pos_counter OWNER TO srivani;

--
-- Name: pos_shift; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.pos_shift (
    id text NOT NULL,
    "counterId" text NOT NULL,
    "cashierId" text NOT NULL,
    "branchId" text,
    "shiftDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "openingCash" numeric(15,2) DEFAULT 0 NOT NULL,
    "closingCash" numeric(15,2),
    "expectedCash" numeric(15,2),
    "cashDiff" numeric(15,2),
    "totalSales" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalBills" integer DEFAULT 0 NOT NULL,
    "totalCash" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalUpi" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalCard" numeric(15,2) DEFAULT 0 NOT NULL,
    status public."ShiftStatus" DEFAULT 'OPEN'::public."ShiftStatus" NOT NULL,
    "startTime" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endTime" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "cashierName" text,
    notes text
);


ALTER TABLE public.pos_shift OWNER TO srivani;

--
-- Name: product; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.product (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "categoryId" text,
    "brandId" text,
    "taxId" text NOT NULL,
    "productCode" text,
    name text NOT NULL,
    "shortName" text,
    barcode text,
    "hsnCode" text NOT NULL,
    "unitOfMeasure" text DEFAULT 'PCS'::text NOT NULL,
    "productType" text DEFAULT 'STANDARD'::text NOT NULL,
    mrp numeric(15,2) NOT NULL,
    "sellingPrice" numeric(15,2) NOT NULL,
    "costPrice" numeric(15,2),
    "gstRatePercent" numeric(5,2),
    "reorderLevel" numeric(15,3) DEFAULT 10 NOT NULL,
    "minimumStockLevel" numeric(15,3) DEFAULT 0 NOT NULL,
    "reorderQuantity" numeric(15,3) DEFAULT 0 NOT NULL,
    "maximumStockLevel" numeric(15,3) DEFAULT 0 NOT NULL,
    "leadTimeDays" integer DEFAULT 2 NOT NULL,
    "minSellingQty" numeric(15,3) DEFAULT 1 NOT NULL,
    "moqFromSupplier" numeric(15,3) DEFAULT 1 NOT NULL,
    "allowDecimalQty" boolean DEFAULT false NOT NULL,
    "allowNegativeStock" boolean DEFAULT false NOT NULL,
    "isForSale" boolean DEFAULT true NOT NULL,
    "isForPurchase" boolean DEFAULT true NOT NULL,
    "isRepackingItem" boolean DEFAULT false NOT NULL,
    "isRepackedProduct" boolean DEFAULT false NOT NULL,
    "repackYieldPct" numeric(5,2) DEFAULT 98 NOT NULL,
    "isRawMaterial" boolean DEFAULT false NOT NULL,
    "isPackagingMaterial" boolean DEFAULT false NOT NULL,
    "isPerishable" boolean DEFAULT false NOT NULL,
    "expiryTracking" boolean DEFAULT false NOT NULL,
    "shelfLifeDays" integer,
    "nearExpiryAlertDays" integer,
    "stockValuation" text DEFAULT 'FIFO'::text NOT NULL,
    "preferredSupplierId" text,
    aisle text,
    "rackNumber" text,
    "shelfPosition" text,
    "binCode" text,
    "availableOnline" boolean DEFAULT false NOT NULL,
    "imageUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "autoInactiveReason" text,
    "disabledAt" timestamp(3) without time zone,
    "disabledById" text,
    "disabledReason" text,
    "isManuallyDisabled" boolean DEFAULT false NOT NULL,
    "isReturnable" boolean DEFAULT true NOT NULL,
    "nonReturnableReason" text,
    "returnPeriodDays" integer DEFAULT 7 NOT NULL,
    "brandName" text,
    "cessRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "defaultPackSize" integer DEFAULT 1 NOT NULL,
    "purchaseUnit" text DEFAULT 'PCS'::text NOT NULL,
    "stockUnit" text DEFAULT 'PCS'::text NOT NULL,
    "pluAutoBarcode" boolean DEFAULT false NOT NULL,
    "departmentId" text,
    "totalStock" numeric(15,3) DEFAULT 0 NOT NULL
);


ALTER TABLE public.product OWNER TO srivani;

--
-- Name: product_barcode; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.product_barcode (
    id text NOT NULL,
    "productId" text NOT NULL,
    "businessId" text NOT NULL,
    "barcodeType" text DEFAULT 'EAN13'::text NOT NULL,
    "barcodeValue" text NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "pluId" text
);


ALTER TABLE public.product_barcode OWNER TO srivani;

--
-- Name: product_batch; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.product_batch (
    id text NOT NULL,
    "productId" text NOT NULL,
    "branchId" text NOT NULL,
    "purchaseId" text,
    "purchaseItemId" text,
    "batchNumber" text,
    "manufactureDate" timestamp(3) without time zone,
    "expiryDate" timestamp(3) without time zone,
    "purchaseDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "quantityIn" numeric(15,3) NOT NULL,
    "quantityOut" numeric(15,3) DEFAULT 0 NOT NULL,
    "remainingQty" numeric(15,3) NOT NULL,
    "costPrice" numeric(15,2) NOT NULL,
    "rackLocation" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.product_batch OWNER TO srivani;

--
-- Name: product_plu; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.product_plu (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "productId" text NOT NULL,
    "pluCode" text NOT NULL,
    "displayName" text,
    "costPrice" numeric(15,2) NOT NULL,
    mrp numeric(15,2) NOT NULL,
    "sellingPrice" numeric(15,2) NOT NULL,
    "grnId" text,
    "batchNumber" text,
    "manufacturingDate" timestamp(3) without time zone,
    "expiryDate" timestamp(3) without time zone,
    "receivedDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivedQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "soldQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "stockOnHand" numeric(10,3) DEFAULT 0 NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL,
    "archivedAt" timestamp(3) without time zone,
    "archivedReason" text,
    "createdById" text,
    "createdByName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "basicCost" numeric(15,2),
    "cessRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "eanCode" text,
    "effectiveFrom" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "gstRate" numeric(5,2),
    "hsnCode" text,
    "marginPercent" numeric(8,4),
    "marginRs" numeric(15,2),
    "minSellingPrice" numeric(15,2) DEFAULT 0 NOT NULL,
    "supplierId" text,
    "taxInclusive" boolean DEFAULT false NOT NULL,
    "wholesalePrice" numeric(15,2)
);


ALTER TABLE public.product_plu OWNER TO srivani;

--
-- Name: product_price; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.product_price (
    id text NOT NULL,
    "productId" text NOT NULL,
    "businessId" text NOT NULL,
    "priceListType" text DEFAULT 'RETAIL'::text NOT NULL,
    "costPrice" numeric(15,2) DEFAULT 0 NOT NULL,
    "sellingPrice" numeric(15,2) NOT NULL,
    mrp numeric(15,2) NOT NULL,
    "minSellingPrice" numeric(15,2) DEFAULT 0 NOT NULL,
    "maxDiscountPct" numeric(5,2) DEFAULT 5 NOT NULL,
    "effectiveFrom" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "effectiveTo" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.product_price OWNER TO srivani;

--
-- Name: purchase; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.purchase (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text NOT NULL,
    "supplierId" text NOT NULL,
    "supplierName" text NOT NULL,
    "supplierGstin" text,
    "grnNumber" text,
    "invoiceNumber" text NOT NULL,
    "invoiceDate" timestamp(3) without time zone NOT NULL,
    "taxableAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalTaxAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cgstTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "sgstTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "igstTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "grandTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "paidAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    status public."PurchaseStatus" DEFAULT 'DRAFT'::public."PurchaseStatus" NOT NULL,
    "approvedById" text,
    "approvedAt" timestamp(3) without time zone,
    notes text,
    "invoiceImageUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "advanceAdjusted" numeric(15,2) DEFAULT 0 NOT NULL,
    "amendedAt" timestamp(3) without time zone,
    "amendedById" text,
    "amendedByName" text,
    "amendmentDeadline" timestamp(3) without time zone,
    "amendmentVersion" integer DEFAULT 1 NOT NULL,
    "amountPayable" numeric(15,2) DEFAULT 0 NOT NULL,
    "approvedByName" text,
    "balanceAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "billDiscountAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "billDiscountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "cashDiscountAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cashDiscountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "cessTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "documentType" text DEFAULT 'INVOICE'::text NOT NULL,
    "freightCharges" numeric(15,2) DEFAULT 0 NOT NULL,
    "hamaliCharges" numeric(15,2) DEFAULT 0 NOT NULL,
    "invoiceControlTotal" numeric(15,2),
    "isAmendment" boolean DEFAULT false NOT NULL,
    "isInterState" boolean DEFAULT false NOT NULL,
    "itcEligibility" text DEFAULT 'ELIGIBLE'::text NOT NULL,
    "originalGrnId" text,
    "otherCharges" numeric(15,2) DEFAULT 0 NOT NULL,
    "paymentDueDate" timestamp(3) without time zone,
    "paymentMode" text,
    "paymentNotes" text,
    "paymentReference" text,
    "paymentScreenshotUrl" text,
    "placeOfSupply" text,
    "poNumber" text,
    "rcmApplicable" boolean DEFAULT false NOT NULL,
    "rejectedByName" text,
    "roundingAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "taxType" text DEFAULT 'TAX_EXCLUSIVE'::text NOT NULL,
    receiveddate timestamp(3) without time zone
);


ALTER TABLE public.purchase OWNER TO srivani;

--
-- Name: purchase_item; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.purchase_item (
    id text NOT NULL,
    "purchaseId" text NOT NULL,
    "productId" text NOT NULL,
    "taxId" text NOT NULL,
    "productName" text NOT NULL,
    "hsnCode" text,
    quantity numeric(15,3) NOT NULL,
    "freeQuantity" numeric(15,3) DEFAULT 0 NOT NULL,
    "unitPrice" numeric(15,2) NOT NULL,
    "schemeDiscountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "retailerDiscountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "taxableAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "gstRatePercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "cgstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "sgstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "igstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(15,2) NOT NULL,
    "expiryDate" timestamp(3) without time zone,
    "batchNumber" text,
    "acceptedQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "basicCostPrice" numeric(15,2) DEFAULT 0 NOT NULL,
    "casesReceived" numeric(10,3) DEFAULT 0 NOT NULL,
    "cashDiscAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cashDiscPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "cessAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cessRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "disc1Percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "disc2Percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "disc3Percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "disc4Percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "freeCases" numeric(10,3) DEFAULT 0 NOT NULL,
    "freeLoose" numeric(10,3) DEFAULT 0 NOT NULL,
    "freightShare" numeric(15,2) DEFAULT 0 NOT NULL,
    "hamaliShare" numeric(15,2) DEFAULT 0 NOT NULL,
    "lastCostPrice" numeric(15,2),
    "lineTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "looseQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "manufacturingDate" timestamp(3) without time zone,
    mrp numeric(15,2),
    "netCostPrice" numeric(15,2) DEFAULT 0 NOT NULL,
    "packSize" integer DEFAULT 1 NOT NULL,
    "pluCode" text,
    "priceChangePct" numeric(5,2),
    "priceChanged" boolean DEFAULT false NOT NULL,
    "rejectedQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "rejectionAction" text,
    "rejectionReason" text,
    "sellingPrice" numeric(15,2),
    "supplierProductName" text,
    "totalFreeQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "totalQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "totalReceivedQty" numeric(10,3) DEFAULT 0 NOT NULL,
    "trueCostPrice" numeric(15,2) DEFAULT 0 NOT NULL,
    "unitOfMeasure" text DEFAULT 'PCS'::text NOT NULL,
    "wsPrice" numeric(15,2)
);


ALTER TABLE public.purchase_item OWNER TO srivani;

--
-- Name: sales_bill; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.sales_bill (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text NOT NULL,
    "financialYearId" text NOT NULL,
    "billSeriesId" text,
    "billNumber" text,
    "billDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "customerId" text,
    "customerName" text,
    "customerPhone" text,
    "customerGstin" text,
    "supplyStateCode" text,
    "saleType" public."SaleType" DEFAULT 'CASH'::public."SaleType" NOT NULL,
    "paymentMode" public."PaymentMode" DEFAULT 'CASH'::public."PaymentMode" NOT NULL,
    "subtotalAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "taxableAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cgstTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "sgstTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "igstTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalTaxAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "grandTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "paidAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "balanceAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    status public."BillStatus" DEFAULT 'DRAFT'::public."BillStatus" NOT NULL,
    "counterId" text,
    "shiftId" text,
    "createdById" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "billType" text DEFAULT 'TAX_INVOICE'::text NOT NULL,
    "convertedAt" timestamp(3) without time zone,
    "convertedToBillId" text,
    "estimateStatus" text,
    "isB2B" boolean DEFAULT false NOT NULL,
    "validityDate" timestamp(3) without time zone,
    "cardAmount" numeric(15,2),
    "cashAmount" numeric(15,2),
    "isVoided" boolean DEFAULT false NOT NULL,
    "replacedByBillId" text,
    "upiAmount" numeric(15,2),
    "voidReason" text,
    "voidedAt" timestamp(3) without time zone,
    "voidedById" text,
    "voidedByName" text,
    "businessAddress" text,
    "businessGstin" text,
    "businessName" text,
    "cashierName" text,
    "counterName" text,
    "financialYearCode" text,
    "cessTotal" numeric(15,2) DEFAULT 0 NOT NULL,
    "isHistorical" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.sales_bill OWNER TO srivani;

--
-- Name: sales_item; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.sales_item (
    id text NOT NULL,
    "billId" text NOT NULL,
    "productId" text NOT NULL,
    "taxId" text NOT NULL,
    "productName" text NOT NULL,
    "hsnCode" text,
    quantity numeric(15,3) NOT NULL,
    "unitPrice" numeric(15,2) NOT NULL,
    "discountPercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "taxableAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "gstRatePercent" numeric(5,2) DEFAULT 0 NOT NULL,
    "cgstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "sgstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "igstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(15,2) NOT NULL,
    "unitOfMeasure" text,
    "isPriceOverridden" boolean DEFAULT false NOT NULL,
    "originalPrice" numeric(15,2),
    "overrideReason" text,
    mrp numeric(15,2),
    "cessAmount" numeric(15,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.sales_item OWNER TO srivani;

--
-- Name: stock_ledger; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.stock_ledger (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "branchId" text NOT NULL,
    "productId" text NOT NULL,
    "movementType" public."MovementType" NOT NULL,
    "movementDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    quantity numeric(15,3) NOT NULL,
    "referenceType" text,
    "referenceId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.stock_ledger OWNER TO srivani;

--
-- Name: supplier; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.supplier (
    id text NOT NULL,
    "businessId" text NOT NULL,
    name text NOT NULL,
    gstin text,
    phone text,
    email text,
    address text,
    "stateCode" text,
    "paymentTermsDays" integer DEFAULT 0 NOT NULL,
    "creditLimit" numeric(15,2) DEFAULT 0 NOT NULL,
    "isGstRegistered" boolean DEFAULT true NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "openingBalance" numeric(12,2) DEFAULT 0 NOT NULL,
    "openingBalanceDate" timestamp(3) without time zone,
    "openingBalanceType" text DEFAULT 'DEBIT'::text NOT NULL,
    "openingBalanceNote" text
);


ALTER TABLE public.supplier OWNER TO srivani;

--
-- Name: supplier_advance; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.supplier_advance (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "supplierId" text NOT NULL,
    amount numeric(15,2) NOT NULL,
    "adjustedAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "balanceAmount" numeric(15,2) NOT NULL,
    "paymentMode" text NOT NULL,
    "paymentDate" timestamp(3) without time zone NOT NULL,
    "referenceNo" text,
    notes text,
    "screenshotUrl" text,
    status text DEFAULT 'AVAILABLE'::text NOT NULL,
    "createdById" text,
    "createdByName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.supplier_advance OWNER TO srivani;

--
-- Name: supplier_advance_adjustment; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.supplier_advance_adjustment (
    id text NOT NULL,
    "advanceId" text NOT NULL,
    "purchaseId" text NOT NULL,
    "adjustedAmount" numeric(15,2) NOT NULL,
    "adjustedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);


ALTER TABLE public.supplier_advance_adjustment OWNER TO srivani;

--
-- Name: supplier_credit_note; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.supplier_credit_note (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "scnNumber" text NOT NULL,
    "supplierId" text NOT NULL,
    "originalGrnId" text,
    "originalInvoiceNo" text,
    "supplierCnNumber" text,
    "cnDate" timestamp(3) without time zone NOT NULL,
    reason text NOT NULL,
    "taxableAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cgstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "sgstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "igstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cessAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(15,2) NOT NULL,
    "itcReversal" boolean DEFAULT false NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text,
    "createdById" text,
    "createdByName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.supplier_credit_note OWNER TO srivani;

--
-- Name: supplier_credit_note_item; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.supplier_credit_note_item (
    id text NOT NULL,
    "creditNoteId" text NOT NULL,
    "productId" text,
    "productName" text NOT NULL,
    "hsnCode" text,
    quantity numeric(10,3) NOT NULL,
    "unitPrice" numeric(15,2) NOT NULL,
    "gstRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "cessRate" numeric(5,2) DEFAULT 0 NOT NULL,
    "gstAmount" numeric(15,2) DEFAULT 0 NOT NULL,
    "cessAmt" numeric(15,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(15,2) NOT NULL
);


ALTER TABLE public.supplier_credit_note_item OWNER TO srivani;

--
-- Name: supplier_item_alias; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.supplier_item_alias (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "supplierId" text NOT NULL,
    "productId" text NOT NULL,
    "supplierCode" text,
    "supplierName" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.supplier_item_alias OWNER TO srivani;

--
-- Name: supplier_payment; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.supplier_payment (
    id text NOT NULL,
    amount numeric(15,2) NOT NULL,
    notes text,
    "businessId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text,
    "createdByName" text NOT NULL,
    "invoiceReference" text,
    "paymentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paymentMode" text DEFAULT 'CASH'::text NOT NULL,
    "purchaseId" text,
    "referenceNumber" text,
    "screenshotUrl" text,
    "supplierId" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.supplier_payment OWNER TO srivani;

--
-- Name: system_setting; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.system_setting (
    id text NOT NULL,
    "businessId" text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.system_setting OWNER TO srivani;

--
-- Name: tax; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public.tax (
    id text NOT NULL,
    "businessId" text NOT NULL,
    "taxName" text NOT NULL,
    "taxCode" text NOT NULL,
    "taxRate" numeric(5,2) NOT NULL,
    "hsnCode" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tax OWNER TO srivani;

--
-- Name: user; Type: TABLE; Schema: public; Owner: srivani
--

CREATE TABLE public."user" (
    id text NOT NULL,
    "businessId" text NOT NULL,
    username text NOT NULL,
    email text,
    "passwordHash" text NOT NULL,
    "fullName" text NOT NULL,
    phone text,
    role public."UserRole" DEFAULT 'CASHIER'::public."UserRole" NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "failedLoginAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "lastLoginAt" timestamp(3) without time zone,
    "lastLoginIp" text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    pin text,
    "counterId" text,
    "assignedCounterIds" text,
    "createdById" text,
    "createdByName" text,
    "updatedById" text,
    "updatedByName" text
);


ALTER TABLE public."user" OWNER TO srivani;

--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.audit_log (id, "userId", "businessId", "actionType", "entityType", "entityId", "oldValues", "newValues", "ipAddress", "createdAt") FROM stdin;
1	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmonz56my005j12mdghmgrxwq	\N	{"mrp": 200.0, "name": "Gold Drop 1ltr", "productCode": "000006", "sellingPrice": 175.0}	\N	2026-05-02 06:42:16.678
2	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_DISABLED	Product	cmonyv3bx005c12md2wn5c4cw	{"isManuallyDisabled": false}	{"isManuallyDisabled": true}	\N	2026-05-02 07:42:30.305
3	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_ENABLED	Product	cmonyv3bx005c12md2wn5c4cw	{"isManuallyDisabled": true}	{"isManuallyDisabled": false}	\N	2026-05-02 07:42:32.133
4	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmonz56my005j12mdghmgrxwq	{"mrp": 200.0, "name": "Gold Drop 1ltr", "isActive": true, "sellingPrice": 175.0}	{"mrp": 200.0, "name": "Gold Drop 1ltr", "isActive": true, "sellingPrice": 175.0}	\N	2026-05-02 07:42:59.489
5	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_DISABLED	Product	cmonyv3bg005412mdnlh0paqm	{"isManuallyDisabled": false}	{"isManuallyDisabled": true}	\N	2026-05-03 01:23:37.649
6	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_ENABLED	Product	cmonyv3bg005412mdnlh0paqm	{"isManuallyDisabled": true}	{"isManuallyDisabled": false}	\N	2026-05-03 01:23:59.796
7	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_DISABLED	Product	cmonyv3bg005412mdnlh0paqm	{"isManuallyDisabled": false}	{"isManuallyDisabled": true}	\N	2026-05-03 01:28:47.064
8	cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	DUPLICATE_BILL_PRINTED	sales_bill	cmopqrnfy0002r6z2gzebwd2r	\N	{"at": "2026-05-03T12:26:42.587Z", "counter": "POS", "printedBy": "admin", "billNumber": "GST/2026-27/0012"}	\N	2026-05-03 12:26:42.588
9	cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	CREDIT_NOTE_CREATED	credit_note	cmoptc1f5000wr6z27wkay9tz	\N	{"refundMode": "STORE_CREDIT", "totalAmount": 20, "creditNoteNumber": "CN/2026-27/0001", "originalBillNumber": "GST/2026-27/0014"}	\N	2026-05-03 13:35:11.163
10	cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	DUPLICATE_BILL_PRINTED	sales_bill	cmoptb78e000gr6z2as3fgof5	\N	{"at": "2026-05-03T13:35:16.054Z", "counter": "POS", "printedBy": "admin", "billNumber": "GST/2026-27/0014"}	\N	2026-05-03 13:35:16.055
11	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_ENABLED	Product	cmonyv3bg005412mdnlh0paqm	{"isManuallyDisabled": true}	{"isManuallyDisabled": false}	\N	2026-05-03 13:44:43.939
12	cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	DUPLICATE_BILL_PRINTED	sales_bill	cmoq0lmdn0014r6z2gt275xq8	\N	{"at": "2026-05-03T17:51:41.053Z", "counter": "POS", "printedBy": "admin", "billNumber": "GST/2026-27/0015"}	\N	2026-05-03 17:51:41.054
13	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmozxc8fo000413kfhttz5rgf	\N	{"name": "SABENA DISH WASH POWDER 900G", "productCode": "000007"}	\N	2026-05-10 15:25:00.482
14	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp04b462000b13kf6so6e4qc	\N	{"name": "RUCHI MUSTARD OIL 830ML", "productCode": "000008"}	\N	2026-05-10 18:40:05.606
15	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp04esoi000g13kfto0cx14p	\N	{"name": "RUCHI MUSTARD OIL 450ML", "productCode": "000009"}	\N	2026-05-10 18:42:57.343
16	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp04i53o000l13kfuhd1wc8x	\N	{"name": "RUCHI SOYA GRANULES 1KG", "productCode": "000010"}	\N	2026-05-10 18:45:33.405
17	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp04lu01000q13kfevzrttza	\N	{"name": "RUCHI SOYA CHUNKS 200G", "productCode": "000011"}	\N	2026-05-10 18:48:25.648
18	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp5azwa80008klsfrwob8ddx	\N	{"name": "Ruchi Mustard OIL 450ML", "productCode": "000012"}	\N	2026-05-14 09:46:10.375
19	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmp5azwa80008klsfrwob8ddx	{"mrp": 115.0, "name": "Ruchi Mustard OIL 450ML", "isActive": true, "sellingPrice": 112.0}	{"mrp": 115.0, "name": "Ruchi Mustard OIL 450ML", "isActive": true, "sellingPrice": 112.0}	\N	2026-05-15 05:12:41.805
20	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp8555px0004p6sn54gnaxij	\N	{"name": "Johnsons BABY Powder 100g", "productCode": "000013"}	\N	2026-05-16 09:25:36.711
21	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp858ezo000dp6sn8o91ac1c	\N	{"name": "Johnsons BABY Shampoo", "productCode": "000014"}	\N	2026-05-16 09:28:08.688
22	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp85b3r1000mp6sn0llkx04p	\N	{"name": "Johnsons BABY OIL 100ml", "productCode": "000015"}	\N	2026-05-16 09:30:14.089
23	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp85dyke000xp6sn55fpfd9i	\N	{"name": "Stayfree Secure Night", "productCode": "000016"}	\N	2026-05-16 09:32:27.342
24	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmp858ezo000dp6sn8o91ac1c	{"mrp": 111.0, "name": "Johnsons BABY Shampoo", "isActive": true, "sellingPrice": 109.0}	{"mrp": 111.0, "name": "Johnsons BABY Shampoo 100ml", "isActive": true, "sellingPrice": 109.0}	\N	2026-05-16 09:33:16.283
25	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp8llspy0002r50a99hlxpvr	\N	{"name": "Test_dept_cascade", "productCode": "000017"}	\N	2026-05-16 17:06:26.879
26	cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	UPDATE	Business	cmonyq6yl000012mdyhe1kk88	{"name": "Srivani Stores", "email": null, "gstin": null, "phone": null, "address": null, "stateCode": "36", "stateName": "Telangana", "fssaiLicense": null}	{"name": "Srivani Stores", "email": "srivanistore.srd@gmail.com", "gstin": "36ABCDE1234F1ZS", "phone": "9876543210", "address": "H.No 1-2-3, Main Road, Srd, Telangana", "stateCode": "36", "stateName": "Telangana", "fssaiLicense": "12345678901234"}	\N	2026-05-17 13:45:40.961
27	cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	UPDATE	Business	cmonyq6yl000012mdyhe1kk88	{"name": "Srivani Stores", "email": "srivanistore.srd@gmail.com", "gstin": "36ABCDE1234F1ZS", "phone": "9876543210", "address": "H.No 1-2-3, Main Road, Srd, Telangana", "stateCode": "36", "stateName": "Telangana", "fssaiLicense": "12345678901234"}	{"name": "Srivani Stores", "email": "srivanistore.srd@gmail.com", "gstin": "36AESPM7617R1ZE", "phone": "9382828484", "address": "3-5-14, OPP NEW BUS STAND , MAIN ROAD SANGAREDDY, 502001", "stateCode": "36", "stateName": "Telangana", "fssaiLicense": "13623026000336"}	\N	2026-05-17 13:49:06.195
28	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp9w7zed0009ytnopx516vlh	\N	{"name": "Sunfeast Mom's Magic 5/- X 12", "productCode": "000017"}	\N	2026-05-17 14:51:24.295
29	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp9wb0t3000iytnow683wlpd	\N	{"name": "Sunfeast Mom's Magic 10/-", "productCode": "000018"}	\N	2026-05-17 14:53:46.09
30	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmp9w7zed0009ytnopx516vlh	{"mrp": 60.0, "name": "Sunfeast Mom's Magic 5/- X 12", "isActive": true, "sellingPrice": 55.0}	{"mrp": 60.0, "name": "Sunfeast Mom's Magic 5/- X 12", "isActive": true, "sellingPrice": 55.0}	\N	2026-05-17 14:54:00.054
31	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmp9wb0t3000iytnow683wlpd	{"mrp": 10.0, "name": "Sunfeast Mom's Magic 10/-", "isActive": true, "sellingPrice": 10.0}	{"mrp": 10.0, "name": "Sunfeast Mom's Magic 10/-", "isActive": true, "sellingPrice": 10.0}	\N	2026-05-17 14:54:54.117
32	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmp9wnxor000rytnoquct5x5b	\N	{"name": "Yippee Noodles 90/-", "productCode": "000019"}	\N	2026-05-17 15:03:48.574
33	cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	UPDATE	Business	cmonyq6yl000012mdyhe1kk88	{"id": "cmonyq6yl000012mdyhe1kk88", "cin": null, "pan": null, "tan": null, "name": "Srivani Stores", "email": "srivanistore.srd@gmail.com", "gstin": "36AESPM7617R1ZE", "phone": "9382828484", "address": "3-5-14, OPP NEW BUS STAND , MAIN ROAD SANGAREDDY, 502001", "iecCode": null, "isActive": true, "createdAt": "2026-05-02T06:30:37.245Z", "stateCode": "36", "stateName": "Telangana", "updatedAt": "2026-05-17T13:49:06.190Z", "drugLicense": null, "fssaiExpiry": null, "fssaiLicense": "13623026000336", "tradeLicense": null, "fireSafetyNoc": null, "liquorLicense": null, "drugLicenseExpiry": null, "professionalTaxNo": null, "udyamRegistration": null, "tradeLicenseExpiry": null, "fireSafetyNocExpiry": null, "liquorLicenseExpiry": null, "shopEstablishmentExpiry": null, "shopEstablishmentLicense": null, "weightsAndMeasuresExpiry": null, "weightsAndMeasuresLicense": null}	{"id": "cmonyq6yl000012mdyhe1kk88", "cin": null, "pan": "ABCDE1234F", "tan": "ABCD12345E", "name": "Srivani Stores", "email": "srivanistore.srd@gmail.com", "gstin": "36ABCDE1234F1ZS", "phone": "9876543210", "address": "H.No 1-2-3, Main Road, Srd, Telangana 506002", "iecCode": null, "isActive": true, "createdAt": "2026-05-02T06:30:37.245Z", "stateCode": "36", "stateName": "Telangana", "updatedAt": "2026-05-17T17:12:46.548Z", "drugLicense": null, "fssaiExpiry": "2027-03-31T00:00:00.000Z", "fssaiLicense": "12345678901234", "tradeLicense": "TL-HYD-2024-001", "fireSafetyNoc": null, "liquorLicense": null, "drugLicenseExpiry": null, "professionalTaxNo": "PT1234567", "udyamRegistration": "UDYAM-TS-10-0001234", "tradeLicenseExpiry": "2027-12-31T00:00:00.000Z", "fireSafetyNocExpiry": null, "liquorLicenseExpiry": null, "shopEstablishmentExpiry": "2027-12-31T00:00:00.000Z", "shopEstablishmentLicense": "SE-HYD-2024-001", "weightsAndMeasuresExpiry": null, "weightsAndMeasuresLicense": null}	\N	2026-05-17 17:12:46.553
34	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmonyv3ax004w12mdphs0j89j	{"mrp": 120.0, "name": "Sunflower Oil 1L", "isActive": true, "sellingPrice": 115.0}	{"mrp": 120.0, "name": "Sunflower Oil 1L", "isActive": true, "sellingPrice": 115.0}	\N	2026-05-18 05:02:40.944
35	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmonyv3ax004w12mdphs0j89j	{"mrp": 120.0, "name": "Sunflower Oil 1L", "isActive": true, "sellingPrice": 115.0}	{"mrp": 120.0, "name": "Sunflower Oil 1L", "isActive": true, "sellingPrice": 115.0}	\N	2026-05-18 08:22:33.264
36	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_UPDATED	Product	cmonyv3ax004w12mdphs0j89j	{"mrp": 120.0, "name": "Sunflower Oil 1L", "isActive": true, "sellingPrice": 115.0}	{"mrp": 120.0, "name": "Sunflower Oil 1L", "isActive": true, "sellingPrice": 115.0}	\N	2026-05-18 08:31:51.767
37	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmpb2tjr9000432e9d1539q7o	\N	{"name": "Three Mango Chilli Powder 500g", "productCode": "000020"}	\N	2026-05-18 10:43:54.325
38	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmpcgn219000bf0y7vxb5ln4a	\N	{"name": "Mangaldeep 3 In 1 Agarbathi 55/-", "productCode": "000021"}	\N	2026-05-19 09:58:32.222
39	\N	cmonyq6yl000012mdyhe1kk88	PRODUCT_CREATED	Product	cmpcgq23i000kf0y7b3wvcnm4	\N	{"name": "Mangaldeep Sadhvi Agarbathi 35/-", "productCode": "000022"}	\N	2026-05-19 10:00:52.27
\.


--
-- Data for Name: bill_series; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.bill_series (id, "businessId", "financialYearId", "seriesPrefix", "currentNumber", "numberFormat", "isActive", "createdAt", "billType") FROM stdin;
cmonyv34l000812mdbd7b401f	cmonyq6yl000012mdyhe1kk88	cmonyv34h000612mdb1dt28fi	GST/	25	0000	t	2026-05-02 06:34:25.557	TAX_INVOICE
cmozadn2p0001ygnfld6d18d0	cmonyq6yl000012mdyhe1kk88	cmonyv34h000612mdb1dt28fi	GRN/	15	00000	t	2026-05-10 04:42:14.93	GRN
cmop2z0pv0001wtff4ml5m4ov	cmonyq6yl000012mdyhe1kk88	cmonyv34h000612mdb1dt28fi	INV/	2	0000	t	2026-05-03 01:17:13.7	RETAIL_INVOICE
cmoptc1f3000vr6z28ispuhbr	cmonyq6yl000012mdyhe1kk88	cmonyv34h000612mdb1dt28fi	CN/	1	0000	t	2026-05-03 13:35:11.151	CREDIT_NOTE
cmop2z0q10003wtffvejzs21g	cmonyq6yl000012mdyhe1kk88	cmonyv34h000612mdb1dt28fi	EST/	5	0000	t	2026-05-03 01:17:13.706	ESTIMATE
cmozadn2u0003ygnfiux6y3xi	cmonyq6yl000012mdyhe1kk88	cmonyv34h000612mdb1dt28fi	SCN/	0	0000	t	2026-05-10 04:42:14.935	SCN
\.


--
-- Data for Name: branch; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.branch (id, "businessId", name, address, phone, "isActive", "createdAt", "updatedAt") FROM stdin;
cmonyv34b000412mdn97p0tp8	cmonyq6yl000012mdyhe1kk88	Main Branch	Main Store Location	\N	t	2026-05-02 06:34:25.547	2026-05-02 06:34:25.547
\.


--
-- Data for Name: brand; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.brand (id, "businessId", name, "isActive", "createdAt", code, "updatedAt") FROM stdin;
cmp5axrk80005klsft6bxs1fp	cmonyq6yl000012mdyhe1kk88	RUCHI	t	2026-05-14 09:44:30.92	\N	2026-05-14 09:44:30.92
cmp85362g0001p6snqp0x9atx	cmonyq6yl000012mdyhe1kk88	JOHNSONS	t	2026-05-16 09:24:03.831	\N	2026-05-16 09:24:03.831
cmp85d7rq000up6sntxsyuobz	cmonyq6yl000012mdyhe1kk88	STAYFREE	t	2026-05-16 09:31:52.597	\N	2026-05-16 09:31:52.597
cmp8o6d9c00049q0likl19fka	cmonyq6yl000012mdyhe1kk88	Srivani	t	2026-05-16 18:18:25.824	SRIVANI	2026-05-16 18:18:25.824
cmp9vtumy0003ytno8l2suhu5	cmonyq6yl000012mdyhe1kk88	ITC	t	2026-05-17 14:40:24.921	\N	2026-05-17 14:40:24.921
cmp9vy35x0006ytnovxuyuxaa	cmonyq6yl000012mdyhe1kk88	Sunfeast	t	2026-05-17 14:43:42.597	\N	2026-05-17 14:43:42.597
cmpb2pnot000132e99mc2l9zb	cmonyq6yl000012mdyhe1kk88	Swasthik	t	2026-05-18 10:40:52.782	\N	2026-05-18 10:40:52.782
cmpcgiev30008f0y7j24f6bvd	cmonyq6yl000012mdyhe1kk88	mangaldeep	t	2026-05-19 09:54:55.551	\N	2026-05-19 09:54:55.551
\.


--
-- Data for Name: business; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.business (id, name, gstin, "stateCode", "stateName", address, phone, email, "fssaiLicense", "isActive", "createdAt", "updatedAt", cin, "drugLicense", "drugLicenseExpiry", "fireSafetyNoc", "fireSafetyNocExpiry", "fssaiExpiry", "iecCode", "liquorLicense", "liquorLicenseExpiry", pan, "professionalTaxNo", "shopEstablishmentExpiry", "shopEstablishmentLicense", tan, "tradeLicense", "tradeLicenseExpiry", "udyamRegistration", "weightsAndMeasuresExpiry", "weightsAndMeasuresLicense") FROM stdin;
cmonyq6yl000012mdyhe1kk88	Srivani Stores	36ABCDE1234F1ZS	36	Telangana	H.No 1-2-3, Main Road, Srd, Telangana 506002	9876543210	srivanistore.srd@gmail.com	12345678901234	t	2026-05-02 06:30:37.245	2026-05-17 17:12:46.548	\N	\N	\N	\N	\N	2027-03-31 00:00:00	\N	\N	\N	ABCDE1234F	PT1234567	2027-12-31 00:00:00	SE-HYD-2024-001	ABCD12345E	TL-HYD-2024-001	2027-12-31 00:00:00	UDYAM-TS-10-0001234	\N	\N
\.


--
-- Data for Name: category; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.category (id, "businessId", name, code, label, "parentId", "sortOrder", "isActive", "createdAt", "updatedAt", "isReturnableDefault", "departmentId") FROM stdin;
cmp8fc1qw0003xsiawn7i0hjk	cmonyq6yl000012mdyhe1kk88	Staples & Grains	FOOD_01	Staples & Grains	\N	1	t	2026-05-16 14:10:54.297	2026-05-16 14:10:54.297	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1r20005xsiaw2s54ktn	cmonyq6yl000012mdyhe1kk88	General	FOOD_01_GEN	General	cmp8fc1qw0003xsiawn7i0hjk	1	t	2026-05-16 14:10:54.303	2026-05-16 14:10:54.303	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1r60007xsia390etpmp	cmonyq6yl000012mdyhe1kk88	Pulses & Lentils	FOOD_02	Pulses & Lentils	\N	2	t	2026-05-16 14:10:54.306	2026-05-16 14:10:54.306	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1ra0009xsia30kq191v	cmonyq6yl000012mdyhe1kk88	General	FOOD_02_GEN	General	cmp8fc1r60007xsia390etpmp	1	t	2026-05-16 14:10:54.31	2026-05-16 14:10:54.31	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1s5000rxsia7oheq7xv	cmonyq6yl000012mdyhe1kk88	Dairy & Eggs	FOOD_07	Dairy & Eggs	\N	7	t	2026-05-16 14:10:54.342	2026-05-16 14:10:54.342	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1s9000txsiak1exx81x	cmonyq6yl000012mdyhe1kk88	General	FOOD_07_GEN	General	cmp8fc1s5000rxsia7oheq7xv	1	t	2026-05-16 14:10:54.345	2026-05-16 14:10:54.345	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1rd000bxsiatmfwhix2	cmonyq6yl000012mdyhe1kk88	Oils & Ghee	FOOD_03	Oils & Ghee	\N	3	t	2026-05-16 14:10:54.313	2026-05-16 14:10:54.313	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1rh000dxsiax323isx6	cmonyq6yl000012mdyhe1kk88	General	FOOD_03_GEN	General	cmp8fc1rd000bxsiatmfwhix2	1	t	2026-05-16 14:10:54.318	2026-05-16 14:10:54.318	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1rl000fxsiaw2rb476u	cmonyq6yl000012mdyhe1kk88	Spices & Masalas	FOOD_04	Spices & Masalas	\N	4	t	2026-05-16 14:10:54.321	2026-05-16 14:10:54.321	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1ro000hxsiay2l6exra	cmonyq6yl000012mdyhe1kk88	General	FOOD_04_GEN	General	cmp8fc1rl000fxsiaw2rb476u	1	t	2026-05-16 14:10:54.325	2026-05-16 14:10:54.325	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1rr000jxsiaqefnttby	cmonyq6yl000012mdyhe1kk88	Condiments & Sauces	FOOD_05	Condiments & Sauces	\N	5	t	2026-05-16 14:10:54.328	2026-05-16 14:10:54.328	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1rv000lxsial6w2dj4j	cmonyq6yl000012mdyhe1kk88	General	FOOD_05_GEN	General	cmp8fc1rr000jxsiaqefnttby	1	t	2026-05-16 14:10:54.332	2026-05-16 14:10:54.332	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1ry000nxsia043481v7	cmonyq6yl000012mdyhe1kk88	Sugar & Sweeteners	FOOD_06	Sugar & Sweeteners	\N	6	t	2026-05-16 14:10:54.335	2026-05-16 14:10:54.335	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1s2000pxsiaperz4kzc	cmonyq6yl000012mdyhe1kk88	General	FOOD_06_GEN	General	cmp8fc1ry000nxsia043481v7	1	t	2026-05-16 14:10:54.338	2026-05-16 14:10:54.338	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1sc000vxsia8step3s3	cmonyq6yl000012mdyhe1kk88	Beverages - Hot	FOOD_08	Beverages - Hot	\N	8	t	2026-05-16 14:10:54.349	2026-05-16 14:10:54.349	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1sf000xxsiafd0nit3t	cmonyq6yl000012mdyhe1kk88	General	FOOD_08_GEN	General	cmp8fc1sc000vxsia8step3s3	1	t	2026-05-16 14:10:54.352	2026-05-16 14:10:54.352	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1sj000zxsia48mlpj3g	cmonyq6yl000012mdyhe1kk88	Beverages - Cold	FOOD_09	Beverages - Cold	\N	9	t	2026-05-16 14:10:54.356	2026-05-16 14:10:54.356	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1sm0011xsia797oqiih	cmonyq6yl000012mdyhe1kk88	General	FOOD_09_GEN	General	cmp8fc1sj000zxsia48mlpj3g	1	t	2026-05-16 14:10:54.359	2026-05-16 14:10:54.359	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1sq0013xsiaseko90ro	cmonyq6yl000012mdyhe1kk88	Snacks & Namkeen	FOOD_10	Snacks & Namkeen	\N	10	t	2026-05-16 14:10:54.363	2026-05-16 14:10:54.363	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1su0015xsiaioxeo77c	cmonyq6yl000012mdyhe1kk88	General	FOOD_10_GEN	General	cmp8fc1sq0013xsiaseko90ro	1	t	2026-05-16 14:10:54.366	2026-05-16 14:10:54.366	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1sy0017xsia6hau5yfu	cmonyq6yl000012mdyhe1kk88	Biscuits & Cookies	FOOD_11	Biscuits & Cookies	\N	11	t	2026-05-16 14:10:54.37	2026-05-16 14:10:54.37	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1t10019xsiaa0d3wgjv	cmonyq6yl000012mdyhe1kk88	General	FOOD_11_GEN	General	cmp8fc1sy0017xsia6hau5yfu	1	t	2026-05-16 14:10:54.374	2026-05-16 14:10:54.374	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1t6001bxsia7gioc4o3	cmonyq6yl000012mdyhe1kk88	Packaged & Instant Foods	FOOD_12	Packaged & Instant Foods	\N	12	t	2026-05-16 14:10:54.378	2026-05-16 14:10:54.378	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1t9001dxsia9zha5s80	cmonyq6yl000012mdyhe1kk88	General	FOOD_12_GEN	General	cmp8fc1t6001bxsia7gioc4o3	1	t	2026-05-16 14:10:54.382	2026-05-16 14:10:54.382	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1te001fxsiac13ss3tt	cmonyq6yl000012mdyhe1kk88	Breakfast & Cereals	FOOD_13	Breakfast & Cereals	\N	13	t	2026-05-16 14:10:54.387	2026-05-16 14:10:54.387	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1ti001hxsiaki4vcyud	cmonyq6yl000012mdyhe1kk88	General	FOOD_13_GEN	General	cmp8fc1te001fxsiac13ss3tt	1	t	2026-05-16 14:10:54.39	2026-05-16 14:10:54.39	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1tm001jxsia2pdxi65e	cmonyq6yl000012mdyhe1kk88	Bakery & Breads	FOOD_14	Bakery & Breads	\N	14	t	2026-05-16 14:10:54.395	2026-05-16 14:10:54.395	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1tq001lxsia6slqc92l	cmonyq6yl000012mdyhe1kk88	General	FOOD_14_GEN	General	cmp8fc1tm001jxsia2pdxi65e	1	t	2026-05-16 14:10:54.398	2026-05-16 14:10:54.398	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1tu001nxsiaa35spe3k	cmonyq6yl000012mdyhe1kk88	Sweets & Mithai	FOOD_15	Sweets & Mithai	\N	15	t	2026-05-16 14:10:54.403	2026-05-16 14:10:54.403	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1ty001pxsiajynzqw1i	cmonyq6yl000012mdyhe1kk88	General	FOOD_15_GEN	General	cmp8fc1tu001nxsiaa35spe3k	1	t	2026-05-16 14:10:54.407	2026-05-16 14:10:54.407	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1u3001rxsia3ocnphtm	cmonyq6yl000012mdyhe1kk88	Confectionery & Chocolates	FOOD_16	Confectionery & Chocolates	\N	16	t	2026-05-16 14:10:54.412	2026-05-16 14:10:54.412	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1u8001txsiauaudd7e6	cmonyq6yl000012mdyhe1kk88	General	FOOD_16_GEN	General	cmp8fc1u3001rxsia3ocnphtm	1	t	2026-05-16 14:10:54.416	2026-05-16 14:10:54.416	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1uc001vxsiadmaewg4s	cmonyq6yl000012mdyhe1kk88	Frozen Foods	FOOD_17	Frozen Foods	\N	17	t	2026-05-16 14:10:54.42	2026-05-16 14:10:54.42	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1uf001xxsiaoln1pvb3	cmonyq6yl000012mdyhe1kk88	General	FOOD_17_GEN	General	cmp8fc1uc001vxsiadmaewg4s	1	t	2026-05-16 14:10:54.424	2026-05-16 14:10:54.424	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1uj001zxsiawj30eqgp	cmonyq6yl000012mdyhe1kk88	Dry Fruits & Nuts	FOOD_18	Dry Fruits & Nuts	\N	18	t	2026-05-16 14:10:54.428	2026-05-16 14:10:54.428	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1un0021xsiad9ijqc6b	cmonyq6yl000012mdyhe1kk88	General	FOOD_18_GEN	General	cmp8fc1uj001zxsiawj30eqgp	1	t	2026-05-16 14:10:54.431	2026-05-16 14:10:54.431	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1ur0023xsiac0hxrr42	cmonyq6yl000012mdyhe1kk88	Dairy Alternatives	FOOD_19	Dairy Alternatives	\N	19	t	2026-05-16 14:10:54.436	2026-05-16 14:10:54.436	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1uv0025xsiaqcpgf45g	cmonyq6yl000012mdyhe1kk88	General	FOOD_19_GEN	General	cmp8fc1ur0023xsiac0hxrr42	1	t	2026-05-16 14:10:54.439	2026-05-16 14:10:54.439	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1uz0027xsiaknqrq6d5	cmonyq6yl000012mdyhe1kk88	Organic & Natural Foods	FOOD_20	Organic & Natural Foods	\N	20	t	2026-05-16 14:10:54.443	2026-05-16 14:10:54.443	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1v20029xsia1wh0tkzp	cmonyq6yl000012mdyhe1kk88	General	FOOD_20_GEN	General	cmp8fc1uz0027xsiaknqrq6d5	1	t	2026-05-16 14:10:54.446	2026-05-16 14:10:54.446	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1v6002bxsiaq207wzvn	cmonyq6yl000012mdyhe1kk88	Canned & Preserved Foods	FOOD_21	Canned & Preserved Foods	\N	21	t	2026-05-16 14:10:54.451	2026-05-16 14:10:54.451	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1va002dxsia3wff0nmp	cmonyq6yl000012mdyhe1kk88	General	FOOD_21_GEN	General	cmp8fc1v6002bxsiaq207wzvn	1	t	2026-05-16 14:10:54.455	2026-05-16 14:10:54.455	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1vf002fxsia86apeizo	cmonyq6yl000012mdyhe1kk88	Cooking Essentials	FOOD_22	Cooking Essentials	\N	22	t	2026-05-16 14:10:54.459	2026-05-16 14:10:54.459	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1vi002hxsiaa60p7q93	cmonyq6yl000012mdyhe1kk88	General	FOOD_22_GEN	General	cmp8fc1vf002fxsia86apeizo	1	t	2026-05-16 14:10:54.463	2026-05-16 14:10:54.463	t	cmp8fc1qo0001xsiajwfjq2rv
cmp8fc1vp002lxsiazj53atou	cmonyq6yl000012mdyhe1kk88	Fresh Fruits	FRVEG_01	Fresh Fruits	\N	1	t	2026-05-16 14:10:54.469	2026-05-16 14:10:54.469	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1vt002nxsiagwbk31sz	cmonyq6yl000012mdyhe1kk88	General	FRVEG_01_GEN	General	cmp8fc1vp002lxsiazj53atou	1	t	2026-05-16 14:10:54.473	2026-05-16 14:10:54.473	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1vx002pxsia7sdyv919	cmonyq6yl000012mdyhe1kk88	Fresh Vegetables	FRVEG_02	Fresh Vegetables	\N	2	t	2026-05-16 14:10:54.477	2026-05-16 14:10:54.477	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1w1002rxsia7v5i22cf	cmonyq6yl000012mdyhe1kk88	General	FRVEG_02_GEN	General	cmp8fc1vx002pxsia7sdyv919	1	t	2026-05-16 14:10:54.481	2026-05-16 14:10:54.481	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1w4002txsiakyfmt9i6	cmonyq6yl000012mdyhe1kk88	Exotic & Imported	FRVEG_03	Exotic & Imported	\N	3	t	2026-05-16 14:10:54.485	2026-05-16 14:10:54.485	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1w8002vxsia0bbq6sa2	cmonyq6yl000012mdyhe1kk88	General	FRVEG_03_GEN	General	cmp8fc1w4002txsiakyfmt9i6	1	t	2026-05-16 14:10:54.489	2026-05-16 14:10:54.489	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1wc002xxsiazo21vbk6	cmonyq6yl000012mdyhe1kk88	Herbs & Greens	FRVEG_04	Herbs & Greens	\N	4	t	2026-05-16 14:10:54.492	2026-05-16 14:10:54.492	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1wg002zxsiaikwydruh	cmonyq6yl000012mdyhe1kk88	General	FRVEG_04_GEN	General	cmp8fc1wc002xxsiazo21vbk6	1	t	2026-05-16 14:10:54.496	2026-05-16 14:10:54.496	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1wj0031xsiak1egu6wy	cmonyq6yl000012mdyhe1kk88	Dry Vegetables	FRVEG_05	Dry Vegetables	\N	5	t	2026-05-16 14:10:54.5	2026-05-16 14:10:54.5	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1wo0033xsiar2ymnfc6	cmonyq6yl000012mdyhe1kk88	General	FRVEG_05_GEN	General	cmp8fc1wj0031xsiak1egu6wy	1	t	2026-05-16 14:10:54.504	2026-05-16 14:10:54.504	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1wr0035xsia7dlipb16	cmonyq6yl000012mdyhe1kk88	Sprouts & Seeds	FRVEG_06	Sprouts & Seeds	\N	6	t	2026-05-16 14:10:54.507	2026-05-16 14:10:54.507	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1wv0037xsialireewcq	cmonyq6yl000012mdyhe1kk88	General	FRVEG_06_GEN	General	cmp8fc1wr0035xsia7dlipb16	1	t	2026-05-16 14:10:54.512	2026-05-16 14:10:54.512	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1wz0039xsiarac34618	cmonyq6yl000012mdyhe1kk88	Cut & Ready to Cook	FRVEG_07	Cut & Ready to Cook	\N	7	t	2026-05-16 14:10:54.515	2026-05-16 14:10:54.515	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1x3003bxsia03xnqb6t	cmonyq6yl000012mdyhe1kk88	General	FRVEG_07_GEN	General	cmp8fc1wz0039xsiarac34618	1	t	2026-05-16 14:10:54.519	2026-05-16 14:10:54.519	t	cmp8fc1vm002jxsia0fkpmqsp
cmp8fc1x9003fxsia4f16iio7	cmonyq6yl000012mdyhe1kk88	Chicken & Mutton	MEAT_01	Chicken & Mutton	\N	1	t	2026-05-16 14:10:54.526	2026-05-16 14:10:54.526	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1xd003hxsiath4lqkic	cmonyq6yl000012mdyhe1kk88	General	MEAT_01_GEN	General	cmp8fc1x9003fxsia4f16iio7	1	t	2026-05-16 14:10:54.529	2026-05-16 14:10:54.529	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1xg003jxsiasx3vrie0	cmonyq6yl000012mdyhe1kk88	Fish & Seafood	MEAT_02	Fish & Seafood	\N	2	t	2026-05-16 14:10:54.533	2026-05-16 14:10:54.533	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1xj003lxsiat70qqipg	cmonyq6yl000012mdyhe1kk88	General	MEAT_02_GEN	General	cmp8fc1xg003jxsiasx3vrie0	1	t	2026-05-16 14:10:54.536	2026-05-16 14:10:54.536	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1xn003nxsia8xmamrw1	cmonyq6yl000012mdyhe1kk88	Eggs	MEAT_03	Eggs	\N	3	t	2026-05-16 14:10:54.539	2026-05-16 14:10:54.539	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1xq003pxsias2npe2b8	cmonyq6yl000012mdyhe1kk88	General	MEAT_03_GEN	General	cmp8fc1xn003nxsia8xmamrw1	1	t	2026-05-16 14:10:54.542	2026-05-16 14:10:54.542	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1xu003rxsia0mjonda3	cmonyq6yl000012mdyhe1kk88	Frozen Meat	MEAT_04	Frozen Meat	\N	4	t	2026-05-16 14:10:54.546	2026-05-16 14:10:54.546	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1xx003txsianwkdbuxi	cmonyq6yl000012mdyhe1kk88	General	MEAT_04_GEN	General	cmp8fc1xu003rxsia0mjonda3	1	t	2026-05-16 14:10:54.549	2026-05-16 14:10:54.549	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1y1003vxsiall23lspa	cmonyq6yl000012mdyhe1kk88	Ready to Cook Meat	MEAT_05	Ready to Cook Meat	\N	5	t	2026-05-16 14:10:54.553	2026-05-16 14:10:54.553	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1y4003xxsiawgwmg2gq	cmonyq6yl000012mdyhe1kk88	General	MEAT_05_GEN	General	cmp8fc1y1003vxsiall23lspa	1	t	2026-05-16 14:10:54.557	2026-05-16 14:10:54.557	t	cmp8fc1x5003dxsiamgt1yc3x
cmp8fc1ya0041xsiavadl4rvo	cmonyq6yl000012mdyhe1kk88	Detergents & Laundry	HOMECARE_01	Detergents & Laundry	\N	1	t	2026-05-16 14:10:54.563	2026-05-16 14:10:54.563	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1ye0043xsia804g00ia	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_01_GEN	General	cmp8fc1ya0041xsiavadl4rvo	1	t	2026-05-16 14:10:54.566	2026-05-16 14:10:54.566	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1yh0045xsiasvwshn5i	cmonyq6yl000012mdyhe1kk88	Dishwash	HOMECARE_02	Dishwash	\N	2	t	2026-05-16 14:10:54.569	2026-05-16 14:10:54.569	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1yk0047xsia0e89eu6n	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_02_GEN	General	cmp8fc1yh0045xsiasvwshn5i	1	t	2026-05-16 14:10:54.572	2026-05-16 14:10:54.572	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1yn0049xsia5a1lu201	cmonyq6yl000012mdyhe1kk88	Floor & Surface Cleaners	HOMECARE_03	Floor & Surface Cleaners	\N	3	t	2026-05-16 14:10:54.575	2026-05-16 14:10:54.575	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1yq004bxsiablby1gpv	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_03_GEN	General	cmp8fc1yn0049xsia5a1lu201	1	t	2026-05-16 14:10:54.578	2026-05-16 14:10:54.578	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1yt004dxsiaji0o8gup	cmonyq6yl000012mdyhe1kk88	Toilet Care	HOMECARE_04	Toilet Care	\N	4	t	2026-05-16 14:10:54.581	2026-05-16 14:10:54.581	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1yw004fxsiav0tvy8p2	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_04_GEN	General	cmp8fc1yt004dxsiaji0o8gup	1	t	2026-05-16 14:10:54.585	2026-05-16 14:10:54.585	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1yz004hxsiaaxxf877j	cmonyq6yl000012mdyhe1kk88	Fresheners & Repellents	HOMECARE_05	Fresheners & Repellents	\N	5	t	2026-05-16 14:10:54.588	2026-05-16 14:10:54.588	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1z3004jxsiaqp2q94rf	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_05_GEN	General	cmp8fc1yz004hxsiaaxxf877j	1	t	2026-05-16 14:10:54.591	2026-05-16 14:10:54.591	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1z6004lxsianvkhvn2a	cmonyq6yl000012mdyhe1kk88	Mosquito Control	HOMECARE_06	Mosquito Control	\N	6	t	2026-05-16 14:10:54.594	2026-05-16 14:10:54.594	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1z9004nxsiayu1pqx78	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_06_GEN	General	cmp8fc1z6004lxsianvkhvn2a	1	t	2026-05-16 14:10:54.598	2026-05-16 14:10:54.598	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zc004pxsiaxlak9n71	cmonyq6yl000012mdyhe1kk88	Garbage & Storage	HOMECARE_07	Garbage & Storage	\N	7	t	2026-05-16 14:10:54.601	2026-05-16 14:10:54.601	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zg004rxsiatnofs9fm	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_07_GEN	General	cmp8fc1zc004pxsiaxlak9n71	1	t	2026-05-16 14:10:54.605	2026-05-16 14:10:54.605	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zj004txsia0vlvi2j9	cmonyq6yl000012mdyhe1kk88	Kitchen Accessories	HOMECARE_08	Kitchen Accessories	\N	8	t	2026-05-16 14:10:54.608	2026-05-16 14:10:54.608	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zm004vxsia35bo8wxh	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_08_GEN	General	cmp8fc1zj004txsia0vlvi2j9	1	t	2026-05-16 14:10:54.611	2026-05-16 14:10:54.611	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zp004xxsias4w9nyas	cmonyq6yl000012mdyhe1kk88	Disposables	HOMECARE_09	Disposables	\N	9	t	2026-05-16 14:10:54.614	2026-05-16 14:10:54.614	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zt004zxsia7qqonhbt	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_09_GEN	General	cmp8fc1zp004xxsias4w9nyas	1	t	2026-05-16 14:10:54.617	2026-05-16 14:10:54.617	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zw0051xsia6hyzohrn	cmonyq6yl000012mdyhe1kk88	Pooja & Religious Items	HOMECARE_10	Pooja & Religious Items	\N	10	t	2026-05-16 14:10:54.62	2026-05-16 14:10:54.62	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc1zz0053xsiauh8kdcjg	cmonyq6yl000012mdyhe1kk88	General	HOMECARE_10_GEN	General	cmp8fc1zw0051xsia6hyzohrn	1	t	2026-05-16 14:10:54.624	2026-05-16 14:10:54.624	t	cmp8fc1y7003zxsiadq62v3sw
cmp8fc2060057xsiahiou4qth	cmonyq6yl000012mdyhe1kk88	Bath & Body	PERSONAL_01	Bath & Body	\N	1	t	2026-05-16 14:10:54.63	2026-05-16 14:10:54.63	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc2090059xsiajjzid1pe	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_01_GEN	General	cmp8fc2060057xsiahiou4qth	1	t	2026-05-16 14:10:54.633	2026-05-16 14:10:54.633	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20c005bxsia6b2ax6ou	cmonyq6yl000012mdyhe1kk88	Hair Care	PERSONAL_02	Hair Care	\N	2	t	2026-05-16 14:10:54.637	2026-05-16 14:10:54.637	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20f005dxsiaaho2sjwp	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_02_GEN	General	cmp8fc20c005bxsia6b2ax6ou	1	t	2026-05-16 14:10:54.64	2026-05-16 14:10:54.64	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20i005fxsia56095thv	cmonyq6yl000012mdyhe1kk88	Skin Care	PERSONAL_03	Skin Care	\N	3	t	2026-05-16 14:10:54.643	2026-05-16 14:10:54.643	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20l005hxsialqgaff83	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_03_GEN	General	cmp8fc20i005fxsia56095thv	1	t	2026-05-16 14:10:54.646	2026-05-16 14:10:54.646	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20p005jxsiaa70txtf1	cmonyq6yl000012mdyhe1kk88	Oral Care	PERSONAL_04	Oral Care	\N	4	t	2026-05-16 14:10:54.65	2026-05-16 14:10:54.65	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20t005lxsia5mccffzx	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_04_GEN	General	cmp8fc20p005jxsiaa70txtf1	1	t	2026-05-16 14:10:54.653	2026-05-16 14:10:54.653	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20w005nxsia6he8wqrm	cmonyq6yl000012mdyhe1kk88	Deodorant & Perfume	PERSONAL_05	Deodorant & Perfume	\N	5	t	2026-05-16 14:10:54.657	2026-05-16 14:10:54.657	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc20z005pxsia6q8dpazu	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_05_GEN	General	cmp8fc20w005nxsia6he8wqrm	1	t	2026-05-16 14:10:54.66	2026-05-16 14:10:54.66	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc213005rxsia9enxmroy	cmonyq6yl000012mdyhe1kk88	Shaving & Grooming	PERSONAL_06	Shaving & Grooming	\N	6	t	2026-05-16 14:10:54.663	2026-05-16 14:10:54.663	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc216005txsia4e4fdb64	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_06_GEN	General	cmp8fc213005rxsia9enxmroy	1	t	2026-05-16 14:10:54.666	2026-05-16 14:10:54.666	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc219005vxsiavneb76e9	cmonyq6yl000012mdyhe1kk88	Feminine Hygiene	PERSONAL_07	Feminine Hygiene	\N	7	t	2026-05-16 14:10:54.67	2026-05-16 14:10:54.67	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21c005xxsiag4eocccr	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_07_GEN	General	cmp8fc219005vxsiavneb76e9	1	t	2026-05-16 14:10:54.673	2026-05-16 14:10:54.673	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21g005zxsiac6i7k06i	cmonyq6yl000012mdyhe1kk88	Cosmetics & Makeup	PERSONAL_08	Cosmetics & Makeup	\N	8	t	2026-05-16 14:10:54.676	2026-05-16 14:10:54.676	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21j0061xsiatjq4z2c6	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_08_GEN	General	cmp8fc21g005zxsiac6i7k06i	1	t	2026-05-16 14:10:54.679	2026-05-16 14:10:54.679	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21m0063xsiaxsgqjj9v	cmonyq6yl000012mdyhe1kk88	Mens Grooming	PERSONAL_09	Mens Grooming	\N	9	t	2026-05-16 14:10:54.683	2026-05-16 14:10:54.683	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21p0065xsia93hpqxem	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_09_GEN	General	cmp8fc21m0063xsiaxsgqjj9v	1	t	2026-05-16 14:10:54.686	2026-05-16 14:10:54.686	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21t0067xsian012aieo	cmonyq6yl000012mdyhe1kk88	Foot Care	PERSONAL_10	Foot Care	\N	10	t	2026-05-16 14:10:54.689	2026-05-16 14:10:54.689	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21w0069xsiaoimemj15	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_10_GEN	General	cmp8fc21t0067xsian012aieo	1	t	2026-05-16 14:10:54.692	2026-05-16 14:10:54.692	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc21z006bxsia694l729m	cmonyq6yl000012mdyhe1kk88	Eye Care	PERSONAL_11	Eye Care	\N	11	t	2026-05-16 14:10:54.696	2026-05-16 14:10:54.696	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc223006dxsial05icu3u	cmonyq6yl000012mdyhe1kk88	General	PERSONAL_11_GEN	General	cmp8fc21z006bxsia694l729m	1	t	2026-05-16 14:10:54.699	2026-05-16 14:10:54.699	t	cmp8fc2020055xsiaj8v48uuy
cmp8fc22a006hxsiao4t80q3i	cmonyq6yl000012mdyhe1kk88	Baby Food & Milk	BABY_01	Baby Food & Milk	\N	1	t	2026-05-16 14:10:54.706	2026-05-16 14:10:54.706	t	cmp8fc226006fxsiay04ke631
cmp8fc22e006jxsia0buawfob	cmonyq6yl000012mdyhe1kk88	General	BABY_01_GEN	General	cmp8fc22a006hxsiao4t80q3i	1	t	2026-05-16 14:10:54.71	2026-05-16 14:10:54.71	t	cmp8fc226006fxsiay04ke631
cmp8fc22h006lxsia0zwh77fr	cmonyq6yl000012mdyhe1kk88	Diapers & Wipes	BABY_02	Diapers & Wipes	\N	2	t	2026-05-16 14:10:54.714	2026-05-16 14:10:54.714	t	cmp8fc226006fxsiay04ke631
cmp8fc22l006nxsiacu2wcqq2	cmonyq6yl000012mdyhe1kk88	General	BABY_02_GEN	General	cmp8fc22h006lxsia0zwh77fr	1	t	2026-05-16 14:10:54.717	2026-05-16 14:10:54.717	t	cmp8fc226006fxsiay04ke631
cmp8fc22o006pxsia35z4zer6	cmonyq6yl000012mdyhe1kk88	Baby Bath & Skin	BABY_03	Baby Bath & Skin	\N	3	t	2026-05-16 14:10:54.72	2026-05-16 14:10:54.72	t	cmp8fc226006fxsiay04ke631
cmp8fc22s006rxsiagjnf3xhx	cmonyq6yl000012mdyhe1kk88	General	BABY_03_GEN	General	cmp8fc22o006pxsia35z4zer6	1	t	2026-05-16 14:10:54.724	2026-05-16 14:10:54.724	t	cmp8fc226006fxsiay04ke631
cmp8fc22v006txsiaktfsbklt	cmonyq6yl000012mdyhe1kk88	Baby Health	BABY_04	Baby Health	\N	4	t	2026-05-16 14:10:54.727	2026-05-16 14:10:54.727	t	cmp8fc226006fxsiay04ke631
cmp8fc22y006vxsiaspalm5m4	cmonyq6yl000012mdyhe1kk88	General	BABY_04_GEN	General	cmp8fc22v006txsiaktfsbklt	1	t	2026-05-16 14:10:54.731	2026-05-16 14:10:54.731	t	cmp8fc226006fxsiay04ke631
cmp8fc231006xxsia4cu7gr7e	cmonyq6yl000012mdyhe1kk88	Baby Accessories	BABY_05	Baby Accessories	\N	5	t	2026-05-16 14:10:54.734	2026-05-16 14:10:54.734	t	cmp8fc226006fxsiay04ke631
cmp8fc235006zxsiavjobxllo	cmonyq6yl000012mdyhe1kk88	General	BABY_05_GEN	General	cmp8fc231006xxsia4cu7gr7e	1	t	2026-05-16 14:10:54.737	2026-05-16 14:10:54.737	t	cmp8fc226006fxsiay04ke631
cmp8fc2380071xsiahgszwxzk	cmonyq6yl000012mdyhe1kk88	Baby Clothing	BABY_06	Baby Clothing	\N	6	t	2026-05-16 14:10:54.74	2026-05-16 14:10:54.74	t	cmp8fc226006fxsiay04ke631
cmp8fc23b0073xsiayh0ouszi	cmonyq6yl000012mdyhe1kk88	General	BABY_06_GEN	General	cmp8fc2380071xsiahgszwxzk	1	t	2026-05-16 14:10:54.744	2026-05-16 14:10:54.744	t	cmp8fc226006fxsiay04ke631
cmp8fc23e0075xsiazq838nuc	cmonyq6yl000012mdyhe1kk88	Baby Toys	BABY_07	Baby Toys	\N	7	t	2026-05-16 14:10:54.747	2026-05-16 14:10:54.747	t	cmp8fc226006fxsiay04ke631
cmp8fc23i0077xsiaq9xjvba1	cmonyq6yl000012mdyhe1kk88	General	BABY_07_GEN	General	cmp8fc23e0075xsiazq838nuc	1	t	2026-05-16 14:10:54.75	2026-05-16 14:10:54.75	t	cmp8fc226006fxsiay04ke631
cmp8fc23o007bxsia771iqyxk	cmonyq6yl000012mdyhe1kk88	Health Drinks & Supplements	HEALTH_01	Health Drinks & Supplements	\N	1	t	2026-05-16 14:10:54.756	2026-05-16 14:10:54.756	t	cmp8fc23l0079xsia77r56l5u
cmp8fc23r007dxsiarhe20bkt	cmonyq6yl000012mdyhe1kk88	General	HEALTH_01_GEN	General	cmp8fc23o007bxsia771iqyxk	1	t	2026-05-16 14:10:54.759	2026-05-16 14:10:54.759	t	cmp8fc23l0079xsia77r56l5u
cmp8fc23u007fxsia8hvx4dph	cmonyq6yl000012mdyhe1kk88	Protein & Fitness	HEALTH_02	Protein & Fitness	\N	2	t	2026-05-16 14:10:54.763	2026-05-16 14:10:54.763	t	cmp8fc23l0079xsia77r56l5u
cmp8fc23y007hxsiaos9uwob8	cmonyq6yl000012mdyhe1kk88	General	HEALTH_02_GEN	General	cmp8fc23u007fxsia8hvx4dph	1	t	2026-05-16 14:10:54.766	2026-05-16 14:10:54.766	t	cmp8fc23l0079xsia77r56l5u
cmp8fc241007jxsiag519o7be	cmonyq6yl000012mdyhe1kk88	OTC Medicines	HEALTH_03	OTC Medicines	\N	3	t	2026-05-16 14:10:54.769	2026-05-16 14:10:54.769	t	cmp8fc23l0079xsia77r56l5u
cmp8fc244007lxsia1s7gvfpd	cmonyq6yl000012mdyhe1kk88	General	HEALTH_03_GEN	General	cmp8fc241007jxsiag519o7be	1	t	2026-05-16 14:10:54.772	2026-05-16 14:10:54.772	t	cmp8fc23l0079xsia77r56l5u
cmp8fc247007nxsiar6t2kej6	cmonyq6yl000012mdyhe1kk88	Ayurvedic & Herbal	HEALTH_04	Ayurvedic & Herbal	\N	4	t	2026-05-16 14:10:54.776	2026-05-16 14:10:54.776	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24b007pxsiafqmaop7a	cmonyq6yl000012mdyhe1kk88	General	HEALTH_04_GEN	General	cmp8fc247007nxsiar6t2kej6	1	t	2026-05-16 14:10:54.779	2026-05-16 14:10:54.779	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24f007rxsiarjawim3u	cmonyq6yl000012mdyhe1kk88	Homeopathic	HEALTH_05	Homeopathic	\N	5	t	2026-05-16 14:10:54.783	2026-05-16 14:10:54.783	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24h007txsiauid9aitc	cmonyq6yl000012mdyhe1kk88	General	HEALTH_05_GEN	General	cmp8fc24f007rxsiarjawim3u	1	t	2026-05-16 14:10:54.786	2026-05-16 14:10:54.786	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24l007vxsiay38l47wo	cmonyq6yl000012mdyhe1kk88	Diabetic & Diet Foods	HEALTH_06	Diabetic & Diet Foods	\N	6	t	2026-05-16 14:10:54.789	2026-05-16 14:10:54.789	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24o007xxsia8mnyijb4	cmonyq6yl000012mdyhe1kk88	General	HEALTH_06_GEN	General	cmp8fc24l007vxsiay38l47wo	1	t	2026-05-16 14:10:54.792	2026-05-16 14:10:54.792	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24r007zxsialanb3juc	cmonyq6yl000012mdyhe1kk88	First Aid	HEALTH_07	First Aid	\N	7	t	2026-05-16 14:10:54.796	2026-05-16 14:10:54.796	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24u0081xsiauxqkj8tn	cmonyq6yl000012mdyhe1kk88	General	HEALTH_07_GEN	General	cmp8fc24r007zxsialanb3juc	1	t	2026-05-16 14:10:54.799	2026-05-16 14:10:54.799	t	cmp8fc23l0079xsia77r56l5u
cmp8fc24y0083xsiaefhwn9pg	cmonyq6yl000012mdyhe1kk88	Surgical & Medical Accessories	HEALTH_08	Surgical & Medical Accessories	\N	8	t	2026-05-16 14:10:54.803	2026-05-16 14:10:54.803	t	cmp8fc23l0079xsia77r56l5u
cmp8fc2520085xsiayfd5vmo3	cmonyq6yl000012mdyhe1kk88	General	HEALTH_08_GEN	General	cmp8fc24y0083xsiaefhwn9pg	1	t	2026-05-16 14:10:54.806	2026-05-16 14:10:54.806	t	cmp8fc23l0079xsia77r56l5u
cmp8fc2560087xsia2rohqvwn	cmonyq6yl000012mdyhe1kk88	Senior Care	HEALTH_09	Senior Care	\N	9	t	2026-05-16 14:10:54.81	2026-05-16 14:10:54.81	t	cmp8fc23l0079xsia77r56l5u
cmp8fc2590089xsiaxo87d8yi	cmonyq6yl000012mdyhe1kk88	General	HEALTH_09_GEN	General	cmp8fc2560087xsia2rohqvwn	1	t	2026-05-16 14:10:54.813	2026-05-16 14:10:54.813	t	cmp8fc23l0079xsia77r56l5u
cmp8fc25d008bxsia5c0keewq	cmonyq6yl000012mdyhe1kk88	Womens Health	HEALTH_10	Womens Health	\N	10	t	2026-05-16 14:10:54.817	2026-05-16 14:10:54.817	t	cmp8fc23l0079xsia77r56l5u
cmp8fc25g008dxsiani9xvmd5	cmonyq6yl000012mdyhe1kk88	General	HEALTH_10_GEN	General	cmp8fc25d008bxsia5c0keewq	1	t	2026-05-16 14:10:54.82	2026-05-16 14:10:54.82	t	cmp8fc23l0079xsia77r56l5u
cmp8fc25n008hxsiafjuu76ur	cmonyq6yl000012mdyhe1kk88	Dog Care	PETCARE_01	Dog Care	\N	1	t	2026-05-16 14:10:54.827	2026-05-16 14:10:54.827	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc25r008jxsiavs4z87f0	cmonyq6yl000012mdyhe1kk88	General	PETCARE_01_GEN	General	cmp8fc25n008hxsiafjuu76ur	1	t	2026-05-16 14:10:54.831	2026-05-16 14:10:54.831	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc25u008lxsia2twr7iua	cmonyq6yl000012mdyhe1kk88	Cat Care	PETCARE_02	Cat Care	\N	2	t	2026-05-16 14:10:54.834	2026-05-16 14:10:54.834	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc25y008nxsiad2mrnlfk	cmonyq6yl000012mdyhe1kk88	General	PETCARE_02_GEN	General	cmp8fc25u008lxsia2twr7iua	1	t	2026-05-16 14:10:54.838	2026-05-16 14:10:54.838	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc261008pxsiaicwyrhp7	cmonyq6yl000012mdyhe1kk88	Bird Care	PETCARE_03	Bird Care	\N	3	t	2026-05-16 14:10:54.841	2026-05-16 14:10:54.841	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc264008rxsiav8fnl2hq	cmonyq6yl000012mdyhe1kk88	General	PETCARE_03_GEN	General	cmp8fc261008pxsiaicwyrhp7	1	t	2026-05-16 14:10:54.845	2026-05-16 14:10:54.845	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc267008txsiam7xu3o5u	cmonyq6yl000012mdyhe1kk88	Fish & Aquarium	PETCARE_04	Fish & Aquarium	\N	4	t	2026-05-16 14:10:54.848	2026-05-16 14:10:54.848	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc26b008vxsiaqr0h4bfd	cmonyq6yl000012mdyhe1kk88	General	PETCARE_04_GEN	General	cmp8fc267008txsiam7xu3o5u	1	t	2026-05-16 14:10:54.851	2026-05-16 14:10:54.851	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc26f008xxsiag26ws5aj	cmonyq6yl000012mdyhe1kk88	Small Animals	PETCARE_05	Small Animals	\N	5	t	2026-05-16 14:10:54.855	2026-05-16 14:10:54.855	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc26i008zxsiae5w752n0	cmonyq6yl000012mdyhe1kk88	General	PETCARE_05_GEN	General	cmp8fc26f008xxsiag26ws5aj	1	t	2026-05-16 14:10:54.859	2026-05-16 14:10:54.859	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc26l0091xsia66r1lz2w	cmonyq6yl000012mdyhe1kk88	Pet Accessories	PETCARE_06	Pet Accessories	\N	6	t	2026-05-16 14:10:54.862	2026-05-16 14:10:54.862	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc26o0093xsias01aoxkx	cmonyq6yl000012mdyhe1kk88	General	PETCARE_06_GEN	General	cmp8fc26l0091xsia66r1lz2w	1	t	2026-05-16 14:10:54.865	2026-05-16 14:10:54.865	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc26r0095xsiaqn8udcvv	cmonyq6yl000012mdyhe1kk88	Pet Health	PETCARE_07	Pet Health	\N	7	t	2026-05-16 14:10:54.868	2026-05-16 14:10:54.868	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc26v0097xsiay82e6xcf	cmonyq6yl000012mdyhe1kk88	General	PETCARE_07_GEN	General	cmp8fc26r0095xsiaqn8udcvv	1	t	2026-05-16 14:10:54.871	2026-05-16 14:10:54.871	t	cmp8fc25k008fxsiawi2yr9kt
cmp8fc270009bxsia8nhlgarj	cmonyq6yl000012mdyhe1kk88	Stationery	STATIONERY_01	Stationery	\N	1	t	2026-05-16 14:10:54.877	2026-05-16 14:10:54.877	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc273009dxsiaruvu28vh	cmonyq6yl000012mdyhe1kk88	General	STATIONERY_01_GEN	General	cmp8fc270009bxsia8nhlgarj	1	t	2026-05-16 14:10:54.88	2026-05-16 14:10:54.88	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc277009fxsiadui1j3jo	cmonyq6yl000012mdyhe1kk88	Office Supplies	STATIONERY_02	Office Supplies	\N	2	t	2026-05-16 14:10:54.884	2026-05-16 14:10:54.884	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27a009hxsiakhrkxc9z	cmonyq6yl000012mdyhe1kk88	General	STATIONERY_02_GEN	General	cmp8fc277009fxsiadui1j3jo	1	t	2026-05-16 14:10:54.887	2026-05-16 14:10:54.887	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27e009jxsiaf4lb4siy	cmonyq6yl000012mdyhe1kk88	Art & Craft	STATIONERY_03	Art & Craft	\N	3	t	2026-05-16 14:10:54.89	2026-05-16 14:10:54.89	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27h009lxsia90fa0125	cmonyq6yl000012mdyhe1kk88	General	STATIONERY_03_GEN	General	cmp8fc27e009jxsiaf4lb4siy	1	t	2026-05-16 14:10:54.893	2026-05-16 14:10:54.893	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27k009nxsia3cdaac7e	cmonyq6yl000012mdyhe1kk88	School Supplies	STATIONERY_04	School Supplies	\N	4	t	2026-05-16 14:10:54.897	2026-05-16 14:10:54.897	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27o009pxsiaovo5j3an	cmonyq6yl000012mdyhe1kk88	General	STATIONERY_04_GEN	General	cmp8fc27k009nxsia3cdaac7e	1	t	2026-05-16 14:10:54.9	2026-05-16 14:10:54.9	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27t009rxsiaa3n77c8i	cmonyq6yl000012mdyhe1kk88	Books & Magazines	STATIONERY_05	Books & Magazines	\N	5	t	2026-05-16 14:10:54.905	2026-05-16 14:10:54.905	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27w009txsiate5zsj91	cmonyq6yl000012mdyhe1kk88	General	STATIONERY_05_GEN	General	cmp8fc27t009rxsiaa3n77c8i	1	t	2026-05-16 14:10:54.908	2026-05-16 14:10:54.908	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc27z009vxsia1chkmg7g	cmonyq6yl000012mdyhe1kk88	Newspapers	STATIONERY_06	Newspapers	\N	6	t	2026-05-16 14:10:54.911	2026-05-16 14:10:54.911	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc282009xxsiab3dshwpt	cmonyq6yl000012mdyhe1kk88	General	STATIONERY_06_GEN	General	cmp8fc27z009vxsia1chkmg7g	1	t	2026-05-16 14:10:54.914	2026-05-16 14:10:54.914	t	cmp8fc26x0099xsiagkj5dga8
cmp8fc28700a1xsia7erdwssq	cmonyq6yl000012mdyhe1kk88	Batteries & Torches	ELECTRICAL_01	Batteries & Torches	\N	1	t	2026-05-16 14:10:54.92	2026-05-16 14:10:54.92	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28b00a3xsia38w3ey2l	cmonyq6yl000012mdyhe1kk88	General	ELECTRICAL_01_GEN	General	cmp8fc28700a1xsia7erdwssq	1	t	2026-05-16 14:10:54.923	2026-05-16 14:10:54.923	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28d00a5xsia7h23t8xa	cmonyq6yl000012mdyhe1kk88	Bulbs & Lighting	ELECTRICAL_02	Bulbs & Lighting	\N	2	t	2026-05-16 14:10:54.926	2026-05-16 14:10:54.926	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28h00a7xsia7m10fz5h	cmonyq6yl000012mdyhe1kk88	General	ELECTRICAL_02_GEN	General	cmp8fc28d00a5xsia7h23t8xa	1	t	2026-05-16 14:10:54.929	2026-05-16 14:10:54.929	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28k00a9xsia87mf96wx	cmonyq6yl000012mdyhe1kk88	Extension & Cables	ELECTRICAL_03	Extension & Cables	\N	3	t	2026-05-16 14:10:54.933	2026-05-16 14:10:54.933	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28o00abxsian0dz1szt	cmonyq6yl000012mdyhe1kk88	General	ELECTRICAL_03_GEN	General	cmp8fc28k00a9xsia87mf96wx	1	t	2026-05-16 14:10:54.936	2026-05-16 14:10:54.936	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28r00adxsiap2sxbbh2	cmonyq6yl000012mdyhe1kk88	Small Hardware	ELECTRICAL_04	Small Hardware	\N	4	t	2026-05-16 14:10:54.939	2026-05-16 14:10:54.939	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28u00afxsiace7gulvn	cmonyq6yl000012mdyhe1kk88	General	ELECTRICAL_04_GEN	General	cmp8fc28r00adxsiap2sxbbh2	1	t	2026-05-16 14:10:54.942	2026-05-16 14:10:54.942	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc28x00ahxsialgyjez3p	cmonyq6yl000012mdyhe1kk88	Tape & Adhesives	ELECTRICAL_05	Tape & Adhesives	\N	5	t	2026-05-16 14:10:54.945	2026-05-16 14:10:54.945	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc29100ajxsiafc0fb827	cmonyq6yl000012mdyhe1kk88	General	ELECTRICAL_05_GEN	General	cmp8fc28x00ahxsialgyjez3p	1	t	2026-05-16 14:10:54.949	2026-05-16 14:10:54.949	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc29400alxsia92rmpj8s	cmonyq6yl000012mdyhe1kk88	Tools	ELECTRICAL_06	Tools	\N	6	t	2026-05-16 14:10:54.952	2026-05-16 14:10:54.952	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc29800anxsia3i3x5uwk	cmonyq6yl000012mdyhe1kk88	General	ELECTRICAL_06_GEN	General	cmp8fc29400alxsia92rmpj8s	1	t	2026-05-16 14:10:54.956	2026-05-16 14:10:54.956	t	cmp8fc285009zxsiah9fdf9c8
cmp8fc29e00arxsia5owi194e	cmonyq6yl000012mdyhe1kk88	Cigarettes	TOBACCO_01	Cigarettes	\N	1	t	2026-05-16 14:10:54.962	2026-05-16 14:10:54.962	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc29g00atxsiarqik2jpl	cmonyq6yl000012mdyhe1kk88	General	TOBACCO_01_GEN	General	cmp8fc29e00arxsia5owi194e	1	t	2026-05-16 14:10:54.965	2026-05-16 14:10:54.965	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc29k00avxsiaob8kivmq	cmonyq6yl000012mdyhe1kk88	Bidi	TOBACCO_02	Bidi	\N	2	t	2026-05-16 14:10:54.969	2026-05-16 14:10:54.969	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc29n00axxsia1i4zcucb	cmonyq6yl000012mdyhe1kk88	General	TOBACCO_02_GEN	General	cmp8fc29k00avxsiaob8kivmq	1	t	2026-05-16 14:10:54.972	2026-05-16 14:10:54.972	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc29r00azxsia8yyzc3s8	cmonyq6yl000012mdyhe1kk88	Cigars	TOBACCO_03	Cigars	\N	3	t	2026-05-16 14:10:54.975	2026-05-16 14:10:54.975	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc29u00b1xsiaa9gh6j6b	cmonyq6yl000012mdyhe1kk88	General	TOBACCO_03_GEN	General	cmp8fc29r00azxsia8yyzc3s8	1	t	2026-05-16 14:10:54.978	2026-05-16 14:10:54.978	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc29y00b3xsiagahudzw2	cmonyq6yl000012mdyhe1kk88	Chewing Tobacco	TOBACCO_04	Chewing Tobacco	\N	4	t	2026-05-16 14:10:54.982	2026-05-16 14:10:54.982	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2a000b5xsiazoa14omk	cmonyq6yl000012mdyhe1kk88	General	TOBACCO_04_GEN	General	cmp8fc29y00b3xsiagahudzw2	1	t	2026-05-16 14:10:54.985	2026-05-16 14:10:54.985	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2a400b7xsiaywggnr7n	cmonyq6yl000012mdyhe1kk88	Pan & Gutka	TOBACCO_05	Pan & Gutka	\N	5	t	2026-05-16 14:10:54.988	2026-05-16 14:10:54.988	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2a700b9xsia1xw2eo65	cmonyq6yl000012mdyhe1kk88	General	TOBACCO_05_GEN	General	cmp8fc2a400b7xsiaywggnr7n	1	t	2026-05-16 14:10:54.991	2026-05-16 14:10:54.991	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2aa00bbxsiaxr2fttmb	cmonyq6yl000012mdyhe1kk88	Pan Masala	TOBACCO_06	Pan Masala	\N	6	t	2026-05-16 14:10:54.994	2026-05-16 14:10:54.994	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2ad00bdxsiani5y509m	cmonyq6yl000012mdyhe1kk88	General	TOBACCO_06_GEN	General	cmp8fc2aa00bbxsiaxr2fttmb	1	t	2026-05-16 14:10:54.997	2026-05-16 14:10:54.997	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2ag00bfxsiauwlfmvy9	cmonyq6yl000012mdyhe1kk88	Hookah & Accessories	TOBACCO_07	Hookah & Accessories	\N	7	t	2026-05-16 14:10:55	2026-05-16 14:10:55	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2aj00bhxsiarkbhj0v7	cmonyq6yl000012mdyhe1kk88	General	TOBACCO_07_GEN	General	cmp8fc2ag00bfxsiauwlfmvy9	1	t	2026-05-16 14:10:55.003	2026-05-16 14:10:55.003	t	cmp8fc29a00apxsiaprp6q0vp
cmp8fc2aq00blxsiaei3thl32	cmonyq6yl000012mdyhe1kk88	Beer	LIQUOR_01	Beer	\N	1	t	2026-05-16 14:10:55.01	2026-05-16 14:10:55.01	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2au00bnxsiat7dgwwyn	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_01_GEN	General	cmp8fc2aq00blxsiaei3thl32	1	t	2026-05-16 14:10:55.015	2026-05-16 14:10:55.015	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2ay00bpxsiattmfww7b	cmonyq6yl000012mdyhe1kk88	Wine	LIQUOR_02	Wine	\N	2	t	2026-05-16 14:10:55.019	2026-05-16 14:10:55.019	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2b200brxsia9zl88e5x	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_02_GEN	General	cmp8fc2ay00bpxsiattmfww7b	1	t	2026-05-16 14:10:55.023	2026-05-16 14:10:55.023	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2b600btxsiafyihowlr	cmonyq6yl000012mdyhe1kk88	Whisky & Scotch	LIQUOR_03	Whisky & Scotch	\N	3	t	2026-05-16 14:10:55.027	2026-05-16 14:10:55.027	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2ba00bvxsia9rbq8m64	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_03_GEN	General	cmp8fc2b600btxsiafyihowlr	1	t	2026-05-16 14:10:55.031	2026-05-16 14:10:55.031	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2be00bxxsia9fnz3bp2	cmonyq6yl000012mdyhe1kk88	Rum	LIQUOR_04	Rum	\N	4	t	2026-05-16 14:10:55.034	2026-05-16 14:10:55.034	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2bi00bzxsiag8d8oej8	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_04_GEN	General	cmp8fc2be00bxxsia9fnz3bp2	1	t	2026-05-16 14:10:55.038	2026-05-16 14:10:55.038	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2bl00c1xsiaui21rluj	cmonyq6yl000012mdyhe1kk88	Vodka & Gin	LIQUOR_05	Vodka & Gin	\N	5	t	2026-05-16 14:10:55.042	2026-05-16 14:10:55.042	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2bp00c3xsiatiglpqas	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_05_GEN	General	cmp8fc2bl00c1xsiaui21rluj	1	t	2026-05-16 14:10:55.046	2026-05-16 14:10:55.046	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2bs00c5xsia53xsxooa	cmonyq6yl000012mdyhe1kk88	Brandy	LIQUOR_06	Brandy	\N	6	t	2026-05-16 14:10:55.049	2026-05-16 14:10:55.049	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2bx00c7xsiarrxgaoog	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_06_GEN	General	cmp8fc2bs00c5xsia53xsxooa	1	t	2026-05-16 14:10:55.053	2026-05-16 14:10:55.053	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2c000c9xsiavcmire9y	cmonyq6yl000012mdyhe1kk88	Country Liquor	LIQUOR_07	Country Liquor	\N	7	t	2026-05-16 14:10:55.057	2026-05-16 14:10:55.057	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2c400cbxsia65q4p0r4	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_07_GEN	General	cmp8fc2c000c9xsiavcmire9y	1	t	2026-05-16 14:10:55.061	2026-05-16 14:10:55.061	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2c800cdxsia4z0cz9lk	cmonyq6yl000012mdyhe1kk88	Non-Alcoholic Mocktails	LIQUOR_08	Non-Alcoholic Mocktails	\N	8	t	2026-05-16 14:10:55.064	2026-05-16 14:10:55.064	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2cc00cfxsia5pz0wxge	cmonyq6yl000012mdyhe1kk88	General	LIQUOR_08_GEN	General	cmp8fc2c800cdxsia4z0cz9lk	1	t	2026-05-16 14:10:55.068	2026-05-16 14:10:55.068	t	cmp8fc2am00bjxsia2n36v2nz
cmp8fc2cj00cjxsiak4wupqv6	cmonyq6yl000012mdyhe1kk88	Diwali Items	SEASONAL_01	Diwali Items	\N	1	t	2026-05-16 14:10:55.075	2026-05-16 14:10:55.075	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2cm00clxsiaslzo40zz	cmonyq6yl000012mdyhe1kk88	General	SEASONAL_01_GEN	General	cmp8fc2cj00cjxsiak4wupqv6	1	t	2026-05-16 14:10:55.079	2026-05-16 14:10:55.079	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2cq00cnxsiaj3ex5g3r	cmonyq6yl000012mdyhe1kk88	Holi Items	SEASONAL_02	Holi Items	\N	2	t	2026-05-16 14:10:55.082	2026-05-16 14:10:55.082	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2ct00cpxsiapf01uhkq	cmonyq6yl000012mdyhe1kk88	General	SEASONAL_02_GEN	General	cmp8fc2cq00cnxsiaj3ex5g3r	1	t	2026-05-16 14:10:55.085	2026-05-16 14:10:55.085	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2cx00crxsia9uammaoy	cmonyq6yl000012mdyhe1kk88	Christmas Items	SEASONAL_03	Christmas Items	\N	3	t	2026-05-16 14:10:55.09	2026-05-16 14:10:55.09	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2eb00ctxsiaqy200wct	cmonyq6yl000012mdyhe1kk88	General	SEASONAL_03_GEN	General	cmp8fc2cx00crxsia9uammaoy	1	t	2026-05-16 14:10:55.14	2026-05-16 14:10:55.14	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2em00cvxsia0kapk6vw	cmonyq6yl000012mdyhe1kk88	Eid Items	SEASONAL_04	Eid Items	\N	4	t	2026-05-16 14:10:55.15	2026-05-16 14:10:55.15	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2ep00cxxsiaxb1la0cl	cmonyq6yl000012mdyhe1kk88	General	SEASONAL_04_GEN	General	cmp8fc2em00cvxsia0kapk6vw	1	t	2026-05-16 14:10:55.153	2026-05-16 14:10:55.153	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2es00czxsiaayih3ylk	cmonyq6yl000012mdyhe1kk88	Onam & Pongal	SEASONAL_05	Onam & Pongal	\N	5	t	2026-05-16 14:10:55.157	2026-05-16 14:10:55.157	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2ev00d1xsiab40hp2pz	cmonyq6yl000012mdyhe1kk88	General	SEASONAL_05_GEN	General	cmp8fc2es00czxsiaayih3ylk	1	t	2026-05-16 14:10:55.16	2026-05-16 14:10:55.16	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2f000d3xsiaja9w0wix	cmonyq6yl000012mdyhe1kk88	Gift Packs & Hampers	SEASONAL_06	Gift Packs & Hampers	\N	6	t	2026-05-16 14:10:55.164	2026-05-16 14:10:55.164	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2f400d5xsiaz45l3dp2	cmonyq6yl000012mdyhe1kk88	General	SEASONAL_06_GEN	General	cmp8fc2f000d3xsiaja9w0wix	1	t	2026-05-16 14:10:55.168	2026-05-16 14:10:55.168	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2f800d7xsiapfz3vlk2	cmonyq6yl000012mdyhe1kk88	Decorations	SEASONAL_07	Decorations	\N	7	t	2026-05-16 14:10:55.173	2026-05-16 14:10:55.173	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2fc00d9xsiazx39lzrk	cmonyq6yl000012mdyhe1kk88	General	SEASONAL_07_GEN	General	cmp8fc2f800d7xsiapfz3vlk2	1	t	2026-05-16 14:10:55.176	2026-05-16 14:10:55.176	t	cmp8fc2cf00chxsia6f0dl1n5
cmp8fc2fj00ddxsia1ksvqjwg	cmonyq6yl000012mdyhe1kk88	Mens Clothing	APPAREL_01	Mens Clothing	\N	1	t	2026-05-16 14:10:55.183	2026-05-16 14:10:55.183	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2fn00dfxsia976h47nt	cmonyq6yl000012mdyhe1kk88	General	APPAREL_01_GEN	General	cmp8fc2fj00ddxsia1ksvqjwg	1	t	2026-05-16 14:10:55.187	2026-05-16 14:10:55.187	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2fq00dhxsiaz5k6nobx	cmonyq6yl000012mdyhe1kk88	Womens Clothing	APPAREL_02	Womens Clothing	\N	2	t	2026-05-16 14:10:55.19	2026-05-16 14:10:55.19	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2ft00djxsia5iko1dzm	cmonyq6yl000012mdyhe1kk88	General	APPAREL_02_GEN	General	cmp8fc2fq00dhxsiaz5k6nobx	1	t	2026-05-16 14:10:55.194	2026-05-16 14:10:55.194	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2fw00dlxsiax14ldggv	cmonyq6yl000012mdyhe1kk88	Kids Clothing	APPAREL_03	Kids Clothing	\N	3	t	2026-05-16 14:10:55.196	2026-05-16 14:10:55.196	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2fz00dnxsia76xi2685	cmonyq6yl000012mdyhe1kk88	General	APPAREL_03_GEN	General	cmp8fc2fw00dlxsiax14ldggv	1	t	2026-05-16 14:10:55.2	2026-05-16 14:10:55.2	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2g200dpxsia3t9tj65j	cmonyq6yl000012mdyhe1kk88	Innerwear & Socks	APPAREL_04	Innerwear & Socks	\N	4	t	2026-05-16 14:10:55.203	2026-05-16 14:10:55.203	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2g600drxsia2ezywtrp	cmonyq6yl000012mdyhe1kk88	General	APPAREL_04_GEN	General	cmp8fc2g200dpxsia3t9tj65j	1	t	2026-05-16 14:10:55.206	2026-05-16 14:10:55.206	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2g900dtxsia9z03qqna	cmonyq6yl000012mdyhe1kk88	Nightwear	APPAREL_05	Nightwear	\N	5	t	2026-05-16 14:10:55.209	2026-05-16 14:10:55.209	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2gc00dvxsiaym8amd3o	cmonyq6yl000012mdyhe1kk88	General	APPAREL_05_GEN	General	cmp8fc2g900dtxsia9z03qqna	1	t	2026-05-16 14:10:55.212	2026-05-16 14:10:55.212	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2gf00dxxsia1rw29ad3	cmonyq6yl000012mdyhe1kk88	Handkerchiefs & Accessories	APPAREL_06	Handkerchiefs & Accessories	\N	6	t	2026-05-16 14:10:55.215	2026-05-16 14:10:55.215	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2gi00dzxsiab0708d37	cmonyq6yl000012mdyhe1kk88	General	APPAREL_06_GEN	General	cmp8fc2gf00dxxsia1rw29ad3	1	t	2026-05-16 14:10:55.219	2026-05-16 14:10:55.219	t	cmp8fc2ff00dbxsiaivpjwxrp
cmp8fc2go00e3xsiaosxhrx9o	cmonyq6yl000012mdyhe1kk88	Cookware	KITCHEN_01	Cookware	\N	1	t	2026-05-16 14:10:55.224	2026-05-16 14:10:55.224	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2gr00e5xsiamzyodv82	cmonyq6yl000012mdyhe1kk88	General	KITCHEN_01_GEN	General	cmp8fc2go00e3xsiaosxhrx9o	1	t	2026-05-16 14:10:55.227	2026-05-16 14:10:55.227	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2gu00e7xsiam2m6rp0i	cmonyq6yl000012mdyhe1kk88	Bakeware	KITCHEN_02	Bakeware	\N	2	t	2026-05-16 14:10:55.23	2026-05-16 14:10:55.23	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2gx00e9xsianvb0f4m5	cmonyq6yl000012mdyhe1kk88	General	KITCHEN_02_GEN	General	cmp8fc2gu00e7xsiam2m6rp0i	1	t	2026-05-16 14:10:55.233	2026-05-16 14:10:55.233	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2h000ebxsiakibbchv2	cmonyq6yl000012mdyhe1kk88	Kitchen Tools	KITCHEN_03	Kitchen Tools	\N	3	t	2026-05-16 14:10:55.237	2026-05-16 14:10:55.237	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2h300edxsiafvp5111m	cmonyq6yl000012mdyhe1kk88	General	KITCHEN_03_GEN	General	cmp8fc2h000ebxsiakibbchv2	1	t	2026-05-16 14:10:55.239	2026-05-16 14:10:55.239	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2h600efxsiarjm8dgxr	cmonyq6yl000012mdyhe1kk88	Storage Containers	KITCHEN_04	Storage Containers	\N	4	t	2026-05-16 14:10:55.243	2026-05-16 14:10:55.243	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2h900ehxsiav5y8swbo	cmonyq6yl000012mdyhe1kk88	General	KITCHEN_04_GEN	General	cmp8fc2h600efxsiarjm8dgxr	1	t	2026-05-16 14:10:55.246	2026-05-16 14:10:55.246	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2hd00ejxsiaa8tomq5m	cmonyq6yl000012mdyhe1kk88	Water Bottles & Flasks	KITCHEN_05	Water Bottles & Flasks	\N	5	t	2026-05-16 14:10:55.249	2026-05-16 14:10:55.249	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2hf00elxsiabe0tll1a	cmonyq6yl000012mdyhe1kk88	General	KITCHEN_05_GEN	General	cmp8fc2hd00ejxsiaa8tomq5m	1	t	2026-05-16 14:10:55.252	2026-05-16 14:10:55.252	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2hj00enxsiaee4ym54r	cmonyq6yl000012mdyhe1kk88	Pressure Cookers	KITCHEN_06	Pressure Cookers	\N	6	t	2026-05-16 14:10:55.255	2026-05-16 14:10:55.255	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2hl00epxsiaghs84j4q	cmonyq6yl000012mdyhe1kk88	General	KITCHEN_06_GEN	General	cmp8fc2hj00enxsiaee4ym54r	1	t	2026-05-16 14:10:55.258	2026-05-16 14:10:55.258	t	cmp8fc2gk00e1xsiaf4r0hsp6
cmp8fc2hr00etxsiagdi3tqos	cmonyq6yl000012mdyhe1kk88	Footwear	GENERAL_01	Footwear	\N	1	t	2026-05-16 14:10:55.263	2026-05-16 14:10:55.263	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2hu00evxsia206y0vde	cmonyq6yl000012mdyhe1kk88	General	GENERAL_01_GEN	General	cmp8fc2hr00etxsiagdi3tqos	1	t	2026-05-16 14:10:55.267	2026-05-16 14:10:55.267	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2hx00exxsiaaokcgrgs	cmonyq6yl000012mdyhe1kk88	Bags & Luggage	GENERAL_02	Bags & Luggage	\N	2	t	2026-05-16 14:10:55.269	2026-05-16 14:10:55.269	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2i100ezxsia9clpse0t	cmonyq6yl000012mdyhe1kk88	General	GENERAL_02_GEN	General	cmp8fc2hx00exxsiaaokcgrgs	1	t	2026-05-16 14:10:55.273	2026-05-16 14:10:55.273	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2i500f1xsiaozdwoc9e	cmonyq6yl000012mdyhe1kk88	Toys & Games	GENERAL_03	Toys & Games	\N	3	t	2026-05-16 14:10:55.277	2026-05-16 14:10:55.277	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2i900f3xsiadqq07x3z	cmonyq6yl000012mdyhe1kk88	General	GENERAL_03_GEN	General	cmp8fc2i500f1xsiaozdwoc9e	1	t	2026-05-16 14:10:55.281	2026-05-16 14:10:55.281	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2ic00f5xsiah1m3bg32	cmonyq6yl000012mdyhe1kk88	Gifts & Novelties	GENERAL_04	Gifts & Novelties	\N	4	t	2026-05-16 14:10:55.285	2026-05-16 14:10:55.285	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2ig00f7xsialwiz04sz	cmonyq6yl000012mdyhe1kk88	General	GENERAL_04_GEN	General	cmp8fc2ic00f5xsiah1m3bg32	1	t	2026-05-16 14:10:55.289	2026-05-16 14:10:55.289	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2ik00f9xsiacn2gxt1i	cmonyq6yl000012mdyhe1kk88	Candles & Match Box	GENERAL_05	Candles & Match Box	\N	5	t	2026-05-16 14:10:55.292	2026-05-16 14:10:55.292	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2io00fbxsialgk53uaw	cmonyq6yl000012mdyhe1kk88	General	GENERAL_05_GEN	General	cmp8fc2ik00f9xsiacn2gxt1i	1	t	2026-05-16 14:10:55.296	2026-05-16 14:10:55.296	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2ir00fdxsia9zlv7rnr	cmonyq6yl000012mdyhe1kk88	Umbrellas	GENERAL_06	Umbrellas	\N	6	t	2026-05-16 14:10:55.3	2026-05-16 14:10:55.3	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2iw00ffxsiagyu75ma9	cmonyq6yl000012mdyhe1kk88	General	GENERAL_06_GEN	General	cmp8fc2ir00fdxsia9zlv7rnr	1	t	2026-05-16 14:10:55.304	2026-05-16 14:10:55.304	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2iz00fhxsiaopc0v611	cmonyq6yl000012mdyhe1kk88	Miscellaneous	GENERAL_07	Miscellaneous	\N	7	t	2026-05-16 14:10:55.308	2026-05-16 14:10:55.308	t	cmp8fc2ho00erxsia4xiqduhm
cmp8fc2j300fjxsia7hxvnnrh	cmonyq6yl000012mdyhe1kk88	General	GENERAL_07_GEN	General	cmp8fc2iz00fhxsiaopc0v611	1	t	2026-05-16 14:10:55.311	2026-05-16 14:10:55.311	t	cmp8fc2ho00erxsia4xiqduhm
cmp8o6d9l000a9q0lkowgejmn	cmonyq6yl000012mdyhe1kk88	Raw Sugar & Sweeteners	SUPPLIES_01	Raw Sugar & Sweeteners	\N	1	t	2026-05-16 18:18:25.833	2026-05-16 18:18:25.833	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6d9o000c9q0l6rvnw0xu	cmonyq6yl000012mdyhe1kk88	Raw Pulses & Dal	SUPPLIES_02	Raw Pulses & Dal	\N	2	t	2026-05-16 18:18:25.836	2026-05-16 18:18:25.836	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6d9q000e9q0l1ntkc82u	cmonyq6yl000012mdyhe1kk88	Raw Rice & Grains	SUPPLIES_03	Raw Rice & Grains	\N	3	t	2026-05-16 18:18:25.838	2026-05-16 18:18:25.838	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6d9t000g9q0llzaqissc	cmonyq6yl000012mdyhe1kk88	Raw Spices & Masalas	SUPPLIES_04	Raw Spices & Masalas	\N	4	t	2026-05-16 18:18:25.841	2026-05-16 18:18:25.841	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6d9v000i9q0l46p4n06o	cmonyq6yl000012mdyhe1kk88	Raw Dry Fruits & Nuts	SUPPLIES_05	Raw Dry Fruits & Nuts	\N	5	t	2026-05-16 18:18:25.843	2026-05-16 18:18:25.843	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6d9x000k9q0lmpr5t4tt	cmonyq6yl000012mdyhe1kk88	Raw Oils & Ghee (bulk)	SUPPLIES_06	Raw Oils & Ghee (bulk)	\N	6	t	2026-05-16 18:18:25.846	2026-05-16 18:18:25.846	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6d9z000m9q0lu24rdrcq	cmonyq6yl000012mdyhe1kk88	Packaging Pouches	SUPPLIES_07	Packaging Pouches	\N	7	t	2026-05-16 18:18:25.848	2026-05-16 18:18:25.848	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6da1000o9q0li64drj5f	cmonyq6yl000012mdyhe1kk88	Labels & Stickers	SUPPLIES_08	Labels & Stickers	\N	8	t	2026-05-16 18:18:25.85	2026-05-16 18:18:25.85	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6da4000q9q0l0e9ia2kn	cmonyq6yl000012mdyhe1kk88	Boxes & Cartons	SUPPLIES_09	Boxes & Cartons	\N	9	t	2026-05-16 18:18:25.852	2026-05-16 18:18:25.852	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6da7000s9q0lczvgxy7p	cmonyq6yl000012mdyhe1kk88	Twine & Tape	SUPPLIES_10	Twine & Tape	\N	10	t	2026-05-16 18:18:25.855	2026-05-16 18:18:25.855	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6da9000u9q0l1adxr7q2	cmonyq6yl000012mdyhe1kk88	Other Packaging Supplies	SUPPLIES_11	Other Packaging Supplies	\N	11	t	2026-05-16 18:18:25.857	2026-05-16 18:18:25.857	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6dab000w9q0lhvnx88ek	cmonyq6yl000012mdyhe1kk88	Prepaid Mobile Recharge	TELECOM_01	Prepaid Mobile Recharge	\N	1	t	2026-05-16 18:18:25.86	2026-05-16 18:18:25.86	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dad000y9q0l7iteb6a4	cmonyq6yl000012mdyhe1kk88	Postpaid Bill Payment	TELECOM_02	Postpaid Bill Payment	\N	2	t	2026-05-16 18:18:25.862	2026-05-16 18:18:25.862	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6daf00109q0ldgfgmlx7	cmonyq6yl000012mdyhe1kk88	DTH Recharge	TELECOM_03	DTH Recharge	\N	3	t	2026-05-16 18:18:25.863	2026-05-16 18:18:25.863	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dag00129q0l581yjrx1	cmonyq6yl000012mdyhe1kk88	Gift Cards & Vouchers	TELECOM_04	Gift Cards & Vouchers	\N	4	t	2026-05-16 18:18:25.865	2026-05-16 18:18:25.865	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dai00149q0lvqneazit	cmonyq6yl000012mdyhe1kk88	FASTag Recharge	TELECOM_05	FASTag Recharge	\N	5	t	2026-05-16 18:18:25.867	2026-05-16 18:18:25.867	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dak00169q0lq4sp8xg4	cmonyq6yl000012mdyhe1kk88	SIM Cards & New Connections	TELECOM_06	SIM Cards & New Connections	\N	6	t	2026-05-16 18:18:25.868	2026-05-16 18:18:25.868	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dam00189q0lw636awal	cmonyq6yl000012mdyhe1kk88	Utility Bill Payments	TELECOM_07	Utility Bill Payments	\N	7	t	2026-05-16 18:18:25.871	2026-05-16 18:18:25.871	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dap001a9q0lfv4hz9jg	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_01_GEN	General	cmp8o6d9l000a9q0lkowgejmn	1	t	2026-05-16 18:18:25.874	2026-05-16 18:18:25.874	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6das001c9q0lygx7kxyo	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_02_GEN	General	cmp8o6d9o000c9q0l6rvnw0xu	1	t	2026-05-16 18:18:25.877	2026-05-16 18:18:25.877	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6dav001e9q0l3kav13tp	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_03_GEN	General	cmp8o6d9q000e9q0l1ntkc82u	1	t	2026-05-16 18:18:25.88	2026-05-16 18:18:25.88	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6day001g9q0l5km4k4lw	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_04_GEN	General	cmp8o6d9t000g9q0llzaqissc	1	t	2026-05-16 18:18:25.882	2026-05-16 18:18:25.882	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6db0001i9q0ltwpahabu	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_05_GEN	General	cmp8o6d9v000i9q0l46p4n06o	1	t	2026-05-16 18:18:25.884	2026-05-16 18:18:25.884	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6db2001k9q0l9l3qownf	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_06_GEN	General	cmp8o6d9x000k9q0lmpr5t4tt	1	t	2026-05-16 18:18:25.886	2026-05-16 18:18:25.886	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6db3001m9q0lvxisqtk9	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_07_GEN	General	cmp8o6d9z000m9q0lu24rdrcq	1	t	2026-05-16 18:18:25.888	2026-05-16 18:18:25.888	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6db5001o9q0lxj7dl6zk	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_08_GEN	General	cmp8o6da1000o9q0li64drj5f	1	t	2026-05-16 18:18:25.89	2026-05-16 18:18:25.89	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6db7001q9q0lpt5x5667	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_09_GEN	General	cmp8o6da4000q9q0l0e9ia2kn	1	t	2026-05-16 18:18:25.891	2026-05-16 18:18:25.891	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6db9001s9q0lsyzp1d0d	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_10_GEN	General	cmp8o6da7000s9q0lczvgxy7p	1	t	2026-05-16 18:18:25.893	2026-05-16 18:18:25.893	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6dba001u9q0l542efzgn	cmonyq6yl000012mdyhe1kk88	General	SUPPLIES_11_GEN	General	cmp8o6da9000u9q0l1adxr7q2	1	t	2026-05-16 18:18:25.895	2026-05-16 18:18:25.895	t	cmp8o6d9f00069q0ltprkz01u
cmp8o6dbc001w9q0l7ac9ge9j	cmonyq6yl000012mdyhe1kk88	General	TELECOM_01_GEN	General	cmp8o6dab000w9q0lhvnx88ek	1	t	2026-05-16 18:18:25.897	2026-05-16 18:18:25.897	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dbe001y9q0lxnllp13a	cmonyq6yl000012mdyhe1kk88	General	TELECOM_02_GEN	General	cmp8o6dad000y9q0l7iteb6a4	1	t	2026-05-16 18:18:25.898	2026-05-16 18:18:25.898	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dbg00209q0lflrmtftd	cmonyq6yl000012mdyhe1kk88	General	TELECOM_03_GEN	General	cmp8o6daf00109q0ldgfgmlx7	1	t	2026-05-16 18:18:25.9	2026-05-16 18:18:25.9	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dbh00229q0ldefh2ylr	cmonyq6yl000012mdyhe1kk88	General	TELECOM_04_GEN	General	cmp8o6dag00129q0l581yjrx1	1	t	2026-05-16 18:18:25.902	2026-05-16 18:18:25.902	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dbj00249q0lapmn45pg	cmonyq6yl000012mdyhe1kk88	General	TELECOM_05_GEN	General	cmp8o6dai00149q0lvqneazit	1	t	2026-05-16 18:18:25.903	2026-05-16 18:18:25.903	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dbk00269q0loxv2oslz	cmonyq6yl000012mdyhe1kk88	General	TELECOM_06_GEN	General	cmp8o6dak00169q0lq4sp8xg4	1	t	2026-05-16 18:18:25.905	2026-05-16 18:18:25.905	t	cmp8o6d9i00089q0l2mgwp0ol
cmp8o6dbm00289q0lzjup69iu	cmonyq6yl000012mdyhe1kk88	General	TELECOM_07_GEN	General	cmp8o6dam00189q0lw636awal	1	t	2026-05-16 18:18:25.906	2026-05-16 18:18:25.906	t	cmp8o6d9i00089q0l2mgwp0ol
\.


--
-- Data for Name: credit_note; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.credit_note (id, "creditNoteNumber", "businessId", "branchId", "originalBillId", "originalBillNumber", "customerId", "customerName", "customerPhone", reason, "subtotalAmount", "taxAmount", "cgstAmount", "sgstAmount", "totalAmount", "refundMode", "refundStatus", "refundCompletedAt", "createdById", "createdByName", "createdAt", "updatedAt") FROM stdin;
cmoptc1f5000wr6z27wkay9tz	CN/2026-27/0001	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmoptb78e000gr6z2as3fgof5	GST/2026-27/0014	\N	\N	\N	khvbhjvb ufffigu	20.00	2.14	1.07	1.07	20.00	STORE_CREDIT	PENDING	\N	cmonyq6zo000212md1ehfe0vm	admin	2026-05-03 13:35:11.153	2026-05-03 13:35:11.153
\.


--
-- Data for Name: credit_note_item; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.credit_note_item (id, "creditNoteId", "productId", "productName", "hsnCode", quantity, "unitPrice", "gstRatePercent", "cgstAmount", "sgstAmount", "totalAmount", "isReturnable") FROM stdin;
cmoptc1f5000xr6z2umlotkhx	cmoptc1f5000wr6z27wkay9tz	cmonyv3bp005812md4140psg2	Lays Classic Salted 26g	1905	1.000	20.00	12.00	1.07	1.07	20.00	t
\.


--
-- Data for Name: customer; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.customer (id, "businessId", name, phone, email, gstin, address, "stateCode", "customerType", "creditLimit", "outstandingBalance", "loyaltyPoints", "isActive", "createdAt", "updatedAt", anniversary, "billingAddress", channel, "companyName", "consentGivenAt", "customerCode", "customerGroup", "dateOfBirth", "emailOptIn", "isSystemDefault", "openingBalance", "passwordHash", "smsOptIn", status, "whatsappOptIn") FROM stdin;
cmphyjzmm0002mm6y3ce0dtr4	cmonyq6yl000012mdyhe1kk88	Walk-in Customer	\N	\N	\N	\N	\N	WALKIN	0.00	0.00	0	t	2026-05-23 06:18:53.085	2026-05-23 06:18:53.085	\N	\N	POS	\N	\N	000001	\N	\N	f	t	0.00	\N	f	ACTIVE	f
cmphyp4no0005mm6ydf8bsxk0	cmonyq6yl000012mdyhe1kk88	Test Customer	9876543210	\N	\N	\N	\N	REGULAR	5000.00	0.00	0	t	2026-05-23 06:22:52.884	2026-05-23 06:22:52.884	\N	\N	POS	\N	\N	000002	\N	\N	f	f	1000.00	\N	f	ACTIVE	f
cmphyp4of0008mm6yoy81h3bj	cmonyq6yl000012mdyhe1kk88	9123456789	9123456789	\N	\N	\N	\N	REGULAR	0.00	0.00	0	t	2026-05-23 06:22:52.911	2026-05-23 06:22:52.911	\N	\N	POS	\N	\N	000003	\N	\N	f	f	0.00	\N	f	ACTIVE	f
cmphz1vak0005bqbhvxc1nfud	cmonyq6yl000012mdyhe1kk88	Walk-in	9000000002	\N	\N	\N	\N	REGULAR	0.00	0.00	0	t	2026-05-23 06:32:47.277	2026-05-23 06:32:47.277	\N	\N	POS	\N	\N	000005	\N	\N	f	f	0.00	\N	f	ACTIVE	f
cmphz1va50002bqbhlk6g91xy	cmonyq6yl000012mdyhe1kk88	Ravi Kumar	9000000001	\N	\N	\N	\N	REGULAR	10000.00	0.00	0	t	2026-05-23 06:32:47.261	2026-05-23 06:32:47.381	\N	\N	POS	\N	\N	000004	VIP	\N	f	f	2000.00	\N	f	ACTIVE	t
\.


--
-- Data for Name: customer_address; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.customer_address (id, "businessId", "customerId", label, line1, line2, city, state, pincode, "isDefault", "createdAt") FROM stdin;
cmpi1f2p60002fj8s581svpwr	cmonyq6yl000012mdyhe1kk88	cmphz1va50002bqbhlk6g91xy	Home	123 Main Street	\N	Hyderabad	Telangana	500001	f	2026-05-23 07:39:02.634
\.


--
-- Data for Name: customer_payment; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.customer_payment (id, "businessId", "customerId", amount, "paymentMode", reference, notes, "billId", "paymentDate", "createdBy", "createdByName", "createdAt") FROM stdin;
\.


--
-- Data for Name: day_closure; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.day_closure (id, "businessId", "branchId", "closureDate", status, "systemCash", "actualCash", "cashDifference", "totalBills", "totalSales", "totalCash", "totalUpi", "totalCard", "cashCounted", "grnsPending", "grnsCleared", "stockAlertsAck", "closedById", "closedAt", notes, "createdAt", "openedById", "openedByName") FROM stdin;
cmoxtt2oh001o7py6gow7bh5d	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	2026-05-08	COMPLETED	0.00	0.00	0.00	0	0.00	0.00	0.00	0.00	f	0	f	f	\N	2026-05-17 13:13:33.512	Test data cleanup	2026-05-09 04:10:35.346	cmonyq6zo000212md1ehfe0vm	admin
cmp5afrfk0001klsfo5p70ayt	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	2026-05-13	COMPLETED	0.00	0.00	0.00	0	0.00	0.00	0.00	0.00	f	0	f	f	\N	2026-05-17 13:13:33.512	Test data cleanup	2026-05-14 09:30:30.944	cmonyq6zo000212md1ehfe0vm	admin
cmp6txukb0001ifu71y85hcx3	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	2026-05-14	COMPLETED	0.00	0.00	0.00	0	0.00	0.00	0.00	0.00	f	0	f	f	\N	2026-05-17 13:13:33.512	Test data cleanup	2026-05-15 11:24:13.691	cmonyq6zo000212md1ehfe0vm	admin
cmp86jgqw001op6sna06zftw7	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	2026-05-15	COMPLETED	0.00	0.00	0.00	0	0.00	0.00	0.00	0.00	f	0	f	f	\N	2026-05-17 13:13:33.512	Test data cleanup	2026-05-16 10:04:43.784	cmonyq6zo000212md1ehfe0vm	admin
cmp9j50yp0001zemnul6j9qhz	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	2026-05-16	COMPLETED	0.00	0.00	0.00	0	0.00	0.00	0.00	0.00	f	0	f	f	\N	2026-05-17 13:13:33.512	Test data cleanup	2026-05-17 08:45:11.329	cmonyq6zo000212md1ehfe0vm	admin
cmpa47m9h0002dvpma10i57dn	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	2026-05-17	PENDING	0.00	\N	\N	0	0.00	0.00	0.00	0.00	f	0	f	f	\N	\N	\N	2026-05-17 18:35:04.181	cmonyq6zo000212md1ehfe0vm	admin
cmpc8u0mp0001sideh9n4pfce	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	2026-05-18	PENDING	0.00	\N	\N	0	0.00	0.00	0.00	0.00	f	0	f	f	\N	\N	\N	2026-05-19 06:20:00.047	cmonyq6zo000212md1ehfe0vm	admin
\.


--
-- Data for Name: department; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.department (id, "businessId", name, code, "sortOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
cmp8fc1qo0001xsiajwfjq2rv	cmonyq6yl000012mdyhe1kk88	Food & Grocery	FOOD	1	t	2026-05-16 14:10:54.288	2026-05-16 14:10:54.288
cmp8fc1vm002jxsia0fkpmqsp	cmonyq6yl000012mdyhe1kk88	Fruits & Vegetables	FRVEG	2	t	2026-05-16 14:10:54.466	2026-05-16 14:10:54.466
cmp8fc1x5003dxsiamgt1yc3x	cmonyq6yl000012mdyhe1kk88	Meat Fish & Eggs	MEAT	3	t	2026-05-16 14:10:54.522	2026-05-16 14:10:54.522
cmp8fc1y7003zxsiadq62v3sw	cmonyq6yl000012mdyhe1kk88	Home Care	HOMECARE	4	t	2026-05-16 14:10:54.56	2026-05-16 14:10:54.56
cmp8fc2020055xsiaj8v48uuy	cmonyq6yl000012mdyhe1kk88	Personal Care	PERSONAL	5	t	2026-05-16 14:10:54.627	2026-05-16 14:10:54.627
cmp8fc226006fxsiay04ke631	cmonyq6yl000012mdyhe1kk88	Baby Care	BABY	6	t	2026-05-16 14:10:54.703	2026-05-16 14:10:54.703
cmp8fc23l0079xsia77r56l5u	cmonyq6yl000012mdyhe1kk88	Health & Wellness	HEALTH	7	t	2026-05-16 14:10:54.753	2026-05-16 14:10:54.753
cmp8fc25k008fxsiawi2yr9kt	cmonyq6yl000012mdyhe1kk88	Pet Care	PETCARE	8	t	2026-05-16 14:10:54.824	2026-05-16 14:10:54.824
cmp8fc26x0099xsiagkj5dga8	cmonyq6yl000012mdyhe1kk88	Stationery & Office	STATIONERY	9	t	2026-05-16 14:10:54.873	2026-05-16 14:10:54.873
cmp8fc285009zxsiah9fdf9c8	cmonyq6yl000012mdyhe1kk88	Electrical & Hardware	ELECTRICAL	10	t	2026-05-16 14:10:54.917	2026-05-16 14:10:54.917
cmp8fc29a00apxsiaprp6q0vp	cmonyq6yl000012mdyhe1kk88	Tobacco & Related	TOBACCO	11	t	2026-05-16 14:10:54.958	2026-05-16 14:10:54.958
cmp8fc2am00bjxsia2n36v2nz	cmonyq6yl000012mdyhe1kk88	Liquor & Beverages	LIQUOR	12	t	2026-05-16 14:10:55.006	2026-05-16 14:10:55.006
cmp8fc2cf00chxsia6f0dl1n5	cmonyq6yl000012mdyhe1kk88	Seasonal & Festive	SEASONAL	13	t	2026-05-16 14:10:55.072	2026-05-16 14:10:55.072
cmp8fc2ff00dbxsiaivpjwxrp	cmonyq6yl000012mdyhe1kk88	Apparel & Clothing	APPAREL	14	t	2026-05-16 14:10:55.18	2026-05-16 14:10:55.18
cmp8fc2gk00e1xsiaf4r0hsp6	cmonyq6yl000012mdyhe1kk88	Kitchen & Cookware	KITCHEN	15	t	2026-05-16 14:10:55.221	2026-05-16 14:10:55.221
cmp8fc2ho00erxsia4xiqduhm	cmonyq6yl000012mdyhe1kk88	General Merchandise	GENERAL	16	t	2026-05-16 14:10:55.261	2026-05-16 14:10:55.261
cmp8o6d9f00069q0ltprkz01u	cmonyq6yl000012mdyhe1kk88	Raw Materials & Packaging	SUPPLIES	17	t	2026-05-16 18:18:25.828	2026-05-16 18:18:25.828
cmp8o6d9i00089q0l2mgwp0ol	cmonyq6yl000012mdyhe1kk88	Telecom & Recharge	TELECOM	18	t	2026-05-16 18:18:25.83	2026-05-16 18:18:25.83
\.


--
-- Data for Name: expense; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.expense (id, "businessId", "branchId", "expenseDate", category, amount, "paymentMode", "vendorName", "referenceNo", description, remarks, "createdAt") FROM stdin;
\.


--
-- Data for Name: financial_year; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.financial_year (id, "businessId", "fyCode", "startDate", "endDate", "isActive", "createdAt") FROM stdin;
cmonyv34h000612mdb1dt28fi	cmonyq6yl000012mdyhe1kk88	2026-27	2026-03-31 18:30:00	2027-03-30 18:30:00	t	2026-05-02 06:34:25.553
\.


--
-- Data for Name: held_bill; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.held_bill (id, "holdNumber", "businessId", "branchId", "createdByUserId", "createdByName", "counterName", "billType", "customerId", "customerName", "customerPhone", "customerGstin", "isB2B", "itemsJson", subtotal, "grandTotal", "itemCount", status, "heldAt", "updatedAt") FROM stdin;
cmopevehr00096qvuk7afmqr8	HOLD-00001	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyq6zo000212md1ehfe0vm	admin	Counter 1	TAX_INVOICE	\N	\N	\N	\N	f	[{"productId":"cmonyv3bp005812md4140psg2","taxId":"cmonyv34w000e12mdhkn3t9su","productName":"Lays Classic Salted 26g","quantity":1,"unitPrice":20,"discountPercent":0,"gstRatePercent":12,"totalAmount":20}]	20.00	20.00	1	COMPLETED	2026-05-03 06:50:20.32	2026-05-03 06:51:15.697
cmoxqnf4i000svb50k6ua51ud	HOLD-00002	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyq6zo000212md1ehfe0vm	admin	Counter 1	TAX_INVOICE	\N	\N	\N	\N	f	[{"productId":"cmonyv3bx005c12md2wn5c4cw","taxId":"cmonyv34z000g12mdr8kuzy4g","productName":"Colgate MaxFresh 150g","quantity":1,"unitPrice":105,"discountPercent":0,"gstRatePercent":18,"totalAmount":105}]	105.00	105.00	1	COMPLETED	2026-05-09 02:42:12.691	2026-05-09 02:42:24.845
cmoxrbolq00051005atqddho8	HOLD-00003	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyq6zo000212md1ehfe0vm	admin	Counter 1	TAX_INVOICE	\N	\N	\N	\N	f	[{"productId":"cmonyv3bx005c12md2wn5c4cw","taxId":"cmonyv34z000g12mdr8kuzy4g","productName":"Colgate MaxFresh 150g","quantity":1,"unitPrice":105,"discountPercent":0,"gstRatePercent":18,"totalAmount":105}]	105.00	105.00	1	COMPLETED	2026-05-09 03:01:04.718	2026-05-09 03:01:16.151
cmoxt280y00007py6am8dbe20	HOLD-00004	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyq6zo000212md1ehfe0vm	admin	Counter 1	TAX_INVOICE	\N	\N	\N	\N	f	[{"productId":"cmonyv3bp005812md4140psg2","taxId":"cmonyv34w000e12mdhkn3t9su","productName":"Lays Classic Salted 26g","name":"Lays Classic Salted 26g","barcode":"8901491000002","mrp":20,"unitOfMeasure":"PCS","quantity":1,"unitPrice":20,"discountPercent":0,"gstRatePercent":12,"totalAmount":20}]	20.00	20.00	1	COMPLETED	2026-05-09 03:49:42.562	2026-05-09 03:49:48.578
\.


--
-- Data for Name: notification; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.notification (id, "businessId", type, title, message, "productId", "isRead", "createdAt", "actionLabel", "actionUrl", channel, priority, "purchaseId", "readAt", "readById", "supplierId") FROM stdin;
cmooakl2p0003qaq26ce5lcx9	cmonyq6yl000012mdyhe1kk88	SYSTEM	Day Closed — 02 May	Sales: ₹0 · Cash: ₹0 · UPI: ₹0 · Diff: ₹0	\N	t	2026-05-02 12:02:10.994	\N	\N	IN_APP	NORMAL	\N	2026-05-02 12:02:20.973	\N	\N
cmoptc1fj0011r6z2zf1elff1	cmonyq6yl000012mdyhe1kk88	SYSTEM	Credit Note Created: CN/2026-27/0001	Against bill GST/2026-27/0014. Amount: Rs.20. Mode: STORE_CREDIT	\N	t	2026-05-03 13:35:11.167	\N	\N	IN_APP	NORMAL	\N	2026-05-03 13:43:16.569	\N	\N
cmp89xo8v0029p6snyg3qydhy	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00012 from Sri Balaji Traders (Rs.542) needs approval.	\N	t	2026-05-16 11:39:45.535	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp89xo8j0022p6sn563vwms0	2026-05-17 14:07:57.171	\N	cmonyv3ah004q12mdo6l1i7b8
cmop30vhq004nwtffcesofgs8	cmonyq6yl000012mdyhe1kk88	SYSTEM	Day Closed — 03 May	Sales: ₹0 · Cash: ₹0 · UPI: ₹0 · Diff: ₹0	\N	t	2026-05-03 01:18:40.238	\N	\N	IN_APP	NORMAL	\N	2026-05-17 14:08:07.085	\N	\N
cmop39gdj005hwtffc6e0zoda	cmonyq6yl000012mdyhe1kk88	OUT_OF_STOCK	Out of Stock: Tata Salt 1kg	Last unit sold. Auto-deactivated in POS. Create GRN to restock.	cmonyv3b8005012mdywbgr2uv	t	2026-05-03 01:25:20.551	Create GRN	/dashboard/grn/new	IN_APP	URGENT	\N	2026-05-17 14:08:07.085	\N	\N
cmoxqpr2i000wvb50lfqy58uj	cmonyq6yl000012mdyhe1kk88	SYSTEM	Day Closed — 09 May	Sales: ₹213 · Cash: ₹193 · UPI: ₹20 · Diff: ₹-28	\N	t	2026-05-09 02:44:01.482	\N	\N	IN_APP	NORMAL	\N	2026-05-17 14:08:07.085	\N	\N
cmozg6psy0005gd87p3u6kr8z	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00001 from Hindustan Unilever Dist needs approval.	\N	t	2026-05-10 07:24:49.571	Review GRN	/dashboard/grn	IN_APP	HIGH	cmozg63ff0001gd87xr9gotys	2026-05-17 14:08:07.085	\N	cmonyv3al004s12mdnzbg46c8
cmozg891s000dgd87tz5gzccx	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00002 from Hindustan Unilever Dist (Rs.685.68) needs approval.	\N	t	2026-05-10 07:26:01.169	Review GRN	/dashboard/grn	IN_APP	HIGH	cmozg891m0009gd8779l2keh9	2026-05-17 14:08:07.085	\N	cmonyv3al004s12mdnzbg46c8
cmp6gipik0005x1ue6zdirgua	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00006 from Hindustan Unilever Dist (Rs.1000.02) needs approval.	\N	t	2026-05-15 05:08:32.301	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp6gipi90001x1ueac4k6b7b	2026-05-17 14:08:07.085	\N	cmonyv3al004s12mdnzbg46c8
cmp6ji8o50005bi5be0n609cb	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00007 from SRI SAI VENKATESHWARA AGENCIES (Rs.999.65) needs approval.	\N	t	2026-05-15 06:32:09.317	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp6ji8nv0001bi5bvqecerc1	2026-05-17 14:08:07.085	\N	cmozx2rlr000113kf71fpiesa
cmp6r0xd90009u24escsshnb2	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00008 from SRI SAI VENKATESHWARA AGENCIES (Rs.4213.43) needs approval.	\N	t	2026-05-15 10:02:38.445	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp6r0xct0001u24ekf085418	2026-05-17 14:08:07.085	\N	cmozx2rlr000113kf71fpiesa
cmp6r6rhf000tu24ezuig8f7t	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00009 from SRI SAI VENKATESHWARA AGENCIES (Rs.4213.43) needs approval.	\N	t	2026-05-15 10:07:10.755	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp6r6rh3000lu24e149ck0va	2026-05-17 14:08:07.085	\N	cmozx2rlr000113kf71fpiesa
cmp70wg3x000h1203aubk4adw	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00010 from Hindustan Unilever Dist (Rs.1000.08) needs approval.	\N	t	2026-05-15 14:39:05.613	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp70wg3o000d1203txshsyg2	2026-05-17 14:08:07.085	\N	cmonyv3al004s12mdnzbg46c8
cmp86ls8m001sp6snrwe27w9d	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00011 from SRI Laxmi Agencies needs approval.	\N	t	2026-05-16 10:06:31.991	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp86iw9b001cp6snk0qo9cr1	2026-05-17 14:08:07.085	\N	cmp85hsbq0015p6snd289grri
cmp9wz6av0015ytno8grtwie5	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00013 from MK Traders (Rs.2841.02) needs approval.	\N	t	2026-05-17 15:12:32.935	Review GRN	/dashboard/grn	IN_APP	HIGH	cmp9wz6aj000zytnozeq5pesd	2026-05-18 05:30:17.719	\N	cmp9vfmfc0001ytno3x114u3n
cmpb30syt000i32e9guznc0we	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00014 from Raj Enterprises (Rs.42768) needs approval.	\N	f	2026-05-18 10:49:32.837	Review GRN	/dashboard/grn	IN_APP	HIGH	cmpb30syi000e32e9fp1ba5o1	\N	\N	cmpb2vu7q000c32e99fbsk1rr
cmpb316in000r32e9x6nyqeu8	cmonyq6yl000012mdyhe1kk88	OUT_OF_STOCK	Out of Stock: Three Mango Chilli Powder 500g	Last unit sold. Auto-deactivated in POS. Create GRN to restock.	cmpb2tjr9000432e9d1539q7o	f	2026-05-18 10:49:50.399	Create GRN	/dashboard/grn/new	IN_APP	URGENT	\N	\N	\N	\N
cmpcfbkq80006f0y7d8nueab4	cmonyq6yl000012mdyhe1kk88	RESTOCKED	Restocked: Three Mango Chilli Powder 500g	Stock replenished via GRN GRN/2026-27/00014. Product active in POS.	cmpb2tjr9000432e9d1539q7o	f	2026-05-19 09:21:36.945	\N	\N	IN_APP	NORMAL	\N	\N	\N	\N
cmpcgu0jm000xf0y7j8jq9skf	cmonyq6yl000012mdyhe1kk88	GRN_PENDING	GRN Pending Approval	GRN GRN/2026-27/00015 from MK Traders (Rs.548) needs approval.	\N	f	2026-05-19 10:03:56.866	Review GRN	/dashboard/grn	IN_APP	HIGH	cmpcgu0jb000sf0y79tml6m1b	\N	\N	cmp9vfmfc0001ytno3x114u3n
\.


--
-- Data for Name: pos_counter; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.pos_counter (id, "businessId", "branchId", name, code, status, "createdAt", description) FROM stdin;
cmonyv3c4005g12md0d4nloyd	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	Counter 1	C1	ACTIVE	2026-05-02 06:34:25.828	\N
cmoy6am37004jb32ssia3zwg8	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	Counter 2	C2	ACTIVE	2026-05-09 10:00:09.043	\N
cmoy6am3c004lb32s4pun615w	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	Counter 3	C3	ACTIVE	2026-05-09 10:00:09.048	\N
cmoy6am3f004nb32s8m8m1xwd	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	Counter 4	C4	ACTIVE	2026-05-09 10:00:09.052	\N
cmoy6am3j004pb32sup32l58x	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	Counter 5	C5	ACTIVE	2026-05-09 10:00:09.056	\N
\.


--
-- Data for Name: pos_shift; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.pos_shift (id, "counterId", "cashierId", "branchId", "shiftDate", "openingCash", "closingCash", "expectedCash", "cashDiff", "totalSales", "totalBills", "totalCash", "totalUpi", "totalCard", status, "startTime", "endTime", "createdAt", "cashierName", notes) FROM stdin;
cmp86jmb4001qp6sn8hahdynq	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-16 10:04:50.992	1000.00	\N	\N	\N	0.00	0	0.00	0.00	0.00	CLOSED	2026-05-16 10:04:50.992	2026-05-17 13:13:33.512	2026-05-16 10:04:50.992	Srivani Admin	Test data cleanup
cmp9j57v20003zemnz52y2cw9	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-17 08:45:20.27	1000.00	\N	\N	\N	0.00	0	0.00	0.00	0.00	CLOSED	2026-05-17 08:45:20.269	2026-05-17 13:13:33.512	2026-05-17 08:45:20.27	Srivani Admin	Test data cleanup
cmoy9iovs0001bw1nfj0sz7zf	cmonyv3c4005g12md0d4nloyd	cmoy6amcv004vb32s2juovfxj	cmonyv34b000412mdn97p0tp8	2026-05-09 11:30:24.76	1000.00	\N	\N	\N	165.00	1	165.00	0.00	0.00	CLOSED	2026-05-09 11:30:24.759	2026-05-17 13:13:33.512	2026-05-09 11:30:24.76	Cashier One	Test data cleanup
cmoya4haw000abw1nswrzc2vi	cmoy6am3c004lb32s4pun615w	cmoy6amfy004xb32s9wjzg2mo	cmonyv34b000412mdn97p0tp8	2026-05-09 11:47:21.368	1000.00	\N	\N	\N	105.00	1	105.00	0.00	0.00	CLOSED	2026-05-09 11:47:21.367	2026-05-17 13:13:33.512	2026-05-09 11:47:21.368	Cashier Two	Test data cleanup
cmp6ty1qh0003ifu7mx01t6u8	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-15 11:24:22.986	1000.00	\N	\N	\N	0.00	0	0.00	0.00	0.00	CLOSED	2026-05-15 11:24:22.985	2026-05-17 13:13:33.512	2026-05-15 11:24:22.986	Srivani Admin	Test data cleanup
cmpa47s1z0004dvpmqap5wpo4	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-17 18:35:11.688	1000.00	1000.00	1000.00	0.00	0.00	0	0.00	0.00	0.00	CLOSED	2026-05-17 18:35:11.687	2026-05-18 03:21:37.197	2026-05-17 18:35:11.688	Srivani Admin	\N
cmparmidh000ejxd5c4h1yq6t	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-18 05:30:30.149	1000.00	\N	\N	\N	380.00	1	380.00	0.00	0.00	OPEN	2026-05-18 05:30:30.148	\N	2026-05-18 05:30:30.149	Srivani Admin	\N
cmpc8uvk80003sidedrbyqnn0	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-19 06:20:40.137	1000.00	\N	\N	\N	0.00	0	0.00	0.00	0.00	OPEN	2026-05-19 06:20:40.136	\N	2026-05-19 06:20:40.137	Srivani Admin	\N
cmonz5hqd005p12mdjlmh7330	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-02 06:42:31.046	100.00	\N	\N	\N	3675.00	16	2855.00	655.00	165.00	CLOSED	2026-05-02 06:42:31.044	2026-05-09 01:53:06.962	2026-05-02 06:42:31.046	\N	Auto-closed stale shift
cmoxoxqvm0001vb50y1jr1gro	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-09 01:54:15.25	1000.00	1165.00	1165.00	0.00	185.00	2	165.00	20.00	0.00	CLOSED	2026-05-09 01:54:15.249	2026-05-09 02:44:01.453	2026-05-09 01:54:15.25	Srivani Admin	\N
cmoxrb97b00041005t6o66jv5	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-09 03:00:44.76	1000.00	\N	\N	\N	48.00	1	48.00	0.00	0.00	CLOSED	2026-05-09 03:00:44.759	2026-05-09 03:50:38.252	2026-05-09 03:00:44.76	Srivani Admin	Cleared for fresh start
cmoxt60yc000f7py6rroxws6z	cmonyv3c4005g12md0d4nloyd	cmonyq6zo000212md1ehfe0vm	cmonyv34b000412mdn97p0tp8	2026-05-09 03:52:40.021	1000.00	\N	\N	\N	318.00	1	100.00	100.00	118.00	CLOSED	2026-05-09 03:52:40.02	2026-05-09 04:10:10.797	2026-05-09 03:52:40.021	Srivani Admin	\N
cmp5agjcg0003klsfqbfjmdl0	cmonyv3c4005g12md0d4nloyd	cmoy6amcv004vb32s2juovfxj	cmonyv34b000412mdn97p0tp8	2026-05-14 09:31:07.12	1000.00	\N	\N	\N	0.00	0	0.00	0.00	0.00	CLOSED	2026-05-14 09:31:07.119	2026-05-14 09:32:36.468	2026-05-14 09:31:07.12	Cashier One	Force closed by manager: admin
\.


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.product (id, "businessId", "categoryId", "brandId", "taxId", "productCode", name, "shortName", barcode, "hsnCode", "unitOfMeasure", "productType", mrp, "sellingPrice", "costPrice", "gstRatePercent", "reorderLevel", "minimumStockLevel", "reorderQuantity", "maximumStockLevel", "leadTimeDays", "minSellingQty", "moqFromSupplier", "allowDecimalQty", "allowNegativeStock", "isForSale", "isForPurchase", "isRepackingItem", "isRepackedProduct", "repackYieldPct", "isRawMaterial", "isPackagingMaterial", "isPerishable", "expiryTracking", "shelfLifeDays", "nearExpiryAlertDays", "stockValuation", "preferredSupplierId", aisle, "rackNumber", "shelfPosition", "binCode", "availableOnline", "imageUrl", "isActive", "createdAt", "updatedAt", "autoInactiveReason", "disabledAt", "disabledById", "disabledReason", "isManuallyDisabled", "isReturnable", "nonReturnableReason", "returnPeriodDays", "brandName", "cessRate", "defaultPackSize", "purchaseUnit", "stockUnit", "pluAutoBarcode", "departmentId", "totalStock") FROM stdin;
cmp04b462000b13kf6so6e4qc	cmonyq6yl000012mdyhe1kk88	cmp8fc1rh000dxsiax323isx6	\N	cmonyv34s000c12mda3tzdz1w	000008	RUCHI MUSTARD OIL 830ML	RUCHI MUST OIL 830ML	\N	15149120	PCS	STANDARD	230.00	225.00	176.00	5.00	10.000	10.000	8.000	0.000	2	1.000	1.000	f	t	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-10 18:40:05.595	2026-05-17 03:42:46.606	\N	\N	\N	\N	f	t	\N	7	RUCHI	0.00	10	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	6.000
cmp8555px0004p6sn54gnaxij	cmonyq6yl000012mdyhe1kk88	cmp8fc20l005hxsialqgaff83	cmp85362g0001p6snqp0x9atx	cmonyv34z000g12mdr8kuzy4g	000013	Johnsons BABY Powder 100g	Johnsons BABY Powder 100g	8901012100561	33049190	PCS	STANDARD	125.00	122.00	103.04	18.00	10.000	3.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-16 09:25:36.693	2026-05-17 09:07:34.293	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc2020055xsiaj8v48uuy	1.000
cmp85b3r1000mp6sn0llkx04p	cmonyq6yl000012mdyhe1kk88	cmp8fc20l005hxsialqgaff83	cmp85362g0001p6snqp0x9atx	cmonyv34z000g12mdr8kuzy4g	000015	Johnsons BABY OIL 100ml	Johnsons BABY OIL 100ml	8901012116715	33049990	PCS	STANDARD	150.00	148.00	124.58	18.00	10.000	2.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-16 09:30:14.078	2026-05-17 09:07:34.312	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc2020055xsiaj8v48uuy	1.000
cmp85dyke000xp6sn55fpfd9i	cmonyq6yl000012mdyhe1kk88	cmp8fc20l005hxsialqgaff83	cmp85d7rq000up6sntxsyuobz	cmonyv34n000a12mdbbwrb2yf	000016	Stayfree Secure Night	Stayfree Secure Night	8901012165768	96190010	PCS	STANDARD	50.00	49.99	37.12	0.00	10.000	2.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-16 09:32:27.326	2026-05-17 09:07:34.323	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc2020055xsiaj8v48uuy	5.000
cmonyv3ax004w12mdphs0j89j	cmonyq6yl000012mdyhe1kk88	cmp8fc1rh000dxsiax323isx6	\N	cmonyv34s000c12mda3tzdz1w	000001	Sunflower Oil 1L	\N	8901234567890	1512	PCS	STANDARD	120.00	115.00	94.76	5.00	10.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-02 06:34:25.786	2026-05-18 08:31:51.757	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	0.000
cmonz56my005j12mdghmgrxwq	cmonyq6yl000012mdyhe1kk88	cmp8fc1rh000dxsiax323isx6	\N	cmonyv34s000c12mda3tzdz1w	000006	Gold Drop 1ltr	GDrop sf Oil 1 ltr	44555	5525	PCS	STANDARD	200.00	175.00	170.00	5.00	50.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-02 06:42:16.667	2026-05-16 18:18:25.921	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	0.000
cmp5azwa80008klsfrwob8ddx	cmonyq6yl000012mdyhe1kk88	cmp8fc1rh000dxsiax323isx6	cmp5axrk80005klsft6bxs1fp	cmonyv34s000c12mda3tzdz1w	000012	Ruchi Mustard OIL 450ML	Ruchi Mustard OIL 450ML	000012001	15149120	PCS	STANDARD	115.00	112.00	85.71	5.00	10.000	6.000	10.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-14 09:46:10.353	2026-05-16 18:18:25.939	\N	\N	\N	\N	f	t	\N	7	\N	0.00	23	PCS	PCS	t	cmp8fc1qo0001xsiajwfjq2rv	0.000
cmonyv3bx005c12md2wn5c4cw	cmonyq6yl000012mdyhe1kk88	cmp8fc20t005lxsia5mccffzx	\N	cmonyv34z000g12mdr8kuzy4g	000005	Colgate MaxFresh 150g	\N	8901314006047	3306	PCS	STANDARD	115.00	105.00	90.00	18.00	10.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-02 06:34:25.822	2026-05-16 18:18:25.944	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc2020055xsiaj8v48uuy	0.000
cmonyv3bp005812md4140psg2	cmonyq6yl000012mdyhe1kk88	cmp8fc1su0015xsiaioxeo77c	\N	cmonyv34w000e12mdhkn3t9su	000004	Lays Classic Salted 26g	\N	8901491000002	1905	PCS	STANDARD	25.00	20.00	22.73	12.00	25.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-02 06:34:25.813	2026-05-16 18:18:25.952	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	0.000
cmonyv3bg005412mdnlh0paqm	cmonyq6yl000012mdyhe1kk88	cmp8fc1s9000txsiak1exx81x	\N	cmonyv34n000a12mdbbwrb2yf	000003	Amul Full Cream Milk 500ml	\N	8901853001001	0401	PCS	STANDARD	28.00	28.00	24.00	0.00	30.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-02 06:34:25.805	2026-05-16 18:18:25.962	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	0.000
cmonyv3b8005012mdywbgr2uv	cmonyq6yl000012mdyhe1kk88	cmp8fc1vi002hxsiaa60p7q93	\N	cmonyv34n000a12mdbbwrb2yf	000002	Tata Salt 1kg	\N	8902010101010	2501	PCS	STANDARD	24.00	22.00	18.00	0.00	20.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-02 06:34:25.796	2026-05-16 18:18:25.968	OUT_OF_STOCK	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	0.000
cmpcgq23i000kf0y7b3wvcnm4	cmonyq6yl000012mdyhe1kk88	cmp8fc1zz0053xsiauh8kdcjg	cmpcgiev30008f0y7j24f6bvd	cmonyv34s000c12mda3tzdz1w	000022	Mangaldeep Sadhvi Agarbathi 35/-	Mangaldeep Sadhvi Agarbathi 35/-	8901725710064	33074100	PCS	STANDARD	35.00	35.00	25.27	5.00	10.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-19 10:00:52.254	2026-05-19 10:04:34.523	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc1y7003zxsiadq62v3sw	12.000
cmp04esoi000g13kfto0cx14p	cmonyq6yl000012mdyhe1kk88	cmp8fc1rh000dxsiax323isx6	\N	cmonyv34s000c12mda3tzdz1w	000009	RUCHI MUSTARD OIL 450ML	RUCHI MUST OIL 450L	\N	15149120	PCS	STANDARD	115.00	110.00	90.00	5.00	10.000	10.000	10.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-10 18:42:57.33	2026-05-17 03:42:46.612	\N	\N	\N	\N	f	t	\N	7	RUCHI	0.00	22	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	6.000
cmp04i53o000l13kfuhd1wc8x	cmonyq6yl000012mdyhe1kk88	cmp8fc1r20005xsiaw2s54ktn	\N	cmonyv34s000c12mda3tzdz1w	000010	RUCHI SOYA GRANULES 1KG	RUCHI GRAN 1KG	\N	21061000	PCS	STANDARD	190.00	185.00	140.00	5.00	10.000	0.000	0.000	0.000	2	1.000	1.000	f	t	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-10 18:45:33.396	2026-05-17 03:42:46.617	\N	\N	\N	\N	f	t	\N	7	RUCHI	0.00	22	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	3.000
cmp04lu01000q13kfevzrttza	cmonyq6yl000012mdyhe1kk88	cmp8fc1r20005xsiaw2s54ktn	\N	cmonyv34n000a12mdbbwrb2yf	000011	RUCHI SOYA CHUNKS 200G	RUCHI CHUNKS 200G	\N	21061000	PCS	STANDARD	47.00	46.00	38.10	0.00	8.000	12.000	10.000	0.000	2	1.000	1.000	f	t	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-10 18:48:25.633	2026-05-17 03:42:46.622	\N	\N	\N	\N	f	t	\N	7	RUCHI	0.00	60	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	12.000
cmpb2tjr9000432e9d1539q7o	cmonyq6yl000012mdyhe1kk88	cmp8fc1ro000hxsiay2l6exra	cmpb2pnot000132e99mc2l9zb	cmonyv34s000c12mda3tzdz1w	000020	Three Mango Chilli Powder 500g	3 Mango Chilli Powder 500g	8906003650254	090411	PCS	STANDARD	600.00	380.00	342.86	5.00	30.000	30.000	60.000	0.000	2	1.000	1.000	f	t	t	t	f	f	98.00	f	f	f	t	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-18 10:43:54.31	2026-05-19 09:21:36.939	\N	\N	\N	\N	f	t	\N	7	\N	0.00	10	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	120.000
cmozxc8fo000413kfhttz5rgf	cmonyq6yl000012mdyhe1kk88	cmp8fc1yk0047xsia0e89eu6n	\N	cmonyv34z000g12mdr8kuzy4g	000007	SABENA DISH WASH POWDER 900G	SABEENA POWDER 900G	85102	34094000	PCS	STANDARD	32.00	32.00	29.00	18.00	10.000	30.000	15.000	0.000	2	1.000	1.000	f	t	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-10 15:25:00.468	2026-05-17 03:42:46.599	\N	\N	\N	\N	f	t	\N	7	SABENA	0.00	30	PCS	PCS	f	cmp8fc1y7003zxsiadq62v3sw	60.000
cmp858ezo000dp6sn8o91ac1c	cmonyq6yl000012mdyhe1kk88	cmp8fc20f005dxsiaaho2sjwp	cmp85362g0001p6snqp0x9atx	cmonyv34s000c12mda3tzdz1w	000014	Johnsons BABY Shampoo 100ml	Johnsons BABY Shampoo 100ml	8901012116920	33051090	PCS	STANDARD	111.00	109.00	91.49	5.00	10.000	3.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-16 09:28:08.676	2026-05-17 09:07:34.302	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc2020055xsiaj8v48uuy	1.000
cmp9w7zed0009ytnopx516vlh	cmonyq6yl000012mdyhe1kk88	cmp8fc1t10019xsiaa0d3wgjv	cmp9vy35x0006ytnovxuyuxaa	cmonyv34s000c12mda3tzdz1w	000017	Sunfeast Mom's Magic 5/- X 12	Sunfeast Mom's Magic 5/- X 12	8909081012082	19053100	PCS	STANDARD	60.00	55.00	50.00	5.00	16.000	16.000	16.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-17 14:51:24.277	2026-05-18 05:30:22.45	\N	\N	\N	\N	f	t	\N	7	\N	0.00	16	PCS	PCS	f	cmp8fc1qo0001xsiajwfjq2rv	15.000
cmp9wb0t3000iytnow683wlpd	cmonyq6yl000012mdyhe1kk88	cmp8fc1t10019xsiaa0d3wgjv	cmp9vy35x0006ytnovxuyuxaa	cmonyv34s000c12mda3tzdz1w	000018	Sunfeast Mom's Magic 10/-	Sunfeast Mom's Magic 10/-	000018001	19053100	PCS	STANDARD	10.00	10.00	8.69	5.00	10.000	12.000	12.000	0.000	2	1.000	1.000	f	t	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-17 14:53:46.071	2026-05-18 05:30:22.46	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	t	cmp8fc1qo0001xsiajwfjq2rv	12.000
cmp9wnxor000rytnoquct5x5b	cmonyq6yl000012mdyhe1kk88	cmp8fc1t9001dxsia9zha5s80	cmp9vy35x0006ytnovxuyuxaa	cmonyv34s000c12mda3tzdz1w	000019	Yippee Noodles 90/-	Yippee Noodles 90/-	000019001	19023010	PCS	STANDARD	90.00	88.00	78.74	5.00	10.000	6.000	0.000	0.000	2	1.000	1.000	f	t	t	t	f	f	98.00	f	f	f	t	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-17 15:03:48.555	2026-05-18 05:30:22.47	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	t	cmp8fc1qo0001xsiajwfjq2rv	24.000
cmpcgn219000bf0y7vxb5ln4a	cmonyq6yl000012mdyhe1kk88	cmp8fc1zz0053xsiauh8kdcjg	cmpcgiev30008f0y7j24f6bvd	cmonyv34s000c12mda3tzdz1w	000021	Mangaldeep 3 In 1 Agarbathi 55/-	Mangaldeep 3 In 1 Agarbathi  55/-	8901725004965	33074100	PCS	PACKAGING	55.00	50.00	39.67	5.00	10.000	0.000	0.000	0.000	2	1.000	1.000	f	f	t	t	f	f	98.00	f	f	f	f	\N	\N	FIFO	\N	\N	\N	\N	\N	f	\N	t	2026-05-19 09:58:32.205	2026-05-19 10:04:34.516	\N	\N	\N	\N	f	t	\N	7	\N	0.00	1	PCS	PCS	f	cmp8fc1y7003zxsiadq62v3sw	6.000
\.


--
-- Data for Name: product_barcode; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.product_barcode (id, "productId", "businessId", "barcodeType", "barcodeValue", "isPrimary", "isActive", "createdAt", "pluId") FROM stdin;
cmonz56n3005l12mdchseg3tm	cmonz56my005j12mdghmgrxwq	cmonyq6yl000012mdyhe1kk88	EAN13	44555	t	t	2026-05-02 06:42:16.672	cmp982ksy000cvrkn6nxv08bx
cmozxc8fu000613kfxl3o72p2	cmozxc8fo000413kfhttz5rgf	cmonyq6yl000012mdyhe1kk88	EAN13	85102	t	t	2026-05-10 15:25:00.475	cmp982kt2000evrknzz6mxm2e
cmp5azwar000eklsflgakdq25	cmp5azwa80008klsfrwob8ddx	cmonyq6yl000012mdyhe1kk88	CODE128	000012001	t	t	2026-05-14 09:46:10.371	cmp5azwam000cklsfx34pwd9y
cmp8555q50006p6sn4mfkf1ze	cmp8555px0004p6sn54gnaxij	cmonyq6yl000012mdyhe1kk88	EAN13	8901012100561	t	t	2026-05-16 09:25:36.701	cmp8555q8000ap6sn2xdep2gw
cmp858ezt000fp6sn36n0nhg0	cmp858ezo000dp6sn8o91ac1c	cmonyq6yl000012mdyhe1kk88	EAN13	8901012116920	t	t	2026-05-16 09:28:08.681	cmp858ezv000jp6snu3h25m1k
cmp85b3r5000op6snvwoy8k7c	cmp85b3r1000mp6sn0llkx04p	cmonyq6yl000012mdyhe1kk88	EAN13	8901012116715	t	t	2026-05-16 09:30:14.081	cmp85b3r7000sp6sn3jvwazx2
cmp85dykk000zp6sn32azfjoe	cmp85dyke000xp6sn55fpfd9i	cmonyq6yl000012mdyhe1kk88	EAN13	8901012165768	t	t	2026-05-16 09:32:27.333	cmp85dyko0013p6snnsll3cj6
cmp9w7zel000bytnox77a5irf	cmp9w7zed0009ytnopx516vlh	cmonyq6yl000012mdyhe1kk88	EAN13	8909081012082	t	t	2026-05-17 14:51:24.286	\N
cmp9wb0tg000oytno3odigvwc	cmp9wb0t3000iytnow683wlpd	cmonyq6yl000012mdyhe1kk88	CODE128	000018001	t	t	2026-05-17 14:53:46.084	\N
cmp9wnxp6000xytno84wzlbbj	cmp9wnxor000rytnoquct5x5b	cmonyq6yl000012mdyhe1kk88	CODE128	000019001	t	t	2026-05-17 15:03:48.57	\N
cmpb2tjrf000632e97gdfeb7b	cmpb2tjr9000432e9d1539q7o	cmonyq6yl000012mdyhe1kk88	EAN13	8906003650254	t	t	2026-05-18 10:43:54.315	\N
cmpcgn21h000df0y7zuhirsah	cmpcgn219000bf0y7vxb5ln4a	cmonyq6yl000012mdyhe1kk88	EAN13	8901725004965	t	t	2026-05-19 09:58:32.214	\N
cmpcgq23p000mf0y73eg3ru19	cmpcgq23i000kf0y7b3wvcnm4	cmonyq6yl000012mdyhe1kk88	EAN13	8901725710064	t	t	2026-05-19 10:00:52.261	\N
\.


--
-- Data for Name: product_batch; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.product_batch (id, "productId", "branchId", "purchaseId", "purchaseItemId", "batchNumber", "manufactureDate", "expiryDate", "purchaseDate", "quantityIn", "quantityOut", "remainingQty", "costPrice", "rackLocation", status, "createdAt") FROM stdin;
\.


--
-- Data for Name: product_plu; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.product_plu (id, "businessId", "productId", "pluCode", "displayName", "costPrice", mrp, "sellingPrice", "grnId", "batchNumber", "manufacturingDate", "expiryDate", "receivedDate", "receivedQty", "soldQty", "stockOnHand", "isDefault", "isActive", "isArchived", "archivedAt", "archivedReason", "createdById", "createdByName", "createdAt", "updatedAt", "basicCost", "cessRate", "eanCode", "effectiveFrom", "gstRate", "hsnCode", "marginPercent", "marginRs", "minSellingPrice", "supplierId", "taxInclusive", "wholesalePrice") FROM stdin;
cmp982ksn0002vrknevark7n9	cmonyq6yl000012mdyhe1kk88	cmonyv3ax004w12mdphs0j89j	000001001	\N	94.76	120.00	115.00	\N	\N	\N	\N	2026-05-17 03:35:21.287	0.000	0.000	0.000	t	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.287	2026-05-17 03:35:21.287	94.76	0.00	\N	2026-05-17 03:35:21.286	5.00	1512	21.0333	25.24	0.00	\N	f	\N
cmp982ksq0004vrkn3czy8frz	cmonyq6yl000012mdyhe1kk88	cmonyv3b8005012mdywbgr2uv	000002001	\N	18.00	24.00	22.00	\N	\N	\N	\N	2026-05-17 03:35:21.291	0.000	0.000	0.000	t	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.291	2026-05-17 03:35:21.291	18.00	0.00	\N	2026-05-17 03:35:21.29	0.00	2501	25.0000	6.00	0.00	\N	f	\N
cmp982kss0006vrknnl7iv0c2	cmonyq6yl000012mdyhe1kk88	cmonyv3bg005412mdnlh0paqm	000003001	\N	24.00	28.00	28.00	\N	\N	\N	\N	2026-05-17 03:35:21.293	0.000	0.000	0.000	t	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.293	2026-05-17 03:35:21.293	24.00	0.00	\N	2026-05-17 03:35:21.292	0.00	0401	14.2857	4.00	0.00	\N	f	\N
cmp982ksu0008vrkn6m9i35ng	cmonyq6yl000012mdyhe1kk88	cmonyv3bp005812md4140psg2	000004001	\N	22.73	25.00	20.00	\N	\N	\N	\N	2026-05-17 03:35:21.295	0.000	0.000	0.000	t	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.295	2026-05-17 03:35:21.295	22.73	0.00	\N	2026-05-17 03:35:21.294	12.00	1905	9.0800	2.27	0.00	\N	f	\N
cmp982ksw000avrknuiz1pqjo	cmonyq6yl000012mdyhe1kk88	cmonyv3bx005c12md2wn5c4cw	000005001	\N	90.00	115.00	105.00	\N	\N	\N	\N	2026-05-17 03:35:21.297	0.000	0.000	0.000	t	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.297	2026-05-17 03:35:21.297	90.00	0.00	\N	2026-05-17 03:35:21.295	18.00	3306	21.7391	25.00	0.00	\N	f	\N
cmp982ksy000cvrkn6nxv08bx	cmonyq6yl000012mdyhe1kk88	cmonz56my005j12mdghmgrxwq	000006001	\N	170.00	200.00	175.00	\N	\N	\N	\N	2026-05-17 03:35:21.299	0.000	0.000	0.000	t	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.299	2026-05-17 03:35:21.299	170.00	0.00	\N	2026-05-17 03:35:21.298	5.00	5525	15.0000	30.00	0.00	\N	f	\N
cmp5azwam000cklsfx34pwd9y	cmonyq6yl000012mdyhe1kk88	cmp5azwa80008klsfrwob8ddx	000012001	\N	85.71	115.00	112.00	\N	\N	\N	\N	2026-05-14 09:46:10.366	0.000	0.000	0.000	t	t	f	\N	\N	\N	System (auto-created)	2026-05-14 09:46:10.366	2026-05-17 03:35:21.311	85.71	0.00	\N	2026-05-14 09:46:10.366	5.00	15149120	25.4696	29.29	0.00	\N	f	\N
cmp858ezv000jp6snu3h25m1k	cmonyq6yl000012mdyhe1kk88	cmp858ezo000dp6sn8o91ac1c	000014001	\N	91.13	111.00	109.00	\N	\N	\N	\N	2026-05-16 09:28:08.684	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-16 09:28:08.684	2026-05-17 09:07:34.298	91.13	0.00	\N	2026-05-16 09:28:08.684	5.00	33051090	17.5766	19.51	0.00	\N	f	\N
cmp98c4ec000c8rvxp5cknq53	cmonyq6yl000012mdyhe1kk88	cmozxc8fo000413kfhttz5rgf	000007002	\N	24.58	32.00	32.00	cmp6r6rh3000lu24e149ck0va	\N	\N	\N	2026-05-17 03:42:46.597	60.000	0.000	60.000	t	t	f	\N	\N	\N	Admin	2026-05-17 03:42:46.597	2026-05-17 03:42:46.597	24.58	0.00	\N	2026-05-17 03:42:46.596	18.00	34094000	23.1875	7.42	0.00	\N	f	\N
cmp982kt4000gvrknq8ehak5o	cmonyq6yl000012mdyhe1kk88	cmp04b462000b13kf6so6e4qc	000008001	\N	176.00	230.00	225.00	\N	\N	\N	\N	2026-05-17 03:35:21.304	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.304	2026-05-17 03:42:46.603	176.00	0.00	\N	2026-05-17 03:35:21.303	5.00	15149120	23.4783	54.00	0.00	\N	f	\N
cmp98c4ek000e8rvxgirt7yse	cmonyq6yl000012mdyhe1kk88	cmp04b462000b13kf6so6e4qc	000008002	\N	167.62	230.00	225.00	cmp6r6rh3000lu24e149ck0va	\N	\N	\N	2026-05-17 03:42:46.604	6.000	0.000	6.000	t	t	f	\N	\N	\N	Admin	2026-05-17 03:42:46.604	2026-05-17 03:42:46.604	167.62	0.00	\N	2026-05-17 03:42:46.603	5.00	15149120	27.1217	62.38	0.00	\N	f	\N
cmp982kt6000ivrkn0q165xg2	cmonyq6yl000012mdyhe1kk88	cmp04esoi000g13kfto0cx14p	000009001	\N	90.00	115.00	110.00	\N	\N	\N	\N	2026-05-17 03:35:21.306	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.306	2026-05-17 03:42:46.609	90.00	0.00	\N	2026-05-17 03:35:21.305	5.00	15149120	21.7391	25.00	0.00	\N	f	\N
cmp98c4ep000g8rvx0ngb4g0o	cmonyq6yl000012mdyhe1kk88	cmp04esoi000g13kfto0cx14p	000009002	\N	85.71	115.00	110.00	cmp6r6rh3000lu24e149ck0va	\N	\N	\N	2026-05-17 03:42:46.61	6.000	0.000	6.000	t	t	f	\N	\N	\N	Admin	2026-05-17 03:42:46.61	2026-05-17 03:42:46.61	85.71	0.00	\N	2026-05-17 03:42:46.609	5.00	15149120	25.4696	29.29	0.00	\N	f	\N
cmp982kt7000kvrknel77857z	cmonyq6yl000012mdyhe1kk88	cmp04i53o000l13kfuhd1wc8x	000010001	\N	140.00	190.00	185.00	\N	\N	\N	\N	2026-05-17 03:35:21.308	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.308	2026-05-17 03:42:46.615	140.00	0.00	\N	2026-05-17 03:35:21.307	5.00	21061000	26.3158	50.00	0.00	\N	f	\N
cmp98c4ev000i8rvxb6dicg0m	cmonyq6yl000012mdyhe1kk88	cmp04i53o000l13kfuhd1wc8x	000010002	\N	133.33	190.00	185.00	cmp6r6rh3000lu24e149ck0va	\N	\N	\N	2026-05-17 03:42:46.616	3.000	0.000	3.000	t	t	f	\N	\N	\N	Admin	2026-05-17 03:42:46.616	2026-05-17 03:42:46.616	133.33	0.00	\N	2026-05-17 03:42:46.615	5.00	21061000	29.8263	56.67	0.00	\N	f	\N
cmp982kt9000mvrknugl4tbgp	cmonyq6yl000012mdyhe1kk88	cmp04lu01000q13kfevzrttza	000011001	\N	38.10	47.00	46.00	\N	\N	\N	\N	2026-05-17 03:35:21.31	12.000	0.000	12.000	t	t	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.31	2026-05-17 03:42:46.62	38.10	0.00	\N	2026-05-17 03:35:21.309	0.00	21061000	18.9362	8.90	0.00	\N	f	\N
cmp9jxt7e000cmm1jck6yljsz	cmonyq6yl000012mdyhe1kk88	cmp858ezo000dp6sn8o91ac1c	000014002	\N	87.13	111.00	109.00	cmp89xo8j0022p6sn563vwms0	\N	\N	\N	2026-05-17 09:07:34.299	1.000	0.000	1.000	t	t	f	\N	\N	\N	System	2026-05-17 09:07:34.299	2026-05-17 09:07:34.299	91.13	0.00	\N	2026-05-17 09:07:34.298	5.00	33051090	21.5045	23.87	0.00	\N	f	\N
cmp982kt2000evrknzz6mxm2e	cmonyq6yl000012mdyhe1kk88	cmozxc8fo000413kfhttz5rgf	000007001	\N	29.00	32.00	32.00	\N	\N	\N	\N	2026-05-17 03:35:21.302	0.000	0.000	0.000	f	f	f	\N	\N	\N	System (repair)	2026-05-17 03:35:21.302	2026-05-17 03:42:46.595	29.00	0.00	\N	2026-05-17 03:35:21.301	18.00	34094000	9.3750	3.00	0.00	\N	f	\N
cmp8555q8000ap6sn2xdep2gw	cmonyq6yl000012mdyhe1kk88	cmp8555px0004p6sn54gnaxij	000013001	\N	91.32	125.00	122.00	\N	\N	\N	\N	2026-05-16 09:25:36.705	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-16 09:25:36.705	2026-05-17 09:07:34.287	91.32	0.00	\N	2026-05-16 09:25:36.705	18.00	33049190	17.5680	21.96	0.00	\N	f	\N
cmp9jxt75000amm1jb8byln5h	cmonyq6yl000012mdyhe1kk88	cmp8555px0004p6sn54gnaxij	000013002	\N	87.32	125.00	122.00	cmp89xo8j0022p6sn563vwms0	\N	\N	\N	2026-05-17 09:07:34.289	1.000	0.000	1.000	t	t	f	\N	\N	\N	System	2026-05-17 09:07:34.289	2026-05-17 09:07:34.289	91.32	0.00	\N	2026-05-17 09:07:34.288	18.00	33049190	30.1440	37.68	0.00	\N	f	\N
cmp85b3r7000sp6sn3jvwazx2	cmonyq6yl000012mdyhe1kk88	cmp85b3r1000mp6sn0llkx04p	000015001	\N	109.58	150.00	148.00	\N	\N	\N	\N	2026-05-16 09:30:14.083	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-16 09:30:14.083	2026-05-17 09:07:34.307	109.58	0.00	\N	2026-05-16 09:30:14.083	18.00	33049990	16.9467	25.42	0.00	\N	f	\N
cmp9jxt7o000emm1j38j85v4a	cmonyq6yl000012mdyhe1kk88	cmp85b3r1000mp6sn0llkx04p	000015002	\N	105.58	150.00	148.00	cmp89xo8j0022p6sn563vwms0	\N	\N	\N	2026-05-17 09:07:34.309	1.000	0.000	1.000	t	t	f	\N	\N	\N	System	2026-05-17 09:07:34.309	2026-05-17 09:07:34.309	109.58	0.00	\N	2026-05-17 09:07:34.308	18.00	33049990	29.6133	44.42	0.00	\N	f	\N
cmp85dyko0013p6snnsll3cj6	cmonyq6yl000012mdyhe1kk88	cmp85dyke000xp6sn55fpfd9i	000016001	\N	44.64	50.00	49.99	\N	\N	\N	\N	2026-05-16 09:32:27.336	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-16 09:32:27.336	2026-05-17 09:07:34.319	44.64	0.00	\N	2026-05-16 09:32:27.336	0.00	96190010	25.7600	12.88	0.00	\N	f	\N
cmp9jxt80000gmm1jknio73xe	cmonyq6yl000012mdyhe1kk88	cmp85dyke000xp6sn55fpfd9i	000016002	\N	44.54	50.00	49.99	cmp89xo8j0022p6sn563vwms0	\N	\N	\N	2026-05-17 09:07:34.32	5.000	0.000	5.000	t	t	f	\N	\N	\N	System	2026-05-17 09:07:34.32	2026-05-17 09:07:34.32	44.64	0.00	\N	2026-05-17 09:07:34.319	0.00	96190010	10.9200	5.46	0.00	\N	f	\N
cmp9w7zep000fytnoavbsjimh	cmonyq6yl000012mdyhe1kk88	cmp9w7zed0009ytnopx516vlh	000017001	\N	50.00	60.00	55.00	\N	\N	\N	\N	2026-05-17 14:51:24.29	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-17 14:51:24.29	2026-05-18 05:30:22.444	\N	0.00	\N	2026-05-17 14:51:24.29	\N	\N	\N	\N	0.00	\N	f	\N
cmparmcfi0008jxd5mqtdq9u7	cmonyq6yl000012mdyhe1kk88	cmp9w7zed0009ytnopx516vlh	000017002	\N	51.35	60.00	55.00	cmp9wz6aj000zytnozeq5pesd	\N	\N	\N	2026-05-18 05:30:22.446	15.000	0.000	15.000	t	t	f	\N	\N	\N	System	2026-05-18 05:30:22.446	2026-05-18 05:30:22.446	52.13	0.00	\N	2026-05-18 05:30:22.445	5.00	19053100	14.4167	8.65	0.00	\N	f	\N
cmp9wb0tb000mytnodtjh4clg	cmonyq6yl000012mdyhe1kk88	cmp9wb0t3000iytnow683wlpd	000018001	\N	8.69	10.00	10.00	\N	\N	\N	\N	2026-05-17 14:53:46.08	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-17 14:53:46.08	2026-05-18 05:30:22.456	\N	0.00	8909081012082	2026-05-17 14:53:46.08	\N	\N	\N	\N	0.00	\N	f	\N
cmparmcft000ajxd5dezmqfie	cmonyq6yl000012mdyhe1kk88	cmp9wb0t3000iytnow683wlpd	000018002	\N	8.56	10.00	10.00	cmp9wz6aj000zytnozeq5pesd	\N	\N	\N	2026-05-18 05:30:22.458	12.000	0.000	12.000	t	t	f	\N	\N	\N	System	2026-05-18 05:30:22.458	2026-05-18 05:30:22.458	8.69	0.00	\N	2026-05-18 05:30:22.457	5.00	19053100	14.4000	1.44	0.00	\N	f	\N
cmp9wnxp0000vytno5085nhju	cmonyq6yl000012mdyhe1kk88	cmp9wnxor000rytnoquct5x5b	000019001	\N	78.74	90.00	88.00	\N	\N	\N	\N	2026-05-17 15:03:48.564	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-17 15:03:48.564	2026-05-18 05:30:22.465	\N	0.00	\N	2026-05-17 15:03:48.564	\N	\N	\N	\N	0.00	\N	f	\N
cmparmcg3000cjxd5vrxr9btt	cmonyq6yl000012mdyhe1kk88	cmp9wnxor000rytnoquct5x5b	000019002	\N	76.38	90.00	88.00	cmp9wz6aj000zytnozeq5pesd	\N	\N	\N	2026-05-18 05:30:22.468	24.000	0.000	24.000	t	t	f	\N	\N	\N	System	2026-05-18 05:30:22.468	2026-05-18 05:30:22.468	78.74	0.00	\N	2026-05-18 05:30:22.466	5.00	19023010	15.1333	13.62	0.00	\N	f	\N
cmpb2tjri000a32e9n6ckrg0y	cmonyq6yl000012mdyhe1kk88	cmpb2tjr9000432e9d1539q7o	000020001	\N	342.86	600.00	380.00	\N	\N	\N	\N	2026-05-18 10:43:54.319	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-18 10:43:54.319	2026-05-19 09:21:36.922	\N	0.00	\N	2026-05-18 10:43:54.319	\N	\N	\N	\N	0.00	\N	f	\N
cmpcfbkpo0004f0y7v61sn41c	cmonyq6yl000012mdyhe1kk88	cmpb2tjr9000432e9d1539q7o	000020002	\N	339.43	600.00	380.00	cmpb30syi000e32e9fp1ba5o1	\N	\N	\N	2026-05-19 09:21:36.924	120.000	0.000	120.000	t	t	f	\N	\N	\N	System	2026-05-19 09:21:36.924	2026-05-19 09:21:36.924	342.86	0.00	\N	2026-05-19 09:21:36.923	5.00	090411	43.4283	260.57	0.00	\N	f	\N
cmpcgn21m000hf0y779k5s6l6	cmonyq6yl000012mdyhe1kk88	cmpcgn219000bf0y7vxb5ln4a	000021001	\N	39.67	55.00	50.00	\N	\N	\N	\N	2026-05-19 09:58:32.218	0.000	0.000	0.000	f	t	f	\N	\N	\N	System (auto-created)	2026-05-19 09:58:32.218	2026-05-19 10:04:34.51	\N	0.00	\N	2026-05-19 09:58:32.218	\N	\N	\N	\N	0.00	\N	f	\N
cmpcgutlc0014f0y71uokct7s	cmonyq6yl000012mdyhe1kk88	cmpcgn219000bf0y7vxb5ln4a	000021002	\N	36.46	55.00	50.00	cmpcgu0jb000sf0y79tml6m1b	\N	\N	\N	2026-05-19 10:04:34.512	6.000	0.000	6.000	t	t	f	\N	\N	\N	System	2026-05-19 10:04:34.512	2026-05-19 10:04:34.512	39.67	0.00	\N	2026-05-19 10:04:34.511	5.00	33074100	33.7091	18.54	0.00	\N	f	\N
cmpcgq23s000qf0y7xkl8whga	cmonyq6yl000012mdyhe1kk88	cmpcgq23i000kf0y7b3wvcnm4	000022001	\N	25.27	35.00	35.00	\N	\N	\N	\N	2026-05-19 10:00:52.264	12.000	0.000	12.000	t	t	f	\N	\N	\N	System (auto-created)	2026-05-19 10:00:52.264	2026-05-19 10:04:34.52	\N	0.00	\N	2026-05-19 10:00:52.264	\N	\N	\N	\N	0.00	\N	f	\N
\.


--
-- Data for Name: product_price; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.product_price (id, "productId", "businessId", "priceListType", "costPrice", "sellingPrice", mrp, "minSellingPrice", "maxDiscountPct", "effectiveFrom", "effectiveTo", "createdAt") FROM stdin;
cmonz56n5005n12mdmavgm64i	cmonz56my005j12mdghmgrxwq	cmonyq6yl000012mdyhe1kk88	RETAIL	170.00	175.00	200.00	0.00	5.00	2026-05-02 06:42:16.673	\N	2026-05-02 06:42:16.673
cmozxc8fx000813kf67uscfiz	cmozxc8fo000413kfhttz5rgf	cmonyq6yl000012mdyhe1kk88	RETAIL	24.58	32.00	32.00	0.00	5.00	2026-05-10 15:25:00.477	\N	2026-05-10 15:25:00.477
cmp04b468000d13kfl0mr7k23	cmp04b462000b13kf6so6e4qc	cmonyq6yl000012mdyhe1kk88	RETAIL	167.62	225.00	230.00	0.00	5.00	2026-05-10 18:40:05.6	\N	2026-05-10 18:40:05.6
cmp04esoo000i13kfio8n0w37	cmp04esoi000g13kfto0cx14p	cmonyq6yl000012mdyhe1kk88	RETAIL	85.71	110.00	115.00	0.00	5.00	2026-05-10 18:42:57.336	\N	2026-05-10 18:42:57.336
cmp04i53r000n13kfucogy41n	cmp04i53o000l13kfuhd1wc8x	cmonyq6yl000012mdyhe1kk88	RETAIL	133.33	185.00	190.00	0.00	5.00	2026-05-10 18:45:33.4	\N	2026-05-10 18:45:33.4
cmp04lu06000s13kflpn2l7dh	cmp04lu01000q13kfevzrttza	cmonyq6yl000012mdyhe1kk88	RETAIL	38.10	46.00	47.00	0.00	5.00	2026-05-10 18:48:25.639	\N	2026-05-10 18:48:25.639
cmp5azwaj000aklsfuxtzl7ue	cmp5azwa80008klsfrwob8ddx	cmonyq6yl000012mdyhe1kk88	RETAIL	85.71	112.00	115.00	0.00	5.00	2026-05-14 09:46:10.364	\N	2026-05-14 09:46:10.364
cmp8555q60008p6snhcec8f91	cmp8555px0004p6sn54gnaxij	cmonyq6yl000012mdyhe1kk88	RETAIL	91.32	122.00	125.00	0.00	5.00	2026-05-16 09:25:36.703	\N	2026-05-16 09:25:36.703
cmp858ezu000hp6sn9c9ob0ye	cmp858ezo000dp6sn8o91ac1c	cmonyq6yl000012mdyhe1kk88	RETAIL	91.13	109.00	111.00	0.00	5.00	2026-05-16 09:28:08.682	\N	2026-05-16 09:28:08.682
cmp85b3r6000qp6sn5bcb3zv5	cmp85b3r1000mp6sn0llkx04p	cmonyq6yl000012mdyhe1kk88	RETAIL	109.58	148.00	150.00	0.00	5.00	2026-05-16 09:30:14.082	\N	2026-05-16 09:30:14.082
cmp85dykm0011p6snrw35y94c	cmp85dyke000xp6sn55fpfd9i	cmonyq6yl000012mdyhe1kk88	RETAIL	44.64	49.99	50.00	0.00	5.00	2026-05-16 09:32:27.335	\N	2026-05-16 09:32:27.335
cmp9w7zen000dytnoxo3l8rig	cmp9w7zed0009ytnopx516vlh	cmonyq6yl000012mdyhe1kk88	RETAIL	50.00	55.00	60.00	0.00	5.00	2026-05-17 14:51:24.288	\N	2026-05-17 14:51:24.288
cmp9wb0ta000kytnoig7rzogd	cmp9wb0t3000iytnow683wlpd	cmonyq6yl000012mdyhe1kk88	RETAIL	8.69	10.00	10.00	0.00	5.00	2026-05-17 14:53:46.078	\N	2026-05-17 14:53:46.078
cmp9wnxoy000tytnogw39sdv9	cmp9wnxor000rytnoquct5x5b	cmonyq6yl000012mdyhe1kk88	RETAIL	78.74	88.00	90.00	0.00	5.00	2026-05-17 15:03:48.563	\N	2026-05-17 15:03:48.563
cmpb2tjrh000832e93cruyap3	cmpb2tjr9000432e9d1539q7o	cmonyq6yl000012mdyhe1kk88	RETAIL	342.86	380.00	600.00	0.00	5.00	2026-05-18 10:43:54.317	\N	2026-05-18 10:43:54.317
cmpcgn21k000ff0y70yz4pf24	cmpcgn219000bf0y7vxb5ln4a	cmonyq6yl000012mdyhe1kk88	RETAIL	39.67	50.00	55.00	0.00	5.00	2026-05-19 09:58:32.216	\N	2026-05-19 09:58:32.216
cmpcgq23q000of0y7ubs7ljpv	cmpcgq23i000kf0y7b3wvcnm4	cmonyq6yl000012mdyhe1kk88	RETAIL	25.27	35.00	35.00	0.00	5.00	2026-05-19 10:00:52.263	\N	2026-05-19 10:00:52.263
\.


--
-- Data for Name: purchase; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.purchase (id, "businessId", "branchId", "supplierId", "supplierName", "supplierGstin", "grnNumber", "invoiceNumber", "invoiceDate", "taxableAmount", "totalTaxAmount", "cgstTotal", "sgstTotal", "igstTotal", "grandTotal", "paidAmount", status, "approvedById", "approvedAt", notes, "invoiceImageUrl", "createdAt", "updatedAt", "advanceAdjusted", "amendedAt", "amendedById", "amendedByName", "amendmentDeadline", "amendmentVersion", "amountPayable", "approvedByName", "balanceAmount", "billDiscountAmount", "billDiscountPercent", "cashDiscountAmount", "cashDiscountPercent", "cessTotal", "documentType", "freightCharges", "hamaliCharges", "invoiceControlTotal", "isAmendment", "isInterState", "itcEligibility", "originalGrnId", "otherCharges", "paymentDueDate", "paymentMode", "paymentNotes", "paymentReference", "paymentScreenshotUrl", "placeOfSupply", "poNumber", "rcmApplicable", "rejectedByName", "roundingAmount", "taxType", receiveddate) FROM stdin;
cmozg63ff0001gd87xr9gotys	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3al004s12mdnzbg46c8	Hindustan Unilever Dist	36AAACH8564E1Z5	GRN/2026-27/00001	TEST-INV-001	2026-05-10 00:00:00	5415.00	270.76	135.38	135.38	0.00	5685.76	0.00	APPROVED	\N	2026-05-10 07:24:59.737	Looks good	\N	2026-05-10 07:24:20.571	2026-05-18 18:34:39.667	0.00	\N	\N	\N	\N	1	5685.76	Admin	5685.76	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	\N	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-10 00:00:00
cmp6ji8nv0001bi5bvqecerc1	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmozx2rlr000113kf71fpiesa	SRI SAI VENKATESHWARA AGENCIES	36ALFPM2395C1Z6	GRN/2026-27/00007	12345	2026-05-13 00:00:00	952.05	47.60	23.80	23.80	0.00	999.65	0.00	APPROVED	\N	2026-05-15 06:36:20.544	\N	\N	2026-05-15 06:32:09.307	2026-05-18 18:34:39.68	0.00	\N	\N	\N	\N	1	999.65	\N	999.65	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	1000.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-15 00:00:00
cmp6gipi90001x1ueac4k6b7b	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3al004s12mdnzbg46c8	Hindustan Unilever Dist	36AAACH8564E1Z5	GRN/2026-27/00006	1231	2026-04-28 00:00:00	952.40	47.62	23.81	23.81	0.00	1000.02	0.00	APPROVED	\N	2026-05-15 06:36:23.491	\N	\N	2026-05-15 05:08:32.288	2026-05-18 18:34:39.684	0.00	\N	\N	\N	\N	1	1000.02	\N	1000.02	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	1000.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-15 00:00:00
cmozg891m0009gd8779l2keh9	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3al004s12mdnzbg46c8	Hindustan Unilever Dist	36AAACH8564E1Z5	GRN/2026-27/00002	TEST-INV-002	2026-05-10 00:00:00	432.00	51.84	25.92	25.92	0.00	685.68	0.00	APPROVED	\N	2026-05-15 06:36:25.637	\N	\N	2026-05-10 07:26:01.162	2026-05-18 18:34:39.688	0.00	\N	\N	\N	\N	1	685.68	\N	685.68	0.00	0.00	0.00	0.00	51.84	INVOICE	100.00	50.00	\N	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-10 00:00:00
cmp6r0xct0001u24ekf085418	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmozx2rlr000113kf71fpiesa	SRI SAI VENKATESHWARA AGENCIES	36ALFPM2395C1Z6	GRN/2026-27/00008	VA/26-27/1121	2026-05-14 00:00:00	3851.97	361.46	180.73	180.73	0.00	4213.43	0.00	APPROVED	\N	2026-05-15 10:02:58.061	\N	\N	2026-05-15 10:02:38.429	2026-05-18 18:34:39.693	0.00	\N	\N	\N	\N	1	4213.43	\N	4213.43	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	4235.99	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-15 00:00:00
cmp86iw9b001cp6snk0qo9cr1	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp85hsbq0015p6snd289grri	SRI Laxmi Agencies	36AKSPK3358H1ZQ	GRN/2026-27/00011	JJGST2600515	2026-05-14 00:00:00	502.73	39.08	19.54	19.54	0.00	541.81	0.00	APPROVED	\N	2026-05-16 10:06:40.041	\N	\N	2026-05-16 10:04:17.231	2026-05-18 18:34:39.697	0.00	\N	\N	\N	\N	1	541.81	\N	541.81	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	543.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-16 00:00:00
cmp70wg3o000d1203txshsyg2	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3al004s12mdnzbg46c8	Hindustan Unilever Dist	36AAACH8564E1Z5	GRN/2026-27/00010	1234	2026-05-04 00:00:00	806.52	96.78	48.39	48.39	0.00	1000.08	1000.00	APPROVED	\N	2026-05-15 14:40:34.793	\N	\N	2026-05-15 14:39:05.604	2026-05-18 18:34:39.7	0.00	\N	\N	\N	\N	1	1000.08	\N	1000.08	0.00	0.00	0.00	0.00	96.78	INVOICE	0.00	0.00	1000.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-15 00:00:00
cmp6r6rh3000lu24e149ck0va	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmozx2rlr000113kf71fpiesa	SRI SAI VENKATESHWARA AGENCIES	36ALFPM2395C1Z6	GRN/2026-27/00009	1122	2026-05-14 00:00:00	3851.97	361.46	180.73	180.73	0.00	4213.43	0.00	APPROVED	\N	2026-05-17 03:42:46.58	Part B test approval	\N	2026-05-15 10:07:10.744	2026-05-18 18:34:39.703	0.00	\N	\N	\N	\N	1	4213.43	Admin	4213.43	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	4236.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.00	TAX_EXCLUSIVE	2026-05-15 00:00:00
cmp89xo8j0022p6sn563vwms0	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ah004q12mdo6l1i7b8	Sri Balaji Traders	36AABCS1429B1ZB	GRN/2026-27/00012	va/26-27/2323	2026-05-15 00:00:00	502.73	39.08	19.54	19.54	0.00	542.00	0.00	APPROVED	\N	2026-05-17 09:07:34.271	\N	\N	2026-05-16 11:39:45.523	2026-05-18 18:34:39.707	0.00	\N	\N	\N	\N	1	542.00	\N	542.00	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	543.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	0.19	TAX_EXCLUSIVE	2026-05-16 00:00:00
cmp9wz6aj000zytnozeq5pesd	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp9vfmfc0001ytno3x114u3n	MK Traders	36AAEFM1426E1ZP	GRN/2026-27/00013	M3/26-27/005010	2026-05-15 00:00:00	2706.09	135.32	67.66	67.66	0.00	2841.02	0.00	APPROVED	\N	2026-05-18 05:30:22.429	\N	\N	2026-05-17 15:12:32.924	2026-05-18 18:34:39.71	0.00	\N	\N	\N	\N	1	2841.02	\N	2841.02	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	2841.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	-0.39	TAX_EXCLUSIVE	2026-05-17 15:12:32.922
cmpb30syi000e32e9fp1ba5o1	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmpb2vu7q000c32e99fbsk1rr	Raj Enterprises	36AMVPD9356R1ZV	GRN/2026-27/00014	M-194	2026-05-18 00:00:00	40731.60	2036.58	1018.29	1018.29	0.00	42768.00	0.00	APPROVED	\N	2026-05-19 09:21:36.903	\N	\N	2026-05-18 10:49:32.826	2026-05-19 09:21:36.904	0.00	\N	\N	\N	\N	1	42768.00	\N	42768.00	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	42768.00	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	-0.18	TAX_EXCLUSIVE	2026-05-18 10:49:32.825
cmpcgu0jb000sf0y79tml6m1b	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp9vfmfc0001ytno3x114u3n	MK Traders	36AAEFM1426E1ZP	GRN/2026-27/00015	m3/26-27/004952	2026-05-15 00:00:00	522.00	26.10	13.05	13.05	0.00	548.00	548.00	APPROVED	\N	2026-05-19 10:04:34.5	\N	\N	2026-05-19 10:03:56.855	2026-05-19 10:05:26.801	0.00	\N	\N	\N	\N	1	548.00	\N	548.00	0.00	0.00	0.00	0.00	0.00	INVOICE	0.00	0.00	547.98	f	f	ELIGIBLE	\N	0.00	\N	\N	\N	\N	\N	\N	\N	f	\N	-0.10	TAX_EXCLUSIVE	2026-05-19 10:03:56.854
\.


--
-- Data for Name: purchase_item; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.purchase_item (id, "purchaseId", "productId", "taxId", "productName", "hsnCode", quantity, "freeQuantity", "unitPrice", "schemeDiscountPercent", "retailerDiscountPercent", "taxableAmount", "gstRatePercent", "cgstAmount", "sgstAmount", "igstAmount", "totalAmount", "expiryDate", "batchNumber", "acceptedQty", "basicCostPrice", "casesReceived", "cashDiscAmount", "cashDiscPercent", "cessAmount", "cessRate", "disc1Percent", "disc2Percent", "disc3Percent", "disc4Percent", "freeCases", "freeLoose", "freightShare", "hamaliShare", "lastCostPrice", "lineTotal", "looseQty", "manufacturingDate", mrp, "netCostPrice", "packSize", "pluCode", "priceChangePct", "priceChanged", "rejectedQty", "rejectionAction", "rejectionReason", "sellingPrice", "supplierProductName", "totalFreeQty", "totalQty", "totalReceivedQty", "trueCostPrice", "unitOfMeasure", "wsPrice") FROM stdin;
cmozg63fg0003gd874i0x3rt2	cmozg63ff0001gd87xr9gotys	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	60.000	0.000	90.25	0.00	0.00	5415.00	5.00	135.38	135.38	0.00	5685.76	\N	\N	60.000	95.00	5.000	0.00	0.00	0.00	0.00	5.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	145.00	5685.76	0.000	\N	120.00	90.25	12	\N	-30.30	t	0.000	\N	\N	115.00	\N	0.000	60.000	60.000	94.76	PCS	\N
cmozg891m000bgd87u7cz6ax0	cmozg891m0009gd8779l2keh9	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	24.000	0.000	18.00	0.00	0.00	432.00	12.00	25.92	25.92	0.00	535.68	\N	\N	24.000	18.00	0.000	0.00	0.00	51.84	12.00	0.00	0.00	0.00	0.00	0.000	0.000	100.00	50.00	15.00	535.68	24.000	\N	25.00	18.00	1	\N	\N	f	0.000	\N	\N	\N	\N	0.000	24.000	24.000	28.57	PCS	\N
cmp6gipi90003x1ued3e5uzex	cmp6gipi90001x1ueac4k6b7b	cmp04b462000b13kf6so6e4qc	cmonyv34s000c12mda3tzdz1w	RUCHI MUSTARD OIL 830ML	15149120	10.000	0.000	95.24	0.00	0.00	952.40	5.00	23.81	23.81	0.00	1000.02	\N	\N	10.000	95.24	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	167.62	1000.02	10.000	\N	230.00	95.24	1	\N	\N	f	0.000	\N	\N	225.00	\N	0.000	10.000	10.000	100.00	PCS	\N
cmp6ji8nv0003bi5bpxv9elwf	cmp6ji8nv0001bi5bvqecerc1	cmp04esoi000g13kfto0cx14p	cmonyv34s000c12mda3tzdz1w	RUCHI MUSTARD OIL 450ML	15149120	11.000	0.000	86.55	0.00	0.00	952.05	5.00	23.80	23.80	0.00	999.65	\N	\N	11.000	86.55	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	85.71	999.65	11.000	\N	115.00	86.55	1	\N	\N	f	0.000	\N	\N	110.00	\N	0.000	11.000	11.000	90.88	PCS	\N
cmp6r0xcu0003u24ef9yintez	cmp6r0xct0001u24ekf085418	cmozxc8fo000413kfhttz5rgf	cmonyv34z000g12mdr8kuzy4g	SABENA DISH WASH POWDER 900G	34094000	60.000	0.000	24.58	0.00	0.00	1474.80	18.00	132.73	132.73	0.00	1740.26	\N	\N	60.000	24.58	30.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	24.58	1740.26	0.000	\N	32.00	24.58	2	\N	\N	f	0.000	\N	\N	32.00	\N	0.000	60.000	60.000	29.00	PCS	\N
cmp6r0xcu0004u24e14vkkj14	cmp6r0xct0001u24ekf085418	cmp04b462000b13kf6so6e4qc	cmonyv34s000c12mda3tzdz1w	RUCHI MUSTARD OIL 830ML	15149120	6.000	0.000	167.62	0.00	0.00	1005.72	5.00	25.14	25.14	0.00	1056.00	\N	\N	6.000	167.62	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	100.00	1056.00	6.000	\N	230.00	167.62	1	\N	\N	f	0.000	\N	\N	225.00	\N	0.000	6.000	6.000	176.00	PCS	\N
cmp6r0xcu0005u24em5zsa0rj	cmp6r0xct0001u24ekf085418	cmp04esoi000g13kfto0cx14p	cmonyv34s000c12mda3tzdz1w	RUCHI MUSTARD OIL 450ML	15149120	6.000	0.000	85.71	0.00	0.00	514.26	5.00	12.86	12.86	0.00	539.98	\N	\N	6.000	85.71	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	90.88	539.98	6.000	\N	115.00	85.71	1	\N	\N	f	0.000	\N	\N	110.00	\N	0.000	6.000	6.000	90.00	PCS	\N
cmp6r0xcu0006u24ezlkeptqs	cmp6r0xct0001u24ekf085418	cmp04i53o000l13kfuhd1wc8x	cmonyv34s000c12mda3tzdz1w	RUCHI SOYA GRANULES 1KG	21061000	3.000	0.000	133.33	0.00	0.00	399.99	5.00	10.00	10.00	0.00	419.99	\N	\N	3.000	133.33	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	133.33	419.99	3.000	\N	190.00	133.33	1	\N	\N	f	0.000	\N	\N	185.00	\N	0.000	3.000	3.000	140.00	PCS	\N
cmp6r0xcu0007u24ei50u7rly	cmp6r0xct0001u24ekf085418	cmp04lu01000q13kfevzrttza	cmonyv34n000a12mdbbwrb2yf	RUCHI SOYA CHUNKS 200G	21061000	12.000	0.000	38.10	0.00	0.00	457.20	0.00	0.00	0.00	0.00	457.20	\N	\N	12.000	38.10	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	38.10	457.20	12.000	\N	47.00	38.10	1	\N	\N	f	0.000	\N	\N	46.00	\N	0.000	12.000	12.000	38.10	PCS	\N
cmp70wg3o000f1203epaqfxml	cmp70wg3o000d1203txshsyg2	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	44.000	0.000	18.33	0.00	0.00	806.52	12.00	48.39	48.39	0.00	1000.08	\N	\N	44.000	18.33	0.000	0.00	0.00	96.78	12.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	28.57	1000.08	44.000	\N	25.00	18.33	1	\N	\N	f	0.000	\N	\N	20.00	\N	0.000	44.000	44.000	22.73	PCS	\N
cmp82a2fv0001y7ppui1q29hn	cmp6r6rh3000lu24e149ck0va	cmozxc8fo000413kfhttz5rgf	cmonyv34z000g12mdr8kuzy4g	SABENA DISH WASH POWDER 900G	34094000	60.000	0.000	24.58	0.00	0.00	1474.80	18.00	132.73	132.73	0.00	1740.26	\N	\N	60.000	24.58	30.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	29.00	1740.26	0.000	\N	32.00	24.58	2	\N	\N	f	0.000	\N	\N	32.00	\N	0.000	60.000	60.000	29.00	PCS	\N
cmp82a2fv0002y7pp22rdq4yt	cmp6r6rh3000lu24e149ck0va	cmp04b462000b13kf6so6e4qc	cmonyv34s000c12mda3tzdz1w	RUCHI MUSTARD OIL 830ML	15149120	6.000	0.000	167.62	0.00	0.00	1005.72	5.00	25.14	25.14	0.00	1056.00	\N	\N	6.000	167.62	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	176.00	1056.00	6.000	\N	230.00	167.62	1	\N	\N	f	0.000	\N	\N	225.00	\N	0.000	6.000	6.000	176.00	PCS	\N
cmp82a2fv0003y7ppe1bibszj	cmp6r6rh3000lu24e149ck0va	cmp04esoi000g13kfto0cx14p	cmonyv34s000c12mda3tzdz1w	RUCHI MUSTARD OIL 450ML	15149120	6.000	0.000	85.71	0.00	0.00	514.26	5.00	12.86	12.86	0.00	539.98	\N	\N	6.000	85.71	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	90.00	539.98	6.000	\N	115.00	85.71	1	\N	\N	f	0.000	\N	\N	110.00	\N	0.000	6.000	6.000	90.00	PCS	\N
cmp82a2fv0004y7ppyb1fn3w5	cmp6r6rh3000lu24e149ck0va	cmp04i53o000l13kfuhd1wc8x	cmonyv34s000c12mda3tzdz1w	RUCHI SOYA GRANULES 1KG	21061000	3.000	0.000	133.33	0.00	0.00	399.99	5.00	10.00	10.00	0.00	419.99	\N	\N	3.000	133.33	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	140.00	419.99	2.999	\N	190.00	133.33	1	\N	\N	f	0.000	\N	\N	185.00	\N	0.000	3.000	3.000	140.00	PCS	\N
cmp82a2fv0005y7ppgns3rifj	cmp6r6rh3000lu24e149ck0va	cmp04lu01000q13kfevzrttza	cmonyv34n000a12mdbbwrb2yf	RUCHI SOYA CHUNKS 200G	21061000	12.000	0.000	38.10	0.00	0.00	457.20	0.00	0.00	0.00	0.00	457.20	\N	\N	12.000	38.10	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	38.10	457.20	12.000	\N	47.00	38.10	1	\N	\N	f	0.000	\N	\N	46.00	\N	0.000	12.000	12.000	38.10	PCS	\N
cmp86j7vn001jp6sn5heoyasf	cmp86iw9b001cp6snk0qo9cr1	cmp8555px0004p6sn54gnaxij	cmonyv34z000g12mdr8kuzy4g	Johnsons BABY Powder 100g	33049190	1.000	0.000	87.32	0.00	0.00	87.32	18.00	7.86	7.86	0.00	103.04	\N	\N	1.000	91.32	0.000	0.00	0.00	0.00	0.00	0.00	4.38	0.00	0.00	0.000	0.000	0.00	0.00	91.32	103.04	1.000	\N	125.00	87.32	1	\N	\N	f	0.000	\N	\N	122.00	\N	0.000	1.000	1.000	103.04	PCS	\N
cmp86j7vn001kp6snctkqgz9f	cmp86iw9b001cp6snk0qo9cr1	cmp858ezo000dp6sn8o91ac1c	cmonyv34s000c12mda3tzdz1w	Johnsons BABY Shampoo 100ml	33051090	1.000	0.000	87.13	0.00	0.00	87.13	5.00	2.18	2.18	0.00	91.49	\N	\N	1.000	91.13	0.000	0.00	0.00	0.00	0.00	0.00	4.39	0.00	0.00	0.000	0.000	0.00	0.00	91.13	91.49	1.000	\N	111.00	87.13	1	\N	\N	f	0.000	\N	\N	109.00	\N	0.000	1.000	1.000	91.49	PCS	\N
cmp86j7vn001lp6snzi1b5je2	cmp86iw9b001cp6snk0qo9cr1	cmp85b3r1000mp6sn0llkx04p	cmonyv34z000g12mdr8kuzy4g	Johnsons BABY OIL 100ml	33049990	1.000	0.000	105.58	0.00	0.00	105.58	18.00	9.50	9.50	0.00	124.58	\N	\N	1.000	109.58	0.000	0.00	0.00	0.00	0.00	0.00	3.65	0.00	0.00	0.000	0.000	0.00	0.00	109.58	124.58	1.000	\N	150.00	105.58	1	\N	\N	f	0.000	\N	\N	148.00	\N	0.000	1.000	1.000	124.58	PCS	\N
cmp86j7vo001mp6snvmvabjlc	cmp86iw9b001cp6snk0qo9cr1	cmp85dyke000xp6sn55fpfd9i	cmonyv34n000a12mdbbwrb2yf	Stayfree Secure Night	96190010	5.000	1.000	44.54	0.00	0.00	222.70	0.00	0.00	0.00	0.00	222.70	\N	\N	5.000	44.64	0.000	0.00	0.00	0.00	0.00	0.00	0.22	0.00	0.00	0.000	1.000	0.00	0.00	44.64	222.70	5.000	\N	50.00	44.54	1	\N	\N	f	0.000	\N	\N	49.99	\N	1.000	6.000	5.000	37.12	PCS	\N
cmp89xo8j0024p6snjege5soa	cmp89xo8j0022p6sn563vwms0	cmp8555px0004p6sn54gnaxij	cmonyv34z000g12mdr8kuzy4g	Johnsons BABY Powder 100g	33049190	1.000	0.000	87.32	0.00	0.00	87.32	18.00	7.86	7.86	0.00	103.04	\N	\N	1.000	91.32	0.000	0.00	0.00	0.00	0.00	0.00	4.38	0.00	0.00	0.000	0.000	0.00	0.00	103.04	103.04	1.000	\N	125.00	87.32	1	\N	\N	f	0.000	\N	\N	122.00	\N	0.000	1.000	1.000	103.04	PCS	\N
cmp89xo8j0025p6snm3u9r9m9	cmp89xo8j0022p6sn563vwms0	cmp858ezo000dp6sn8o91ac1c	cmonyv34s000c12mda3tzdz1w	Johnsons BABY Shampoo 100ml	33051090	1.000	0.000	87.13	0.00	0.00	87.13	5.00	2.18	2.18	0.00	91.49	\N	\N	1.000	91.13	0.000	0.00	0.00	0.00	0.00	0.00	4.39	0.00	0.00	0.000	0.000	0.00	0.00	91.49	91.49	1.000	\N	111.00	87.13	1	\N	\N	f	0.000	\N	\N	109.00	\N	0.000	1.000	1.000	91.49	PCS	\N
cmp89xo8k0026p6sn1mxx0iuy	cmp89xo8j0022p6sn563vwms0	cmp85b3r1000mp6sn0llkx04p	cmonyv34z000g12mdr8kuzy4g	Johnsons BABY OIL 100ml	33049990	1.000	0.000	105.58	0.00	0.00	105.58	18.00	9.50	9.50	0.00	124.58	\N	\N	1.000	109.58	0.000	0.00	0.00	0.00	0.00	0.00	3.65	0.00	0.00	0.000	0.000	0.00	0.00	124.58	124.58	1.000	\N	150.00	105.58	1	\N	\N	f	0.000	\N	\N	148.00	\N	0.000	1.000	1.000	124.58	PCS	\N
cmp89xo8k0027p6snw2q0upbt	cmp89xo8j0022p6sn563vwms0	cmp85dyke000xp6sn55fpfd9i	cmonyv34n000a12mdbbwrb2yf	Stayfree Secure Night	96190010	5.000	1.000	44.54	0.00	0.00	222.70	0.00	0.00	0.00	0.00	222.70	\N	\N	5.000	44.64	0.000	0.00	0.00	0.00	0.00	0.00	0.22	0.00	0.00	0.000	1.000	0.00	0.00	37.12	222.70	5.000	\N	50.00	44.54	1	\N	\N	f	0.000	\N	\N	49.99	\N	1.000	6.000	5.000	37.12	PCS	\N
cmp9wz6ak0011ytnobpjsp4m8	cmp9wz6aj000zytnozeq5pesd	cmp9w7zed0009ytnopx516vlh	cmonyv34s000c12mda3tzdz1w	Sunfeast Mom's Magic 5/- X 12	19053100	15.000	0.000	51.35	0.00	0.00	770.25	5.00	19.26	19.26	0.00	808.77	\N	\N	15.000	52.13	0.000	0.00	0.00	0.00	0.00	1.50	0.00	0.00	0.00	0.000	0.000	0.00	0.00	50.00	808.77	15.000	\N	60.00	51.35	1	\N	\N	f	0.000	\N	\N	55.00	\N	0.000	15.000	15.000	53.92	PCS	\N
cmp9wz6ak0012ytnoaucbeoid	cmp9wz6aj000zytnozeq5pesd	cmp9wb0t3000iytnow683wlpd	cmonyv34s000c12mda3tzdz1w	Sunfeast Mom's Magic 10/-	19053100	12.000	0.000	8.56	0.00	0.00	102.72	5.00	2.57	2.57	0.00	107.86	\N	\N	12.000	8.69	0.000	0.00	0.00	0.00	0.00	1.50	0.00	0.00	0.00	0.000	0.000	0.00	0.00	8.69	107.86	12.000	\N	10.00	8.56	1	\N	\N	f	0.000	\N	\N	10.00	\N	0.000	12.000	12.000	8.99	PCS	\N
cmp9wz6ak0013ytnorjterj41	cmp9wz6aj000zytnozeq5pesd	cmp9wnxor000rytnoquct5x5b	cmonyv34s000c12mda3tzdz1w	Yippee Noodles 90/-	19023010	24.000	0.000	76.38	0.00	0.00	1833.12	5.00	45.83	45.83	0.00	1924.78	\N	\N	24.000	78.74	0.000	0.00	0.00	0.00	0.00	3.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	78.74	1924.78	24.000	\N	90.00	76.38	1	\N	\N	f	0.000	\N	\N	88.00	\N	0.000	24.000	24.000	80.20	PCS	\N
cmpb30syi000g32e9uivrtwri	cmpb30syi000e32e9fp1ba5o1	cmpb2tjr9000432e9d1539q7o	cmonyv34s000c12mda3tzdz1w	Three Mango Chilli Powder 500g	090411	120.000	0.000	339.43	0.00	0.00	40731.60	5.00	1018.29	1018.29	0.00	42768.18	\N	\N	120.000	342.86	0.000	0.00	0.00	0.00	0.00	1.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	342.86	42768.18	120.000	\N	600.00	339.43	1	\N	\N	f	0.000	\N	\N	380.00	\N	0.000	120.000	120.000	356.40	PCS	\N
cmpcgu0jb000uf0y7aatrzv2e	cmpcgu0jb000sf0y79tml6m1b	cmpcgn219000bf0y7vxb5ln4a	cmonyv34s000c12mda3tzdz1w	Mangaldeep 3 In 1 Agarbathi 55/-	33074100	6.000	0.000	36.46	0.00	0.00	218.76	5.00	5.47	5.47	0.00	229.70	\N	\N	6.000	39.67	0.000	0.00	0.00	0.00	0.00	0.00	8.10	0.00	0.00	0.000	0.000	0.00	0.00	39.67	229.70	6.000	\N	55.00	36.46	1	\N	\N	f	0.000	\N	\N	50.00	\N	0.000	6.000	6.000	38.28	PCS	\N
cmpcgu0jb000vf0y7iontk6o9	cmpcgu0jb000sf0y79tml6m1b	cmpcgq23i000kf0y7b3wvcnm4	cmonyv34s000c12mda3tzdz1w	Mangaldeep Sadhvi Agarbathi 35/-	33074100	12.000	0.000	25.27	0.00	0.00	303.24	5.00	7.58	7.58	0.00	318.40	\N	\N	12.000	25.27	0.000	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.00	0.000	0.000	0.00	0.00	25.27	318.40	12.000	\N	35.00	25.27	1	\N	\N	f	0.000	\N	\N	35.00	\N	0.000	12.000	12.000	26.53	PCS	\N
\.


--
-- Data for Name: sales_bill; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.sales_bill (id, "businessId", "branchId", "financialYearId", "billSeriesId", "billNumber", "billDate", "customerId", "customerName", "customerPhone", "customerGstin", "supplyStateCode", "saleType", "paymentMode", "subtotalAmount", "discountAmount", "taxableAmount", "cgstTotal", "sgstTotal", "igstTotal", "totalTaxAmount", "grandTotal", "paidAmount", "balanceAmount", status, "counterId", "shiftId", "createdById", notes, "createdAt", "updatedAt", "billType", "convertedAt", "convertedToBillId", "estimateStatus", "isB2B", "validityDate", "cardAmount", "cashAmount", "isVoided", "replacedByBillId", "upiAmount", "voidReason", "voidedAt", "voidedById", "voidedByName", "businessAddress", "businessGstin", "businessName", "cashierName", "counterName", "financialYearCode", "cessTotal", "isHistorical") FROM stdin;
cmooat8ri0006qaq2383ylamt	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0001	2026-05-02 12:08:54.943	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-02 12:08:54.943	2026-05-02 12:08:54.943	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmooau7sg000dqaq2i9yapx3h	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0002	2026-05-02 12:09:40.337	\N	\N	\N	\N	36	CASH	UPI	105.00	0.00	88.98	8.01	8.01	0.00	16.02	105.00	105.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-02 12:09:40.337	2026-05-02 12:09:40.337	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop32m9g004qwtff8228xzwl	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0003	2026-05-03 01:20:01.588	\N	\N	\N	\N	36	CASH	CASH	330.00	0.00	314.29	7.86	7.85	0.00	15.71	330.00	330.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:20:01.588	2026-05-03 01:20:01.588	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop34zru004xwtfflkc6fhdf	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmop2z0pv0001wtff4ml5m4ov	INV/2026-27/0001	2026-05-03 01:21:52.41	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:21:52.41	2026-05-03 01:21:52.41	RETAIL_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop35pun0054wtff6znw3h6x	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0004	2026-05-03 01:22:26.207	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:22:26.207	2026-05-03 01:22:26.207	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop39gcy005bwtff9tt33435	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0005	2026-05-03 01:25:20.53	\N	\N	\N	\N	36	CASH	CASH	1100.00	0.00	1100.00	0.00	0.00	0.00	0.00	1100.00	1100.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:25:20.53	2026-05-03 01:25:20.53	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop43euz0002sqaopjtbrbwo	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0006	2026-05-03 01:48:38.268	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:48:38.268	2026-05-03 01:48:38.268	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop447wp0009sqaox9hgs7jo	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0007	2026-05-03 01:49:15.913	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:49:15.913	2026-05-03 01:49:15.913	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop49nja000gsqao3r36d4d1	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmop2z0pv0001wtff4ml5m4ov	INV/2026-27/0002	2026-05-03 01:53:29.446	\N	\N	\N	\N	36	CASH	UPI	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:53:29.446	2026-05-03 01:53:29.446	RETAIL_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop4c2ji000nsqaoisr3zuv7	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0008	2026-05-03 01:55:22.206	\N	\N	\N	\N	36	CASH	CARD	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:55:22.206	2026-05-03 01:55:22.206	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop4c5if000usqaoxzp3vgua	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0009	2026-05-03 01:55:26.056	\N	\N	\N	\N	36	CASH	UPI	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 01:55:26.056	2026-05-03 01:55:26.056	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop585fm0002l98lposn3aw6	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0010	2026-05-03 02:20:18.946	\N	\N	\N	\N	36	CASH	UPI	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 02:20:18.946	2026-05-03 02:20:18.946	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop5dlak000ol98lv9c1kx87	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0011	2026-05-03 02:24:32.78	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 02:24:32.78	2026-05-03 02:24:32.78	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop59hef000el98lupzgqplf	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmop2z0q10003wtffvejzs21g	EST/2026-27/0002	2026-05-03 02:21:21.111	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	0.00	165.00	CANCELLED	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 02:21:21.111	2026-05-03 02:24:32.787	ESTIMATE	2026-05-03 02:24:32.786	cmop5dlak000ol98lv9c1kx87	CONVERTED	f	2026-05-06 02:21:21.109	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmopqrnfy0002r6z2gzebwd2r	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0012	2026-05-03 12:23:20.686	\N	\N	\N	\N	36	CASH	SPLIT	105.00	0.00	88.98	8.01	8.01	0.00	16.02	105.00	105.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 12:23:20.686	2026-05-03 12:23:20.686	TAX_INVOICE	\N	\N	\N	f	\N	0.00	50.00	f	\N	55.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmopt11c70009r6z2202a6bj5	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0013	2026-05-03 13:26:37.832	\N	\N	\N	\N	36	CASH	CASH	100.00	0.00	84.75	7.63	7.62	0.00	15.25	100.00	100.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 13:26:37.832	2026-05-03 13:26:37.832	TAX_INVOICE	\N	\N	\N	f	\N	\N	100.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoptb78e000gr6z2as3fgof5	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0014	2026-05-03 13:34:32.03	\N	\N	\N	\N	36	CASH	CASH	290.00	0.00	263.98	13.01	13.01	0.00	26.02	290.00	290.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 13:34:32.03	2026-05-03 13:34:32.03	TAX_INVOICE	\N	\N	\N	f	\N	\N	300.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoq0lmdn0014r6z2gt275xq8	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0015	2026-05-03 16:58:35.531	\N	\N	\N	\N	36	CASH	CASH	160.00	0.00	152.38	3.81	3.81	0.00	7.62	160.00	160.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 16:58:35.531	2026-05-03 16:58:35.531	TAX_INVOICE	\N	\N	\N	f	\N	\N	200.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxqf7cr0004vb502hlayf99	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0016	2026-05-09 02:35:49.372	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoxoxqvm0001vb50y1jr1gro	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 02:35:49.372	2026-05-09 02:35:49.372	TAX_INVOICE	\N	\N	\N	f	\N	\N	200.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxqhtia000bvb50cum9b18r	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmop2z0q10003wtffvejzs21g	EST/2026-27/0003	2026-05-09 02:37:51.394	\N	\N	\N	\N	36	CASH	CASH	28.00	0.00	28.00	0.00	0.00	0.00	0.00	28.00	0.00	28.00	CANCELLED	cmonyv3c4005g12md0d4nloyd	cmoxoxqvm0001vb50y1jr1gro	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 02:37:51.394	2026-05-09 02:40:44.624	ESTIMATE	2026-05-09 02:40:44.623	cmoxqlj61000nvb50hu3sswmi	CONVERTED	f	2026-05-12 02:37:51.391	\N	28.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxqjlwv000gvb502klcdgc4	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0017	2026-05-09 02:39:14.863	\N	\N	\N	\N	36	CASH	UPI	20.00	0.00	17.86	1.07	1.07	0.00	2.14	20.00	20.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoxoxqvm0001vb50y1jr1gro	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 02:39:14.863	2026-05-09 02:39:14.863	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	20.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmop58fpu0009l98lzf83rgkl	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmop2z0q10003wtffvejzs21g	EST/2026-27/0001	2026-05-03 02:20:32.275	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	0.00	165.00	DRAFT	cmonyv3c4005g12md0d4nloyd	cmonz5hqd005p12mdjlmh7330	cmonyq6zo000212md1ehfe0vm	\N	2026-05-03 02:20:32.275	2026-05-09 02:40:36.816	ESTIMATE	\N	\N	EXPIRED	f	2026-05-06 02:20:32.271	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxqlj61000nvb50hu3sswmi	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0018	2026-05-09 02:40:44.617	\N	\N	\N	\N	36	CASH	CASH	28.00	0.00	28.00	0.00	0.00	0.00	0.00	28.00	28.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoxoxqvm0001vb50y1jr1gro	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 02:40:44.617	2026-05-09 02:40:44.617	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxt2qnh00037py69aw48t7l	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0019	2026-05-09 03:50:06.701	\N	\N	\N	\N	36	CASH	CASH	48.00	0.00	45.86	1.07	1.07	0.00	2.14	48.00	48.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoxrb97b00041005t6o66jv5	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 03:50:06.701	2026-05-09 03:50:06.701	TAX_INVOICE	\N	\N	\N	f	\N	\N	100.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxt7ghg000n7py6c57tc0ch	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0020	2026-05-09 03:53:46.804	\N	\N	\N	\N	36	CASH	CASH	20.00	0.00	17.86	1.07	1.07	0.00	2.14	20.00	20.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoxt60yc000f7py6rroxws6z	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 03:53:46.804	2026-05-09 03:53:46.804	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxt71bi000i7py6eo24t2jx	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmop2z0q10003wtffvejzs21g	EST/2026-27/0004	2026-05-09 03:53:27.15	\N	\N	\N	\N	36	CASH	CASH	20.00	0.00	17.86	1.07	1.07	0.00	2.14	20.00	0.00	20.00	CANCELLED	cmonyv3c4005g12md0d4nloyd	cmoxt60yc000f7py6rroxws6z	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 03:53:27.15	2026-05-09 03:53:46.809	ESTIMATE	2026-05-09 03:53:46.807	cmoxt7ghg000n7py6c57tc0ch	CONVERTED	f	2026-05-12 03:53:27.147	\N	20.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxt8mhn000z7py6lkfsanxv	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0021	2026-05-09 03:54:41.243	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoxt60yc000f7py6rroxws6z	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 03:54:41.243	2026-05-09 03:54:41.243	TAX_INVOICE	\N	\N	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxt8da5000u7py6v39k91lr	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmop2z0q10003wtffvejzs21g	EST/2026-27/0005	2026-05-09 03:54:29.309	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	0.00	165.00	CANCELLED	cmonyv3c4005g12md0d4nloyd	cmoxt60yc000f7py6rroxws6z	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 03:54:29.309	2026-05-09 03:54:41.248	ESTIMATE	2026-05-09 03:54:41.247	cmoxt8mhn000z7py6lkfsanxv	CONVERTED	f	2026-05-12 03:54:29.306	\N	165.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoxtqsxs00167py6dh6gl7rf	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0022	2026-05-09 04:08:49.409	\N	\N	\N	\N	36	CASH	SPLIT	318.00	0.00	291.98	13.01	13.01	0.00	26.02	318.00	318.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoxt60yc000f7py6rroxws6z	cmonyq6zo000212md1ehfe0vm	\N	2026-05-09 04:08:49.409	2026-05-09 04:08:49.409	TAX_INVOICE	\N	\N	\N	f	\N	118.00	100.00	f	\N	100.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoy9j6k90004bw1n9bnfxghz	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0023	2026-05-09 11:30:47.673	\N	\N	\N	\N	36	CASH	CASH	165.00	0.00	157.14	3.93	3.93	0.00	7.86	165.00	165.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmoy9iovs0001bw1nfj0sz7zf	cmoy6amcv004vb32s2juovfxj	\N	2026-05-09 11:30:47.673	2026-05-09 11:30:47.673	TAX_INVOICE	\N	\N	\N	f	\N	\N	200.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmoya4rgp000dbw1nbmpkqe27	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0024	2026-05-09 11:47:34.538	\N	\N	\N	\N	36	CASH	CASH	105.00	0.00	88.98	8.01	8.01	0.00	16.02	105.00	105.00	0.00	FINAL	cmoy6am3c004lb32s4pun615w	cmoya4haw000abw1nswrzc2vi	cmoy6amfy004xb32s9wjzg2mo	\N	2026-05-09 11:47:34.538	2026-05-09 11:47:34.538	TAX_INVOICE	\N	\N	\N	f	\N	\N	150.00	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.00	f
cmpb316ht000l32e9rcx7n2z9	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv34h000612mdb1dt28fi	cmonyv34l000812mdbd7b401f	GST/2026-27/0025	2026-05-18 10:49:50.369	\N	\N	\N	\N	36	CASH	CASH	380.00	0.00	361.90	9.05	9.05	0.00	18.10	380.00	380.00	0.00	FINAL	cmonyv3c4005g12md0d4nloyd	cmparmidh000ejxd5c4h1yq6t	cmonyq6zo000212md1ehfe0vm	\N	2026-05-18 10:49:50.369	2026-05-18 10:49:50.369	TAX_INVOICE	\N	\N	\N	f	\N	\N	500.00	f	\N	\N	\N	\N	\N	\N	H.No 1-2-3, Main Road, Srd, Telangana 506002	36ABCDE1234F1ZS	Srivani Stores	Srivani Admin	Counter 1	2026-27	0.00	f
\.


--
-- Data for Name: sales_item; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.sales_item (id, "billId", "productId", "taxId", "productName", "hsnCode", quantity, "unitPrice", "discountPercent", "discountAmount", "taxableAmount", "gstRatePercent", "cgstAmount", "sgstAmount", "igstAmount", "totalAmount", "unitOfMeasure", "isPriceOverridden", "originalPrice", "overrideReason", mrp, "cessAmount") FROM stdin;
cmooat8rl0008qaq295nsuc4y	cmooat8ri0006qaq2383ylamt	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmooau7si000fqaq2c6egm2wy	cmooau7sg000dqaq2i9yapx3h	cmonyv3bx005c12md2wn5c4cw	cmonyv34z000g12mdr8kuzy4g	Colgate MaxFresh 150g	3306	1.000	105.00	0.00	0.00	88.98	18.00	8.01	8.01	0.00	105.00	PCS	f	\N	\N	\N	0.00
cmop32m9i004swtff8j9xejwt	cmop32m9g004qwtff8228xzwl	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	2.000	165.00	0.00	0.00	314.29	5.00	7.86	7.85	0.00	330.00	PCS	f	\N	\N	\N	0.00
cmop34zrw004zwtffgtx4hqap	cmop34zru004xwtfflkc6fhdf	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop35pur0056wtfftzn6gu6r	cmop35pun0054wtff6znw3h6x	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop39gd1005dwtffqqxrjauq	cmop39gcy005bwtff9tt33435	cmonyv3b8005012mdywbgr2uv	cmonyv34n000a12mdbbwrb2yf	Tata Salt 1kg	2501	50.000	22.00	0.00	0.00	1100.00	0.00	0.00	0.00	0.00	1100.00	PCS	f	\N	\N	\N	0.00
cmop43ev30004sqaoh6m8saka	cmop43euz0002sqaopjtbrbwo	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop447wr000bsqaoqi71o8sq	cmop447wp0009sqaox9hgs7jo	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop49njd000isqaosmixf8m4	cmop49nja000gsqao3r36d4d1	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop4c2jn000psqaos0f7mi2k	cmop4c2ji000nsqaoisr3zuv7	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop4c5ii000wsqaoqsh9nf5a	cmop4c5if000usqaoxzp3vgua	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop585fo0004l98l7ighesue	cmop585fm0002l98lposn3aw6	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop58fpx000bl98l3sw1ub3x	cmop58fpu0009l98lzf83rgkl	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop59heh000gl98l3oh2419z	cmop59hef000el98lupzgqplf	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmop5dlan000ql98lhjtfkxh1	cmop5dlak000ol98lv9c1kx87	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmopqrng10004r6z29cekfxzv	cmopqrnfy0002r6z2gzebwd2r	cmonyv3bx005c12md2wn5c4cw	cmonyv34z000g12mdr8kuzy4g	Colgate MaxFresh 150g	3306	1.000	105.00	0.00	0.00	88.98	18.00	8.01	8.01	0.00	105.00	PCS	f	\N	\N	\N	0.00
cmopt11ca000br6z2uxs62vp1	cmopt11c70009r6z2202a6bj5	cmonyv3bx005c12md2wn5c4cw	cmonyv34z000g12mdr8kuzy4g	Colgate MaxFresh 150g	3306	1.000	100.00	0.00	0.00	84.75	18.00	7.63	7.62	0.00	100.00	PCS	t	105.00	Festival/Sale Offer	\N	0.00
cmoptb78h000ir6z2e8jgc229	cmoptb78e000gr6z2as3fgof5	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmoptb78k000mr6z2zfv12gyy	cmoptb78e000gr6z2as3fgof5	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	1.000	20.00	0.00	0.00	17.86	12.00	1.07	1.07	0.00	20.00	PCS	f	\N	\N	\N	0.00
cmoptb78m000qr6z2kokahazu	cmoptb78e000gr6z2as3fgof5	cmonyv3bx005c12md2wn5c4cw	cmonyv34z000g12mdr8kuzy4g	Colgate MaxFresh 150g	3306	1.000	105.00	0.00	0.00	88.98	18.00	8.01	8.01	0.00	105.00	PCS	f	\N	\N	\N	0.00
cmoq0lmdt0016r6z2gr9kov9h	cmoq0lmdn0014r6z2gt275xq8	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	160.00	0.00	0.00	152.38	5.00	3.81	3.81	0.00	160.00	PCS	t	165.00	Festival/Sale Offer	\N	0.00
cmoxqf7cv0006vb504wz5uk0n	cmoxqf7cr0004vb502hlayf99	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmoxqhtid000dvb50cv3x8jr4	cmoxqhtia000bvb50cum9b18r	cmonyv3bg005412mdnlh0paqm	cmonyv34n000a12mdbbwrb2yf	Amul Full Cream Milk 500ml	0401	1.000	28.00	0.00	0.00	28.00	0.00	0.00	0.00	0.00	28.00	PCS	f	\N	\N	\N	0.00
cmoxqjlwx000ivb50p2hv2z6e	cmoxqjlwv000gvb502klcdgc4	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	1.000	20.00	0.00	0.00	17.86	12.00	1.07	1.07	0.00	20.00	PCS	f	\N	\N	\N	0.00
cmoxqlj64000pvb503fj16kak	cmoxqlj61000nvb50hu3sswmi	cmonyv3bg005412mdnlh0paqm	cmonyv34n000a12mdbbwrb2yf	Amul Full Cream Milk 500ml	0401	1.000	28.00	0.00	0.00	28.00	0.00	0.00	0.00	0.00	28.00	PCS	f	\N	\N	\N	0.00
cmoxt2qnj00057py6uxoh5clh	cmoxt2qnh00037py69aw48t7l	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	1.000	20.00	0.00	0.00	17.86	12.00	1.07	1.07	0.00	20.00	PCS	f	\N	\N	\N	0.00
cmoxt2qnn00097py6e89mvuos	cmoxt2qnh00037py69aw48t7l	cmonyv3bg005412mdnlh0paqm	cmonyv34n000a12mdbbwrb2yf	Amul Full Cream Milk 500ml	0401	1.000	28.00	0.00	0.00	28.00	0.00	0.00	0.00	0.00	28.00	PCS	f	\N	\N	\N	0.00
cmoxt71bj000k7py65rmhinw8	cmoxt71bi000i7py6eo24t2jx	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	1.000	20.00	0.00	0.00	17.86	12.00	1.07	1.07	0.00	20.00	PCS	f	\N	\N	\N	0.00
cmoxt7ghi000p7py60u7s7ynr	cmoxt7ghg000n7py6c57tc0ch	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	1.000	20.00	0.00	0.00	17.86	12.00	1.07	1.07	0.00	20.00	PCS	f	\N	\N	\N	0.00
cmoxt8da7000w7py6a8rd7tky	cmoxt8da5000u7py6v39k91lr	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmoxt8mhp00117py6kk7rk61d	cmoxt8mhn000z7py6lkfsanxv	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmoxtqsxx00187py64zeb8x35	cmoxtqsxs00167py6dh6gl7rf	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmoxtqsy2001c7py6imta55zf	cmoxtqsxs00167py6dh6gl7rf	cmonyv3bg005412mdnlh0paqm	cmonyv34n000a12mdbbwrb2yf	Amul Full Cream Milk 500ml	0401	1.000	28.00	0.00	0.00	28.00	0.00	0.00	0.00	0.00	28.00	PCS	f	\N	\N	\N	0.00
cmoxtqsy4001g7py6s05s6fnn	cmoxtqsxs00167py6dh6gl7rf	cmonyv3bp005812md4140psg2	cmonyv34w000e12mdhkn3t9su	Lays Classic Salted 26g	1905	1.000	20.00	0.00	0.00	17.86	12.00	1.07	1.07	0.00	20.00	PCS	f	\N	\N	\N	0.00
cmoxtqsy6001k7py6gsgw6x8l	cmoxtqsxs00167py6dh6gl7rf	cmonyv3bx005c12md2wn5c4cw	cmonyv34z000g12mdr8kuzy4g	Colgate MaxFresh 150g	3306	1.000	105.00	0.00	0.00	88.98	18.00	8.01	8.01	0.00	105.00	PCS	f	\N	\N	\N	0.00
cmoy9j6kd0006bw1n6pdvm5hz	cmoy9j6k90004bw1n9bnfxghz	cmonyv3ax004w12mdphs0j89j	cmonyv34s000c12mda3tzdz1w	Sunflower Oil 1L	1512	1.000	165.00	0.00	0.00	157.14	5.00	3.93	3.93	0.00	165.00	PCS	f	\N	\N	\N	0.00
cmoya4rgs000fbw1nn1ttg4ir	cmoya4rgp000dbw1nbmpkqe27	cmonyv3bx005c12md2wn5c4cw	cmonyv34z000g12mdr8kuzy4g	Colgate MaxFresh 150g	3306	1.000	105.00	0.00	0.00	88.98	18.00	8.01	8.01	0.00	105.00	PCS	f	\N	\N	\N	0.00
cmpb316hy000n32e9oh6jwb2r	cmpb316ht000l32e9rcx7n2z9	cmpb2tjr9000432e9d1539q7o	cmonyv34s000c12mda3tzdz1w	Three Mango Chilli Powder 500g	090411	1.000	380.00	0.00	0.00	361.90	5.00	9.05	9.05	0.00	380.00	PCS	f	\N	\N	600.00	0.00
\.


--
-- Data for Name: stock_ledger; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.stock_ledger (id, "businessId", "branchId", "productId", "movementType", "movementDate", quantity, "referenceType", "referenceId", notes, "createdAt") FROM stdin;
cmonyv3b1004y12mdpx1n91jy	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	ADJUSTMENT_IN	2026-05-02 06:34:25.79	50.000	OPENING_STOCK	\N	Seed opening stock	2026-05-02 06:34:25.79
cmonyv3bb005212mdohiwqigt	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3b8005012mdywbgr2uv	ADJUSTMENT_IN	2026-05-02 06:34:25.799	50.000	OPENING_STOCK	\N	Seed opening stock	2026-05-02 06:34:25.799
cmonyv3bj005612mdca8hyufs	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bg005412mdnlh0paqm	ADJUSTMENT_IN	2026-05-02 06:34:25.808	50.000	OPENING_STOCK	\N	Seed opening stock	2026-05-02 06:34:25.808
cmonyv3bs005a12mdbbj4vu15	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	ADJUSTMENT_IN	2026-05-02 06:34:25.816	50.000	OPENING_STOCK	\N	Seed opening stock	2026-05-02 06:34:25.816
cmonyv3c1005e12mdysrrqtkz	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bx005c12md2wn5c4cw	ADJUSTMENT_IN	2026-05-02 06:34:25.825	50.000	OPENING_STOCK	\N	Seed opening stock	2026-05-02 06:34:25.825
cmooat8ro000aqaq2lvkdgv6c	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-02 12:08:54.948	-1.000	SALES_BILL	cmooat8ri0006qaq2383ylamt	\N	2026-05-02 12:08:54.948
cmooau7sk000hqaq2q4mos2ib	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bx005c12md2wn5c4cw	SALE	2026-05-02 12:09:40.34	-1.000	SALES_BILL	cmooau7sg000dqaq2i9yapx3h	\N	2026-05-02 12:09:40.34
cmop32m9k004uwtffjr8o24dv	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:20:01.592	-2.000	SALES_BILL	cmop32m9g004qwtff8228xzwl	\N	2026-05-03 01:20:01.592
cmop34zry0051wtffujn7974h	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:21:52.414	-1.000	SALES_BILL	cmop34zru004xwtfflkc6fhdf	\N	2026-05-03 01:21:52.414
cmop35put0058wtffvrymawzs	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:22:26.214	-1.000	SALES_BILL	cmop35pun0054wtff6znw3h6x	\N	2026-05-03 01:22:26.214
cmop39gd3005fwtff7w82q8s4	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3b8005012mdywbgr2uv	SALE	2026-05-03 01:25:20.535	-50.000	SALES_BILL	cmop39gcy005bwtff9tt33435	\N	2026-05-03 01:25:20.535
cmop43ev60006sqaoa1nupsb7	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:48:38.274	-1.000	SALES_BILL	cmop43euz0002sqaopjtbrbwo	\N	2026-05-03 01:48:38.274
cmop447ws000dsqaoy00loby0	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:49:15.916	-1.000	SALES_BILL	cmop447wp0009sqaox9hgs7jo	\N	2026-05-03 01:49:15.916
cmop49njf000ksqaozr6abpmk	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:53:29.452	-1.000	SALES_BILL	cmop49nja000gsqao3r36d4d1	\N	2026-05-03 01:53:29.452
cmop4c2jp000rsqao1ioe5zag	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:55:22.213	-1.000	SALES_BILL	cmop4c2ji000nsqaoisr3zuv7	\N	2026-05-03 01:55:22.213
cmop4c5il000ysqao1vm505o0	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 01:55:26.061	-1.000	SALES_BILL	cmop4c5if000usqaoxzp3vgua	\N	2026-05-03 01:55:26.061
cmop585fp0006l98l18rq7q3g	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 02:20:18.95	-1.000	SALES_BILL	cmop585fm0002l98lposn3aw6	\N	2026-05-03 02:20:18.95
cmop5dlap000sl98lqee8ft1e	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 02:24:32.785	-1.000	SALES_BILL	cmop5dlak000ol98lv9c1kx87	\N	2026-05-03 02:24:32.785
cmopqrng40006r6z24d4a4j4i	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bx005c12md2wn5c4cw	SALE	2026-05-03 12:23:20.692	-1.000	SALES_BILL	cmopqrnfy0002r6z2gzebwd2r	\N	2026-05-03 12:23:20.692
cmopt11cc000dr6z27o4q664w	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bx005c12md2wn5c4cw	SALE	2026-05-03 13:26:37.836	-1.000	SALES_BILL	cmopt11c70009r6z2202a6bj5	\N	2026-05-03 13:26:37.836
cmoptb78i000kr6z2uiwsrngh	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 13:34:32.035	-1.000	SALES_BILL	cmoptb78e000gr6z2as3fgof5	\N	2026-05-03 13:34:32.035
cmoptb78l000or6z2437kzf0w	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	SALE	2026-05-03 13:34:32.037	-1.000	SALES_BILL	cmoptb78e000gr6z2as3fgof5	\N	2026-05-03 13:34:32.037
cmoptb78n000sr6z2ncmvpkoj	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bx005c12md2wn5c4cw	SALE	2026-05-03 13:34:32.04	-1.000	SALES_BILL	cmoptb78e000gr6z2as3fgof5	\N	2026-05-03 13:34:32.04
cmoptc1fb000zr6z2gpi7cy29	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	SALE_RETURN	2026-05-03 13:35:11.16	1.000	CREDIT_NOTE	cmoptc1f5000wr6z27wkay9tz	Credit note CN/2026-27/0001: khvbhjvb ufffigu	2026-05-03 13:35:11.16
cmoq0lmdx0018r6z2cw47dozk	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-03 16:58:35.541	-1.000	SALES_BILL	cmoq0lmdn0014r6z2gt275xq8	\N	2026-05-03 16:58:35.541
cmoxqf7cy0008vb50bzqevppt	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-09 02:35:49.379	-1.000	SALES_BILL	cmoxqf7cr0004vb502hlayf99	\N	2026-05-09 02:35:49.379
cmoxqjlwy000kvb50mrrkn18s	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	SALE	2026-05-09 02:39:14.866	-1.000	SALES_BILL	cmoxqjlwv000gvb502klcdgc4	\N	2026-05-09 02:39:14.866
cmoxqlj66000rvb50j0zlz3l6	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bg005412mdnlh0paqm	SALE	2026-05-09 02:40:44.622	-1.000	SALES_BILL	cmoxqlj61000nvb50hu3sswmi	\N	2026-05-09 02:40:44.622
cmoxt2qnm00077py6q4z8lum6	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	SALE	2026-05-09 03:50:06.706	-1.000	SALES_BILL	cmoxt2qnh00037py69aw48t7l	\N	2026-05-09 03:50:06.706
cmoxt2qno000b7py6j242vn8z	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bg005412mdnlh0paqm	SALE	2026-05-09 03:50:06.709	-1.000	SALES_BILL	cmoxt2qnh00037py69aw48t7l	\N	2026-05-09 03:50:06.709
cmoxt7ghj000r7py6r16wsq2m	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	SALE	2026-05-09 03:53:46.808	-1.000	SALES_BILL	cmoxt7ghg000n7py6c57tc0ch	\N	2026-05-09 03:53:46.808
cmoxt8mhq00137py6g4a562wd	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-09 03:54:41.246	-1.000	SALES_BILL	cmoxt8mhn000z7py6lkfsanxv	\N	2026-05-09 03:54:41.246
cmoxtqsy0001a7py6oybu0ntw	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-09 04:08:49.417	-1.000	SALES_BILL	cmoxtqsxs00167py6dh6gl7rf	\N	2026-05-09 04:08:49.417
cmoxtqsy3001e7py6apwuq47y	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bg005412mdnlh0paqm	SALE	2026-05-09 04:08:49.42	-1.000	SALES_BILL	cmoxtqsxs00167py6dh6gl7rf	\N	2026-05-09 04:08:49.42
cmoxtqsy5001i7py6al755nap	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	SALE	2026-05-09 04:08:49.422	-1.000	SALES_BILL	cmoxtqsxs00167py6dh6gl7rf	\N	2026-05-09 04:08:49.422
cmoxtqsy8001m7py67x9n2l77	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bx005c12md2wn5c4cw	SALE	2026-05-09 04:08:49.424	-1.000	SALES_BILL	cmoxtqsxs00167py6dh6gl7rf	\N	2026-05-09 04:08:49.424
cmoy9j6kg0008bw1nltevv7u5	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	SALE	2026-05-09 11:30:47.681	-1.000	SALES_BILL	cmoy9j6k90004bw1n9bnfxghz	\N	2026-05-09 11:30:47.681
cmoya4rgv000hbw1n9w9cdn6u	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bx005c12md2wn5c4cw	SALE	2026-05-09 11:47:34.543	-1.000	SALES_BILL	cmoya4rgp000dbw1nbmpkqe27	\N	2026-05-09 11:47:34.543
cmozg6xne0007gd87ubp2mb13	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3ax004w12mdphs0j89j	PURCHASE	2026-05-10 07:24:59.738	60.000	PURCHASE	cmozg63ff0001gd87xr9gotys	GRN GRN/2026-27/00001 approved	2026-05-10 07:24:59.738
cmp6jnmip0007bi5bu02eh5pp	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04esoi000g13kfto0cx14p	PURCHASE	2026-05-15 06:36:20.545	11.000	PURCHASE	cmp6ji8nv0001bi5bvqecerc1	GRN GRN/2026-27/00007 approved	2026-05-15 06:36:20.545
cmp6jnosl0009bi5bbpc5arn3	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04b462000b13kf6so6e4qc	PURCHASE	2026-05-15 06:36:23.493	10.000	PURCHASE	cmp6gipi90001x1ueac4k6b7b	GRN GRN/2026-27/00006 approved	2026-05-15 06:36:23.493
cmp6jnqg7000bbi5bbw740i0o	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	PURCHASE	2026-05-15 06:36:25.638	24.000	PURCHASE	cmozg891m0009gd8779l2keh9	GRN GRN/2026-27/00002 approved	2026-05-15 06:36:25.638
cmp6r1ci7000bu24eqjvfw8hl	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmozxc8fo000413kfhttz5rgf	PURCHASE	2026-05-15 10:02:58.063	60.000	PURCHASE	cmp6r0xct0001u24ekf085418	GRN GRN/2026-27/00008 approved	2026-05-15 10:02:58.063
cmp6r1ci7000du24etoe82k93	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04b462000b13kf6so6e4qc	PURCHASE	2026-05-15 10:02:58.063	6.000	PURCHASE	cmp6r0xct0001u24ekf085418	GRN GRN/2026-27/00008 approved	2026-05-15 10:02:58.063
cmp6r1ci7000fu24e8pe5iaye	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04esoi000g13kfto0cx14p	PURCHASE	2026-05-15 10:02:58.063	6.000	PURCHASE	cmp6r0xct0001u24ekf085418	GRN GRN/2026-27/00008 approved	2026-05-15 10:02:58.063
cmp6r1ci7000hu24ekxvvjmij	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04i53o000l13kfuhd1wc8x	PURCHASE	2026-05-15 10:02:58.063	3.000	PURCHASE	cmp6r0xct0001u24ekf085418	GRN GRN/2026-27/00008 approved	2026-05-15 10:02:58.063
cmp6r1ci7000ju24epyx37kj0	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04lu01000q13kfevzrttza	PURCHASE	2026-05-15 10:02:58.063	12.000	PURCHASE	cmp6r0xct0001u24ekf085418	GRN GRN/2026-27/00008 approved	2026-05-15 10:02:58.063
cmp70ycx7000j12033euwvi3f	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmonyv3bp005812md4140psg2	PURCHASE	2026-05-15 14:40:34.795	44.000	PURCHASE	cmp70wg3o000d1203txshsyg2	GRN GRN/2026-27/00010 approved	2026-05-15 14:40:34.795
cmp86lygb001up6snrq8cnli8	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp8555px0004p6sn54gnaxij	PURCHASE	2026-05-16 10:06:40.042	1.000	PURCHASE	cmp86iw9b001cp6snk0qo9cr1	GRN GRN/2026-27/00011 approved	2026-05-16 10:06:40.042
cmp86lygb001wp6snczlkzpp7	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp858ezo000dp6sn8o91ac1c	PURCHASE	2026-05-16 10:06:40.042	1.000	PURCHASE	cmp86iw9b001cp6snk0qo9cr1	GRN GRN/2026-27/00011 approved	2026-05-16 10:06:40.042
cmp86lygb001yp6sn3paikoum	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp85b3r1000mp6sn0llkx04p	PURCHASE	2026-05-16 10:06:40.042	1.000	PURCHASE	cmp86iw9b001cp6snk0qo9cr1	GRN GRN/2026-27/00011 approved	2026-05-16 10:06:40.042
cmp86lygb0020p6snxp9smxzx	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp85dyke000xp6sn55fpfd9i	PURCHASE	2026-05-16 10:06:40.042	5.000	PURCHASE	cmp86iw9b001cp6snk0qo9cr1	GRN GRN/2026-27/00011 approved	2026-05-16 10:06:40.042
cmp98c4e000028rvxptsbvh31	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmozxc8fo000413kfhttz5rgf	PURCHASE	2026-05-17 03:42:46.585	60.000	PURCHASE	cmp6r6rh3000lu24e149ck0va	GRN GRN/2026-27/00009 approved	2026-05-17 03:42:46.585
cmp98c4e300048rvxoxidvqp9	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04b462000b13kf6so6e4qc	PURCHASE	2026-05-17 03:42:46.587	6.000	PURCHASE	cmp6r6rh3000lu24e149ck0va	GRN GRN/2026-27/00009 approved	2026-05-17 03:42:46.587
cmp98c4e300068rvx14ha1kt5	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04esoi000g13kfto0cx14p	PURCHASE	2026-05-17 03:42:46.588	6.000	PURCHASE	cmp6r6rh3000lu24e149ck0va	GRN GRN/2026-27/00009 approved	2026-05-17 03:42:46.588
cmp98c4e400088rvxkz8hv8sn	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04i53o000l13kfuhd1wc8x	PURCHASE	2026-05-17 03:42:46.589	3.000	PURCHASE	cmp6r6rh3000lu24e149ck0va	GRN GRN/2026-27/00009 approved	2026-05-17 03:42:46.589
cmp98c4e5000a8rvxwt0o1ix4	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp04lu01000q13kfevzrttza	PURCHASE	2026-05-17 03:42:46.59	12.000	PURCHASE	cmp6r6rh3000lu24e149ck0va	GRN GRN/2026-27/00009 approved	2026-05-17 03:42:46.59
cmp9jxt6r0002mm1jeu3bzqn7	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp8555px0004p6sn54gnaxij	PURCHASE	2026-05-17 09:07:34.276	1.000	PURCHASE	cmp89xo8j0022p6sn563vwms0	GRN GRN/2026-27/00012 approved	2026-05-17 09:07:34.276
cmp9jxt6u0004mm1joxeh1ef1	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp858ezo000dp6sn8o91ac1c	PURCHASE	2026-05-17 09:07:34.278	1.000	PURCHASE	cmp89xo8j0022p6sn563vwms0	GRN GRN/2026-27/00012 approved	2026-05-17 09:07:34.278
cmp9jxt6v0006mm1j5oe7aa9b	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp85b3r1000mp6sn0llkx04p	PURCHASE	2026-05-17 09:07:34.279	1.000	PURCHASE	cmp89xo8j0022p6sn563vwms0	GRN GRN/2026-27/00012 approved	2026-05-17 09:07:34.279
cmp9jxt6w0008mm1j9ljukq8m	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp85dyke000xp6sn55fpfd9i	PURCHASE	2026-05-17 09:07:34.28	5.000	PURCHASE	cmp89xo8j0022p6sn563vwms0	GRN GRN/2026-27/00012 approved	2026-05-17 09:07:34.28
cmparmcf50002jxd5hnktwsi0	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp9w7zed0009ytnopx516vlh	PURCHASE	2026-05-18 05:30:22.433	15.000	PURCHASE	cmp9wz6aj000zytnozeq5pesd	GRN GRN/2026-27/00013 approved	2026-05-18 05:30:22.433
cmparmcf80004jxd5rlywpn1h	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp9wb0t3000iytnow683wlpd	PURCHASE	2026-05-18 05:30:22.436	12.000	PURCHASE	cmp9wz6aj000zytnozeq5pesd	GRN GRN/2026-27/00013 approved	2026-05-18 05:30:22.436
cmparmcf80006jxd5w5ktyr97	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmp9wnxor000rytnoquct5x5b	PURCHASE	2026-05-18 05:30:22.437	24.000	PURCHASE	cmp9wz6aj000zytnozeq5pesd	GRN GRN/2026-27/00013 approved	2026-05-18 05:30:22.437
cmpb316i1000p32e9drtwmx7z	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmpb2tjr9000432e9d1539q7o	SALE	2026-05-18 10:49:50.378	-1.000	SALES_BILL	cmpb316ht000l32e9rcx7n2z9	\N	2026-05-18 10:49:50.378
cmpbir8k50000r7tnjyffbyhc	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmpb2tjr9000432e9d1539q7o	OPENING_STOCK	2026-05-18 18:10:00.341	120.000	STOCK_TAKE	\N	Stock Take 18/5/2026	2026-05-18 18:10:00.341
cmpcfbkpa0002f0y703tygicj	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmpb2tjr9000432e9d1539q7o	PURCHASE	2026-05-19 09:21:36.911	120.000	PURCHASE	cmpb30syi000e32e9fp1ba5o1	GRN GRN/2026-27/00014 approved	2026-05-19 09:21:36.911
cmpcgutl30010f0y7dbnb21di	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmpcgn219000bf0y7vxb5ln4a	PURCHASE	2026-05-19 10:04:34.503	6.000	PURCHASE	cmpcgu0jb000sf0y79tml6m1b	GRN GRN/2026-27/00015 approved	2026-05-19 10:04:34.503
cmpcgutl50012f0y71bj6hogn	cmonyq6yl000012mdyhe1kk88	cmonyv34b000412mdn97p0tp8	cmpcgq23i000kf0y7b3wvcnm4	PURCHASE	2026-05-19 10:04:34.505	12.000	PURCHASE	cmpcgu0jb000sf0y79tml6m1b	GRN GRN/2026-27/00015 approved	2026-05-19 10:04:34.505
\.


--
-- Data for Name: supplier; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.supplier (id, "businessId", name, gstin, phone, email, address, "stateCode", "paymentTermsDays", "creditLimit", "isGstRegistered", "isActive", "createdAt", "updatedAt", "openingBalance", "openingBalanceDate", "openingBalanceType", "openingBalanceNote") FROM stdin;
cmonyv3ah004q12mdo6l1i7b8	cmonyq6yl000012mdyhe1kk88	Sri Balaji Traders	36AABCS1429B1ZB	9000000001	\N	Secunderabad, Telangana	36	0	0.00	t	t	2026-05-02 06:34:25.77	2026-05-02 06:34:25.77	0.00	\N	DEBIT	\N
cmonyv3al004s12mdnzbg46c8	cmonyq6yl000012mdyhe1kk88	Hindustan Unilever Dist	36AAACH8564E1Z5	9000000002	\N	Hyderabad, Telangana	36	0	0.00	t	t	2026-05-02 06:34:25.773	2026-05-02 06:34:25.773	0.00	\N	DEBIT	\N
cmonyv3ao004u12md8tm4fqq2	cmonyq6yl000012mdyhe1kk88	ITC Foods Distributor	36AABCI1234F1Z3	9000000003	\N	Kukatpally, Hyderabad	36	0	0.00	t	t	2026-05-02 06:34:25.777	2026-05-02 06:34:25.777	0.00	\N	DEBIT	\N
cmozx2rlr000113kf71fpiesa	cmonyq6yl000012mdyhe1kk88	SRI SAI VENKATESHWARA AGENCIES	36ALFPM2395C1Z6	9849579428	\N	D.NO: : 10-77/61/3/A/1\nPOTHIREDDYPALLY\nSANGAREDDY 502295	36	0	100000.00	t	t	2026-05-10 15:17:38.752	2026-05-10 15:17:38.752	0.00	\N	DEBIT	\N
cmp85hsbq0015p6snd289grri	cmonyq6yl000012mdyhe1kk88	SRI Laxmi Agencies	36AKSPK3358H1ZQ	9849528286	\N	SANGAREDDY	36	0	0.00	t	t	2026-05-16 09:35:25.863	2026-05-16 09:35:25.863	0.00	\N	DEBIT	\N
cmp9vfmfc0001ytno3x114u3n	cmonyq6yl000012mdyhe1kk88	MK Traders	36AAEFM1426E1ZP	9652220044	\N	5-8-121/2 KALVAKUNTA ROAD, SHANTHINAGAR, SANGAREDDY 502001	36	7	99999.00	t	t	2026-05-17 14:29:21.097	2026-05-17 14:29:21.097	0.00	\N	DEBIT	\N
cmpb2vu7q000c32e99fbsk1rr	cmonyq6yl000012mdyhe1kk88	Raj Enterprises	36AMVPD9356R1ZV	9849850160	\N	Beside HP petrol Bunk, Shanthi Nagar , Sangareddy 502001	36	15	300000.00	t	t	2026-05-18 10:45:41.174	2026-05-18 10:45:41.174	0.00	\N	DEBIT	\N
\.


--
-- Data for Name: supplier_advance; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.supplier_advance (id, "businessId", "supplierId", amount, "adjustedAmount", "balanceAmount", "paymentMode", "paymentDate", "referenceNo", notes, "screenshotUrl", status, "createdById", "createdByName", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: supplier_advance_adjustment; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.supplier_advance_adjustment (id, "advanceId", "purchaseId", "adjustedAmount", "adjustedAt", notes) FROM stdin;
\.


--
-- Data for Name: supplier_credit_note; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.supplier_credit_note (id, "businessId", "scnNumber", "supplierId", "originalGrnId", "originalInvoiceNo", "supplierCnNumber", "cnDate", reason, "taxableAmount", "cgstAmount", "sgstAmount", "igstAmount", "cessAmount", "totalAmount", "itcReversal", status, notes, "createdById", "createdByName", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: supplier_credit_note_item; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.supplier_credit_note_item (id, "creditNoteId", "productId", "productName", "hsnCode", quantity, "unitPrice", "gstRate", "cessRate", "gstAmount", "cessAmt", "totalAmount") FROM stdin;
\.


--
-- Data for Name: supplier_item_alias; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.supplier_item_alias (id, "businessId", "supplierId", "productId", "supplierCode", "supplierName", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: supplier_payment; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.supplier_payment (id, amount, notes, "businessId", "createdAt", "createdById", "createdByName", "invoiceReference", "paymentDate", "paymentMode", "purchaseId", "referenceNumber", "screenshotUrl", "supplierId", "updatedAt") FROM stdin;
cmp8o5fre00019q0lkz8rdrs1	1000.00	\N	cmonyq6yl000012mdyhe1kk88	2026-05-16 18:17:42.411	\N	Unknown	\N	2026-05-16 00:00:00	BANK_TRANSFER	\N	lj/jlhl	\N	cmozx2rlr000113kf71fpiesa	2026-05-16 18:17:42.411
cmp9l00xy00011asot1b5px72	1000.00	\N	cmonyq6yl000012mdyhe1kk88	2026-05-17 09:37:17.255	\N	Unknown	1234	2026-05-17 00:00:00	CASH	cmp70wg3o000d1203txshsyg2	\N	\N	cmonyv3al004s12mdnzbg46c8	2026-05-17 09:37:17.255
cmpcgvxxq0017f0y71ivb9ees	548.00	\N	cmonyq6yl000012mdyhe1kk88	2026-05-19 10:05:26.798	\N	Unknown	m3/26-27/004952	2026-05-19 00:00:00	NEFT	cmpcgu0jb000sf0y79tml6m1b	330216	\N	cmp9vfmfc0001ytno3x114u3n	2026-05-19 10:05:26.798
\.


--
-- Data for Name: system_setting; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.system_setting (id, "businessId", key, value, "createdAt", "updatedAt") FROM stdin;
cmop59se7000hl98l9jmplpvu	cmonyq6yl000012mdyhe1kk88	billing.defaultBillType	TAX_INVOICE	2026-05-03 02:21:35.359	2026-05-03 02:21:35.359
cmop59se7000il98lqmkpotaf	cmonyq6yl000012mdyhe1kk88	billing.estimateValidityDays	1	2026-05-03 02:21:35.359	2026-05-03 02:21:35.359
cmop59se7000jl98l7ck0ckcf	cmonyq6yl000012mdyhe1kk88	billing.autoB2BOnGstin	true	2026-05-03 02:21:35.359	2026-05-03 02:21:35.359
cmop59se7000kl98lzpb23b2z	cmonyq6yl000012mdyhe1kk88	billing.defaultPrintFormat	THERMAL	2026-05-03 02:21:35.359	2026-05-03 02:21:35.359
cmop59se7000ll98lspoqltir	cmonyq6yl000012mdyhe1kk88	billing.showGstBreakupOnRetail	true	2026-05-03 02:21:35.359	2026-05-03 02:21:35.359
cmopeuxj400006qvu5xa0nnxu	cmonyq6yl000012mdyhe1kk88	pos.shortcut.cash	F5	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj500016qvurrxwrmlb	cmonyq6yl000012mdyhe1kk88	pos.shortcut.upi	F6	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj500026qvuyanuwdy9	cmonyq6yl000012mdyhe1kk88	pos.shortcut.card	F7	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj500036qvuz94551cl	cmonyq6yl000012mdyhe1kk88	pos.shortcut.print	F8	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj500046qvuegpxehw9	cmonyq6yl000012mdyhe1kk88	pos.shortcut.estimate	F9	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj600056qvul8msplox	cmonyq6yl000012mdyhe1kk88	pos.shortcut.hold	Ctrl+G	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj600066qvul6tmvxz1	cmonyq6yl000012mdyhe1kk88	pos.shortcut.heldbills	Ctrl+B	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj600076qvuck5ngfnj	cmonyq6yl000012mdyhe1kk88	pos.shortcut.newbill	Ctrl+N	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmopeuxj600086qvudrwo4shh	cmonyq6yl000012mdyhe1kk88	pos.shortcut.estimatemode	Ctrl+E	2026-05-03 06:49:58.335	2026-05-03 06:49:58.335
cmoxra4vt00021005ax9pq3le	cmonyq6yl000012mdyhe1kk88	pos.single_cashier_mode	false	2026-05-09 02:59:52.505	2026-05-09 02:59:52.505
cmp9vwra50004ytnos7hhf51v	cmonyq6yl000012mdyhe1kk88	system.session_timeout	0	2026-05-17 14:42:40.542	2026-05-17 17:40:07.387
\.


--
-- Data for Name: tax; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public.tax (id, "businessId", "taxName", "taxCode", "taxRate", "hsnCode", "isActive", "createdAt") FROM stdin;
cmonyv34n000a12mdbbwrb2yf	cmonyq6yl000012mdyhe1kk88	GST 0%	GST0	0.00	\N	t	2026-05-02 06:34:25.56
cmonyv34s000c12mda3tzdz1w	cmonyq6yl000012mdyhe1kk88	GST 5%	GST5	5.00	\N	t	2026-05-02 06:34:25.565
cmonyv34w000e12mdhkn3t9su	cmonyq6yl000012mdyhe1kk88	GST 12%	GST12	12.00	\N	t	2026-05-02 06:34:25.568
cmonyv34z000g12mdr8kuzy4g	cmonyq6yl000012mdyhe1kk88	GST 18%	GST18	18.00	\N	t	2026-05-02 06:34:25.572
cmonyv353000i12md7rzvgizi	cmonyq6yl000012mdyhe1kk88	GST 28%	GST28	28.00	\N	t	2026-05-02 06:34:25.575
cmonyv356000k12mdg1n5mu9c	cmonyq6yl000012mdyhe1kk88	GST 0.25%	GST025	0.25	\N	t	2026-05-02 06:34:25.579
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: srivani
--

COPY public."user" (id, "businessId", username, email, "passwordHash", "fullName", phone, role, status, "failedLoginAttempts", "lockedUntil", "lastLoginAt", "lastLoginIp", "deletedAt", "createdAt", "updatedAt", pin, "counterId", "assignedCounterIds", "createdById", "createdByName", "updatedById", "updatedByName") FROM stdin;
cmonyq6zo000212md1ehfe0vm	cmonyq6yl000012mdyhe1kk88	admin	\N	$argon2id$v=19$m=65536,t=3,p=4$1M7ylru4aWDGbLtN3TXupQ$zTMgDFsP+X5rHEdjOtZnkWmCD8FpEmSD3VVutuptFqw	Srivani Admin	\N	SUPER_ADMIN	ACTIVE	0	\N	\N	\N	\N	2026-05-02 06:30:37.285	2026-05-02 06:30:37.285	\N	\N	\N	\N	\N	\N	\N
cmoy6am6n004rb32s13cl1maz	cmonyq6yl000012mdyhe1kk88	manager1	\N	$argon2id$v=19$m=65536,t=3,p=4$96EbQ6aQiBbljX5ixXiRKQ$Br9aS+N7Bcer9sXndfgpSmP5JhFuk8I+Pqd3YtEJNyE	Manager One	\N	BRANCH_MANAGER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.168	2026-05-09 10:00:09.168	$argon2id$v=19$m=65536,t=3,p=4$aQYJWZb40kw1f+IPbitvpg$/EIUdJcLTOn9HFL2rX2XwAk7H/w0r/kc8K9iIafUF+E	\N	\N	\N	System Seed	\N	\N
cmoy6am9p004tb32slj19hage	cmonyq6yl000012mdyhe1kk88	manager2	\N	$argon2id$v=19$m=65536,t=3,p=4$qArWumMw/ieJpdfcRddZtQ$S1UcY9NsedEFrNrWX1SpxvNwcqFTlb1EORoIn5RDNUM	Manager Two	\N	BRANCH_MANAGER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.278	2026-05-09 10:00:09.278	$argon2id$v=19$m=65536,t=3,p=4$bnI4SEdZ5mzgFyFslc+HPA$AwhbnknjPnECbjbFJec4WFes6PDC3iqw9Iopqim7054	\N	\N	\N	System Seed	\N	\N
cmoy6amj6004zb32s90eqwdi0	cmonyq6yl000012mdyhe1kk88	cashier3	\N	$argon2id$v=19$m=65536,t=3,p=4$iBryIsI4nhf8kRmOOOkMQQ$Y8zTfq+JCAIpy4OrOpTQsVCgzoyENbb7VkvzZCWTDFk	Cashier Three	\N	CASHIER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.618	2026-05-09 10:00:09.618	$argon2id$v=19$m=65536,t=3,p=4$n/SJVFXU56CaNAoypfQ7ag$2pzmK+SEgpYCHw6MZisvsaf0Cob7Er2iXHNocnYaNwQ	cmoy6am3c004lb32s4pun615w	\N	\N	System Seed	\N	\N
cmoy6amme0051b32s54ilpspc	cmonyq6yl000012mdyhe1kk88	cashier4	\N	$argon2id$v=19$m=65536,t=3,p=4$wWNFat1qUBzOkU3zUVSl7Q$doBeVzEDnOIJn+yt77A7+fiNdF74wrp+j2DPzKkEe+w	Cashier Four	\N	CASHIER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.734	2026-05-09 10:00:09.734	$argon2id$v=19$m=65536,t=3,p=4$ADU2r9jgYIlsdeE8J4wL+g$ycNl/FvnS6Mw4MoCQI5yZrN0zm29Y9RHkZCcMUrAmq4	cmoy6am3f004nb32s8m8m1xwd	\N	\N	System Seed	\N	\N
cmoy6ampf0053b32s9ka65xji	cmonyq6yl000012mdyhe1kk88	cashier5	\N	$argon2id$v=19$m=65536,t=3,p=4$ACSewpc1k63oN6Bx0HrtoQ$epYyh5fR3oYkQWLpqa6X6UE1BIqUutU+OnB/rerIZrQ	Cashier Five	\N	CASHIER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.844	2026-05-09 10:00:09.844	$argon2id$v=19$m=65536,t=3,p=4$wNGUV7XXv36t2TrubIuvJw$gL92kHJKGX2KM1bJ0vEFEMj4v+Gj15c1Sx++6s4Q6U8	cmoy6am3j004pb32sup32l58x	\N	\N	System Seed	\N	\N
cmoy6amsk0055b32srqjsfj14	cmonyq6yl000012mdyhe1kk88	checker1	\N	$argon2id$v=19$m=65536,t=3,p=4$3KhFvNth2jH05MMfmTvdyQ$fWWwQJ65dM5Co51veBxBFMpV5M0TCHec4Q+Xv2WfKuM	Purchase Checker One	\N	PURCHASE_CHECKER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.956	2026-05-09 10:00:09.956	$argon2id$v=19$m=65536,t=3,p=4$imggqQVOBgwl5F17kvKXTQ$oL1F6pulcjiFouPeRYZReIpX/OfUhqmwNOW+8NhDjC8	\N	\N	\N	System Seed	\N	\N
cmoy6amvr0057b32s8sz8pfyz	cmonyq6yl000012mdyhe1kk88	checker2	\N	$argon2id$v=19$m=65536,t=3,p=4$ZN2CohkhswhApMOnPDpKKg$GJb0bXcRj/Z3wlCBPwkrvn5ChSfhpk+CIw1aJoOMs0s	Purchase Checker Two	\N	PURCHASE_CHECKER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:10.072	2026-05-09 10:00:10.072	$argon2id$v=19$m=65536,t=3,p=4$d3JPFUloiWwvsORmsN5BuA$35njFcoCIMByhiWXmpB2zVdSQZw7CNKUkRnxhdWl/7g	\N	\N	\N	System Seed	\N	\N
cmoy6amyx0059b32syfcrondy	cmonyq6yl000012mdyhe1kk88	viewer1	\N	$argon2id$v=19$m=65536,t=3,p=4$HQonl7HTIO6dHRDroKLdMw$oSzsJWF75oWIgGiJY/F+KS+Sr2GlW53Qnv0F/BitD3o	Viewer One	\N	VIEWER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:10.185	2026-05-09 10:00:10.185	$argon2id$v=19$m=65536,t=3,p=4$3ib77APTgvLmhWbOt4/hYQ$lVHy6cTAiqvEBEHc3YYHLbw0SpYEWELUPpuap3mCVKw	\N	\N	\N	System Seed	\N	\N
cmoy6amcv004vb32s2juovfxj	cmonyq6yl000012mdyhe1kk88	cashier1	\N	$argon2id$v=19$m=65536,t=3,p=4$0R98DZ04fv3w/WNEUxqnew$CuHUEptirCESqGUeY26sOXkIlAj9Ox/NNqGXiPX+Cc8	Cashier One	\N	CASHIER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.392	2026-05-17 18:00:41.159	$argon2id$v=19$m=65536,t=3,p=4$2C7rOfx6WzOnEkEYfqodtw$alxzX6UBNTkrgG1ZvURllpx2v/fh4aG0UfcZJBGI8tI	cmonyv3c4005g12md0d4nloyd	\N	\N	System Seed	cmonyq6zo000212md1ehfe0vm	admin
cmoy6amfy004xb32s9wjzg2mo	cmonyq6yl000012mdyhe1kk88	cashier2	\N	$argon2id$v=19$m=65536,t=3,p=4$8kkf8Me8dibF3yIjqS1W5A$kYwkb//o/r1s3nniz+2NjCm8NRQkvlQqjdw5bStpG8M	Cashier Two	\N	CASHIER	ACTIVE	0	\N	\N	\N	\N	2026-05-09 10:00:09.502	2026-05-17 18:32:19.565	$argon2id$v=19$m=65536,t=3,p=4$ZtSaMVcdWwALlRVIdcW5CA$HgHxQiqIxqPkoe0VrhTPhZdDjDDc51rTNxUmGR8/E5c	cmoy6am37004jb32ssia3zwg8	\N	\N	System Seed	cmonyq6zo000212md1ehfe0vm	admin
cmphp925j0001clz0rbqwvjjr	cmonyq6yl000012mdyhe1kk88	test1	\N	$argon2id$v=19$m=65536,t=3,p=4$VcG1150bQdIUQQaB+U+LyQ$9ELLs7uINPOxF+BcArdNcUCS2qLynZlXZEwO6p1vktY	test1	admin	VIEWER	ACTIVE	0	\N	\N	\N	\N	2026-05-23 01:58:26.598	2026-05-23 01:58:26.598	$argon2id$v=19$m=65536,t=3,p=4$7CmKBg/GPktmVOXA1qDWtg$nqaKlKv2xniuqkOhlM8ECCAVH4tB19/Het8ZPr5iqBQ	\N	\N	cmonyq6zo000212md1ehfe0vm	admin	\N	\N
\.


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: srivani
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 39, true);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: bill_series bill_series_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.bill_series
    ADD CONSTRAINT bill_series_pkey PRIMARY KEY (id);


--
-- Name: branch branch_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (id);


--
-- Name: brand brand_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT brand_pkey PRIMARY KEY (id);


--
-- Name: business business_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.business
    ADD CONSTRAINT business_pkey PRIMARY KEY (id);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: credit_note_item credit_note_item_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.credit_note_item
    ADD CONSTRAINT credit_note_item_pkey PRIMARY KEY (id);


--
-- Name: credit_note credit_note_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.credit_note
    ADD CONSTRAINT credit_note_pkey PRIMARY KEY (id);


--
-- Name: customer_address customer_address_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.customer_address
    ADD CONSTRAINT customer_address_pkey PRIMARY KEY (id);


--
-- Name: customer_payment customer_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.customer_payment
    ADD CONSTRAINT customer_payment_pkey PRIMARY KEY (id);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- Name: day_closure day_closure_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.day_closure
    ADD CONSTRAINT day_closure_pkey PRIMARY KEY (id);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- Name: expense expense_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_pkey PRIMARY KEY (id);


--
-- Name: financial_year financial_year_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.financial_year
    ADD CONSTRAINT financial_year_pkey PRIMARY KEY (id);


--
-- Name: held_bill held_bill_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.held_bill
    ADD CONSTRAINT held_bill_pkey PRIMARY KEY (id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);


--
-- Name: pos_counter pos_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.pos_counter
    ADD CONSTRAINT pos_counter_pkey PRIMARY KEY (id);


--
-- Name: pos_shift pos_shift_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.pos_shift
    ADD CONSTRAINT pos_shift_pkey PRIMARY KEY (id);


--
-- Name: product_barcode product_barcode_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_barcode
    ADD CONSTRAINT product_barcode_pkey PRIMARY KEY (id);


--
-- Name: product_batch product_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_batch
    ADD CONSTRAINT product_batch_pkey PRIMARY KEY (id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: product_plu product_plu_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_plu
    ADD CONSTRAINT product_plu_pkey PRIMARY KEY (id);


--
-- Name: product_price product_price_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT product_price_pkey PRIMARY KEY (id);


--
-- Name: purchase_item purchase_item_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.purchase_item
    ADD CONSTRAINT purchase_item_pkey PRIMARY KEY (id);


--
-- Name: purchase purchase_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_pkey PRIMARY KEY (id);


--
-- Name: sales_bill sales_bill_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT sales_bill_pkey PRIMARY KEY (id);


--
-- Name: sales_item sales_item_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_item
    ADD CONSTRAINT sales_item_pkey PRIMARY KEY (id);


--
-- Name: stock_ledger stock_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT stock_ledger_pkey PRIMARY KEY (id);


--
-- Name: supplier_advance_adjustment supplier_advance_adjustment_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_advance_adjustment
    ADD CONSTRAINT supplier_advance_adjustment_pkey PRIMARY KEY (id);


--
-- Name: supplier_advance supplier_advance_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_advance
    ADD CONSTRAINT supplier_advance_pkey PRIMARY KEY (id);


--
-- Name: supplier_credit_note_item supplier_credit_note_item_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_credit_note_item
    ADD CONSTRAINT supplier_credit_note_item_pkey PRIMARY KEY (id);


--
-- Name: supplier_credit_note supplier_credit_note_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_credit_note
    ADD CONSTRAINT supplier_credit_note_pkey PRIMARY KEY (id);


--
-- Name: supplier_item_alias supplier_item_alias_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_item_alias
    ADD CONSTRAINT supplier_item_alias_pkey PRIMARY KEY (id);


--
-- Name: supplier_payment supplier_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_payment
    ADD CONSTRAINT supplier_payment_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);


--
-- Name: system_setting system_setting_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.system_setting
    ADD CONSTRAINT system_setting_pkey PRIMARY KEY (id);


--
-- Name: tax tax_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.tax
    ADD CONSTRAINT tax_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: audit_log_createdAt_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "audit_log_createdAt_idx" ON public.audit_log USING btree ("createdAt");


--
-- Name: audit_log_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "audit_log_entityType_entityId_idx" ON public.audit_log USING btree ("entityType", "entityId");


--
-- Name: bill_series_businessId_financialYearId_billType_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "bill_series_businessId_financialYearId_billType_key" ON public.bill_series USING btree ("businessId", "financialYearId", "billType");


--
-- Name: brand_businessId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "brand_businessId_idx" ON public.brand USING btree ("businessId");


--
-- Name: brand_businessId_name_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "brand_businessId_name_key" ON public.brand USING btree ("businessId", name);


--
-- Name: category_businessId_code_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "category_businessId_code_key" ON public.category USING btree ("businessId", code);


--
-- Name: category_businessId_departmentId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "category_businessId_departmentId_idx" ON public.category USING btree ("businessId", "departmentId");


--
-- Name: category_businessId_parentId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "category_businessId_parentId_idx" ON public.category USING btree ("businessId", "parentId");


--
-- Name: credit_note_businessId_createdAt_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "credit_note_businessId_createdAt_idx" ON public.credit_note USING btree ("businessId", "createdAt");


--
-- Name: credit_note_businessId_originalBillId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "credit_note_businessId_originalBillId_idx" ON public.credit_note USING btree ("businessId", "originalBillId");


--
-- Name: credit_note_creditNoteNumber_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "credit_note_creditNoteNumber_key" ON public.credit_note USING btree ("creditNoteNumber");


--
-- Name: customer_address_customerId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "customer_address_customerId_idx" ON public.customer_address USING btree ("customerId");


--
-- Name: customer_businessId_customerCode_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "customer_businessId_customerCode_key" ON public.customer USING btree ("businessId", "customerCode");


--
-- Name: customer_businessId_phone_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "customer_businessId_phone_idx" ON public.customer USING btree ("businessId", phone);


--
-- Name: customer_payment_businessId_paymentDate_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "customer_payment_businessId_paymentDate_idx" ON public.customer_payment USING btree ("businessId", "paymentDate");


--
-- Name: customer_payment_customerId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "customer_payment_customerId_idx" ON public.customer_payment USING btree ("customerId");


--
-- Name: day_closure_businessId_branchId_closureDate_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "day_closure_businessId_branchId_closureDate_key" ON public.day_closure USING btree ("businessId", "branchId", "closureDate");


--
-- Name: day_closure_businessId_closureDate_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "day_closure_businessId_closureDate_idx" ON public.day_closure USING btree ("businessId", "closureDate");


--
-- Name: department_businessId_code_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "department_businessId_code_key" ON public.department USING btree ("businessId", code);


--
-- Name: department_businessId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "department_businessId_idx" ON public.department USING btree ("businessId");


--
-- Name: held_bill_businessId_status_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "held_bill_businessId_status_idx" ON public.held_bill USING btree ("businessId", status);


--
-- Name: notification_businessId_createdAt_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "notification_businessId_createdAt_idx" ON public.notification USING btree ("businessId", "createdAt");


--
-- Name: notification_businessId_isRead_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "notification_businessId_isRead_idx" ON public.notification USING btree ("businessId", "isRead");


--
-- Name: pos_counter_businessId_code_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "pos_counter_businessId_code_key" ON public.pos_counter USING btree ("businessId", code);


--
-- Name: pos_shift_counterId_status_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "pos_shift_counterId_status_idx" ON public.pos_shift USING btree ("counterId", status);


--
-- Name: product_barcode_businessId_barcodeValue_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "product_barcode_businessId_barcodeValue_key" ON public.product_barcode USING btree ("businessId", "barcodeValue");


--
-- Name: product_barcode_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX product_barcode_idx ON public.product USING btree (barcode);


--
-- Name: product_barcode_pluId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_barcode_pluId_idx" ON public.product_barcode USING btree ("pluId");


--
-- Name: product_barcode_productId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_barcode_productId_idx" ON public.product_barcode USING btree ("productId");


--
-- Name: product_batch_expiryDate_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_batch_expiryDate_idx" ON public.product_batch USING btree ("expiryDate");


--
-- Name: product_batch_productId_branchId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_batch_productId_branchId_idx" ON public.product_batch USING btree ("productId", "branchId");


--
-- Name: product_businessId_barcode_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "product_businessId_barcode_key" ON public.product USING btree ("businessId", barcode);


--
-- Name: product_businessId_isActive_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_businessId_isActive_idx" ON public.product USING btree ("businessId", "isActive");


--
-- Name: product_businessId_productCode_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_businessId_productCode_idx" ON public.product USING btree ("businessId", "productCode");


--
-- Name: product_businessId_productCode_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "product_businessId_productCode_key" ON public.product USING btree ("businessId", "productCode");


--
-- Name: product_plu_businessId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_plu_businessId_idx" ON public.product_plu USING btree ("businessId");


--
-- Name: product_plu_businessId_pluCode_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "product_plu_businessId_pluCode_key" ON public.product_plu USING btree ("businessId", "pluCode");


--
-- Name: product_plu_pluCode_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_plu_pluCode_idx" ON public.product_plu USING btree ("pluCode");


--
-- Name: product_plu_productId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_plu_productId_idx" ON public.product_plu USING btree ("productId");


--
-- Name: product_price_productId_priceListType_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "product_price_productId_priceListType_idx" ON public.product_price USING btree ("productId", "priceListType");


--
-- Name: purchase_businessId_invoiceNumber_supplierId_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "purchase_businessId_invoiceNumber_supplierId_key" ON public.purchase USING btree ("businessId", "invoiceNumber", "supplierId");


--
-- Name: purchase_status_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX purchase_status_idx ON public.purchase USING btree (status);


--
-- Name: purchase_supplierId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "purchase_supplierId_idx" ON public.purchase USING btree ("supplierId");


--
-- Name: sales_bill_branchId_billDate_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "sales_bill_branchId_billDate_idx" ON public.sales_bill USING btree ("branchId", "billDate");


--
-- Name: sales_bill_customerId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "sales_bill_customerId_idx" ON public.sales_bill USING btree ("customerId");


--
-- Name: sales_bill_status_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX sales_bill_status_idx ON public.sales_bill USING btree (status);


--
-- Name: stock_ledger_movementDate_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "stock_ledger_movementDate_idx" ON public.stock_ledger USING btree ("movementDate");


--
-- Name: stock_ledger_productId_branchId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "stock_ledger_productId_branchId_idx" ON public.stock_ledger USING btree ("productId", "branchId");


--
-- Name: supplier_advance_businessId_supplierId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "supplier_advance_businessId_supplierId_idx" ON public.supplier_advance USING btree ("businessId", "supplierId");


--
-- Name: supplier_credit_note_businessId_supplierId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "supplier_credit_note_businessId_supplierId_idx" ON public.supplier_credit_note USING btree ("businessId", "supplierId");


--
-- Name: supplier_credit_note_item_creditNoteId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "supplier_credit_note_item_creditNoteId_idx" ON public.supplier_credit_note_item USING btree ("creditNoteId");


--
-- Name: supplier_credit_note_scnNumber_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "supplier_credit_note_scnNumber_key" ON public.supplier_credit_note USING btree ("scnNumber");


--
-- Name: supplier_item_alias_businessId_supplierId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "supplier_item_alias_businessId_supplierId_idx" ON public.supplier_item_alias USING btree ("businessId", "supplierId");


--
-- Name: supplier_item_alias_supplierId_productId_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "supplier_item_alias_supplierId_productId_key" ON public.supplier_item_alias USING btree ("supplierId", "productId");


--
-- Name: supplier_payment_businessId_purchaseId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "supplier_payment_businessId_purchaseId_idx" ON public.supplier_payment USING btree ("businessId", "purchaseId");


--
-- Name: supplier_payment_businessId_supplierId_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "supplier_payment_businessId_supplierId_idx" ON public.supplier_payment USING btree ("businessId", "supplierId");


--
-- Name: supplier_payment_paymentDate_idx; Type: INDEX; Schema: public; Owner: srivani
--

CREATE INDEX "supplier_payment_paymentDate_idx" ON public.supplier_payment USING btree ("paymentDate");


--
-- Name: system_setting_businessId_key_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "system_setting_businessId_key_key" ON public.system_setting USING btree ("businessId", key);


--
-- Name: tax_businessId_taxCode_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "tax_businessId_taxCode_key" ON public.tax USING btree ("businessId", "taxCode");


--
-- Name: user_businessId_username_key; Type: INDEX; Schema: public; Owner: srivani
--

CREATE UNIQUE INDEX "user_businessId_username_key" ON public."user" USING btree ("businessId", username);


--
-- Name: audit_log audit_log_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bill_series bill_series_financialYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.bill_series
    ADD CONSTRAINT "bill_series_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES public.financial_year(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: branch branch_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT "branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: brand brand_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT "brand_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: category category_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT "category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: category category_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT "category_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.department(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: category category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.category(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: credit_note_item credit_note_item_creditNoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.credit_note_item
    ADD CONSTRAINT "credit_note_item_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES public.credit_note(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_address customer_address_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.customer_address
    ADD CONSTRAINT "customer_address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer customer_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT "customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_payment customer_payment_billId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.customer_payment
    ADD CONSTRAINT "customer_payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES public.sales_bill(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_payment customer_payment_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.customer_payment
    ADD CONSTRAINT "customer_payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: day_closure day_closure_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.day_closure
    ADD CONSTRAINT "day_closure_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: department department_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT "department_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: expense expense_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT "expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: financial_year financial_year_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.financial_year
    ADD CONSTRAINT "financial_year_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: notification notification_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT "notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pos_counter pos_counter_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.pos_counter
    ADD CONSTRAINT "pos_counter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pos_counter pos_counter_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.pos_counter
    ADD CONSTRAINT "pos_counter_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pos_shift pos_shift_cashierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.pos_shift
    ADD CONSTRAINT "pos_shift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: pos_shift pos_shift_counterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.pos_shift
    ADD CONSTRAINT "pos_shift_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES public.pos_counter(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_barcode product_barcode_pluId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_barcode
    ADD CONSTRAINT "product_barcode_pluId_fkey" FOREIGN KEY ("pluId") REFERENCES public.product_plu(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_barcode product_barcode_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_barcode
    ADD CONSTRAINT "product_barcode_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_batch product_batch_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_batch
    ADD CONSTRAINT "product_batch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_batch product_batch_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_batch
    ADD CONSTRAINT "product_batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product product_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public.brand(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product product_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.category(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product product_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "product_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.department(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: product_plu product_plu_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_plu
    ADD CONSTRAINT "product_plu_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_plu product_plu_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_plu
    ADD CONSTRAINT "product_plu_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_price product_price_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product_price
    ADD CONSTRAINT "product_price_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product product_taxId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "product_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES public.tax(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase purchase_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT "purchase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_item purchase_item_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.purchase_item
    ADD CONSTRAINT "purchase_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_item purchase_item_purchaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.purchase_item
    ADD CONSTRAINT "purchase_item_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES public.purchase(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_item purchase_item_taxId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.purchase_item
    ADD CONSTRAINT "purchase_item_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES public.tax(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase purchase_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT "purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.supplier(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_bill sales_bill_billSeriesId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT "sales_bill_billSeriesId_fkey" FOREIGN KEY ("billSeriesId") REFERENCES public.bill_series(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_bill sales_bill_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT "sales_bill_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_bill sales_bill_counterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT "sales_bill_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES public.pos_counter(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_bill sales_bill_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT "sales_bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_bill sales_bill_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT "sales_bill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customer(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_bill sales_bill_financialYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT "sales_bill_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES public.financial_year(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_bill sales_bill_shiftId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_bill
    ADD CONSTRAINT "sales_bill_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES public.pos_shift(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sales_item sales_item_billId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_item
    ADD CONSTRAINT "sales_item_billId_fkey" FOREIGN KEY ("billId") REFERENCES public.sales_bill(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_item sales_item_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_item
    ADD CONSTRAINT "sales_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales_item sales_item_taxId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.sales_item
    ADD CONSTRAINT "sales_item_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES public.tax(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_ledger stock_ledger_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "stock_ledger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public.branch(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stock_ledger stock_ledger_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "stock_ledger_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_advance_adjustment supplier_advance_adjustment_advanceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_advance_adjustment
    ADD CONSTRAINT "supplier_advance_adjustment_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES public.supplier_advance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_advance supplier_advance_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_advance
    ADD CONSTRAINT "supplier_advance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_advance supplier_advance_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_advance
    ADD CONSTRAINT "supplier_advance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.supplier(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier supplier_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT "supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_credit_note supplier_credit_note_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_credit_note
    ADD CONSTRAINT "supplier_credit_note_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_credit_note_item supplier_credit_note_item_creditNoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_credit_note_item
    ADD CONSTRAINT "supplier_credit_note_item_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES public.supplier_credit_note(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_credit_note supplier_credit_note_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_credit_note
    ADD CONSTRAINT "supplier_credit_note_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.supplier(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_item_alias supplier_item_alias_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_item_alias
    ADD CONSTRAINT "supplier_item_alias_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_item_alias supplier_item_alias_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_item_alias
    ADD CONSTRAINT "supplier_item_alias_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_item_alias supplier_item_alias_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_item_alias
    ADD CONSTRAINT "supplier_item_alias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.supplier(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_payment supplier_payment_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_payment
    ADD CONSTRAINT "supplier_payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_payment supplier_payment_purchaseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_payment
    ADD CONSTRAINT "supplier_payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES public.purchase(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: supplier_payment supplier_payment_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.supplier_payment
    ADD CONSTRAINT "supplier_payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public.supplier(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tax tax_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public.tax
    ADD CONSTRAINT "tax_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user user_businessId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: srivani
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "user_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES public.business(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: srivani
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict 7auZPTVYbLLQvYmkao6ViPlWPWKI0sl1kMARprikLapq6lUdkbvBv4dDULn9L0f

