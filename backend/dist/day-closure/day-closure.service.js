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
exports.DayClosureService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
function todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
function yesterdayRange() {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}
let DayClosureService = class DayClosureService {
    prisma;
    notifications;
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    async getDefaultBranchId(businessId) {
        const branch = await this.prisma.branch.findFirst({
            where: { businessId, isActive: true },
            orderBy: { createdAt: 'asc' },
        });
        return branch?.id ?? null;
    }
    async getToday(businessId, branchId) {
        const resolvedBranchId = branchId ?? await this.getDefaultBranchId(businessId);
        const { start, end } = todayRange();
        const bills = await this.prisma.salesBill.findMany({
            where: {
                businessId,
                branchId: resolvedBranchId ?? undefined,
                status: 'FINAL',
                billDate: { gte: start, lte: end },
            },
            select: { grandTotal: true, paymentMode: true },
        });
        let totalBills = bills.length;
        let totalSales = 0, totalCash = 0, totalUpi = 0, totalCard = 0;
        for (const b of bills) {
            const amt = Number(b.grandTotal);
            totalSales += amt;
            if (b.paymentMode === 'CASH')
                totalCash += amt;
            if (b.paymentMode === 'UPI')
                totalUpi += amt;
            if (b.paymentMode === 'CARD')
                totalCard += amt;
        }
        const round2 = (n) => Math.round(n * 100) / 100;
        const shift = await this.prisma.posShift.findFirst({
            where: {
                branchId: resolvedBranchId ?? undefined,
                startTime: { gte: start, lte: end },
                status: { not: 'SUSPENDED' },
            },
            orderBy: { startTime: 'asc' },
            select: { openingCash: true },
        });
        const openingCash = Number(shift?.openingCash ?? 0);
        const systemCash = round2(totalCash + openingCash);
        const grnsPending = await this.prisma.purchase.count({
            where: { businessId, status: 'PENDING_APPROVAL' },
        });
        const stockAlerts = await this.prisma.notification.count({
            where: { businessId, isRead: false, type: { in: ['OUT_OF_STOCK', 'LOW_STOCK'] } },
        });
        const openShifts = await this.prisma.posShift.count({
            where: {
                branchId: resolvedBranchId ?? undefined,
                startTime: { gte: start, lte: end },
                status: 'OPEN',
            },
        });
        const closureDate = new Date();
        closureDate.setHours(0, 0, 0, 0);
        const existing = await this.prisma.dayClosure.findFirst({
            where: { businessId, branchId: resolvedBranchId ?? '', closureDate },
        });
        return {
            branchId: resolvedBranchId,
            closureDate,
            status: existing?.status ?? null,
            totalBills,
            totalSales: round2(totalSales),
            totalCash: round2(totalCash),
            totalUpi: round2(totalUpi),
            totalCard: round2(totalCard),
            openingCash,
            systemCash,
            actualCash: existing?.actualCash ? Number(existing.actualCash) : null,
            cashDifference: existing?.cashDifference ? Number(existing.cashDifference) : null,
            grnsPending,
            stockAlerts,
            openShifts,
            closedAt: existing?.closedAt ?? null,
            notes: existing?.notes ?? null,
        };
    }
    async getYesterdayStatus(businessId) {
        const { start } = yesterdayRange();
        const closureDate = new Date(start);
        closureDate.setHours(0, 0, 0, 0);
        const branchId = await this.getDefaultBranchId(businessId);
        if (!branchId)
            return { isClosed: true };
        const closure = await this.prisma.dayClosure.findFirst({
            where: { businessId, branchId, closureDate, status: 'COMPLETED' },
        });
        return { isClosed: !!closure, date: closureDate };
    }
    async close(businessId, actualCash, notes, userId) {
        const branchId = await this.getDefaultBranchId(businessId);
        if (!branchId)
            throw new common_1.BadRequestException('No active branch found');
        const { start } = todayRange();
        const openShifts = await this.prisma.posShift.count({
            where: { branchId, startTime: { gte: start }, status: 'OPEN' },
        });
        if (openShifts > 0) {
            throw new common_1.BadRequestException(`Cannot close day. ${openShifts} shift${openShifts > 1 ? 's' : ''} still open. Cashiers must close their shifts first.`);
        }
        const summary = await this.getToday(businessId, branchId);
        const round2 = (n) => Math.round(n * 100) / 100;
        const cashDiff = round2(actualCash - summary.systemCash);
        const closureDate = new Date();
        closureDate.setHours(0, 0, 0, 0);
        const closure = await this.prisma.dayClosure.upsert({
            where: { businessId_branchId_closureDate: { businessId, branchId, closureDate } },
            update: {
                status: 'COMPLETED',
                systemCash: summary.systemCash,
                actualCash,
                cashDifference: cashDiff,
                totalBills: summary.totalBills,
                totalSales: summary.totalSales,
                totalCash: summary.totalCash,
                totalUpi: summary.totalUpi,
                totalCard: summary.totalCard,
                grnsPending: summary.grnsPending,
                closedById: userId,
                closedAt: new Date(),
                notes: notes ?? null,
            },
            create: {
                businessId, branchId, closureDate,
                status: 'COMPLETED',
                systemCash: summary.systemCash,
                actualCash,
                cashDifference: cashDiff,
                totalBills: summary.totalBills,
                totalSales: summary.totalSales,
                totalCash: summary.totalCash,
                totalUpi: summary.totalUpi,
                totalCard: summary.totalCard,
                grnsPending: summary.grnsPending,
                closedById: userId,
                closedAt: new Date(),
                notes: notes ?? null,
            },
        });
        this.notifications.create({
            businessId,
            type: 'SYSTEM',
            priority: 'NORMAL',
            title: `Day Closed — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
            message: `Sales: ₹${summary.totalSales} · Cash: ₹${summary.totalCash} · UPI: ₹${summary.totalUpi} · Diff: ₹${cashDiff}`,
        }).catch(() => { });
        return closure;
    }
    async open(businessId, userId, userName) {
        const branchId = await this.getDefaultBranchId(businessId);
        if (!branchId)
            throw new common_1.BadRequestException('No active branch found');
        const closureDate = new Date();
        closureDate.setHours(0, 0, 0, 0);
        const existing = await this.prisma.dayClosure.findFirst({
            where: { businessId, branchId, closureDate },
        });
        if (existing?.status === 'PENDING') {
            throw new common_1.BadRequestException('Day is already open.');
        }
        await this.prisma.dayClosure.upsert({
            where: { businessId_branchId_closureDate: { businessId, branchId, closureDate } },
            create: { businessId, branchId, closureDate, status: 'PENDING', openedById: userId, openedByName: userName },
            update: { status: 'PENDING', closedById: null, closedAt: null, openedById: userId, openedByName: userName },
        });
        return { opened: true, date: closureDate };
    }
    async getHistory(businessId) {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        return this.prisma.dayClosure.findMany({
            where: { businessId, closureDate: { gte: since } },
            orderBy: { closureDate: 'desc' },
            take: 30,
        });
    }
    async forceCloseShifts(businessId, managerName) {
        const branchId = await this.getDefaultBranchId(businessId);
        if (!branchId)
            throw new common_1.BadRequestException('No active branch found');
        const { start } = todayRange();
        const result = await this.prisma.posShift.updateMany({
            where: { branchId, startTime: { gte: start }, status: 'OPEN' },
            data: {
                status: 'CLOSED',
                endTime: new Date(),
                notes: `Force closed by manager: ${managerName}`,
            },
        });
        return { closed: result.count };
    }
};
exports.DayClosureService = DayClosureService;
exports.DayClosureService = DayClosureService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], DayClosureService);
//# sourceMappingURL=day-closure.service.js.map