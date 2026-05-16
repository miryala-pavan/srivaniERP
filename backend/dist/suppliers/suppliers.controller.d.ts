import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
export declare class SuppliersController {
    private suppliersService;
    constructor(suppliersService: SuppliersService);
    create(req: any, dto: CreateSupplierDto): Promise<{
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string | null;
        address: string | null;
        isActive: boolean;
        paymentTermsDays: number;
        creditLimit: import("@prisma/client/runtime/library").Decimal;
        isGstRegistered: boolean;
        outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalanceDate: Date | null;
        openingBalanceType: string;
        openingBalanceNote: string | null;
    }>;
    findAll(req: any, query: SupplierQueryDto): Promise<{
        data: {
            gstin: string | null;
            email: string | null;
            phone: string | null;
            id: string;
            createdAt: Date;
            name: string;
            stateCode: string | null;
            address: string | null;
            isActive: boolean;
            paymentTermsDays: number;
            creditLimit: import("@prisma/client/runtime/library").Decimal;
            isGstRegistered: boolean;
            outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getBalance(req: any, id: string): Promise<{
        supplierId: string;
        supplierName: string;
        openingBalance: number;
        openingBalanceType: string;
        totalPurchases: number;
        totalPaid: number;
        totalCreditNotes: number;
        balance: number;
    }>;
    getLedger(req: any, id: string): Promise<{
        supplier: {
            id: string;
            name: string;
        };
        ledger: {
            balance: number;
            date: Date;
            type: "OPENING" | "PURCHASE" | "PAYMENT" | "CREDIT_NOTE";
            description: string;
            debit: number;
            credit: number;
            referenceId?: string;
        }[];
    }>;
    getPayments(req: any, id: string, query: {
        purchaseId?: string;
        page?: string;
        limit?: string;
    }): Promise<{
        data: ({
            purchase: {
                id: string;
                grandTotal: import("@prisma/client/runtime/library").Decimal;
                grnNumber: string | null;
                invoiceNumber: string;
            } | null;
        } & {
            id: string;
            businessId: string;
            createdById: string | null;
            createdByName: string;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            purchaseId: string | null;
            notes: string | null;
            paymentMode: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            invoiceReference: string | null;
            paymentDate: Date;
            referenceNumber: string | null;
            screenshotUrl: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getSupplierCreditNotes(req: any, id: string, query: {
        page?: string;
        limit?: string;
    }): Promise<{
        data: {
            id: string;
            businessId: string;
            status: string;
            createdById: string | null;
            createdByName: string | null;
            createdAt: Date;
            updatedAt: Date;
            supplierId: string;
            notes: string | null;
            taxableAmount: import("@prisma/client/runtime/library").Decimal;
            originalGrnId: string | null;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            cgstAmount: import("@prisma/client/runtime/library").Decimal;
            sgstAmount: import("@prisma/client/runtime/library").Decimal;
            igstAmount: import("@prisma/client/runtime/library").Decimal;
            cessAmount: import("@prisma/client/runtime/library").Decimal;
            scnNumber: string;
            originalInvoiceNo: string | null;
            supplierCnNumber: string | null;
            cnDate: Date;
            reason: string;
            itcReversal: boolean;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    addPayment(req: any, id: string, body: any): Promise<{
        id: string;
        businessId: string;
        createdById: string | null;
        createdByName: string;
        createdAt: Date;
        updatedAt: Date;
        supplierId: string;
        purchaseId: string | null;
        notes: string | null;
        paymentMode: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        invoiceReference: string | null;
        paymentDate: Date;
        referenceNumber: string | null;
        screenshotUrl: string | null;
    }>;
    deletePayment(req: any, id: string, paymentId: string): Promise<{
        message: string;
    }>;
    updateOpeningBalance(req: any, id: string, body: any): Promise<{
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string | null;
        address: string | null;
        isActive: boolean;
        paymentTermsDays: number;
        creditLimit: import("@prisma/client/runtime/library").Decimal;
        isGstRegistered: boolean;
        outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalanceDate: Date | null;
        openingBalanceType: string;
        openingBalanceNote: string | null;
    }>;
    findOne(req: any, id: string): Promise<{
        stats: {
            totalOrders: number;
            totalPurchased: number;
            totalPaid: number;
            outstandingBalance: number;
        };
        recentPurchases: {
            id: string;
            status: import(".prisma/client").$Enums.PurchaseStatus;
            createdAt: Date;
            grandTotal: import("@prisma/client/runtime/library").Decimal;
            paidAmount: import("@prisma/client/runtime/library").Decimal;
            grnNumber: string | null;
            invoiceNumber: string;
            invoiceDate: Date;
        }[];
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string | null;
        address: string | null;
        isActive: boolean;
        paymentTermsDays: number;
        creditLimit: import("@prisma/client/runtime/library").Decimal;
        isGstRegistered: boolean;
        outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalanceDate: Date | null;
        openingBalanceType: string;
        openingBalanceNote: string | null;
    }>;
    update(req: any, id: string, dto: UpdateSupplierDto): Promise<{
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string | null;
        address: string | null;
        isActive: boolean;
        paymentTermsDays: number;
        creditLimit: import("@prisma/client/runtime/library").Decimal;
        isGstRegistered: boolean;
        outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalance: import("@prisma/client/runtime/library").Decimal;
        openingBalanceDate: Date | null;
        openingBalanceType: string;
        openingBalanceNote: string | null;
    }>;
}
