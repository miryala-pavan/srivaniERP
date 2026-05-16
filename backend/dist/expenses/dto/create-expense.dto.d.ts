export declare enum ExpensePaymentMode {
    CASH = "CASH",
    UPI = "UPI",
    CARD = "CARD",
    CHEQUE = "CHEQUE",
    BANK = "BANK"
}
export declare class CreateExpenseDto {
    expenseDate?: string;
    category: string;
    amount: number;
    paymentMode?: ExpensePaymentMode;
    vendorName?: string;
    referenceNo?: string;
    description?: string;
    remarks?: string;
    branchId?: string;
}
