-- ============================================================
-- GST DATA QUALITY AUDIT -- Srivani Stores Live DB
-- Thinking as: data analyst checking what will break at filing
-- ============================================================

-- 1. Bills where CGST != SGST on intra-state (they MUST be equal)
SELECT '1_CGST_NEQ_SGST' AS check_id, COUNT(*) AS issue_count,
  MAX(ABS(sb."cgstTotal" - sb."sgstTotal")) AS max_diff_rs
FROM sales_bill sb
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billType" IN ('TAX_INVOICE','RETAIL_INVOICE')
  AND ABS(COALESCE(sb."cgstTotal",0) - COALESCE(sb."sgstTotal",0)) > 0.02
  AND COALESCE(sb."supplyStateCode",'36') = '36';

-- 2. Bills where BOTH cgstTotal>0 AND igstTotal>0 (impossible combination)
SELECT '2_BOTH_CGST_AND_IGST' AS check_id, COUNT(*) AS issue_count
FROM sales_bill sb
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billType" IN ('TAX_INVOICE','RETAIL_INVOICE')
  AND COALESCE(sb."cgstTotal",0) > 0
  AND COALESCE(sb."igstTotal",0) > 0;

-- 3. Bills where grandTotal != taxableAmount + all taxes (more than Rs 1 diff)
SELECT '3_GRAND_TOTAL_MISMATCH' AS check_id, COUNT(*) AS issue_count,
  MAX(ABS(sb."grandTotal" - (COALESCE(sb."taxableAmount",0)
    + COALESCE(sb."cgstTotal",0) + COALESCE(sb."sgstTotal",0)
    + COALESCE(sb."igstTotal",0)))) AS max_diff_rs
FROM sales_bill sb
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billType" IN ('TAX_INVOICE','RETAIL_INVOICE')
  AND ABS(sb."grandTotal" - (COALESCE(sb."taxableAmount",0)
    + COALESCE(sb."cgstTotal",0) + COALESCE(sb."sgstTotal",0)
    + COALESCE(sb."igstTotal",0))) > 1.00;

-- 4. Bills with billNumber longer than 16 chars (portal hard-rejects these)
SELECT '4_BILLNUMBER_TOO_LONG' AS check_id,
  COUNT(*) AS issue_count,
  MAX(LENGTH("billNumber")) AS max_length,
  (SELECT "billNumber" FROM sales_bill WHERE LENGTH("billNumber")>16 LIMIT 1) AS sample
FROM sales_bill
WHERE status='FINAL' AND "billNumber" IS NOT NULL AND LENGTH("billNumber") > 16;

-- 5. B2B bills with customer GSTIN in invalid format
SELECT '5_INVALID_CUSTOMER_GSTIN' AS check_id, COUNT(*) AS issue_count,
  (SELECT "customerGstin" FROM sales_bill
   WHERE status='FINAL' AND "isVoided"=false
     AND "customerGstin" IS NOT NULL AND "customerGstin" != ''
     AND "customerGstin" !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$'
   LIMIT 1) AS sample_bad_gstin
FROM sales_bill sb
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."customerGstin" IS NOT NULL AND sb."customerGstin" != ''
  AND sb."customerGstin" !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$';

-- 6. Products sold with non-numeric HSN (portal rejects non-4-to-8-digit codes)
SELECT '6_NON_NUMERIC_HSN_PRODUCTS' AS check_id,
  COUNT(DISTINCT si."productName") AS product_count,
  COUNT(DISTINCT CASE WHEN si."hsnCode" IS NULL THEN si."productName" END) AS null_hsn_count
FROM sales_item si
JOIN sales_bill sb ON sb.id = si."billId"
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billDate" > NOW() - INTERVAL '6 months'
  AND (si."hsnCode" IS NULL OR si."hsnCode" = ''
       OR si."hsnCode" !~ '^\d{4,8}$');

-- 6b. Sample of which products have bad HSN (last 6 months)
SELECT DISTINCT si."productName", COALESCE(si."hsnCode",'NULL') AS hsn_code, COUNT(*) AS times_sold
FROM sales_item si
JOIN sales_bill sb ON sb.id = si."billId"
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billDate" > NOW() - INTERVAL '6 months'
  AND (si."hsnCode" IS NULL OR si."hsnCode" = ''
       OR si."hsnCode" !~ '^\d{4,8}$')
GROUP BY si."productName", si."hsnCode"
ORDER BY times_sold DESC
LIMIT 20;

-- 7. Non-standard GST rates in recent bills (valid slabs only)
SELECT '7_NONSTANDARD_RATE' AS check_id,
  si."gstRatePercent"::text AS rate,
  COUNT(DISTINCT sb.id) AS bill_count
FROM sales_item si
JOIN sales_bill sb ON sb.id = si."billId"
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billDate" > NOW() - INTERVAL '6 months'
  AND si."gstRatePercent" NOT IN (0, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28)
GROUP BY si."gstRatePercent"
ORDER BY bill_count DESC;

-- 8. Item-level: cgstAmount != sgstAmount for intra-state items
SELECT '8_ITEM_CGST_NEQ_SGST' AS check_id, COUNT(*) AS issue_count
FROM sales_item si
JOIN sales_bill sb ON sb.id = si."billId"
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND COALESCE(sb."supplyStateCode",'36') = '36'
  AND ABS(COALESCE(si."cgstAmount",0) - COALESCE(si."sgstAmount",0)) > 0.02;

