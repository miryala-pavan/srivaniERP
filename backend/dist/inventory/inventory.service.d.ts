import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { StockTakeDto } from './dto/stock-take.dto';
export declare class InventoryService {
    private prisma;
    private notifications;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    adjust(businessId: string, dto: AdjustStockDto): Promise<{
        entry: {
            id: string;
            businessId: string;
            createdAt: Date;
            productId: string;
            branchId: string;
            movementType: import(".prisma/client").$Enums.MovementType;
            movementDate: Date;
            quantity: import("@prisma/client/runtime/library").Decimal;
            referenceType: string | null;
            referenceId: string | null;
            notes: string | null;
        };
        currentStock: number;
        product: {
            id: string;
            name: string;
            barcode: string | null;
        };
    }>;
    private checkStockNotification;
    stockTake(businessId: string, userId: string, dto: StockTakeDto): Promise<{
        created: number;
        errors: {
            productId: string;
            error: string;
        }[];
    }>;
    getStockTakeTemplate(businessId: string): Promise<string>;
    getStockLevels(businessId: string, branchId?: string): Promise<{
        productId: string;
        branchId: string;
        product: {
            id: string;
            name: string;
            barcode: string | null;
            unitOfMeasure: string;
            reorderLevel: import("@prisma/client/runtime/library").Decimal;
        } | undefined;
        branch: {
            id: string;
            name: string;
        } | undefined;
        currentStock: number;
    }[]>;
    getOpeningStockSummary(businessId: string, branchId?: string): Promise<{
        branchId: string | null;
        products: {
            currentStock: number;
            category: {
                name: string;
                label: string;
            } | null;
            id: string;
            name: string;
            barcode: string | null;
            unitOfMeasure: string;
            reorderLevel: import("@prisma/client/runtime/library").Decimal;
            productCode: string | null;
        }[];
    }>;
    private getDefaultBranchId;
    getMovements(businessId: string, query: MovementQueryDto): Promise<{
        data: ({
            branch: {
                id: string;
                name: string;
            };
            product: {
                id: string;
                name: string;
                barcode: string | null;
                unitOfMeasure: string;
            };
        } & {
            id: string;
            businessId: string;
            createdAt: Date;
            productId: string;
            branchId: string;
            movementType: import(".prisma/client").$Enums.MovementType;
            movementDate: Date;
            quantity: import("@prisma/client/runtime/library").Decimal;
            referenceType: string | null;
            referenceId: string | null;
            notes: string | null;
        })[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}
