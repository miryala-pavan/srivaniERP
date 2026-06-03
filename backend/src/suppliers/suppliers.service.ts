import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';
import { wildcardFilter } from '../common/helpers/search.helper';

function tcField(s: string | undefined | null): string | undefined {
  if (!s) return s ?? undefined;
  return s.trim().split(' ').map((w) => {
    if (!w) return w;
    if (/\d/.test(w)) return w;
    if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z]+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  async computeOutstanding(supplierId: string, businessId: string): Promise<number> {
    const [supplier, purchaseAgg, paymentAgg, creditNoteAgg] = await Promise.all([
      this.prisma.supplier.findFirst({
        where:  { id: supplierId, businessId },
        select: { openingBalance: true, openingBalanceType: true },
      }),
      this.prisma.purchase.aggregate({
        where: { supplierId, businessId, status: 'APPROVED' },
        _sum:  { grandTotal: true },
      }),
      this.prisma.supplierPayment.aggregate({
        where: { supplierId, businessId },
        _sum:  { amount: true },
      }),
      this.prisma.supplierCreditNote.aggregate({
        where:  { supplierId, businessId, status: 'ACTIVE' },
        _sum:   { totalAmount: true },
      }),
    ]);
    const openingBal  = Number(supplier?.openingBalance ?? 0);
    const openingAmt  = (supplier?.openingBalanceType ?? 'DEBIT') === 'DEBIT' ? openingBal : -openingBal;
    const grnTotal    = Number(purchaseAgg._sum.grandTotal   ?? 0);
    const paidTotal   = Number(paymentAgg._sum.amount        ?? 0);
    const creditTotal = Number(creditNoteAgg._sum.totalAmount ?? 0);
    return openingAmt + grnTotal - paidTotal - creditTotal;
  }

  async create(businessId: string, dto: CreateSupplierDto) {
    if (dto.gstin) {
      const existing = await this.prisma.supplier.findFirst({
        where: { businessId, gstin: dto.gstin, isActive: true },
      });
      if (existing) {
        throw new ConflictException(`Supplier with GSTIN ${dto.gstin} already exists`);
      }
    }

    return this.prisma.supplier.create({
      data: {
        businessId,
        name:              tcField(dto.name) ?? dto.name,
        gstin:             dto.gstin,
        phone:             dto.phone,
        email:             dto.email,
        address:           dto.address,
        stateCode:         dto.stateCode,
        paymentTermsDays:  dto.paymentTermsDays ?? 0,
        creditLimit:       dto.creditLimit ?? 0,
        isGstRegistered:   dto.isGstRegistered ?? true,
      },
    });
  }

  async findAll(businessId: string, query: SupplierQueryDto) {
    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId };
    if (query.isActive !== undefined) {
      where.isActive = query.isActive === 'true';
    } else {
      where.isActive = true;
    }
    if (query.search) {
      const wf = wildcardFilter(query.search);
      where.OR = [
        { name:  wf },
        { phone: wf },
        { gstin: wf },
        { email: wf },
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

  async getSupplierBalances(businessId: string, supplierIds: string[]): Promise<Record<string, number>> {
    if (supplierIds.length === 0) return {};
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

    const result: Record<string, number> = {};
    for (const supplierId of supplierIds) {
      const sup        = supplierRows.find((s) => s.id === supplierId);
      const opening    = Number(sup?.openingBalance ?? 0);
      const openingAmt = (sup?.openingBalanceType ?? 'DEBIT') === 'DEBIT' ? opening : -opening;
      const grnTotal   = Number(grns.find((g) => g.supplierId === supplierId)?._sum.grandTotal ?? 0);
      const paidTotal  = Number(payments.find((p) => p.supplierId === supplierId)?._sum.amount ?? 0);
      const creditTotal = Number(credits.find((c) => c.supplierId === supplierId)?._sum.totalAmount ?? 0);
      result[supplierId] = openingAmt + grnTotal - paidTotal - creditTotal;
    }
    return result;
  }

  async findOne(businessId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [stats, thisMonthStats, lastPayment, lastGrn, outstandingBalance] = await Promise.all([
      this.prisma.purchase.aggregate({
        where: { supplierId: id, businessId, status: 'APPROVED' },
        _sum: { grandTotal: true, paidAmount: true }, _count: { id: true },
      }),
      this.prisma.purchase.aggregate({
        where: { supplierId: id, businessId, status: 'APPROVED', invoiceDate: { gte: startOfMonth } },
        _sum: { grandTotal: true },
      }),
      this.prisma.supplierPayment.findFirst({
        where: { supplierId: id, businessId },
        orderBy: { paymentDate: 'desc' },
        select: { paymentDate: true, amount: true, paymentMode: true },
      }),
      this.prisma.purchase.findFirst({
        where: { supplierId: id, businessId, status: 'APPROVED' },
        orderBy: { invoiceDate: 'desc' },
        select: { invoiceDate: true, grnNumber: true },
      }),
      this.computeOutstanding(id, businessId),
    ]);

    return {
      ...supplier,
      stats: {
        totalOrders:        stats._count.id,
        totalPurchased:     Number(stats._sum.grandTotal ?? 0),
        totalPaid:          Number(stats._sum.paidAmount ?? 0),
        thisMonthPurchased: Number(thisMonthStats._sum.grandTotal ?? 0),
        outstandingBalance,
        lastPaymentDate:    lastPayment?.paymentDate ?? null,
        lastPaymentAmount:  lastPayment ? Number(lastPayment.amount) : null,
        lastPaymentMode:    lastPayment?.paymentMode ?? null,
        lastGrnDate:        lastGrn?.invoiceDate ?? null,
        lastGrnNumber:      lastGrn?.grnNumber ?? null,
      },
    };
  }

  async update(businessId: string, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    if (dto.gstin && dto.gstin !== supplier.gstin) {
      const conflict = await this.prisma.supplier.findFirst({
        where: { businessId, gstin: dto.gstin, isActive: true, id: { not: id } },
      });
      if (conflict) throw new ConflictException(`GSTIN ${dto.gstin} already in use`);
    }

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name:             dto.name !== undefined ? tcField(dto.name) ?? dto.name : undefined,
        gstin:            dto.gstin,
        phone:            dto.phone,
        email:            dto.email,
        address:          dto.address,
        stateCode:        dto.stateCode,
        paymentTermsDays: dto.paymentTermsDays,
        creditLimit:      dto.creditLimit,
        isGstRegistered:  dto.isGstRegistered,
        isActive:         dto.isActive,
      },
    });
  }

  async updateOpeningBalance(businessId: string, id: string, dto: {
    openingBalance: number;
    openingBalanceType: string;
    openingBalanceDate?: string;
    openingBalanceNote?: string;
  }) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.update({
      where: { id },
      data: {
        openingBalance:     dto.openingBalance,
        openingBalanceType: dto.openingBalanceType ?? 'DEBIT',
        openingBalanceDate: dto.openingBalanceDate ? new Date(dto.openingBalanceDate) : null,
        openingBalanceNote: dto.openingBalanceNote ?? null,
      },
    });
  }

  async getSupplierBalance(businessId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

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

    const openingBal       = Number(supplier.openingBalance ?? 0);
    const totalPurchase    = Number(purchaseAgg._sum.grandTotal ?? 0);
    const totalPaid        = Number(paymentAgg._sum.amount ?? 0);
    const totalCreditNotes = Number(creditNoteAgg._sum.totalAmount ?? 0);
    const openingDebit     = supplier.openingBalanceType === 'DEBIT'  ? openingBal : 0;
    const openingCredit    = supplier.openingBalanceType === 'CREDIT' ? openingBal : 0;
    const balance          = openingDebit + totalPurchase - totalPaid - totalCreditNotes - openingCredit;

    return {
      supplierId,
      supplierName:       supplier.name,
      openingBalance:     openingBal,
      openingBalanceType: supplier.openingBalanceType,
      totalPurchases:     totalPurchase,
      totalPaid,
      totalCreditNotes,
      balance,
      balanceDue:         balance,
    };
  }

  async getSupplierLedger(businessId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

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

    type Entry = {
      date: Date;
      type: 'OPENING' | 'PURCHASE' | 'PAYMENT' | 'CREDIT_NOTE';
      description: string;
      debit: number;
      credit: number;
      referenceId?: string;
    };

    const entries: Entry[] = [];

    if (Number(supplier.openingBalance) > 0) {
      entries.push({
        date: supplier.openingBalanceDate ?? supplier.createdAt,
        type: 'OPENING',
        description: supplier.openingBalanceNote ?? 'Opening Balance',
        debit:  supplier.openingBalanceType === 'DEBIT'  ? Number(supplier.openingBalance) : 0,
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

  async addPayment(businessId: string, supplierId: string, dto: {
    purchaseId?: string;
    invoiceReference?: string;
    paymentDate?: string;
    amount: number;
    paymentMode: string;
    referenceNumber?: string;
    notes?: string;
    createdByName: string;
    createdById?: string;
  }) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (dto.amount <= 0) throw new BadRequestException('Amount must be greater than 0');

    if (dto.purchaseId) {
      const purchase = await this.prisma.purchase.findFirst({
        where: { id: dto.purchaseId, businessId, supplierId },
      });
      if (!purchase) throw new NotFoundException('GRN not found for this supplier');
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supplierPayment.create({
        data: {
          businessId,
          supplierId,
          purchaseId:       dto.purchaseId ?? null,
          invoiceReference: dto.invoiceReference ?? null,
          paymentDate:      dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount:           dto.amount,
          paymentMode:      dto.paymentMode,
          referenceNumber:  dto.referenceNumber ?? null,
          notes:            dto.notes ?? null,
          createdById:      dto.createdById ?? null,
          createdByName:    dto.createdByName,
        },
      });
      if (dto.purchaseId) {
        await tx.purchase.update({
          where: { id: dto.purchaseId },
          data:  { paidAmount: { increment: dto.amount } },
        });
      }
      return created;
    });

    try {
      this.eventsService.emitToBusiness(businessId, Events.SUPPLIER_PAYMENT_RECORDED, {
        paymentId:   payment.id,
        supplierId,
        amount:      dto.amount,
        paymentDate: payment.paymentDate.toISOString(),
      });
    } catch (_err) { /* fire-and-forget */ }

    return payment;
  }

  async getPayments(businessId: string, supplierId: string, query: { purchaseId?: string; page?: string; limit?: string; dateFrom?: string; dateTo?: string; method?: string }) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '50'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId, supplierId };
    if (query.purchaseId)  where.purchaseId  = query.purchaseId;
    if (query.method)      where.paymentMode = query.method;
    if (query.dateFrom || query.dateTo) {
      where.paymentDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo   ? { lte: new Date(query.dateTo)   } : {}),
      };
    }

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

  async deletePayment(businessId: string, supplierId: string, paymentId: string) {
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id: paymentId, businessId, supplierId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.supplierPayment.delete({ where: { id: paymentId } });
      if (payment.purchaseId) {
        await tx.purchase.update({
          where: { id: payment.purchaseId },
          data:  { paidAmount: { decrement: Number(payment.amount) } },
        });
      }
    });

    try {
      this.eventsService.emitToBusiness(businessId, Events.SUPPLIER_PAYMENT_DELETED, {
        paymentId,
        supplierId,
        amount: Number(payment.amount),
      });
    } catch (_err) { /* fire-and-forget */ }

    return { message: 'Payment deleted' };
  }

  async getGrnPaymentSummary(businessId: string, purchaseId: string) {
    try {
      const purchase = await this.prisma.purchase.findFirst({
        where: { id: purchaseId, businessId },
        select: { id: true, grandTotal: true, supplierId: true, status: true },
      });
      if (!purchase) throw new NotFoundException('GRN not found');

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

      const grandTotal       = Number(purchase.grandTotal);
      const totalPaid        = Number(paymentAgg._sum.amount ?? 0);
      const totalCreditNotes = Number(cnAgg._sum.totalAmount ?? 0);
      const balance          = grandTotal - totalPaid - totalCreditNotes;

      return {
        purchaseId,
        grandTotal,
        totalPaid,
        totalCreditNotes,
        balance,
        isPaid: balance <= 0,
      };
    } catch (err: any) {
      if (err?.status === 404) throw err;
      // Prisma or DB error — return safe fallback so frontend doesn't crash
      return { purchaseId, grandTotal: 0, totalPaid: 0, totalCreditNotes: 0, balance: 0, isPaid: false };
    }
  }

  async getSupplierCreditNotes(
    businessId: string,
    supplierId: string,
    query: { page?: string; limit?: string },
  ) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

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

  async getSupplierGrns(
    businessId: string,
    supplierId: string,
    query: { page?: string; limit?: string; status?: string; dateFrom?: string; dateTo?: string },
  ) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId, supplierId };
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.invoiceDate = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo   ? { lte: new Date(query.dateTo)   } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip, take: limit,
        select: {
          id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true,
          grandTotal: true, paidAmount: true, status: true, createdAt: true,
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getSupplierProducts(businessId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const rows = await this.prisma.$queryRaw<Array<{
      productId: string;
      productName: string;
      timesOrdered: bigint;
      lastOrderDate: Date | null;
      lastUnitCost: string | null;
      totalQty: string | null;
    }>>(Prisma.sql`
      SELECT
        pi."productId",
        pi."productName",
        COUNT(DISTINCT p.id)::bigint AS "timesOrdered",
        MAX(p."invoiceDate")         AS "lastOrderDate",
        MAX(pi."netCostPrice")::text AS "lastUnitCost",
        SUM(pi."totalReceivedQty")::text AS "totalQty"
      FROM purchase_item pi
      JOIN purchase p ON pi."purchaseId" = p.id
      WHERE p."supplierId" = ${supplierId}
        AND p."businessId" = ${businessId}
        AND p.status = 'APPROVED'
      GROUP BY pi."productId", pi."productName"
      ORDER BY COUNT(DISTINCT p.id) DESC, pi."productName" ASC
    `);

    return rows.map((r) => ({
      productId:    r.productId,
      productName:  r.productName,
      timesOrdered: Number(r.timesOrdered),
      lastOrderDate: r.lastOrderDate,
      lastUnitCost:  r.lastUnitCost  ? Number(r.lastUnitCost)  : null,
      totalQty:      r.totalQty      ? Number(r.totalQty)      : null,
    }));
  }

  async getSupplierStatement(
    businessId: string,
    supplierId: string,
    query: { dateFrom?: string; dateTo?: string },
  ) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo   = query.dateTo   ? new Date(query.dateTo)   : undefined;

    const dateRange = (dateFrom || dateTo) ? {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo   ? { lte: dateTo   } : {}),
    } : undefined;

    const [purchases, payments, creditNotes] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { supplierId, businessId, status: 'APPROVED', ...(dateRange ? { invoiceDate: dateRange } : {}) },
        select: { id: true, grnNumber: true, invoiceNumber: true, invoiceDate: true, grandTotal: true },
        orderBy: { invoiceDate: 'asc' },
      }),
      this.prisma.supplierPayment.findMany({
        where: { supplierId, businessId, ...(dateRange ? { paymentDate: dateRange } : {}) },
        orderBy: { paymentDate: 'asc' },
      }),
      this.prisma.supplierCreditNote.findMany({
        where: { supplierId, businessId, status: 'ACTIVE', ...(dateRange ? { cnDate: dateRange } : {}) },
        orderBy: { cnDate: 'asc' },
      }),
    ]);

    type Entry = {
      date: Date; type: 'OPENING' | 'GRN' | 'PAYMENT' | 'CREDIT_NOTE';
      ref: string; refId: string | null; debit: number; credit: number; runningBalance?: number;
    };

    const entries: Entry[] = [];

    // Opening balance — always shown as starting point (no date filter applied to it)
    if (Number(supplier.openingBalance) !== 0) {
      entries.push({
        date:   supplier.openingBalanceDate ?? supplier.createdAt,
        type:   'OPENING',
        ref:    supplier.openingBalanceNote ?? 'Opening Balance',
        refId:  null,
        debit:  supplier.openingBalanceType === 'DEBIT'  ? Number(supplier.openingBalance) : 0,
        credit: supplier.openingBalanceType === 'CREDIT' ? Number(supplier.openingBalance) : 0,
      });
    }

    for (const p of purchases) {
      entries.push({
        date:  p.invoiceDate, type: 'GRN',
        ref:   [p.grnNumber ? `GRN#${p.grnNumber}` : '', `Inv ${p.invoiceNumber}`].filter(Boolean).join(' / '),
        refId: p.id, debit: Number(p.grandTotal), credit: 0,
      });
    }

    for (const pay of payments) {
      entries.push({
        date:  pay.paymentDate, type: 'PAYMENT',
        ref:   `${pay.paymentMode}${pay.referenceNumber ? ' / ' + pay.referenceNumber : ''}`,
        refId: pay.id, debit: 0, credit: Number(pay.amount),
      });
    }

    for (const cn of creditNotes) {
      entries.push({
        date:  cn.cnDate, type: 'CREDIT_NOTE',
        ref:   `${cn.scnNumber} - ${cn.reason}`,
        refId: cn.id, debit: 0, credit: Number(cn.totalAmount),
      });
    }

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let runningBalance = 0;
    return entries.map((e) => {
      runningBalance = runningBalance + e.debit - e.credit;
      return { ...e, runningBalance };
    });
  }

  async recomputePurchasePaidAmounts(businessId: string): Promise<{ updated: number }> {
    const purchases = await this.prisma.purchase.findMany({
      where:  { businessId },
      select: { id: true },
    });

    let updated = 0;
    for (const purchase of purchases) {
      const agg = await this.prisma.supplierPayment.aggregate({
        where: { purchaseId: purchase.id, businessId },
        _sum:  { amount: true },
      });
      const correctPaidAmount = Number(agg._sum.amount ?? 0);
      await this.prisma.purchase.update({
        where: { id: purchase.id },
        data:  { paidAmount: correctPaidAmount },
      });
      updated++;
    }

    return { updated };
  }
}
