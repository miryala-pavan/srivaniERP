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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const settings_service_1 = require("./settings.service");
const update_features_dto_1 = require("./dto/update-features.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
let SettingsController = class SettingsController {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    getFeatures(req) {
        return this.settingsService.getFeatures(req.user.businessId);
    }
    updateFeatures(req, dto) {
        return this.settingsService.updateFeatures(req.user.businessId, dto);
    }
    getBillingSettings(req) {
        return this.settingsService.getBillingSettings(req.user.businessId);
    }
    updateBillingSettings(req, body) {
        return this.settingsService.updateBillingSettings(req.user.businessId, body);
    }
    getPosSettings(req) {
        return this.settingsService.getPosSettings(req.user.businessId);
    }
    updatePosSettings(req, body) {
        return this.settingsService.updatePosSettings(req.user.businessId, body);
    }
    getSystemSettings(req) {
        return this.settingsService.getSystemSettings(req.user.businessId);
    }
    updateSystemSettings(req, body) {
        return this.settingsService.updateSystemSettings(req.user.businessId, body);
    }
    getPosShortcuts(req) {
        return this.settingsService.getPosShortcuts(req.user.businessId);
    }
    updatePosShortcuts(req, body) {
        return this.settingsService.updatePosShortcuts(req.user.businessId, body);
    }
    getGstSettings(req) {
        return this.settingsService.getGstSettings(req.user.businessId);
    }
    updateGstSettings(req, body) {
        return this.settingsService.updateGstSettings(req.user.businessId, body);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'),
    (0, common_1.Get)('features'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getFeatures", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    (0, common_1.Put)('features'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_features_dto_1.UpdateFeaturesDto]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateFeatures", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Get)('billing'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getBillingSettings", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Put)('billing'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateBillingSettings", null);
__decorate([
    (0, common_1.Get)('pos'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getPosSettings", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Put)('pos'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updatePosSettings", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Get)('system'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getSystemSettings", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Put)('system'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateSystemSettings", null);
__decorate([
    (0, common_1.Get)('pos-shortcuts'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getPosShortcuts", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Put)('pos-shortcuts'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updatePosShortcuts", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Get)('gst'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "getGstSettings", null);
__decorate([
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER'),
    (0, common_1.Put)('gst'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SettingsController.prototype, "updateGstSettings", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('settings'),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsController);
//# sourceMappingURL=settings.controller.js.map