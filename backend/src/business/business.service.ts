import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetupDto } from './dto/setup.dto';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async getSetupStatus() {
    const count = await this.prisma.business.count();
    return { exists: count > 0 };
  }

  async setup(dto: SetupDto) {
    const count = await this.prisma.business.count();
    if (count > 0) {
      throw new ForbiddenException('Business already configured. Use /info to view details.');
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

  async getInfo(businessId: string) {
    return this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        branches: { where: { isActive: true } },
        financialYears: { where: { isActive: true }, orderBy: { startDate: 'desc' } },
      },
    });
  }

  private currentFinancialYear() {
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
}
