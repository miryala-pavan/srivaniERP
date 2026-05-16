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
exports.PosController = void 0;
const common_1 = require("@nestjs/common");
const pos_service_1 = require("./pos.service");
const create_counter_dto_1 = require("./dto/create-counter.dto");
const open_shift_dto_1 = require("./dto/open-shift.dto");
const close_shift_dto_1 = require("./dto/close-shift.dto");
const create_bill_dto_1 = require("./dto/create-bill.dto");
const bill_query_dto_1 = require("./dto/bill-query.dto");
const create_hold_dto_1 = require("./dto/create-hold.dto");
const void_bill_dto_1 = require("./dto/void-bill.dto");
const create_credit_note_dto_1 = require("./dto/create-credit-note.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let PosController = class PosController {
    posService;
    constructor(posService) {
        this.posService = posService;
    }
    createCounter(req, dto) {
        return this.posService.createCounter(req.user.businessId, dto);
    }
    getCounters(req) {
        return this.posService.getCounters(req.user.businessId);
    }
    openShift(req, dto) {
        return this.posService.openShift(req.user.businessId, req.user.userId, dto);
    }
    getMyShift(req) {
        return this.posService.getMyShift(req.user.userId);
    }
    getCurrentShift(req) {
        return this.posService.getCurrentShift(req.user.userId, req.user.businessId);
    }
    getTodayShifts(req, date) {
        return this.posService.getTodayShifts(req.user.businessId, date);
    }
    forceCloseShift(req, id) {
        const user = req.user;
        return this.posService.forceCloseShift(user.businessId, id, user.fullName ?? user.username ?? 'Manager');
    }
    closeShift(req, id, dto) {
        return this.posService.closeShift(req.user.businessId, req.user.userId, id, dto);
    }
    createHold(req, dto) {
        const user = req.user;
        return this.posService.createHold(user.userId, user.fullName ?? user.username, user.businessId, dto);
    }
    getHeldBills(req) {
        return this.posService.getHeldBills(req.user.businessId);
    }
    deleteHold(req, id) {
        return this.posService.deleteHold(id, req.user.businessId);
    }
    completeHold(req, id) {
        return this.posService.completeHold(id, req.user.businessId);
    }
    createBill(req, dto) {
        return this.posService.createBill(req.user.businessId, req.user.userId, dto);
    }
    getBills(req, query) {
        return this.posService.getBills(req.user.businessId, query);
    }
    searchBills(req, billNumber, phone, customerName, date, limit, offset) {
        return this.posService.searchBills(req.user.businessId, {
            billNumber, phone, customerName, date,
            limit: limit ? Number(limit) : 20,
            offset: offset ? Number(offset) : 0,
        });
    }
    search(req, q) {
        return this.posService.searchProducts(req.user.businessId, q ?? '');
    }
    getStock(req, productId) {
        return this.posService.getStock(req.user.businessId, productId);
    }
    getProductPlus(req, barcode) {
        return this.posService.getProductPlus(barcode, req.user.businessId);
    }
    getFullBill(req, id) {
        return this.posService.getFullBillForPrint(id, req.user.businessId);
    }
    logDuplicatePrint(req, id) {
        const user = req.user;
        return this.posService.logDuplicatePrint(id, user.businessId, user.userId, user.fullName ?? user.username, 'POS');
    }
    voidBill(req, id, dto) {
        const user = req.user;
        return this.posService.voidBill(user.businessId, user.userId, user.role, user.shiftId ?? null, id, dto.reason, user.fullName ?? user.username);
    }
    getBillById(req, id) {
        return this.posService.getBillById(req.user.businessId, id);
    }
    createCreditNote(req, dto) {
        const user = req.user;
        return this.posService.createCreditNote(user.businessId, user.userId, user.fullName ?? user.username, dto);
    }
    getCreditNotes(req, date, originalBillId, customerName, page, limit) {
        return this.posService.getCreditNotes(req.user.businessId, {
            date, originalBillId, customerName,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 20,
        });
    }
    getCreditNoteById(req, id) {
        return this.posService.getCreditNoteById(req.user.businessId, id);
    }
    getEstimates(req, page, limit) {
        return this.posService.getEstimates(req.user.businessId, Number(page) || 1, Number(limit) || 20);
    }
    convertEstimate(req, id, targetBillType) {
        return this.posService.convertEstimate(req.user.businessId, req.user.userId, id, targetBillType ?? 'TAX_INVOICE');
    }
    cancelEstimate(req, id) {
        return this.posService.cancelEstimate(req.user.businessId, id);
    }
    createHistoricalBill(req, dto) {
        const user = req.user;
        if (!['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user.role)) {
            throw new common_1.ForbiddenException();
        }
        return this.posService.createHistoricalBill(user.businessId, user.userId, dto);
    }
    createHistoricalBillsBulk(req, body) {
        const user = req.user;
        if (!['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user.role)) {
            throw new common_1.ForbiddenException();
        }
        return this.posService.createHistoricalBillsBulk(user.businessId, user.userId, body.bills ?? []);
    }
    getHistoricalBills(req, type, page, limit) {
        return this.posService.getHistoricalBills(req.user.businessId, {
            type,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50,
        });
    }
    deleteHistoricalBill(req, id) {
        const user = req.user;
        if (!['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(user.role)) {
            throw new common_1.ForbiddenException();
        }
        return this.posService.deleteHistoricalBill(user.businessId, id);
    }
};
exports.PosController = PosController;
__decorate([
    (0, common_1.Post)('counters'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_counter_dto_1.CreateCounterDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createCounter", null);
__decorate([
    (0, common_1.Get)('counters'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getCounters", null);
__decorate([
    (0, common_1.Post)('shifts/open'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, open_shift_dto_1.OpenShiftDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "openShift", null);
__decorate([
    (0, common_1.Get)('shifts/my-shift'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getMyShift", null);
__decorate([
    (0, common_1.Get)('shifts/current'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getCurrentShift", null);
__decorate([
    (0, common_1.Get)('shifts/today'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getTodayShifts", null);
__decorate([
    (0, common_1.Put)('shifts/:id/force-close'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "forceCloseShift", null);
__decorate([
    (0, common_1.Put)('shifts/:id/close'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, close_shift_dto_1.CloseShiftDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "closeShift", null);
__decorate([
    (0, common_1.Post)('hold'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_hold_dto_1.CreateHoldDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createHold", null);
__decorate([
    (0, common_1.Get)('hold'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getHeldBills", null);
__decorate([
    (0, common_1.Delete)('hold/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "deleteHold", null);
__decorate([
    (0, common_1.Put)('hold/:id/complete'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "completeHold", null);
__decorate([
    (0, common_1.Post)('bills'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_bill_dto_1.CreateBillDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createBill", null);
__decorate([
    (0, common_1.Get)('bills'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, bill_query_dto_1.BillQueryDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getBills", null);
__decorate([
    (0, common_1.Get)('bills/search'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('billNumber')),
    __param(2, (0, common_1.Query)('phone')),
    __param(3, (0, common_1.Query)('customerName')),
    __param(4, (0, common_1.Query)('date')),
    __param(5, (0, common_1.Query)('limit')),
    __param(6, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "searchBills", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('stock/:productId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getStock", null);
__decorate([
    (0, common_1.Get)('product/:barcode/plus'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('barcode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getProductPlus", null);
__decorate([
    (0, common_1.Get)('bills/:id/full'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getFullBill", null);
__decorate([
    (0, common_1.Post)('bills/:id/duplicate-print'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "logDuplicatePrint", null);
__decorate([
    (0, common_1.Post)('bills/:id/void'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, void_bill_dto_1.VoidBillDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "voidBill", null);
__decorate([
    (0, common_1.Get)('bills/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getBillById", null);
__decorate([
    (0, common_1.Post)('credit-notes'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_credit_note_dto_1.CreateCreditNoteDto]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createCreditNote", null);
__decorate([
    (0, common_1.Get)('credit-notes'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('date')),
    __param(2, (0, common_1.Query)('originalBillId')),
    __param(3, (0, common_1.Query)('customerName')),
    __param(4, (0, common_1.Query)('page')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getCreditNotes", null);
__decorate([
    (0, common_1.Get)('credit-notes/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getCreditNoteById", null);
__decorate([
    (0, common_1.Get)('estimates'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getEstimates", null);
__decorate([
    (0, common_1.Post)('estimates/:id/convert'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('targetBillType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "convertEstimate", null);
__decorate([
    (0, common_1.Put)('estimates/:id/cancel'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "cancelEstimate", null);
__decorate([
    (0, common_1.Post)('historical-bill'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createHistoricalBill", null);
__decorate([
    (0, common_1.Post)('historical-bills-bulk'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "createHistoricalBillsBulk", null);
__decorate([
    (0, common_1.Get)('historical-bills'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "getHistoricalBills", null);
__decorate([
    (0, common_1.Delete)('historical-bills/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PosController.prototype, "deleteHistoricalBill", null);
exports.PosController = PosController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('pos'),
    __metadata("design:paramtypes", [pos_service_1.PosService])
], PosController);
//# sourceMappingURL=pos.controller.js.map