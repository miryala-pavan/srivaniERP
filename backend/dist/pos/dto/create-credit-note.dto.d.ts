export declare class CreditNoteItemDto {
    productId: string;
    quantity: number;
    unitPrice: number;
}
export declare class CreateCreditNoteDto {
    originalBillId: string;
    reason: string;
    items: CreditNoteItemDto[];
    refundMode: string;
}
