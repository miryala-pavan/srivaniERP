export declare class BillItemDto {
    productId: string;
    taxId: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    isPriceOverridden?: boolean;
    originalPrice?: number;
    overrideReason?: string;
}
