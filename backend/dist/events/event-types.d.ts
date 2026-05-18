export declare const Events: {
    readonly SHIFT_OPENED: "shift.opened";
    readonly SHIFT_CLOSED: "shift.closed";
    readonly BILL_CREATED: "bill.created";
    readonly BILL_VOIDED: "bill.voided";
    readonly GRN_CREATED: "grn.created";
    readonly GRN_UPDATED: "grn.updated";
    readonly GRN_SUBMITTED: "grn.submitted";
    readonly GRN_APPROVED: "grn.approved";
    readonly GRN_REJECTED: "grn.rejected";
    readonly PLU_CREATED: "plu.created";
    readonly PLU_UPDATED: "plu.updated";
    readonly PLU_ARCHIVED: "plu.archived";
    readonly PRODUCT_CREATED: "product.created";
    readonly PRODUCT_UPDATED: "product.updated";
    readonly DAY_OPENED: "day.opened";
    readonly DAY_CLOSED: "day.closed";
};
export type EventName = typeof Events[keyof typeof Events];
export interface ShiftOpenedPayload {
    shiftId: string;
    cashierId: string;
    counterId: string;
    openingCash: number;
    startTime: string;
}
export interface ShiftClosedPayload {
    shiftId: string;
    cashierId: string;
    counterId: string;
    closingCash: number;
    cashDiff: number;
    forceClose: boolean;
}
export interface BillCreatedPayload {
    billId: string;
    billNumber: string;
    billType: string;
    grandTotal: number;
    counterId: string;
    cashierId: string;
}
export interface BillVoidedPayload {
    billId: string;
    billNumber: string;
    voidedById: string;
    voidedByName: string;
}
export interface GrnCreatedPayload {
    grnId: string;
    grnNumber: string | null;
    status: string;
    supplierId: string;
    totalAmount: number;
}
export interface GrnUpdatedPayload {
    grnId: string;
    grnNumber: string | null;
    status: string;
}
export interface GrnSubmittedPayload {
    grnId: string;
    grnNumber: string;
}
export interface GrnApprovedPayload {
    grnId: string;
    grnNumber: string;
    supplierId: string;
    totalAmount: number;
}
export interface GrnRejectedPayload {
    grnId: string;
    grnNumber: string | null;
    supplierId: string;
}
export interface PluCreatedPayload {
    pluId: string;
    productId: string;
    pluCode: string;
    sellingPrice: number;
}
export interface PluUpdatedPayload {
    pluId: string;
    productId: string;
    pluCode: string;
    archivedPluId?: string;
}
export interface PluArchivedPayload {
    pluId: string;
    productId: string;
    pluCode: string;
}
export interface ProductCreatedPayload {
    productId: string;
    productCode: string;
    name: string;
}
export interface ProductUpdatedPayload {
    productId: string;
    productCode: string;
}
export interface DayOpenedPayload {
    closureId: string;
    closureDate: string;
    branchId: string;
}
export interface DayClosedPayload {
    closureId: string;
    closureDate: string;
    totalSales: number;
    cashDifference: number;
}
