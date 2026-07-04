-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'HUF', 'PRIVATE_LTD', 'PUBLIC_LTD');

-- CreateEnum
CREATE TYPE "TaxRegimePreference" AS ENUM ('OLD', 'NEW', 'COMPUTE_BOTH');

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('PLANT_MACHINERY', 'FURNITURE_FITTINGS', 'COMPUTER_SOFTWARE', 'VEHICLE_COMMERCIAL', 'VEHICLE_PERSONAL', 'BUILDING_RESIDENTIAL', 'BUILDING_COMMERCIAL', 'ELECTRICAL', 'INTANGIBLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "CapitalTxnType" AS ENUM ('INTRODUCED', 'WITHDRAWAL', 'INTEREST_CREDITED', 'SALARY_CREDITED', 'PROFIT_SHARE', 'LOSS_SHARE');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('BANK_TERM', 'CASH_CREDIT', 'OVERDRAFT', 'VEHICLE_LOAN', 'PROPERTY_LOAN', 'PERSONAL_LOAN', 'NBFC', 'OTHER');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED', 'NPA');

-- CreateEnum
CREATE TYPE "TdsSection" AS ENUM ('S192', 'S194A', 'S194C', 'S194D', 'S194H', 'S194I', 'S194IB', 'S194J', 'S194LA', 'S194M', 'S194N', 'S194Q', 'OTHER');

