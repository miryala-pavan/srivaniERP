export const EVENT_TYPES = {
  // Invoice
  GST_INVOICE_CREATED: 'erp.gst.invoice.created',
  GST_INVOICE_CANCELLED: 'erp.gst.invoice.cancelled',

  // Vendor / Supplier
  SUPPLIER_PAYMENT_CREATED: 'erp.supplier.payment.created',
  SUPPLIER_ADVANCE_CREATED: 'erp.supplier.advance.created',

  // Journal
  JOURNAL_POSTED: 'erp.ledger.journal.posted',
  JOURNAL_REVERSED: 'erp.ledger.journal.reversed',

  // TDS
  TDS_ENTRY_CREATED: 'erp.tds.entry.created',
  TDS_CHALLAN_FILED: 'erp.tds.challan.filed',

  // Rule Engine
  RULE_UPDATED: 'platform.rule.updated',
  RULE_OVERRIDE_SET: 'platform.rule.override.set',

  // Document
  DOCUMENT_UPLOADED: 'platform.document.uploaded',

  // AI
  AI_CORRECTION_APPLIED: 'platform.ai.correction.applied',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
