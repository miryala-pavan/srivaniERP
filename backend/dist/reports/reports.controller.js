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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const reports_service_1 = require("./reports.service");
const date_range_dto_1 = require("./dto/date-range.dto");
const stock_query_dto_1 = require("./dto/stock-query.dto");
const cash_summary_dto_1 = require("./dto/cash-summary.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const MANAGER_ROLES = [
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'ACCOUNTS_PERSON',
    'PURCHASE_CHECKER',
    'FLOOR_SUPERVISOR',
    'SALES_REP',
];
let ReportsController = class ReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    getDailySales(req, query) {
        return this.reportsService.getDailySales(req.user.businessId, query);
    }
    getStockSummary(req, query) {
        return this.reportsService.getStockSummary(req.user.businessId, query);
    }
    getLowStock(req, branchId) {
        return this.reportsService.getLowStock(req.user.businessId, branchId);
    }
    getProfitReport(req, query) {
        return this.reportsService.getProfitReport(req.user.businessId, query);
    }
    getCashSummary(req, query) {
        return this.reportsService.getCashSummary(req.user.businessId, query);
    }
    getDashboard(req) {
        return this.reportsService.getDashboard(req.user.businessId);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, roles_decorator_1.Roles)(...MANAGER_ROLES),
    (0, common_1.Get)('sales/daily'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getDailySales", null);
__decorate([
    (0, roles_decorator_1.Roles)(...MANAGER_ROLES),
    (0, common_1.Get)('inventory/stock-summary'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, stock_query_dto_1.StockQueryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getStockSummary", null);
__decorate([
    (0, roles_decorator_1.Roles)(...MANAGER_ROLES),
    (0, common_1.Get)('inventory/low-stock'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getLowStock", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'ACCOUNTS_PERSON', 'BRANCH_MANAGER'),
    (0, common_1.Get)('financial/profit'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getProfitReport", null);
__decorate([
    (0, common_1.Get)('pos/cash-summary'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cash_summary_dto_1.CashSummaryDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getCashSummary", null);
__decorate([
    (0, roles_decorator_1.Roles)(...MANAGER_ROLES),
    (0, common_1.Get)('dashboard/today'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getDashboard", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map