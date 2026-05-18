SELECT s.name,
       s."openingBalance",
       COUNT(p.id)          AS grn_count,
       SUM(p."grandTotal")  AS total_grns,
       COUNT(sp.id)         AS payment_count,
       SUM(sp.amount)       AS total_paid
FROM   supplier s
LEFT   JOIN purchase p
         ON p."supplierId" = s.id
        AND p.status = 'APPROVED'
LEFT   JOIN supplier_payment sp
         ON sp."supplierId" = s.id
WHERE  s."businessId" = (SELECT id FROM business LIMIT 1)
GROUP  BY s.id, s.name, s."openingBalance"
ORDER  BY s.name;
