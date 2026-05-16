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
exports.ExpensesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_CATEGORIES = [
    'Rent', 'Electricity', 'Water', 'Salary', 'Wages',
    'Packaging Material', 'Repairs & Maintenance', 'Transport',
    'Marketing', 'Miscellaneous',
];
let ExpensesService = class ExpensesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(businessId, dto) {
        return this.prisma.expense.create({
            data: {
                businessId,
                branchId: dto.branchId,
                expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
                category: dto.category,
                amount: dto.amount,
                paymentMode: dto.paymentMode ?? 'CASH',
                vendorName: dto.vendorName,
                referenceNo: dto.referenceNo,
                description: dto.description,
                remarks: dto.remarks,
            },
        });
    }
    async findAll(businessId, query) {
        const page = Math.max(1, parseInt(query.page ?? '1'));
        const limit = Math.min(100, parseInt(query.limit ?? '20'));
        const skip = (page - 1) * limit;
        const where = { businessId };
        if (query.category)
            where.category = { equals: query.category, mode: 'insensitive' };
        if (query.branchId)
            where.branchId = query.branchId;
        if (query.startDate || query.endDate) {
            where.expenseDate = {};
            if (query.startDate) {
                const s = new Date(query.startDate);
                s.setHours(0, 0, 0, 0);
                where.expenseDate.gte = s;
            }
            if (query.endDate) {
                const e = new Date(query.endDate);
                e.setHours(23, 59, 59, 999);
                where.expenseDate.lte = e;
            }
        }
        const [expenses, total] = await this.prisma.$transaction([
            this.prisma.expense.findMany({
                where,
                orderBy: { expenseDate: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.expense.count({ where }),
        ]);
        const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);
        return {
            data: expenses,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit), totalAmount },
        };
    }
    async getCategories(businessId) {
        const used = await this.prisma.expense.findMany({
            where: { businessId },
            distinct: ['category'],
            select: { category: true },
            orderBy: { category: 'asc' },
        });
        const usedNames = used.map((e) => e.category).filter(Boolean);
        const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...usedNames])).sort();
        return { categories: combined };
    }
};
exports.ExpensesService = ExpensesService;
exports.ExpensesService = ExpensesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExpensesService);
//# sourceMappingURL=expenses.service.js.map