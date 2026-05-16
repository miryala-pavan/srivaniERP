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
    resetBillSeries(req: any, body: {
        taxInvoiceStart?: number;
        retailInvoiceStart?: number;
        estimateStart?: number;
    }): Promise<{
        message: string;
        results: string[];
    }>;
}
