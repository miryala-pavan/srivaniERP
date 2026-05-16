"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryController = void 0;
const common_1 = require("@nestjs/common");
const inventory_service_1 = require("./inventory.service");
const adjust_stock_dto_1 = require("./dto/adjust-stock.dto");
const movement_query_dto_1 = require("./dto/movement-query.dto");
const stock_take_dto_1 = require("./dto/stock-take.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const INVENTORY_ROLES = [
    'SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'FLOOR_SUPERVISOR',
];
let InventoryController = class InventoryController {
    inventoryService;
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    adjust(req, dto) {
        return this.inventoryService.adjust(req.user.businessId, dto);
    }
    getMovements(req, query) {
        return this.inventoryService.getMovements(req.user.businessId, query);
    }
    stockTake(req, dto) {
        return this.inventoryService.stockTake(req.user.businessId, req.user.userId, dto);
    }
    async stockTakeTemplate(req, res) {
        const csv = await this.inventoryService.getStockTakeTemplate(req.user.businessId);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="stock-take-template.csv"');
        res.send(csv);
    }
    getStockLevels(req, branchId) {
        return this.inventoryService.getStockLevels(req.user.businessId, branchId);
    }
    getOpeningStockSummary(req, branchId) {
        return this.inventoryService.getOpeningStockSummary(req.user.businessId, branchId);
    }
};
exports.InventoryController = InventoryController;
__decorate([
    (0, common_1.Post)('adjust'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, adjust_stock_dto_1.AdjustStockDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "adjust", null);
__decorate([
    (0, common_1.Get)('movements'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, movement_query_dto_1.MovementQueryDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getMovements", null);
__decorate([
    (0, common_1.Post)('stock-take'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stock_take_dto_1.StockTakeDto]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "stockTake", null);
__decorate([
    (0, common_1.Get)('stock-take/template'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], InventoryController.prototype, "stockTakeTemplate", null);
__decorate([
    (0, common_1.Get)('stock-levels'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getStockLevels", null);
__decorate([
    (0, common_1.Get)('opening-stock'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InventoryController.prototype, "getOpeningStockSummary", null);
exports.InventoryController = InventoryController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...INVENTORY_ROLES),
    (0, common_1.Controller)('inventory'),
    __metadata("design:paramtypes", [inventory_service_1.InventoryService])
], InventoryController);
//# sourceMappingURL=inventory.controller.js.map