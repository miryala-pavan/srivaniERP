import { PrismaService } from '../prisma/prisma.service';
export declare class GstReportsService {
    private prisma;
    constructor(prisma: PrismaService);
    private getPeriodDates;
    getSalesRegister(businessId: string, month: number, year: number): Promise<{
        period: string;
        b2b: {
            billNumber: string;
            billDate: string;
            customerName: string;
            customerGstin: string;
            supplyStateCode: string;
            billType: string;
            taxableAmount: number;
            cgst: number;
            sgst: number;
            igst: number;
            cess: number;
            grandTotal: number;
        }[];
        b2c: {
            stateCode: string;
            gstRate: number;
            taxableAmount: number;
            cgst: number;
            sgst: number;
            igst: number;
            cess: number;
            count: number;
        }[];
        hsnSummary: {
            totalTax: number;
            hsnCode: string;
            description: string;
            uom: string;
            totalQty: number;
            taxableAmount: number;
            cgst: number;
            sgst: number;
            igst: number;
            cess: number;
        }[];
        totals: {
            totalBills: number;
            totalTaxable: number;
            totalCgst: number;
            totalSgst: number;
            totalIgst: number;
            totalCess: number;
            totalGrandTotal: number;
        };
    }>;
    getPurchaseRegister(businessId: string, month: number, year: number): Promise<{
        period: string;
        purchases: {
            grnNumber: string;
            grnDate: any;
            supplierName: string;
            supplierGstin: string;
            invoiceNumber: string;
            invoiceDate: string;
            isInterState: boolean;
            itcEligibility: string;
            taxableAmount: number;
            cgst: number;
            sgst: number;
            igst: number;
            cess: number;
            totalAmount: number;
            itcClaimed: number;
        }[];
        summary: {
            totalPurchases: number;
            eligibleITC: number;
            ineligibleITC: number;
            cgstITC: number;
            sgstITC: number;
            igstITC: number;
            cessITC: number;
        };
    }>;
    getGSTR3BSummary(businessId: string, month: number, year: number): Promise<{
        period: string;
        outwardSupplies: {
            b2b: {
                taxable: number;
                cgst: number;
                sgst: number;
                igst: number;
                cess: number;
            };
            b2c: {
                taxable: number;
                cgst: number;
                sgst: number;
                igst: number;
                cess: number;
            };
            total: {
                taxable: number;
                cgst: number;
                sgst: number;
                igst: number;
                cess: number;
            };
        };
        itcAvailable: {
            fromPurchases: {
                cgst: number;
                sgst: number;
                igst: number;
                cess: number;
            };
            eligible: {
                cgst: number;
                sgst: number;
                igst: number;
                cess: number;
            };
        };
        netPayable: {
            cgst: number;
            sgst: number;
            igst: number;
            cess: number;
            total: number;
        };
        inputServiceDistribution: number;
        reverseCharge: {
            cgst: number;
            sgst: number;
            igst: number;
        };
        creditLedger: {
            openingBalance: number;
            itcClaimed: number;
            taxPaid: number;
            closingBalance: number;
        };
    }>;
    getHSNSummary(businessId: string, month: number, year: number): Promise<{
        period: string;
        hsnData: {
            hsnCode: string;
            totalQuantity: number;
            totalTaxableValue: number;
            totalGST: number;
            totalCess: number;
        }[];
    }>;
    getGSTR1Json(businessId: string, month: number, year: number): Promise<{
        gstin: string;
        fp: string;
        b2b: {
            ctin: string;
            inv: {
                inum: string;
                idt: string;
                val: number;
                pos: string;
                rchrg: string;
                itms: {
                    num: number;
                    itm_det: {
                        txval: number;
                        rt: number;
                        camt: number;
                        samt: number;
                        csamt: number;
                    };
                }[];
            }[];
        }[];
        b2cs: {
            pos: string;
            rt: number;
            typ: string;
            txval: number;
            camt: number;
            samt: number;
            csamt: number;
        }[];
        hsn: {
            data: {
                hsn_sc: string;
                uqc: string;
                qty: number;
                val: number;
                txval: number;
                camt: number;
                samt: number;
                csamt: number;
            }[];
        };
    }>;
}
