import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceablePincodesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string) {
    return this.prisma.serviceablePincode.findMany({
      where: { businessId },
      orderBy: { pincode: 'asc' },
    });
  }

  // Public check — used by storefront checkout before an order is placed.
  // If the business has configured NO serviceable pincodes at all, every
  // pincode is treated as serviceable (fail-open) so a fresh store isn't
  // accidentally locked out before the owner has set up the list.
  async isServiceable(businessId: string, pincode: string): Promise<boolean> {
    const total = await this.prisma.serviceablePincode.count({ where: { businessId, isActive: true } });
    if (total === 0) return true;
    const match = await this.prisma.serviceablePincode.findFirst({
      where: { businessId, pincode, isActive: true },
      select: { id: true },
    });
    return !!match;
  }

  async add(businessId: string, pincode: string, areaLabel?: string) {
    const existing = await this.prisma.serviceablePincode.findUnique({
      where: { businessId_pincode: { businessId, pincode } },
    });
    if (existing) {
      if (existing.isActive) throw new ConflictException('Pincode already in the serviceable list');
      return this.prisma.serviceablePincode.update({
        where: { id: existing.id },
        data: { isActive: true, areaLabel: areaLabel ?? existing.areaLabel },
      });
    }
    return this.prisma.serviceablePincode.create({
      data: { businessId, pincode, areaLabel: areaLabel ?? null },
    });
  }

  async remove(businessId: string, id: string) {
    const row = await this.prisma.serviceablePincode.findFirst({ where: { id, businessId } });
    if (!row) throw new NotFoundException('Pincode not found');
    await this.prisma.serviceablePincode.delete({ where: { id } });
    return { success: true };
  }
}
