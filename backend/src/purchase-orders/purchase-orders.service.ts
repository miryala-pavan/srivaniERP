import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { gstinStateCode } from '../common/gstin.util';
import { ProductsService } from '../products/products.service';

const PO_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON'];

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  // ─── Generate sequential PO number inside a transaction ────────────────────
  private async nextPoNumber(tx: any, businessId: string): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await tx.purchaseOrder.count({
      where: { businessId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    return `PO-${today}-${String(count + 1).padStart(4, '0')}`;
  }

  // ─── Create manual PO ───────────────────────────────────────────────────────
  async create(businessId: string, body: {
    supplierId: string;
    items: { productId: string; productName: string; pluCode?: string; qtyOrdered: number; unitCost?: number; notes?: string }[];
    expectedDate?: string;
    notes?: string;
    userId?: string;
    userName?: string;
  }) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: body.supplierId, businessId },
      select: { id: true, name: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!body.items?.length) throw new BadRequestException('At least one item required');

    return this.prisma.$transaction(async (tx) => {
      const poNumber = await this.nextPoNumber(tx, businessId);
      return tx.purchaseOrder.create({
        data: {
          businessId,
          poNumber,
          supplierId: body.supplierId,
          supplierName: supplier.name,
          status: 'DRAFT',
          source: 'MANUAL',
          expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
          notes: body.notes,
          createdById: body.userId,
          createdByName: body.userName,
          items: {
            create: body.items.map(i => ({
              productId: i.productId,
              productName: i.productName,
              pluCode: i.pluCode,
              qtyOrdered: i.qtyOrdered,
              unitCost: i.unitCost ?? null,
              notes: i.notes,
            })),
          },
        },
        include: { items: true, supplier: { select: { id: true, name: true, phone: true } } },
      });
    });
  }

  // ─── Auto-generate PO from LOW_STOCK trigger ────────────────────────────────
  // Called from pos.service when stock drops below reorderLevel.
  // Groups all products for the same supplier into one draft PO per day.
  async autoGenerate(businessId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
      select: {
        id: true, name: true, productCode: true,
        preferredSupplierId: true,
        reorderQuantity: true,
      },
    });
    if (!product?.preferredSupplierId) return;
    if (!product.reorderQuantity || Number(product.reorderQuantity) <= 0) return;

    // Reorder suggestions must reflect the product's actual current batch —
    // Product.costPrice is just a display cache that GRN keeps in sync with
    // whichever PLU is truly "current" (see resolveCurrentPlu), not
    // necessarily the one this reorder should be priced/coded against.
    const currentPlu = await this.productsService.resolveCurrentPlu(product.id);
    const unitCost = currentPlu ? Number(currentPlu.costPrice) : null;
    const pluCode  = currentPlu?.pluCode ?? undefined;

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: product.preferredSupplierId, businessId },
      select: { id: true, name: true },
    });
    if (!supplier) return;

    // Check: is there already an open PO containing this product?
    const existingItem = await this.prisma.purchaseOrderItem.findFirst({
      where: {
        productId,
        po: { businessId, status: { in: ['DRAFT', 'SENT'] } },
      },
    });
    if (existingItem) return; // already on a pending PO

    await this.prisma.$transaction(async (tx) => {
      // Check if a DRAFT PO for this supplier was already created today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existingDraftPO = await tx.purchaseOrder.findFirst({
        where: {
          businessId,
          supplierId: supplier.id,
          status: 'DRAFT',
          source: 'AUTO_REORDER',
          createdAt: { gte: todayStart },
        },
      });

      if (existingDraftPO) {
        // Append item to existing draft PO
        await tx.purchaseOrderItem.create({
          data: {
            poId: existingDraftPO.id,
            productId: product.id,
            productName: product.name,
            pluCode,
            qtyOrdered: Number(product.reorderQuantity),
            unitCost,
          },
        });
        await tx.purchaseOrder.update({
          where: { id: existingDraftPO.id },
          data: { updatedAt: new Date() },
        });
      } else {
        // Create a new draft PO
        const poNumber = await this.nextPoNumber(tx, businessId);
        await tx.purchaseOrder.create({
          data: {
            businessId,
            poNumber,
            supplierId: supplier.id,
            supplierName: supplier.name,
            status: 'DRAFT',
            source: 'AUTO_REORDER',
            createdByName: 'System (Auto-Reorder)',
            items: {
              create: [{
                productId: product.id,
                productName: product.name,
                pluCode,
                qtyOrdered: Number(product.reorderQuantity),
                unitCost,
              }],
            },
          },
        });
      }
    });
  }

  // ─── List all POs ───────────────────────────────────────────────────────────
  async findAll(businessId: string, filters: {
    status?: string;
    supplierId?: string;
    source?: string;
    from?: string;
    to?: string;
    take?: number;
  }) {
    const where: any = { businessId };
    if (filters.status) where.status = filters.status;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    if (filters.source) where.source = filters.source;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    return this.prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: { select: { id: true, productName: true, qtyOrdered: true, qtyReceived: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.take ?? 100,
    });
  }

  // ─── Single PO ─────────────────────────────────────────────────────────────
  async findOne(businessId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId },
      include: {
        supplier: { select: { id: true, name: true, phone: true, email: true, gstin: true } },
        items: true,
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  // ─── Mark as sent (WhatsApp / Email) ───────────────────────────────────────
  async markSent(businessId: string, id: string, via: 'WHATSAPP' | 'EMAIL') {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, businessId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status === 'CANCELLED') throw new BadRequestException('Cannot send a cancelled PO');
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), sentVia: via },
    });
  }

  // ─── Update item received qty ───────────────────────────────────────────────
  async updateReceived(businessId: string, poId: string, itemId: string, qtyReceived: number) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, businessId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    // itemId has no businessId of its own — without this, any caller with
    // access to *some* PO could pass an arbitrary itemId belonging to a
    // different PO (potentially a different business's) and overwrite its
    // received quantity directly.
    if (!po.items.some(i => i.id === itemId)) {
      throw new BadRequestException('Item does not belong to this purchase order');
    }
    if (!Number.isFinite(qtyReceived) || qtyReceived < 0) {
      throw new BadRequestException('qtyReceived must be a non-negative number');
    }

    await this.prisma.purchaseOrderItem.update({
      where: { id: itemId },
      data: { qtyReceived },
    });

    // Recalculate overall PO status
    const updatedItems = await this.prisma.purchaseOrderItem.findMany({ where: { poId } });
    const allReceived  = updatedItems.every(i => Number(i.qtyReceived) >= Number(i.qtyOrdered));
    const anyReceived  = updatedItems.some(i => Number(i.qtyReceived) > 0);
    const newStatus    = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;

    return this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus },
      include: { items: true, supplier: { select: { id: true, name: true, phone: true } } },
    });
  }

  // ─── Cancel PO ─────────────────────────────────────────────────────────────
  async cancel(businessId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, businessId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (['RECEIVED', 'CANCELLED'].includes(po.status)) {
      throw new BadRequestException(`Cannot cancel a ${po.status.toLowerCase()} PO`);
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  // ─── Create GRN draft from PO ──────────────────────────────────────────────
  async createGrnFromPo(
    businessId: string,
    poId: string,
    body: { invoiceNumber: string; invoiceDate: string; branchId?: string },
  ) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, businessId },
      include: {
        items: { include: { product: { include: { tax: true } } } },
        supplier: true,
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status === 'CANCELLED') throw new BadRequestException('Cannot receive a cancelled PO');
    if (po.status === 'RECEIVED')  throw new BadRequestException('This PO is already fully received');

    const remainingByItem = new Map(po.items.map(i => [i.id, Math.max(0, Number(i.qtyOrdered) - Number(i.qtyReceived))]));
    if (![...remainingByItem.values()].some(q => q > 0)) {
      throw new BadRequestException('All items on this PO have already been received — nothing left to receive');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { businessId, isActive: true, ...(body.branchId ? { id: body.branchId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
    if (!branch) throw new BadRequestException('No active branch found');

    const dup = await this.prisma.purchase.findFirst({
      where: { businessId, supplierId: po.supplierId, invoiceNumber: body.invoiceNumber },
    });
    if (dup) throw new ConflictException(`Invoice ${body.invoiceNumber} already recorded for this supplier`);

    // Resolve inter-state from supplier GSTIN vs business state code —
    // gstinStateCode() validates the format before trusting the substring,
    // same as every other interstate check in the codebase; a raw
    // substring here could silently produce a wrong CGST+SGST vs IGST
    // split for a malformed/legacy supplier GSTIN.
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId }, select: { stateCode: true },
    });
    const supplierState  = po.supplier.gstin ? gstinStateCode(po.supplier.gstin, 'This supplier') : null;
    const isInterState   = !!(biz?.stateCode && supplierState && supplierState !== biz.stateCode);

    // GRN number from active bill series
    const fy = await this.prisma.financialYear.findFirst({
      where: { businessId, isActive: true },
    });
    if (!fy) throw new BadRequestException('No active financial year. Configure in Settings.');
    const series = await this.prisma.billSeries.findFirst({
      where: { businessId, financialYearId: fy.id, billType: 'GRN', isActive: true },
    });
    if (!series) throw new BadRequestException('GRN bill series not configured. Run Admin → Seed.');
    const updated = await this.prisma.billSeries.update({
      where: { id: series.id },
      data: { currentNumber: { increment: 1 } },
    });
    const padLen   = updated.numberFormat.length;
    const grnNumber = `${updated.seriesPrefix}${fy.fyCode}/${String(updated.currentNumber).padStart(padLen, '0')}`;

    // Build items with basic GST calculation (TAX_EXCLUSIVE, no discounts)
    let taxableTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;

    const itemsData = po.items
      .filter(i => (remainingByItem.get(i.id) ?? 0) > 0)
      .map(i => {
        const product  = i.product;
        if (!product) throw new BadRequestException(`Product ${i.productName} not found`);
        const gstRate  = Number(product.tax?.taxRate ?? 0);
        const qty      = remainingByItem.get(i.id)!;
        const cost     = Number(i.unitCost ?? 0);
        const taxable  = this.r2(cost * qty);
        const cgst     = isInterState ? 0 : this.r2(taxable * gstRate / 200);
        const sgst     = isInterState ? 0 : this.r2(taxable * gstRate / 200);
        const igst     = isInterState ? this.r2(taxable * gstRate / 100) : 0;
        const lineTotal = taxable + cgst + sgst + igst;

        taxableTotal += taxable;
        cgstTotal    += cgst;
        sgstTotal    += sgst;
        igstTotal    += igst;

        return {
          productId: i.productId, taxId: product.taxId,
          productName: product.name, hsnCode: product.hsnCode ?? null,
          quantity: qty, freeQuantity: 0, unitPrice: cost,
          taxableAmount: taxable, gstRatePercent: gstRate,
          cgstAmount: cgst, sgstAmount: sgst, igstAmount: igst,
          totalAmount: lineTotal, lineTotal,
          basicCostPrice: cost, netCostPrice: cost, trueCostPrice: cost,
          casesReceived: qty, totalReceivedQty: qty, acceptedQty: qty,
          unitOfMeasure: 'PCS',
        };
      });

    const grandTotal = this.r2(taxableTotal + cgstTotal + sgstTotal + igstTotal);

    const purchase = await this.prisma.$transaction(async (tx) => {
      // Re-check status fresh inside the transaction — the `po` read above
      // happened before this transaction opened, so a concurrent receive
      // (double-click, or two invoices for one PO arriving close together)
      // could have already changed it.
      const freshPo = await tx.purchaseOrder.findFirst({ where: { id: poId, businessId } });
      if (!freshPo || ['RECEIVED', 'CANCELLED'].includes(freshPo.status)) {
        throw new ConflictException('This purchase order was already received or cancelled by another request');
      }

      const created = await tx.purchase.create({
        data: {
          businessId,
          branchId: branch.id,
          supplierId:    po.supplierId,
          supplierName:  po.supplierName,
          supplierGstin: po.supplier.gstin ?? null,
          invoiceNumber: body.invoiceNumber,
          invoiceDate:   new Date(body.invoiceDate),
          grnNumber,
          status:          'PENDING_APPROVAL',
          poNumber:        po.poNumber,
          taxType:         'TAX_EXCLUSIVE',
          itcEligibility:  'ELIGIBLE',
          isInterState,
          taxableAmount:   this.r2(taxableTotal),
          totalTaxAmount:  this.r2(cgstTotal + sgstTotal + igstTotal),
          cgstTotal:       this.r2(cgstTotal),
          sgstTotal:       this.r2(sgstTotal),
          igstTotal:       this.r2(igstTotal),
          grandTotal,
          amountPayable:   grandTotal,
          balanceAmount:   grandTotal,
          receivedDate:    new Date(),
          items: { create: itemsData },
        },
        select: { id: true, grnNumber: true },
      });

      // This flow always receives everything still outstanding on the PO in
      // one shot (there's no per-item partial-quantity input here — that's
      // what the separate updateReceived endpoint is for), so every item's
      // qtyReceived goes to its full qtyOrdered.
      for (const item of po.items) {
        const remaining = remainingByItem.get(item.id) ?? 0;
        if (remaining > 0) {
          // Conditional write guarded by the qtyReceived we read before this
          // transaction opened: if a concurrent request already changed it
          // (e.g. a second createGrnFromPo/updateReceived call landed first),
          // this matches 0 rows and the whole transaction — including the
          // Purchase row already created above — rolls back, instead of
          // silently double-receiving the same items.
          const result = await tx.purchaseOrderItem.updateMany({
            where: { id: item.id, qtyReceived: item.qtyReceived },
            data:  { qtyReceived: Number(item.qtyOrdered) },
          });
          if (result.count === 0) {
            throw new ConflictException('This purchase order was updated by another request — please retry');
          }
        }
      }

      const updatedItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
      const allReceived  = updatedItems.every(i => Number(i.qtyReceived) >= Number(i.qtyOrdered));
      await tx.purchaseOrder.update({
        where: { id: poId },
        data:  { status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      });

      return created;
    });

    // Price-variance guard (non-blocking): this flow always receives at the
    // PO's own price — there's no way to enter a different actual invoice
    // price here — so the only thing that can silently go wrong is the PO
    // itself being stale (raised weeks ago, price has since moved). Compare
    // against each product's current default batch cost so a purchase
    // clerk isn't blindsided by locking in an outdated price.
    let warning: object | null = null;
    try {
      const receivedItems = po.items.filter(i => (remainingByItem.get(i.id) ?? 0) > 0);
      const productIds = receivedItems.map(i => i.productId);
      const currentPlus = await this.prisma.productPlu.findMany({
        where: { productId: { in: productIds }, isArchived: false, isDefault: true },
        select: { productId: true, costPrice: true },
      });
      const currentCostByProduct = new Map(currentPlus.map(p => [p.productId, Number(p.costPrice)]));

      const VARIANCE_THRESHOLD_PCT = 10;
      const variances = receivedItems
        .map(i => {
          const poPrice = Number(i.unitCost ?? 0);
          const currentCost = currentCostByProduct.get(i.productId);
          if (!currentCost || poPrice <= 0) return null;
          const variancePct = this.r2(((poPrice - currentCost) / currentCost) * 100);
          if (Math.abs(variancePct) < VARIANCE_THRESHOLD_PCT) return null;
          return { productName: i.productName, poPrice, currentCost, variancePct };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (variances.length > 0) {
        warning = { type: 'PO_PRICE_VARIANCE', threshold: VARIANCE_THRESHOLD_PCT, items: variances };
      }
    } catch (_err) { /* non-critical — don't fail the request */ }

    return { grnId: purchase.id, grnNumber: purchase.grnNumber, warning };
  }

  private r2(n: number): number { return Math.round(n * 100) / 100; }

  // ─── Build WhatsApp message text for a PO ─────────────────────────────────
  async buildWhatsAppText(businessId: string, id: string): Promise<string> {
    const po = await this.findOne(businessId, id);
    const lines = po.items.map((item: any, idx: number) =>
      `${idx + 1}. ${item.productName} — Qty: ${Number(item.qtyOrdered)}`
    ).join('\n');
    const expected = po.expectedDate
      ? `\nExpected by: ${new Date(po.expectedDate).toLocaleDateString('en-IN')}`
      : '';
    return `*Purchase Order — ${po.poNumber}*\nFrom: Srivani Stores${expected}\n\n${lines}\n\nPlease confirm receipt of this order.`;
  }
}
