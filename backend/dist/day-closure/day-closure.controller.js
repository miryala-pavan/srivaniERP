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
exports.DayClosureController = void 0;
const common_1 = require("@nestjs/common");
const day_closure_service_1 = require("./day-closure.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let DayClosureController = class DayClosureController {
    service;
    constructor(service) {
        this.service = service;
    }
    getToday(req, branchId) {
        return this.service.getToday(req.user.businessId, branchId);
    }
    getYesterdayStatus(req) {
        return this.service.getYesterdayStatus(req.user.businessId);
    }
    getHistory(req) {
        return this.service.getHistory(req.user.businessId);
    }
    open(req) {
        const u = req.user;
        return this.service.open(u.businessId, u.id ?? u.userId, u.fullName ?? u.username ?? 'Manager');
    }
    forceCloseShifts(req) {
        return this.service.forceCloseShifts(req.user.businessId, req.user.fullName ?? req.user.username ?? 'Manager');
    }
    close(req, actualCash, notes) {
        return this.service.close(req.user.businessId, actualCash, notes, req.user.id);
    }
};
exports.DayClosureController = DayClosureController;
__decorate([
    (0, common_1.Get)('today'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], DayClosureController.prototype, "getToday", null);
__decorate([
    (0, common_1.Get)('yesterday-status'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DayClosureController.prototype, "getYesterdayStatus", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DayClosureController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Post)('open'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DayClosureController.prototype, "open", null);
__decorate([
    (0, common_1.Post)('force-close-shifts'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DayClosureController.prototype, "forceCloseShifts", null);
__decorate([
    (0, common_1.Post)('close'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)('actualCash')),
    __param(2, (0, common_1.Body)('notes')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, String]),
    __metadata("design:returntype", void 0)
], DayClosureController.prototype, "close", null);
exports.DayClosureController = DayClosureController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('day-closure'),
    __metadata("design:paramtypes", [day_closure_service_1.DayClosureService])
], DayClosureController);
//# sourceMappingURL=day-closure.controller.js.map