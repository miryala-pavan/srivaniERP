-- Sales side for complete picture
SELECT
  COUNT(*)                                          AS total_bills,
  ROUND(SUM("taxableAmount"),2)                    AS sales_taxable,
  ROUND(SUM("cgstTotal"),2)                        AS sales_cgst,
  ROUND(SUM("sgstTotal"),2)                        AS sales_sgst,
  ROUND(SUM("igstTotal"),2)                        AS sales_igst,
  ROUND(SUM("cgstTotal"+"sgstTotal"+"igstTotal"),2) AS total_output_gst,
  ROUND(SUM("grandTotal"),2)                       AS total_revenue
FROM sales_bill
WHERE status='FINAL' AND "isVoided"=false;

-- Monthly sales
SELECT
  TO_CHAR(DATE_TRUNC('month',"billDate"),'Mon YYYY') AS month,
  COUNT(*)                                            AS bills,
  ROUND(SUM("taxableAmount"),2)                      AS taxable,
  ROUND(SUM("cgstTotal"+"sgstTotal"+"igstTotal"),2)  AS output_gst,
  ROUND(SUM("grandTotal"),2)                         AS revenue
FROM sales_bill
WHERE status='FINAL' AND "isVoided"=false
GROUP BY DATE_TRUNC('month',"billDate")
ORDER BY DATE_TRUNC('month',"billDate");

-- Gross profit estimate (revenue taxable - purchase taxable = gross profit on goods)
SELECT
  ROUND((SELECT SUM("taxableAmount") FROM sales_bill WHERE status='FINAL' AND "isVoided"=false),2) AS sales_taxable,
  ROUND((SELECT SUM("taxableAmount") FROM purchase WHERE status='APPROVED'),2)                     AS purchase_taxable,
  ROUND(
    (SELECT SUM("taxableAmount") FROM sales_bill WHERE status='FINAL' AND "isVoided"=false) -
    (SELECT SUM("taxableAmount") FROM purchase WHERE status='APPROVED'),
    2
  ) AS gross_profit_on_goods,
  ROUND(
    100.0 * (
      (SELECT SUM("taxableAmount") FROM sales_bill WHERE status='FINAL' AND "isVoided"=false) -
      (SELECT SUM("taxableAmount") FROM purchase WHERE status='APPROVED')
    ) /
    NULLIF((SELECT SUM("taxableAmount") FROM purchase WHERE status='APPROVED'), 0),
    2
  ) AS margin_pct;

-- ITC vs output tax (net GST position)
SELECT
  ROUND((SELECT SUM("cgstTotal"+"sgstTotal"+"igstTotal") FROM sales_bill WHERE status='FINAL' AND "isVoided"=false),2) AS output_tax,
  ROUND((SELECT SUM("cgstTotal"+"sgstTotal"+"igstTotal") FROM purchase WHERE status='APPROVED' AND "itcEligibility"!='NOT_ELIGIBLE'),2) AS itc_available,
  ROUND(
    (SELECT SUM("cgstTotal"+"sgstTotal"+"igstTotal") FROM sales_bill WHERE status='FINAL' AND "isVoided"=false) -
    (SELECT SUM("cgstTotal"+"sgstTotal"+"igstTotal") FROM purchase WHERE status='APPROVED' AND "itcEligibility"!='NOT_ELIGIBLE'),
    2
  ) AS net_gst_payable;

-- Annualised run rate (based on Jun 2026 as full month)
SELECT
  ROUND(SUM("grandTotal") * 12, 2) AS annualised_purchase,
  ROUND(SUM("taxableAmount") * 12, 2) AS annualised_taxable_purchase
FROM purchase
WHERE status='APPROVED'
  AND DATE_TRUNC('month',"invoiceDate") = '2026-06-01';
