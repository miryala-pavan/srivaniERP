import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierQueryDto } from './dto/supplier-query.dto';

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
  constructor(private prisma: PrismaService) {}

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
      where.OR = [
        { name:  { contains: query.search, mode: 'insensitive' } },
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
          creditLimit: true, outstandingBalance: true, isGstRegistered: true,
          isActive: true, createdAt: true,
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(businessId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const stats = await this.prisma.purchase.aggregate({
      where: { supplierId: id, businessId, status: 'APPROVED' },
      _sum:   { grandTotal: true, paidAmount: true },
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
        totalOrders:       stats._count.id,
        totalPurchased:    Number(stats._sum.grandTotal ?? 0),
        totalPaid:         Number(stats._sum.paidAmount ?? 0),
        outstandingBalance: Number(supplier.outstandingBalance),
      },
      recentPurchases,
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

    return this.prisma.supplierPayment.create({
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
  }

  async getPayments(businessId: string, supplierId: string, query: { purchaseId?: string; page?: string; limit?: string }) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '50'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId, supplierId };
    if (query.purchaseId) where.purchaseId = query.purchaseId;

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

    await this.prisma.supplierPayment.delete({ where: { id: paymentId } });
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
}
