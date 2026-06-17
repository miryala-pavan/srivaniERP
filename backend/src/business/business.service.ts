import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetupDto } from './dto/setup.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

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

  async updateBusiness(businessId: string, dto: UpdateBusinessDto, userId: string, userName: string) {
    const existing = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!existing) throw new NotFoundException('Business not found');

    // Validate license pairs: number ↔ expiry must both be present or both absent
    const pairs: [string, string, string, string][] = [
      ['fssaiLicense',             'fssaiExpiry',             'FSSAI License',              'FSSAI Expiry'],
      ['drugLicense',              'drugLicenseExpiry',       'Drug License',               'Drug License Expiry'],
      ['tradeLicense',             'tradeLicenseExpiry',      'Trade License',              'Trade License Expiry'],
      ['shopEstablishmentLicense', 'shopEstablishmentExpiry', 'Shop & Establishment No.',   'Shop & Establishment Expiry'],
      ['fireSafetyNoc',            'fireSafetyNocExpiry',     'Fire Safety NOC',            'Fire Safety NOC Expiry'],
      ['weightsAndMeasuresLicense','weightsAndMeasuresExpiry','Weights & Measures License', 'Weights & Measures Expiry'],
      ['liquorLicense',            'liquorLicenseExpiry',     'Liquor License',             'Liquor License Expiry'],
    ];

    for (const [numKey, expKey, numLabel, expLabel] of pairs) {
      const numVal  = (dto as any)[numKey]  ?? (existing as any)[numKey]  ?? null;
      const expVal  = (dto as any)[expKey]  ?? (existing as any)[expKey]  ?? null;
      if (numVal && !expVal) throw new BadRequestException(`${expLabel} is required when ${numLabel} is provided`);
      if (expVal && !numVal) throw new BadRequestException(`${numLabel} is required when ${expLabel} is provided`);
    }

    // All expiry dates must be in the future
    const expiryFields = [
      'fssaiExpiry','drugLicenseExpiry','tradeLicenseExpiry','shopEstablishmentExpiry',
      'fireSafetyNocExpiry','weightsAndMeasuresExpiry','liquorLicenseExpiry',
    ];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const field of expiryFields) {
      const val = (dto as any)[field];
      if (val && new Date(val) < today) {
        const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
        throw new BadRequestException(`${label} cannot be in the past`);
      }
    }

    const oldValues = { ...existing };

    const d = (v: string | undefined) => v ? new Date(v) : undefined;

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name                     !== undefined ? { name: dto.name }                                                          : {}),
        ...(dto.gstin                    !== undefined ? { gstin: dto.gstin || null }                                                : {}),
        ...(dto.stateCode                !== undefined ? { stateCode: dto.stateCode }                                               : {}),
        ...(dto.stateName                !== undefined ? { stateName: dto.stateName }                                               : {}),
        ...(dto.address                  !== undefined ? { address: dto.address || null }                                           : {}),
        ...(dto.phone                    !== undefined ? { phone: dto.phone || null }                                               : {}),
        ...(dto.email                    !== undefined ? { email: dto.email || null }                                               : {}),
        ...(dto.pan                      !== undefined ? { pan: dto.pan || null }                                                   : {}),
        ...(dto.tan                      !== undefined ? { tan: dto.tan || null }                                                   : {}),
        ...(dto.professionalTaxNo        !== undefined ? { professionalTaxNo: dto.professionalTaxNo || null }                       : {}),
        ...(dto.fssaiLicense             !== undefined ? { fssaiLicense: dto.fssaiLicense || null }                                 : {}),
        ...(dto.fssaiExpiry              !== undefined ? { fssaiExpiry: d(dto.fssaiExpiry) ?? null }                                : {}),
        ...(dto.drugLicense              !== undefined ? { drugLicense: dto.drugLicense || null }                                   : {}),
        ...(dto.drugLicenseExpiry        !== undefined ? { drugLicenseExpiry: d(dto.drugLicenseExpiry) ?? null }                    : {}),
        ...(dto.tradeLicense             !== undefined ? { tradeLicense: dto.tradeLicense || null }                                 : {}),
        ...(dto.tradeLicenseExpiry       !== undefined ? { tradeLicenseExpiry: d(dto.tradeLicenseExpiry) ?? null }                  : {}),
        ...(dto.shopEstablishmentLicense !== undefined ? { shopEstablishmentLicense: dto.shopEstablishmentLicense || null }         : {}),
        ...(dto.shopEstablishmentExpiry  !== undefined ? { shopEstablishmentExpiry: d(dto.shopEstablishmentExpiry) ?? null }        : {}),
        ...(dto.fireSafetyNoc            !== undefined ? { fireSafetyNoc: dto.fireSafetyNoc || null }                               : {}),
        ...(dto.fireSafetyNocExpiry      !== undefined ? { fireSafetyNocExpiry: d(dto.fireSafetyNocExpiry) ?? null }                : {}),
        ...(dto.weightsAndMeasuresLicense !== undefined ? { weightsAndMeasuresLicense: dto.weightsAndMeasuresLicense || null }      : {}),
        ...(dto.weightsAndMeasuresExpiry  !== undefined ? { weightsAndMeasuresExpiry: d(dto.weightsAndMeasuresExpiry) ?? null }     : {}),
        ...(dto.liquorLicense            !== undefined ? { liquorLicense: dto.liquorLicense || null }                               : {}),
        ...(dto.liquorLicenseExpiry      !== undefined ? { liquorLicenseExpiry: d(dto.liquorLicenseExpiry) ?? null }                : {}),
        ...(dto.udyamRegistration        !== undefined ? { udyamRegistration: dto.udyamRegistration || null }                       : {}),
        ...(dto.cin                      !== undefined ? { cin: dto.cin || null }                                                   : {}),
        ...(dto.iecCode                  !== undefined ? { iecCode: dto.iecCode || null }                                           : {}),
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: { userId, businessId, userName, userRole: 'SUPER_ADMIN', action: 'UPDATE', entity: 'SETTINGS', entityId: businessId, description: 'Business profile updated', meta: { updatedFields: Object.keys(dto) } },
      });
    } catch { /* audit failures must never break the main flow */ }

    return updated;
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
