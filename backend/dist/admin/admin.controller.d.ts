import { AdminService } from './admin.service';
export declare class AdminController {
    private adminService;
    constructor(adminService: AdminService);
    getTaxes(req: any): Promise<{
        id: string;
        taxName: string;
        taxCode: string;
        taxRate: import("@prisma/client/runtime/library").Decimal;
    }[]>;
    seed(req: any): Promise<{
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
    fixProductData(req: any): Promise<{
        message: string;
        businessId: string;
        total: number;
        updated: number;
    }>;
    seedDepartments(req: any): Promise<{
        message: string;
        deptsSeeded: number;
        catsSeeded: number;
        subCatsSeeded: number;
    }>;
    repairProductPlus(req: any): Promise<{
        repaired: number;
        updated: number;
        barcodesLinked: number;
        repairedLog: string[];
        updatedLog: string[];
        barcodesLinkedLog: string[];
        errors: string[];
    }>;
    migrateOrphansPhase1(req: any): Promise<{
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
    resetBillSeries(req: any, body: {
        taxInvoiceStart?: number;
        retailInvoiceStart?: number;
        estimateStart?: number;
    }): Promise<{
        message: string;
        results: string[];
    }>;
}
