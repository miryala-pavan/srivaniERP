import { PrismaService } from '../prisma/prisma.service';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    seed(businessId: string): Promise<{
        message: string;
        seeded: boolean;
        businessId?: undefined;
        results?: undefined;
    } | {
        message: string;
        businessId: string;
        results: string[];
        seeded?: undefined;
    }>;
    fixProductData(businessId: string): Promise<{
        message: string;
        businessId: string;
        total: number;
        updated: number;
    }>;
    resetBillSeries(businessId: string, dto: {
        taxInvoiceStart?: number;
        retailInvoiceStart?: number;
        estimateStart?: number;
    }): Promise<{
        message: string;
        results: string[];
    }>;
    getTaxes(businessId: string): Promise<{
        id: string;
        taxName: string;
        taxCode: string;
        taxRate: import("@prisma/client/runtime/library").Decimal;
    }[]>;
}
