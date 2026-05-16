import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateCustomerDto) {
    if (dto.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: { businessId, phone: dto.phone, isActive: true },
      });
      if (existing) {
        throw new ConflictException(`Customer with phone ${dto.phone} already exists`);
      }
    }

    return this.prisma.customer.create({
      data: {
        businessId,
        name:         dto.name,
        phone:        dto.phone,
        email:        dto.email,
        gstin:        dto.gstin,
        address:      dto.address,
        stateCode:    dto.stateCode,
        customerType: dto.customerType ?? 'REGULAR',
      },
    });
  }

  async findAll(businessId: string, query: CustomerQueryDto) {
    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId, isActive: true };
    if (query.search) {
      where.OR = [
        { name:  { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [customers, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true, name: true, phone: true, email: true,
          gstin: true, customerType: true,
          outstandingBalance: true, loyaltyPoints: true,
          createdAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const recentBills = await this.prisma.salesBill.findMany({
      where: { customerId: id, businessId, status: 'FINAL' },
      orderBy: { billDate: 'desc' },
      take: 10,
      select: {
        id: true, billNumber: true, billDate: true,
        grandTotal: true, paidAmount: true, balanceAmount: true,
        paymentMode: true, status: true,
      },
    });

    const stats = await this.prisma.salesBill.aggregate({
      where: { customerId: id, businessId, status: 'FINAL' },
      _sum:   { grandTotal: true, paidAmount: true },
      _count: { id: true },
    });

    return {
      ...customer,
      stats: {
        totalBills:        stats._count.id,
        totalPurchased:    Number(stats._sum.grandTotal  ?? 0),
        totalPaid:         Number(stats._sum.paidAmount  ?? 0),
        outstandingBalance: Number(customer.outstandingBalance),
      },
      recentBills,
    };
  }

  async update(businessId: string, id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.phone && dto.phone !== customer.phone) {
      const conflict = await this.prisma.customer.findFirst({
        where: { businessId, phone: dto.phone, isActive: true, id: { not: id } },
      });
      if (conflict) throw new ConflictException(`Phone ${dto.phone} already in use`);
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        name:         dto.name,
        phone:        dto.phone,
        email:        dto.email,
        gstin:        dto.gstin,
        address:      dto.address,
        stateCode:    dto.stateCode,
        customerType: dto.customerType,
        isActive:     dto.isActive,
      },
    });
  }
}
