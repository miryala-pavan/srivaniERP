import type { Response } from 'express';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { StockTakeDto } from './dto/stock-take.dto';
export declare class InventoryController {
    private inventoryService;
    constructor(inventoryService: InventoryService);
    adjust(req: any, dto: AdjustStockDto): Promise<{
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
    getMovements(req: any, query: MovementQueryDto): Promise<{
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
    stockTake(req: any, dto: StockTakeDto): Promise<{
        created: number;
        errors: {
            productId: string;
            error: string;
        }[];
    }>;
    stockTakeTemplate(req: any, res: Response): Promise<void>;
    getStockLevels(req: any, branchId?: string): Promise<{
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
    getOpeningStockSummary(req: any, branchId?: string): Promise<{
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
}
