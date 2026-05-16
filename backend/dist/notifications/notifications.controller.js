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
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const notifications_service_1 = require("./notifications.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let NotificationsController = class NotificationsController {
    service;
    constructor(service) {
        this.service = service;
    }
    getUnreadCount(req) {
        return this.service.getUnreadCount(req.user.businessId);
    }
    getNotifications(req, page = '1', limit = '50', type, priority, isRead) {
        const isReadBool = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
        return this.service.getNotifications(req.user.businessId, Number(page), Number(limit), type, priority, isReadBool);
    }
    markAllReadAlias(req) {
        return this.service.markAllRead(req.user.businessId);
    }
    markAllRead(req) {
        return this.service.markAllRead(req.user.businessId);
    }
    markRead(req, id) {
        return this.service.markRead(req.user.businessId, id, req.user.id);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)('unread-count'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getUnreadCount", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('type')),
    __param(4, (0, common_1.Query)('priority')),
    __param(5, (0, common_1.Query)('isRead')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String, String, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Put)('mark-all-read'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "markAllReadAlias", null);
__decorate([
    (0, common_1.Put)('read-all'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "markAllRead", null);
__decorate([
    (0, common_1.Put)(':id/read'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "markRead", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map