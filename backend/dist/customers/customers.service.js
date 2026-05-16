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
exports.CustomersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let CustomersService = class CustomersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(businessId, dto) {
        if (dto.phone) {
            const existing = await this.prisma.customer.findFirst({
                where: { businessId, phone: dto.phone, isActive: true },
            });
            if (existing) {
                throw new common_1.ConflictException(`Customer with phone ${dto.phone} already exists`);
            }
        }
        return this.prisma.customer.create({
            data: {
                businessId,
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                gstin: dto.gstin,
                address: dto.address,
                stateCode: dto.stateCode,
                customerType: dto.customerType ?? 'REGULAR',
            },
        });
    }
    async findAll(businessId, query) {
        const page = Math.max(1, parseInt(query.page ?? '1'));
        const limit = Math.min(100, parseInt(query.limit ?? '20'));
        const skip = (page - 1) * limit;
        const where = { businessId, isActive: true };
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search } },
            ];
        }
        const [customers, total] = await this.prisma.$transaction([
            this.prisma.customer.findMany({
                where,
                orderBy: { name: 'asc' },
                skip,
                take: limit,
                select: {
                    id: true, name: true, phone: true, email: true,
                    gstin: true, customerType: true,
                    outstandingBalance: true, loyaltyPoints: true,
                    createdAt: true,
                },
            }),
            this.prisma.customer.count({ where }),
        ]);
        return {
            data: customers,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async findOne(businessId, id) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, businessId },
        });
        if (!customer)
            throw new common_1.NotFoundException('Customer not found');
        const recentBills = await this.prisma.salesBill.findMany({
            where: { customerId: id, businessId, status: 'FINAL' },
            orderBy: { billDate: 'desc' },
            take: 10,
            select: {
                id: true, billNumber: true, billDate: true,
                grandTotal: true, paidAmount: true, balanceAmount: true,
                paymentMode: true, status: true,
            },
        });
        const stats = await this.prisma.salesBill.aggregate({
            where: { customerId: id, businessId, status: 'FINAL' },
            _sum: { grandTotal: true, paidAmount: true },
            _count: { id: true },
        });
        return {
            ...customer,
            stats: {
                totalBills: stats._count.id,
                totalPurchased: Number(stats._sum.grandTotal ?? 0),
                totalPaid: Number(stats._sum.paidAmount ?? 0),
                outstandingBalance: Number(customer.outstandingBalance),
            },
            recentBills,
        };
    }
    async update(businessId, id, dto) {
        const customer = await this.prisma.customer.findFirst({ where: { id, businessId } });
        if (!customer)
            throw new common_1.NotFoundException('Customer not found');
        if (dto.phone && dto.phone !== customer.phone) {
            const conflict = await this.prisma.customer.findFirst({
                where: { businessId, phone: dto.phone, isActive: true, id: { not: id } },
            });
            if (conflict)
                throw new common_1.ConflictException(`Phone ${dto.phone} already in use`);
        }
        return this.prisma.customer.update({
            where: { id },
            data: {
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                gstin: dto.gstin,
                address: dto.address,
                stateCode: dto.stateCode,
                customerType: dto.customerType,
                isActive: dto.isActive,
            },
        });
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map