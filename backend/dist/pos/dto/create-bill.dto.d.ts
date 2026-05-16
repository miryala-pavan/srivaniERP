import { BillItemDto } from './bill-item.dto';
export declare enum PaymentModeEnum {
    CASH = "CASH",
    UPI = "UPI",
    CARD = "CARD",
    CHEQUE = "CHEQUE",
    SPLIT = "SPLIT"
}
export declare class CreateBillDto {
    shiftId: string;
    counterId: string;
    paymentMode: PaymentModeEnum;
    cashAmount?: number;
    upiAmount?: number;
    cardAmount?: number;
    paidAmount?: number;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerGstin?: string;
    supplyStateCode?: string;
    billType?: string;
    estimateValidityDays?: number;
    notes?: string;
    items: BillItemDto[];
}
