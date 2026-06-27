-- Issue 1: Find the bill with CGST != SGST
SELECT id, "billNumber", "billDate"::date,
  "taxableAmount", "cgstTotal", "sgstTotal",
  ("cgstTotal" - "sgstTotal") AS diff,
  "grandTotal", "billType"
FROM sales_bill
WHERE status='FINAL' AND "isVoided"=false
  AND ABS(COALESCE("cgstTotal",0) - COALESCE("sgstTotal",0)) > 0.02
  AND COALESCE("supplyStateCode",'36') = '36';

-- Issue 2: Find the purchase with ITC claimed but no supplier GSTIN
SELECT id, "grnNumber", "invoiceDate"::date, "supplierName",
  COALESCE("supplierGstin",'NULL') AS supplier_gstin,
  "itcEligibility",
  "taxableAmount",
  "cgstTotal", "sgstTotal", "igstTotal",
  ("cgstTotal" + "sgstTotal" + "igstTotal") AS total_itc_at_risk
FROM purchase
WHERE status='APPROVED'
  AND COALESCE("itcEligibility",'ELIGIBLE') != 'NOT_ELIGIBLE'
  AND ("supplierGstin" IS NULL OR "supplierGstin" = '');

-- Total bills in the database (understand scale)
SELECT
  COUNT(*) AS total_bills,
  COUNT(*) FILTER (WHERE status='FINAL' AND "isVoided"=false) AS live_final_bills,
  COUNT(*) FILTER (WHERE status='FINAL' AND "isVoided"=true) AS voided_bills,
  COUNT(*) FILTER (WHERE "billDate" > NOW() - INTERVAL '3 months') AS last_3_months,
  MIN("billDate")::date AS earliest_bill,
  MAX("billDate")::date AS latest_bill
FROM sales_bill;

-- Total purchases
SELECT
  COUNT(*) AS total_purchases,
  COUNT(*) FILTER (WHERE status='APPROVED') AS approved,
  COUNT(*) FILTER (WHERE status='APPROVED' AND "itcEligibility" != 'NOT_ELIGIBLE') AS itc_eligible
FROM purchase;

-- Products with zero or null HSN across all time (not just last 6 months)
SELECT COUNT(DISTINCT p.id) AS products_without_hsn,
  COUNT(DISTINCT p.id) FILTER (WHERE p."hsnCode" IS NULL) AS null_hsn,
  COUNT(DISTINCT p.id) FILTER (WHERE p."hsnCode" = '') AS empty_hsn
FROM product p
WHERE p."isActive" = true;

-- Item-level CGST vs SGST discrepancy details (find the specific items)
SELECT si."productName", sb."billNumber", sb."billDate"::date,
  si."gstRatePercent", si."taxableAmount",
  si."cgstAmount", si."sgstAmount",
  (si."cgstAmount" - si."sgstAmount") AS diff
FROM sales_item si
JOIN sales_bill sb ON sb.id = si."billId"
WHERE sb.status='FINAL' AND sb."isVoided"=false
  AND COALESCE(sb."supplyStateCode",'36') = '36'
  AND ABS(COALESCE(si."cgstAmount",0) - COALESCE(si."sgstAmount",0)) > 0.01
ORDER BY ABS(si."cgstAmount" - si."sgstAmount") DESC
LIMIT 10;
