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

  async getBlastList(
    businessId: string,
    opts: { letter?: string; search?: string; status?: string; sort?: string; page?: number; limit?: number },
  ) {
    const { letter, search, status = 'all', sort = 'name_asc', page = 1, limit = 50 } = opts;

    const where: any = { businessId };

    if (status === 'ready') {
      where.listEntries = { some: {} };
      where.historySentAt = null;
    } else if (status === 'sent') {
      where.listEntries = { some: {} };
      where.historySentAt = { not: null };
    } else {
      where.listEntries = { some: {} };
    }

    if (search?.trim()) {
      where.OR = [
        { name:  { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim() } },
      ];
    } else if (letter) {
      where.name = { startsWith: letter, mode: 'insensitive' as const };
    }

    let orderBy: any = { name: 'asc' };
    if (sort === 'name_desc')    orderBy = { name: 'desc' };
    if (sort === 'phone_asc')    orderBy = { phone: 'asc' };
    if (sort === 'phone_desc')   orderBy = { phone: 'desc' };
    if (sort === 'entries_asc')  orderBy = { listEntries: { _count: 'asc' } };
    if (sort === 'entries_desc') orderBy = { listEntries: { _count: 'desc' } };
    if (sort === 'sent_asc')     orderBy = { historySentAt: { sort: 'asc',  nulls: 'last' } };
    if (sort === 'sent_desc')    orderBy = { historySentAt: { sort: 'desc', nulls: 'last' } };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        select: {
          id: true, name: true, phone: true,
          historyToken: true, historySentAt: true,
          _count: { select: { listEntries: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    // Fetch the latest outbound WA message status per customer (for sent ones only)
    const sentPhones = customers
      .filter(c => c.historySentAt && c.phone)
      .map(c => `91${c.phone!}`);

    const waStatusMap = new Map<string, string>();
    if (sentPhones.length > 0) {
      const msgs = await this.prisma.waMessage.findMany({
        where: { businessId, phone: { in: sentPhones }, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { phone: true, status: true },
      });
      msgs.forEach(m => { if (!waStatusMap.has(m.phone)) waStatusMap.set(m.phone, m.status); });
    }

    const shopUrl = (process.env.SHOP_URL ?? 'https://shop.srivani.com').replace(/\/$/, '');
    return {
      customers: customers.map(c => ({
        ...c,
        historyUrl: c.historyToken ? `${shopUrl}/history/${c.historyToken}` : null,
        waStatus: c.phone ? (waStatusMap.get(`91${c.phone}`) ?? null) : null,
      })),
      total, page, limit,
    };
  }

  async ensurePreviewToken(customerId: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, historyToken: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    let token = customer.historyToken;
    if (!token) {
      token = randomBytes(16).toString('hex');
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { historyToken: token },
      });
    }

    const shopUrl = (process.env.SHOP_URL ?? 'https://shop.srivani.com').replace(/\/$/, '');
    return { token, url: `${shopUrl}/history/${token}` };
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
    const displayName = cleanName(customer.name);

    let waSent = false;
    let waError: string | undefined;
    let method: 'template' | 'text' = 'template';

    // Try approved template first (works for cold contacts, no 24h restriction)
    const templateResult = await this.wa.sendTemplateToNumber(
      businessId, customer.phone, 'svn_history_link', 'en', [displayName], token,
    );

    if (templateResult.ok) {
      waSent = true;
    } else {
      // Fallback: plain text (requires active 24h session window)
      method = 'text';
      try {
        await this.wa.sendTextMessage(businessId, customer.phone, buildMessage(customer.name, url));
        waSent = true;
      } catch (err) {
        waError = String(err);
      }
    }

    return {
      token,
      url,
      waSent,
      method,
      waError,
      previouslySentAt: customer.historySentAt,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
    };
  }

  /**
   * Server-side batch version of sendHistoryLink — runs the loop here instead
   * of the browser tab, so it survives a closed tab/dropped connection and
   * gives per-customer detail (not just an ok/fail count). Each customer
   * still gets their own token via the same per-customer call; one failure
   * doesn't stop the rest of the batch.
   */
  async sendHistoryLinkBulk(customerIds: string[], businessId: string) {
    const results: { customerId: string; name: string; waSent: boolean; waError?: string }[] = [];
    for (const customerId of customerIds) {
      try {
        const r = await this.sendHistoryLink(customerId, businessId);
        results.push({ customerId, name: r.customer.name, waSent: r.waSent, waError: r.waError });
      } catch (err) {
        results.push({
          customerId,
          name: '',
          waSent: false,
          waError: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return {
      total: results.length,
      sent: results.filter(r => r.waSent).length,
      failed: results.filter(r => !r.waSent).length,
      results,
    };
  }

  /** One-time: register the svn_history_link template with Meta for approval. */
  async registerHistoryTemplate(businessId: string) {
    const shopUrl = (process.env.SHOP_URL ?? 'https://srivani.com').replace(/\/$/, '');
    return this.wa.createTemplate(businessId, {
      name: 'svn_history_link',
      category: 'UTILITY',
      language: 'en',
      bodyText: `Dear {{1}},

You are not just our customer - you are family.

Every list you sent, every order you placed - we have preserved them all, all these years.

Your complete purchase history is ready. Tap the button below to view it.`,
      bodyExample: ['Ramesh'],
      footerText: 'Srivani Stores',
      buttons: [
        {
          type: 'URL',
          text: 'View My History',
          url: `${shopUrl}/history/{{1}}`,
          example: `${shopUrl}/history/abc123sample`,
        },
      ],
    });
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
