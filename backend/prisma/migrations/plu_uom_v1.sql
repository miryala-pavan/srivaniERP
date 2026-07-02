-- Phase 1 UOM fields on product_plu
-- measureType: WEIGHT | VOLUME | COUNT
ALTER TABLE product_plu ADD COLUMN IF NOT EXISTS "measureType" TEXT;
-- unitSymbol: kg | g | L | ml | pcs | nos | ctn | box | doz | btl | bag | pkt
ALTER TABLE product_plu ADD COLUMN IF NOT EXISTS "unitSymbol" TEXT;
-- unitSize: pack size in the chosen unit (e.g. 50 for 50kg, 500 for 500g)
ALTER TABLE product_plu ADD COLUMN IF NOT EXISTS "unitSize" DECIMAL(10,3);
-- baseUnitQty: always grams (WEIGHT), ml (VOLUME), or count (COUNT) for fast math
ALTER TABLE product_plu ADD COLUMN IF NOT EXISTS "baseUnitQty" DECIMAL(15,3);
-- gstUqc: GST UQC code per Legal Metrology / GSTN
ALTER TABLE product_plu ADD COLUMN IF NOT EXISTS "gstUqc" TEXT;
-- isLoose: marks a PLU as a counter loose-weigh item (Phase 2)
ALTER TABLE product_plu ADD COLUMN IF NOT EXISTS "isLoose" BOOLEAN NOT NULL DEFAULT false;
