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
import { JournalBridgeService } from '../platform/journal-bridge/journal-bridge.service';
import { GstService } from '../gst/gst.service';
import { lockPluCandidatesForDeduction, lockPluById } from '../common/helpers/stock-lock.util';
import { gstinStateCode } from '../common/gstin.util';
import { ProductsService } from '../products/products.service';

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
    private journalBridge: JournalBridgeService,
    private gst: GstService,
    private productsService: ProductsService,
  ) {}

  private r2(n: number) { return Math.round(n * 100) / 100; }

  private buildTaxBreakup(itemsData: any[]): Array<{
    gstRate: number; taxableAmount: number;
    cgstAmount: number; sgstAmount: number; igstAmount: number; cessAmount: number;
  }> {
    const map = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; cess: number }>();
    for (const item of itemsData) {
      const rate = Number(item.gstRatePercent ?? 0);
      const existing = map.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
      map.set(rate, {
        taxable: this.r2(existing.taxable + Number(item.taxableAmount ?? 0)),
        cgst:    this.r2(existing.cgst    + Number(item.cgstAmount    ?? 0)),
        sgst:    this.r2(existing.sgst    + Number(item.sgstAmount    ?? 0)),
        igst:    this.r2(existing.igst    + Number(item.igstAmount    ?? 0)),
        cess:    this.r2(existing.cess    + Number(item.cessAmount    ?? 0)),
      });
    }
    return Array.from(map.entries()).map(([rate, v]) => ({
      gstRate: rate, taxableAmount: v.taxable,
      cgstAmount: v.cgst, sgstAmount: v.sgst, igstAmount: v.igst, cessAmount: v.cess,
    }));
  }

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
    const supplierState = gstinStateCode(supplierGstin, 'This supplier');
    return !!(biz?.stateCode && supplierState !== biz.stateCode);
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
        isFreeItem: item.isFreeItem ?? false,
        isSaleable: item.isSaleable ?? true,
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
        // Persist the unit info entered on this line so it survives to approval time,
        // when syncPluOnApproval reads it back off the re-fetched PurchaseItem row.
        measureType: (item as any).measureType ?? null,
        unitSymbol:  (item as any).unitSymbol  ?? null,
        unitSize:    (item as any).unitSize    ?? null,
        baseUnitQty: (item as any).baseUnitQty ?? null,
        gstUqc:      (item as any).gstUqc      ?? null,
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

    const taxBreakup = this.buildTaxBreakup(itemsData);
    if (taxBreakup.length > 0) {
      await this.prisma.purchaseTaxBreakup.createMany({
        data: taxBreakup.map((r) => ({ ...r, purchaseId: purchase.id })),
      });
    }

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

    // Auto-post journal entry — fire-and-forget, never blocks the response
    if (!isDraft) {
      this.journalBridge.postGrnJournal({
        id:            purchase.id,
        businessId,
        grnNumber:     purchase.grnNumber,
        grandTotal:    Number(purchase.grandTotal),
        taxableAmount: Number((purchase as any).taxableAmount ?? 0),
        cgstTotal:     Number((purchase as any).cgstTotal ?? 0),
        sgstTotal:     Number((purchase as any).sgstTotal ?? 0),
        igstTotal:     Number((purchase as any).igstTotal ?? 0),
        isMsmeSupplier: !!supplier.udyamRegistration,
      }).catch(() => {});
    }

    return { ...purchase, warning };
  }

  async update(businessId: string, id: string, dto: UpdateGrnDto) {
    const existing = await this.prisma.purchase.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('GRN not found');
    if (existing.status === 'CANCELLED') throw new BadRequestException('Cannot edit a cancelled GRN');

    // An APPROVED GRN has already added stock (via syncPluOnApproval, which does
    // complex per-line PLU matching/creation — not a simple increment). Changing
    // supplier/invoice number here used to reset status to DRAFT without reversing
    // that stock, so re-approving added it a second time; changing item quantities
    // updated the StockLedger audit row but never touched the live ProductPlu
    // stock it's supposed to mirror, silently desyncing the two. Neither path can
    // be made safe with a simple patch — a correct fix needs a real "amend an
    // approved GRN" flow that properly reverses the original PLU-matching effects
    // first, which doesn't exist yet. Block both until that's built.
    if (existing.status === 'APPROVED') {
      const changesSupplierOrInvoice =
        (dto.supplierId !== undefined && dto.supplierId !== existing.supplierId) ||
        (dto.invoiceNumber !== undefined && dto.invoiceNumber !== existing.invoiceNumber);
      const changesItems = !!(dto.items && dto.items.length > 0);
      if (changesSupplierOrInvoice || changesItems) {
        throw new BadRequestException(
          'Cannot change supplier, invoice number, or item quantities on an approved GRN — ' +
          'it has already added stock, and editing those fields in place would corrupt live ' +
          'stock counts. Contact support for a manual correction.',
        );
      }
    }

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
        await tx.purchaseTaxBreakup.deleteMany({ where: { purchaseId: id } });
        const taxBreakup = this.buildTaxBreakup(itemsData);
        if (taxBreakup.length > 0) {
          await tx.purchaseTaxBreakup.createMany({
            data: taxBreakup.map((r) => ({ ...r, purchaseId: id })),
          });
        }
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
        } as any,
      });
      // Note: there used to be a branch here that reset an APPROVED GRN back
      // to DRAFT and reversed/re-added its StockLedger entries. It was dead
      // code — the guard above already throws BadRequestException for every
      // condition that would have triggered it (amending an approved GRN's
      // supplier/invoice/items isn't a supported flow; see that guard's
      // comment) — so it's been removed rather than left as an unreachable
      // trap for a future maintainer to "fix" into a real feature.
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

      // Mark purchase items where sellingPrice changed vs the product's actual
      // current batch — Product.sellingPrice is just a display cache that can
      // go stale (that's the whole reason resolveCurrentPlu exists), so the
      // audit comparison must use the real current PLU, not that cache.
      for (const item of purchase.items) {
        if ((item as any).sellingPrice === null || !item.product) continue;
        const currentPlu = await this.productsService.resolveCurrentPlu(item.productId, tx);
        const oldPrice = currentPlu ? Number(currentPlu.sellingPrice) : Number(item.product.sellingPrice ?? 0);
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

      await this.syncPluOnApproval(
        tx, businessId, id, purchase.items,
        approverName ?? 'System',
        String((purchase as any).taxType ?? 'TAX_EXCLUSIVE'),
        (purchase as any).invoiceDate ? new Date((purchase as any).invoiceDate) : new Date(),
      );
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
    invoiceDate: Date = new Date(),
  ) {
    const isInclusive = taxType === 'TAX_INCLUSIVE';

    for (const item of items) {
      const acceptedQty = Number((item as any).acceptedQty ?? 0) > 0
        ? Number((item as any).acceptedQty)
        : Number((item as any).totalQty ?? item.quantity ?? 0);

      if (acceptedQty <= 0) continue;

      if ((item as any).isFreeItem && (item as any).isSaleable === false) {
        // Non-saleable free line (sample/display/promotional item) — the GRN row itself
        // is the audit record for bill-matching; it must never touch sellable PLU stock,
        // cost, or margin.
        continue;
      }

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
      const matchingPlus = await tx.productPlu.findMany({
        where: {
          productId:  item.productId,
          isArchived: false,
          mrp:        { gte: itemMrp - 0.01, lte: itemMrp + 0.01 },
        },
        orderBy: { createdAt: 'desc' },
      });
      // Judgment call: when more than one PLU shares this MRP — e.g. a normal
      // paid batch alongside a forced-split free/case-mismatch batch created
      // by an earlier GRN line (see forceSeparateBatch below) — plain
      // "newest first" can silently match a later, ordinary paid line onto
      // the forced-split batch instead of the intended normal one. There's
      // no stored flag marking "this PLU was created via a forced split", so
      // as a pragmatic proxy we prefer whichever matching PLU's cost is
      // closest to this line's cost — a real price-matching batch is far
      // more likely to be the intended target than a free (₹0 cost) or
      // case-mismatched one. Ties (equal cost distance) keep the previous
      // newest-first behavior, since `matchingPlus` is already ordered that
      // way and `reduce` only replaces the running best on a strict `<`.
      const activePlu = matchingPlus.length > 0
        ? matchingPlus.reduce((best: any, cur: any) => (
            Math.abs(Number(cur.costPrice) - itemCost) < Math.abs(Number(best.costPrice) - itemCost) ? cur : best
          ))
        : null;

      // Still needed as a fallback source for unit info (measureType/unitSymbol/
      // etc.) when creating a brand-new PLU below — NOT for deciding isDefault
      // any more. isDefault is now a manual pin (see resolveCurrentPlu /
      // common/helpers/plu-resolution.util.ts); GRN never sets or moves it.
      const existingDefault = activePlu?.isDefault
        ? activePlu
        : await tx.productPlu.findFirst({
            where: { productId: item.productId, isArchived: false, isDefault: true },
          });

      // Case-size safety net: if this line targets a Count-type (case/carton/box/etc.)
      // PLU and the GRN entry supplies a unitSize that differs from the matched PLU's
      // stored case size, treat it as a different batch even if MRP and cost match —
      // a supplier can ship 168/case one time and 144/case the next at the same price.
      // Silently reusing the old PLU here would leave stock counted in cases but
      // reporting the wrong case size.
      const submittedUnitSize = (item as any).unitSize;
      const caseSizeMismatch = !!activePlu
        && activePlu.measureType === 'COUNT'
        && (item as any).measureType === 'COUNT'
        && submittedUnitSize != null
        && activePlu.unitSize != null
        && Math.abs(Number(activePlu.unitSize) - Number(submittedUnitSize)) > 0.001;

      const priceIsSame = activePlu
        && Math.abs(Number(activePlu.costPrice) - itemCost) < 0.01
        && !caseSizeMismatch;

      // A free line that lands on an existing PLU at the same MRP but a DIFFERENT
      // (paid) cost must never overwrite that PLU's cost basis in place — that would
      // silently blend free (₹0) stock into a paid batch's costing. Force a separate
      // PLU instead. (When priceIsSame is true — e.g. topping up an already-free batch
      // — STEP 2A above already handles it safely, so this only applies in STEP 2B.)
      const freeItemForcesSplit = !!activePlu && !priceIsSame && !!(item as any).isFreeItem;
      const forceSeparateBatch = freeItemForcesSplit || caseSizeMismatch;

      if (activePlu && priceIsSame) {
        // STEP 2A: Same MRP + same cost — add stock to existing PLU (re-activate if inactive)
        await tx.productPlu.update({
          where: { id: activePlu.id },
          data: {
            stockOnHand: { increment: acceptedQty },
            receivedQty: { increment: acceptedQty },
            isActive:    true,
          },
        });
        // No price change — no history record needed for stock-only top-ups
      } else {
        // STEP 2B: New MRP batch or cost changed — create a new PLU.
        // Enforce margin on the new selling price (only when an SP was entered).
        if (itemSp > 0) {
          // Log margin violations even when bypass is enabled — creates audit trail
          if (itemCost > 0 && itemCost >= itemSp && (product as any).allowBelowMargin) {
            this.audit.log(
              { businessId, userId: 'system', userName: approverName, userRole: 'SYSTEM' },
              { action: 'MARGIN_VIOLATION', entity: 'GRN', entityId: grnId, entityRef: product.name,
                description: `Cost ₹${itemCost} ≥ selling price ₹${itemSp} on "${product.name}" — below-margin bypass active` },
            ).catch(() => {});
          }
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

        const newGstRate = itemGstRate || Number(product.gstRatePercent ?? 0);

        if (activePlu && !forceSeparateBatch) {
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
              // isDefault deliberately not touched here — it's a manual pin
              // (see resolveCurrentPlu); GRN never sets, clears, or moves it.
              // Only write unit info this PLU didn't already have, and only when this GRN
              // line actually supplied it — never overwrite an existing value with nothing.
              ...((item as any).measureType !== undefined ? { measureType: (item as any).measureType } : {}),
              ...((item as any).unitSymbol  !== undefined ? { unitSymbol:  (item as any).unitSymbol }  : {}),
              ...((item as any).unitSize    !== undefined ? { unitSize:    (item as any).unitSize }    : {}),
              ...((item as any).baseUnitQty !== undefined ? { baseUnitQty: (item as any).baseUnitQty } : {}),
              ...((item as any).gstUqc      !== undefined ? { gstUqc:      (item as any).gstUqc }      : {}),
            },
          });
          await tx.pluPriceHistory.create({
            data: {
              businessId,
              productPluId:      activePlu.id,
              productId:         item.productId,
              changeSource:      'GRN_APPROVAL',
              grnId,
              changedBy:         approverName,
              effectiveDate:     invoiceDate,
              costPriceBefore:   activePlu.costPrice,
              basicCostBefore:   activePlu.basicCost,
              mrpBefore:         activePlu.mrp,
              sellingPriceBefore: activePlu.sellingPrice,
              gstRateBefore:     activePlu.gstRate,
              hsnCodeBefore:     activePlu.hsnCode,
              isDefaultBefore:   activePlu.isDefault,
              isActiveBefore:    activePlu.isActive,
              costPriceAfter:    itemCost,
              basicCostAfter:    itemBasicCost,
              mrpAfter:          itemMrp,
              sellingPriceAfter: itemSp || null,
              gstRateAfter:      newGstRate,
              hsnCodeAfter:      product.hsnCode,
              isDefaultAfter:    activePlu.isDefault,
              isActiveAfter:     true,
            },
          });
          // isDefault is untouched above — a manual pin (or the lack of one)
          // stays exactly as it was regardless of which batch this GRN line
          // priced/restocked.
        } else {
          // Completely new MRP batch, OR a free line forced into its own batch
          // (see forceSeparateBatch above) — create fresh PLU. It never starts
          // out pinned as default — that's a manual-only action (setDefaultPlu);
          // resolveCurrentPlu() will pick it up automatically via FEFO/most-
          // recent-received once it has stock, with no pin needed.

          // Unit info: prefer what was entered on this GRN line; otherwise fall back to a
          // sibling PLU of the same product that already has it set (existingDefault, then
          // activePlu — both already queried above, no extra query needed).
          const resolvedMeasureType = (item as any).measureType ?? existingDefault?.measureType ?? activePlu?.measureType ?? null;
          const resolvedUnitSymbol  = (item as any).unitSymbol  ?? existingDefault?.unitSymbol  ?? activePlu?.unitSymbol  ?? null;
          const resolvedUnitSize    = (item as any).unitSize    ?? existingDefault?.unitSize    ?? activePlu?.unitSize    ?? null;
          const resolvedBaseUnitQty = (item as any).baseUnitQty ?? existingDefault?.baseUnitQty ?? activePlu?.baseUnitQty ?? null;
          const resolvedGstUqc      = (item as any).gstUqc      ?? existingDefault?.gstUqc      ?? activePlu?.gstUqc      ?? null;

          const newPlu = await tx.productPlu.create({
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
              gstRate:        newGstRate,
              hsnCode:        product.hsnCode,
              cessRate:       itemCessRate,
              taxInclusive:   isInclusive,
              marginPercent:  marginPct,
              marginRs,
              stockOnHand:    acceptedQty,
              receivedQty:    acceptedQty,
              soldQty:        0,
              isDefault:      false,
              isActive:       true,
              isArchived:     false,
              effectiveFrom:  invoiceDate,
              receivedDate:   invoiceDate,
              grnId,
              batchNumber:        (item as any).batchNumber        ?? null,
              manufacturingDate:  (item as any).manufacturingDate  ?? null,
              expiryDate:         (item as any).expiryDate         ?? null,
              createdByName:  approverName,
              measureType: resolvedMeasureType,
              unitSymbol:  resolvedUnitSymbol,
              unitSize:    resolvedUnitSize,
              baseUnitQty: resolvedBaseUnitQty,
              gstUqc:      resolvedGstUqc,
            },
          });
          await tx.pluPriceHistory.create({
            data: {
              businessId,
              productPluId:   newPlu.id,
              productId:      item.productId,
              changeSource:   'PLU_CREATE',
              grnId,
              changedBy:      approverName,
              effectiveDate:  invoiceDate,
              // No "before" — this is a new PLU
              costPriceAfter:    itemCost,
              basicCostAfter:    itemBasicCost,
              mrpAfter:          itemMrp,
              sellingPriceAfter: itemSp || null,
              gstRateAfter:      newGstRate,
              hsnCodeAfter:      product.hsnCode,
              isDefaultAfter:    false,
              isActiveAfter:     true,
              notes:             'New PLU created from GRN',
            },
          });
        } // end else (new MRP batch)
      } // end STEP 2B

      // STEP 2C: Auto-manage availableOnline — ALL active PLUs with positive stock
      // are shown online so customers can compare every available batch (MRP).
      // PLUs with zero stock are hidden from the storefront.
      await tx.productPlu.updateMany({
        where: { productId: item.productId, businessId, isActive: true, isArchived: false, stockOnHand: { lte: 0 } },
        data:  { availableOnline: false },
      });
      await tx.productPlu.updateMany({
        where: { productId: item.productId, businessId, isActive: true, isArchived: false, stockOnHand: { gt: 0 } },
        data:  { availableOnline: true },
      });

      // STEP 3: Update Product.totalStock = sum of all active PLU stockOnHand,
      // and re-sync the Product-level mrp/sellingPrice/costPrice display cache
      // from resolveCurrentPlu() — the single source of truth for "the current
      // batch" (manual pin, else FEFO, else most-recent) — rather than from
      // whichever PLU this particular GRN line happened to touch. Re-resolved
      // after every line so a product with several lines on one GRN ends up
      // pointed at its true current batch once the whole GRN is processed,
      // not just wherever the last line landed.
      const agg = await tx.productPlu.aggregate({
        where: { productId: item.productId, isActive: true, isArchived: false },
        _sum:  { stockOnHand: true },
      });
      const currentPlu = await this.productsService.resolveCurrentPlu(item.productId, tx);
      await tx.product.update({
        where: { id: item.productId },
        data:  {
          totalStock: Number(agg._sum.stockOnHand ?? 0),
          ...(currentPlu ? {
            mrp:          currentPlu.mrp,
            sellingPrice: currentPlu.sellingPrice,
            costPrice:    currentPlu.costPrice,
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
      this.prisma.purchaseTaxBreakup.deleteMany({ where: { purchaseId: id } }),
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

  // Aggregates the rejected-qty lines on a GRN into a prefill for the
  // Create Credit Note form — prorates each line's already-computed
  // taxableAmount/cessAmount by rejectedQty/totalReceivedQty rather than
  // re-deriving cost math, and weight-averages the GST rate across lines
  // since a single credit note only carries one flat rate.
  async getRejectedItemsSummary(businessId: string, grnId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: grnId, businessId },
      select: {
        items: {
          where: { rejectedQty: { gt: 0 } },
          select: {
            productId: true,
            productName: true,
            hsnCode: true,
            unitOfMeasure: true,
            rejectedQty: true,
            totalReceivedQty: true,
            taxableAmount: true,
            cessAmount: true,
            gstRatePercent: true,
            rejectionReason: true,
          },
        },
      },
    });
    if (!purchase) throw new NotFoundException('GRN not found');

    let taxableAmount = 0;
    let cessAmount = 0;
    let weightedRateSum = 0;
    const reasons = new Set<string>();
    const items = purchase.items.map((item) => {
      const received = Number(item.totalReceivedQty);
      const rejected = Number(item.rejectedQty);
      const fraction = received > 0 ? rejected / received : 0;
      const lineTaxable = this.r2(Number(item.taxableAmount) * fraction);
      const lineCess    = this.r2(Number(item.cessAmount) * fraction);
      const gstRate     = Number(item.gstRatePercent);
      const unitPrice   = rejected > 0 ? this.r2(lineTaxable / rejected) : 0;
      const cessRate    = lineTaxable > 0 ? this.r2(lineCess / lineTaxable * 100) : 0;

      taxableAmount    += lineTaxable;
      cessAmount       += lineCess;
      weightedRateSum  += lineTaxable * gstRate;
      if (item.rejectionReason) reasons.add(item.rejectionReason);

      return {
        productId: item.productId,
        productName: item.productName,
        hsnCode: item.hsnCode,
        unitOfMeasure: item.unitOfMeasure,
        rejectedQty: rejected,
        unitPrice,
        taxableAmount: lineTaxable,
        gstRatePercent: gstRate,
        cessRate,
        rejectionReason: item.rejectionReason,
      };
    });

    taxableAmount = this.r2(taxableAmount);
    cessAmount    = this.r2(cessAmount);
    const gstRate = taxableAmount > 0 ? this.r2(weightedRateSum / taxableAmount) : 0;

    return {
      hasRejectedItems: items.length > 0,
      taxableAmount,
      cessAmount,
      gstRate,
      reasons: Array.from(reasons),
      items,
    };
  }

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
    const supplierState = supplier.gstin ? gstinStateCode(supplier.gstin, 'This supplier') : null;
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

    if (dto.itcReversal) {
      const d = new Date(dto.cnDate);
      const taxPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      this.gst.addItcEntry(businessId, taxPeriod, 'CREDIT_NOTE', cn.id, -cgst, -sgst, -igst).catch(() => {});
    }

    this.journalBridge.postCreditNoteJournal({
      id:             cn.id,
      businessId,
      scnNumber:      cn.scnNumber,
      grandTotal:     total,
      taxableAmount:  taxable,
      cgstTotal:      cgst,
      sgstTotal:      sgst,
      igstTotal:      igst,
      isMsmeSupplier: !!supplier.udyamRegistration,
    }).catch(() => {});

    return { ...cn, isInterstate };
  }

  // Credit notes are financial documents — never mutated after creation,
  // only cancelled (excluded from every supplier-balance calculation, which
  // all filter status: 'ACTIVE'). Mirrors how bills are voided elsewhere.
  async cancelSupplierCreditNote(businessId: string, id: string, userName: string) {
    const cn = await this.prisma.supplierCreditNote.findFirst({
      where: { id, businessId },
      include: { supplier: { select: { udyamRegistration: true } } },
    });
    if (!cn) throw new NotFoundException('Credit note not found');
    if (cn.status === 'CANCELLED') throw new BadRequestException('Credit note is already cancelled');

    const updated = await this.prisma.supplierCreditNote.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: `${cn.notes ? cn.notes + ' | ' : ''}Cancelled by ${userName} on ${new Date().toLocaleDateString('en-IN')}`,
      },
    });

    if (cn.itcReversal) {
      this.prisma.itcLedger.updateMany({
        where: { sourceType: 'CREDIT_NOTE', sourceId: cn.id, isReversed: false },
        data: { isReversed: true, reversalReason: 'Credit note cancelled' },
      }).catch(() => {});
    }

    this.journalBridge.postCreditNoteJournal({
      id:             cn.id,
      businessId,
      scnNumber:      cn.scnNumber,
      grandTotal:     Number(cn.totalAmount),
      taxableAmount:  Number(cn.taxableAmount),
      cgstTotal:      Number(cn.cgstAmount),
      sgstTotal:      Number(cn.sgstAmount),
      igstTotal:      Number(cn.igstAmount),
      isMsmeSupplier: !!cn.supplier?.udyamRegistration,
    }, true).catch(() => {});

    return updated;
  }

  async getSupplierCreditNoteById(businessId: string, id: string) {
    const cn = await this.prisma.supplierCreditNote.findFirst({
      where: { id, businessId },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    });
    if (!cn) throw new NotFoundException('Credit note not found');

    const grn = cn.originalGrnId
      ? await this.prisma.purchase.findFirst({
          where: { id: cn.originalGrnId, businessId },
          select: { id: true, grnNumber: true, invoiceNumber: true },
        })
      : null;

    return { ...cn, grn };
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

  // ─── PURCHASE DEBIT NOTES (itemized goods returns) ────
  // The document WE issue when returning goods to a supplier — matches
  // standard Indian accounting practice (Tally's "Debit Note" voucher for
  // purchase returns) rather than SupplierCreditNote, which is for credits
  // the supplier proactively issues (schemes/rebates/rate corrections) with
  // no itemized return behind them.

  async createPurchaseDebitNote(
    businessId: string,
    userId: string,
    userName: string,
    dto: {
      supplierId: string;
      originalGrnId?: string;
      originalInvoiceNo?: string;
      supplierCnNumber?: string;
      debitNoteDate: string;
      reason: string;
      itcReversal?: boolean;
      notes?: string;
      items: Array<{
        productId?: string;
        productName: string;
        hsnCode?: string;
        quantity: number;
        unitPrice: number;
        gstRate: number;
        cessRate?: number;
      }>;
    },
  ) {
    if (!dto.items?.length) throw new BadRequestException('At least one returned item is required');

    const supplier = await this.prisma.supplier.findFirst({ where: { id: dto.supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { stateCode: true },
    });
    const supplierState = supplier.gstin ? gstinStateCode(supplier.gstin, 'This supplier') : null;
    const isInterstate = !!(supplierState && business?.stateCode && supplierState !== business.stateCode);

    let taxableAmount = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0, cessAmount = 0;
    const itemsData = dto.items.map((it) => {
      if (it.quantity <= 0) throw new BadRequestException(`Quantity must be greater than 0 for ${it.productName}`);
      const lineTaxable = this.r2(it.quantity * it.unitPrice);
      const gstRate      = it.gstRate ?? 0;
      const lineGst       = this.r2(lineTaxable * gstRate / 100);
      const lineCgst      = isInterstate ? 0 : this.r2(lineGst / 2);
      const lineSgst      = isInterstate ? 0 : this.r2(lineGst / 2);
      const lineIgst      = isInterstate ? lineGst : 0;
      const cessRate      = it.cessRate ?? 0;
      const lineCess       = this.r2(lineTaxable * cessRate / 100);
      const lineTotal      = this.r2(lineTaxable + lineGst + lineCess);

      taxableAmount += lineTaxable;
      cgstAmount    += lineCgst;
      sgstAmount    += lineSgst;
      igstAmount    += lineIgst;
      cessAmount    += lineCess;

      return {
        productId:     it.productId ?? null,
        productName:   it.productName,
        hsnCode:       it.hsnCode ?? null,
        quantity:      it.quantity,
        unitPrice:     it.unitPrice,
        taxableAmount: lineTaxable,
        gstRate,
        cgstAmount: lineCgst,
        sgstAmount: lineSgst,
        igstAmount: lineIgst,
        cessAmount: lineCess,
        totalAmount: lineTotal,
      };
    });

    taxableAmount = this.r2(taxableAmount);
    cgstAmount    = this.r2(cgstAmount);
    sgstAmount    = this.r2(sgstAmount);
    igstAmount    = this.r2(igstAmount);
    cessAmount    = this.r2(cessAmount);
    const totalAmount = this.r2(taxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount);

    const fy = await this.getActiveFy(businessId);

    // Stock bookkeeping needs a branch for the StockLedger audit trail —
    // ProductPlu.stockOnHand itself is business-wide, not branch-scoped (same
    // as every other stock-mutating flow in this codebase). Use the linked
    // GRN's branch when this return is tied to one, else the business's
    // first/only branch.
    const branchId = dto.originalGrnId
      ? (await this.prisma.purchase.findFirst({ where: { id: dto.originalGrnId, businessId }, select: { branchId: true } }))?.branchId
      : (await this.prisma.branch.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id;
    if (!branchId) throw new BadRequestException('No branch configured for this business — cannot record stock movement');

    const productIds = [...new Set(itemsData.map((it) => it.productId).filter((id): id is string => !!id))];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, expiryTracking: true, allowNegativeStock: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Guard against returning more than was ever flagged rejected on this GRN
    // line — prevents the same rejected line being debited twice (retry,
    // back-button, double-submit) beyond what was actually rejected.
    if (dto.originalGrnId) {
      const grnItems = await this.prisma.purchaseItem.findMany({
        where: { purchaseId: dto.originalGrnId, rejectedQty: { gt: 0 } },
        select: { productId: true, rejectedQty: true },
      });
      const rejectedQtyByProduct = new Map(grnItems.map((i) => [i.productId, Number(i.rejectedQty)]));

      const priorNotes = await this.prisma.purchaseDebitNoteItem.findMany({
        where: { debitNote: { originalGrnId: dto.originalGrnId, status: 'ISSUED' } },
        select: { productId: true, quantity: true },
      });
      const alreadyReturnedByProduct = new Map<string, number>();
      for (const it of priorNotes) {
        if (!it.productId) continue;
        alreadyReturnedByProduct.set(it.productId, (alreadyReturnedByProduct.get(it.productId) ?? 0) + Number(it.quantity));
      }

      for (const it of itemsData) {
        if (!it.productId) continue;
        const rejectedQty = rejectedQtyByProduct.get(it.productId);
        if (rejectedQty === undefined) continue; // not a rejected-at-receiving line — no ceiling to check
        const alreadyReturned = alreadyReturnedByProduct.get(it.productId) ?? 0;
        if (alreadyReturned + it.quantity > rejectedQty + 0.001) {
          throw new BadRequestException(
            `${it.productName}: only ${this.r2(rejectedQty - alreadyReturned)} of the ${rejectedQty} rejected on this GRN remains available to return (already returned: ${alreadyReturned}).`,
          );
        }
      }
    }

    const { dn, debitNoteNumber } = await this.prisma.$transaction(async (tx) => {
      const series = await tx.billSeries.findFirst({
        where: { businessId, financialYearId: fy.id, billType: 'PDN', isActive: true },
      });
      if (!series) throw new BadRequestException('PDN bill series not configured. Run Admin seed.');
      const updated = await tx.billSeries.update({
        where: { id: series.id },
        data: { currentNumber: { increment: 1 } },
      });
      const padLen = updated.numberFormat.length;
      const debitNoteNumber = `${updated.seriesPrefix}${fy.fyCode}/${String(updated.currentNumber).padStart(padLen, '0')}`;

      const dn = await tx.purchaseDebitNote.create({
        data: {
          businessId,
          debitNoteNumber,
          debitNoteDate:     new Date(dto.debitNoteDate),
          supplierId:        dto.supplierId,
          supplierName:      supplier.name,
          supplierGstin:     supplier.gstin ?? null,
          originalGrnId:     dto.originalGrnId     ?? null,
          originalInvoiceNo: dto.originalInvoiceNo ?? null,
          supplierCnNumber:  dto.supplierCnNumber  ?? null,
          reason:            dto.reason,
          taxableAmount, cgstAmount, sgstAmount, igstAmount, cessAmount, totalAmount,
          itcReversal:       dto.itcReversal ?? false,
          status:            'ISSUED',
          notes:             dto.notes ?? null,
          createdById:       userId,
          createdByName:     userName,
        },
      });

      // Decrement real sellable stock per line and record which PLU(s) it came
      // from, so cancellation can restore it precisely (same idea as how a
      // sale bill item stores pluId so SALE_VOID can restore the exact PLU).
      const touchedProductIds = new Set<string>();

      for (const it of itemsData) {
        let pluId: string | null = null;

        if (it.productId) {
          const product = productMap.get(it.productId);
          let remaining = it.quantity;

          // GRN-tied return: the exact PLU that GRN created is the precise match.
          // Locate it with a plain read, then re-read it locked (FOR UPDATE)
          // so the stockOnHand value the decrement below acts on can't go
          // stale against a concurrent transaction on the same row.
          const exactPluRef = dto.originalGrnId
            ? await tx.productPlu.findFirst({ where: { productId: it.productId, businessId, grnId: dto.originalGrnId }, select: { id: true } })
            : null;
          const exactPlu = exactPluRef ? await lockPluById(tx, exactPluRef.id) : null;

          if (exactPlu) {
            const deduct = Math.min(remaining, exactPlu.stockOnHand);
            await tx.productPlu.update({ where: { id: exactPlu.id }, data: { stockOnHand: { decrement: deduct } } });
            pluId = exactPlu.id;
            remaining -= deduct;
          }

          if (remaining > 0) {
            const allCandidates = await lockPluCandidatesForDeduction(tx, businessId, it.productId, product?.expiryTracking ?? false);
            const plus = exactPlu ? allCandidates.filter((p) => p.id !== exactPlu.id) : allCandidates;
            for (const plu of plus) {
              if (remaining <= 0) break;
              const deduct = Math.min(remaining, Number(plu.stockOnHand));
              await tx.productPlu.update({ where: { id: plu.id }, data: { stockOnHand: { decrement: deduct } } });
              pluId = pluId ?? plu.id;
              remaining -= deduct;
            }
          }

          if (remaining > 0 && !product?.allowNegativeStock) {
            throw new BadRequestException(`Insufficient stock to return ${it.quantity} of ${it.productName} — only ${this.r2(it.quantity - remaining)} available`);
          }

          await tx.stockLedger.create({
            data: {
              businessId,
              branchId,
              productId:     it.productId,
              movementType:  'RETURN_OUT',
              quantity:      -it.quantity,
              referenceType: 'DEBIT_NOTE',
              referenceId:   dn.id,
              notes:         `Return: ${it.productName}`,
            },
          });

          touchedProductIds.add(it.productId);
        }

        await tx.purchaseDebitNoteItem.create({ data: { ...it, debitNoteId: dn.id, pluId } });
      }

      for (const productId of touchedProductIds) {
        const agg = await tx.productPlu.aggregate({ where: { productId, isArchived: false }, _sum: { stockOnHand: true } });
        await tx.product.update({ where: { id: productId }, data: { totalStock: Number(agg._sum.stockOnHand ?? 0) } });
      }

      return { dn, debitNoteNumber };
    });

    // Fire-and-forget, after the transaction commits — GL journal + ITC
    // reversal, matching JournalBridgeService's documented safety contract.
    this.journalBridge.postDebitNoteJournal({
      id:             dn.id,
      businessId,
      debitNoteNumber,
      grandTotal:     totalAmount,
      taxableAmount,
      cgstTotal:      cgstAmount,
      sgstTotal:      sgstAmount,
      igstTotal:      igstAmount,
      isMsmeSupplier: !!supplier.udyamRegistration,
    }).catch(() => {});

    if (dto.itcReversal) {
      const d = new Date(dto.debitNoteDate);
      const taxPeriod = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      this.gst.addItcEntry(businessId, taxPeriod, 'DEBIT_NOTE', dn.id, -cgstAmount, -sgstAmount, -igstAmount).catch(() => {});
    }

    const full = await this.prisma.purchaseDebitNote.findUnique({ where: { id: dn.id }, include: { items: true } });
    return { ...full, isInterstate };
  }

  // Debit notes are financial documents — never mutated after issuing, only
  // cancelled (excluded from every supplier-balance calculation). Cancelling
  // also restores the stock it decremented and reverses the GL/ITC entries.
  async cancelPurchaseDebitNote(businessId: string, id: string, userName: string) {
    const dn = await this.prisma.purchaseDebitNote.findFirst({
      where: { id, businessId },
      include: { items: true, supplier: true },
    });
    if (!dn) throw new NotFoundException('Debit note not found');
    if (dn.status === 'CANCELLED') throw new BadRequestException('Debit note is already cancelled');

    const branchId = dn.originalGrnId
      ? (await this.prisma.purchase.findFirst({ where: { id: dn.originalGrnId, businessId }, select: { branchId: true } }))?.branchId
      : (await this.prisma.branch.findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Conditional on status != CANCELLED — closes the double-cancel race
      // where two concurrent requests both pass the status check above
      // before either commits, which would otherwise restore stock twice.
      const { count } = await tx.purchaseDebitNote.updateMany({
        where: { id, status: { not: 'CANCELLED' } },
        data: {
          status: 'CANCELLED',
          notes: `${dn.notes ? dn.notes + ' | ' : ''}Cancelled by ${userName} on ${new Date().toLocaleDateString('en-IN')}`,
        },
      });
      if (count === 0) throw new BadRequestException('Debit note is already cancelled');

      const touchedProductIds = new Set<string>();

      for (const item of dn.items) {
        if (item.pluId && item.productId && branchId) {
          await tx.productPlu.update({
            where: { id: item.pluId },
            data: { stockOnHand: { increment: Number(item.quantity) } },
          });
          await tx.stockLedger.create({
            data: {
              businessId,
              branchId,
              productId:     item.productId,
              movementType:  'RETURN_IN',
              quantity:      Number(item.quantity),
              referenceType: 'DEBIT_NOTE_CANCEL',
              referenceId:   dn.id,
              notes:         `Debit note ${dn.debitNoteNumber} cancelled — stock restored`,
            },
          });
          touchedProductIds.add(item.productId);
        }
      }

      for (const productId of touchedProductIds) {
        const agg = await tx.productPlu.aggregate({ where: { productId, isArchived: false }, _sum: { stockOnHand: true } });
        await tx.product.update({ where: { id: productId }, data: { totalStock: Number(agg._sum.stockOnHand ?? 0) } });
      }

      return tx.purchaseDebitNote.findUniqueOrThrow({ where: { id } });
    });

    this.journalBridge.postDebitNoteJournal({
      id:             dn.id,
      businessId,
      debitNoteNumber: dn.debitNoteNumber,
      grandTotal:     Number(dn.totalAmount),
      taxableAmount:  Number(dn.taxableAmount),
      cgstTotal:      Number(dn.cgstAmount),
      sgstTotal:      Number(dn.sgstAmount),
      igstTotal:      Number(dn.igstAmount),
      isMsmeSupplier: !!dn.supplier?.udyamRegistration,
    }, true).catch(() => {});

    if (dn.itcReversal) {
      this.prisma.itcLedger.updateMany({
        where: { sourceType: 'DEBIT_NOTE', sourceId: dn.id, isReversed: false },
        data: { isReversed: true, reversalReason: 'Debit note cancelled' },
      }).catch(() => {});
    }

    return updated;
  }

  async getPurchaseDebitNoteById(businessId: string, id: string) {
    const dn = await this.prisma.purchaseDebitNote.findFirst({
      where: { id, businessId },
      include: {
        supplier: { select: { id: true, name: true } },
        items: true,
      },
    });
    if (!dn) throw new NotFoundException('Debit note not found');

    const grn = dn.originalGrnId
      ? await this.prisma.purchase.findFirst({
          where: { id: dn.originalGrnId, businessId },
          select: { id: true, grnNumber: true, invoiceNumber: true },
        })
      : null;

    return { ...dn, grn };
  }

  async getPurchaseDebitNotes(
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
    if (filters.supplierId)    where.supplierId    = filters.supplierId;
    if (filters.originalGrnId) where.originalGrnId = filters.originalGrnId;
    if (filters.dateFrom || filters.dateTo) {
      where.debitNoteDate = {};
      if (filters.dateFrom) where.debitNoteDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.debitNoteDate.lte = new Date(filters.dateTo + 'T23:59:59');
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchaseDebitNote.findMany({
        where,
        orderBy: { debitNoteDate: 'desc' },
        skip,
        take: limit,
        include: { supplier: { select: { id: true, name: true } }, items: true },
      }),
      this.prisma.purchaseDebitNote.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
