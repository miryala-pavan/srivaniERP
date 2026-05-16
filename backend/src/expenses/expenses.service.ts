import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';

const DEFAULT_CATEGORIES = [
  'Rent', 'Electricity', 'Water', 'Salary', 'Wages',
  'Packaging Material', 'Repairs & Maintenance', 'Transport',
  'Marketing', 'Miscellaneous',
];

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        businessId,
        branchId:    dto.branchId,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
        category:    dto.category,
        amount:      dto.amount,
        paymentMode: dto.paymentMode ?? 'CASH',
        vendorName:  dto.vendorName,
        referenceNo: dto.referenceNo,
        description: dto.description,
        remarks:     dto.remarks,
      },
    });
  }

  async findAll(businessId: string, query: ExpenseQueryDto) {
    const page  = Math.max(1, parseInt(query.page  ?? '1'));
    const limit = Math.min(100, parseInt(query.limit ?? '20'));
    const skip  = (page - 1) * limit;

    const where: any = { businessId };

    if (query.category) where.category = { equals: query.category, mode: 'insensitive' };
    if (query.branchId) where.branchId = query.branchId;

    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        const s = new Date(query.startDate); s.setHours(0, 0, 0, 0);
        where.expenseDate.gte = s;
      }
      if (query.endDate) {
        const e = new Date(query.endDate); e.setHours(23, 59, 59, 999);
        where.expenseDate.lte = e;
      }
    }

    const [expenses, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return {
      data: expenses,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), totalAmount },
    };
  }

  async getCategories(businessId: string) {
    const used = await this.prisma.expense.findMany({
      where:    { businessId },
      distinct: ['category'],
      select:   { category: true },
      orderBy:  { category: 'asc' },
    });

    const usedNames  = used.map((e) => e.category).filter(Boolean) as string[];
    const combined   = Array.from(new Set([...DEFAULT_CATEGORIES, ...usedNames])).sort();

    return { categories: combined };
  }
}
