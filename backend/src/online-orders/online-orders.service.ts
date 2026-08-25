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
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';
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
    private readonly wallet: WalletService,
    private readonly settings: SettingsService,
  ) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.rzp =
      keyId && keySecret
        ? new Razorpay({ key_id: keyId, key_secret: keySecret })
        : null;
  }

  /**
   * Hard server-side block on order creation when the storefront is in
   * catalogue mode — defense in depth alongside the UI hiding the buy
   * buttons, so a cached page or a direct API call can't sneak an order
   * through while pricing/ordering is meant to be switched off.
   */
  private async assertShoppingEnabled(businessId: string): Promise<void> {
    const { features } = await this.settings.getFeatures(businessId);
    if (features.catalogueModeEnabled) {
      throw new BadRequestException(
        'Ordering is temporarily unavailable — the store is currently in browse-only mode.',
      );
    }
  }

  private async getBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  /** Public preview of the same delivery-fee rule createOrder/whatsappCheckout charge — lets the WhatsApp quick-reorder flow show a fee before final confirmation without duplicating the ₹40/₹500 constants. */
  previewDeliveryFee(subtotal: number, deliveryType: DeliveryType): number {
    return this.calcDeliveryFee(subtotal, deliveryType);
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
    await this.assertShoppingEnabled(businessId);

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
        // Snapshot what was actually collected — order edits later compare
        // against this to settle differences into the customer's wallet.
        amountPaid: order.total,
      },
    });

    // WhatsApp + email: payment confirmed to customer
    this.whatsapp.sendCustomerPaymentConfirmed(order.businessId, {
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderNumber: updated.orderNumber,
      total: Number(order.total),
      paymentMethod: 'Razorpay',
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
    if (dto.deliveryType === DeliveryType.HOME_DELIVERY && !dto.deliveryAddress) {
      throw new BadRequestException('Delivery address is required for home delivery');
    }

    const businessId = await this.getBusinessId();
    await this.assertShoppingEnabled(businessId);

    if (dto.deliveryType === DeliveryType.HOME_DELIVERY && dto.deliveryAddress) {
      const serviceable = await this.serviceablePincodes.isServiceable(businessId, dto.deliveryAddress.pincode);
      if (!serviceable) {
        throw new BadRequestException(`Sorry, we don't currently deliver to pincode ${dto.deliveryAddress.pincode}. Please choose store pickup instead.`);
      }
    }

    // Never trust client-submitted prices — resolve from the actual PLU record.
    const resolvedItems = await this.resolveAuthoritativePrices(businessId, dto.items);

    const subtotal = resolvedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const deliveryFee = this.calcDeliveryFee(subtotal, dto.deliveryType);
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
              deliveryType: dto.deliveryType,
              deliveryAddress: dto.deliveryAddress
                ? JSON.parse(JSON.stringify(dto.deliveryAddress))
                : undefined,
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
      deliveryType: dto.deliveryType,
      itemCount: resolvedItems.length,
    }).catch((err) => this.logger.error(`Store order-alert WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    this.whatsapp.sendCustomerOrderPlaced(businessId, {
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      orderNumber,
      total,
      deliveryType: dto.deliveryType,
    }).catch((err) => this.logger.error(`Customer order-placed WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    this.events.emitToBusiness(businessId, Events.ONLINE_ORDER_PLACED, {
      orderNumber,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      total,
      paymentMethod: PaymentMethod.COD,
      deliveryType: dto.deliveryType,
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
    // Settlement lets the tracking page show "₹X credited to your wallet"
    // after a staff edit reduced a paid order's total, or the balance to
    // pay at delivery if items were added.
    return { ...order, settlement: this.computeSettlement(order) };
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
    // Paid orders (Razorpay, cancellable while CONFIRMED) also get their
    // money returned to the customer's store wallet.
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM "online_order" WHERE id = ${order.id} FOR UPDATE
      `;
      if (rows[0]?.status === OnlineOrderStatus.CANCELLED) {
        throw new BadRequestException('Order is already cancelled');
      }
      await this.releaseStockForOrder(tx, order.id);
      const settlement = await this.creditWalletOnCancel(tx, order);
      await tx.onlineOrder.update({
        where: { orderNumber },
        data: { status: OnlineOrderStatus.CANCELLED, ...settlement },
      });
      await this.logEvent(
        tx, order, 'STATUS_CHANGE',
        `Cancelled by customer${reason ? `: ${reason}` : ''}`,
      );
    }, { timeout: 20000 });

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

    this.prisma.onlineOrderEvent.create({
      data: {
        orderId: order.id, businessId: order.businessId,
        type: 'STATUS_CHANGE', description: 'Delivery confirmed by customer',
      },
    }).catch((err) => this.logger.error(`Order event log failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

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

  /**
   * On cancellation of a PAID order, returns the money still held (paid −
   * already wallet-credited) to the customer's store wallet — the store's
   * no-Razorpay-refund policy. Returns the field updates for the order row;
   * empty object when nothing was collected (COD / unpaid).
   */
  private async creditWalletOnCancel(
    tx: Prisma.TransactionClient,
    order: {
      id: string; businessId: string; orderNumber: string;
      customerPhone: string; customerName: string; customerEmail: string | null;
      paymentStatus: OnlinePaymentStatus;
      total: Prisma.Decimal | number;
      amountPaid: Prisma.Decimal | number;
      walletCredited: Prisma.Decimal | number;
    },
    actorName?: string,
  ): Promise<{ amountPaid?: number; walletCredited?: number }> {
    if (order.paymentStatus !== OnlinePaymentStatus.PAID) return {};

    let amountPaid = Number(order.amountPaid);
    if (amountPaid <= 0) amountPaid = Number(order.total); // pre-feature paid orders
    const netPaid = this.round2(amountPaid - Number(order.walletCredited));
    if (netPaid <= 0.009) return { amountPaid };

    const customerId = await this.upsertCustomer(
      order.businessId, order.customerPhone, order.customerName, order.customerEmail,
    );
    if (!customerId) {
      await this.logEvent(
        tx, order, 'NOTE',
        `Order cancelled but ₹${netPaid.toFixed(2)} could not be auto-credited — no customer record for this phone number. Settle manually.`,
        undefined, actorName,
      );
      return { amountPaid };
    }

    await this.wallet.creditTx(
      tx, order.businessId, customerId, netPaid,
      `Order ${order.orderNumber} cancelled — paid amount returned as store credit`,
      { relatedType: 'ONLINE_ORDER', relatedId: order.orderNumber, createdByName: actorName ?? 'System' },
    );
    await this.logEvent(
      tx, order, 'WALLET_CREDIT',
      `₹${netPaid.toFixed(2)} returned to customer's wallet (order cancelled after payment)`,
      { netPaid }, actorName,
    );
    return { amountPaid, walletCredited: this.round2(Number(order.walletCredited) + netPaid) };
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

    let updated;
    if (status === OnlineOrderStatus.CANCELLED) {
      // Cancellation must give the reserved stock back and settle any money
      // already collected — a bare status flip silently leaked both.
      if (order.status === OnlineOrderStatus.DELIVERED) {
        throw new BadRequestException('Delivered orders cannot be cancelled — record a return instead');
      }
      updated = await this.prisma.$transaction(async (tx) => {
        // Row-lock + re-check so two concurrent cancels can't double-release
        // stock or double-credit the wallet.
        const rows = await tx.$queryRaw<Array<{ status: string }>>`
          SELECT status FROM "online_order" WHERE id = ${order.id} FOR UPDATE
        `;
        const current = rows[0]?.status as OnlineOrderStatus | undefined;
        if (!current || current === OnlineOrderStatus.CANCELLED) {
          throw new BadRequestException('Order is already cancelled');
        }
        // PAYMENT_FAILED already released its stock in verifyPayment.
        if (current !== OnlineOrderStatus.PAYMENT_FAILED) {
          await this.releaseStockForOrder(tx, order.id);
        }
        const settlement = await this.creditWalletOnCancel(tx, order, actor?.userName);
        return tx.onlineOrder.update({
          where: { id: order.id },
          data: { ...data, ...settlement },
          include: { items: true },
        });
      }, { timeout: 20000 });
    } else {
      updated = await this.prisma.onlineOrder.update({
        where: { orderNumber },
        data,
        include: { items: true },
      });
    }

    // Timeline event — powers the status history in the admin detail view.
    this.prisma.onlineOrderEvent.create({
      data: {
        orderId: order.id,
        businessId: order.businessId,
        type: 'STATUS_CHANGE',
        description: `Status changed: ${order.status.replace(/_/g, ' ')} → ${status.replace(/_/g, ' ')}`,
        userName: actor?.userName,
      },
    }).catch((err) => this.logger.error(`Order event log failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

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

  // ─── Admin order detail + item editing ─────────────────────────────────────

  private static readonly EDITABLE_STATUSES: OnlineOrderStatus[] = [
    OnlineOrderStatus.PENDING_COD,
    OnlineOrderStatus.CONFIRMED,
    OnlineOrderStatus.PROCESSING,
    OnlineOrderStatus.READY,
  ];

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /**
   * Pack-level product search for the admin add-item flow — returns only
   * packs the storefront itself could sell (active, for-sale), priced the
   * way checkout would price them.
   */
  async searchPacksForAdmin(q: string) {
    if (!q?.trim()) return [];
    const businessId = await this.getBusinessId();
    const term = q.trim();

    const plus = await this.prisma.productPlu.findMany({
      where: {
        businessId,
        isActive: true,
        isArchived: false,
        product: { isActive: true, isForSale: true },
        OR: [
          { pluCode: { equals: term } },
          { eanCode: { equals: term } },
          { product: { name: { contains: term, mode: 'insensitive' } } },
          { product: { productCode: { contains: term } } },
        ],
      },
      take: 20,
      orderBy: { stockOnHand: 'desc' },
      include: { product: { select: { name: true, productCode: true } } },
    });

    return plus.map((p) => ({
      pluBarcode: p.pluCode,
      productName: p.product.name,
      packLabel:
        p.displayName ??
        (p.unitSize && p.unitSymbol ? `${Number(p.unitSize)}${p.unitSymbol}` : p.pluCode),
      price: Number(p.onlinePrice ?? p.sellingPrice),
      mrp: p.mrp !== null && p.mrp !== undefined ? Number(p.mrp) : null,
      stockOnHand: Number(p.stockOnHand),
    }));
  }

  /**
   * Payment reconciliation summary for an order. For paid orders created
   * before amountPaid existed, what was collected equals the current total
   * (they've never been edited).
   */
  private computeSettlement(order: {
    status: OnlineOrderStatus;
    paymentStatus: OnlinePaymentStatus;
    total: Prisma.Decimal | number;
    amountPaid: Prisma.Decimal | number;
    walletCredited: Prisma.Decimal | number;
  }) {
    const amountPaid =
      Number(order.amountPaid) > 0
        ? Number(order.amountPaid)
        : order.paymentStatus === OnlinePaymentStatus.PAID
          ? Number(order.total)
          : 0;
    const walletCredited = Number(order.walletCredited);
    const netPaid = this.round2(amountPaid - walletCredited);
    const dueAmount = Math.max(0, this.round2(Number(order.total) - Math.max(0, netPaid)));
    return {
      amountPaid,
      walletCredited,
      dueAmount,
      isEditable: OnlineOrdersService.EDITABLE_STATUSES.includes(order.status),
    };
  }

  /** Full order for the admin detail view: items, event timeline, settlement summary. */
  async getAdminOrder(orderNumber: string) {
    const order = await this.prisma.onlineOrder.findUnique({
      where: { orderNumber },
      include: {
        items: {
          orderBy: { id: 'asc' },
          include: {
            // Shelf location for the picking list — where each item lives in the store.
            plu: {
              select: {
                product: { select: { aisle: true, rackNumber: true, binCode: true, category: { select: { name: true } } } },
              },
            },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    return {
      ...order,
      items: order.items.map(({ plu, ...item }) => ({
        ...item,
        aisle: plu?.product?.aisle ?? null,
        rackNumber: plu?.product?.rackNumber ?? null,
        binCode: plu?.product?.binCode ?? null,
        category: plu?.product?.category?.name ?? null,
      })),
      settlement: this.computeSettlement(order),
    };
  }

  /** Staff assignment + delivery-slot changes, each logged to the timeline. */
  async updateOrderMeta(
    orderNumber: string,
    dto: { assignedToName?: string | null; deliverySlot?: string | null },
    actorName: string,
  ) {
    const order = await this.prisma.onlineOrder.findUnique({ where: { orderNumber } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OnlineOrderStatus.DELIVERED || order.status === OnlineOrderStatus.CANCELLED) {
      throw new BadRequestException('Delivered or cancelled orders cannot be changed');
    }

    const data: Prisma.OnlineOrderUpdateInput = {};
    const events: { type: string; description: string }[] = [];

    if (dto.assignedToName !== undefined && (dto.assignedToName ?? null) !== order.assignedToName) {
      data.assignedToName = dto.assignedToName?.trim() || null;
      events.push({
        type: 'ASSIGNED',
        description: data.assignedToName
          ? `Assigned to ${data.assignedToName}`
          : 'Assignment cleared',
      });
    }
    if (dto.deliverySlot !== undefined && (dto.deliverySlot ?? null) !== order.deliverySlot) {
      data.deliverySlot = dto.deliverySlot?.trim() || null;
      events.push({
        type: 'SLOT_CHANGED',
        description: data.deliverySlot
          ? `Delivery slot changed to "${data.deliverySlot}"${order.deliverySlot ? ` (was "${order.deliverySlot}")` : ''}`
          : 'Delivery slot cleared',
      });
    }

    if (events.length > 0) {
      await this.prisma.$transaction([
        this.prisma.onlineOrder.update({ where: { id: order.id }, data }),
        this.prisma.onlineOrderEvent.createMany({
          data: events.map((e) => ({
            orderId: order.id, businessId: order.businessId,
            type: e.type, description: e.description, userName: actorName,
          })),
        }),
      ]);
    }

    return this.getAdminOrder(orderNumber);
  }

  private async logEvent(
    tx: Prisma.TransactionClient,
    order: { id: string; businessId: string },
    type: string,
    description: string,
    meta?: Prisma.InputJsonValue,
    userName?: string,
  ) {
    await tx.onlineOrderEvent.create({
      data: { orderId: order.id, businessId: order.businessId, type, description, meta, userName },
    });
  }

  /**
   * Shared frame for every item edit: row-locks the order (serializing
   * concurrent edits), guards editable statuses, runs the mutation,
   * recomputes totals from the surviving items, and settles the payment
   * difference — for paid orders whose total went DOWN, the difference is
   * credited to the customer's store wallet (instead of a Razorpay refund);
   * if the total went UP, the admin view shows "collect ₹X at delivery".
   * Every step writes an OnlineOrderEvent row — financial records are never
   * silently mutated.
   */
  private async runOrderEdit(
    orderNumber: string,
    actorName: string,
    mutate: (
      tx: Prisma.TransactionClient,
      order: Prisma.OnlineOrderGetPayload<{ include: { items: true } }>,
    ) => Promise<void>,
  ) {
    const settled = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent edits of the same order (same FOR UPDATE
      // pattern as retryPayment) — two staff members editing at once
      // queue up instead of double-adjusting stock.
      await tx.$queryRaw`SELECT id FROM "online_order" WHERE "orderNumber" = ${orderNumber} FOR UPDATE`;

      const order = await tx.onlineOrder.findUnique({
        where: { orderNumber },
        include: { items: true },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (!OnlineOrdersService.EDITABLE_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          `Order cannot be edited while it is ${order.status.toLowerCase().replace(/_/g, ' ')}`,
        );
      }

      await mutate(tx, order);

      // Recompute totals from what's actually left on the order.
      const items = await tx.onlineOrderItem.findMany({ where: { orderId: order.id } });
      if (items.length === 0) {
        throw new BadRequestException(
          'An order must keep at least one item — cancel the order instead of removing everything.',
        );
      }
      const subtotal = this.round2(items.reduce((s, i) => s + Number(i.total), 0));
      const total = this.round2(subtotal + Number(order.deliveryFee));

      // Settle the payment difference for already-paid orders.
      let amountPaid = Number(order.amountPaid);
      let walletCredited = Number(order.walletCredited);
      let creditIssued = 0;
      if (order.paymentStatus === OnlinePaymentStatus.PAID) {
        // Lazy backfill for orders paid before amountPaid existed: what was
        // collected equals the pre-edit total.
        if (amountPaid <= 0) amountPaid = Number(order.total);

        const netPaid = this.round2(amountPaid - walletCredited);
        if (netPaid - total > 0.009) {
          creditIssued = this.round2(netPaid - total);
          const customerId = await this.upsertCustomer(
            order.businessId, order.customerPhone, order.customerName, order.customerEmail,
          );
          if (customerId) {
            await this.wallet.creditTx(
              tx, order.businessId, customerId, creditIssued,
              `Order ${order.orderNumber} edited — total reduced from what was paid`,
              { relatedType: 'ONLINE_ORDER', relatedId: order.orderNumber, createdByName: actorName },
            );
            walletCredited = this.round2(walletCredited + creditIssued);
            await this.logEvent(
              tx, order, 'WALLET_CREDIT',
              `₹${creditIssued.toFixed(2)} credited to customer's wallet (paid ₹${amountPaid.toFixed(2)}, new total ₹${total.toFixed(2)})`,
              { creditIssued, amountPaid, newTotal: total }, actorName,
            );
          } else {
            creditIssued = 0;
            await this.logEvent(
              tx, order, 'NOTE',
              'Wallet credit skipped — no customer record could be matched or created for this phone number',
              undefined, actorName,
            );
          }
        }
      }

      await tx.onlineOrder.update({
        where: { id: order.id },
        data: { subtotal, total, amountPaid, walletCredited },
      });

      return { order, total, creditIssued };
    }, { timeout: 20000 });

    // Tell the customer their order changed — fire-and-forget, template-based
    // so it works outside the 24h session window.
    this.notifyOrderEdited(settled.order, settled.total, settled.creditIssued)
      .catch((err) => this.logger.error(`Order-edited WhatsApp failed for ${orderNumber}: ${err instanceof Error ? err.message : err}`));

    this.events.emitToBusiness(settled.order.businessId, Events.ONLINE_ORDER_STATUS_CHANGED, {
      orderNumber,
      status: settled.order.status,
      customerName: settled.order.customerName,
    });

    return this.getAdminOrder(orderNumber);
  }

  private async notifyOrderEdited(
    order: { businessId: string; customerPhone: string; customerName: string; orderNumber: string },
    newTotal: number,
    creditIssued: number,
  ) {
    if (!order.customerPhone) return;
    let msg = `The store updated your order. New total: ₹${newTotal.toFixed(0)}.`;
    if (creditIssued > 0) {
      msg += ` ₹${creditIssued.toFixed(0)} has been credited to your store wallet — use it on your next purchase.`;
    }
    await this.whatsapp.sendTemplateToNumber(
      order.businessId, order.customerPhone, 'svn_order_update_v2', 'en',
      [order.customerName, order.orderNumber, msg],
      order.orderNumber,
    );
  }

  /**
   * Adds a product pack to the order (or bumps quantity if that pack is
   * already on it). Price is resolved server-side from the PLU — never
   * client-supplied — using the same online-price + volume-tier logic as
   * storefront checkout. Stock is reserved immediately.
   */
  async addOrderItem(
    orderNumber: string,
    dto: { pluBarcode: string; quantity: number },
    actorName: string,
  ) {
    return this.runOrderEdit(orderNumber, actorName, async (tx, order) => {
      const plu = await tx.productPlu.findFirst({
        where: {
          businessId: order.businessId,
          pluCode: dto.pluBarcode,
          isActive: true,
          product: { isActive: true, isForSale: true },
        },
        include: { product: { select: { name: true, productCode: true } } },
      });
      if (!plu) {
        throw new BadRequestException('This pack was not found or is not for sale — check the barcode/PLU.');
      }

      const unitLabel =
        plu.unitSize && plu.unitSymbol ? `${Number(plu.unitSize)}${plu.unitSymbol}` : null;
      const packLabel = plu.displayName ?? unitLabel ?? plu.pluCode;
      const productName = plu.product.name;

      const existing = order.items.find((i) => i.pluBarcode === dto.pluBarcode);
      const addQty = dto.quantity;

      // Reserve stock for just the added units (row-locked, cap-aware).
      await this.reserveStockForItems(tx, order.businessId, [
        { pluBarcode: dto.pluBarcode, productName, packLabel, quantity: addQty },
      ]);

      if (existing) {
        const newQty = existing.quantity + addQty;
        const unitPrice = Number(existing.unitPrice); // keep the agreed order-time price
        await tx.onlineOrderItem.update({
          where: { id: existing.id },
          data: { quantity: newQty, total: this.round2(unitPrice * newQty) },
        });
        await this.logEvent(
          tx, order, 'ITEM_UPDATED',
          `${productName} (${existing.packLabel}): quantity ${existing.quantity} → ${newQty}`,
          { itemId: existing.id, oldQty: existing.quantity, newQty }, actorName,
        );
      } else {
        // New line: price it like the storefront would (online price /
        // selling price + volume tiers for this quantity).
        const [priced] = await this.resolveAuthoritativePrices(order.businessId, [
          { pluBarcode: dto.pluBarcode, productName, packLabel, quantity: addQty },
        ]);
        const created = await tx.onlineOrderItem.create({
          data: {
            orderId: order.id,
            pluId: plu.id,
            pluBarcode: dto.pluBarcode,
            productCode: plu.product.productCode ?? plu.pluCode,
            productName,
            packLabel,
            quantity: addQty,
            unitPrice: priced.unitPrice,
            total: this.round2(priced.unitPrice * addQty),
            mrp: priced.mrp,
          },
        });
        await this.logEvent(
          tx, order, 'ITEM_ADDED',
          `Added ${productName} (${packLabel}) × ${addQty} @ ₹${priced.unitPrice.toFixed(2)}`,
          { itemId: created.id, pluBarcode: dto.pluBarcode, quantity: addQty, unitPrice: priced.unitPrice },
          actorName,
        );
      }
    });
  }

  /** Changes an item's quantity — reserves or releases only the difference. */
  async updateOrderItemQty(
    orderNumber: string,
    itemId: string,
    quantity: number,
    actorName: string,
  ) {
    return this.runOrderEdit(orderNumber, actorName, async (tx, order) => {
      const item = order.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Item not found on this order');
      if (quantity === item.quantity) return;

      const diff = quantity - item.quantity;
      if (diff > 0) {
        await this.reserveStockForItems(tx, order.businessId, [
          { pluBarcode: item.pluBarcode, productName: item.productName, packLabel: item.packLabel, quantity: diff },
        ]);
      } else if (item.pluId) {
        await tx.productPlu.update({
          where: { id: item.pluId },
          data: { stockOnHand: { increment: Math.abs(diff) } },
        });
      }

      const unitPrice = Number(item.unitPrice); // price agreed at order time stays
      await tx.onlineOrderItem.update({
        where: { id: item.id },
        data: { quantity, total: this.round2(unitPrice * quantity) },
      });
      await this.logEvent(
        tx, order, 'ITEM_UPDATED',
        `${item.productName} (${item.packLabel}): quantity ${item.quantity} → ${quantity}`,
        { itemId: item.id, oldQty: item.quantity, newQty: quantity }, actorName,
      );
    });
  }

  /** Removes an item, releasing its reserved stock. The last item can't be removed — cancel instead. */
  async removeOrderItem(orderNumber: string, itemId: string, actorName: string) {
    return this.runOrderEdit(orderNumber, actorName, async (tx, order) => {
      const item = order.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Item not found on this order');
      if (order.items.length <= 1) {
        throw new BadRequestException(
          'This is the only item on the order — cancel the whole order instead of removing it.',
        );
      }

      if (item.pluId) {
        await tx.productPlu.update({
          where: { id: item.pluId },
          data: { stockOnHand: { increment: item.quantity } },
        });
      }
      await tx.onlineOrderItem.delete({ where: { id: item.id } });
      await this.logEvent(
        tx, order, 'ITEM_REMOVED',
        `Removed ${item.productName} (${item.packLabel}) × ${item.quantity} (₹${Number(item.total).toFixed(2)})`,
        { itemId: item.id, pluBarcode: item.pluBarcode, quantity: item.quantity }, actorName,
      );
    });
  }

  // ─── Universal customer upsert ────────────────────────────────────────────

  private normalizePhone(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
    return null;
  }

  // Customer.phone is stored inconsistently across creation paths (bare
  // 10-digit here, 91-prefixed in whatsapp.service.ts's auto-creation) — an
  // exact match on one shape can miss an existing customer stored in the
  // other and create a duplicate row. `phone` here is always the bare-10
  // output of normalizePhone(); matches either known shape.
  private async findCustomerByNormalizedPhone(businessId: string, phone: string) {
    return this.prisma.customer.findFirst({
      where: { businessId, OR: [{ phone }, { phone: `91${phone}` }] },
      select: { id: true, channel: true, email: true },
    });
  }

  async backfillCustomers(businessId: string): Promise<{ created: number; upgraded: number; skipped: number }> {
    const orders = await this.prisma.onlineOrder.findMany({
      where:  { businessId, customerPhone: { not: null as any } },
      select: { customerPhone: true, customerName: true, customerEmail: true },
      orderBy: { createdAt: 'asc' },
    });

    let created = 0, upgraded = 0, skipped = 0;

    for (const order of orders) {
      const phone = this.normalizePhone(order.customerPhone!);
      if (!phone) { skipped++; continue; }

      const existing = await this.findCustomerByNormalizedPhone(businessId, phone);

      if (existing) {
        const updates: Record<string, unknown> = {};
        if (existing.channel === 'POS') updates.channel = 'BOTH';
        if (!existing.email && order.customerEmail) updates.email = order.customerEmail;
        if (Object.keys(updates).length > 0) {
          await this.prisma.customer.update({ where: { id: existing.id }, data: updates });
          upgraded++;
        } else {
          skipped++;
        }
      } else {
        const cleanedName = (order.customerName ?? '').trim().replace(/\s+/g, ' ') || `Customer ${phone}`;
        await this.prisma.customer.create({
          data: {
            businessId, name: cleanedName, phone,
            email: order.customerEmail || undefined,
            channel: 'ONLINE', status: 'ACTIVE', isActive: true, whatsappOptIn: true,
          },
        });
        created++;
      }
    }

    return { created, upgraded, skipped };
  }

  async upsertCustomer(businessId: string, rawPhone: string, name: string, email?: string | null): Promise<string | null> {
    const phone = this.normalizePhone(rawPhone);
    if (!phone) return null;

    const existing = await this.findCustomerByNormalizedPhone(businessId, phone);

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
        whatsappOptIn: true,
      },
      select: { id: true },
    });
    return customer.id;
  }
}
