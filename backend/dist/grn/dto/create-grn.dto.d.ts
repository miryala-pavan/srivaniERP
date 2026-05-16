import { GrnItemDto } from './grn-item.dto';
export declare class CreateGrnDto {
    supplierId: string;
    branchId: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceControlTotal?: number;
    taxType: string;
    itcEligibility?: string;
    rcmApplicable?: boolean;
    documentType?: string;
    placeOfSupply?: string;
    poNumber?: string;
    items: GrnItemDto[];
    billDiscountPercent?: number;
    cashDiscountPercent?: number;
    freightCharges?: number;
    hamaliCharges?: number;
    otherCharges?: number;
    roundingAmount?: number;
    advanceAdjusted?: number;
    paymentDueDate?: string;
    paymentMode?: string;
    paymentReference?: string;
    paymentNotes?: string;
    receivedDate?: string;
    notes?: string;
    isDraft?: boolean;
}
