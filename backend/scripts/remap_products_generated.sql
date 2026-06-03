BEGIN;

-- RUCHI SOYA CHUNKS 200G → FOOD_01_04 Soya Products
UPDATE product SET "categoryId"='cmpierxxsow392DKZmBLMgw', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp04lu01000q13kfevzrttza';
-- RUCHI SOYA GRANULES 1KG → FOOD_01_04 Soya Products
UPDATE product SET "categoryId"='cmpierxxsow392DKZmBLMgw', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp04i53o000l13kfuhd1wc8x';

-- Gold Drop 1ltr → FOOD_03_05 Refined / Palm Oil
UPDATE product SET "categoryId"='cmpierxxsWiNCM9trTsFrRw', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmonz56my005j12mdghmgrxwq';

-- RUCHI MUSTARD OIL 450ML → FOOD_03_03 Mustard Oil
UPDATE product SET "categoryId"='cmpierxxsB93fR8AZocQ6bA', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp04esoi000g13kfto0cx14p';
-- RUCHI MUSTARD OIL 830ML → FOOD_03_03 Mustard Oil
UPDATE product SET "categoryId"='cmpierxxsB93fR8AZocQ6bA', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp04b462000b13kf6so6e4qc';
-- Ruchi Mustard OIL 450ML (duplicate entry) → FOOD_03_03 Mustard Oil
UPDATE product SET "categoryId"='cmpierxxsB93fR8AZocQ6bA', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp5azwa80008klsfrwob8ddx';

-- Sunflower Oil 1L → FOOD_03_01 Sunflower Oil
UPDATE product SET "categoryId"='cmpierxxsRaX64oKz-F5v0w', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmonyv3ax004w12mdphs0j89j';

-- Three Mango Chilli Powder 500g → FOOD_04_02 Powdered Spices
UPDATE product SET "categoryId"='cmpierxxsPC-U5tS-rmNnlA', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmpb2tjr9000432e9d1539q7o';

-- Amul Full Cream Milk 500ml → FOOD_07_01 Milk
UPDATE product SET "categoryId"='cmpierxxsCK_lURXo0F8Itw', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmonyv3bg005412mdnlh0paqm';

-- Lays Classic Salted 26g → FOOD_10_01 Chips & Wafers
UPDATE product SET "categoryId"='cmpierxxskYDZU8prkwAMrA', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmonyv3bp005812md4140psg2';

-- Sunfeast Mom's Magic 10/- → FOOD_11_03 Cookies
UPDATE product SET "categoryId"='cmpierxxsOuJCZkFVv0qgew', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp9wb0t3000iytnow683wlpd';
-- Sunfeast Mom's Magic 5/- X 12 → FOOD_11_03 Cookies
UPDATE product SET "categoryId"='cmpierxxsOuJCZkFVv0qgew', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp9w7zed0009ytnopx516vlh';

-- Yippee Noodles 90/- → FOOD_12_01 Instant Noodles
UPDATE product SET "categoryId"='cmpierxxso3_jUo_h2_Lw9g', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmp9wnxor000rytnoquct5x5b';

-- Tata Salt 1kg → FOOD_22_01 Salt
UPDATE product SET "categoryId"='cmpierxxscYVGxORQQHi89A', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmonyv3b8005012mdywbgr2uv';

-- SABENA DISH WASH POWDER 900G → HOMECARE_02_03 Dishwash Powder
UPDATE product SET "categoryId"='cmpierxxtmujTPbj7M9-JvQ', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmozxc8fo000413kfhttz5rgf';

-- Mangaldeep 3 In 1 Agarbathi → HOMECARE_10_01 Agarbatti & Incense
UPDATE product SET "categoryId"='cmpierxxta6j2tHJjeMpLUg', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmpcgn219000bf0y7vxb5ln4a';
-- Mangaldeep Sadhvi Agarbathi → HOMECARE_10_01 Agarbatti & Incense
UPDATE product SET "categoryId"='cmpierxxta6j2tHJjeMpLUg', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmpcgq23i000kf0y7b3wvcnm4';

-- Colgate MaxFresh 150g → PERSONAL_04_01 Toothpaste
UPDATE product SET "categoryId"='cmpierxxt1ISKVWi33K_AuA', "updatedAt"='2026-05-23T14:00:28.390Z' WHERE id='cmonyv3bx005c12md2wn5c4cw';

COMMIT;
