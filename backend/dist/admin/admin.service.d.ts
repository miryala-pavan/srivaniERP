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
    seedDepartments(businessId: string): Promise<{
        message: string;
        deptsSeeded: number;
        catsSeeded: number;
        subCatsSeeded: number;
    }>;
    repairProductPlus(businessId: string): Promise<{
        repaired: number;
        updated: number;
        barcodesLinked: number;
        repairedLog: string[];
        updatedLog: string[];
        barcodesLinkedLog: string[];
        errors: string[];
    }>;
    migrateOrphansPhase1(businessId: string): Promise<{
        message: string;
        brand: string;
        brandId: string;
        deptsCreated: number;
        deptsCreatedIds: string[];
        catsCreated: number;
        catsCreatedIds: string[];
        subCatsCreated: number;
        subCatsCreatedIds: string[];
        productsMoved: number;
        productsMovedLog: {
            productId: string;
            name: string;
            oldCategoryId: string;
            oldCategoryName: string;
            newDepartmentId: string;
            newDepartmentCode: string;
            newCategoryId: string;
            newCategoryName: string;
            newParentName: string;
        }[];
    }>;
}
