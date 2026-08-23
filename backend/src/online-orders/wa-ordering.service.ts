import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma, WaOrderSessionState, type WaOrderSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { OnlineOrdersService } from './online-orders.service';
import { ShopService } from '../shop/shop.service';
import { DeliveryType } from './dto/create-order.dto';

const SESSION_TTL_MS = 30 * 60 * 1000;

interface CartItem {
  pluBarcode: string;
  productCode: string;
  productName: string;
  packLabel: string;
  quantity: number;
  unitPrice: number;
  mrp: number | null;
}

interface InboundOpts {
  buttonId?: string;
  listReplyId?: string;
  messageBody?: string;
}

/**
 * Orchestrates the WhatsApp quick-reorder flow (task #99): a repeat customer
 * types/taps "reorder", the bot seeds a cart from their last order, and walks
 * them through confirm → delivery type → address → place order, all inside
 * WhatsApp. Lives in OnlineOrdersModule (not NotificationsModule) specifically
 * to avoid a circular dependency — OnlineOrdersModule already imports
 * NotificationsModule for WhatsAppService, so this direction is safe; the
 * reverse (WhatsAppService depending on order logic) is not.
 */
@Injectable()
export class WaOrderingService {
  private readonly logger = new Logger(WaOrderingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly onlineOrders: OnlineOrdersService,
    private readonly shop: ShopService,
  ) {}

