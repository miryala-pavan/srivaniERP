import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { EmailService } from '../notifications/email.service';
import { ServiceablePincodesService } from '../serviceable-pincodes/serviceable-pincodes.service';
import { Events } from '../events/event-types';
import { lockPluById } from '../common/helpers/stock-lock.util';
import {
  CreateOrderDto,
  DeliveryType,
  PaymentMethod,
} from './dto/create-order.dto';
import { WhatsAppCheckoutDto } from './dto/whatsapp-checkout.dto';
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
  private readonly logger = new Logger(OnlineOrdersService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly rzp: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly auditLog: AuditLogService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly serviceablePincodes: ServiceablePincodesService,
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

  // Two concurrent orders on the same day can compute the same count-based
  // sequence and race for the same orderNumber; the unique constraint
  // catches it as P2002, and we regenerate + retry rather than 500ing.
  private isOrderNumberConflict(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      Array.isArray((err.meta as { target?: string[] })?.target) &&
      (err.meta as { target: string[] }).target.includes('orderNumber')
    );
  }

  /**
   * Resolves the SERVER's authoritative price for each item — never trusts
   * the client-submitted unitPrice/mrp (a modified request could set these
   * to anything, e.g. ₹0.01 for a real product). Starts from the PLU's
   * real onlinePrice, falling back to sellingPrice — matching
   * shop.service.ts's own display logic exactly, so what the customer saw
   * is what they're charged — then applies volume-pricing tiers on top if
   * the ordered quantity qualifies. Also enforces that the pack's parent
   * Product is still for sale (a PLU can be individually active while its
   * product is delisted). Throws PACK_UNAVAILABLE before any payment is
   * collected, not just at final stock reservation.
   */
  private async resolveAuthoritativePrices<
    T extends { pluBarcode: string; productName: string; packLabel: string; quantity: number },
  >(businessId: string, items: T[]): Promise<(T & { unitPrice: number; mrp: number | null })[]> {
    const pluBarcodes = items.map((i) => i.pluBarcode);

    const plus = await this.prisma.productPlu.findMany({
      where: {
        businessId,
        pluCode: { in: pluBarcodes },
        isActive: true,
        product: { isActive: true, isForSale: true },
      },
      select: { pluCode: true, sellingPrice: true, onlinePrice: true, mrp: true },
    });
    const plusByBarcode = new Map(plus.map((p) => [p.pluCode, p]));

    const volTiers = await this.prisma.volumePricingTier.findMany({
      where: { businessId, pluBarcode: { in: pluBarcodes } },
      orderBy: { minQty: 'asc' },
      select: { pluBarcode: true, minQty: true, price: true },
    });
    const tiersByPlu = new Map<string, { minQty: number; price: number }[]>();
    for (const t of volTiers) {
      const arr = tiersByPlu.get(t.pluBarcode) ?? [];
      arr.push({ minQty: t.minQty, price: Number(t.price) });
      tiersByPlu.set(t.pluBarcode, arr);
    }

    return items.map((item) => {
      const plu = plusByBarcode.get(item.pluBarcode);
      if (!plu) {
        throw new BadRequestException({
          error: 'PACK_UNAVAILABLE',
          productName: item.productName,
          packLabel: item.packLabel,
          message: `${item.productName} (${item.packLabel}) is no longer available. Please remove it from your cart.`,
        });
      }

      let effectivePrice = Number(plu.onlinePrice ?? plu.sellingPrice);
      const tiers = tiersByPlu.get(item.pluBarcode) ?? [];
      for (const t of tiers) {
        if (item.quantity >= t.minQty) effectivePrice = t.price;
      }

      return {
        ...item,
        unitPrice: effectivePrice,
        mrp: plu.mrp !== null && plu.mrp !== undefined ? Number(plu.mrp) : null,
      };
    });
  }

  /**
   * Row-locks and validates stock for each item inside the caller's
   * transaction, decrementing stockOnHand immediately (stock is reserved
   * at order creation, not at payment confirmation, to avoid overselling
   * in the gap before Razorpay payment completes). Throws
   * BadRequestException — rolling back the whole transaction, including
   * any earlier items' decrements for this same order — if a pack no
   * longer exists or doesn't have enough stock. The lock via lockPluById
   * means a concurrent request for the same pack blocks until this
   * transaction commits or rolls back, then re-reads the current stock,
   * so two customers can't both succeed for the last unit.
   */
  private async reserveStockForItems<
    T extends { pluBarcode: string; productName: string; packLabel: string; quantity: number },
  >(tx: Prisma.TransactionClient, businessId: string, items: T[]): Promise<(T & { pluId: string })[]> {
    const resolved: (T & { pluId: string })[] = [];
    for (const item of items) {
      const plu = await tx.productPlu.findFirst({
        where: { businessId, pluCode: item.pluBarcode, isActive: true },
        select: { id: true, onlineStockCap: true },
      });
      if (!plu) {
        throw new BadRequestException({
          error: 'PACK_UNAVAILABLE',
          productName: item.productName,
          packLabel: item.packLabel,
          message: `${item.productName} (${item.packLabel}) is no longer available. Please remove it from your cart.`,
        });
      }

      const locked = await lockPluById(tx, plu.id);
      if (!locked) {
        throw new BadRequestException({
          error: 'PACK_UNAVAILABLE',
          productName: item.productName,
          packLabel: item.packLabel,
          message: `${item.productName} (${item.packLabel}) is no longer available. Please remove it from your cart.`,
        });
      }

      // availableQty mirrors shop.service.ts's own online-availability calc:
      // this pack's real stock, capped by onlineStockCap if the merchant set one.
      const availableOnline = Math.min(locked.stockOnHand, plu.onlineStockCap ?? locked.stockOnHand);
      if (availableOnline < item.quantity) {
        throw new BadRequestException({
          error: 'INSUFFICIENT_STOCK',
          productName: item.productName,
          packLabel: item.packLabel,
          currentStock: availableOnline,
          requestedQty: item.quantity,
          message: `Only ${availableOnline} of ${item.productName} (${item.packLabel}) available — you requested ${item.quantity}. Please adjust your cart and try again.`,
        });
      }

      await tx.productPlu.update({
        where: { id: plu.id },
        data: { stockOnHand: { decrement: item.quantity } },
      });

      resolved.push({ ...item, pluId: plu.id });
    }
    return resolved;
  }

  /** Restores stock reserved at order creation. Called on cancellation or payment failure. */
  private async releaseStockForOrder(tx: Prisma.TransactionClient, orderId: string) {
    const items = await tx.onlineOrderItem.findMany({
      where: { orderId, pluId: { not: null } },
      select: { pluId: true, quantity: true },
    });
    for (const item of items) {
      if (!item.pluId) continue;
      await tx.productPlu.update({
        where: { id: item.pluId },
        data: { stockOnHand: { increment: item.quantity } },
      });
    }
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

    if (dto.deliveryType === DeliveryType.HOME_DELIVERY && dto.deliveryAddress) {
      const serviceable = await this.serviceablePincodes.isServiceable(businessId, dto.deliveryAddress.pincode);
      if (!serviceable) {
        throw new BadRequestException(`Sorry, we don't currently deliver to pincode ${dto.deliveryAddress.pincode}. Please choose store pickup instead.`);
      }
    }

    // Never trust client-submitted prices — resolve from the actual PLU record.
    const resolvedItems = await this.resolveAuthoritativePrices(businessId, dto.items);

    const subtotal = resolvedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    const deliveryFee = this.calcDeliveryFee(subtotal, dto.deliveryType);
    const total = subtotal + deliveryFee;
    let orderNumber = await this.generateOrderNumber(businessId);

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

    // Stock is reserved (decremented) immediately here, inside the same
    // transaction as the order write — even for Razorpay orders, before
    // payment is confirmed — to avoid overselling in the checkout gap.
    // Reserved stock is released again on cancellation or payment failure
    // (see releaseStockForOrder, called from cancelOrder/verifyPayment).
    for (let attempt = 1; ; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const itemsWithPlu = await this.reserveStockForItems(tx, businessId, resolvedItems);

          await tx.onlineOrder.create({
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
              deliverySlot: dto.deliverySlot ?? null,
              paymentMethod: dto.paymentMethod,
              paymentStatus: OnlinePaymentStatus.PENDING,
              status: initialStatus,
              razorpayOrderId: razorpayOrderId ?? null,
              subtotal,
              deliveryFee,
              total,
              customerNotes: dto.customerNotes ?? null,
              items: {
                create: itemsWithPlu.map((item) => ({
                  pluId: item.pluId,
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
        }, { timeout: 15000 });
        break;
      } catch (err) {
        if (attempt < 3 && this.isOrderNumberConflict(err)) {
          orderNumber = await this.generateOrderNumber(businessId);
          continue;
        }
        throw err;
      }
    }

    // Universal customer record — fire-and-forget so checkout is never blocked
    this.upsertCustomer(businessId, dto.customerPhone, dto.customerName, dto.customerEmail)
      .catch(err => this.logger.warn(`Customer upsert failed for order ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    // Audit
    this.auditLog.log(
      { userName: dto.customerName, userRole: 'CUSTOMER', businessId },
      { action: 'CREATE', entity: 'ONLINE_ORDER', entityRef: orderNumber, description: `Online order placed by ${dto.customerName} (${dto.customerPhone}) — ₹${total} via ${dto.paymentMethod}` },
    ).catch((err) => this.logger.error(`Audit log failed for order ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    // WhatsApp: alert store — logged loudly on failure, since a silent
    // failure here means staff never learn an order came in at all.
    this.whatsapp.sendOrderAlert(businessId, {
      orderNumber,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      total,
      paymentMethod: dto.paymentMethod,
      deliveryType: dto.deliveryType,
      itemCount: resolvedItems.length,
    }).catch((err) => this.logger.error(`Store order-alert WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    // WhatsApp + email: confirm to customer (COD only — Razorpay sends after payment verified)
    if (dto.paymentMethod === PaymentMethod.COD) {
      this.whatsapp.sendCustomerOrderPlaced(businessId, {
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        orderNumber,
        total,
        deliveryType: dto.deliveryType,
      }).catch((err) => this.logger.error(`Customer order-placed WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

      if (dto.customerEmail) {
        this.email.sendOrderPlaced({
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          orderNumber,
          paymentMethod: dto.paymentMethod,
          deliveryType: dto.deliveryType,
          subtotal,
          deliveryFee,
          total,
          items: resolvedItems.map(i => ({
            productName: i.productName,
            packLabel:   i.packLabel,
            quantity:    i.quantity,
            unitPrice:   i.unitPrice,
            total:       i.unitPrice * i.quantity,
          })),
        }).catch((err) => this.logger.error(`Order-placed email failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
      }
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
      // Release stock reserved at createOrder() time — skip if this order
      // already failed before (repeated failed-verify retries shouldn't
      // double-release the same stock back).
      if (order.status !== OnlineOrderStatus.PAYMENT_FAILED) {
        await this.prisma.$transaction(async (tx) => {
          await this.releaseStockForOrder(tx, order.id);
          await tx.onlineOrder.update({
            where: { id: order.id },
            data: {
              paymentStatus: OnlinePaymentStatus.FAILED,
              status: OnlineOrderStatus.PAYMENT_FAILED,
            },
          });
        }, { timeout: 15000 });

        // Customer was never told otherwise — let them know so they know to retry.
        if (order.customerPhone) {
          this.whatsapp.sendCustomerOrderUpdate(order.businessId, {
            customerName:  order.customerName,
            customerPhone: order.customerPhone,
            orderNumber:   order.orderNumber,
            status: 'PAYMENT_FAILED',
            deliveryType: order.deliveryType,
          }).catch((err) => this.logger.error(`Payment-failed WhatsApp failed for ${order.orderNumber}: ${err instanceof Error ? err.message : err}`));
        }
        if (order.customerEmail) {
          this.email.sendStatusUpdate({
            customerName:  order.customerName,
            customerEmail: order.customerEmail,
            orderNumber:   order.orderNumber,
            status: 'PAYMENT_FAILED',
            deliveryType: order.deliveryType,
          }).catch((err) => this.logger.error(`Payment-failed email failed for ${order.orderNumber}: ${err instanceof Error ? err.message : err}`));
        }
      }
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

    // WhatsApp + email: payment confirmed to customer
    this.whatsapp.sendCustomerPaymentConfirmed(order.businessId, {
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderNumber: updated.orderNumber,
      total: Number(order.total),
    }).catch((err) => this.logger.error(`Payment-confirmed WhatsApp failed for ${updated.orderNumber}: ${err instanceof Error ? err.message : err}`));

    if (order.customerEmail) {
      this.email.sendPaymentConfirmed({
        customerName:  order.customerName,
        customerEmail: order.customerEmail,
        orderNumber:   updated.orderNumber,
        total:         Number(order.total),
      }).catch((err) => this.logger.error(`Payment-confirmed email failed for ${updated.orderNumber}: ${err instanceof Error ? err.message : err}`));
    }

    return { success: true, orderNumber: updated.orderNumber };
  }

  async retryPayment(orderNumber: string, customerPhone: string) {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order || !this.samePhone(order.customerPhone, customerPhone)) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OnlineOrderStatus.PAYMENT_FAILED) {
      throw new BadRequestException('Only orders with failed payment can be retried');
    }
    if (!this.rzp) throw new BadRequestException('Online payment is not configured');

    // Stock was released when this order's payment failed (see
    // verifyPayment) — re-reserve it before letting the customer pay
    // again, mirroring createOrder(); throws INSUFFICIENT_STOCK if
    // something sold out in the meantime.
    //
    // Row-locks the order itself first (matching lockPluById's FOR UPDATE
    // pattern): a second concurrent retryPayment call for the same order
    // blocks here until this transaction commits, then re-reads status as
    // PENDING_PAYMENT (set at the end of this block) instead of
    // PAYMENT_FAILED — correctly rejected instead of double-reserving the
    // same stock, which the unlocked check above alone can't prevent.
    await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM "online_order" WHERE id = ${order.id} FOR UPDATE
      `;
      if (!lockedRows.length || lockedRows[0].status !== OnlineOrderStatus.PAYMENT_FAILED) {
        throw new BadRequestException('Only orders with failed payment can be retried');
      }

      const itemsWithPlu = await this.reserveStockForItems(
        tx,
        order.businessId,
        order.items.map((i) => ({
          pluBarcode: i.pluBarcode,
          productName: i.productName,
          packLabel: i.packLabel,
          quantity: i.quantity,
        })),
      );
      for (let idx = 0; idx < order.items.length; idx++) {
        await tx.onlineOrderItem.update({
          where: { id: order.items[idx].id },
          data: { pluId: itemsWithPlu[idx].pluId },
        });
      }

      await tx.onlineOrder.update({
        where: { id: order.id },
        data: { status: OnlineOrderStatus.PENDING_PAYMENT, paymentStatus: OnlinePaymentStatus.PENDING },
      });
    }, { timeout: 15000 });

    const rzpOrder = await this.rzp.orders.create({
      amount: Math.round(Number(order.total) * 100),
      currency: 'INR',
      receipt: orderNumber,
      notes: { customerPhone: order.customerPhone, orderNumber },
    });

    await this.prisma.onlineOrder.update({
      where: { id: order.id },
      data: { razorpayOrderId: rzpOrder.id as string },
    });

    return {
      orderNumber,
      razorpayOrderId: rzpOrder.id as string,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
      total: Number(order.total),
    };
  }

  async whatsappCheckout(dto: WhatsAppCheckoutDto) {
    if (!dto.items.length) {
      throw new BadRequestException('Order must have at least one item');
    }

    const businessId = await this.getBusinessId();

    // Never trust client-submitted prices — resolve from the actual PLU record.
    const resolvedItems = await this.resolveAuthoritativePrices(businessId, dto.items);

    const subtotal = resolvedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const deliveryFee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
    const total = subtotal + deliveryFee;
    let orderNumber = await this.generateOrderNumber(businessId);

    const notes = [
      dto.customerNotes,
      'Delivery details to be confirmed via WhatsApp',
    ].filter(Boolean).join(' · ');

    for (let attempt = 1; ; attempt++) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const itemsWithPlu = await this.reserveStockForItems(tx, businessId, resolvedItems);

          await tx.onlineOrder.create({
            data: {
              orderNumber,
              businessId,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              customerEmail: dto.customerEmail ?? null,
              deliveryType: DeliveryType.STORE_PICKUP,
              paymentMethod: PaymentMethod.COD,
              paymentStatus: OnlinePaymentStatus.PENDING,
              status: OnlineOrderStatus.PENDING_COD,
              source: 'WHATSAPP',
              subtotal,
              deliveryFee,
              total,
              customerNotes: notes,
              items: {
                create: itemsWithPlu.map(item => ({
                  pluId: item.pluId,
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
        }, { timeout: 15000 });
        break;
      } catch (err) {
        if (attempt < 3 && this.isOrderNumberConflict(err)) {
          orderNumber = await this.generateOrderNumber(businessId);
          continue;
        }
        throw err;
      }
    }

    this.upsertCustomer(businessId, dto.customerPhone, dto.customerName, dto.customerEmail)
      .catch(err => this.logger.warn(`Customer upsert failed for WA order ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    this.auditLog.log(
      { userName: dto.customerName, userRole: 'CUSTOMER', businessId },
      { action: 'CREATE', entity: 'ONLINE_ORDER', entityRef: orderNumber, description: `WhatsApp order by ${dto.customerName} (${dto.customerPhone}) — ₹${total}` },
    ).catch((err) => this.logger.error(`Audit log failed for WhatsApp order ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    this.whatsapp.sendOrderAlert(businessId, {
      orderNumber,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      total,
      paymentMethod: PaymentMethod.COD,
      deliveryType: DeliveryType.STORE_PICKUP,
      itemCount: resolvedItems.length,
    }).catch((err) => this.logger.error(`Store order-alert WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    this.events.emitToBusiness(businessId, Events.ONLINE_ORDER_PLACED, {
      orderNumber,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      total,
      paymentMethod: PaymentMethod.COD,
      deliveryType: DeliveryType.STORE_PICKUP,
      itemCount: resolvedItems.length,
    });

    return { orderNumber, total };
  }

  /**
   * Compares two phone numbers regardless of formatting (bare 10-digit,
   * 91-prefixed E.164, +91-prefixed, spaces/dashes) by comparing just the
   * last 10 digits — this codebase stores customer-facing phones in
   * different formats depending on the source (see e.g. Customer.phone
   * vs WaMessage.phone).
   */
  private samePhone(a: string, b: string): boolean {
    const norm = (p: string) => p.replace(/\D/g, '').slice(-10);
    return norm(a) === norm(b) && norm(a).length === 10;
  }

  /**
   * orderNumber alone is sequential and guessable (SVN-YYYYMMDD-0001,
   * -0002, ...) — customerPhone must also match the order's own phone
   * before any details are returned, or anyone who can count could read
   * every customer's name/phone/address by paging through order numbers.
   * Throws NotFoundException (not 403) on mismatch, so a wrong phone
   * doesn't confirm whether the order number itself exists.
   */
  async getOrder(orderNumber: string, customerPhone: string) {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order || !this.samePhone(order.customerPhone, customerPhone)) {
      throw new NotFoundException('Order not found');
    }
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

    await this.whatsapp.sendCustomerOrderUpdate(order.businessId, {
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

  async cancelOrder(orderNumber: string, customerPhone: string, reason?: string) {
    const order = await this.prisma.onlineOrder.findUnique({ where: { orderNumber } });
    if (!order || !this.samePhone(order.customerPhone, customerPhone)) {
      throw new NotFoundException('Order not found');
    }

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

    // Stock was reserved at order creation — give it back on cancellation.
    await this.prisma.$transaction(async (tx) => {
      await this.releaseStockForOrder(tx, order.id);
      await tx.onlineOrder.update({
        where: { orderNumber },
        data: { status: OnlineOrderStatus.CANCELLED },
      });
    }, { timeout: 15000 });

    if (order.customerPhone) {
      this.whatsapp.sendCustomerOrderUpdate(order.businessId, {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderNumber,
        status: 'CANCELLED',
        deliveryType: order.deliveryType,
      }).catch((err) => this.logger.error(`Cancellation WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
    }

    if (order.customerEmail) {
      this.email.sendStatusUpdate({
        customerName:  order.customerName,
        customerEmail: order.customerEmail,
        orderNumber,
        status:        'CANCELLED',
        deliveryType:  order.deliveryType,
      }).catch((err) => this.logger.error(`Cancellation email failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
    }

    this.events.emitToBusiness(order.businessId, Events.ONLINE_ORDER_STATUS_CHANGED, {
      orderNumber,
      status: 'CANCELLED',
      customerName: order.customerName,
    });

    this.auditLog.log(
      { userName: order.customerName, userRole: 'CUSTOMER', businessId: order.businessId },
      { action: 'CANCEL', entity: 'ONLINE_ORDER', entityId: order.id, entityRef: orderNumber, description: `Order ${orderNumber} cancelled by customer${reason ? `: ${reason}` : ''}` },
    ).catch((err) => this.logger.error(`Audit log failed for cancelled order ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    return { success: true, orderNumber };
  }

  async confirmDelivery(orderNumber: string, customerPhone: string) {
    const order = await this.prisma.onlineOrder.findUnique({ where: { orderNumber } });
    if (!order || !this.samePhone(order.customerPhone, customerPhone)) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OnlineOrderStatus.DELIVERED) {
      return { success: true, orderNumber, alreadyConfirmed: true };
    }

    if (order.status !== OnlineOrderStatus.READY) {
      throw new BadRequestException('Order is not currently out for delivery');
    }

    const data: Prisma.OnlineOrderUpdateInput = { status: OnlineOrderStatus.DELIVERED };
    if (order.paymentMethod === 'COD') {
      data.paymentStatus = OnlinePaymentStatus.PAID;
    }

    await this.prisma.onlineOrder.update({ where: { orderNumber }, data });

    this.events.emitToBusiness(order.businessId, Events.ONLINE_ORDER_STATUS_CHANGED, {
      orderNumber, status: 'DELIVERED', customerName: order.customerName,
    });

    if (order.customerEmail) {
      this.email.sendStatusUpdate({
        customerName:  order.customerName,
        customerEmail: order.customerEmail,
        orderNumber,
        status:        'DELIVERED',
        deliveryType:  order.deliveryType,
      }).catch((err) => this.logger.error(`Delivery-confirmed email failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
    }

    if (order.customerPhone) {
      this.whatsapp.sendDeliveryFeedbackRequest(order.businessId, {
        customerName: order.customerName, customerPhone: order.customerPhone, orderNumber,
      }).catch((err) => this.logger.error(`Delivery-feedback-request WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
    }

    this.auditLog.log(
      { userName: order.customerName, userRole: 'CUSTOMER', businessId: order.businessId },
      { action: 'STATUS_CHANGE', entity: 'ONLINE_ORDER', entityRef: orderNumber, description: `Order ${orderNumber} delivery confirmed by customer` },
    ).catch((err) => this.logger.error(`Audit log failed for delivered order ${orderNumber}: ${err instanceof Error ? err.message : err}`));

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

    // WhatsApp + email: status update to customer
    if (order.customerPhone) {
      this.whatsapp.sendCustomerOrderUpdate(order.businessId, {
        customerName:  order.customerName,
        customerPhone: order.customerPhone,
        orderNumber,
        status,
        deliveryType:  order.deliveryType,
      }).catch((err) => this.logger.error(`Status-update WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

      if (status === OnlineOrderStatus.DELIVERED) {
        this.whatsapp.sendDeliveryFeedbackRequest(order.businessId, {
          customerName: order.customerName, customerPhone: order.customerPhone, orderNumber,
        }).catch((err) => this.logger.error(`Delivery-feedback-request WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
      }
    }

    if (order.customerEmail) {
      if (status === OnlineOrderStatus.READY && order.deliveryType === 'HOME_DELIVERY') {
        this.email.sendDeliveryConfirmationRequest({
          customerName:  order.customerName,
          customerEmail: order.customerEmail,
          orderNumber,
        }).catch((err) => this.logger.error(`Delivery-confirmation-request email failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
      } else {
        this.email.sendStatusUpdate({
          customerName:  order.customerName,
          customerEmail: order.customerEmail,
          orderNumber,
          status,
          deliveryType:  order.deliveryType,
        }).catch((err) => this.logger.error(`Status-update email failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));
      }
    }

    if (actor) {
      this.auditLog.log(
        { ...actor, businessId: order.businessId },
        { action: 'STATUS_CHANGE', entity: 'ONLINE_ORDER', entityId: order.id, entityRef: orderNumber, description: `Online order ${orderNumber} status changed to ${status} by ${actor.userName}` },
      ).catch((err) => this.logger.error(`Audit log failed for status change on ${orderNumber}: ${err instanceof Error ? err.message : err}`));
    }

    return updated;
  }

  // ─── Universal customer upsert ────────────────────────────────────────────

  private normalizePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
    return null;
  }

  async upsertCustomer(businessId: string, rawPhone: string, name: string, email?: string | null): Promise<string | null> {
    const phone = this.normalizePhone(rawPhone);
    if (!phone) return null;

    const existing = await this.prisma.customer.findFirst({
      where: { businessId, phone },
      select: { id: true, channel: true, email: true },
    });

    if (existing) {
      const updates: Record<string, unknown> = {};
      if (existing.channel === 'POS') updates.channel = 'BOTH';
      if (!existing.email && email) updates.email = email;
      if (Object.keys(updates).length > 0) {
        await this.prisma.customer.update({ where: { id: existing.id }, data: updates });
      }
      return existing.id;
    }

    const cleanedName = name.trim().replace(/\s+/g, ' ') || `Customer ${phone}`;
    const customer = await this.prisma.customer.create({
      data: {
        businessId,
        name: cleanedName,
        phone,
        email: email || undefined,
        channel: 'ONLINE',
        status: 'ACTIVE',
        isActive: true,
        whatsappOptIn: false,
      },
      select: { id: true },
    });
    return customer.id;
  }
}
