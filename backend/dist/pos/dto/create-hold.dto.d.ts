export declare class HoldItemDto {
    productId: string;
    taxId: string;
    productName: string;
    name?: string;
    barcode?: string;
    mrp?: number;
    unitOfMeasure?: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    gstRatePercent: number;
    totalAmount: number;
}
export declare class CreateHoldDto {
    billType?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerGstin?: string;
    isB2B?: boolean;
    items: HoldItemDto[];
    subtotal: number;
    grandTotal: number;
    itemCount: number;
    counterName?: string;
}
