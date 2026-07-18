import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';

@Injectable()
export class HistoryService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
  ) {}

  async getByToken(token: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { historyToken: token },
      select: {
        name: true,
        phone: true,
        listEntries: {
          orderBy: { entryDate: 'desc' },
          select: {
            id: true,
            entryDate: true,
            imageUrls: true,
            pageCount: true,
            source: true,
          },
        },
      },
    });

    if (!customer) throw new NotFoundException('History not found');

    // FILES_BASE_URL in prod = https://www.srivani.com/list (Hostinger)
    // Falls back to local NestJS static serving for dev
    const filesBase = (process.env.FILES_BASE_URL ?? 'http://localhost:4001/shop-list').replace(/\/$/, '');

    return {
      customer: {
        name: customer.name,
        phone: customer.phone,
      },
      entries: customer.listEntries.map(e => ({
        id: e.id,
        entryDate: e.entryDate,
        pageCount: e.pageCount,
        source: e.source,
        imageUrls: e.imageUrls.map(p =>
          `${filesBase}/${p.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`,
        ),
      })),
    };
  }

  async sendHistoryLink(customerId: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, name: true, phone: true, historyToken: true, historySentAt: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (!customer.phone) throw new Error('Customer has no phone number on record');

    let token = customer.historyToken;
    if (!token) {
      token = randomBytes(16).toString('hex');
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { historyToken: token, historySentAt: new Date() },
    });

    const shopUrl = (process.env.SHOP_URL ?? 'http://localhost:4002').replace(/\/$/, '');
    const url = `${shopUrl}/history/${token}`;

    const msg = buildMessage(customer.name, url);

    let waSent = false;
    let waError: string | undefined;
    try {
      // Note: sendTextMessage only works within a 24h session window.
      // For cold contacts (no recent inbound message), use a WhatsApp template instead.
      await this.wa.sendTextMessage(businessId, customer.phone, msg);
      waSent = true;
    } catch (err) {
      waError = String(err);
    }

    return {
      token,
      url,
      waSent,
      waError,
      previouslySentAt: customer.historySentAt,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
    };
  }
}

const JUNK_RE = /^(delivery|deliveries|deliv|customer|customers|cust|apna|chotu|aab|shop|stores?|home|house|order)$/i;
function cleanName(raw: string): string {
  const words = raw.trim().split(/\s+/);
  const filtered = words.filter(w => !JUNK_RE.test(w));
  return (filtered.length ? filtered : words).join(' ');
}

function buildMessage(name: string, url: string): string {
  const firstName = cleanName(name).split(/\s+/)[0];
  return `🙏 Namaste ${firstName}!

Over the years, your trust and support have meant everything to us at Srivani Stores. It has been our honour to serve you and your family. 🌿

We've put together your personal shopping history — a small keepsake of the bond we've built together over these years.

📜 View your personal history here:
${url}

With warmth and gratitude,
Team Srivani Stores ❤️`;
}
