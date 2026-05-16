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
exports.BusinessService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BusinessService = class BusinessService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSetupStatus() {
        const count = await this.prisma.business.count();
        return { exists: count > 0 };
    }
    async setup(dto) {
        const count = await this.prisma.business.count();
        if (count > 0) {
            throw new common_1.ForbiddenException('Business already configured. Use /info to view details.');
        }
        const stateCode = dto.stateCode ?? '36';
        const stateName = dto.stateName ?? 'Telangana';
        const business = await this.prisma.business.create({
            data: {
                name: dto.businessName,
                gstin: dto.gstin,
                phone: dto.phone,
                address: dto.address,
                email: dto.email,
                fssaiLicense: dto.fssaiLicense,
                stateCode,
                stateName,
            },
        });
        const branch = await this.prisma.branch.create({
            data: {
                businessId: business.id,
                name: 'Main Branch',
                address: dto.address,
                phone: dto.phone,
                isActive: true,
            },
        });
        const { fyCode, startDate, endDate } = this.currentFinancialYear();
        const fy = await this.prisma.financialYear.create({
            data: {
                businessId: business.id,
                fyCode,
                startDate,
                endDate,
                isActive: true,
            },
        });
        await this.prisma.billSeries.create({
            data: {
                businessId: business.id,
                financialYearId: fy.id,
                seriesPrefix: 'GST/',
                currentNumber: 0,
                numberFormat: '0000',
                isActive: true,
            },
        });
        return { business, branch, financialYear: fy, message: 'Business setup complete' };
    }
    async getInfo(businessId) {
        return this.prisma.business.findUnique({
            where: { id: businessId },
            include: {
                branches: { where: { isActive: true } },
                financialYears: { where: { isActive: true }, orderBy: { startDate: 'desc' } },
            },
        });
    }
    currentFinancialYear() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const fyStartYear = month >= 4 ? year : year - 1;
        const fyEndYear = fyStartYear + 1;
        return {
            fyCode: `${fyStartYear}-${String(fyEndYear).slice(2)}`,
            startDate: new Date(fyStartYear, 3, 1),
            endDate: new Date(fyEndYear, 2, 31),
        };
    }
};
exports.BusinessService = BusinessService;
exports.BusinessService = BusinessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessService);
//# sourceMappingURL=business.service.js.map