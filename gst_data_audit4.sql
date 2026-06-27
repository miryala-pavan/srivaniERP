-- F: Product GST rate distribution
SELECT
  COALESCE("gstRatePercent"::text, 'NULL') AS gst_rate,
  COUNT(*) AS product_count
FROM product
WHERE "isActive" = true
GROUP BY "gstRatePercent"
ORDER BY product_count DESC
LIMIT 15;

-- F2: Products with NULL gstRatePercent (these will get rt=0 in bills -- wrong!)
SELECT COUNT(*) AS null_rate_products
FROM product WHERE "isActive"=true AND "gstRatePercent" IS NULL;

-- F3: Sample of products with null HSN (hsnCode NOT NULL but value = '0000' or similar placeholder)
SELECT "hsnCode", COUNT(*) AS count
FROM product
WHERE "isActive"=true
  AND "hsnCode" NOT IN ('', '0000')
  AND "hsnCode" !~ '^\d{4,8}$'
GROUP BY "hsnCode"
ORDER BY count DESC
LIMIT 10;

-- F4: How many products have hsnCode = '0000' (placeholder, will pass numeric test but invalid HSN!)
SELECT COUNT(*) AS zero_hsn_products
FROM product
WHERE "isActive"=true AND "hsnCode" = '0000';

-- F5: Sample of those zero-HSN products
SELECT name, "hsnCode", "gstRatePercent"
FROM product
WHERE "isActive"=true AND "hsnCode" = '0000'
LIMIT 10;
