import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { CreateOrderPhotoDto } from './dto/create-order-photo.dto';

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? 'http://localhost:4001').replace(/\/$/, '');

@Injectable()
export class OrderPhotosService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
  ) {}

  private get photosDir(): string {
    return process.env.ORDER_PHOTOS_DIR
      ?? path.join(process.cwd(), '..', 'storage', 'order-photos');
  }

  /**
   * Saves the photo, then builds both share messages (see Design decisions
   * in the feature plan for why there are two): the wa.me link whose
   * pre-filled text carries this photo's token, and the full bilingual block
   * staff copy in one action to send via their own personal WhatsApp.
   */
  async upload(businessId: string, dto: CreateOrderPhotoDto, file: Express.Multer.File) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, businessId } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.salesBillId) {
      const bill = await this.prisma.salesBill.findFirst({ where: { id: dto.salesBillId, businessId } });
      if (!bill) throw new BadRequestException('Bill not found or does not belong to this business');
    }
    if (dto.onlineOrderId) {
      const order = await this.prisma.onlineOrder.findFirst({ where: { id: dto.onlineOrderId, businessId } });
      if (!order) throw new BadRequestException('Online order not found or does not belong to this business');
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      throw new BadRequestException('Only jpg, png, and webp images are allowed');
    }

    // Short and readable — this is embedded in a chat message a customer
    // reads, not just a URL, so History's 32-hex-char token would be clunky.
    // Still ~1.1x10^12 combinations — plenty for one customer's own photo.
    const token = randomBytes(5).toString('hex').toUpperCase();

    fs.mkdirSync(this.photosDir, { recursive: true });
    const filename = `${token}${ext}`;
    fs.writeFileSync(path.join(this.photosDir, filename), file.buffer);
    const imageUrl = `/uploads/order-photos/${filename}`;

    await this.prisma.orderPhoto.create({
      data: {
        businessId,
        customerId: dto.customerId,
        salesBillId: dto.salesBillId,
        onlineOrderId: dto.onlineOrderId,
        token,
        imageUrl,
        caption: dto.caption,
      },
    });

    const [storeNumber, business] = await Promise.all([
      this.wa.getOrDiscoverStoreDisplayNumber(businessId),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
    ]);
    const businessName = business?.name ?? 'our store';
    const customerName = customer.name.trim();

    let waLink: string | null = null;
    let staffMessage: string | null = null;
    if (storeNumber) {
      const refMessage = buildCustomerRefMessage(businessName, token);
      waLink = `https://wa.me/${storeNumber}?text=${encodeURIComponent(refMessage)}`;
      staffMessage = buildStaffShareMessage(customerName, waLink, businessName);
    }

    return { token, imageUrl: `${API_PUBLIC_URL}${imageUrl}`, waLink, staffMessage };
  }

  /** Public — no auth — the unguessable token IS the access control, same pattern as HistoryService. */
  async getByToken(token: string) {
    const photo = await this.prisma.orderPhoto.findUnique({
      where: { token },
      include: { customer: { select: { name: true } } },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    return {
      customerName: photo.customer.name,
      imageUrl: `${API_PUBLIC_URL}${photo.imageUrl}`,
      caption: photo.caption,
      order: await this.getOrderSummary(photo),
    };
  }

  private async getOrderSummary(
    photo: { salesBillId: string | null; onlineOrderId: string | null },
  ): Promise<{ label: string; status: string; total: number; items: { name: string; qty: number }[] } | null> {
    if (photo.salesBillId) {
      const bill = await this.prisma.salesBill.findFirst({
        where: { id: photo.salesBillId },
        select: { id: true, billNumber: true, grandTotal: true, balanceAmount: true },
      });
      if (!bill) return null;
      const items = await this.prisma.salesItem.findMany({
        where: { billId: bill.id },
        select: { productName: true, quantity: true },
      });
      return {
        label: `Bill ${bill.billNumber ?? bill.id}`,
        status: Number(bill.balanceAmount) > 0 ? 'Balance due' : 'Paid',
        total: Number(bill.grandTotal),
        items: items.map(i => ({ name: i.productName, qty: Number(i.quantity) })),
      };
    }
    if (photo.onlineOrderId) {
      const onlineOrder = await this.prisma.onlineOrder.findFirst({
        where: { id: photo.onlineOrderId },
        select: { id: true, orderNumber: true, status: true, total: true },
      });
      if (!onlineOrder) return null;
      const items = await this.prisma.onlineOrderItem.findMany({
        where: { orderId: onlineOrder.id },
        select: { productName: true, quantity: true },
      });
      return {
        label: `Order ${onlineOrder.orderNumber}`,
        status: onlineOrder.status,
        total: Number(onlineOrder.total),
        items: items.map(i => ({ name: i.productName, qty: i.quantity })),
      };
    }
    return null;
  }

  /** Looks up a photo by its short Ref: code — used by the auto-reply branch. Scoped to businessId so one business can't fish another's tokens. */
  async findByRefCode(businessId: string, refCode: string) {
    return this.prisma.orderPhoto.findFirst({
      where: { businessId, token: refCode.toUpperCase() },
    });
  }

  /**
   * Sends the actual "view your order" reply: the photo itself, an optional
   * one-line order summary, then a follow-up menu (History Link / Send New
   * Order / Talk to Staff, plus a plain-text storefront link — WhatsApp's
   * non-template interactive messages only support reply buttons, not
   * clickable URL buttons). Called from the webhook controller once it's
   * matched an inbound message's Ref: code to this photo.
   */
  async sendPhotoReply(businessId: string, phone: string, photo: {
    id: string; imageUrl: string; caption: string | null;
    salesBillId: string | null; onlineOrderId: string | null;
  }): Promise<void> {
    const publicImageUrl = `${API_PUBLIC_URL}${photo.imageUrl}`;
    await this.wa.sendImageByLink(businessId, phone, publicImageUrl, {
      caption: photo.caption ?? undefined,
      isAutoReply: true,
      relatedType: 'ORDER_PHOTO',
      relatedId: photo.id,
    });

    const order = await this.getOrderSummary(photo);
    if (order) {
      const itemsLine = order.items.length
        ? ` — ${order.items.length} item${order.items.length === 1 ? '' : 's'}`
        : '';
      await this.wa.sendTextMessage(businessId, phone, `${order.label}${itemsLine}, ₹${order.total.toFixed(0)}. ${order.status}!`);
    }

    const shopUrl = process.env.SHOP_URL ?? 'https://shop.srivani.com';
    await this.wa.sendInteractiveList(
      businessId, phone,
      `What else can I help with? Visit us: ${shopUrl}`,
      'Choose an option',
      [{
        title: 'More options',
        rows: [
          { id: 'WA_HISTORY_LINK', title: 'History Link', description: 'See your full order history' },
          { id: 'WA_REORDER', title: 'Send New Order', description: 'Reorder your usual items' },
          { id: 'WA_TALK_STAFF', title: 'Talk to Staff', description: 'Chat with our team' },
        ],
      }],
      { relatedType: 'ORDER_PHOTO', relatedId: photo.id },
    );
  }
}

// Bilingual (Telugu + English), following the exact precedent already set by
// history.service.ts's buildMessage() — hardcoded per-business wording isn't
// runtime-configurable there either, so this isn't a new inconsistency. A
// business-configurable template would be a reasonable fast-follow if this
// platform ever serves a non-Telugu-speaking retailer.

/** The text pre-filled in the CUSTOMER's WhatsApp box when they tap the wa.me link — must always carry a parseable "Ref: <token>". */
function buildCustomerRefMessage(businessName: string, token: string): string {
  return `నమస్తే ${businessName}! 👋
మీ ఆర్డర్ ఫోటో చూడాలంటే ఈ మెసేజ్ పంపండి 📦
Hi! Sending this message shows me my order photo instantly ✨
Ref: ${token}`;
}

/** The full block STAFF copy and send via their own personal WhatsApp — greeting, reason to tap, the link, sign-off. */
function buildStaffShareMessage(customerName: string, waLink: string, businessName: string): string {
  return `🛍️ ${customerName} గారు, నమస్తే!
మీ ఆర్డర్ సిద్ధంగా ఉంది! 📦✨
Your order is ready!

మీ ఆర్డర్ ఫోటో చూడటానికి కింద నొక్కండి 👇
Tap below to view your order photo 👇

${waLink}

— ${businessName} 🙏`;
}
