"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DepartmentsService = class DepartmentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(businessId, isActive) {
        const where = { businessId };
        if (isActive === 'true')
            where.isActive = true;
        if (isActive === 'false')
            where.isActive = false;
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
    async create(businessId, body) {
        const code = body.code.trim().toUpperCase();
        const existing = await this.prisma.department.findUnique({
            where: { businessId_code: { businessId, code } },
        });
        if (existing)
            throw new common_1.BadRequestException(`Department code "${code}" already exists`);
        return this.prisma.department.create({
            data: { businessId, name: body.name.trim(), code, sortOrder: body.sortOrder ?? 0 },
        });
    }
    async update(businessId, id, body) {
        const dept = await this.prisma.department.findFirst({ where: { id, businessId } });
        if (!dept)
            throw new common_1.NotFoundException('Department not found');
        return this.prisma.department.update({
            where: { id },
            data: {
                ...(body.name !== undefined ? { name: body.name.trim() } : {}),
                ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
                ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            },
        });
    }
    async remove(businessId, id) {
        const dept = await this.prisma.department.findFirst({
            where: { id, businessId },
            include: { _count: { select: { categories: true } } },
        });
        if (!dept)
            throw new common_1.NotFoundException('Department not found');
        if (dept._count.categories > 0) {
            throw new common_1.BadRequestException(`Cannot delete — department has ${dept._count.categories} categories`);
        }
        await this.prisma.department.delete({ where: { id } });
        return { message: 'Department deleted' };
    }
    async getCategories(businessId, id) {
        const dept = await this.prisma.department.findFirst({ where: { id, businessId } });
        if (!dept)
            throw new common_1.NotFoundException('Department not found');
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
};
exports.DepartmentsService = DepartmentsService;
exports.DepartmentsService = DepartmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DepartmentsService);
//# sourceMappingURL=departments.service.js.map