-- CreateEnum
CREATE TYPE "TdsStatus" AS ENUM ('PENDING_DEPOSIT', 'DEPOSITED', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "AdvanceTaxInstallment" AS ENUM ('Q1_JUNE_15', 'Q2_SEP_15', 'Q3_DEC_15', 'Q4_MAR_15');

-- CreateEnum
CREATE TYPE "ItReturnStatus" AS ENUM ('DRAFT', 'DATA_COLLECTION', 'CA_REVIEW', 'OWNER_RESPONSE_PENDING', 'READY_TO_FILE', 'FILED', 'PROCESSED_REFUND', 'PROCESSED_DEMAND', 'REVISED');

-- CreateEnum
CREATE TYPE "CaIssueSeverity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "CaIssueStatus" AS ENUM ('OPEN', 'OWNER_RESPONDED', 'CA_VERIFIED', 'RESOLVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "Form26ASSection" AS ENUM ('PART_A', 'PART_A1', 'PART_A2', 'PART_B', 'PART_C', 'PART_D', 'PART_E', 'PART_F', 'PART_G', 'OTHER');

-- DropForeignKey
ALTER TABLE "purchase_order_item" DROP CONSTRAINT "purchase_order_item_poId_fkey";

-- DropIndex
DROP INDEX "volume_pricing_tier_business_id_plu_barcode_min_qty_key";

-- DropIndex
DROP INDEX "volume_pricing_tier_business_plu_idx";

-- AlterTable
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bank_statement_import" ADD CONSTRAINT "bank_statement_import_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bill_series" ADD CONSTRAINT "bill_series_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "branch" ADD CONSTRAINT "branch_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "brand" ADD CONSTRAINT "brand_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "break_bulk_log" ADD CONSTRAINT "break_bulk_log_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "business" ADD CONSTRAINT "business_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "category" ADD CONSTRAINT "category_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "credit_note_item" ADD CONSTRAINT "credit_note_item_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "customer" ADD CONSTRAINT "customer_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "day_closure" ADD CONSTRAINT "day_closure_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "department" ADD CONSTRAINT "department_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "expense" ADD CONSTRAINT "expense_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "financial_year" ADD CONSTRAINT "financial_year_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "held_bill" ADD CONSTRAINT "held_bill_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "notification" ADD CONSTRAINT "notification_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "online_order" ALTER COLUMN "source" SET DATA TYPE TEXT,
ADD CONSTRAINT "online_order_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "online_order_item" ADD CONSTRAINT "online_order_item_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "plu_bundle" ADD COLUMN     "bulkWeightG" DECIMAL(10,3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "unitWeightG" DECIMAL(10,3),
ADD CONSTRAINT "plu_bundle_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "pos_counter" ADD CONSTRAINT "pos_counter_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "pos_shift" ADD CONSTRAINT "pos_shift_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product" ADD CONSTRAINT "product_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_batch" ADD CONSTRAINT "product_batch_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_group" ADD CONSTRAINT "product_group_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_group_member" ADD CONSTRAINT "product_group_member_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_plu" ADD COLUMN     "baseUnitQty" DECIMAL(15,3),
ADD COLUMN     "gstUqc" TEXT,
ADD COLUMN     "isLoose" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "measureType" TEXT,
ADD COLUMN     "unitSize" DECIMAL(10,3),
ADD COLUMN     "unitSymbol" TEXT,
ADD CONSTRAINT "product_plu_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "product_price" ADD CONSTRAINT "product_price_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "purchase_order" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchase_order_item" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sales_item" ADD CONSTRAINT "sales_item_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "stock_alert" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "notifiedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "storefront_address" ADD CONSTRAINT "storefront_address_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "storefront_profile" ADD CONSTRAINT "storefront_profile_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier" ADD COLUMN     "bankAliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD CONSTRAINT "supplier_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier_advance" ADD CONSTRAINT "supplier_advance_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier_advance_adjustment" ADD CONSTRAINT "supplier_advance_adjustment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier_bank_account" ADD CONSTRAINT "supplier_bank_account_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier_credit_note" ADD CONSTRAINT "supplier_credit_note_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier_credit_note_item" ADD CONSTRAINT "supplier_credit_note_item_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier_item_alias" ADD CONSTRAINT "supplier_item_alias_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "system_setting" ADD CONSTRAINT "system_setting_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "tax" ADD CONSTRAINT "tax_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user" ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "volume_pricing_tier" DROP CONSTRAINT "volume_pricing_tier_pkey",
DROP COLUMN "business_id",
DROP COLUMN "created_at",
DROP COLUMN "min_qty",
DROP COLUMN "plu_barcode",
DROP COLUMN "updated_at",
ADD COLUMN     "businessId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "minQty" INTEGER NOT NULL,
ADD COLUMN     "pluBarcode" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "volume_pricing_tier_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "wa_incoming_list" ADD CONSTRAINT "wa_incoming_list_pkey" PRIMARY KEY ("id");

-- CreateTable
CREATE TABLE "repack_session" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sessionNo" TEXT NOT NULL,
    "sourcePluId" TEXT NOT NULL,
    "sourceQty" DECIMAL(10,3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FIXED',
    "bulkWeightG" DECIMAL(10,3),
    "totalInputG" DECIMAL(15,3),
    "totalOutputG" DECIMAL(15,3),
    "wastageG" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "wastageUnits" INTEGER NOT NULL DEFAULT 0,
    "wastageNotes" TEXT,
    "notes" TEXT,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversedByName" TEXT,
    "reversedSessionId" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repack_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repack_session_line" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "targetPluId" TEXT NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL,
    "unitWeightG" DECIMAL(10,3),
    "totalWeightG" DECIMAL(15,3),
    "notes" TEXT,

    CONSTRAINT "repack_session_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_review" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "packLabel" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "sentiment" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_profile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL DEFAULT 'PROPRIETORSHIP',
    "taxRegimePref" "TaxRegimePreference" NOT NULL DEFAULT 'COMPUTE_BOTH',
    "hufKartaName" TEXT,
    "hufKartaPan" TEXT,
    "booksMethod" TEXT NOT NULL DEFAULT 'MERCANTILE',
    "isTaxAuditRequired" BOOLEAN NOT NULL DEFAULT false,
    "isGstAuditRequired" BOOLEAN NOT NULL DEFAULT false,
    "eriRegistered" BOOLEAN NOT NULL DEFAULT false,
    "eriToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_partner" (
    "id" TEXT NOT NULL,
    "itProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pan" TEXT,
    "designation" TEXT,
    "profitSharePct" DECIMAL(5,2) NOT NULL,
    "lossSharePct" DECIMAL(5,2) NOT NULL,
    "interestOnCapPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "salaryPerYear" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "joiningDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_asset" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "assetCode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assetClass" "AssetClass" NOT NULL,
    "customDepnRate" DECIMAL(5,2),
    "location" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "invoiceNo" TEXT,
    "vendorName" TEXT,
    "originalCost" DECIMAL(15,2) NOT NULL,
    "openingWDV" DECIMAL(15,2),
    "openingFY" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposalDate" TIMESTAMP(3),
    "disposalValue" DECIMAL(15,2),
    "disposalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_depreciation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "openingWDV" DECIMAL(15,2) NOT NULL,
    "additions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "disposals" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "depreciationPct" DECIMAL(5,2) NOT NULL,
    "depreciationAmt" DECIMAL(15,2) NOT NULL,
    "closingWDV" DECIMAL(15,2) NOT NULL,
    "halfYearRule" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "asset_depreciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_account" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "pan" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_transaction" (
    "id" TEXT NOT NULL,
    "capitalAccountId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "CapitalTxnType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT,
    "bankTxnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capital_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_loan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "loanType" "LoanType" NOT NULL,
    "accountNumber" TEXT,
    "sanctionedAmount" DECIMAL(15,2) NOT NULL,
    "disbursedDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3),
    "interestRatePct" DECIMAL(5,2) NOT NULL,
    "interestType" TEXT NOT NULL DEFAULT 'REDUCING',
    "moratoriumMonths" INTEGER NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(15,2) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "collateral" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "principalPaid" DECIMAL(15,2) NOT NULL,
    "interestPaid" DECIMAL(15,2) NOT NULL,
    "penaltyPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(15,2) NOT NULL,
    "balanceAfter" DECIMAL(15,2) NOT NULL,
    "bankTxnId" TEXT,
    "challanRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tds_entry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "section" "TdsSection" NOT NULL,
    "deducteeName" TEXT NOT NULL,
    "deducteePan" TEXT,
    "deducteeTan" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentAmount" DECIMAL(15,2) NOT NULL,
    "tdsRatePct" DECIMAL(5,2) NOT NULL,
    "tdsAmount" DECIMAL(15,2) NOT NULL,
    "surcharge" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cess" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTdsAmount" DECIMAL(15,2) NOT NULL,
    "depositDueDate" TIMESTAMP(3) NOT NULL,
    "status" "TdsStatus" NOT NULL DEFAULT 'PENDING_DEPOSIT',
    "depositedDate" TIMESTAMP(3),
    "bsrCode" TEXT,
    "challanSerial" TEXT,
    "challanAmount" DECIMAL(15,2),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tds_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_tax_payment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "installment" "AdvanceTaxInstallment" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "estimatedTaxFY" DECIMAL(15,2) NOT NULL,
    "cumulativePctDue" DECIMAL(5,2) NOT NULL,
    "amountDue" DECIMAL(15,2) NOT NULL,
    "amountPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "shortfall" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "interest234C" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "bsrCode" TEXT,
    "challanSerial" TEXT,
    "challanAmount" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_tax_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_return" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "itrForm" TEXT NOT NULL,
    "grossTurnover" DECIMAL(15,2),
    "gstTurnover" DECIMAL(15,2),
    "turnoverDiff" DECIMAL(15,2),
    "grossProfit" DECIMAL(15,2),
    "totalExpenses" DECIMAL(15,2),
    "netProfitBooks" DECIMAL(15,2),
    "depreciationBooks" DECIMAL(15,2),
    "depreciationItAct" DECIMAL(15,2),
    "disallowances40a3" DECIMAL(15,2),
    "otherAddbacks" DECIMAL(15,2),
    "otherDeductions" DECIMAL(15,2),
    "taxableIncomeBusiness" DECIMAL(15,2),
    "presumptiveTaxable" DECIMAL(15,2),
    "usePresumptive" BOOLEAN NOT NULL DEFAULT false,
    "regimeOld" JSONB,
    "regimeNew" JSONB,
    "chosenRegime" TEXT,
    "taxableIncomeFinal" DECIMAL(15,2),
    "taxBeforeCess" DECIMAL(15,2),
    "surcharge" DECIMAL(15,2),
    "cess" DECIMAL(15,2),
    "totalTaxPayable" DECIMAL(15,2),
    "tdsCreditFrom26as" DECIMAL(15,2),
    "advanceTaxPaid" DECIMAL(15,2),
    "selfAssessmentTax" DECIMAL(15,2),
    "interest234A" DECIMAL(15,2),
    "interest234B" DECIMAL(15,2),
    "interest234C" DECIMAL(15,2),
    "netPayable" DECIMAL(15,2),
    "refundDue" DECIMAL(15,2),
    "status" "ItReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "filedDate" TIMESTAMP(3),
    "ackNumber" TEXT,
    "filedByName" TEXT,
    "itrJson" TEXT,
    "priorItrJson" TEXT,
    "taxAuditRequired" BOOLEAN NOT NULL DEFAULT false,
    "form3cdData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ca_issue_flag" (
    "id" TEXT NOT NULL,
    "itReturnId" TEXT NOT NULL,
    "caUserId" TEXT NOT NULL,
    "caName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "severity" "CaIssueSeverity" NOT NULL,
    "issue" TEXT NOT NULL,
    "details" TEXT,
    "ownerReply" TEXT,
    "caVerifyNote" TEXT,
    "status" "CaIssueStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ca_issue_flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_26as_upload" (
    "id" TEXT NOT NULL,
    "itReturnId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileType" TEXT NOT NULL,
    "totalTdsCredit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTcsCredit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "form_26as_upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_26as_entry" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "section" "Form26ASSection" NOT NULL,
    "deductorName" TEXT NOT NULL,
    "deductorTan" TEXT,
    "pan" TEXT,
    "transactionDate" TIMESTAMP(3),
    "grossAmount" DECIMAL(15,2) NOT NULL,
    "tdsAmount" DECIMAL(15,2) NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matchedTdsId" TEXT,
    "discrepancy" DECIMAL(15,2),
    "notes" TEXT,

    CONSTRAINT "form_26as_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_filing_record" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "assessmentYear" TEXT NOT NULL,
    "itrForm" TEXT NOT NULL,
    "filedDate" TIMESTAMP(3) NOT NULL,
    "ackNumber" TEXT NOT NULL,
    "grossIncome" DECIMAL(15,2) NOT NULL,
    "taxPaid" DECIMAL(15,2) NOT NULL,
    "refundClaimed" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "demandRaised" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "processingStatus" TEXT NOT NULL DEFAULT 'FILED',
    "demandNoticeNo" TEXT,
    "refundDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "it_filing_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repack_session_businessId_idx" ON "repack_session"("businessId");

-- CreateIndex
CREATE INDEX "repack_session_businessId_createdAt_idx" ON "repack_session"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "repack_session_businessId_sessionNo_key" ON "repack_session"("businessId", "sessionNo");

-- CreateIndex
CREATE INDEX "repack_session_line_sessionId_idx" ON "repack_session_line"("sessionId");

-- CreateIndex
CREATE INDEX "product_review_businessId_productCode_idx" ON "product_review"("businessId", "productCode");

-- CreateIndex
CREATE INDEX "product_review_businessId_createdAt_idx" ON "product_review"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_review_orderNumber_productCode_key" ON "product_review"("orderNumber", "productCode");

-- CreateIndex
CREATE UNIQUE INDEX "it_profile_businessId_key" ON "it_profile"("businessId");

-- CreateIndex
CREATE INDEX "business_partner_itProfileId_idx" ON "business_partner"("itProfileId");

-- CreateIndex
CREATE INDEX "fixed_asset_businessId_idx" ON "fixed_asset"("businessId");

-- CreateIndex
CREATE INDEX "fixed_asset_businessId_status_idx" ON "fixed_asset"("businessId", "status");

-- CreateIndex
CREATE INDEX "asset_depreciation_assetId_idx" ON "asset_depreciation"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_depreciation_assetId_financialYear_key" ON "asset_depreciation"("assetId", "financialYear");

-- CreateIndex
CREATE INDEX "capital_account_businessId_idx" ON "capital_account"("businessId");

-- CreateIndex
CREATE INDEX "capital_transaction_capitalAccountId_idx" ON "capital_transaction"("capitalAccountId");

-- CreateIndex
CREATE INDEX "capital_transaction_capitalAccountId_financialYear_idx" ON "capital_transaction"("capitalAccountId", "financialYear");

-- CreateIndex
CREATE INDEX "business_loan_businessId_idx" ON "business_loan"("businessId");

-- CreateIndex
CREATE INDEX "loan_repayment_loanId_idx" ON "loan_repayment"("loanId");

-- CreateIndex
CREATE INDEX "tds_entry_businessId_financialYear_idx" ON "tds_entry"("businessId", "financialYear");

-- CreateIndex
CREATE INDEX "tds_entry_businessId_status_idx" ON "tds_entry"("businessId", "status");

-- CreateIndex
CREATE INDEX "tds_entry_businessId_section_idx" ON "tds_entry"("businessId", "section");

-- CreateIndex
CREATE INDEX "advance_tax_payment_businessId_financialYear_idx" ON "advance_tax_payment"("businessId", "financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "advance_tax_payment_businessId_financialYear_installment_key" ON "advance_tax_payment"("businessId", "financialYear", "installment");

-- CreateIndex
CREATE INDEX "it_return_businessId_idx" ON "it_return"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "it_return_businessId_financialYear_key" ON "it_return"("businessId", "financialYear");

-- CreateIndex
CREATE INDEX "ca_issue_flag_itReturnId_idx" ON "ca_issue_flag"("itReturnId");

-- CreateIndex
CREATE INDEX "ca_issue_flag_itReturnId_status_idx" ON "ca_issue_flag"("itReturnId", "status");

-- CreateIndex
CREATE INDEX "form_26as_upload_itReturnId_idx" ON "form_26as_upload"("itReturnId");

-- CreateIndex
CREATE INDEX "form_26as_entry_uploadId_idx" ON "form_26as_entry"("uploadId");

-- CreateIndex
CREATE INDEX "it_filing_record_businessId_idx" ON "it_filing_record"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "it_filing_record_businessId_financialYear_key" ON "it_filing_record"("businessId", "financialYear");

-- CreateIndex
CREATE INDEX "audit_log_businessId_createdAt_idx" ON "audit_log"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_log_businessId_entity_idx" ON "audit_log"("businessId", "entity");

-- CreateIndex
CREATE INDEX "audit_log_userId_idx" ON "audit_log"("userId");

-- CreateIndex
CREATE INDEX "bank_account_businessId_idx" ON "bank_account"("businessId");

-- CreateIndex
CREATE INDEX "bank_statement_import_bankAccountId_idx" ON "bank_statement_import"("bankAccountId");

-- CreateIndex
CREATE INDEX "bank_transaction_bankAccountId_txnDate_idx" ON "bank_transaction"("bankAccountId", "txnDate");

-- CreateIndex
CREATE INDEX "bank_transaction_matchStatus_idx" ON "bank_transaction"("matchStatus");

-- CreateIndex
CREATE INDEX "bank_transaction_businessId_idx" ON "bank_transaction"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "bill_series_businessId_financialYearId_billType_key" ON "bill_series"("businessId", "financialYearId", "billType");

-- CreateIndex
CREATE INDEX "brand_businessId_idx" ON "brand"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_businessId_name_key" ON "brand"("businessId", "name");

-- CreateIndex
CREATE INDEX "break_bulk_log_businessId_createdAt_idx" ON "break_bulk_log"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "category_businessId_parentId_idx" ON "category"("businessId", "parentId");

-- CreateIndex
CREATE INDEX "category_businessId_departmentId_idx" ON "category"("businessId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "category_businessId_code_key" ON "category"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_creditNoteNumber_key" ON "credit_note"("creditNoteNumber");

-- CreateIndex
CREATE INDEX "credit_note_businessId_originalBillId_idx" ON "credit_note"("businessId", "originalBillId");

-- CreateIndex
CREATE INDEX "credit_note_businessId_createdAt_idx" ON "credit_note"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_businessId_phone_idx" ON "customer"("businessId", "phone");

-- CreateIndex
CREATE INDEX "customer_businessId_isActive_idx" ON "customer"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "customer_name_idx" ON "customer" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "customer_businessId_customerCode_key" ON "customer"("businessId", "customerCode");

-- CreateIndex
CREATE INDEX "customer_address_customerId_idx" ON "customer_address"("customerId");

-- CreateIndex
CREATE INDEX "customer_payment_customerId_idx" ON "customer_payment"("customerId");

-- CreateIndex
CREATE INDEX "customer_payment_businessId_paymentDate_idx" ON "customer_payment"("businessId", "paymentDate");

-- CreateIndex
CREATE INDEX "day_closure_businessId_closureDate_idx" ON "day_closure"("businessId", "closureDate");

-- CreateIndex
CREATE UNIQUE INDEX "day_closure_businessId_branchId_closureDate_key" ON "day_closure"("businessId", "branchId", "closureDate");

-- CreateIndex
CREATE INDEX "department_businessId_idx" ON "department"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "department_businessId_code_key" ON "department"("businessId", "code");

-- CreateIndex
CREATE INDEX "held_bill_businessId_status_idx" ON "held_bill"("businessId", "status");

-- CreateIndex
CREATE INDEX "notification_businessId_isRead_idx" ON "notification"("businessId", "isRead");

-- CreateIndex
CREATE INDEX "notification_businessId_createdAt_idx" ON "notification"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "online_order_orderNumber_key" ON "online_order"("orderNumber");

-- CreateIndex
CREATE INDEX "online_order_businessId_idx" ON "online_order"("businessId");

-- CreateIndex
CREATE INDEX "online_order_customerPhone_idx" ON "online_order"("customerPhone");

-- CreateIndex
CREATE INDEX "online_order_createdAt_idx" ON "online_order"("createdAt");

-- CreateIndex
CREATE INDEX "online_order_item_orderId_idx" ON "online_order_item"("orderId");

-- CreateIndex
CREATE INDEX "payment_allocation_purchaseId_idx" ON "payment_allocation"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocation_paymentId_purchaseId_key" ON "payment_allocation"("paymentId", "purchaseId");

-- CreateIndex
CREATE INDEX "plu_bundle_businessId_idx" ON "plu_bundle"("businessId");

-- CreateIndex
CREATE INDEX "plu_bundle_singlePluId_idx" ON "plu_bundle"("singlePluId");

-- CreateIndex
CREATE UNIQUE INDEX "plu_bundle_bulkPluId_singlePluId_key" ON "plu_bundle"("bulkPluId", "singlePluId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_counter_businessId_code_key" ON "pos_counter"("businessId", "code");

-- CreateIndex
CREATE INDEX "pos_shift_counterId_status_idx" ON "pos_shift"("counterId", "status");

-- CreateIndex
CREATE INDEX "product_businessId_isActive_idx" ON "product"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "product_barcode_idx" ON "product"("barcode");

-- CreateIndex
CREATE INDEX "product_businessId_productCode_idx" ON "product"("businessId", "productCode");

-- CreateIndex
CREATE INDEX "product_name_idx" ON "product" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "product_keywords_idx" ON "product" USING GIN ("keywords" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "product_businessId_barcode_key" ON "product"("businessId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_businessId_productCode_key" ON "product"("businessId", "productCode");

-- CreateIndex
CREATE INDEX "product_barcode_productId_idx" ON "product_barcode"("productId");

-- CreateIndex
CREATE INDEX "product_barcode_pluId_idx" ON "product_barcode"("pluId");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcode_businessId_barcodeValue_key" ON "product_barcode"("businessId", "barcodeValue");

-- CreateIndex
CREATE INDEX "product_batch_productId_branchId_idx" ON "product_batch"("productId", "branchId");

-- CreateIndex
CREATE INDEX "product_batch_expiryDate_idx" ON "product_batch"("expiryDate");

-- CreateIndex
CREATE INDEX "product_group_businessId_idx" ON "product_group"("businessId");

-- CreateIndex
CREATE INDEX "product_group_member_productId_idx" ON "product_group_member"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_group_member_groupId_productId_key" ON "product_group_member"("groupId", "productId");

-- CreateIndex
CREATE INDEX "product_image_productId_idx" ON "product_image"("productId");

-- CreateIndex
CREATE INDEX "product_plu_productId_idx" ON "product_plu"("productId");

-- CreateIndex
CREATE INDEX "product_plu_businessId_idx" ON "product_plu"("businessId");

-- CreateIndex
CREATE INDEX "product_plu_pluCode_idx" ON "product_plu"("pluCode");

-- CreateIndex
CREATE UNIQUE INDEX "product_plu_businessId_pluCode_key" ON "product_plu"("businessId", "pluCode");

-- CreateIndex
CREATE INDEX "product_price_productId_priceListType_idx" ON "product_price"("productId", "priceListType");

-- CreateIndex
CREATE INDEX "purchase_supplierId_idx" ON "purchase"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_status_idx" ON "purchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_businessId_invoiceNumber_supplierId_key" ON "purchase"("businessId", "invoiceNumber", "supplierId");

-- CreateIndex
CREATE INDEX "sales_bill_branchId_billDate_idx" ON "sales_bill"("branchId", "billDate");

-- CreateIndex
CREATE INDEX "sales_bill_status_idx" ON "sales_bill"("status");

-- CreateIndex
CREATE INDEX "sales_bill_customerId_idx" ON "sales_bill"("customerId");

-- CreateIndex
CREATE INDEX "stock_ledger_productId_branchId_idx" ON "stock_ledger"("productId", "branchId");

-- CreateIndex
CREATE INDEX "stock_ledger_movementDate_idx" ON "stock_ledger"("movementDate");

-- CreateIndex
CREATE INDEX "storefront_address_phone_idx" ON "storefront_address"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "storefront_profile_email_key" ON "storefront_profile"("email");

-- CreateIndex
CREATE INDEX "storefront_profile_phone_idx" ON "storefront_profile"("phone");

-- CreateIndex
CREATE INDEX "supplier_businessId_idx" ON "supplier"("businessId");

-- CreateIndex
CREATE INDEX "supplier_name_idx" ON "supplier" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "supplier_advance_businessId_supplierId_idx" ON "supplier_advance"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "supplier_bank_account_supplierId_idx" ON "supplier_bank_account"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_bank_account_businessId_idx" ON "supplier_bank_account"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_note_scnNumber_key" ON "supplier_credit_note"("scnNumber");

-- CreateIndex
CREATE INDEX "supplier_credit_note_businessId_supplierId_idx" ON "supplier_credit_note"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "supplier_credit_note_item_creditNoteId_idx" ON "supplier_credit_note_item"("creditNoteId");

-- CreateIndex
CREATE INDEX "supplier_item_alias_businessId_supplierId_idx" ON "supplier_item_alias"("businessId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_item_alias_supplierId_productId_key" ON "supplier_item_alias"("supplierId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payment_proofToken_key" ON "supplier_payment"("proofToken");

-- CreateIndex
CREATE INDEX "supplier_payment_businessId_supplierId_idx" ON "supplier_payment"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "supplier_payment_businessId_purchaseId_idx" ON "supplier_payment"("businessId", "purchaseId");

-- CreateIndex
CREATE INDEX "supplier_payment_paymentDate_idx" ON "supplier_payment"("paymentDate");

-- CreateIndex
CREATE INDEX "supplier_payment_bankTransactionId_idx" ON "supplier_payment"("bankTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "system_setting_businessId_key_key" ON "system_setting"("businessId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tax_businessId_taxCode_key" ON "tax"("businessId", "taxCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_businessId_username_key" ON "user"("businessId", "username");

-- CreateIndex
CREATE INDEX "volume_pricing_tier_businessId_pluBarcode_idx" ON "volume_pricing_tier"("businessId", "pluBarcode");

-- CreateIndex
CREATE UNIQUE INDEX "volume_pricing_tier_businessId_pluBarcode_minQty_key" ON "volume_pricing_tier"("businessId", "pluBarcode", "minQty");

-- CreateIndex
CREATE INDEX "wa_incoming_list_businessId_idx" ON "wa_incoming_list"("businessId");

-- CreateIndex
CREATE INDEX "wa_incoming_list_senderPhone_idx" ON "wa_incoming_list"("senderPhone");

-- CreateIndex
CREATE INDEX "wa_incoming_list_status_idx" ON "wa_incoming_list"("status");

-- AddForeignKey
ALTER TABLE "branch" ADD CONSTRAINT "branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_year" ADD CONSTRAINT "financial_year_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax" ADD CONSTRAINT "tax_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand" ADD CONSTRAINT "brand_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "tax"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_group_member" ADD CONSTRAINT "product_group_member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "product_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_group_member" ADD CONSTRAINT "product_group_member_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcode" ADD CONSTRAINT "product_barcode_pluId_fkey" FOREIGN KEY ("pluId") REFERENCES "product_plu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price" ADD CONSTRAINT "product_price_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batch" ADD CONSTRAINT "product_batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batch" ADD CONSTRAINT "product_batch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bank_account" ADD CONSTRAINT "supplier_bank_account_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_series" ADD CONSTRAINT "bill_series_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "financial_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_billSeriesId_fkey" FOREIGN KEY ("billSeriesId") REFERENCES "bill_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "pos_counter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_bill" ADD CONSTRAINT "sales_bill_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "pos_shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_item" ADD CONSTRAINT "sales_item_billId_fkey" FOREIGN KEY ("billId") REFERENCES "sales_bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_item" ADD CONSTRAINT "sales_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_item" ADD CONSTRAINT "sales_item_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "tax"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "tax"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_counter" ADD CONSTRAINT "pos_counter_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_counter" ADD CONSTRAINT "pos_counter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shift" ADD CONSTRAINT "pos_shift_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "pos_counter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_shift" ADD CONSTRAINT "pos_shift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_closure" ADD CONSTRAINT "day_closure_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_item" ADD CONSTRAINT "credit_note_item_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting" ADD CONSTRAINT "system_setting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plu_bundle" ADD CONSTRAINT "plu_bundle_bulkPluId_fkey" FOREIGN KEY ("bulkPluId") REFERENCES "product_plu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plu_bundle" ADD CONSTRAINT "plu_bundle_singlePluId_fkey" FOREIGN KEY ("singlePluId") REFERENCES "product_plu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repack_session" ADD CONSTRAINT "repack_session_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repack_session_line" ADD CONSTRAINT "repack_session_line_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "repack_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_plu" ADD CONSTRAINT "product_plu_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_plu" ADD CONSTRAINT "product_plu_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_item_alias" ADD CONSTRAINT "supplier_item_alias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_item_alias" ADD CONSTRAINT "supplier_item_alias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_item_alias" ADD CONSTRAINT "supplier_item_alias_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_advance" ADD CONSTRAINT "supplier_advance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_advance" ADD CONSTRAINT "supplier_advance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_advance_adjustment" ADD CONSTRAINT "supplier_advance_adjustment_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "supplier_advance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_note" ADD CONSTRAINT "supplier_credit_note_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_note" ADD CONSTRAINT "supplier_credit_note_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_note_item" ADD CONSTRAINT "supplier_credit_note_item_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "supplier_credit_note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "supplier_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_account" ADD CONSTRAINT "bank_account_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_import" ADD CONSTRAINT "bank_statement_import_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "bank_statement_import"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "supplier_payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment" ADD CONSTRAINT "customer_payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "sales_bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order" ADD CONSTRAINT "online_order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_order_item" ADD CONSTRAINT "online_order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "online_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_incoming_list" ADD CONSTRAINT "wa_incoming_list_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_review" ADD CONSTRAINT "product_review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volume_pricing_tier" ADD CONSTRAINT "volume_pricing_tier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_profile" ADD CONSTRAINT "it_profile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partner" ADD CONSTRAINT "business_partner_itProfileId_fkey" FOREIGN KEY ("itProfileId") REFERENCES "it_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_asset" ADD CONSTRAINT "fixed_asset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation" ADD CONSTRAINT "asset_depreciation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "fixed_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_account" ADD CONSTRAINT "capital_account_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_transaction" ADD CONSTRAINT "capital_transaction_capitalAccountId_fkey" FOREIGN KEY ("capitalAccountId") REFERENCES "capital_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_loan" ADD CONSTRAINT "business_loan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayment" ADD CONSTRAINT "loan_repayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "business_loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tds_entry" ADD CONSTRAINT "tds_entry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_tax_payment" ADD CONSTRAINT "advance_tax_payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_return" ADD CONSTRAINT "it_return_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ca_issue_flag" ADD CONSTRAINT "ca_issue_flag_itReturnId_fkey" FOREIGN KEY ("itReturnId") REFERENCES "it_return"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_26as_upload" ADD CONSTRAINT "form_26as_upload_itReturnId_fkey" FOREIGN KEY ("itReturnId") REFERENCES "it_return"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_26as_entry" ADD CONSTRAINT "form_26as_entry_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "form_26as_upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_filing_record" ADD CONSTRAINT "it_filing_record_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "purchase_order_business_idx" RENAME TO "purchase_order_businessId_idx";

-- RenameIndex
ALTER INDEX "purchase_order_business_ponumber_unique" RENAME TO "purchase_order_businessId_poNumber_key";

-- RenameIndex
ALTER INDEX "purchase_order_business_status_idx" RENAME TO "purchase_order_businessId_status_idx";

-- RenameIndex
ALTER INDEX "purchase_order_business_supplier_idx" RENAME TO "purchase_order_businessId_supplierId_idx";

-- RenameIndex
ALTER INDEX "purchase_order_item_po_idx" RENAME TO "purchase_order_item_poId_idx";

-- RenameIndex
ALTER INDEX "purchase_order_item_product_idx" RENAME TO "purchase_order_item_productId_idx";

-- RenameIndex
ALTER INDEX "stock_alert_biz_plu" RENAME TO "stock_alert_businessId_pluBarcode_idx";

-- RenameIndex
ALTER INDEX "stock_alert_plu_phone_unique" RENAME TO "stock_alert_pluBarcode_phone_key";

