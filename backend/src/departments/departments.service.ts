import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, isActive?: string) {
    const where: any = { businessId };
    if (isActive === 'true')  where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const depts = await this.prisma.department.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { categories: { where: { parentId: null } } } },
      },
    });
    return depts.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      createdAt: d.createdAt,
      categoryCount: d._count.categories,
    }));
  }

  async create(businessId: string, body: { name: string; code: string; sortOrder?: number }) {
    const code = body.code.trim().toUpperCase();
    const existing = await this.prisma.department.findUnique({
      where: { businessId_code: { businessId, code } },
    });
    if (existing) throw new BadRequestException(`Department code "${code}" already exists`);
    return this.prisma.department.create({
      data: { businessId, name: body.name.trim(), code, sortOrder: body.sortOrder ?? 0 },
    });
  }

  async update(businessId: string, id: string, body: { name?: string; sortOrder?: number; isActive?: boolean }) {
    const dept = await this.prisma.department.findFirst({ where: { id, businessId } });
    if (!dept) throw new NotFoundException('Department not found');
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(body.name !== undefined      ? { name: body.name.trim() } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive !== undefined  ? { isActive: body.isActive } : {}),
      },
    });
  }

  async remove(businessId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, businessId },
      include: { _count: { select: { categories: true } } },
    });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept._count.categories > 0) {
      throw new BadRequestException(`Cannot delete — department has ${dept._count.categories} categories`);
    }
    await this.prisma.department.delete({ where: { id } });
    return { message: 'Department deleted' };
  }

  async getCategories(businessId: string, id: string) {
    const dept = await this.prisma.department.findFirst({ where: { id, businessId } });
    if (!dept) throw new NotFoundException('Department not found');

    const cats = await this.prisma.category.findMany({
      where: { businessId, departmentId: id, parentId: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { children: true } },
      },
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      label: c.label,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      subCategoryCount: c._count.children,
    }));
  }
}
