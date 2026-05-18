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
  DAY_OPENED:      'day.opened',
  DAY_CLOSED:      'day.closed',
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
export interface DayOpenedPayload    { closureId: string; closureDate: string; branchId: string }
export interface DayClosedPayload    { closureId: string; closureDate: string; totalSales: number; cashDifference: number }