  private bareDigits(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10);
  }

  private truncateTitle(s: string): string {
    return s.length <= 20 ? s : s.slice(0, 19) + '…';
  }

  /** Returns the phone's single active (non-terminal, unexpired) session, lazily expiring stale ones. */
  async getActiveSession(businessId: string, phone: string): Promise<WaOrderSession | null> {
    const session = await this.prisma.waOrderSession.findFirst({
      where: {
        businessId,
        phone,
        state: { notIn: [WaOrderSessionState.COMPLETED, WaOrderSessionState.CANCELLED, WaOrderSessionState.EXPIRED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await this.prisma.waOrderSession.update({ where: { id: session.id }, data: { state: WaOrderSessionState.EXPIRED } });
      return null;
    }
    return session;
  }

  /** Entry point for the "reorder" trigger (menu tap or free-text keyword). Seeds a session from the customer's latest order, or points first-timers to the storefront. */
  async startReorder(businessId: string, phone: string): Promise<void> {
    // One active flow per phone — close out any stray open session before starting fresh.
    await this.prisma.waOrderSession.updateMany({
      where: { businessId, phone, state: { notIn: [WaOrderSessionState.COMPLETED, WaOrderSessionState.CANCELLED, WaOrderSessionState.EXPIRED] } },
      data: { state: WaOrderSessionState.EXPIRED },
    });

    const bare = this.bareDigits(phone);
    const orders = await this.onlineOrders.listOrders(bare);
    const last = orders.find(o => o.businessId === businessId && o.items.length > 0);
    if (!last) {
      const shopUrl = process.env.SHOP_URL ?? 'https://shop.srivani.com';
      await this.whatsapp.sendTextMessage(businessId, phone, `You don't have a previous order with us yet — browse and place your first order at ${shopUrl} 🛍️`);
      return;
    }

    const cart: CartItem[] = last.items.map(i => ({
      pluBarcode: i.pluBarcode,
      productCode: i.productCode,
      productName: i.productName,
      packLabel: i.packLabel,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      mrp: i.mrp !== null && i.mrp !== undefined ? Number(i.mrp) : null,
    }));

    const session = await this.prisma.waOrderSession.create({
      data: {
        businessId,
        phone,
        state: WaOrderSessionState.SELECTING_ITEMS,
        cart: JSON.parse(JSON.stringify(cart)),
        sourceOrderNumber: last.orderNumber,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    await this.sendCartSummary(session.id, businessId, phone, cart, `Here's your last order (#${last.orderNumber}) — want to repeat it?`);
  }

  /** State-machine dispatcher for every inbound message while a session is active. */
  async handleSessionMessage(businessId: string, phone: string, session: WaOrderSession, opts: InboundOpts): Promise<void> {
    const selection = opts.buttonId ?? opts.listReplyId;
    const action = selection?.split(':')[0];
    const sid = session.id;

    if (action === 'REORDER_CANCEL') {
      await this.prisma.waOrderSession.update({ where: { id: sid }, data: { state: WaOrderSessionState.CANCELLED } });
      await this.whatsapp.sendTextMessage(businessId, phone, "No worries, cancelled. Reply 'reorder' anytime to start again.");
      return;
    }

    // Any activity keeps the session alive a while longer.
    await this.prisma.waOrderSession.update({ where: { id: sid }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });

    const cart = session.cart as unknown as CartItem[];

    switch (session.state) {
      case WaOrderSessionState.SELECTING_ITEMS:
        await this.handleSelectingItems(businessId, phone, session, cart, action, selection, opts);
        return;
      case WaOrderSessionState.AWAITING_DELIVERY_TYPE:
        await this.handleAwaitingDeliveryType(businessId, phone, sid, cart, action);
        return;
      case WaOrderSessionState.AWAITING_ADDRESS_CONFIRM:
        await this.handleAwaitingAddressConfirm(businessId, phone, sid, cart, action);
        return;
      case WaOrderSessionState.AWAITING_FINAL_CONFIRM:
        if (action === 'REORDER_PLACE') {
          await this.confirmAndPlaceOrder(businessId, phone, sid);
          return;
        }
        await this.whatsapp.sendTextMessage(businessId, phone, "Tap 'Place Order' to confirm, or 'Cancel' to stop.");
        return;
      default:
        return;
    }
  }

  private async handleSelectingItems(
    businessId: string, phone: string, session: WaOrderSession, cart: CartItem[],
    action: string | undefined, selection: string | undefined, opts: InboundOpts,
  ): Promise<void> {
    const sid = session.id;

    if (session.awaitingItemSearch && !selection && opts.messageBody) {
      await this.searchAndOfferItem(businessId, phone, sid, opts.messageBody);
      return;
    }
    if (action === 'REORDER_CONFIRM') {
      await this.prisma.waOrderSession.update({ where: { id: sid }, data: { state: WaOrderSessionState.AWAITING_DELIVERY_TYPE } });
      await this.whatsapp.sendInteractiveButtons(businessId, phone, 'How would you like to receive this order?', [
        { id: `REORDER_DELIVERY_HOME:${sid}`, title: '🚚 Home Delivery' },
        { id: `REORDER_DELIVERY_PICKUP:${sid}`, title: '🏪 Store Pickup' },
      ]);
      return;
    }
    if (action === 'REORDER_ADD') {
      await this.prisma.waOrderSession.update({ where: { id: sid }, data: { awaitingItemSearch: true } });
      await this.whatsapp.sendTextMessage(businessId, phone, 'Type the name of the product you want to add.');
      return;
    }
    if (action === 'REORDER_ADD_ITEM' && selection) {
      const productCode = selection.split(':')[2];
      await this.addItemToCart(businessId, phone, sid, productCode);
      return;
    }
    // Unrecognized input mid-flow — re-show where they were rather than going silent.
    await this.sendCartSummary(sid, businessId, phone, cart, "Let's pick up where we left off.");
  }

  private async handleAwaitingDeliveryType(businessId: string, phone: string, sid: string, cart: CartItem[], action: string | undefined): Promise<void> {
    if (action === 'REORDER_DELIVERY_PICKUP') {
      await this.prisma.waOrderSession.update({ where: { id: sid }, data: { deliveryType: DeliveryType.STORE_PICKUP, state: WaOrderSessionState.AWAITING_FINAL_CONFIRM } });
      await this.sendFinalConfirm(businessId, phone, sid, cart, DeliveryType.STORE_PICKUP, null);
      return;
    }
    if (action === 'REORDER_DELIVERY_HOME') {
      const addr = await this.prisma.storefrontAddress.findFirst({
        where: { phone: this.bareDigits(phone) },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      });
      if (!addr) {
        const shopUrl = process.env.SHOP_URL ?? 'https://shop.srivani.com';
        await this.whatsapp.sendTextMessage(
          businessId, phone,
          `You don't have a saved delivery address yet. Please place one order via ${shopUrl}/checkout to save an address — after that, reordering here will remember it. Or tap Store Pickup instead.`,
        );
        return;
      }
      const address = { line1: addr.line1, line2: addr.line2 ?? undefined, city: addr.city, pincode: addr.pincode, state: addr.state };
      await this.prisma.waOrderSession.update({
        where: { id: sid },
        data: {
          state: WaOrderSessionState.AWAITING_ADDRESS_CONFIRM,
          deliveryType: DeliveryType.HOME_DELIVERY,
          deliveryAddress: JSON.parse(JSON.stringify(address)),
        },
      });
      const addrText = [addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(', ');
      await this.whatsapp.sendInteractiveButtons(businessId, phone, `Deliver to: ${addrText}?`, [
        { id: `REORDER_ADDR_YES:${sid}`, title: '✅ Yes' },
        { id: `REORDER_ADDR_NO:${sid}`, title: '🏪 Use Pickup' },
      ]);
      return;
    }
    await this.whatsapp.sendTextMessage(businessId, phone, 'Please choose Home Delivery or Store Pickup above.');
  }

  private async handleAwaitingAddressConfirm(businessId: string, phone: string, sid: string, cart: CartItem[], action: string | undefined): Promise<void> {
    if (action === 'REORDER_ADDR_YES') {
      const refreshed = await this.prisma.waOrderSession.findUnique({ where: { id: sid } });
      await this.prisma.waOrderSession.update({ where: { id: sid }, data: { state: WaOrderSessionState.AWAITING_FINAL_CONFIRM } });
      await this.sendFinalConfirm(businessId, phone, sid, cart, DeliveryType.HOME_DELIVERY, refreshed?.deliveryAddress ?? null);
      return;
    }
    if (action === 'REORDER_ADDR_NO') {
      await this.prisma.waOrderSession.update({
        where: { id: sid },
        data: { deliveryType: DeliveryType.STORE_PICKUP, deliveryAddress: Prisma.JsonNull, state: WaOrderSessionState.AWAITING_FINAL_CONFIRM },
      });
      await this.sendFinalConfirm(businessId, phone, sid, cart, DeliveryType.STORE_PICKUP, null);
      return;
    }
    await this.whatsapp.sendTextMessage(businessId, phone, 'Please confirm the address above, or choose pickup instead.');
  }

  private async sendCartSummary(sessionId: string, businessId: string, phone: string, cart: CartItem[], intro: string): Promise<void> {
    const lines = cart.map(i => `• ${i.productName} (${i.packLabel}) × ${i.quantity} — ₹${(i.unitPrice * i.quantity).toFixed(0)}`);
    const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    await this.whatsapp.sendTextMessage(businessId, phone, `${intro}\n\n${lines.join('\n')}\n\nSubtotal: ₹${subtotal.toFixed(0)}`);
    await this.whatsapp.sendInteractiveButtons(businessId, phone, 'What would you like to do?', [
      { id: `REORDER_CONFIRM:${sessionId}`, title: '✅ Confirm cart' },
      { id: `REORDER_ADD:${sessionId}`, title: '➕ Add item' },
      { id: `REORDER_CANCEL:${sessionId}`, title: '❌ Cancel' },
    ]);
  }

  private async sendFinalConfirm(
    businessId: string, phone: string, sid: string, cart: CartItem[],
    deliveryType: DeliveryType, address: Prisma.JsonValue | null,
  ): Promise<void> {
    const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const deliveryFee = this.onlineOrders.previewDeliveryFee(subtotal, deliveryType);
    const total = subtotal + deliveryFee;
    const addr = address as { line1?: string; city?: string } | null;
    const deliveryLine = deliveryType === DeliveryType.STORE_PICKUP
      ? 'Pickup at store'
      : `Home delivery to ${[addr?.line1, addr?.city].filter(Boolean).join(', ')}`;
    const text = `Order summary:\nSubtotal: ₹${subtotal.toFixed(0)}\nDelivery: ₹${deliveryFee.toFixed(0)}\nTotal: ₹${total.toFixed(0)}\n${deliveryLine}\nPayment: Cash on Delivery`;
    await this.whatsapp.sendTextMessage(businessId, phone, text);
    await this.whatsapp.sendInteractiveButtons(businessId, phone, 'Confirm this order?', [
      { id: `REORDER_PLACE:${sid}`, title: '✅ Place Order' },
      { id: `REORDER_CANCEL:${sid}`, title: '❌ Cancel' },
    ]);
  }

  private async searchAndOfferItem(businessId: string, phone: string, sid: string, query: string): Promise<void> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      await this.whatsapp.sendTextMessage(businessId, phone, 'Please type at least 2 characters of the product name.');
      return;
    }
    const { products } = await this.shop.suggest(trimmed, 3);
    if (products.length === 0) {
      await this.whatsapp.sendTextMessage(businessId, phone, `No products found matching "${trimmed}". Try a different name, or tap Confirm cart to continue.`);
      return;
    }
    await this.whatsapp.sendInteractiveButtons(
      businessId, phone, `Found ${products.length} match${products.length > 1 ? 'es' : ''}:`,
      products.map(p => ({ id: `REORDER_ADD_ITEM:${sid}:${p.code}`, title: this.truncateTitle(`➕ ${p.name}`) })),
    );
  }

  private async addItemToCart(businessId: string, phone: string, sid: string, productCode: string): Promise<void> {
    const session = await this.prisma.waOrderSession.findUnique({ where: { id: sid } });
    if (!session) return;
    const cart = session.cart as unknown as CartItem[];

    let product;
    try {
      product = await this.shop.getProductByCode(productCode);
    } catch {
      await this.whatsapp.sendTextMessage(businessId, phone, "Sorry, that item isn't available anymore.");
      return;
    }
    const pack = product.packs.find(p => p.inStock) ?? product.packs[0];
    if (!pack) {
      await this.whatsapp.sendTextMessage(businessId, phone, "Sorry, that item isn't available anymore.");
      return;
    }

    const existing = cart.find(i => i.pluBarcode === pack.pluBarcode);
    const updatedCart: CartItem[] = existing
      ? cart.map(i => i.pluBarcode === pack.pluBarcode ? { ...i, quantity: i.quantity + 1 } : i)
      : [...cart, {
        pluBarcode: pack.pluBarcode,
        productCode,
        productName: product.name,
        packLabel: pack.packLabel,
        quantity: 1,
        unitPrice: Number(pack.price),
        mrp: pack.mrp !== null ? Number(pack.mrp) : null,
      }];

    await this.prisma.waOrderSession.update({
      where: { id: sid },
      data: { cart: JSON.parse(JSON.stringify(updatedCart)), awaitingItemSearch: false },
    });
    await this.sendCartSummary(sid, businessId, phone, updatedCart, `Added ✅ ${product.name}.`);
  }

  private async confirmAndPlaceOrder(businessId: string, phone: string, sid: string): Promise<void> {
    // Atomically claim the session before doing any real work — a double
    // tap on "Place Order" (or Meta redelivering the same webhook) must not
    // run whatsappCheckout() twice for the same cart. Whichever call's
    // updateMany actually flips AWAITING_FINAL_CONFIRM -> COMPLETED wins;
    // the loser sees count === 0 and no-ops instead of placing a duplicate
    // order. Reverted back to AWAITING_FINAL_CONFIRM below if checkout fails.
    const claimed = await this.prisma.waOrderSession.updateMany({
      where: { id: sid, state: WaOrderSessionState.AWAITING_FINAL_CONFIRM },
      data: { state: WaOrderSessionState.COMPLETED },
    });
    if (claimed.count === 0) return;

    const session = await this.prisma.waOrderSession.findUnique({ where: { id: sid } });
    if (!session) return;
    const cart = session.cart as unknown as CartItem[];

    const sourceOrder = session.sourceOrderNumber
      ? await this.prisma.onlineOrder.findUnique({
        where: { orderNumber: session.sourceOrderNumber },
        select: { customerName: true, customerEmail: true },
      })
      : null;

    try {
      const result = await this.onlineOrders.whatsappCheckout({
        customerName: sourceOrder?.customerName ?? 'Customer',
        customerPhone: this.bareDigits(phone),
        customerEmail: sourceOrder?.customerEmail ?? undefined,
        deliveryType: (session.deliveryType as DeliveryType | null) ?? DeliveryType.STORE_PICKUP,
        deliveryAddress: session.deliveryAddress as any,
        items: cart.map(i => ({
          pluBarcode: i.pluBarcode, productCode: i.productCode, productName: i.productName,
          packLabel: i.packLabel, quantity: i.quantity, unitPrice: i.unitPrice, mrp: i.mrp ?? undefined,
        })),
        customerNotes: `Reordered from #${session.sourceOrderNumber ?? 'a previous order'} via WhatsApp`,
      });

      await this.prisma.waOrderSession.update({
        where: { id: sid },
        data: { resultOrderNumber: result.orderNumber },
      });
      await this.whatsapp.sendTextMessage(
        businessId, phone,
        `🎉 Order placed! #${result.orderNumber} — total ₹${result.total.toFixed(0)}, Cash on Delivery. We'll notify you as it's processed.`,
      );
    } catch (err) {
      const message = err instanceof BadRequestException
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? ((err.getResponse() as any)?.message ?? err.message)
        : 'Something went wrong placing your order. Please try again in a moment.';
      this.logger.error(`WA reorder placement failed for session ${sid}: ${message}`);
      await this.whatsapp.sendTextMessage(businessId, phone, `⚠️ ${message}`);
      // Release the claim so the customer can retry or cancel.
      await this.prisma.waOrderSession.update({
        where: { id: sid },
        data: { state: WaOrderSessionState.AWAITING_FINAL_CONFIRM },
      });
    }
  }
}
