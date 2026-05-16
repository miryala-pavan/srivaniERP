export declare enum AdjustmentType {
    DAMAGE = "DAMAGE",
    LOSS = "LOSS",
    FOUND = "FOUND",
    EXPIRY = "EXPIRY",
    RECOUNT = "RECOUNT"
}
export declare class AdjustStockDto {
    productId: string;
    branchId: string;
    adjustedQuantity: number;
    reason?: string;
    type?: AdjustmentType;
}
