-- ─── Purchase Orders migration ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_order (
  id              TEXT        NOT NULL PRIMARY KEY,
  "businessId"    TEXT        NOT NULL,
  "poNumber"      TEXT        NOT NULL,
  "supplierId"    TEXT        NOT NULL,
  "supplierName"  TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'DRAFT',
  source          TEXT        NOT NULL DEFAULT 'MANUAL',
  "expectedDate"  TIMESTAMP(3),
  "sentAt"        TIMESTAMP(3),
  "sentVia"       TEXT,
  notes           TEXT,
  "createdById"   TEXT,
  "createdByName" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT purchase_order_business_ponumber_unique UNIQUE ("businessId", "poNumber"),
  CONSTRAINT purchase_order_businessId_fkey FOREIGN KEY ("businessId") REFERENCES "Business"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT purchase_order_supplierId_fkey FOREIGN KEY ("supplierId") REFERENCES "Supplier"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS purchase_order_businessId_idx     ON purchase_order ("businessId");
CREATE INDEX IF NOT EXISTS purchase_order_businessId_status  ON purchase_order ("businessId", status);
CREATE INDEX IF NOT EXISTS purchase_order_businessId_supplier ON purchase_order ("businessId", "supplierId");

CREATE TABLE IF NOT EXISTS purchase_order_item (
  id            TEXT        NOT NULL PRIMARY KEY,
  "poId"        TEXT        NOT NULL,
  "productId"   TEXT        NOT NULL,
  "productName" TEXT        NOT NULL,
  "pluCode"     TEXT,
  "qtyOrdered"  DECIMAL(15,3) NOT NULL,
  "qtyReceived" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "unitCost"    DECIMAL(15,2),
  notes         TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT purchase_order_item_poId_fkey      FOREIGN KEY ("poId")      REFERENCES purchase_order(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT purchase_order_item_productId_fkey FOREIGN KEY ("productId") REFERENCES "Product"(id)       ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS purchase_order_item_poId_idx      ON purchase_order_item ("poId");
CREATE INDEX IF NOT EXISTS purchase_order_item_productId_idx ON purchase_order_item ("productId");

SELECT 'purchase_orders_v1 migration complete' AS status;
