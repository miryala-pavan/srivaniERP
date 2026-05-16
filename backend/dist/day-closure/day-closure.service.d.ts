import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class DayClosureService {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    private getDefaultBranchId;
    getToday(businessId: string, branchId?: string): Promise<{
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
    getYesterdayStatus(businessId: string): Promise<{
        isClosed: boolean;
        date?: undefined;
    } | {
        isClosed: boolean;
        date: Date;
    }>;
    close(businessId: string, actualCash: number, notes: string | undefined, userId: string): Promise<{
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
    open(businessId: string, userId: string, userName: string): Promise<{
        opened: boolean;
        date: Date;
    }>;
    getHistory(businessId: string): Promise<{
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
    forceCloseShifts(businessId: string, managerName: string): Promise<{
        closed: number;
    }>;
}
