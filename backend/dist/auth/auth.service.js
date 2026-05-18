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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const argon2 = __importStar(require("argon2"));
let AuthService = class AuthService {
    prisma;
    jwtService;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async onModuleInit() {
        await this.seedTestUser();
    }
    async validateUser(username, password) {
        const user = await this.prisma.user.findFirst({
            where: { username, deletedAt: null },
            include: {
                business: { select: { id: true, name: true, gstin: true, stateName: true } },
            },
        });
        if (!user || user.status !== 'ACTIVE')
            return null;
        const valid = await argon2.verify(user.passwordHash, password);
        if (!valid)
            return null;
        const { passwordHash, pin, ...result } = user;
        return result;
    }
    async validateUserByPin(username, pinInput) {
        const user = await this.prisma.user.findFirst({
            where: { username, deletedAt: null },
            include: {
                business: { select: { id: true, name: true, gstin: true, stateName: true } },
            },
        });
        if (!user || user.status !== 'ACTIVE')
            return null;
        if (!user.pin)
            return null;
        const valid = await argon2.verify(user.pin, pinInput);
        if (!valid)
            return null;
        const { passwordHash, pin, ...result } = user;
        return result;
    }
    async login(user) {
        const payload = {
            sub: user.id,
            username: user.username,
            role: user.role,
            businessId: user.businessId,
            counterId: user.counterId ?? null,
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                businessId: user.businessId,
                counterId: user.counterId ?? null,
                business: user.business,
            },
        };
    }
    async register(dto) {
        const businessCount = await this.prisma.business.count();
        if (businessCount > 0) {
            throw new common_1.ForbiddenException('Business already registered. Please login.');
        }
        const business = await this.prisma.business.create({
            data: { name: dto.businessName, gstin: dto.gstin },
        });
        const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
        const user = await this.prisma.user.create({
            data: {
                businessId: business.id,
                username: dto.username,
                passwordHash,
                fullName: dto.fullName,
                email: dto.email,
                phone: dto.phone,
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
            },
        });
        const payload = {
            sub: user.id,
            username: user.username,
            role: user.role,
            businessId: user.businessId,
            counterId: null,
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                businessId: user.businessId,
                counterId: null,
            },
        };
    }
    async verifyPin(userId, pin) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { pin: true, passwordHash: true },
        });
        if (!user)
            return false;
        if (user.pin)
            return argon2.verify(user.pin, pin);
        return argon2.verify(user.passwordHash, pin);
    }
    async refreshToken(userId) {
        const user = await this.prisma.user.findFirst({
            where: { id: userId, status: 'ACTIVE', deletedAt: null },
            include: {
                business: { select: { id: true, name: true, gstin: true, stateName: true } },
            },
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found or inactive');
        const payload = {
            sub: user.id,
            username: user.username,
            role: user.role,
            businessId: user.businessId,
            counterId: user.counterId ?? null,
        };
        const newToken = this.jwtService.sign(payload, {
            expiresIn: (process.env.JWT_EXPIRES_IN || '12h'),
        });
        return {
            access_token: newToken,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                businessId: user.businessId,
                counterId: user.counterId ?? null,
                business: user.business,
            },
        };
    }
    async getMe(userId) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
                status: true,
                businessId: true,
                counterId: true,
                lastLoginAt: true,
                createdAt: true,
                business: {
                    select: { id: true, name: true, gstin: true, stateName: true, stateCode: true },
                },
            },
        });
    }
    async seedTestUser() {
        const userCount = await this.prisma.user.count();
        if (userCount > 0)
            return;
        let business = await this.prisma.business.findFirst();
        if (!business) {
            business = await this.prisma.business.create({
                data: { name: 'Srivani Stores', stateCode: '36', stateName: 'Telangana' },
            });
        }
        const passwordHash = await argon2.hash('Admin@2026', { type: argon2.argon2id });
        await this.prisma.user.create({
            data: {
                businessId: business.id,
                username: 'admin',
                passwordHash,
                fullName: 'Srivani Admin',
                role: 'SUPER_ADMIN',
                status: 'ACTIVE',
            },
        });
        console.log('Test user seeded: admin / Admin@2026');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map