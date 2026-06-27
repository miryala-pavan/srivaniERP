-- ============================================================
-- PURCHASE ECONOMICS ANALYSIS — Srivani Stores
-- ============================================================

-- 1. Overall totals
SELECT
  COUNT(*)                                          AS total_grns,
  COUNT(*) FILTER (WHERE "supplierGstin" IS NOT NULL AND "supplierGstin" != '')  AS registered_grns,
  COUNT(*) FILTER (WHERE "supplierGstin" IS NULL OR "supplierGstin" = '')        AS unregistered_grns,
  ROUND(SUM("taxableAmount"),2)                    AS total_taxable,
  ROUND(SUM("cgstTotal" + "sgstTotal" + "igstTotal"),2) AS total_gst_paid_on_purchase,
  ROUND(SUM("grandTotal"),2)                       AS total_cash_out,
  ROUND(SUM(CASE WHEN "itcEligibility" != 'NOT_ELIGIBLE'
                 THEN "cgstTotal" + "sgstTotal" + "igstTotal" ELSE 0 END),2) AS itc_claimed,
  ROUND(SUM(CASE WHEN "itcEligibility" = 'NOT_ELIGIBLE'
                 THEN "cgstTotal" + "sgstTotal" + "igstTotal" ELSE 0 END),2) AS itc_lost
FROM purchase
WHERE status = 'APPROVED';

-- 2. Month-wise breakdown
SELECT
  TO_CHAR(DATE_TRUNC('month',"invoiceDate"),'Mon YYYY') AS month,
  COUNT(*)                                              AS grns,
  ROUND(SUM("taxableAmount"),2)                        AS taxable,
  ROUND(SUM("cgstTotal"),2)                            AS cgst,
  ROUND(SUM("sgstTotal"),2)                            AS sgst,
  ROUND(SUM("igstTotal"),2)                            AS igst,
  ROUND(SUM("cgstTotal"+"sgstTotal"+"igstTotal"),2)    AS total_gst,
  ROUND(SUM("grandTotal"),2)                           AS total_paid,
  ROUND(SUM(CASE WHEN "itcEligibility"!='NOT_ELIGIBLE'
                 THEN "cgstTotal"+"sgstTotal"+"igstTotal" ELSE 0 END),2) AS itc_eligible
FROM purchase
WHERE status='APPROVED'
GROUP BY DATE_TRUNC('month',"invoiceDate")
ORDER BY DATE_TRUNC('month',"invoiceDate");

-- 3. Registered vs Unregistered supplier split
SELECT
  CASE WHEN "supplierGstin" IS NOT NULL AND "supplierGstin"!=''
       THEN 'Registered' ELSE 'Unregistered' END       AS supplier_type,
  COUNT(*)                                              AS grns,
  ROUND(SUM("taxableAmount"),2)                        AS taxable_value,
  ROUND(SUM("cgstTotal"+"sgstTotal"+"igstTotal"),2)    AS gst_on_purchase,
  ROUND(SUM("grandTotal"),2)                           AS total_paid,
  ROUND(AVG("grandTotal"),2)                           AS avg_grn_value
FROM purchase
WHERE status='APPROVED'
GROUP BY CASE WHEN "supplierGstin" IS NOT NULL AND "supplierGstin"!=''
              THEN 'Registered' ELSE 'Unregistered' END;

-- 4. Top suppliers by spend
SELECT
  "supplierName",
  CASE WHEN "supplierGstin" IS NOT NULL AND "supplierGstin"!=''
       THEN "supplierGstin" ELSE '(unregistered)' END  AS gstin,
  COUNT(*)                                              AS grns,
  ROUND(SUM("taxableAmount"),2)                        AS taxable,
  ROUND(SUM("cgstTotal"+"sgstTotal"+"igstTotal"),2)    AS gst_paid,
  ROUND(SUM("grandTotal"),2)                           AS total_spend
FROM purchase
WHERE status='APPROVED'
GROUP BY "supplierName","supplierGstin"
ORDER BY SUM("grandTotal") DESC
LIMIT 20;

-- 5. GST rate-wise breakdown (from purchase items)
SELECT
  pi."gstRatePercent"                               AS gst_rate,
  COUNT(DISTINCT p.id)                              AS grns,
  ROUND(SUM(pi."taxableAmount"),2)                  AS taxable,
  ROUND(SUM(pi."cgstAmount"+pi."sgstAmount"+pi."igstAmount"),2) AS gst_paid
FROM purchase_item pi
JOIN purchase p ON p.id = pi."purchaseId"
WHERE p.status='APPROVED'
GROUP BY pi."gstRatePercent"
ORDER BY gst_paid DESC;

-- 6. Paid vs outstanding
SELECT
  ROUND(SUM("grandTotal"),2)                        AS total_purchases,
  ROUND(SUM(COALESCE("paidAmount",0)),2)            AS total_paid,
  ROUND(SUM("grandTotal") - SUM(COALESCE("paidAmount",0)),2) AS outstanding_payable
FROM purchase
WHERE status='APPROVED';

-- 7. ITC eligibility breakdown
SELECT
  COALESCE("itcEligibility",'ELIGIBLE')             AS eligibility,
  COUNT(*)                                           AS grns,
  ROUND(SUM("taxableAmount"),2)                     AS taxable,
  ROUND(SUM("cgstTotal"+"sgstTotal"+"igstTotal"),2) AS gst_amount
FROM purchase
WHERE status='APPROVED'
GROUP BY "itcEligibility"
ORDER BY gst_amount DESC;
