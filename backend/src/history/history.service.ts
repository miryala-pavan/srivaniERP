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

  async getBlastList(businessId: string, letter?: string, page = 1, limit = 50) {
    const where = {
      businessId,
      listEntries: { some: {} },
      ...(letter ? { name: { startsWith: letter, mode: 'insensitive' as const } } : {}),
    };
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          historyToken: true,
          historySentAt: true,
          _count: { select: { listEntries: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { customers, total, page, limit };
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
  const display = cleanName(name);
  return `🌿 *${display} గారు,*

మీరు మాకు కేవలం ఒక customer కాదు —
మీరు మా కుటుంబంలో ఒక భాగం. 🙏

*You are not just our customer — you are family.*

ఇన్ని సంవత్సరాలు మీరు మా మీద పెట్టిన నమ్మకం, పంపించిన ప్రతి list, చేసిన ప్రతి order — అవన్నీ మాకు చాలా విలువైనవి. ఆ క్షణాలు మేము ఎప్పటికీ మర్చిపోలేము.

*All these years — every list you sent, every order you trusted us with — they mean the world to us. We have never forgotten a single one.*

✨ *మీ Personal Order History:*
👉 ${url}

మీరు పంపిన ప్రతి page అక్కడ భద్రంగా ఉంది. తెరిచి చూడండి — అది మీరు మాకు ఇచ్చిన నమ్మకానికి మా చిన్న నివాళి.

*Open it — it's our small tribute to the trust you placed in us.*

మీరు ఎప్పుడూ మాతోనే ఉండాలని కోరుకుంటున్నాము. 🙏❤️
*May we always be there for your home — for many more years to come.*

మీ Srivani Stores కుటుంబం,
📍 Sangareddy · Est. 1980`;
}
