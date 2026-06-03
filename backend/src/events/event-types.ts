export const Events = {
  SHIFT_OPENED:    'shift.opened',
  SHIFT_CLOSED:    'shift.closed',
  BILL_CREATED:    'bill.created',
  BILL_VOIDED:     'bill.voided',
  GRN_CREATED:     'grn.created',
  GRN_UPDATED:     'grn.updated',
  GRN_SUBMITTED:   'grn.submitted',
  GRN_APPROVED:    'grn.approved',
  GRN_REJECTED:    'grn.rejected',
  PLU_CREATED:     'plu.created',
  PLU_UPDATED:     'plu.updated',
  PLU_ARCHIVED:    'plu.archived',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  DAY_OPENED:             'day.opened',
  DAY_CLOSED:             'day.closed',
  NOTIFICATION_CREATED:   'notification.created',
  NOTIFICATION_READ:      'notification.read',
  NOTIFICATION_READ_ALL:  'notification.read_all',
  BILL_HELD:              'bill.held',
  BILL_RETRIEVED:         'bill.retrieved',
  INVENTORY_STOCK_ADJUSTED:   'inventory.stock-adjusted',
  SUPPLIER_PAYMENT_RECORDED:  'supplier.payment-recorded',
  SUPPLIER_PAYMENT_DELETED:   'supplier.payment-deleted',
  CUSTOMER_CREATED:           'customer.created',
  CUSTOMER_UPDATED:           'customer.updated',
  CUSTOMER_PAYMENT_RECORDED:  'customer.payment-recorded',
  CUSTOMER_PAYMENT_DELETED:   'customer.payment-deleted',
  CATEGORY_CREATED:           'category.created',
  CATEGORY_UPDATED:           'category.updated',
  CATEGORY_DELETED:           'category.deleted',
  SUBCATEGORY_CREATED:        'subcategory.created',
  SUBCATEGORY_UPDATED:        'subcategory.updated',
  SUBCATEGORY_DELETED:        'subcategory.deleted',
} as const;

export type EventName = typeof Events[keyof typeof Events];

export interface ShiftOpenedPayload  { shiftId: string; cashierId: string; counterId: string; openingCash: number; startTime: string }
export interface ShiftClosedPayload  { shiftId: string; cashierId: string; counterId: string; closingCash: number; cashDiff: number; forceClose: boolean }
export interface BillCreatedPayload  { billId: string; billNumber: string; billType: string; grandTotal: number; counterId: string; cashierId: string }
export interface BillVoidedPayload   { billId: string; billNumber: string; voidedById: string; voidedByName: string }
export interface GrnCreatedPayload   { grnId: string; grnNumber: string | null; status: string; supplierId: string; totalAmount: number }
export interface GrnUpdatedPayload   { grnId: string; grnNumber: string | null; status: string }
export interface GrnSubmittedPayload { grnId: string; grnNumber: string }
export interface GrnApprovedPayload  { grnId: string; grnNumber: string; supplierId: string; totalAmount: number }
export interface GrnRejectedPayload  { grnId: string; grnNumber: string | null; supplierId: string }
export interface PluCreatedPayload   { pluId: string; productId: string; pluCode: string; sellingPrice: number }
export interface PluUpdatedPayload   { pluId: string; productId: string; pluCode: string; archivedPluId?: string }
export interface PluArchivedPayload  { pluId: string; productId: string; pluCode: string }
export interface ProductCreatedPayload { productId: string; productCode: string; name: string }
export interface ProductUpdatedPayload { productId: string; productCode: string }
export interface DayOpenedPayload             { closureId: string; closureDate: string; branchId: string }
export interface DayClosedPayload             { closureId: string; closureDate: string; totalSales: number; cashDifference: number }
export interface NotificationCreatedPayload   { notificationId: string; type: string; title: string; priority: string }
export interface NotificationReadPayload      { notificationId: string }
export interface NotificationReadAllPayload   {}
export interface BillHeldPayload             { holdBillId: string; holdNumber: string; cashierId: string; itemCount: number; total: number }
export interface BillRetrievedPayload        { holdBillId: string; holdNumber: string; retrievedByCashierId: string | null }
export interface InventoryStockAdjustedPayload  { stockTakeId: string; productCount: number; branchId: string; performedBy: string }
export interface SupplierPaymentRecordedPayload { paymentId: string; supplierId: string; amount: number; paymentDate: string }
export interface SupplierPaymentDeletedPayload  { paymentId: string; supplierId: string; amount: number }
export interface CustomerCreatedPayload         { customerId: string; customerCode: string | null; name: string }
export interface CustomerUpdatedPayload         { customerId: string; customerCode: string | null }
export interface CustomerPaymentRecordedPayload { paymentId: string; customerId: string; amount: number; paymentDate: string }
export interface CustomerPaymentDeletedPayload  { paymentId: string; customerId: string; amount: number }
