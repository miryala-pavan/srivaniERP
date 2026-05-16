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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let NotificationsService = class NotificationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(input) {
        return this.prisma.notification.create({
            data: {
                businessId: input.businessId,
                type: input.type,
                priority: input.priority ?? 'NORMAL',
                title: input.title,
                message: input.message,
                productId: input.productId ?? null,
                supplierId: input.supplierId ?? null,
                purchaseId: input.purchaseId ?? null,
                actionUrl: input.actionUrl ?? null,
                actionLabel: input.actionLabel ?? null,
                channel: input.channel ?? 'IN_APP',
            },
        });
    }
    async getNotifications(businessId, page = 1, limit = 50, type, priority, isRead) {
        const skip = (page - 1) * limit;
        const where = { businessId };
        if (type)
            where.type = type;
        if (priority)
            where.priority = priority;
        if (isRead !== undefined)
            where.isRead = isRead;
        const [data, total] = await this.prisma.$transaction([
            this.prisma.notification.findMany({
                where,
                orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
                skip,
                take: Math.min(limit, 50),
            }),
            this.prisma.notification.count({ where }),
        ]);
        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async getUnreadCount(businessId) {
        const count = await this.prisma.notification.count({ where: { businessId, isRead: false } });
        return { count };
    }
    async markRead(businessId, id, userId) {
        const notif = await this.prisma.notification.findFirst({ where: { id, businessId } });
        if (!notif)
            throw new common_1.NotFoundException('Notification not found');
        return this.prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date(), readById: userId ?? null },
        });
    }
    async markAllRead(businessId) {
        const result = await this.prisma.notification.updateMany({
            where: { businessId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { updated: result.count };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map