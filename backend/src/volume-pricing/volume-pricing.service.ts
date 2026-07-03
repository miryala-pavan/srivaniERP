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

  async getAllByBusiness(businessId: string) {
    const tiers = await this.prisma.volumePricingTier.findMany({
      where:   { businessId },
      orderBy: [{ pluBarcode: 'asc' }, { minQty: 'asc' }],
    });
    if (!tiers.length) return [];

    const grouped = new Map<string, typeof tiers>();
    for (const t of tiers) {
      if (!grouped.has(t.pluBarcode)) grouped.set(t.pluBarcode, []);
      grouped.get(t.pluBarcode)!.push(t);
    }

    const plusData = await this.prisma.productPlu.findMany({
      where:  { businessId, pluCode: { in: [...grouped.keys()] } },
      select: {
        pluCode: true, displayName: true, sellingPrice: true, mrp: true,
        product: { select: { name: true, unitOfMeasure: true } },
      },
    });
    const pluMap = new Map(plusData.map((p) => [p.pluCode, p]));

    return [...grouped.entries()].map(([pluBarcode, trs]) => {
      const plu = pluMap.get(pluBarcode);
      return {
        pluBarcode,
        productName:   plu?.product.name       ?? pluBarcode,
        displayName:   plu?.displayName        ?? null,
        sellingPrice:  plu ? Number(plu.sellingPrice) : null,
        mrp:           plu ? Number(plu.mrp)          : null,
        unitOfMeasure: plu?.product.unitOfMeasure     ?? null,
        tiers: trs.map((t) => ({ id: t.id, minQty: t.minQty, price: Number(t.price) })),
      };
    });
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
