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
exports.SuppliersController = void 0;
const common_1 = require("@nestjs/common");
const suppliers_service_1 = require("./suppliers.service");
const create_supplier_dto_1 = require("./dto/create-supplier.dto");
const update_supplier_dto_1 = require("./dto/update-supplier.dto");
const supplier_query_dto_1 = require("./dto/supplier-query.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const SUPPLIER_ROLES = [
    'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON', 'PURCHASE_CHECKER',
];
let SuppliersController = class SuppliersController {
    suppliersService;
    constructor(suppliersService) {
        this.suppliersService = suppliersService;
    }
    create(req, dto) {
        return this.suppliersService.create(req.user.businessId, dto);
    }
    findAll(req, query) {
        return this.suppliersService.findAll(req.user.businessId, query);
    }
    getBalance(req, id) {
        return this.suppliersService.getSupplierBalance(req.user.businessId, id);
    }
    getLedger(req, id) {
        return this.suppliersService.getSupplierLedger(req.user.businessId, id);
    }
    getPayments(req, id, query) {
        return this.suppliersService.getPayments(req.user.businessId, id, query);
    }
    getSupplierCreditNotes(req, id, query) {
        return this.suppliersService.getSupplierCreditNotes(req.user.businessId, id, query);
    }
    addPayment(req, id, body) {
        return this.suppliersService.addPayment(req.user.businessId, id, {
            ...body,
            createdByName: req.user.name ?? req.user.fullName ?? 'Unknown',
            createdById: req.user.id,
        });
    }
    deletePayment(req, id, paymentId) {
        return this.suppliersService.deletePayment(req.user.businessId, id, paymentId);
    }
    updateOpeningBalance(req, id, body) {
        return this.suppliersService.updateOpeningBalance(req.user.businessId, id, body);
    }
    findOne(req, id) {
        return this.suppliersService.findOne(req.user.businessId, id);
    }
    update(req, id, dto) {
        return this.suppliersService.update(req.user.businessId, id, dto);
    }
};
exports.SuppliersController = SuppliersController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_supplier_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, supplier_query_dto_1.SupplierQueryDto]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/balance'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Get)(':id/ledger'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "getLedger", null);
__decorate([
    (0, common_1.Get)(':id/payments'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "getPayments", null);
__decorate([
    (0, common_1.Get)(':id/credit-notes'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "getSupplierCreditNotes", null);
__decorate([
    (0, common_1.Post)(':id/payments'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "addPayment", null);
__decorate([
    (0, common_1.Delete)(':id/payments/:paymentId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('paymentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "deletePayment", null);
__decorate([
    (0, common_1.Patch)(':id/opening-balance'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "updateOpeningBalance", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_supplier_dto_1.UpdateSupplierDto]),
    __metadata("design:returntype", void 0)
], SuppliersController.prototype, "update", null);
exports.SuppliersController = SuppliersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...SUPPLIER_ROLES),
    (0, common_1.Controller)('suppliers'),
    __metadata("design:paramtypes", [suppliers_service_1.SuppliersService])
], SuppliersController);
//# sourceMappingURL=suppliers.controller.js.map