-- 9. Eligible ITC purchases without supplier GSTIN (ITC claim invalid without GSTIN)
SELECT '9_ITC_NO_SUPPLIER_GSTIN' AS check_id, COUNT(*) AS issue_count,
  SUM(COALESCE("cgstTotal",0) + COALESCE("sgstTotal",0) + COALESCE("igstTotal",0)) AS itc_at_risk_rs
FROM purchase
WHERE status='APPROVED'
  AND COALESCE("itcEligibility",'ELIGIBLE') != 'NOT_ELIGIBLE'
  AND ("supplierGstin" IS NULL OR "supplierGstin" = '');

-- 10. Bills with NULL supplyStateCode (inter/intra classification will fail)
SELECT '10_NULL_STATE_CODE_BILLS' AS check_id, COUNT(*) AS issue_count
FROM sales_bill
WHERE status='FINAL' AND "isVoided"=false
  AND "supplyStateCode" IS NULL
  AND "billType" IN ('TAX_INVOICE','RETAIL_INVOICE');

-- 11. Duplicate billNumbers in same business (portal rejects duplicate invoice numbers)
SELECT '11_DUPLICATE_BILLNUMBER' AS check_id, COUNT(*) AS duplicate_pairs
FROM (
  SELECT "businessId", "billNumber", COUNT(*) AS cnt
  FROM sales_bill
  WHERE status='FINAL' AND "billNumber" IS NOT NULL
  GROUP BY "businessId", "billNumber"
  HAVING COUNT(*) > 1
) t;

-- 12. Voided bills WITHOUT voidedAt date (silently dropped from all GST output)
SELECT '12_VOID_WITHOUT_VOIDEDDAT' AS check_id, COUNT(*) AS issue_count
FROM sales_bill
WHERE "isVoided"=true AND "voidedAt" IS NULL AND status='FINAL';

-- 13. Sales item where totalAmount != taxableAmount + all taxes
SELECT '13_ITEM_TOTAL_WRONG' AS check_id, COUNT(*) AS issue_count,
  MAX(ABS(si."totalAmount" - (si."taxableAmount" + si."cgstAmount" + si."sgstAmount" + si."igstAmount" + si."cessAmount"))) AS max_diff
FROM sales_item si
JOIN sales_bill sb ON sb.id = si."billId"
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billDate" > NOW() - INTERVAL '6 months'
  AND ABS(si."totalAmount" - (si."taxableAmount" + si."cgstAmount" + si."sgstAmount" + si."igstAmount" + si."cessAmount")) > 0.50;

-- 14. Business GSTIN + stateCode validity
SELECT
  name,
  COALESCE(gstin,'[MISSING]') AS gstin,
  CASE
    WHEN gstin IS NULL OR gstin='' THEN 'MISSING'
    WHEN gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$' THEN 'INVALID_FORMAT'
    ELSE 'OK'
  END AS gstin_status,
  COALESCE("stateCode",'[MISSING]') AS state_code,
  CASE WHEN "stateCode" IS NULL OR "stateCode"='' THEN 'MISSING' ELSE 'OK' END AS state_status
FROM business;

-- 15. Recent months tax totals vs item-level tax totals (should match)
SELECT '15_BILL_VS_ITEM_TAX_RECONCILE' AS check_id,
  TO_CHAR(DATE_TRUNC('month', sb."billDate"),'Mon YYYY') AS month,
  ROUND(SUM(sb."cgstTotal"),2) AS bill_cgst_total,
  ROUND(SUM(si_sum."item_cgst"),2) AS item_cgst_total,
  ROUND(ABS(SUM(sb."cgstTotal") - SUM(si_sum."item_cgst")),2) AS diff
FROM sales_bill sb
JOIN (
  SELECT "billId",
    SUM("cgstAmount") AS item_cgst
  FROM sales_item
  GROUP BY "billId"
) si_sum ON si_sum."billId" = sb.id
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND sb."billDate" > NOW() - INTERVAL '6 months'
  AND sb."billType" IN ('TAX_INVOICE','RETAIL_INVOICE')
GROUP BY DATE_TRUNC('month', sb."billDate")
ORDER BY DATE_TRUNC('month', sb."billDate");

-- 16. How many bills have cess? (check if cessTotal is ever non-zero)
SELECT '16_CESS_CHECK' AS check_id,
  COUNT(*) FILTER (WHERE "cessTotal" > 0) AS bills_with_cess,
  COUNT(*) AS total_bills,
  ROUND(MAX("cessTotal"),2) AS max_cess
FROM sales_bill
WHERE status='FINAL' AND "isVoided"=false
  AND "billDate" > NOW() - INTERVAL '6 months';

-- 17. Purchases: invoice date vs GRN date gaps (ITC claimed in wrong month?)
SELECT '17_PURCHASE_DATE_GAP' AS check_id,
  COUNT(*) AS large_gap_count
FROM purchase
WHERE status='APPROVED'
  AND "approvedAt" IS NOT NULL
  AND ABS(EXTRACT(DAY FROM ("approvedAt" - "invoiceDate"))) > 90;
