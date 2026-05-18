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
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function tcField(s) {
    if (!s)
        return s ?? undefined;
    return s.trim().split(' ').map((w) => {
        if (!w)
            return w;
        if (/\d/.test(w))
            return w;
        if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z]+$/.test(w))
            return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
}
let SuppliersService = class SuppliersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(businessId, dto) {
        if (dto.gstin) {
            const existing = await this.prisma.supplier.findFirst({
                where: { businessId, gstin: dto.gstin, isActive: true },
            });
            if (existing) {
                throw new common_1.ConflictException(`Supplier with GSTIN ${dto.gstin} already exists`);
            }
        }
        return this.prisma.supplier.create({
            data: {
                businessId,
                name: tcField(dto.name) ?? dto.name,
                gstin: dto.gstin,
                phone: dto.phone,
                email: dto.email,
                address: dto.address,
                stateCode: dto.stateCode,
                paymentTermsDays: dto.paymentTermsDays ?? 0,
                creditLimit: dto.creditLimit ?? 0,
                isGstRegistered: dto.isGstRegistered ?? true,
            },
        });
    }
    async findAll(businessId, query) {
        const page = Math.max(1, parseInt(query.page ?? '1'));
        const limit = Math.min(100, parseInt(query.limit ?? '20'));
        const skip = (page - 1) * limit;
        const where = { businessId };
        if (query.isActive !== undefined) {
            where.isActive = query.isActive === 'true';
        }
        else {
            where.isActive = true;
        }
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search } },
                { gstin: { contains: query.search } },
            ];
        }
        const [suppliers, total] = await this.prisma.$transaction([
            this.prisma.supplier.findMany({
                where,
                orderBy: { name: 'asc' },
                skip,
                take: limit,
                select: {
                    id: true, name: true, gstin: true, phone: true, email: true,
                    address: true, stateCode: true, paymentTermsDays: true,
                    creditLimit: true, isGstRegistered: true,
                    isActive: true, createdAt: true,
                },
            }),
            this.prisma.supplier.count({ where }),
        ]);
        const ids = suppliers.map((s) => s.id);
        const balances = await this.getSupplierBalances(businessId, ids);
        return {
            data: suppliers.map((s) => ({ ...s, balanceDue: balances[s.id] ?? 0 })),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }
    async getSupplierBalances(businessId, supplierIds) {
        if (supplierIds.length === 0)
            return {};
        const [grns, payments, credits, supplierRows] = await Promise.all([
            this.prisma.purchase.groupBy({
                by: ['supplierId'],
                where: { businessId, supplierId: { in: supplierIds }, status: 'APPROVED' },
                _sum: { grandTotal: true },
            }),
            this.prisma.supplierPayment.groupBy({
                by: ['supplierId'],
                where: { businessId, supplierId: { in: supplierIds } },
                _sum: { amount: true },
            }),
            this.prisma.supplierCreditNote.groupBy({
                by: ['supplierId'],
                where: { businessId, supplierId: { in: supplierIds }, status: 'ACTIVE' },
                _sum: { totalAmount: true },
            }),
            this.prisma.supplier.findMany({
                where: { businessId, id: { in: supplierIds } },
                select: { id: true, openingBalance: true, openingBalanceType: true },
            }),
        ]);
        const result = {};
        for (const supplierId of supplierIds) {
            const sup = supplierRows.find((s) => s.id === supplierId);
            const opening = Number(sup?.openingBalance ?? 0);
            const openingAmt = (sup?.openingBalanceType ?? 'DEBIT') === 'DEBIT' ? opening : -opening;
            const grnTotal = Number(grns.find((g) => g.supplierId === supplierId)?._sum.grandTotal ?? 0);
            const paidTotal = Number(payments.find((p) => p.supplierId === supplierId)?._sum.amount ?? 0);
            const creditTotal = Number(credits.find((c) => c.supplierId === supplierId)?._sum.totalAmount ?? 0);
            result[supplierId] = openingAmt + grnTotal - paidTotal - creditTotal;
        }
        return result;
    }
    async findOne(businessId, id) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, businessId },
        });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        const stats = await this.prisma.purchase.aggregate({
            where: { supplierId: id, businessId, status: 'APPROVED' },
            _sum: { grandTotal: true, paidAmount: true },
            _count: { id: true },
        });
        const recentPurchases = await this.prisma.purchase.findMany({
            where: { supplierId: id, businessId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true,
                grandTotal: true, paidAmount: true, status: true, createdAt: true,
            },
        });
        return {
            ...supplier,
            stats: {
                totalOrders: stats._count.id,
                totalPurchased: Number(stats._sum.grandTotal ?? 0),
                totalPaid: Number(stats._sum.paidAmount ?? 0),
                outstandingBalance: Number(supplier.outstandingBalance),
            },
            recentPurchases,
        };
    }
    async update(businessId, id, dto) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        if (dto.gstin && dto.gstin !== supplier.gstin) {
            const conflict = await this.prisma.supplier.findFirst({
                where: { businessId, gstin: dto.gstin, isActive: true, id: { not: id } },
            });
            if (conflict)
                throw new common_1.ConflictException(`GSTIN ${dto.gstin} already in use`);
        }
        return this.prisma.supplier.update({
            where: { id },
            data: {
                name: dto.name !== undefined ? tcField(dto.name) ?? dto.name : undefined,
                gstin: dto.gstin,
                phone: dto.phone,
                email: dto.email,
                address: dto.address,
                stateCode: dto.stateCode,
                paymentTermsDays: dto.paymentTermsDays,
                creditLimit: dto.creditLimit,
                isGstRegistered: dto.isGstRegistered,
                isActive: dto.isActive,
            },
        });
    }
    async updateOpeningBalance(businessId, id, dto) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        return this.prisma.supplier.update({
            where: { id },
            data: {
                openingBalance: dto.openingBalance,
                openingBalanceType: dto.openingBalanceType ?? 'DEBIT',
                openingBalanceDate: dto.openingBalanceDate ? new Date(dto.openingBalanceDate) : null,
                openingBalanceNote: dto.openingBalanceNote ?? null,
            },
        });
    }
    async getSupplierBalance(businessId, supplierId) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        const [purchaseAgg, paymentAgg, creditNoteAgg] = await Promise.all([
            this.prisma.purchase.aggregate({
                where: { supplierId, businessId, status: 'APPROVED' },
                _sum: { grandTotal: true },
            }),
            this.prisma.supplierPayment.aggregate({
                where: { supplierId, businessId },
                _sum: { amount: true },
            }),
            this.prisma.supplierCreditNote.aggregate({
                where: { supplierId, businessId, status: 'ACTIVE' },
                _sum: { totalAmount: true },
            }),
        ]);
        const openingBal = Number(supplier.openingBalance ?? 0);
        const totalPurchase = Number(purchaseAgg._sum.grandTotal ?? 0);
        const totalPaid = Number(paymentAgg._sum.amount ?? 0);
        const totalCreditNotes = Number(creditNoteAgg._sum.totalAmount ?? 0);
        const openingDebit = supplier.openingBalanceType === 'DEBIT' ? openingBal : 0;
        const openingCredit = supplier.openingBalanceType === 'CREDIT' ? openingBal : 0;
        const balance = openingDebit + totalPurchase - totalPaid - totalCreditNotes - openingCredit;
        return {
            supplierId,
            supplierName: supplier.name,
            openingBalance: openingBal,
            openingBalanceType: supplier.openingBalanceType,
            totalPurchases: totalPurchase,
            totalPaid,
            totalCreditNotes,
            balance,
            balanceDue: balance,
        };
    }
    async getSupplierLedger(businessId, supplierId) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        const [purchases, payments, creditNotes] = await Promise.all([
            this.prisma.purchase.findMany({
                where: { supplierId, businessId, status: 'APPROVED' },
                select: {
                    id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true,
                    grandTotal: true, createdAt: true,
                },
                orderBy: { invoiceDate: 'asc' },
            }),
            this.prisma.supplierPayment.findMany({
                where: { supplierId, businessId },
                orderBy: { paymentDate: 'asc' },
            }),
            this.prisma.supplierCreditNote.findMany({
                where: { supplierId, businessId, status: 'ACTIVE' },
                orderBy: { cnDate: 'asc' },
            }),
        ]);
        const entries = [];
        if (Number(supplier.openingBalance) > 0) {
            entries.push({
                date: supplier.openingBalanceDate ?? supplier.createdAt,
                type: 'OPENING',
                description: supplier.openingBalanceNote ?? 'Opening Balance',
                debit: supplier.openingBalanceType === 'DEBIT' ? Number(supplier.openingBalance) : 0,
                credit: supplier.openingBalanceType === 'CREDIT' ? Number(supplier.openingBalance) : 0,
            });
        }
        for (const p of purchases) {
            entries.push({
                date: p.invoiceDate,
                type: 'PURCHASE',
                description: `GRN ${p.grnNumber ?? ''} / Inv ${p.invoiceNumber}`,
                debit: Number(p.grandTotal),
                credit: 0,
                referenceId: p.id,
            });
        }
        for (const pay of payments) {
            entries.push({
                date: pay.paymentDate,
                type: 'PAYMENT',
                description: `Payment - ${pay.paymentMode}${pay.referenceNumber ? ' / ' + pay.referenceNumber : ''}`,
                debit: 0,
                credit: Number(pay.amount),
                referenceId: pay.id,
            });
        }
        for (const cn of creditNotes) {
            entries.push({
                date: cn.cnDate,
                type: 'CREDIT_NOTE',
                description: `Credit Note ${cn.scnNumber} - ${cn.reason}`,
                debit: 0,
                credit: Number(cn.totalAmount),
                referenceId: cn.id,
            });
        }
        entries.sort((a, b) => a.date.getTime() - b.date.getTime());
        let runningBalance = 0;
        const ledger = entries.map(e => {
            runningBalance = runningBalance + e.debit - e.credit;
            return { ...e, balance: runningBalance };
        });
        return { supplier: { id: supplier.id, name: supplier.name }, ledger };
    }
    async addPayment(businessId, supplierId, dto) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        if (dto.amount <= 0)
            throw new common_1.BadRequestException('Amount must be greater than 0');
        if (dto.purchaseId) {
            const purchase = await this.prisma.purchase.findFirst({
                where: { id: dto.purchaseId, businessId, supplierId },
            });
            if (!purchase)
                throw new common_1.NotFoundException('GRN not found for this supplier');
        }
        return this.prisma.supplierPayment.create({
            data: {
                businessId,
                supplierId,
                purchaseId: dto.purchaseId ?? null,
                invoiceReference: dto.invoiceReference ?? null,
                paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
                amount: dto.amount,
                paymentMode: dto.paymentMode,
                referenceNumber: dto.referenceNumber ?? null,
                notes: dto.notes ?? null,
                createdById: dto.createdById ?? null,
                createdByName: dto.createdByName,
            },
        });
    }
    async getPayments(businessId, supplierId, query) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        const page = Math.max(1, parseInt(query.page ?? '1'));
        const limit = Math.min(100, parseInt(query.limit ?? '50'));
        const skip = (page - 1) * limit;
        const where = { businessId, supplierId };
        if (query.purchaseId)
            where.purchaseId = query.purchaseId;
        const [payments, total] = await this.prisma.$transaction([
            this.prisma.supplierPayment.findMany({
                where,
                orderBy: { paymentDate: 'desc' },
                skip,
                take: limit,
                include: {
                    purchase: { select: { id: true, grnNumber: true, invoiceNumber: true, grandTotal: true } },
                },
            }),
            this.prisma.supplierPayment.count({ where }),
        ]);
        return { data: payments, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
    async deletePayment(businessId, supplierId, paymentId) {
        const payment = await this.prisma.supplierPayment.findFirst({
            where: { id: paymentId, businessId, supplierId },
        });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        await this.prisma.supplierPayment.delete({ where: { id: paymentId } });
        return { message: 'Payment deleted' };
    }
    async getGrnPaymentSummary(businessId, purchaseId) {
        try {
            const purchase = await this.prisma.purchase.findFirst({
                where: { id: purchaseId, businessId },
                select: { id: true, grandTotal: true, supplierId: true, status: true },
            });
            if (!purchase)
                throw new common_1.NotFoundException('GRN not found');
            const [paymentAgg, cnAgg] = await Promise.all([
                this.prisma.supplierPayment.aggregate({
                    where: { purchaseId, businessId },
                    _sum: { amount: true },
                }),
                this.prisma.supplierCreditNote.aggregate({
                    where: { originalGrnId: purchaseId, businessId, status: 'ACTIVE' },
                    _sum: { totalAmount: true },
                }),
            ]);
            const grandTotal = Number(purchase.grandTotal);
            const totalPaid = Number(paymentAgg._sum.amount ?? 0);
            const totalCreditNotes = Number(cnAgg._sum.totalAmount ?? 0);
            const balance = grandTotal - totalPaid - totalCreditNotes;
            return {
                purchaseId,
                grandTotal,
                totalPaid,
                totalCreditNotes,
                balance,
                isPaid: balance <= 0,
            };
        }
        catch (err) {
            if (err?.status === 404)
                throw err;
            return { purchaseId, grandTotal: 0, totalPaid: 0, totalCreditNotes: 0, balance: 0, isPaid: false };
        }
    }
    async getSupplierCreditNotes(businessId, supplierId, query) {
        const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        const page = Math.max(1, parseInt(query.page ?? '1'));
        const limit = Math.min(100, parseInt(query.limit ?? '20'));
        const skip = (page - 1) * limit;
        const [data, total] = await this.prisma.$transaction([
            this.prisma.supplierCreditNote.findMany({
                where: { supplierId, businessId },
                orderBy: { cnDate: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.supplierCreditNote.count({ where: { supplierId, businessId } }),
        ]);
        return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SuppliersService);
//# sourceMappingURL=suppliers.service.js.map