import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
export declare class SuppliersService {
    private prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateSupplierDto): Promise<{
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
    findAll(businessId: string, query: SupplierQueryDto): Promise<{
        data: {
            balanceDue: number;
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
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getSupplierBalances(businessId: string, supplierIds: string[]): Promise<Record<string, number>>;
    findOne(businessId: string, id: string): Promise<{
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
            grnNumber: string | null;
            invoiceNumber: string;
            invoiceDate: Date;
            grandTotal: import("@prisma/client/runtime/library").Decimal;
            paidAmount: import("@prisma/client/runtime/library").Decimal;
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
    update(businessId: string, id: string, dto: UpdateSupplierDto): Promise<{
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
    updateOpeningBalance(businessId: string, id: string, dto: {
        openingBalance: number;
        openingBalanceType: string;
        openingBalanceDate?: string;
        openingBalanceNote?: string;
    }): Promise<{
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
    getSupplierBalance(businessId: string, supplierId: string): Promise<{
        supplierId: string;
        supplierName: string;
        openingBalance: number;
        openingBalanceType: string;
        totalPurchases: number;
        totalPaid: number;
        totalCreditNotes: number;
        balance: number;
        balanceDue: number;
    }>;
    getSupplierLedger(businessId: string, supplierId: string): Promise<{
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
    addPayment(businessId: string, supplierId: string, dto: {
        purchaseId?: string;
        invoiceReference?: string;
        paymentDate?: string;
        amount: number;
        paymentMode: string;
        referenceNumber?: string;
        notes?: string;
        createdByName: string;
        createdById?: string;
    }): Promise<{
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
        invoiceReference: string | null;
        paymentDate: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        referenceNumber: string | null;
        screenshotUrl: string | null;
    }>;
    getPayments(businessId: string, supplierId: string, query: {
        purchaseId?: string;
        page?: string;
        limit?: string;
    }): Promise<{
        data: ({
            purchase: {
                id: string;
                grnNumber: string | null;
                invoiceNumber: string;
                grandTotal: import("@prisma/client/runtime/library").Decimal;
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
            invoiceReference: string | null;
            paymentDate: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
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
    deletePayment(businessId: string, supplierId: string, paymentId: string): Promise<{
        message: string;
    }>;
    getGrnPaymentSummary(businessId: string, purchaseId: string): Promise<{
        purchaseId: string;
        grandTotal: number;
        totalPaid: number;
        totalCreditNotes: number;
        balance: number;
        isPaid: boolean;
    }>;
    getSupplierCreditNotes(businessId: string, supplierId: string, query: {
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
            scnNumber: string;
            originalInvoiceNo: string | null;
            supplierCnNumber: string | null;
            cnDate: Date;
            reason: string;
            cgstAmount: import("@prisma/client/runtime/library").Decimal;
            sgstAmount: import("@prisma/client/runtime/library").Decimal;
            igstAmount: import("@prisma/client/runtime/library").Decimal;
            cessAmount: import("@prisma/client/runtime/library").Decimal;
            totalAmount: import("@prisma/client/runtime/library").Decimal;
            itcReversal: boolean;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}
