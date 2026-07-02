import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PO_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON'];

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

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
        costPrice: true,
        plusList: { select: { pluCode: true }, take: 1 },
      },
    });
    if (!product?.preferredSupplierId) return;
    if (!product.reorderQuantity || Number(product.reorderQuantity) <= 0) return;

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

    const pluCode = product.plusList[0]?.pluCode;

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
            unitCost: product.costPrice ? Number(product.costPrice) : null,
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
                unitCost: product.costPrice ? Number(product.costPrice) : null,
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
