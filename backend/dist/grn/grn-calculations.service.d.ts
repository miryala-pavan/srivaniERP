import { GrnItemDto } from './dto/grn-item.dto';
export interface ItemCalcResult {
    netCostPrice: number;
    totalReceivedQty: number;
    totalFreeQty: number;
    totalQty: number;
    taxable: number;
    cashDiscAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    lineTotal: number;
    hamaliShare: number;
    freightShare: number;
    trueCostPrice: number;
}
export interface BillTotals {
    taxableTotal: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    cessTotal: number;
    totalTaxAmount: number;
    billDiscountAmount: number;
    grandTotal: number;
}
export declare class GrnCalculationsService {
    private r2;
    calculateItemTotals(item: GrnItemDto, gstRate: number, taxType: string, isInterState: boolean): Omit<ItemCalcResult, 'hamaliShare' | 'freightShare' | 'trueCostPrice'>;
    spreadAdjustments(calcs: Array<Omit<ItemCalcResult, 'hamaliShare' | 'freightShare' | 'trueCostPrice'>>, freightCharges: number, hamaliCharges: number): ItemCalcResult[];
    calculateBillTotals(items: Array<Pick<ItemCalcResult, 'taxable' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'cessAmount' | 'lineTotal'>>, billDiscountPercent: number, freightCharges: number, hamaliCharges: number, otherCharges: number, roundingAmount: number): BillTotals;
    validateInvoiceControlTotal(calculated: number, controlTotal: number): void;
    calculateMinimumSellingPrice(netCostPrice: number, gstRate: number, marginPct: number): number;
}
