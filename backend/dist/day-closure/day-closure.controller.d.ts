import { DayClosureService } from './day-closure.service';
export declare class DayClosureController {
    private service;
    constructor(service: DayClosureService);
    getToday(req: any, branchId?: string): Promise<{
        branchId: string | null;
        closureDate: Date;
        status: string | null;
        totalBills: number;
        totalSales: number;
        totalCash: number;
        totalUpi: number;
        totalCard: number;
        openingCash: number;
        systemCash: number;
        actualCash: number | null;
        cashDifference: number | null;
        grnsPending: number;
        stockAlerts: number;
        openShifts: number;
        closedAt: Date | null;
        notes: string | null;
    }>;
    getYesterdayStatus(req: any): Promise<{
        isClosed: boolean;
        date?: undefined;
    } | {
        isClosed: boolean;
        date: Date;
    }>;
    getHistory(req: any): Promise<{
        id: string;
        businessId: string;
        status: string;
        createdAt: Date;
        branchId: string;
        notes: string | null;
        totalSales: import("@prisma/client/runtime/library").Decimal;
        totalBills: number;
        totalCash: import("@prisma/client/runtime/library").Decimal;
        totalUpi: import("@prisma/client/runtime/library").Decimal;
        totalCard: import("@prisma/client/runtime/library").Decimal;
        closureDate: Date;
        systemCash: import("@prisma/client/runtime/library").Decimal;
        actualCash: import("@prisma/client/runtime/library").Decimal | null;
        cashDifference: import("@prisma/client/runtime/library").Decimal | null;
        cashCounted: boolean;
        grnsPending: number;
        grnsCleared: boolean;
        stockAlertsAck: boolean;
        openedById: string | null;
        openedByName: string | null;
        closedById: string | null;
        closedAt: Date | null;
    }[]>;
    open(req: any): Promise<{
        opened: boolean;
        date: Date;
    }>;
    forceCloseShifts(req: any): Promise<{
        closed: number;
    }>;
    close(req: any, actualCash: number, notes?: string): Promise<{
        id: string;
        businessId: string;
        status: string;
        createdAt: Date;
        branchId: string;
        notes: string | null;
        totalSales: import("@prisma/client/runtime/library").Decimal;
        totalBills: number;
        totalCash: import("@prisma/client/runtime/library").Decimal;
        totalUpi: import("@prisma/client/runtime/library").Decimal;
        totalCard: import("@prisma/client/runtime/library").Decimal;
        closureDate: Date;
        systemCash: import("@prisma/client/runtime/library").Decimal;
        actualCash: import("@prisma/client/runtime/library").Decimal | null;
        cashDifference: import("@prisma/client/runtime/library").Decimal | null;
        cashCounted: boolean;
        grnsPending: number;
        grnsCleared: boolean;
        stockAlertsAck: boolean;
        openedById: string | null;
        openedByName: string | null;
        closedById: string | null;
        closedAt: Date | null;
    }>;
}
