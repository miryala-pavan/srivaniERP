import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
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
    if (query.isActive === 'all') {
      // no isActive filter — include inactive suppliers too
    } else if (query.isActive !== undefined) {
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
          isActive: true, createdAt: true, supplierType: true,
          bankAccountNumber: true, bankIfscCode: true, bankBankName: true,
          bankAccounts: {
            where:   { isPrimary: true },
            select:  { accountNumber: true, bankName: true, branchName: true, ifscCode: true },
            take:    1,
            orderBy: { createdAt: 'asc' },
          },
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

    const updated = await this.prisma.supplier.update({
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

    // When a GSTIN is added to a supplier, backfill it to all their existing GRNs
    // that were saved without one — so GST reports don't treat those purchases as unregistered.
    if (dto.gstin && !supplier.gstin) {
      await this.prisma.purchase.updateMany({
        where: { businessId, supplierId: id, supplierGstin: null },
        data:  { supplierGstin: dto.gstin },
      });
    }

    return updated;
  }

  async setActive(businessId: string, id: string, isActive: boolean) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.prisma.supplier.update({
      where: { id },
      data:  { isActive: !!isActive },
      select: { id: true, name: true, isActive: true },
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

  /** Edit payment metadata (reference/UTR/remark/etc) — amount & allocations stay locked. */
  async updatePaymentDetails(businessId: string, paymentId: string, dto: {
    paymentDate?: string; paymentMode?: string; referenceNumber?: string | null;
    utrNumber?: string | null; epayOrderNumber?: string | null;
    adjustmentReason?: string | null; notes?: string | null; screenshotUrl?: string | null;
  }) {
    const payment = await this.prisma.supplierPayment.findFirst({ where: { id: paymentId, businessId } });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.supplierPayment.update({
      where: { id: paymentId },
      data: {
        ...(dto.paymentDate      !== undefined ? { paymentDate: new Date(dto.paymentDate) } : {}),
        ...(dto.paymentMode      !== undefined ? { paymentMode: dto.paymentMode }           : {}),
        ...(dto.referenceNumber  !== undefined ? { referenceNumber: dto.referenceNumber }   : {}),
        ...(dto.utrNumber        !== undefined ? { utrNumber: dto.utrNumber }               : {}),
        ...(dto.epayOrderNumber  !== undefined ? { epayOrderNumber: dto.epayOrderNumber }   : {}),
        ...(dto.adjustmentReason !== undefined ? { adjustmentReason: dto.adjustmentReason } : {}),
        ...(dto.notes            !== undefined ? { notes: dto.notes }                       : {}),
        ...(dto.screenshotUrl    !== undefined ? { screenshotUrl: dto.screenshotUrl }       : {}),
      },
    });
    return updated;
  }

  private get proofsDir(): string {
    return process.env.PAYMENT_PROOFS_DIR
      ?? path.join(process.cwd(), '..', 'storage', 'payment-proofs');
  }

  /** Upload a payment-proof screenshot (paste/drag/browse) and link it to the payment. */
  async uploadPaymentProof(businessId: string, paymentId: string, file: Express.Multer.File): Promise<{ screenshotUrl: string }> {
    const payment = await this.prisma.supplierPayment.findFirst({ where: { id: paymentId, businessId } });
    if (!payment) throw new NotFoundException('Payment not found');

    const ext = (path.extname(file.originalname || '').toLowerCase()) || '.png';
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      throw new BadRequestException('Only jpg, png, and webp images are allowed');
    }

    fs.mkdirSync(this.proofsDir, { recursive: true });
    // Remove any prior proof for this payment
    for (const e of ['.jpg', '.jpeg', '.png', '.webp']) {
      const old = path.join(this.proofsDir, `${paymentId}${e}`);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const filename = `${paymentId}${ext}`;
    fs.writeFileSync(path.join(this.proofsDir, filename), file.buffer);

    // Cache-bust with the timestamp so the drawer shows the new image immediately
    const screenshotUrl = `/uploads/payment-proofs/${filename}?v=${Date.now()}`;
    await this.prisma.supplierPayment.update({ where: { id: paymentId }, data: { screenshotUrl } });
    return { screenshotUrl };
  }

  /** Remove a payment-proof screenshot (deletes the file and clears the link). */
  async deletePaymentProof(businessId: string, paymentId: string): Promise<{ message: string }> {
    const payment = await this.prisma.supplierPayment.findFirst({ where: { id: paymentId, businessId } });
    if (!payment) throw new NotFoundException('Payment not found');
    for (const e of ['.jpg', '.jpeg', '.png', '.webp']) {
      const f = path.join(this.proofsDir, `${paymentId}${e}`);
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
    await this.prisma.supplierPayment.update({ where: { id: paymentId }, data: { screenshotUrl: null } });
    return { message: 'Proof removed' };
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

      const [paymentAgg, cnAgg, linkedPayments] = await Promise.all([
        this.prisma.supplierPayment.aggregate({
          where: { purchaseId, businessId },
          _sum: { amount: true },
        }),
        this.prisma.supplierCreditNote.aggregate({
          where: { originalGrnId: purchaseId, businessId, status: 'ACTIVE' },
          _sum: { totalAmount: true },
        }),
        // Payments touching this bill (direct or via allocation) + how many bills each covers
        this.prisma.supplierPayment.findMany({
          where: {
            businessId, status: { not: 'CANCELLED' },
            OR: [{ purchaseId }, { allocations: { some: { purchaseId } } }],
          },
          select: { _count: { select: { allocations: true } } },
        }),
      ]);

      const grandTotal       = Number(purchase.grandTotal);
      const totalPaid        = Number(paymentAgg._sum.amount ?? 0);
      const totalCreditNotes = Number(cnAgg._sum.totalAmount ?? 0);
      const balance          = grandTotal - totalPaid - totalCreditNotes;
      // Bulk = this bill was settled by a payment that allocated across >1 bills
      const maxBills    = linkedPayments.reduce((m, p) => Math.max(m, p._count.allocations), 0);
      const coversMultiple = maxBills > 1;

      return {
        purchaseId,
        grandTotal,
        totalPaid,
        totalCreditNotes,
        balance,
        isPaid: balance <= 0,
        coversMultiple,
        billCount: coversMultiple ? maxBills : 1,
      };
    } catch (err: any) {
      if (err?.status === 404) throw err;
      // Prisma or DB error — return safe fallback so frontend doesn't crash
      return { purchaseId, grandTotal: 0, totalPaid: 0, totalCreditNotes: 0, balance: 0, isPaid: false, coversMultiple: false, billCount: 1 };
    }
  }

  /** Detailed payment records that settled a GRN (direct + allocated), for the payment-details popup. */
  async getGrnPayments(businessId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: purchaseId, businessId },
      select: { id: true, grnNumber: true, invoiceNumber: true, grandTotal: true, supplierId: true },
    });
    if (!purchase) throw new NotFoundException('GRN not found');

    const payments = await this.prisma.supplierPayment.findMany({
      where: {
        businessId,
        status: { not: 'CANCELLED' },
        OR: [
          { purchaseId },
          { allocations: { some: { purchaseId } } },
        ],
      },
      orderBy: { paymentDate: 'desc' },
      select: {
        id: true, paymentDate: true, amount: true, paymentMode: true,
        referenceNumber: true, utrNumber: true, epayOrderNumber: true,
        adjustmentAmount: true, adjustmentReason: true,
        matchedFromStatement: true, notes: true, screenshotUrl: true,
        proofToken: true, createdByName: true, purchaseId: true,
        allocations: { select: { purchaseId: true, allocatedAmount: true } },
      },
    });

    // Resolve GRN#/invoice for every bill referenced by these payments (for the bulk view)
    const billIds = new Set<string>();
    for (const p of payments) {
      if (p.purchaseId) billIds.add(p.purchaseId);
      for (const a of p.allocations) billIds.add(a.purchaseId);
    }
    const billRows = await this.prisma.purchase.findMany({
      where: { id: { in: [...billIds] }, businessId },
      select: { id: true, grnNumber: true, invoiceNumber: true, grandTotal: true },
    });
    const billMap = new Map(billRows.map((b) => [b.id, b]));

    return {
      purchaseId,
      grnNumber:     purchase.grnNumber,
      invoiceNumber: purchase.invoiceNumber,
      grandTotal:    Number(purchase.grandTotal),
      payments: payments.map((p) => {
        // Build the list of bills this payment settled (allocations, or the single linked GRN)
        const allocs = p.allocations.length > 0
          ? p.allocations
          : (p.purchaseId ? [{ purchaseId: p.purchaseId, allocatedAmount: p.amount }] : []);
        const bills = allocs.map((a) => {
          const b = billMap.get(a.purchaseId);
          return {
            purchaseId:   a.purchaseId,
            grnNumber:    b?.grnNumber ?? null,
            invoiceNumber: b?.invoiceNumber ?? null,
            allocatedAmount: Number(a.allocatedAmount),
            isThisBill:   a.purchaseId === purchaseId,
          };
        });
        return {
          ...p,
          amount:           Number(p.amount),
          adjustmentAmount: Number(p.adjustmentAmount ?? 0),
          allocatedToThis:  Number(bills.find((b) => b.isThisBill)?.allocatedAmount ?? p.amount),
          coversMultiple:   bills.length > 1,
          billCount:        bills.length,
          bills,
        };
      }),
    };
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

  // ─── SUPPLIER BANK ACCOUNTS ───────────────────────────

  async getBankAccounts(businessId: string, supplierId: string) {
    return this.prisma.supplierBankAccount.findMany({
      where: { supplierId, businessId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async addBankAccount(businessId: string, supplierId: string, dto: {
    accountNumber: string; bankName: string; branchName?: string;
    ifscCode?: string; isPrimary?: boolean; transferLimit?: number; notes?: string;
  }) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // If isPrimary, demote existing primary
    if (dto.isPrimary) {
      await this.prisma.supplierBankAccount.updateMany({
        where: { supplierId, businessId, isPrimary: true },
        data:  { isPrimary: false },
      });
    }
    return this.prisma.supplierBankAccount.create({
      data: { businessId, supplierId, ...dto, isPrimary: dto.isPrimary ?? false },
    });
  }

  async updateBankAccount(businessId: string, accountId: string, dto: {
    accountNumber?: string; bankName?: string; branchName?: string;
    ifscCode?: string; isPrimary?: boolean; transferLimit?: number; notes?: string;
  }) {
    const account = await this.prisma.supplierBankAccount.findFirst({
      where: { id: accountId, businessId },
    });
    if (!account) throw new NotFoundException('Bank account not found');
    if (dto.isPrimary) {
      await this.prisma.supplierBankAccount.updateMany({
        where: { supplierId: account.supplierId, businessId, isPrimary: true },
        data:  { isPrimary: false },
      });
    }
    return this.prisma.supplierBankAccount.update({ where: { id: accountId }, data: dto });
  }

  async deleteBankAccount(businessId: string, accountId: string) {
    const account = await this.prisma.supplierBankAccount.findFirst({
      where: { id: accountId, businessId },
    });
    if (!account) throw new NotFoundException('Bank account not found');
    await this.prisma.supplierBankAccount.delete({ where: { id: accountId } });
    return { message: 'Bank account removed' };
  }

  // ─── ONE-TIME MIGRATION: flat fields → SupplierBankAccount ───
  async migrateFlatBankFields(businessId: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: { businessId, bankAccountNumber: { not: null } },
      select: { id: true, bankAccountNumber: true, bankIfscCode: true, bankBankName: true, bankBranchName: true },
    });
    let created = 0;
    for (const s of suppliers) {
      if (!s.bankAccountNumber) continue;
      const existing = await this.prisma.supplierBankAccount.findFirst({
        where: { supplierId: s.id, accountNumber: s.bankAccountNumber },
      });
      if (existing) continue;
      const hasAny = await this.prisma.supplierBankAccount.count({ where: { supplierId: s.id } });
      await this.prisma.supplierBankAccount.create({
        data: {
          businessId,
          supplierId:    s.id,
          accountNumber: s.bankAccountNumber,
          bankName:      s.bankBankName ?? 'Unknown',
          branchName:    s.bankBranchName ?? undefined,
          ifscCode:      s.bankIfscCode ?? undefined,
          isPrimary:     hasAny === 0,
        },
      });
      created++;
    }
    return { migrated: created, total: suppliers.length };
  }

  // ─── BULK IMPORT BANK ACCOUNTS ────────────────────────

  async previewBankAccountImport(businessId: string, entries: {
    beneficiaryName: string; accountNumber: string; bankName: string;
    branchName?: string; transferLimit?: number; supplierType?: string;
  }[]) {
    // Load all suppliers for fuzzy matching
    const suppliers = await this.prisma.supplier.findMany({
      where:  { businessId },
      select: { id: true, name: true, supplierType: true },
    });

    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/\b(agencies|agency|enterprises|traders|trading|corporation|corp|pvt|ltd|limited|co|and|&|the|new|sri|sri|shree|shri|m\/s)\b/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();

    const results = entries.map(entry => {
      const normEntry = normalize(entry.beneficiaryName);
      let bestMatch: { id: string; name: string; supplierType: string } | null = null;
      let bestScore = 0;

      for (const s of suppliers) {
        const normSupplier = normalize(s.name);
        // Simple overlap score
        const longer  = Math.max(normEntry.length, normSupplier.length);
        if (longer === 0) continue;
        let common = 0;
        for (let i = 0; i < Math.min(normEntry.length, normSupplier.length); i++) {
          if (normEntry[i] === normSupplier[i]) common++;
        }
        // Also check if one contains the other
        const contains = normEntry.includes(normSupplier) || normSupplier.includes(normEntry);
        const score = contains ? 0.9 : common / longer;
        if (score > bestScore) { bestScore = score; bestMatch = s; }
      }

      const existingAccounts = [] as any[];
      return {
        beneficiaryName: entry.beneficiaryName,
        accountNumber:   entry.accountNumber,
        bankName:        entry.bankName,
        branchName:      entry.branchName,
        transferLimit:   entry.transferLimit,
        supplierType:    entry.supplierType ?? 'SUPPLIER',
        matchedSupplier: bestScore >= 0.5 ? bestMatch : null,
        matchScore:      Math.round(bestScore * 100),
        status:          bestScore >= 0.75 ? 'HIGH' : bestScore >= 0.5 ? 'REVIEW' : 'NO_MATCH',
      };
    });

    return results;
  }

  async executeBankAccountImport(businessId: string, entries: {
    beneficiaryName: string; accountNumber: string; bankName: string;
    branchName?: string; transferLimit?: number; isPrimary?: boolean;
    supplierId?: string;          // if matched — link to existing supplier
    createSupplier?: boolean;     // if no match — create new supplier
    supplierType?: string;
  }[]) {
    let imported = 0; let created = 0; let skipped = 0;

    for (const entry of entries) {
      try {
        let supplierId = entry.supplierId;

        // Create new supplier if requested
        if (!supplierId && entry.createSupplier) {
          const newSupplier = await this.prisma.supplier.create({
            data: {
              businessId,
              name:         entry.beneficiaryName,
              supplierType: entry.supplierType ?? 'SUPPLIER',
            },
          });
          supplierId = newSupplier.id;
          created++;
        }

        if (!supplierId) { skipped++; continue; }

        // Check for duplicate account number
        const existing = await this.prisma.supplierBankAccount.findFirst({
          where: { supplierId, businessId, accountNumber: entry.accountNumber },
        });
        if (existing) { skipped++; continue; }

        // If isPrimary, demote current primary
        if (entry.isPrimary) {
          await this.prisma.supplierBankAccount.updateMany({
            where: { supplierId, businessId, isPrimary: true },
            data:  { isPrimary: false },
          });
        }

        await this.prisma.supplierBankAccount.create({
          data: {
            businessId, supplierId,
            accountNumber: entry.accountNumber,
            bankName:      entry.bankName,
            branchName:    entry.branchName,
            transferLimit: entry.transferLimit,
            isPrimary:     entry.isPrimary ?? false,
          },
        });

        // Update supplier type if it's not already SUPPLIER
        if (entry.supplierType && entry.supplierType !== 'SUPPLIER') {
          await this.prisma.supplier.update({
            where: { id: supplierId },
            data:  { supplierType: entry.supplierType },
          });
        }

        imported++;
      } catch { skipped++; }
    }

    return { imported, created, skipped };
  }
}
