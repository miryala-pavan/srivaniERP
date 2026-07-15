import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InternalNoteService {
  constructor(private prisma: PrismaService) {}

  // Same normalization WaConversation/WaMessage already store phones under —
  // keeps notes keyed consistently with the rest of the conversation data.
  private e164(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    const local = digits.length >= 10 ? digits.slice(-10) : null;
    if (!local || !/^[6-9]\d{9}$/.test(local)) return null;
    return `91${local}`;
  }

  async list(businessId: string, phone: string) {
    const to = this.e164(phone) ?? phone;
    const notes = await this.prisma.waInternalNote.findMany({
      where: { businessId, conversationPhone: to },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { fullName: true } } },
    });
    return notes.map((n) => ({
      id: n.id,
      body: n.body,
      authorName: n.author.fullName,
      createdAt: n.createdAt,
    }));
  }

  async create(businessId: string, phone: string, authorUserId: string, body: string) {
    const to = this.e164(phone) ?? phone;
    const note = await this.prisma.waInternalNote.create({
      data: { businessId, conversationPhone: to, authorUserId, body },
      include: { author: { select: { fullName: true } } },
    });
    return {
      id: note.id,
      body: note.body,
      authorName: note.author.fullName,
      createdAt: note.createdAt,
    };
  }
}
