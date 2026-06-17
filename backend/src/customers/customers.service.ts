import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { PosQuickAddCustomerDto } from './dto/pos-quick-add-customer.dto';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from './dto/create-customer-address.dto';
import { wildcardFilter } from '../common/helpers/search.helper';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  // ─── STEP 5: CODE GENERATION ─────────────────────────────────────────────────

  private async generateCustomerCode(tx: any, businessId: string): Promise<string> {
    const last = await tx.customer.findFirst({
      where:   { businessId, customerCode: { not: null } },
      orderBy: { customerCode: 'desc' },
      select:  { customerCode: true },
    });
    const next = last?.customerCode ? parseInt(last.customerCode, 10) + 1 : 1;
    return String(next).padStart(6, '0');
  }

  async backfillCustomerCodes(businessId: string): Promise<{ updated: number }> {
    const unassigned = await this.prisma.customer.findMany({
      where:   { businessId, customerCode: null },
      orderBy: { createdAt: 'asc' },
      select:  { id: true },
    });

    let updated = 0;
    for (const c of unassigned) {
      await this.prisma.$transaction(async (tx) => {
        const code = await this.generateCustomerCode(tx, businessId);
        await tx.customer.update({ where: { id: c.id }, data: { customerCode: code } });
      });
      updated++;
    }
    return { updated };
  }

  // ─── STEP 6: WALK-IN SEED ────────────────────────────────────────────────────

  async seedWalkInCustomer(businessId: string): Promise<{ created: boolean; customer: any }> {
    const existing = await this.prisma.customer.findFirst({
      where: { businessId, isSystemDefault: true },
    });
    if (existing) return { created: false, customer: existing };

    const customer = await this.prisma.$transaction(async (tx) => {
      const customerCode = await this.generateCustomerCode(tx, businessId);
      return tx.customer.create({
        data: {
          businessId,
          customerCode,
          name:           'Walk-in Customer',
          customerType:   'WALKIN',
          isSystemDefault: true,
          channel:        'POS' as any,
          status:         'ACTIVE' as any,
        },
      });
    });

    return { created: true, customer };
  }

  // ─── STEP 7: OUTSTANDING HELPER ──────────────────────────────────────────────

  async computeCustomerOutstanding(businessId: string, customerId: string): Promise<number> {
    const [customer, billAgg, payAgg] = await Promise.all([
      this.prisma.customer.findFirst({
        where:  { id: customerId, businessId },
        select: { openingBalance: true },
      }),
      this.prisma.salesBill.aggregate({
        where: { customerId, businessId, saleType: 'CREDIT' as any, status: 'FINAL' as any },
        _sum:  { balanceAmount: true },
      }),
      this.prisma.customerPayment.aggregate({
        where: { customerId, businessId },
        _sum:  { amount: true },
      }),
    ]);
    const opening       = Number(customer?.openingBalance ?? 0);
    const totalBalance  = Number(billAgg._sum.balanceAmount ?? 0);
    const totalPayments = Number(payAgg._sum.amount ?? 0);
    return opening + totalBalance - totalPayments;
  }

  // ─── ENDPOINT A: LIST ─────────────────────────────────────────────────────────

  async findAll(businessId: string, query: CustomerQueryDto) {
    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId };
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.channel)       where.channel       = query.channel;
    if (query.customerGroup) where.customerGroup = query.customerGroup;
    if (query.search) {
      const wf = wildcardFilter(query.search);
      where.OR = [
        { name:         wf },
        { phone:        wf },
        { customerCode: wf },
        { email:        wf },
        { gstin:        wf },
      ];
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true, customerCode: true, name: true, phone: true, email: true,
          gstin: true, customerType: true, channel: true, status: true,
          customerGroup: true, creditLimit: true, loyaltyPoints: true,
          openingBalance: true, isActive: true, isSystemDefault: true, createdAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    // Compute outstanding per customer for this page in 2 queries (groupBy)
    const ids = customers.map((c) => c.id);
    const [billGroups, payGroups] = await Promise.all([
      ids.length ? this.prisma.salesBill.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, businessId, saleType: 'CREDIT' as any, status: 'FINAL' as any },
        _sum: { balanceAmount: true },
      }) : [],
      ids.length ? this.prisma.customerPayment.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, businessId },
        _sum: { amount: true },
      }) : [],
    ]);
    const billMap = new Map((billGroups as any[]).map((g) => [g.customerId, Number(g._sum.balanceAmount ?? 0)]));
    const payMap  = new Map((payGroups  as any[]).map((g) => [g.customerId, Number(g._sum.amount       ?? 0)]));

    const data = customers.map((c) => ({
      ...c,
      outstandingBalance: Number(c.openingBalance) + (billMap.get(c.id) ?? 0) - (payMap.get(c.id) ?? 0),
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── ENDPOINT B: GET ONE ──────────────────────────────────────────────────────

  async findOne(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where:   { id, businessId },
      include: { addresses: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [outstanding, billsStats, thisMonthAgg, lastBill, lastPayment] = await Promise.all([
      this.computeCustomerOutstanding(businessId, id),
      this.prisma.salesBill.aggregate({
        where: { customerId: id, businessId, status: 'FINAL' as any },
        _sum:   { grandTotal: true, paidAmount: true },
        _count: { id: true },
      }),
      this.prisma.salesBill.aggregate({
        where: { customerId: id, businessId, status: 'FINAL' as any, billDate: { gte: monthStart } },
        _sum:  { grandTotal: true },
      }),
      this.prisma.salesBill.findFirst({
        where:   { customerId: id, businessId, status: 'FINAL' as any },
        orderBy: { billDate: 'desc' },
        select:  { billDate: true, billNumber: true },
      }),
      this.prisma.customerPayment.findFirst({
        where:   { customerId: id, businessId },
        orderBy: { paymentDate: 'desc' },
        select:  { paymentDate: true, amount: true, paymentMode: true },
      }),
    ]);

    return {
      ...customer,
      stats: {
        totalBills:         billsStats._count.id,
        totalPurchased:     Number(billsStats._sum.grandTotal  ?? 0),
        totalPaid:          Number(billsStats._sum.paidAmount  ?? 0),
        outstandingBalance: outstanding,
        thisMonthPurchased: Number(thisMonthAgg._sum.grandTotal ?? 0),
        lastPurchaseDate:   lastBill?.billDate     ?? null,
        lastBillNumber:     lastBill?.billNumber   ?? null,
        lastPaymentDate:    lastPayment?.paymentDate  ?? null,
        lastPaymentAmount:  lastPayment ? Number(lastPayment.amount) : null,
        lastPaymentMode:    lastPayment?.paymentMode  ?? null,
      },
    };
  }

  // ─── ENDPOINT C: CREATE ───────────────────────────────────────────────────────

  async create(businessId: string, dto: CreateCustomerDto) {
    if (dto.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: { businessId, phone: dto.phone, isActive: true },
      });
      if (existing) throw new ConflictException(`Customer with phone ${dto.phone} already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const customerCode = await this.generateCustomerCode(tx, businessId);
      const customer = await tx.customer.create({
        data: {
          businessId,
          customerCode,
          name:           dto.name,
          phone:          dto.phone,
          email:          dto.email,
          gstin:          dto.gstin,
          address:        dto.address,
          stateCode:      dto.stateCode,
          customerType:   dto.customerType ?? 'REGULAR',
          companyName:    dto.companyName,
          billingAddress: dto.billingAddress,
          channel:        (dto.channel ?? 'POS') as any,
          customerGroup:  dto.customerGroup,
          creditLimit:    dto.creditLimit,
          openingBalance: dto.openingBalance,
          whatsappOptIn:  dto.whatsappOptIn ?? false,
          smsOptIn:       dto.smsOptIn      ?? false,
          emailOptIn:     dto.emailOptIn    ?? false,
          dateOfBirth:    dto.dateOfBirth    ? new Date(dto.dateOfBirth)    : undefined,
          anniversary:    dto.anniversary    ? new Date(dto.anniversary)    : undefined,
          consentGivenAt: dto.consentGivenAt ? new Date(dto.consentGivenAt) : undefined,
        },
      });

      this.eventsService.emitToBusiness(businessId, Events.CUSTOMER_CREATED, {
        customerId:   customer.id,
        customerCode: customer.customerCode,
        name:         customer.name,
      });

      return customer;
    });
  }

  // ─── ENDPOINT D: POS QUICK-ADD ────────────────────────────────────────────────

  async posQuickAdd(businessId: string, dto: PosQuickAddCustomerDto) {
    // 1. Already a POS customer → return as-is
    const existing = await this.prisma.customer.findFirst({
      where: { businessId, phone: dto.phone, isActive: true },
    });
    if (existing) return existing;

    // 2. Check StorefrontProfile — online customer coming to the store
    const profile = await this.prisma.storefrontProfile.findFirst({
      where: { phone: dto.phone },
    });

    return this.prisma.$transaction(async (tx) => {
      const customerCode = await this.generateCustomerCode(tx, businessId);
      return tx.customer.create({
        data: {
          businessId,
          customerCode,
          name:         dto.name ?? profile?.name ?? dto.phone,
          phone:        dto.phone,
          email:        profile?.email ?? undefined,
          customerType: 'REGULAR',
          channel:      (profile ? 'BOTH' : 'POS') as any,
          status:       'ACTIVE' as any,
        },
      });
    });
  }

  // ─── ENDPOINT D2: PROFILE LOOKUP (for POS quick-add hint) ────────────────────

  async profileLookup(businessId: string, phone: string) {
    const [customer, profile] = await Promise.all([
      this.prisma.customer.findFirst({
        where:  { businessId, phone, isActive: true },
        select: { id: true, name: true, phone: true, email: true,
                  customerCode: true, channel: true, loyaltyPoints: true },
      }),
      this.prisma.storefrontProfile.findFirst({
        where:  { phone },
        select: { name: true, email: true, phone: true, alternatePhone: true },
      }),
    ]);

    return {
      customer,  // null = not yet a POS customer
      profile,   // null = never ordered online
      source: customer ? 'customer' : profile ? 'online-profile' : 'none',
    };
  }

  // ─── ENDPOINT E: UPDATE ───────────────────────────────────────────────────────

  async update(businessId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.phone && dto.phone !== customer.phone) {
      const conflict = await this.prisma.customer.findFirst({
        where: { businessId, phone: dto.phone, isActive: true, id: { not: id } },
      });
      if (conflict) throw new ConflictException(`Phone ${dto.phone} already in use`);
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        name:           dto.name,
        phone:          dto.phone,
        email:          dto.email,
        gstin:          dto.gstin,
        address:        dto.address,
        stateCode:      dto.stateCode,
        customerType:   dto.customerType,
        companyName:    dto.companyName,
        billingAddress: dto.billingAddress,
        channel:        dto.channel as any,
        status:         dto.status  as any,
        customerGroup:  dto.customerGroup,
        creditLimit:    dto.creditLimit,
        whatsappOptIn:  dto.whatsappOptIn,
        smsOptIn:       dto.smsOptIn,
        emailOptIn:     dto.emailOptIn,
        dateOfBirth:    dto.dateOfBirth    ? new Date(dto.dateOfBirth)    : undefined,
        anniversary:    dto.anniversary    ? new Date(dto.anniversary)    : undefined,
        consentGivenAt: dto.consentGivenAt ? new Date(dto.consentGivenAt) : undefined,
        isActive:       dto.isActive,
      },
    });

    this.eventsService.emitToBusiness(businessId, Events.CUSTOMER_UPDATED, {
      customerId:   id,
      customerCode: updated.customerCode,
    });

    return updated;
  }

  // ─── ENDPOINT F: BILLS ────────────────────────────────────────────────────────

  async getBills(
    businessId: string,
    customerId: string,
    query: { page?: string; limit?: string },
  ) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where = { customerId, businessId, status: 'FINAL' as any };

    const [bills, total] = await this.prisma.$transaction([
      this.prisma.salesBill.findMany({
        where,
        orderBy: { billDate: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, billNumber: true, billDate: true, saleType: true,
          grandTotal: true, paidAmount: true, balanceAmount: true,
          paymentMode: true, status: true, isVoided: true,
        },
      }),
      this.prisma.salesBill.count({ where }),
    ]);

    return { data: bills, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── ENDPOINT G: PAYMENTS LIST ────────────────────────────────────────────────

  async getPayments(
    businessId: string,
    customerId: string,
    query: { page?: string; limit?: string },
  ) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where = { customerId, businessId };

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.customerPayment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit,
        include: {
          bill: { select: { id: true, billNumber: true, grandTotal: true } },
        },
      }),
      this.prisma.customerPayment.count({ where }),
    ]);

    return { data: payments, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── ENDPOINT H: STATEMENT ────────────────────────────────────────────────────

  async getStatement(
    businessId: string,
    customerId: string,
    query: { dateFrom?: string; dateTo?: string },
  ) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo   = query.dateTo   ? new Date(query.dateTo)   : undefined;

    const billWhere: any  = { customerId, businessId, saleType: 'CREDIT' as any, status: 'FINAL' as any };
    const payWhere:  any  = { customerId, businessId };
    if (dateFrom) { billWhere.billDate    = { gte: dateFrom }; payWhere.paymentDate = { gte: dateFrom }; }
    if (dateTo)   {
      billWhere.billDate   = { ...(billWhere.billDate    ?? {}), lte: dateTo };
      payWhere.paymentDate = { ...(payWhere.paymentDate  ?? {}), lte: dateTo };
    }

    const [bills, payments] = await Promise.all([
      this.prisma.salesBill.findMany({
        where:   billWhere,
        orderBy: { billDate: 'asc' },
        select:  { id: true, billNumber: true, billDate: true, grandTotal: true, paidAmount: true, balanceAmount: true },
      }),
      this.prisma.customerPayment.findMany({
        where:   payWhere,
        orderBy: { paymentDate: 'asc' },
      }),
    ]);

    type Entry = {
      date: Date; type: 'OPENING' | 'BILL' | 'PAYMENT';
      description: string; debit: number; credit: number;
      balance: number; refId: string | null;
    };

    const openingAmt = Number(customer.openingBalance);

    const entries: Entry[] = [
      ...bills.map((b) => ({
        date:        b.billDate,
        type:        'BILL' as const,
        description: `Bill ${b.billNumber ?? b.id}`,
        debit:       Number(b.grandTotal),
        credit:      Number(b.paidAmount),
        balance:     0,
        refId:       b.id,
      })),
      ...payments.map((p) => ({
        date:        p.paymentDate,
        type:        'PAYMENT' as const,
        description: `Payment - ${p.paymentMode}${p.reference ? ' / ' + p.reference : ''}`,
        debit:       0,
        credit:      Number(p.amount),
        balance:     0,
        refId:       p.id,
      })),
    ];

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (openingAmt !== 0) {
      entries.unshift({
        date:        customer.createdAt,
        type:        'OPENING' as const,
        description: 'Opening Balance',
        debit:       openingAmt > 0 ? openingAmt : 0,
        credit:      openingAmt < 0 ? Math.abs(openingAmt) : 0,
        balance:     0,
        refId:       null,
      });
    }

    // running starts at 0; opening row (debit - credit = openingAmt) brings it to openingAmt
    let running = 0;
    for (const e of entries) {
      running += e.debit - e.credit;
      e.balance = running;
    }

    const outstandingBalance = await this.computeCustomerOutstanding(businessId, customerId);

    return {
      customer: {
        id:             customer.id,
        name:           customer.name,
        customerCode:   customer.customerCode,
        openingBalance: Number(customer.openingBalance),
      },
      entries,
      outstandingBalance,
    };
  }

  // ─── ENDPOINT I: RECORD PAYMENT ───────────────────────────────────────────────

  async recordPayment(
    businessId: string,
    customerId: string,
    dto: CreateCustomerPaymentDto,
    createdById: string,
    createdByName?: string,
  ) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.billId) {
      const bill = await this.prisma.salesBill.findFirst({
        where: { id: dto.billId, businessId, customerId },
      });
      if (!bill) throw new BadRequestException('Bill not found or does not belong to this customer');
    }

    const payment = await this.prisma.customerPayment.create({
      data: {
        businessId,
        customerId,
        amount:       dto.amount,
        paymentMode:  dto.paymentMode,
        reference:    dto.reference,
        notes:        dto.notes,
        billId:       dto.billId,
        paymentDate:  dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        createdBy:    createdById,
        createdByName,
      },
    });

    this.eventsService.emitToBusiness(businessId, Events.CUSTOMER_PAYMENT_RECORDED, {
      paymentId:   payment.id,
      customerId,
      amount:      Number(dto.amount),
      paymentDate: payment.paymentDate.toISOString(),
    });

    return payment;
  }

  // ─── ENDPOINT J: DELETE PAYMENT ───────────────────────────────────────────────

  async deletePayment(businessId: string, customerId: string, paymentId: string) {
    const payment = await this.prisma.customerPayment.findFirst({
      where: { id: paymentId, customerId, businessId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.prisma.customerPayment.delete({ where: { id: paymentId } });

    this.eventsService.emitToBusiness(businessId, Events.CUSTOMER_PAYMENT_DELETED, {
      paymentId,
      customerId,
      amount: Number(payment.amount),
    });

    return { deleted: true };
  }

  // ─── ADDRESS CRUD ─────────────────────────────────────────────────────────────

  async getAddresses(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.customerAddress.findMany({
      where:   { customerId, businessId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createAddress(businessId: string, customerId: string, dto: CreateCustomerAddressDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, businessId },
          data:  { isDefault: false },
        });
      }
      return tx.customerAddress.create({
        data: {
          businessId, customerId,
          label:     dto.label,
          line1:     dto.line1,
          line2:     dto.line2,
          city:      dto.city,
          state:     dto.state,
          pincode:   dto.pincode,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async updateAddress(businessId: string, customerId: string, addrId: string, dto: UpdateCustomerAddressDto) {
    const addr = await this.prisma.customerAddress.findFirst({
      where: { id: addrId, customerId, businessId },
    });
    if (!addr) throw new NotFoundException('Address not found');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, businessId, id: { not: addrId } },
          data:  { isDefault: false },
        });
      }
      return tx.customerAddress.update({
        where: { id: addrId },
        data: {
          ...(dto.label     !== undefined && { label:     dto.label }),
          ...(dto.line1     !== undefined && { line1:     dto.line1 }),
          ...(dto.line2     !== undefined && { line2:     dto.line2 }),
          ...(dto.city      !== undefined && { city:      dto.city }),
          ...(dto.state     !== undefined && { state:     dto.state }),
          ...(dto.pincode   !== undefined && { pincode:   dto.pincode }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });
    });
  }

  async deleteAddress(businessId: string, customerId: string, addrId: string) {
    const addr = await this.prisma.customerAddress.findFirst({
      where: { id: addrId, customerId, businessId },
    });
    if (!addr) throw new NotFoundException('Address not found');
    await this.prisma.customerAddress.delete({ where: { id: addrId } });
    return { deleted: true };
  }
}
