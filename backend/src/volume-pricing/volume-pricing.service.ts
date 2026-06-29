import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVolumeTierDto } from './dto/create-tier.dto';

@Injectable()
export class VolumePricingService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  async getByPlu(pluBarcode: string) {
    const businessId = await this.getBusinessId();
    return this.prisma.volumePricingTier.findMany({
      where: { businessId, pluBarcode },
      orderBy: { minQty: 'asc' },
      select: { id: true, minQty: true, price: true },
    });
  }

  // Called by shop service and order validation — no extra DB round-trip needed
  async getByPluBarcodes(businessId: string, pluBarcodes: string[]) {
    if (!pluBarcodes.length) return [];
    return this.prisma.volumePricingTier.findMany({
      where: { businessId, pluBarcode: { in: pluBarcodes } },
      orderBy: { minQty: 'asc' },
      select: { pluBarcode: true, minQty: true, price: true },
    });
  }

  async create(dto: CreateVolumeTierDto) {
    const businessId = await this.getBusinessId();
    return this.prisma.volumePricingTier.upsert({
      where: {
        businessId_pluBarcode_minQty: {
          businessId,
          pluBarcode: dto.pluBarcode,
          minQty: dto.minQty,
        },
      },
      update: { price: dto.price },
      create: {
        businessId,
        pluBarcode: dto.pluBarcode,
        minQty: dto.minQty,
        price: dto.price,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.volumePricingTier.delete({ where: { id } });
    return { success: true };
  }

  /** Compute the effective unit price given qty and a set of tiers (sorted by minQty asc). */
  static applyTiers(
    basePrice: number,
    tiers: { minQty: number; price: number }[],
    qty: number,
  ): number {
    let effective = basePrice;
    for (const t of tiers) {
      if (qty >= t.minQty) effective = t.price;
    }
    return effective;
  }
}
