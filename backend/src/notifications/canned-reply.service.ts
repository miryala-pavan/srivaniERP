import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CannedReplyService {
  constructor(private prisma: PrismaService) {}

  async list(businessId: string) {
    return this.prisma.waCannedReply.findMany({
      where: { businessId },
      orderBy: [{ category: 'asc' }, { title: 'asc' }],
    });
  }

  async create(businessId: string, data: { title: string; body: string; category?: string }) {
    return this.prisma.waCannedReply.create({
      data: { businessId, title: data.title, body: data.body, category: data.category ?? null },
    });
  }

  async update(businessId: string, id: string, data: { title?: string; body?: string; category?: string | null }) {
    const existing = await this.prisma.waCannedReply.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Canned reply not found');
    return this.prisma.waCannedReply.update({ where: { id }, data });
  }

  async delete(businessId: string, id: string) {
    const existing = await this.prisma.waCannedReply.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundException('Canned reply not found');
    await this.prisma.waCannedReply.delete({ where: { id } });
    return { message: 'Deleted' };
  }
}
