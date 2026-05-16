"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const argon2 = __importStar(require("argon2"));
const USER_SELECT = {
    id: true,
    username: true,
    fullName: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    counterId: true,
    lastLoginAt: true,
    createdAt: true,
    createdByName: true,
};
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(businessId) {
        const users = await this.prisma.user.findMany({
            where: { businessId, deletedAt: null },
            select: USER_SELECT,
            orderBy: { createdAt: 'asc' },
        });
        const counterIds = [...new Set(users.map(u => u.counterId).filter(Boolean))];
        let counterMap = {};
        if (counterIds.length) {
            const counters = await this.prisma.posCounter.findMany({
                where: { id: { in: counterIds } },
                select: { id: true, name: true, code: true },
            });
            counterMap = Object.fromEntries(counters.map(c => [c.id, `${c.name} (${c.code})`]));
        }
        return users.map(u => ({
            ...u,
            counterName: u.counterId ? (counterMap[u.counterId] ?? null) : null,
            isActive: u.status === 'ACTIVE',
        }));
    }
    async findOne(id, businessId) {
        const user = await this.prisma.user.findFirst({
            where: { id, businessId, deletedAt: null },
            select: { ...USER_SELECT, assignedCounterIds: true },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return { ...user, isActive: user.status === 'ACTIVE' };
    }
    async create(businessId, dto, createdBy) {
        const existing = await this.prisma.user.findFirst({
            where: { businessId, username: dto.username },
        });
        if (existing)
            throw new common_1.ConflictException('Username already taken in this business');
        const pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });
        const unusableHash = await argon2.hash(`NO_PWD_${dto.username}_${Date.now()}`, { type: argon2.argon2id });
        const user = await this.prisma.user.create({
            data: {
                businessId,
                username: dto.username,
                fullName: dto.fullName,
                email: dto.email,
                phone: dto.phone,
                role: dto.role,
                counterId: dto.counterId,
                pin: pinHash,
                passwordHash: unusableHash,
                status: 'ACTIVE',
                createdById: createdBy.id,
                createdByName: createdBy.fullName,
            },
            select: USER_SELECT,
        });
        return { ...user, isActive: true };
    }
    async update(id, businessId, dto, updatedBy) {
        const user = await this.findOne(id, businessId);
        if (user.role === 'SUPER_ADMIN' && updatedBy.id !== id) {
            throw new common_1.ForbiddenException('Cannot modify the owner account');
        }
        const updated = await this.prisma.user.update({
            where: { id },
            data: {
                ...(dto.fullName !== undefined && { fullName: dto.fullName }),
                ...(dto.role !== undefined && { role: dto.role }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.email !== undefined && { email: dto.email }),
                ...(dto.counterId !== undefined && { counterId: dto.counterId }),
                updatedById: updatedBy.id,
                updatedByName: updatedBy.fullName,
            },
            select: USER_SELECT,
        });
        return { ...updated, isActive: updated.status === 'ACTIVE' };
    }
    async resetPin(id, businessId, dto, resetBy) {
        await this.findOne(id, businessId);
        const pinHash = await argon2.hash(dto.newPin, { type: argon2.argon2id });
        await this.prisma.user.update({
            where: { id },
            data: {
                pin: pinHash,
                updatedById: resetBy.id,
                updatedByName: resetBy.fullName,
            },
        });
        return { success: true, message: 'PIN reset successfully' };
    }
    async toggleActive(id, businessId, requesterId) {
        if (id === requesterId) {
            throw new common_1.BadRequestException('Cannot deactivate your own account');
        }
        const user = await this.findOne(id, businessId);
        if (user.role === 'SUPER_ADMIN') {
            throw new common_1.ForbiddenException('Cannot deactivate the owner account');
        }
        const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        await this.prisma.user.update({
            where: { id },
            data: { status: newStatus },
        });
        return { isActive: newStatus === 'ACTIVE', status: newStatus };
    }
    async getCounters(businessId) {
        return this.prisma.posCounter.findMany({
            where: { businessId, status: 'ACTIVE' },
            select: { id: true, name: true, code: true, description: true },
            orderBy: { code: 'asc' },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map