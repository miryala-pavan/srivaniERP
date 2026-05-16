export declare class StockTakeItemDto {
    productId: string;
    quantity: number;
}
export declare class StockTakeDto {
    branchId: string;
    sessionName?: string;
    items: StockTakeItemDto[];
}
