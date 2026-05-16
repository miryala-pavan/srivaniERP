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
exports.GrnService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const grn_calculations_service_1 = require("./grn-calculations.service");
let GrnService = class GrnService {
    prisma;
    calc;
    notifications;
    constructor(prisma, calc, notifications) {
        this.prisma = prisma;
        this.calc = calc;
        this.notifications = notifications;
    }
    r2(n) { return Math.round(n * 100) / 100; }
    async searchProductsForGrn(q, businessId) {
        if (!q?.trim())
            return [];
        const term = q.trim();
        const products = await this.prisma.product.findMany({
            where: {
                businessId,
                isActive: true,
                isManuallyDisabled: false,
                OR: [
                    { name: { contains: term, mode: 'insensitive' } },
                    { shortName: { contains: term, mode: 'insensitive' } },
                    { barcode: { equals: term } },
                    { productCode: { contains: term } },
                ],
            },
            take: 15,
            orderBy: { productCode: 'asc' },
            include: {
                tax: { select: { taxRate: true, taxName: true } },
                category: { select: { name: true } },
                brand: { select: { name: true } },
            },
        });
        const productIds = products.map((p) => p.id);
        const branch = await this.prisma.branch.findFirst({
            where: { businessId, isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        const stockMap = new Map();
        if (branch && productIds.length > 0) {
            const aggs = await this.prisma.stockLedger.groupBy({
                by: ['productId'],
                where: { productId: { in: productIds }, branchId: branch.id },
                _sum: { quantity: true },
            });
            for (const a of aggs)
                stockMap.set(a.productId, Number(a._sum.quantity ?? 0));
        }
        return products.map((p) => ({
            id: p.id,
            productCode: p.productCode ?? '',
            name: p.name,
            shortName: p.shortName ?? null,
            hsnCode: p.hsnCode ?? '',
            barcode: p.barcode ?? null,
            categoryLabel: p.category?.name ?? '',
            unitOfMeasure: p.unitOfMeasure,
            mrp: Number(p.mrp),
            sellingPrice: Number(p.sellingPrice),
            costPrice: p.costPrice ? Number(p.costPrice) : null,
            gstRate: Number(p.tax?.taxRate ?? 0),
            gstRatePercent: Number(p.tax?.taxRate ?? 0),
            gstName: p.tax?.taxName ?? 'No Tax',
            cessRate: Number(p.cessRate ?? 0),
            defaultPackSize: Number(p.defaultPackSize ?? 1),
            expiryTracking: p.expiryTracking ?? false,
            allowNegativeStock: p.allowNegativeStock,
            currentStock: stockMap.get(p.id) ?? 0,
        }));
    }
    async getActiveFy(businessId) {
        const fy = await this.prisma.financialYear.findFirst({
            where: { businessId, isActive: true },
            orderBy: { startDate: 'desc' },
        });
        if (!fy)
            throw new common_1.BadRequestException('No active financial year. Complete business setup first.');
        return fy;
    }
    async generateGrnNumber(businessId) {
        const fy = await this.getActiveFy(businessId);
        const series = await this.prisma.billSeries.findFirst({
            where: { businessId, financialYearId: fy.id, billType: 'GRN', isActive: true },
        });
        if (!series)
            throw new common_1.BadRequestException('GRN bill series not configured. Run Admin → Seed.');
        const updated = await this.prisma.billSeries.update({
            where: { id: series.id },
            data: { currentNumber: { increment: 1 } },
        });
        const padLen = updated.numberFormat.length;
        return `${updated.seriesPrefix}${fy.fyCode}/${String(updated.currentNumber).padStart(padLen, '0')}`;
    }
    async resolveInterState(businessId, supplierGstin) {
        if (!supplierGstin)
            return false;
        const biz = await this.prisma.business.findUnique({
            where: { id: businessId },
            select: { stateCode: true },
        });
        const supplierState = supplierGstin.substring(0, 2);
        return !!(biz?.stateCode && supplierState && supplierState !== biz.stateCode);
    }
    async fetchProducts(businessId, productIds) {
        const unique = [...new Set(productIds)];
        const products = await this.prisma.product.findMany({
            where: { id: { in: unique }, businessId },
            include: { tax: true },
        });
        if (products.length !== unique.length)
            throw new common_1.BadRequestException('One or more products not found');
        return products;
    }
    buildItemsData(items, products, isInterState, taxType, freightCharges, hamaliCharges) {
        const productMap = new Map(products.map((p) => [p.id, p]));
        const rawCalcs = items.map((item) => {
            const product = productMap.get(item.productId);
            return this.calc.calculateItemTotals(item, Number(product.tax.taxRate), taxType, isInterState);
        });
        const spreadCalcs = this.calc.spreadAdjustments(rawCalcs, freightCharges, hamaliCharges);
        return items.map((item, i) => {
            const product = productMap.get(item.productId);
            const c = spreadCalcs[i];
            const gstRate = Number(product.tax.taxRate);
            const rejectedQty = item.rejectedQty ?? 0;
            const acceptedQty = this.r2(c.totalReceivedQty - rejectedQty);
            return {
                productId: item.productId,
                taxId: product.taxId,
                productName: product.name,
                hsnCode: product.hsnCode,
                quantity: c.totalReceivedQty,
                freeQuantity: c.totalFreeQty,
                unitPrice: c.netCostPrice,
                schemeDiscountPercent: 0,
                retailerDiscountPercent: 0,
                taxableAmount: c.taxable,
                gstRatePercent: gstRate,
                cgstAmount: c.cgstAmount,
                sgstAmount: c.sgstAmount,
                igstAmount: c.igstAmount,
                totalAmount: c.lineTotal,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                batchNumber: item.batchNumber ?? null,
                pluCode: item.pluCode ?? null,
                supplierProductName: item.supplierProductName ?? null,
                mrp: item.mrp,
                sellingPrice: item.sellingPrice ?? null,
                basicCostPrice: item.basicCostPrice,
                disc1Percent: item.disc1Percent ?? 0,
                disc2Percent: item.disc2Percent ?? 0,
                disc3Percent: item.disc3Percent ?? 0,
                disc4Percent: item.disc4Percent ?? 0,
                cashDiscPercent: item.cashDiscPercent ?? 0,
                cashDiscAmount: c.cashDiscAmount,
                netCostPrice: c.netCostPrice,
                casesReceived: item.casesReceived ?? 0,
                looseQty: item.looseQty ?? 0,
                packSize: item.packSize ?? 1,
                totalReceivedQty: c.totalReceivedQty,
                freeCases: item.freeCases ?? 0,
                freeLoose: item.freeLoose ?? 0,
                totalFreeQty: c.totalFreeQty,
                totalQty: c.totalQty,
                cessRate: item.cessRate ?? 0,
                cessAmount: c.cessAmount,
                manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
                rejectedQty,
                acceptedQty,
                rejectionReason: item.rejectionReason ?? null,
                rejectionAction: item.rejectionAction ?? null,
                hamaliShare: c.hamaliShare,
                freightShare: c.freightShare,
                trueCostPrice: c.trueCostPrice,
                lastCostPrice: product.costPrice ? Number(product.costPrice) : null,
                priceChanged: false,
                lineTotal: c.lineTotal,
                unitOfMeasure: product.unitOfMeasure ?? 'PCS',
            };
        });
    }
    buildPurchaseData(businessId, dto, supplier, isInterState, billTotals, grnNumber, status) {
        const freightCharges = dto.freightCharges ?? 0;
        const hamaliCharges = dto.hamaliCharges ?? 0;
        const otherCharges = dto.otherCharges ?? 0;
        const roundingAmount = dto.roundingAmount ?? 0;
        const billDiscPct = dto.billDiscountPercent ?? 0;
        const advanceAdjusted = dto.advanceAdjusted ?? 0;
        return {
            businessId,
            branchId: dto.branchId,
            supplierId: dto.supplierId,
            supplierName: supplier.name,
            supplierGstin: supplier.gstin,
            grnNumber,
            invoiceNumber: dto.invoiceNumber,
            invoiceDate: new Date(dto.invoiceDate),
            invoiceControlTotal: dto.invoiceControlTotal ?? null,
            taxType: dto.taxType ?? 'TAX_EXCLUSIVE',
            itcEligibility: dto.itcEligibility ?? 'ELIGIBLE',
            rcmApplicable: dto.rcmApplicable ?? false,
            documentType: dto.documentType ?? 'INVOICE',
            placeOfSupply: dto.placeOfSupply ?? null,
            isInterState,
            poNumber: dto.poNumber ?? null,
            taxableAmount: billTotals.taxableTotal,
            totalTaxAmount: billTotals.totalTaxAmount,
            cgstTotal: billTotals.cgstTotal,
            sgstTotal: billTotals.sgstTotal,
            igstTotal: billTotals.igstTotal,
            cessTotal: billTotals.cessTotal,
            billDiscountPercent: billDiscPct,
            billDiscountAmount: billTotals.billDiscountAmount,
            cashDiscountPercent: dto.cashDiscountPercent ?? 0,
            cashDiscountAmount: 0,
            freightCharges,
            hamaliCharges,
            otherCharges,
            roundingAmount,
            grandTotal: billTotals.grandTotal,
            advanceAdjusted,
            amountPayable: this.r2(billTotals.grandTotal - advanceAdjusted),
            balanceAmount: this.r2(billTotals.grandTotal - advanceAdjusted),
            paymentDueDate: dto.paymentDueDate ? new Date(dto.paymentDueDate) : null,
            paymentMode: dto.paymentMode ?? null,
            paymentReference: dto.paymentReference ?? null,
            paymentNotes: dto.paymentNotes ?? null,
            receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : new Date(),
            status,
            notes: dto.notes ?? null,
        };
    }
    async create(businessId, dto) {
        const [supplier, branch] = await Promise.all([
            this.prisma.supplier.findFirst({ where: { id: dto.supplierId, businessId } }),
            this.prisma.branch.findFirst({ where: { id: dto.branchId, businessId } }),
        ]);
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        if (!branch)
            throw new common_1.NotFoundException('Branch not found');
        const duplicate = await this.prisma.purchase.findFirst({
            where: { businessId, supplierId: dto.supplierId, invoiceNumber: dto.invoiceNumber },
        });
        if (duplicate)
            throw new common_1.ConflictException(`Invoice ${dto.invoiceNumber} already exists for this supplier`);
        const products = await this.fetchProducts(businessId, dto.items.map((i) => i.productId));
        const isInterState = await this.resolveInterState(businessId, supplier.gstin);
        const taxType = dto.taxType ?? 'TAX_EXCLUSIVE';
        const freightCharges = dto.freightCharges ?? 0;
        const hamaliCharges = dto.hamaliCharges ?? 0;
        const otherCharges = dto.otherCharges ?? 0;
        const roundingAmount = dto.roundingAmount ?? 0;
        const billDiscPct = dto.billDiscountPercent ?? 0;
        const itemsData = this.buildItemsData(dto.items, products, isInterState, taxType, freightCharges, hamaliCharges);
        const billTotals = this.calc.calculateBillTotals(itemsData.map((i) => ({
            taxable: Number(i.taxableAmount), cgstAmount: Number(i.cgstAmount),
            sgstAmount: Number(i.sgstAmount), igstAmount: Number(i.igstAmount),
            cessAmount: Number(i.cessAmount), lineTotal: Number(i.lineTotal),
        })), billDiscPct, freightCharges, hamaliCharges, otherCharges, roundingAmount);
        const isDraft = dto.isDraft ?? false;
        if (!isDraft && dto.invoiceControlTotal !== undefined) {
            this.calc.validateInvoiceControlTotal(billTotals.grandTotal, dto.invoiceControlTotal);
        }
        const grnNumber = isDraft ? null : await this.generateGrnNumber(businessId);
        const status = isDraft ? 'DRAFT' : 'PENDING_APPROVAL';
        const purchaseData = this.buildPurchaseData(businessId, dto, supplier, isInterState, billTotals, grnNumber, status);
        const purchase = await this.prisma.purchase.create({
            data: { ...purchaseData, items: { create: itemsData } },
            include: { items: true, supplier: { select: { id: true, name: true, phone: true } } },
        });
        if (!isDraft) {
            this.notifications.create({
                businessId,
                type: 'GRN_PENDING',
                priority: 'HIGH',
                title: 'GRN Pending Approval',
                message: `GRN ${grnNumber} from ${supplier.name} (Rs.${billTotals.grandTotal}) needs approval.`,
                supplierId: dto.supplierId,
                purchaseId: purchase.id,
                actionUrl: '/dashboard/grn',
                actionLabel: 'Review GRN',
            }).catch(() => { });
        }
        return purchase;
    }
    async update(businessId, id, dto) {
        const existing = await this.prisma.purchase.findFirst({ where: { id, businessId } });
        if (!existing)
            throw new common_1.NotFoundException('GRN not found');
        if (existing.status === 'CANCELLED')
            throw new common_1.BadRequestException('Cannot edit a cancelled GRN');
        const existingStatus = existing.status;
        const majorChange = existingStatus === 'APPROVED' && ((dto.supplierId !== undefined && dto.supplierId !== existing.supplierId) ||
            (dto.invoiceNumber !== undefined && dto.invoiceNumber !== existing.invoiceNumber));
        const supplierId = dto.supplierId ?? existing.supplierId;
        const branchId = dto.branchId ?? existing.branchId;
        const invoiceNumber = dto.invoiceNumber ?? existing.invoiceNumber;
        const [supplier, branch] = await Promise.all([
            this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } }),
            this.prisma.branch.findFirst({ where: { id: branchId, businessId } }),
        ]);
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        if (!branch)
            throw new common_1.NotFoundException('Branch not found');
        if (dto.supplierId || dto.invoiceNumber) {
            const conflict = await this.prisma.purchase.findFirst({
                where: { businessId, supplierId, invoiceNumber, NOT: { id } },
            });
            if (conflict)
                throw new common_1.ConflictException(`Invoice ${invoiceNumber} already exists for this supplier`);
        }
        const taxType = dto.taxType ?? existing.taxType ?? 'TAX_EXCLUSIVE';
        const freightCharges = dto.freightCharges ?? Number(existing.freightCharges ?? 0);
        const hamaliCharges = dto.hamaliCharges ?? Number(existing.hamaliCharges ?? 0);
        const otherCharges = dto.otherCharges ?? Number(existing.otherCharges ?? 0);
        const roundingAmount = dto.roundingAmount ?? Number(existing.roundingAmount ?? 0);
        const billDiscPct = dto.billDiscountPercent ?? Number(existing.billDiscountPercent ?? 0);
        const isInterState = await this.resolveInterState(businessId, supplier.gstin);
        let billTotals = null;
        let itemsData = [];
        if (dto.items && dto.items.length > 0) {
            const products = await this.fetchProducts(businessId, dto.items.map((i) => i.productId));
            itemsData = this.buildItemsData(dto.items, products, isInterState, taxType, freightCharges, hamaliCharges);
            billTotals = this.calc.calculateBillTotals(itemsData.map((i) => ({
                taxable: Number(i.taxableAmount), cgstAmount: Number(i.cgstAmount),
                sgstAmount: Number(i.sgstAmount), igstAmount: Number(i.igstAmount),
                cessAmount: Number(i.cessAmount), lineTotal: Number(i.lineTotal),
            })), billDiscPct, freightCharges, hamaliCharges, otherCharges, roundingAmount);
        }
        const advanceAdjusted = dto.advanceAdjusted ?? Number(existing.advanceAdjusted ?? 0);
        await this.prisma.$transaction(async (tx) => {
            if (itemsData.length > 0) {
                await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
                await tx.purchaseItem.createMany({ data: itemsData.map((d) => ({ ...d, purchaseId: id })) });
            }
            await tx.purchase.update({
                where: { id },
                data: {
                    supplierId,
                    supplierName: supplier.name,
                    supplierGstin: supplier.gstin,
                    branchId,
                    invoiceNumber,
                    ...(dto.invoiceDate ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
                    ...(dto.invoiceControlTotal !== undefined ? { invoiceControlTotal: dto.invoiceControlTotal } : {}),
                    taxType,
                    ...(dto.itcEligibility ? { itcEligibility: dto.itcEligibility } : {}),
                    ...(dto.rcmApplicable !== undefined ? { rcmApplicable: dto.rcmApplicable } : {}),
                    ...(dto.documentType ? { documentType: dto.documentType } : {}),
                    ...(dto.placeOfSupply !== undefined ? { placeOfSupply: dto.placeOfSupply } : {}),
                    isInterState,
                    ...(dto.poNumber !== undefined ? { poNumber: dto.poNumber } : {}),
                    ...(billTotals ? {
                        taxableAmount: billTotals.taxableTotal,
                        totalTaxAmount: billTotals.totalTaxAmount,
                        cgstTotal: billTotals.cgstTotal,
                        sgstTotal: billTotals.sgstTotal,
                        igstTotal: billTotals.igstTotal,
                        cessTotal: billTotals.cessTotal,
                        billDiscountPercent: billDiscPct,
                        billDiscountAmount: billTotals.billDiscountAmount,
                        freightCharges,
                        hamaliCharges,
                        otherCharges,
                        roundingAmount,
                        grandTotal: billTotals.grandTotal,
                        advanceAdjusted,
                        amountPayable: this.r2(billTotals.grandTotal - advanceAdjusted),
                        balanceAmount: this.r2(billTotals.grandTotal - advanceAdjusted),
                    } : {}),
                    ...(dto.paymentDueDate ? { paymentDueDate: new Date(dto.paymentDueDate) } : {}),
                    ...(dto.paymentMode !== undefined ? { paymentMode: dto.paymentMode } : {}),
                    ...(dto.paymentReference !== undefined ? { paymentReference: dto.paymentReference } : {}),
                    ...(dto.paymentNotes !== undefined ? { paymentNotes: dto.paymentNotes } : {}),
                    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
                    ...(majorChange ? { status: 'DRAFT', grnNumber: null, approvedByName: null, approvedAt: null } : {}),
                },
            });
            if (existingStatus === 'APPROVED' && !majorChange && itemsData.length > 0) {
                await tx.stockLedger.deleteMany({
                    where: { referenceId: id, movementType: 'PURCHASE', businessId },
                });
                for (const item of itemsData) {
                    await tx.stockLedger.create({
                        data: {
                            businessId,
                            branchId,
                            productId: item.productId,
                            movementType: 'PURCHASE',
                            quantity: Number(item.acceptedQty ?? item.totalQty ?? 0),
                            referenceType: 'PURCHASE',
                            referenceId: id,
                            notes: `GRN ${existing.grnNumber} updated`,
                        },
                    });
                }
            }
        });
        return this.findOne(businessId, id);
    }
    async submit(businessId, id) {
        const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
        if (!purchase)
            throw new common_1.NotFoundException('GRN not found');
        if (purchase.status !== 'DRAFT')
            throw new common_1.BadRequestException('Only DRAFT GRNs can be submitted');
        const grnNumber = await this.generateGrnNumber(businessId);
        const updated = await this.prisma.purchase.update({
            where: { id },
            data: { grnNumber, status: 'PENDING_APPROVAL' },
        });
        this.notifications.create({
            businessId,
            type: 'GRN_PENDING',
            priority: 'HIGH',
            title: 'GRN Pending Approval',
            message: `GRN ${grnNumber} from ${purchase.supplierName} needs approval.`,
            supplierId: purchase.supplierId,
            purchaseId: id,
            actionUrl: '/dashboard/grn',
            actionLabel: 'Review GRN',
        }).catch(() => { });
        return updated;
    }
    async approve(businessId, id, approverName, notes) {
        const purchase = await this.prisma.purchase.findFirst({
            where: { id, businessId },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, costPrice: true, sellingPrice: true, mrp: true, autoInactiveReason: true } },
                    },
                },
            },
        });
        if (!purchase)
            throw new common_1.NotFoundException('GRN not found');
        if (purchase.status !== 'PENDING_APPROVAL') {
            throw new common_1.BadRequestException(`Cannot approve a GRN with status ${purchase.status}`);
        }
        const stockEntries = purchase.items.map((item) => ({
            businessId,
            branchId: purchase.branchId,
            productId: item.productId,
            movementType: 'PURCHASE',
            quantity: Number(item.acceptedQty ?? 0) > 0
                ? Number(item.acceptedQty)
                : Number(item.totalQty ?? item.quantity),
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            notes: `GRN ${purchase.grnNumber} approved`,
        }));
        const priceUpdates = purchase.items.map((item) => {
            const updateData = {
                costPrice: Number(item.trueCostPrice) || Number(item.netCostPrice) || Number(item.unitPrice),
            };
            if (item.mrp !== null)
                updateData.mrp = Number(item.mrp);
            if (item.sellingPrice !== null)
                updateData.sellingPrice = Number(item.sellingPrice);
            return this.prisma.product.update({ where: { id: item.productId }, data: updateData });
        });
        const priceChangedUpdates = purchase.items
            .filter((item) => item.sellingPrice !== null && item.product)
            .map((item) => {
            const oldPrice = Number(item.product.sellingPrice ?? 0);
            const newPrice = Number(item.sellingPrice ?? 0);
            const changed = newPrice > 0 && newPrice !== oldPrice;
            if (!changed)
                return null;
            const changePct = oldPrice > 0 ? this.r2((newPrice - oldPrice) / oldPrice * 100) : null;
            return this.prisma.purchaseItem.update({
                where: { id: item.id },
                data: { priceChanged: true, priceChangePct: changePct },
            });
        })
            .filter((u) => u !== null);
        await this.prisma.$transaction([
            this.prisma.purchase.update({
                where: { id },
                data: {
                    status: 'APPROVED',
                    approvedAt: new Date(),
                    approvedByName: approverName ?? null,
                    ...(notes ? { notes } : {}),
                },
            }),
            ...stockEntries.map((e) => this.prisma.stockLedger.create({ data: e })),
            ...priceUpdates,
            ...priceChangedUpdates,
        ]);
        this.handlePluUpsert(businessId, purchase.items.map((i) => ({ ...i, purchaseId: id }))).catch(() => { });
        this.handleRestockNotifications(businessId, purchase.branchId, purchase.items, purchase.grnNumber ?? '').catch(() => { });
        return this.findOne(businessId, id);
    }
    async handlePluUpsert(businessId, items) {
        for (const item of items) {
            if (!item.pluCode)
                continue;
            try {
                await this.prisma.productPlu.upsert({
                    where: { pluCode: item.pluCode },
                    create: {
                        businessId,
                        productId: item.productId,
                        pluCode: item.pluCode,
                        costPrice: Number(item.netCostPrice ?? item.unitPrice),
                        mrp: Number(item.mrp ?? 0),
                        sellingPrice: Number(item.sellingPrice ?? 0),
                        grnId: item.purchaseId ?? null,
                        batchNumber: item.batchNumber ?? null,
                        manufacturingDate: item.manufacturingDate ?? null,
                        expiryDate: item.expiryDate ?? null,
                        receivedQty: Number(item.totalQty ?? item.quantity ?? 0),
                        stockOnHand: Number(item.acceptedQty ?? item.totalQty ?? item.quantity ?? 0),
                    },
                    update: {
                        costPrice: Number(item.netCostPrice ?? item.unitPrice),
                        mrp: Number(item.mrp ?? 0),
                        sellingPrice: Number(item.sellingPrice ?? 0),
                    },
                });
            }
            catch { }
        }
    }
    async handleRestockNotifications(businessId, branchId, items, grnNumber) {
        const uniqueIds = [...new Set(items.map((i) => i.productId))];
        for (const productId of uniqueIds) {
            try {
                const agg = await this.prisma.stockLedger.aggregate({
                    where: { productId, branchId },
                    _sum: { quantity: true },
                });
                const newStock = Number(agg._sum.quantity ?? 0);
                if (newStock <= 0)
                    continue;
                const product = await this.prisma.product.findUnique({
                    where: { id: productId },
                    select: { name: true, autoInactiveReason: true },
                });
                if (!product)
                    continue;
                if (product.autoInactiveReason === 'OUT_OF_STOCK') {
                    await this.prisma.product.update({ where: { id: productId }, data: { autoInactiveReason: null } });
                    await this.notifications.create({
                        businessId, productId,
                        type: 'RESTOCKED', priority: 'NORMAL',
                        title: `Restocked: ${product.name}`,
                        message: `Stock replenished via GRN ${grnNumber}. Product active in POS.`,
                    });
                }
            }
            catch { }
        }
    }
    async reject(businessId, id, rejectorName, reason) {
        const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
        if (!purchase)
            throw new common_1.NotFoundException('GRN not found');
        if (!['PENDING_APPROVAL', 'DRAFT'].includes(purchase.status)) {
            throw new common_1.BadRequestException(`Cannot reject a GRN with status ${purchase.status}`);
        }
        return this.prisma.purchase.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectedByName: rejectorName ?? null,
                ...(reason ? { notes: reason } : {}),
            },
        });
    }
    async cancel(businessId, id) {
        const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
        if (!purchase)
            throw new common_1.NotFoundException('GRN not found');
        if (purchase.status !== 'DRAFT')
            throw new common_1.BadRequestException('Only DRAFT GRNs can be cancelled');
        return this.prisma.purchase.update({ where: { id }, data: { status: 'CANCELLED' } });
    }
    async deleteGrn(businessId, id) {
        const grn = await this.prisma.purchase.findFirst({ where: { id, businessId } });
        if (!grn)
            throw new common_1.NotFoundException('GRN not found');
        if (grn.status !== 'DRAFT')
            throw new common_1.BadRequestException('Only DRAFT GRNs can be deleted');
        await this.prisma.$transaction([
            this.prisma.purchaseItem.deleteMany({ where: { purchaseId: id } }),
            this.prisma.purchase.delete({ where: { id } }),
        ]);
        return { success: true };
    }
    async revertToDraft(businessId, id) {
        const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
        if (!purchase)
            throw new common_1.NotFoundException('GRN not found');
        if (!['REJECTED', 'PENDING_APPROVAL'].includes(purchase.status)) {
            throw new common_1.BadRequestException(`Cannot revert a GRN with status ${purchase.status} to Draft`);
        }
        return this.prisma.purchase.update({
            where: { id },
            data: { status: 'DRAFT', grnNumber: null, rejectedByName: null },
        });
    }
    async findAll(businessId, query) {
        const page = Math.max(1, parseInt(query.page ?? '1'));
        const limit = Math.min(100, parseInt(query.limit ?? '20'));
        const skip = (page - 1) * limit;
        const where = { businessId };
        if (query.status)
            where.status = query.status;
        if (query.excludeStatus)
            where.status = { not: query.excludeStatus };
        if (query.supplierId)
            where.supplierId = query.supplierId;
        if (query.invoiceNumber)
            where.invoiceNumber = query.invoiceNumber;
        if (query.startDate || query.endDate) {
            where.invoiceDate = {};
            if (query.startDate)
                where.invoiceDate.gte = new Date(query.startDate);
            if (query.endDate)
                where.invoiceDate.lte = new Date(query.endDate);
        }
        const [data, total] = await this.prisma.$transaction([
            this.prisma.purchase.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true,
                    supplierName: true, supplierId: true,
                    grandTotal: true, taxableAmount: true, totalTaxAmount: true,
                    invoiceControlTotal: true, receivedDate: true,
                    paidAmount: true, status: true, createdAt: true, notes: true,
                    _count: { select: { items: true } },
                },
            }),
            this.prisma.purchase.count({ where }),
        ]);
        return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
    async findOne(businessId, id) {
        const purchase = await this.prisma.purchase.findFirst({
            where: { id, businessId },
            include: {
                items: {
                    include: {
                        product: { select: { id: true, name: true, unitOfMeasure: true } },
                        tax: { select: { id: true, taxName: true, taxRate: true } },
                    },
                },
                supplier: true,
                branch: { select: { id: true, name: true } },
            },
        });
        if (!purchase)
            throw new common_1.NotFoundException('GRN not found');
        return purchase;
    }
    async getSupplierAdvances(businessId, supplierId) {
        return this.prisma.supplierAdvance.findMany({
            where: { businessId, supplierId, status: 'AVAILABLE', balanceAmount: { gt: 0 } },
            orderBy: { paymentDate: 'desc' },
        });
    }
    async getPrintData(businessId, id) {
        const [purchase, business] = await Promise.all([
            this.prisma.purchase.findFirst({
                where: { id, businessId },
                include: {
                    items: {
                        include: {
                            product: { select: { id: true, name: true, unitOfMeasure: true, hsnCode: true, productCode: true } },
                            tax: { select: { id: true, taxName: true, taxRate: true } },
                        },
                        orderBy: { id: 'asc' },
                    },
                    supplier: { select: { id: true, name: true, gstin: true, phone: true, address: true, stateCode: true } },
                    branch: { select: { id: true, name: true } },
                },
            }),
            this.prisma.business.findUnique({
                where: { id: businessId },
                select: { name: true, address: true, phone: true, gstin: true, stateName: true, stateCode: true },
            }),
        ]);
        if (!purchase)
            throw new common_1.NotFoundException('GRN not found');
        return { purchase, business };
    }
    async getProductLastRates(businessId, productId) {
        const items = await this.prisma.purchaseItem.findMany({
            where: {
                productId,
                purchase: { businessId, status: 'APPROVED' },
            },
            orderBy: { purchase: { invoiceDate: 'desc' } },
            take: 5,
            include: {
                purchase: { select: { id: true, grnNumber: true, invoiceDate: true, supplierName: true } },
            },
        });
        return items.map((item) => ({
            grnId: item.purchaseId,
            grnNumber: item.purchase.grnNumber,
            invoiceDate: item.purchase.invoiceDate,
            supplierName: item.purchase.supplierName,
            basicCostPrice: Number(item.basicCostPrice ?? item.unitPrice),
            netCostPrice: Number(item.netCostPrice ?? item.unitPrice),
            trueCostPrice: Number(item.trueCostPrice ?? item.unitPrice),
            sellingPrice: item.sellingPrice !== null ? Number(item.sellingPrice) : null,
            mrp: item.mrp !== null ? Number(item.mrp) : null,
            cessRate: Number(item.cessRate ?? 0),
            gstRatePercent: Number(item.gstRatePercent),
        }));
    }
    async createSupplierCreditNote(businessId, userId, userName, dto) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id: dto.supplierId, businessId },
        });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        const business = await this.prisma.business.findUnique({
            where: { id: businessId },
            select: { stateCode: true },
        });
        const supplierState = supplier.gstin?.substring(0, 2) ?? null;
        const isInterstate = !!(supplierState && business?.stateCode && supplierState !== business.stateCode);
        const taxable = this.r2(dto.taxableAmount);
        const gstRate = dto.gstRate ?? 0;
        const gstAmount = this.r2(taxable * gstRate / 100);
        const cgst = isInterstate ? 0 : this.r2(gstAmount / 2);
        const sgst = isInterstate ? 0 : this.r2(gstAmount / 2);
        const igst = isInterstate ? gstAmount : 0;
        const cess = this.r2(dto.cessAmount ?? 0);
        const total = this.r2(taxable + gstAmount + cess);
        const fy = await this.getActiveFy(businessId);
        const scnNumber = await this.prisma.$transaction(async (tx) => {
            const series = await tx.billSeries.findFirst({
                where: { businessId, financialYearId: fy.id, billType: 'SCN', isActive: true },
            });
            if (!series)
                throw new common_1.BadRequestException('SCN bill series not configured. Run Admin seed.');
            const updated = await tx.billSeries.update({
                where: { id: series.id },
                data: { currentNumber: { increment: 1 } },
            });
            const padLen = updated.numberFormat.length;
            return `${updated.seriesPrefix}${fy.fyCode}/${String(updated.currentNumber).padStart(padLen, '0')}`;
        });
        const cn = await this.prisma.supplierCreditNote.create({
            data: {
                businessId,
                supplierId: dto.supplierId,
                originalGrnId: dto.originalGrnId ?? null,
                originalInvoiceNo: dto.originalInvoiceNo ?? null,
                supplierCnNumber: dto.supplierCnNumber ?? null,
                scnNumber,
                cnDate: new Date(dto.cnDate),
                reason: dto.reason,
                taxableAmount: taxable,
                cgstAmount: cgst,
                sgstAmount: sgst,
                igstAmount: igst,
                cessAmount: cess,
                totalAmount: total,
                itcReversal: dto.itcReversal ?? false,
                status: 'ACTIVE',
                notes: dto.notes ?? null,
                createdById: userId,
                createdByName: userName,
            },
        });
        await this.prisma.supplier.update({
            where: { id: dto.supplierId },
            data: { outstandingBalance: { decrement: total } },
        });
        return { ...cn, isInterstate };
    }
    async getSupplierCreditNotes(businessId, filters) {
        const page = Math.max(1, filters.page ?? 1);
        const limit = Math.min(100, filters.limit ?? 20);
        const skip = (page - 1) * limit;
        const where = { businessId };
        if (filters.supplierId)
            where.supplierId = filters.supplierId;
        if (filters.originalGrnId)
            where.originalGrnId = filters.originalGrnId;
        if (filters.dateFrom || filters.dateTo) {
            where.cnDate = {};
            if (filters.dateFrom)
                where.cnDate.gte = new Date(filters.dateFrom);
            if (filters.dateTo)
                where.cnDate.lte = new Date(filters.dateTo + 'T23:59:59');
        }
        const [data, total] = await this.prisma.$transaction([
            this.prisma.supplierCreditNote.findMany({
                where,
                orderBy: { cnDate: 'desc' },
                skip,
                take: limit,
                include: { supplier: { select: { id: true, name: true } } },
            }),
            this.prisma.supplierCreditNote.count({ where }),
        ]);
        return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
};
exports.GrnService = GrnService;
exports.GrnService = GrnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        grn_calculations_service_1.GrnCalculationsService,
        notifications_service_1.NotificationsService])
], GrnService);
//# sourceMappingURL=grn.service.js.map