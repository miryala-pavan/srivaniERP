import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductGroupsService {
  constructor(private prisma: PrismaService) {}

  async listGroups(businessId: string) {
    return this.prisma.productGroup.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
      include: {
        members: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: { select: { id: true, productCode: true, name: true, imageUrl: true, totalStock: true } },
          },
        },
      },
    });
  }

  async createGroup(businessId: string, name: string, members: { productId: string; displayLabel: string }[]) {
    if (!name?.trim()) throw new BadRequestException('Group name required');
    // Validate all products belong to this business
    const products = await this.prisma.product.findMany({
      where: { id: { in: members.map(m => m.productId) }, businessId },
      select: { id: true },
    });
    if (products.length !== members.length) throw new BadRequestException('Some products not found');

    return this.prisma.productGroup.create({
      data: {
        businessId,
        name: name.trim(),
        members: {
          create: members.map((m, i) => ({
            productId:    m.productId,
            displayLabel: m.displayLabel.trim(),
            sortOrder:    i,
          })),
        },
      },
      include: { members: { include: { product: { select: { productCode: true, name: true } } } } },
    });
  }

  async addMember(businessId: string, groupId: string, productId: string, displayLabel: string) {
    const group = await this.prisma.productGroup.findFirst({ where: { id: groupId, businessId } });
    if (!group) throw new NotFoundException('Group not found');
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');
    const maxOrder = await this.prisma.productGroupMember.count({ where: { groupId } });
    return this.prisma.productGroupMember.create({
      data: { groupId, productId, displayLabel: displayLabel.trim(), sortOrder: maxOrder },
    });
  }

  async updateMember(businessId: string, memberId: string, dto: { displayLabel?: string; sortOrder?: number }) {
    const member = await this.prisma.productGroupMember.findFirst({
      where: { id: memberId, group: { businessId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.productGroupMember.update({ where: { id: memberId }, data: dto });
  }

  async removeMember(businessId: string, memberId: string) {
    const member = await this.prisma.productGroupMember.findFirst({
      where: { id: memberId, group: { businessId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.prisma.productGroupMember.delete({ where: { id: memberId } });
    // Delete group if no members left
    const remaining = await this.prisma.productGroupMember.count({ where: { groupId: member.groupId } });
    if (remaining === 0) await this.prisma.productGroup.delete({ where: { id: member.groupId } });
    return { message: 'Removed' };
  }

  async deleteGroup(businessId: string, groupId: string) {
    const group = await this.prisma.productGroup.findFirst({ where: { id: groupId, businessId } });
    if (!group) throw new NotFoundException('Group not found');
    await this.prisma.productGroup.delete({ where: { id: groupId } });
    return { message: 'Group deleted' };
  }

  // ─── Auto-detect candidates ───────────────────────────────────────────────
  // Strips trailing measurement from product name and groups by prefix.
  async autoDetect(businessId: string) {
    const MEASURE_RE = /\s+\d[\d.]*\s*(ml|l|ltr|litre|kg|g|gm|gram|mtr|m|cm|pcs|pc|nos|no|pack|pkt|box|bag|btl|bottle|can|doz|set)\b\.?$/i;

    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true, availableOnline: true },
      select: { id: true, productCode: true, name: true, imageUrl: true },
      orderBy: { name: 'asc' },
    });

    // Products already in a group
    const existing = await this.prisma.productGroupMember.findMany({
      where: { group: { businessId } },
      select: { productId: true },
    });
    const alreadyGrouped = new Set(existing.map(e => e.productId));

    const buckets = new Map<string, typeof products>();
    for (const p of products) {
      if (alreadyGrouped.has(p.id)) continue;
      const match = MEASURE_RE.exec(p.name);
      if (!match) continue;
      const prefix = p.name.slice(0, match.index).trim().toLowerCase();
      if (!buckets.has(prefix)) buckets.set(prefix, []);
      buckets.get(prefix)!.push(p);
    }

    // Only return buckets with 2+ products
    const suggestions: { groupName: string; members: { productId: string; productCode: string; name: string; suggestedLabel: string }[] }[] = [];
    for (const [prefix, prods] of buckets) {
      if (prods.length < 2) continue;
      suggestions.push({
        groupName: prefix.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        members: prods.map(p => {
          const m = MEASURE_RE.exec(p.name);
          return {
            productId:      p.id,
            productCode:    p.productCode ?? '',
            name:           p.name,
            suggestedLabel: m ? p.name.slice(m.index).trim() : p.name,
          };
        }),
      });
    }

    return suggestions;
  }
}
