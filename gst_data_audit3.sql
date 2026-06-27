-- Deep dive into the two real issues found

-- A: Bill CGST/SGST mismatch -- look at each item in that bill
SELECT si."productName", si."hsnCode", si."gstRatePercent",
  si."taxableAmount", si."cgstAmount", si."sgstAmount",
  (si."cgstAmount" - si."sgstAmount") AS diff
FROM sales_item si
WHERE si."billId" = 'cmq894lmg00055w1l0kxewiob'
ORDER BY si."cgstAmount" DESC;

-- B: What are the bill totals vs item sums for that bill?
SELECT
  sb."cgstTotal" AS bill_cgst,
  sb."sgstTotal" AS bill_sgst,
  SUM(si."cgstAmount") AS sum_item_cgst,
  SUM(si."sgstAmount") AS sum_item_sgst,
  (sb."cgstTotal" - SUM(si."cgstAmount")) AS bill_vs_item_cgst_diff
FROM sales_bill sb
JOIN sales_item si ON si."billId" = sb.id
WHERE sb.id = 'cmq894lmg00055w1l0kxewiob'
GROUP BY sb.id, sb."cgstTotal", sb."sgstTotal";

-- C: Pragathi Enterprises -- check if they are actually registered
-- (search supplier master for any GSTIN stored there)
SELECT s.name, s."gstin", s."phone", s."email"
FROM supplier s
WHERE LOWER(s.name) LIKE '%pragathi%';

-- D: Product HSN code distribution -- what values exist?
SELECT
  CASE
    WHEN "hsnCode" IS NULL THEN 'NULL'
    WHEN "hsnCode" = '' THEN 'EMPTY'
    WHEN "hsnCode" ~ '^\d{4,8}$' THEN 'VALID_NUMERIC'
    ELSE 'OTHER: ' || LEFT("hsnCode", 20)
  END AS hsn_category,
  COUNT(*) AS product_count
FROM product
WHERE "isActive" = true
GROUP BY hsn_category
ORDER BY product_count DESC;

-- E: Sample of products with non-standard HSN codes
SELECT id, name, "hsnCode", "gstRate"
FROM product
WHERE "isActive" = true
  AND "hsnCode" IS NOT NULL
  AND "hsnCode" != ''
  AND "hsnCode" !~ '^\d{4,8}$'
LIMIT 15;

-- F: How many active products have 0 gstRate?
SELECT
  COUNT(*) FILTER (WHERE COALESCE("gstRate",0) = 0) AS zero_rate_products,
  COUNT(*) FILTER (WHERE "gstRate" = 5) AS rate_5,
  COUNT(*) FILTER (WHERE "gstRate" = 12) AS rate_12,
  COUNT(*) FILTER (WHERE "gstRate" = 18) AS rate_18,
  COUNT(*) FILTER (WHERE "gstRate" = 28) AS rate_28,
  COUNT(*) AS total_active
FROM product
WHERE "isActive" = true;

-- G: Check if there are purchases from Pragathi across other months
SELECT "grnNumber", "invoiceDate"::date, "supplierName", "supplierGstin",
  "taxableAmount", "cgstTotal", "sgstTotal", "igstTotal",
  "itcEligibility", status
FROM purchase
WHERE LOWER("supplierName") LIKE '%pragathi%'
ORDER BY "invoiceDate" DESC;
