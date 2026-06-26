import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GrnCalculationsService } from './grn-calculations.service';
import { EventsService } from '../events/events.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { Events } from '../events/event-types';
import { assertMargin } from '../common/margin.util';
import { CreateGrnDto } from './dto/create-grn.dto';
import { UpdateGrnDto } from './dto/update-grn.dto';
import { GrnQueryDto } from './dto/grn-query.dto';
import { BankService } from '../bank/bank.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ShopCacheService } from '../shop/shop-cache.service';

@Injectable()
export class GrnService {
  constructor(
    private prisma: PrismaService,
    private calc: GrnCalculationsService,
    private notifications: NotificationsService,
    private eventsService: EventsService,
    private suppliersService: SuppliersService,
    private bankService: BankService,
    private audit: AuditLogService,
    private shopCache: ShopCacheService,
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
          { keywords:    { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 50,
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
    if (!fy)       throw new BadRequestException('No active financial year. Complete business setup first.');
    if ((fy as any).isClosed) throw new BadRequestException(`Financial year ${(fy as any).fyCode} is closed. Please open the next financial year first.`);
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
      // Prefer the rate the user selected in the GRN panel (sent as gstRatePercent).
      // Fall back to the product's DB tax rate only when not provided.
      // This ensures backend and frontend totals always match.
      const gstRate = item.gstRatePercent !== undefined && item.gstRatePercent !== null
        ? Number(item.gstRatePercent)
        : Number(product.tax.taxRate);
      return this.calc.calculateItemTotals(item, gstRate, taxType, isInterState);
    });

    const spreadCalcs = this.calc.spreadAdjustments(rawCalcs, freightCharges, hamaliCharges);

    return items.map((item, i) => {
      const product = productMap.get(item.productId)!;
      const c = spreadCalcs[i];
      const gstRate = item.gstRatePercent !== undefined && item.gstRatePercent !== null
        ? Number(item.gstRatePercent)
        : Number(product.tax.taxRate);
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
      cashDiscountPercent: dto.billCashDiscPercent ?? 0,
      cashDiscountAmount: dto.billCashDiscRs ?? 0,
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

  async create(businessId: string, dto: CreateGrnDto, actor?: { userId: string; userName: string; userRole: string }) {
    const [supplier, branch] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: dto.supplierId, businessId } }),
      this.prisma.branch.findFirst({ where: { id: dto.branchId, businessId } }),
    ]);
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!supplier.isActive) throw new BadRequestException('This supplier is inactive. Reactivate it before creating a GRN.');
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
      dto.billCashDiscRs ?? 0,
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

    try {
      this.eventsService.emitToBusiness(businessId, Events.GRN_CREATED, {
        grnId:       purchase.id,
        grnNumber:   purchase.grnNumber,
        status:      purchase.status,
        supplierId:  purchase.supplierId,
        totalAmount: Number(purchase.grandTotal),
      });
    } catch (_err) { /* fire-and-forget */ }

    // Credit limit warning (non-blocking)
    let warning: object | null = null;
    try {
      const creditLimit = Number(supplier.creditLimit ?? 0);
      if (creditLimit > 0) {
        const currentOutstanding = await this.suppliersService.computeOutstanding(dto.supplierId, businessId);
        const projectedTotal     = currentOutstanding + billTotals.grandTotal;
        if (projectedTotal > creditLimit) {
          warning = {
            type:               'CREDIT_LIMIT_EXCEEDED',
            currentOutstanding: Math.round(currentOutstanding * 100) / 100,
            newTotal:           Math.round(billTotals.grandTotal * 100) / 100,
            projectedTotal:     Math.round(projectedTotal * 100) / 100,
            creditLimit,
            exceededBy:         Math.round((projectedTotal - creditLimit) * 100) / 100,
          };
        }
      }
    } catch (_err) { /* non-critical — don't fail the request */ }

    if (actor) {
      this.audit.log({ ...actor, businessId }, { action: 'CREATE', entity: 'GRN', entityId: purchase.id, entityRef: purchase.grnNumber ?? purchase.id, description: `GRN created for supplier ${supplier.name}` }).catch(() => {});
    }
    return { ...purchase, warning };
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
    const billCashRs = dto.billCashDiscRs ?? Number((existing as any).cashDiscountAmount ?? 0);
    const billCashPct = dto.billCashDiscPercent ?? Number((existing as any).cashDiscountPercent ?? 0);
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
        billCashRs,
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
            cashDiscountPercent: billCashPct,
            cashDiscountAmount: billTotals.cashDiscountAmount,
            freightCharges,
            hamaliCharges,
            otherCharges,
            roundingAmount,
            grandTotal: billTotals.grandTotal,
            advanceAdjusted,
            amountPayable: this.r2(billTotals.grandTotal - advanceAdjusted),
            // Outstanding must subtract what was already paid (paidAmount is kept
            // in sync by both the manual and bank-reconciliation payment paths),
            // so editing a GRN — e.g. applying a cash discount — lowers the due
            // correctly instead of overstating it. Clamp at 0.
            balanceAmount: this.r2(Math.max(0, billTotals.grandTotal - advanceAdjusted - Number((existing as any).paidAmount ?? 0))),
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

    try {
      const updated = await this.prisma.purchase.findFirst({ where: { id, businessId }, select: { grnNumber: true, status: true } });
      this.eventsService.emitToBusiness(businessId, Events.GRN_UPDATED, {
        grnId:     id,
        grnNumber: updated?.grnNumber ?? null,
        status:    updated?.status ?? 'DRAFT',
      });
    } catch (_err) { /* fire-and-forget */ }

    return this.findOne(businessId, id);
  }

  async submit(businessId: string, id: string, actor?: { userId: string; userName: string; userRole: string }) {
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

    try {
      this.eventsService.emitToBusiness(businessId, Events.GRN_SUBMITTED, {
        grnId:     id,
        grnNumber: grnNumber,
      });
    } catch (_err) { /* fire-and-forget */ }

    if (actor) {
      this.audit.log({ ...actor, businessId }, { action: 'STATUS_CHANGE', entity: 'GRN', entityId: id, entityRef: grnNumber, description: `GRN ${grnNumber} submitted for approval` }).catch(() => {});
    }
    return updated;
  }

  async approve(businessId: string, id: string, approverName?: string, notes?: string, actor?: { userId: string; userName: string; userRole: string }) {
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

    await this.prisma.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByName: approverName ?? null,
          ...(notes ? { notes } : {}),
        } as any,
      });

      for (const e of stockEntries) {
        await tx.stockLedger.create({ data: e });
      }

      // Mark purchase items where sellingPrice changed vs stored product price
      for (const item of purchase.items) {
        if ((item as any).sellingPrice === null || !item.product) continue;
        const oldPrice = Number(item.product.sellingPrice ?? 0);
        const newPrice = Number((item as any).sellingPrice ?? 0);
        if (newPrice > 0 && newPrice !== oldPrice) {
          // priceChangePct is Decimal(5,2) → clamp to ±999.99 so extreme jumps don't overflow
          const rawPct = oldPrice > 0 ? this.r2((newPrice - oldPrice) / oldPrice * 100) : null;
          const changePct = rawPct === null ? null : Math.max(-999.99, Math.min(999.99, rawPct));
          await tx.purchaseItem.update({
            where: { id: item.id },
            data: { priceChanged: true, priceChangePct: changePct } as any,
          });
        }
      }

      await this.syncPluOnApproval(tx, businessId, id, purchase.items, approverName ?? 'System', String((purchase as any).taxType ?? 'TAX_EXCLUSIVE'));
    }, { timeout: 60000 });

    this.handleRestockNotifications(businessId, purchase.branchId, purchase.items, purchase.grnNumber ?? '').catch(() => {});

    try {
      this.eventsService.emitToBusiness(businessId, Events.GRN_APPROVED, {
        grnId:       id,
        grnNumber:   purchase.grnNumber,
        supplierId:  purchase.supplierId,
        totalAmount: Number(purchase.grandTotal),
      });
    } catch (_err) { /* fire-and-forget */ }

    // Fire-and-forget: try to match any unmatched bank NEFTs waiting for this supplier
    // Handles the "payment arrived before GRN was entered" scenario
    this.bankService
      .tryMatchPendingForSupplier(businessId, purchase.supplierId)
      .catch(() => {});

    if (actor) {
      this.audit.log({ ...actor, businessId }, { action: 'APPROVE', entity: 'GRN', entityId: id, entityRef: purchase.grnNumber ?? id, description: `GRN ${purchase.grnNumber} approved by ${approverName ?? actor.userName}` }).catch(() => {});
    }

    // Bust shop cache for all products whose stock/price changed in this GRN
    const productIds = [...new Set(purchase.items.map((i) => i.productId))];
    this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { productCode: true } })
      .then((prods) => Promise.all(prods.filter(p => p.productCode).map(p => this.shopCache.bustProduct(p.productCode!))))
      .catch(() => {});

    return this.findOne(businessId, id);
  }

  private async syncPluOnApproval(
    tx: any,
    businessId: string,
    grnId: string,
    items: any[],
    approverName: string,
    taxType: string = 'TAX_EXCLUSIVE',
  ) {
    const isInclusive = taxType === 'TAX_INCLUSIVE';

    for (const item of items) {
      const acceptedQty = Number((item as any).acceptedQty ?? 0) > 0
        ? Number((item as any).acceptedQty)
        : Number((item as any).totalQty ?? item.quantity ?? 0);

      if (acceptedQty <= 0) continue;

      const itemMrp        = Number((item as any).mrp ?? 0);
      const itemGstRate    = Number((item as any).gstRatePercent ?? 0);
      const itemNetInclRaw = Number((item as any).netCostPrice ?? (item as any).trueCostPrice ?? item.unitPrice ?? 0);
      // For TAX_INCLUSIVE GRNs the stored netCostPrice is the inclusive rate (e.g. 140 @ 18% GST).
      // Convert to exclusive so PLU.costPrice always reflects the pre-tax purchase cost.
      const itemCost = isInclusive && itemGstRate > 0
        ? this.r2(itemNetInclRaw / (1 + itemGstRate / 100))
        : itemNetInclRaw;
      const itemBasicCost = Number((item as any).basicCostPrice ?? itemCost);
      const itemSp        = Number((item as any).sellingPrice ?? 0);
      const itemCessRate  = Number((item as any).cessRate ?? 0);

      const product = await tx.product.findUnique({
        where:  { id: item.productId },
        select: { id: true, productCode: true, name: true, hsnCode: true, gstRatePercent: true, cessRate: true, allowBelowMargin: true },
      });
      if (!product) continue;

      const marginRs  = itemMrp > 0 ? this.r2(itemMrp - itemCost) : 0;
      const marginPct = itemMrp > 0
        ? Math.round(((itemMrp - itemCost) / itemMrp * 100) * 10000) / 10000
        : 0;

      // STEP 1: Find existing PLU for this product+MRP combination (handles mixed-batch GRNs).
      // We match on MRP (not just isDefault) so same-product different-MRP batches
      // each get their own PLU instead of colliding on the default PLU.
      const activePlu = await tx.productPlu.findFirst({
        where: {
          productId:  item.productId,
          isArchived: false,
          mrp:        { gte: itemMrp - 0.01, lte: itemMrp + 0.01 },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Check whether there is already ANY default PLU (needed for isDefault assignment below)
      const existingDefault = activePlu?.isDefault
        ? activePlu
        : await tx.productPlu.findFirst({
            where: { productId: item.productId, isArchived: false, isDefault: true },
          });

      const priceIsSame = activePlu
        && Math.abs(Number(activePlu.costPrice) - itemCost) < 0.01;

      // Track whether the PLU that ends up receiving stock for this line is the default.
      // Used in STEP 3 to decide whether to sync product master prices.
      let thisLineIsDefault = false;

      if (activePlu && priceIsSame) {
        // STEP 2A: Same MRP + same cost — add stock to existing PLU (re-activate if inactive)
        thisLineIsDefault = activePlu.isDefault ?? false;
        await tx.productPlu.update({
          where: { id: activePlu.id },
          data: {
            stockOnHand: { increment: acceptedQty },
            receivedQty: { increment: acceptedQty },
            isActive:    true,
          },
        });
      } else {
        // STEP 2B: New MRP batch or cost changed — create a new PLU.
        // Enforce margin on the new selling price (only when an SP was entered).
        if (itemSp > 0) {
          assertMargin({
            sellingPrice: itemSp,
            costPrice:    itemCost,
            gstRate:      itemGstRate || Number(product.gstRatePercent ?? 0),
            cessRate:     itemCessRate,
            label:        product.name,
            bypass:       (product as any).allowBelowMargin ?? false,
          });
        }
        const pluCount   = await tx.productPlu.count({ where: { productId: item.productId } });
        const seq        = String(pluCount + 1).padStart(3, '0');
        const newPluCode = `${product.productCode}${seq}`;

        // Only make this PLU the default if there is no existing default,
        // or if it's replacing a same-MRP PLU whose cost changed (price update).
        const makeDefault = !existingDefault || !!(activePlu && activePlu.id === existingDefault.id);
        thisLineIsDefault = makeDefault;

        if (activePlu) {
          // Cost changed on same MRP batch — keep the existing PLU record but update cost.
          // (Don't create a duplicate PLU for same MRP; just update prices and add stock.)
          await tx.productPlu.update({
            where: { id: activePlu.id },
            data: {
              basicCost:    itemBasicCost,
              costPrice:    itemCost,
              sellingPrice: itemSp || undefined,
              marginRs:     marginRs,
              marginPercent: marginPct,
              stockOnHand:  { increment: acceptedQty },
              receivedQty:  { increment: acceptedQty },
              isActive:     true,
              isDefault:    makeDefault,
            },
          });
          // If the old default was a different PLU (different MRP), leave it as default
          // — this batch is a secondary batch.
        } else {
          // Completely new MRP batch — create fresh PLU
          if (existingDefault && makeDefault) {
            // Demote old default so this new batch becomes the default
            await tx.productPlu.update({
              where: { id: existingDefault.id },
              data:  { isDefault: false },
            });
          }

          await tx.productPlu.create({
            data: {
              businessId,
              productId:      item.productId,
              pluCode:        newPluCode,
              basicCost:      itemBasicCost,
              costPrice:      itemCost,
              mrp:            itemMrp,
              sellingPrice:   itemSp,
              wholesalePrice: null,
              minSellingPrice: 0,
              gstRate:        itemGstRate || Number(product.gstRatePercent ?? 0),
              hsnCode:        product.hsnCode,
              cessRate:       itemCessRate,
              taxInclusive:   isInclusive,
              marginPercent:  marginPct,
              marginRs,
              stockOnHand:    acceptedQty,
              receivedQty:    acceptedQty,
              soldQty:        0,
              isDefault:      makeDefault,
              isActive:       true,
              isArchived:     false,
              effectiveFrom:  new Date(),
              grnId,
              batchNumber:        (item as any).batchNumber        ?? null,
              manufacturingDate:  (item as any).manufacturingDate  ?? null,
              expiryDate:         (item as any).expiryDate         ?? null,
              createdByName:  approverName,
            },
          });
        } // end else (new MRP batch)
      } // end STEP 2B

      // STEP 2C: Auto-manage availableOnline — latest active PLU with positive stock
      // gets online=true, all others for this product get online=false.
      const latestWithStock = await tx.productPlu.findFirst({
        where: { productId: item.productId, isActive: true, isArchived: false, stockOnHand: { gt: 0 } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      await tx.productPlu.updateMany({
        where: { productId: item.productId, businessId },
        data:  { availableOnline: false },
      });
      if (latestWithStock) {
        await tx.productPlu.update({
          where: { id: latestWithStock.id },
          data:  { availableOnline: true },
        });
      }

      // STEP 3: Update Product.totalStock = sum of all active PLU stockOnHand.
      // Only sync master prices (mrp/sellingPrice/costPrice) when this item's PLU
      // is (or will be) the default — for secondary batches totalStock is still updated
      // but master prices are left pointing at the default PLU's values.

      const agg = await tx.productPlu.aggregate({
        where: { productId: item.productId, isActive: true, isArchived: false },
        _sum:  { stockOnHand: true },
      });
      await tx.product.update({
        where: { id: item.productId },
        data:  {
          totalStock: Number(agg._sum.stockOnHand ?? 0),
          ...(thisLineIsDefault ? {
            mrp:          itemMrp,
            sellingPrice: itemSp,
            costPrice:    itemCost,
          } : {}),
        } as any,
      });
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

  async reject(businessId: string, id: string, rejectorName?: string, reason?: string, actor?: { userId: string; userName: string; userRole: string }) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!purchase) throw new NotFoundException('GRN not found');
    if (!['PENDING_APPROVAL', 'DRAFT'].includes(purchase.status)) {
      throw new BadRequestException(`Cannot reject a GRN with status ${purchase.status}`);
    }
    const rejected = await this.prisma.purchase.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedByName: rejectorName ?? null,
        ...(reason ? { notes: reason } : {}),
      } as any,
    });

    try {
      this.eventsService.emitToBusiness(businessId, Events.GRN_REJECTED, {
        grnId:      id,
        grnNumber:  purchase.grnNumber,
        supplierId: purchase.supplierId,
      });
    } catch (_err) { /* fire-and-forget */ }

    if (actor) {
      this.audit.log({ ...actor, businessId }, { action: 'REJECT', entity: 'GRN', entityId: id, entityRef: purchase.grnNumber ?? id, description: `GRN ${purchase.grnNumber} rejected — ${reason ?? 'no reason'}` }).catch(() => {});
    }
    return rejected;
  }

  async cancel(businessId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!purchase) throw new NotFoundException('GRN not found');
    if (purchase.status !== 'DRAFT') throw new BadRequestException('Only DRAFT GRNs can be cancelled');
    return this.prisma.purchase.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async setExcludeFromGst(businessId: string, id: string, exclude: boolean) {
    const grn = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!grn) throw new NotFoundException('GRN not found');
    await this.prisma.purchase.update({ where: { id }, data: { excludeFromGst: !!exclude } });
    return { id, excludeFromGst: !!exclude };
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

    // Free-text search across GRN number, invoice number and supplier name
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { grnNumber:     { contains: s, mode: 'insensitive' } },
        { invoiceNumber: { contains: s, mode: 'insensitive' } },
        { supplierName:  { contains: s, mode: 'insensitive' } },
      ];
    }

    // grandTotal range
    const min = query.minAmount !== undefined ? parseFloat(query.minAmount) : NaN;
    const max = query.maxAmount !== undefined ? parseFloat(query.maxAmount) : NaN;
    if (!isNaN(min) || !isNaN(max)) {
      where.grandTotal = {};
      if (!isNaN(min)) where.grandTotal.gte = min;
      if (!isNaN(max)) where.grandTotal.lte = max;
    }

    // Payment status (needs paidAmount vs grandTotal column comparison → raw ids)
    const payStatus = query.paymentStatus?.toUpperCase();
    if (payStatus === 'PAID' || payStatus === 'PARTIAL' || payStatus === 'UNPAID') {
      const rows = await (
        payStatus === 'PAID'
          ? this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM purchase WHERE "businessId" = ${businessId} AND status = 'APPROVED' AND COALESCE("paidAmount",0) >= "grandTotal"`
          : payStatus === 'PARTIAL'
          ? this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM purchase WHERE "businessId" = ${businessId} AND status = 'APPROVED' AND COALESCE("paidAmount",0) > 0 AND COALESCE("paidAmount",0) < "grandTotal"`
          : this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM purchase WHERE "businessId" = ${businessId} AND status = 'APPROVED' AND COALESCE("paidAmount",0) <= 0`
      );
      where.id = { in: rows.map((r) => r.id) };
    }

    // Sorting
    const dir: 'asc' | 'desc' = query.sortDir === 'asc' ? 'asc' : 'desc';
    const sortMap: Record<string, any> = {
      date:          { createdAt: dir },
      amount:        { grandTotal: dir },
      supplier:      { supplierName: dir },
      grnNumber:     { grnNumber: dir },
      invoiceNumber: { invoiceNumber: dir },
    };
    const orderBy = sortMap[query.sortBy ?? 'date'] ?? { createdAt: 'desc' };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true,
          supplierName: true, supplierId: true,
          grandTotal: true, taxableAmount: true, totalTaxAmount: true,
          invoiceControlTotal: true, receivedDate: true,
          paidAmount: true, status: true, createdAt: true, notes: true,
          excludeFromGst: true,
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
