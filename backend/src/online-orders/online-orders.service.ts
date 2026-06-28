import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { Events } from '../events/event-types';
import {
  CreateOrderDto,
  DeliveryType,
  PaymentMethod,
} from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import {
  Prisma,
  OnlineOrderStatus,
  OnlinePaymentStatus,
} from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

const DELIVERY_FEE = 40;
const FREE_DELIVERY_ABOVE = 500;

@Injectable()
export class OnlineOrdersService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly rzp: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly auditLog: AuditLogService,
    private readonly whatsapp: WhatsAppService,
  ) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.rzp =
      keyId && keySecret
        ? new Razorpay({ key_id: keyId, key_secret: keySecret })
        : null;
  }

  private async getBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  private calcDeliveryFee(subtotal: number, deliveryType: DeliveryType): number {
    if (deliveryType === DeliveryType.STORE_PICKUP) return 0;
    return subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  }

  private async generateOrderNumber(businessId: string): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    const count = await this.prisma.onlineOrder.count({
      where: {
        businessId,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    });

    const seq = String(count + 1).padStart(4, '0');
    return `SVN-${dateStr}-${seq}`;
  }

  async createOrder(dto: CreateOrderDto) {
    if (dto.deliveryType === DeliveryType.HOME_DELIVERY && !dto.deliveryAddress) {
      throw new BadRequestException('Delivery address is required for home delivery');
    }
    if (!dto.items.length) {
      throw new BadRequestException('Order must have at least one item');
    }
    if (dto.paymentMethod === PaymentMethod.RAZORPAY && !this.rzp) {
      throw new BadRequestException('Online payment is not configured');
    }

    const businessId = await this.getBusinessId();
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const deliveryFee = this.calcDeliveryFee(subtotal, dto.deliveryType);
    const total = subtotal + deliveryFee;
    const orderNumber = await this.generateOrderNumber(businessId);

    let razorpayOrderId: string | undefined;
    if (dto.paymentMethod === PaymentMethod.RAZORPAY && this.rzp) {
      const rzpOrder = await this.rzp.orders.create({
        amount: Math.round(total * 100),
        currency: 'INR',
        receipt: orderNumber,
        notes: {
          customerPhone: dto.customerPhone,
          orderNumber,
        },
      });
      razorpayOrderId = rzpOrder.id as string;
    }

    const initialStatus: OnlineOrderStatus =
      dto.paymentMethod === PaymentMethod.COD
        ? OnlineOrderStatus.PENDING_COD
        : OnlineOrderStatus.PENDING_PAYMENT;

    await this.prisma.onlineOrder.create({
      data: {
        orderNumber,
        businessId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail ?? null,
        deliveryType: dto.deliveryType,
        deliveryAddress: dto.deliveryAddress
          ? JSON.parse(JSON.stringify(dto.deliveryAddress))
          : undefined,
        paymentMethod: dto.paymentMethod,
        paymentStatus: OnlinePaymentStatus.PENDING,
        status: initialStatus,
        razorpayOrderId: razorpayOrderId ?? null,
        subtotal,
        deliveryFee,
        total,
        customerNotes: dto.customerNotes ?? null,
        items: {
          create: dto.items.map((item) => ({
            pluBarcode: item.pluBarcode,
            productCode: item.productCode,
            productName: item.productName,
            packLabel: item.packLabel,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
            mrp: item.mrp ?? null,
          })),
        },
      },
    });

    // Audit
    this.auditLog.log(
      { userName: dto.customerName, userRole: 'CUSTOMER', businessId },
      { action: 'CREATE', entity: 'ONLINE_ORDER', entityRef: orderNumber, description: `Online order placed by ${dto.customerName} (${dto.customerPhone}) — ₹${total} via ${dto.paymentMethod}` },
    ).catch(() => {});

    // WhatsApp: alert store
    this.whatsapp.sendOrderAlert({
      orderNumber,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      total,
      paymentMethod: dto.paymentMethod,
      deliveryType: dto.deliveryType,
      itemCount: dto.items.length,
    }).catch(() => {});

    // WhatsApp: confirm to customer (COD only — Razorpay sends after payment verified)
    if (dto.paymentMethod === PaymentMethod.COD) {
      this.whatsapp.sendCustomerOrderPlaced({
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        orderNumber,
        total,
        deliveryType: dto.deliveryType,
      }).catch(() => {});
    }

    // Notify ERP staff in real time
    this.events.emitToBusiness(businessId, Events.ONLINE_ORDER_PLACED, {
      orderNumber,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      total,
      paymentMethod: dto.paymentMethod,
      deliveryType: dto.deliveryType,
      itemCount: dto.items.length,
    });

    return {
      orderNumber,
      razorpayOrderId,
      razorpayKeyId:
        dto.paymentMethod === PaymentMethod.RAZORPAY
          ? process.env.RAZORPAY_KEY_ID
          : undefined,
      total,
      deliveryFee,
      subtotal,
      paymentMethod: dto.paymentMethod,
    };
  }

  async verifyPayment(dto: VerifyPaymentDto) {
    const order = await this.prisma.onlineOrder.findFirst({
      where: { razorpayOrderId: dto.razorpayOrderId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new BadRequestException('Payment verification not configured');

    const body = `${dto.razorpayOrderId}|${dto.razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== dto.razorpaySignature) {
      await this.prisma.onlineOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: OnlinePaymentStatus.FAILED,
          status: OnlineOrderStatus.PAYMENT_FAILED,
        },
      });
      throw new BadRequestException('Payment signature verification failed');
    }

    const updated = await this.prisma.onlineOrder.update({
      where: { id: order.id },
      data: {
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
        paymentStatus: OnlinePaymentStatus.PAID,
        status: OnlineOrderStatus.CONFIRMED,
      },
    });

    // WhatsApp: payment confirmed to customer
    this.whatsapp.sendCustomerPaymentConfirmed({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderNumber: updated.orderNumber,
      total: Number(order.total),
    }).catch(() => {});

    return { success: true, orderNumber: updated.orderNumber };
  }

  async getOrder(orderNumber: string) {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listOrders(phone?: string, email?: string) {
    if (!phone && !email) return [];
    const businessId = await this.getBusinessId();

    const conditions: Prisma.OnlineOrderWhereInput[] = [];
    if (phone) conditions.push({ customerPhone: phone });
    if (email) conditions.push({ customerEmail: email });

    return this.prisma.onlineOrder.findMany({
      where: { businessId, OR: conditions },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Manual re-send: staff triggers this when customer says they didn't get a message
  async notifyCustomer(orderNumber: string): Promise<{ sent: boolean; to: string | null }> {
    const order = await this.prisma.onlineOrder.findUnique({ where: { orderNumber } });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.customerPhone) return { sent: false, to: null };

    await this.whatsapp.sendCustomerOrderUpdate({
      customerName:  order.customerName,
      customerPhone: order.customerPhone,
      orderNumber,
      status:        order.status,
      deliveryType:  order.deliveryType,
    });

    return { sent: true, to: order.customerPhone };
  }

  async listAllOrders(status?: string, date?: string, search?: string, dateFrom?: string, dateTo?: string) {
    const businessId = await this.getBusinessId();
    const where: Prisma.OnlineOrderWhereInput = { businessId };

    if (status && status !== 'ALL') {
      where.status = status as OnlineOrderStatus;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo   ? { lt:  new Date(new Date(dateTo).getTime() + 86400000) } : {}),
      };
    } else if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }

    if (search) {
      const s = search.trim();
      where.OR = [
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s } },
        { customerName: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.onlineOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async cancelOrder(orderNumber: string, reason?: string) {
    const order = await this.prisma.onlineOrder.findUnique({ where: { orderNumber } });
    if (!order) throw new NotFoundException('Order not found');

    const cancellable: OnlineOrderStatus[] = [
      OnlineOrderStatus.PENDING_PAYMENT,
      OnlineOrderStatus.PENDING_COD,
      OnlineOrderStatus.CONFIRMED,
    ];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled once it is ${order.status.toLowerCase().replace(/_/g, ' ')}`,
      );
    }

    await this.prisma.onlineOrder.update({
      where: { orderNumber },
      data: { status: OnlineOrderStatus.CANCELLED },
    });

    if (order.customerPhone) {
      this.whatsapp.sendCustomerOrderUpdate({
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderNumber,
        status: 'CANCELLED',
        deliveryType: order.deliveryType,
      }).catch(() => {});
    }

    this.events.emitToBusiness(order.businessId, Events.ONLINE_ORDER_STATUS_CHANGED, {
      orderNumber,
      status: 'CANCELLED',
      customerName: order.customerName,
    });

    this.auditLog.log(
      { userName: order.customerName, userRole: 'CUSTOMER', businessId: order.businessId },
      { action: 'CANCEL', entity: 'ONLINE_ORDER', entityId: order.id, entityRef: orderNumber, description: `Order ${orderNumber} cancelled by customer${reason ? `: ${reason}` : ''}` },
    ).catch(() => {});

    return { success: true, orderNumber };
  }

  async updateOrderStatus(orderNumber: string, status: OnlineOrderStatus, actor?: { userId: string; userName: string; userRole: string }) {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { orderNumber },
    });
    if (!order) throw new NotFoundException('Order not found');

    const data: Prisma.OnlineOrderUpdateInput = { status };

    if (
      status === OnlineOrderStatus.DELIVERED &&
      order.paymentMethod === 'COD'
    ) {
      data.paymentStatus = OnlinePaymentStatus.PAID;
    }

    const updated = await this.prisma.onlineOrder.update({
      where: { orderNumber },
      data,
      include: { items: true },
    });

    this.events.emitToBusiness(order.businessId, Events.ONLINE_ORDER_STATUS_CHANGED, {
      orderNumber,
      status,
      customerName: order.customerName,
    });

    // WhatsApp: status update to customer
    if (order.customerPhone) {
      this.whatsapp.sendCustomerOrderUpdate({
        customerName:  order.customerName,
        customerPhone: order.customerPhone,
        orderNumber,
        status,
        deliveryType:  order.deliveryType,
      }).catch(() => {});
    }

    if (actor) {
      this.auditLog.log(
        { ...actor, businessId: order.businessId },
        { action: 'STATUS_CHANGE', entity: 'ONLINE_ORDER', entityId: order.id, entityRef: orderNumber, description: `Online order ${orderNumber} status changed to ${status} by ${actor.userName}` },
      ).catch(() => {});
    }

    return updated;
  }
}
