import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GrnCalculationsService } from './grn-calculations.service';
import { CreateGrnDto } from './dto/create-grn.dto';
import { UpdateGrnDto } from './dto/update-grn.dto';
import { GrnQueryDto } from './dto/grn-query.dto';

@Injectable()
export class GrnService {
  constructor(
    private prisma: PrismaService,
    private calc: GrnCalculationsService,
    private notifications: NotificationsService,
  ) {}

  private r2(n: number) { return Math.round(n * 100) / 100; }

  // ── GRN PRODUCT SEARCH (no stock gate — receiving goods) ──────────────────────

  async searchProductsForGrn(q: string, businessId: string) {
    if (!q?.trim()) return [];
    const term = q.trim();

    const products = await this.prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        isManuallyDisabled: false,
        OR: [
          { name:        { contains: term, mode: 'insensitive' } },
          { shortName:   { contains: term, mode: 'insensitive' } },
          { barcode:     { equals: term } },
          { productCode: { contains: term } },
        ],
      },
      take: 15,
      orderBy: { productCode: 'asc' },
      include: {
        tax:      { select: { taxRate: true, taxName: true } },
        category: { select: { name: true } },
        brand:    { select: { name: true } },
      },
    });

    // Batch stock count
    const productIds = products.map((p) => p.id);
    const branch = await this.prisma.branch.findFirst({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const stockMap = new Map<string, number>();
    if (branch && productIds.length > 0) {
      const aggs = await this.prisma.stockLedger.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, branchId: branch.id },
        _sum: { quantity: true },
      });
      for (const a of aggs) stockMap.set(a.productId, Number(a._sum.quantity ?? 0));
    }

    return products.map((p) => ({
      id:                 p.id,
      productCode:        p.productCode ?? '',
      name:               p.name,
      shortName:          (p as any).shortName ?? null,
      hsnCode:            p.hsnCode ?? '',
      barcode:            p.barcode ?? null,
      categoryLabel:      (p as any).category?.name ?? '',
      unitOfMeasure:      p.unitOfMeasure,
      mrp:                Number(p.mrp),
      sellingPrice:       Number(p.sellingPrice),
      costPrice:          p.costPrice ? Number(p.costPrice) : null,
      gstRate:            Number((p as any).tax?.taxRate ?? 0),
      gstRatePercent:     Number((p as any).tax?.taxRate ?? 0),
      gstName:            (p as any).tax?.taxName ?? 'No Tax',
      cessRate:           Number((p as any).cessRate ?? 0),
      defaultPackSize:    Number((p as any).defaultPackSize ?? 1),
      expiryTracking:     (p as any).expiryTracking ?? false,
      allowNegativeStock: p.allowNegativeStock,
      currentStock:       stockMap.get(p.id) ?? 0,
    }));
  }

  private async getActiveFy(businessId: string) {
    const fy = await this.prisma.financialYear.findFirst({
      where: { businessId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!fy) throw new BadRequestException('No active financial year. Complete business setup first.');
    return fy;
  }

  private async generateGrnNumber(businessId: string): Promise<string> {
    const fy = await this.getActiveFy(businessId);
    const series = await this.prisma.billSeries.findFirst({
      where: { businessId, financialYearId: fy.id, billType: 'GRN', isActive: true },
    });
    if (!series) throw new BadRequestException('GRN bill series not configured. Run Admin → Seed.');
    const updated = await this.prisma.billSeries.update({
      where: { id: series.id },
      data: { currentNumber: { increment: 1 } },
    });
    const padLen = updated.numberFormat.length;
    return `${updated.seriesPrefix}${fy.fyCode}/${String(updated.currentNumber).padStart(padLen, '0')}`;
  }

  private async resolveInterState(businessId: string, supplierGstin?: string | null): Promise<boolean> {
    if (!supplierGstin) return false;
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { stateCode: true },
    });
    const supplierState = supplierGstin.substring(0, 2);
    return !!(biz?.stateCode && supplierState && supplierState !== biz.stateCode);
  }

  private async fetchProducts(businessId: string, productIds: string[]) {
    const unique = [...new Set(productIds)];
    const products = await this.prisma.product.findMany({
      where: { id: { in: unique }, businessId },
      include: { tax: true },
    });
    if (products.length !== unique.length) throw new BadRequestException('One or more products not found');
    return products;
  }

  private buildItemsData(
    items: CreateGrnDto['items'],
    products: any[],
    isInterState: boolean,
    taxType: string,
    freightCharges: number,
    hamaliCharges: number,
  ) {
    const productMap = new Map(products.map((p) => [p.id, p]));

    const rawCalcs = items.map((item) => {
      const product = productMap.get(item.productId)!;
      return this.calc.calculateItemTotals(item, Number(product.tax.taxRate), taxType, isInterState);
    });

    const spreadCalcs = this.calc.spreadAdjustments(rawCalcs, freightCharges, hamaliCharges);

    return items.map((item, i) => {
      const product = productMap.get(item.productId)!;
      const c = spreadCalcs[i];
      const gstRate = Number(product.tax.taxRate);
      const rejectedQty = item.rejectedQty ?? 0;
      const acceptedQty = this.r2(c.totalReceivedQty - rejectedQty);

      return {
        productId: item.productId,
        taxId: product.taxId,
        productName: product.name,
        hsnCode: product.hsnCode,
        // Legacy compat fields (schema still has them)
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
        // New GRN fields
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

  private buildPurchaseData(
    businessId: string,
    dto: CreateGrnDto,
    supplier: any,
    isInterState: boolean,
    billTotals: ReturnType<GrnCalculationsService['calculateBillTotals']>,
    grnNumber: string | null,
    status: string,
  ) {
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

  async create(businessId: string, dto: CreateGrnDto) {
    const [supplier, branch] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: dto.supplierId, businessId } }),
      this.prisma.branch.findFirst({ where: { id: dto.branchId, businessId } }),
    ]);
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!branch) throw new NotFoundException('Branch not found');

    const duplicate = await this.prisma.purchase.findFirst({
      where: { businessId, supplierId: dto.supplierId, invoiceNumber: dto.invoiceNumber },
    });
    if (duplicate) throw new ConflictException(`Invoice ${dto.invoiceNumber} already exists for this supplier`);

    const products = await this.fetchProducts(businessId, dto.items.map((i) => i.productId));
    const isInterState = await this.resolveInterState(businessId, supplier.gstin);
    const taxType = dto.taxType ?? 'TAX_EXCLUSIVE';
    const freightCharges = dto.freightCharges ?? 0;
    const hamaliCharges = dto.hamaliCharges ?? 0;
    const otherCharges = dto.otherCharges ?? 0;
    const roundingAmount = dto.roundingAmount ?? 0;
    const billDiscPct = dto.billDiscountPercent ?? 0;

    const itemsData = this.buildItemsData(dto.items, products, isInterState, taxType, freightCharges, hamaliCharges);

    const billTotals = this.calc.calculateBillTotals(
      itemsData.map((i) => ({
        taxable: Number(i.taxableAmount), cgstAmount: Number(i.cgstAmount),
        sgstAmount: Number(i.sgstAmount), igstAmount: Number(i.igstAmount),
        cessAmount: Number(i.cessAmount), lineTotal: Number(i.lineTotal),
      })),
      billDiscPct, freightCharges, hamaliCharges, otherCharges, roundingAmount,
    );

    const isDraft = dto.isDraft ?? false;

    if (!isDraft && dto.invoiceControlTotal !== undefined) {
      this.calc.validateInvoiceControlTotal(billTotals.grandTotal, dto.invoiceControlTotal);
    }
    const grnNumber = isDraft ? null : await this.generateGrnNumber(businessId);
    const status = isDraft ? 'DRAFT' : 'PENDING_APPROVAL';

    const purchaseData = this.buildPurchaseData(businessId, dto, supplier, isInterState, billTotals, grnNumber, status);

    const purchase = await this.prisma.purchase.create({
      data: { ...(purchaseData as any), items: { create: itemsData } },
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
      }).catch(() => {});
    }

    return purchase;
  }

  async update(businessId: string, id: string, dto: UpdateGrnDto) {
    const existing = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('GRN not found');
    if (existing.status === 'CANCELLED') throw new BadRequestException('Cannot edit a cancelled GRN');

    const existingStatus = existing.status;
    const majorChange = existingStatus === 'APPROVED' && (
      (dto.supplierId !== undefined && dto.supplierId !== existing.supplierId) ||
      (dto.invoiceNumber !== undefined && dto.invoiceNumber !== existing.invoiceNumber)
    );

    const supplierId = dto.supplierId ?? existing.supplierId;
    const branchId = dto.branchId ?? existing.branchId;
    const invoiceNumber = dto.invoiceNumber ?? existing.invoiceNumber;

    const [supplier, branch] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } }),
      this.prisma.branch.findFirst({ where: { id: branchId, businessId } }),
    ]);
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!branch) throw new NotFoundException('Branch not found');

    if (dto.supplierId || dto.invoiceNumber) {
      const conflict = await this.prisma.purchase.findFirst({
        where: { businessId, supplierId, invoiceNumber, NOT: { id } },
      });
      if (conflict) throw new ConflictException(`Invoice ${invoiceNumber} already exists for this supplier`);
    }

    const taxType = dto.taxType ?? (existing as any).taxType ?? 'TAX_EXCLUSIVE';
    const freightCharges = dto.freightCharges ?? Number(existing.freightCharges ?? 0);
    const hamaliCharges = dto.hamaliCharges ?? Number(existing.hamaliCharges ?? 0);
    const otherCharges = dto.otherCharges ?? Number(existing.otherCharges ?? 0);
    const roundingAmount = dto.roundingAmount ?? Number(existing.roundingAmount ?? 0);
    const billDiscPct = dto.billDiscountPercent ?? Number(existing.billDiscountPercent ?? 0);
    const isInterState = await this.resolveInterState(businessId, supplier.gstin);

    let billTotals: ReturnType<GrnCalculationsService['calculateBillTotals']> | null = null;
    let itemsData: any[] = [];

    if (dto.items && dto.items.length > 0) {
      const products = await this.fetchProducts(businessId, dto.items.map((i) => i.productId));
      itemsData = this.buildItemsData(dto.items, products, isInterState, taxType, freightCharges, hamaliCharges);
      billTotals = this.calc.calculateBillTotals(
        itemsData.map((i) => ({
          taxable: Number(i.taxableAmount), cgstAmount: Number(i.cgstAmount),
          sgstAmount: Number(i.sgstAmount), igstAmount: Number(i.igstAmount),
          cessAmount: Number(i.cessAmount), lineTotal: Number(i.lineTotal),
        })),
        billDiscPct, freightCharges, hamaliCharges, otherCharges, roundingAmount,
      );
      // Skip validation on update — caller (submit) enforces business rules
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
        } as any,
      });

      // For APPROVED GRNs without major change: reverse old stock and write new quantities
      if (existingStatus === 'APPROVED' && !majorChange && itemsData.length > 0) {
        await tx.stockLedger.deleteMany({
          where: { referenceId: id, movementType: 'PURCHASE' as any, businessId },
        });
        for (const item of itemsData) {
          await tx.stockLedger.create({
            data: {
              businessId,
              branchId,
              productId: item.productId,
              movementType: 'PURCHASE',
              quantity: Number((item as any).acceptedQty ?? (item as any).totalQty ?? 0),
              referenceType: 'PURCHASE',
              referenceId: id,
              notes: `GRN ${(existing as any).grnNumber} updated`,
            },
          });
        }
      }
    });

    return this.findOne(businessId, id);
  }

  async submit(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!purchase) throw new NotFoundException('GRN not found');
    if (purchase.status !== 'DRAFT') throw new BadRequestException('Only DRAFT GRNs can be submitted');

    const grnNumber = await this.generateGrnNumber(businessId);
    const updated = await this.prisma.purchase.update({
      where: { id },
      data: { grnNumber, status: 'PENDING_APPROVAL' } as any,
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
    }).catch(() => {});

    return updated;
  }

  async approve(businessId: string, id: string, approverName?: string, notes?: string) {
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
    if (!purchase) throw new NotFoundException('GRN not found');
    if (purchase.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Cannot approve a GRN with status ${purchase.status}`);
    }

    const stockEntries = purchase.items.map((item) => ({
      businessId,
      branchId: purchase.branchId,
      productId: item.productId,
      movementType: 'PURCHASE' as const,
      quantity: Number((item as any).acceptedQty ?? 0) > 0
        ? Number((item as any).acceptedQty)
        : Number((item as any).totalQty ?? item.quantity),
      referenceType: 'PURCHASE',
      referenceId: purchase.id,
      notes: `GRN ${purchase.grnNumber} approved`,
    }));

    const priceUpdates = purchase.items.map((item) => {
      const updateData: any = {
        costPrice: Number((item as any).trueCostPrice) || Number((item as any).netCostPrice) || Number(item.unitPrice),
      };
      if (item.mrp !== null) updateData.mrp = Number(item.mrp);
      if ((item as any).sellingPrice !== null) updateData.sellingPrice = Number((item as any).sellingPrice);
      return this.prisma.product.update({ where: { id: item.productId }, data: updateData });
    });

    const priceChangedUpdates = purchase.items
      .filter((item) => (item as any).sellingPrice !== null && item.product)
      .map((item) => {
        const oldPrice = Number(item.product.sellingPrice ?? 0);
        const newPrice = Number((item as any).sellingPrice ?? 0);
        const changed = newPrice > 0 && newPrice !== oldPrice;
        if (!changed) return null;
        const changePct = oldPrice > 0 ? this.r2((newPrice - oldPrice) / oldPrice * 100) : null;
        return this.prisma.purchaseItem.update({
          where: { id: item.id },
          data: { priceChanged: true, priceChangePct: changePct } as any,
        });
      })
      .filter((u): u is NonNullable<typeof u> => u !== null);

    await this.prisma.$transaction([
      this.prisma.purchase.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByName: approverName ?? null,
          ...(notes ? { notes } : {}),
        } as any,
      }),
      ...stockEntries.map((e) => this.prisma.stockLedger.create({ data: e })),
      ...priceUpdates,
      ...priceChangedUpdates,
    ]);

    this.handlePluUpsert(businessId, purchase.items.map((i) => ({ ...i, purchaseId: id }))).catch(() => {});
    this.handleRestockNotifications(businessId, purchase.branchId, purchase.items, purchase.grnNumber ?? '').catch(() => {});

    return this.findOne(businessId, id);
  }

  private async handlePluUpsert(businessId: string, items: any[]) {
    for (const item of items) {
      if (!item.pluCode) continue;
      try {
        await (this.prisma as any).productPlu.upsert({
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
      } catch { /* swallow per-item errors */ }
    }
  }

  private async handleRestockNotifications(
    businessId: string,
    branchId: string,
    items: Array<{ productId: string; product?: any }>,
    grnNumber: string,
  ) {
    const uniqueIds = [...new Set(items.map((i) => i.productId))];
    for (const productId of uniqueIds) {
      try {
        const agg = await this.prisma.stockLedger.aggregate({
          where: { productId, branchId },
          _sum: { quantity: true },
        });
        const newStock = Number(agg._sum.quantity ?? 0);
        if (newStock <= 0) continue;

        const product = await this.prisma.product.findUnique({
          where: { id: productId },
          select: { name: true, autoInactiveReason: true },
        });
        if (!product) continue;

        if (product.autoInactiveReason === 'OUT_OF_STOCK') {
          await this.prisma.product.update({ where: { id: productId }, data: { autoInactiveReason: null } });
          await this.notifications.create({
            businessId, productId,
            type: 'RESTOCKED', priority: 'NORMAL',
            title: `Restocked: ${product.name}`,
            message: `Stock replenished via GRN ${grnNumber}. Product active in POS.`,
          });
        }
      } catch { /* swallow per-product errors */ }
    }
  }

  async reject(businessId: string, id: string, rejectorName?: string, reason?: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!purchase) throw new NotFoundException('GRN not found');
    if (!['PENDING_APPROVAL', 'DRAFT'].includes(purchase.status)) {
      throw new BadRequestException(`Cannot reject a GRN with status ${purchase.status}`);
    }
    return this.prisma.purchase.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedByName: rejectorName ?? null,
        ...(reason ? { notes: reason } : {}),
      } as any,
    });
  }

  async cancel(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!purchase) throw new NotFoundException('GRN not found');
    if (purchase.status !== 'DRAFT') throw new BadRequestException('Only DRAFT GRNs can be cancelled');
    return this.prisma.purchase.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async deleteGrn(businessId: string, id: string) {
    const grn = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!grn) throw new NotFoundException('GRN not found');
    if (grn.status !== 'DRAFT') throw new BadRequestException('Only DRAFT GRNs can be deleted');
    await this.prisma.$transaction([
      this.prisma.purchaseItem.deleteMany({ where: { purchaseId: id } }),
      this.prisma.purchase.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  async revertToDraft(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!purchase) throw new NotFoundException('GRN not found');
    if (!['REJECTED', 'PENDING_APPROVAL'].includes(purchase.status)) {
      throw new BadRequestException(`Cannot revert a GRN with status ${purchase.status} to Draft`);
    }
    return this.prisma.purchase.update({
      where: { id },
      data: { status: 'DRAFT', grnNumber: null, rejectedByName: null } as any,
    });
  }

  async findAll(businessId: string, query: GrnQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip = (page - 1) * limit;

    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.excludeStatus) where.status = { not: query.excludeStatus };
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.invoiceNumber) where.invoiceNumber = query.invoiceNumber;
    if (query.startDate || query.endDate) {
      where.invoiceDate = {};
      if (query.startDate) where.invoiceDate.gte = new Date(query.startDate);
      if (query.endDate) where.invoiceDate.lte = new Date(query.endDate);
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

  async findOne(businessId: string, id: string) {
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
    if (!purchase) throw new NotFoundException('GRN not found');
    return purchase;
  }

  async getSupplierAdvances(businessId: string, supplierId: string) {
    return (this.prisma as any).supplierAdvance.findMany({
      where: { businessId, supplierId, status: 'AVAILABLE', balanceAmount: { gt: 0 } },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async getPrintData(businessId: string, id: string) {
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
    if (!purchase) throw new NotFoundException('GRN not found');
    return { purchase, business };
  }

  async getProductLastRates(businessId: string, productId: string) {
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
      basicCostPrice: Number((item as any).basicCostPrice ?? item.unitPrice),
      netCostPrice: Number((item as any).netCostPrice ?? item.unitPrice),
      trueCostPrice: Number((item as any).trueCostPrice ?? item.unitPrice),
      sellingPrice: (item as any).sellingPrice !== null ? Number((item as any).sellingPrice) : null,
      mrp: item.mrp !== null ? Number(item.mrp) : null,
      cessRate: Number((item as any).cessRate ?? 0),
      gstRatePercent: Number(item.gstRatePercent),
    }));
  }

  // ─── SUPPLIER CREDIT NOTES ────────────────────────────

  async createSupplierCreditNote(
    businessId: string,
    userId: string,
    userName: string,
    dto: {
      supplierId: string;
      originalGrnId?: string;
      originalInvoiceNo?: string;
      supplierCnNumber?: string;
      cnDate: string;
      reason: string;
      taxableAmount: number;
      gstRate: number;
      cessAmount?: number;
      itcReversal?: boolean;
      notes?: string;
    },
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { stateCode: true },
    });
    const supplierState = supplier.gstin?.substring(0, 2) ?? null;
    const isInterstate = !!(supplierState && business?.stateCode && supplierState !== business.stateCode);

    const taxable    = this.r2(dto.taxableAmount);
    const gstRate    = dto.gstRate ?? 0;
    const gstAmount  = this.r2(taxable * gstRate / 100);
    const cgst       = isInterstate ? 0 : this.r2(gstAmount / 2);
    const sgst       = isInterstate ? 0 : this.r2(gstAmount / 2);
    const igst       = isInterstate ? gstAmount : 0;
    const cess       = this.r2(dto.cessAmount ?? 0);
    const total      = this.r2(taxable + gstAmount + cess);

    const fy = await this.getActiveFy(businessId);

    const scnNumber = await this.prisma.$transaction(async (tx) => {
      const series = await tx.billSeries.findFirst({
        where: { businessId, financialYearId: fy.id, billType: 'SCN', isActive: true },
      });
      if (!series) throw new BadRequestException('SCN bill series not configured. Run Admin seed.');
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
        supplierId:        dto.supplierId,
        originalGrnId:     dto.originalGrnId     ?? null,
        originalInvoiceNo: dto.originalInvoiceNo ?? null,
        supplierCnNumber:  dto.supplierCnNumber  ?? null,
        scnNumber,
        cnDate:            new Date(dto.cnDate),
        reason:            dto.reason,
        taxableAmount:     taxable,
        cgstAmount:        cgst,
        sgstAmount:        sgst,
        igstAmount:        igst,
        cessAmount:        cess,
        totalAmount:       total,
        itcReversal:       dto.itcReversal ?? false,
        status:            'ACTIVE',
        notes:             dto.notes ?? null,
        createdById:       userId,
        createdByName:     userName,
      },
    });

    await this.prisma.supplier.update({
      where: { id: dto.supplierId },
      data:  { outstandingBalance: { decrement: total } },
    });

    return { ...cn, isInterstate };
  }

  async getSupplierCreditNotes(
    businessId: string,
    filters: {
      supplierId?: string;
      originalGrnId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, filters.limit ?? 20);
    const skip  = (page - 1) * limit;

    const where: any = { businessId };
    if (filters.supplierId)   where.supplierId   = filters.supplierId;
    if (filters.originalGrnId) where.originalGrnId = filters.originalGrnId;
    if (filters.dateFrom || filters.dateTo) {
      where.cnDate = {};
      if (filters.dateFrom) where.cnDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.cnDate.lte = new Date(filters.dateTo + 'T23:59:59');
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
}
