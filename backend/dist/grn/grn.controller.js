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
exports.GrnController = void 0;
const common_1 = require("@nestjs/common");
const grn_service_1 = require("./grn.service");
const create_grn_dto_1 = require("./dto/create-grn.dto");
const update_grn_dto_1 = require("./dto/update-grn.dto");
const grn_query_dto_1 = require("./dto/grn-query.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const suppliers_service_1 = require("../suppliers/suppliers.service");
const GRN_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON'];
const APPROVE_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER'];
let GrnController = class GrnController {
    grnService;
    suppliersService;
    constructor(grnService, suppliersService) {
        this.grnService = grnService;
        this.suppliersService = suppliersService;
    }
    searchProducts(req, q) {
        return this.grnService.searchProductsForGrn(q ?? '', req.user.businessId);
    }
    getSupplierAdvances(req, supplierId) {
        return this.grnService.getSupplierAdvances(req.user.businessId, supplierId);
    }
    getProductLastRates(req, productId) {
        return this.grnService.getProductLastRates(req.user.businessId, productId);
    }
    createCreditNote(req, dto) {
        return this.grnService.createSupplierCreditNote(req.user.businessId, req.user.userId, req.user.fullName ?? req.user.username ?? 'Unknown', dto);
    }
    getCreditNotes(req, supplierId, originalGrnId, dateFrom, dateTo, page, limit) {
        return this.grnService.getSupplierCreditNotes(req.user.businessId, {
            supplierId,
            originalGrnId,
            dateFrom,
            dateTo,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 20,
        });
    }
    findAll(req, query) {
        return this.grnService.findAll(req.user.businessId, query);
    }
    create(req, dto) {
        return this.grnService.create(req.user.businessId, dto);
    }
    getPrintData(req, id) {
        return this.grnService.getPrintData(req.user.businessId, id);
    }
    getPaymentSummary(req, id) {
        return this.suppliersService.getGrnPaymentSummary(req.user.businessId, id);
    }
    findOne(req, id) {
        return this.grnService.findOne(req.user.businessId, id);
    }
    update(req, id, dto) {
        return this.grnService.update(req.user.businessId, id, dto);
    }
    delete(req, id) {
        return this.grnService.deleteGrn(req.user.businessId, id);
    }
    submit(req, id) {
        return this.grnService.submit(req.user.businessId, id);
    }
    approve(req, id, approverName, notes) {
        return this.grnService.approve(req.user.businessId, id, approverName ?? req.user.name, notes);
    }
    reject(req, id, reason) {
        return this.grnService.reject(req.user.businessId, id, req.user.name, reason);
    }
    revert(req, id) {
        return this.grnService.revertToDraft(req.user.businessId, id);
    }
};
exports.GrnController = GrnController;
__decorate([
    (0, common_1.Get)('search-products'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "searchProducts", null);
__decorate([
    (0, common_1.Get)('supplier/:supplierId/advance'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('supplierId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "getSupplierAdvances", null);
__decorate([
    (0, common_1.Get)('product/:productId/last-rates'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "getProductLastRates", null);
__decorate([
    (0, common_1.Post)('credit-notes'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "createCreditNote", null);
__decorate([
    (0, common_1.Get)('credit-notes'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('supplierId')),
    __param(2, (0, common_1.Query)('originalGrnId')),
    __param(3, (0, common_1.Query)('dateFrom')),
    __param(4, (0, common_1.Query)('dateTo')),
    __param(5, (0, common_1.Query)('page')),
    __param(6, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "getCreditNotes", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grn_query_dto_1.GrnQueryDto]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_grn_dto_1.CreateGrnDto]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/print-data'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "getPrintData", null);
__decorate([
    (0, common_1.Get)(':id/payment-summary'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "getPaymentSummary", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_grn_dto_1.UpdateGrnDto]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, roles_decorator_1.Roles)(...APPROVE_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('approverName')),
    __param(3, (0, common_1.Body)('notes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, roles_decorator_1.Roles)(...APPROVE_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/revert'),
    (0, roles_decorator_1.Roles)(...GRN_ROLES),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GrnController.prototype, "revert", null);
exports.GrnController = GrnController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('grn'),
    __metadata("design:paramtypes", [grn_service_1.GrnService,
        suppliers_service_1.SuppliersService])
], GrnController);
//# sourceMappingURL=grn.controller.js.map