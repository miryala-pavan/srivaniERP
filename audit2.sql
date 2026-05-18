SELECT s.name, s."outstandingBalance" FROM supplier s WHERE s."businessId" = (SELECT id FROM business LIMIT 1) ORDER BY s.name;
