import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';
import { DeliverySettingsService } from './delivery-settings.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { DeliveryQueryDto } from './dto/delivery-query.dto';
import { SavedPlacesService } from '../geocoding/saved-places.service';

const SHOP_URL = (process.env.SHOP_URL ?? 'https://shop.srivani.com').replace(/\/$/, '');

/**
 * Broadcast-and-claim dispatch core. Every state transition here is designed
 * to be re-entrant/idempotent against the escalation ticker and concurrent
 * rider taps racing each other — see acceptOffer's atomic-claim comment.
 */
@Injectable()
export class DeliveryDispatchService {
  private readonly logger = new Logger(DeliveryDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly events: EventsService,
    private readonly settings: DeliverySettingsService,
    private readonly savedPlaces: SavedPlacesService,
  ) {}

  private emitToRider(deliveryBoyId: string, event: string, payload: any) {
    this.events.emitToRoom(`rider:${deliveryBoyId}`, event, payload);
  }

  private emitToDelivery(deliveryId: string, event: string, payload: any) {
    this.events.emitToRoom(`delivery:${deliveryId}`, event, payload);
  }

  private trackingUrl(token: string): string {
    return `${SHOP_URL}/track/${token}`;
  }

  private async logEvent(deliveryId: string, type: string, meta?: any) {
    await this.prisma.deliveryEvent.create({ data: { deliveryId, type, meta } });
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  async findAll(businessId: string, query: DeliveryQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));

    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.onlineOrderId) where.onlineOrderId = query.onlineOrderId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.customer = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
        ],
      };
    }

    const sortMap: Record<string, any> = {
      date: { createdAt: query.sortDir === 'asc' ? 'asc' : 'desc' },
      status: { status: query.sortDir === 'asc' ? 'asc' : 'desc' },
      customer: { customer: { name: query.sortDir === 'asc' ? 'asc' : 'desc' } },
    };
    const orderBy = sortMap[query.sortBy ?? 'date'] ?? sortMap.date;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where, orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { name: true, phone: true } },
          assignedTo: { select: { name: true, phone: true, vehicleNumber: true } },
        },
      }),
    ]);

    return { rows, total, page, limit };
  }

  async findOne(businessId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findFirst({
      where: { id: deliveryId, businessId },
      include: {
        customer: { select: { name: true, phone: true } },
        assignedTo: { select: { name: true, phone: true, vehicleNumber: true } },
        events: { orderBy: { createdAt: 'asc' } },
        photos: true,
      },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  /**
   * The "Dispatch to Rider" shortcut on the online-order detail page —
   * pulls the customer + captured lat/lng (Phase 3's checkout addition)
   * straight off the order instead of making staff re-enter it, with an
   * optional override for orders placed before that existed or without a
   * captured pin (WhatsApp/phone orders, older orders).
   */
  async createDeliveryFromOnlineOrder(
    businessId: string,
    orderId: string,
    override?: { lat?: number; lng?: number; addressText?: string; codAmount?: number },
  ) {
    const order = await this.prisma.onlineOrder.findFirst({ where: { id: orderId, businessId } });
    if (!order) throw new NotFoundException('Online order not found');
    if (order.deliveryType !== 'HOME_DELIVERY') {
      throw new BadRequestException('Only home-delivery orders can be dispatched to a rider');
    }

    const existing = await this.prisma.delivery.findFirst({ where: { onlineOrderId: orderId } });
    if (existing) throw new BadRequestException('A delivery already exists for this order');

    const addr = (order.deliveryAddress as any) ?? {};
    const lat = override?.lat ?? addr.lat;
    const lng = override?.lng ?? addr.lng;
    if (lat == null || lng == null) {
      throw new BadRequestException('No delivery location captured for this order — provide lat/lng manually');
    }
    const addressText = override?.addressText
      ?? [addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(', ');

    const codAmount = override?.codAmount
      ?? (order.paymentMethod === 'COD' ? Number(order.total) - Number(order.amountPaid) : undefined);

    return this.createDelivery(businessId, {
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      onlineOrderId: order.id,
      deliveryLat: lat,
      deliveryLng: lng,
      deliveryAddressText: addressText || undefined,
      codAmount: codAmount && codAmount > 0 ? codAmount : undefined,
    });
  }

  // ── Create + broadcast ──────────────────────────────────────────────────

  async createDelivery(businessId: string, dto: CreateDeliveryDto) {
    const customerId = await this.resolveOrCreateCustomer(businessId, dto);

    if (dto.salesBillId) {
      const bill = await this.prisma.salesBill.findFirst({ where: { id: dto.salesBillId, businessId } });
      if (!bill) throw new BadRequestException('Bill not found or does not belong to this business');
    }
    if (dto.onlineOrderId) {
      const order = await this.prisma.onlineOrder.findFirst({ where: { id: dto.onlineOrderId, businessId } });
      if (!order) throw new BadRequestException('Online order not found or does not belong to this business');
    }

    const otpCode = String(Math.floor(1000 + Math.random() * 9000));
    const trackingToken = randomBytes(16).toString('hex');

    const delivery = await this.prisma.delivery.create({
      data: {
        businessId,
        customerId,
        salesBillId: dto.salesBillId,
        onlineOrderId: dto.onlineOrderId,
        deliveryLat: dto.deliveryLat,
        deliveryLng: dto.deliveryLng,
        deliveryAddressText: dto.deliveryAddressText,
        codAmount: dto.codAmount,
        otpCode,
        trackingToken,
      },
    });

    // Record the drop pin for reuse next time — fire-and-forget.
    if (dto.deliveryLat != null && dto.deliveryLng != null) {
      this.prisma.customer.findUnique({ where: { id: customerId }, select: { phone: true } }).then(customer => {
        if (customer?.phone) this.savedPlaces.recordUse(businessId, customer.phone, dto.deliveryLat, dto.deliveryLng, 'staff-dispatch', dto.deliveryAddressText);
      });
    }

    await this.broadcast(delivery.id, 1);
    return delivery;
  }

  /** Selects eligible riders and pushes the offer to each (WS primary, WhatsApp backup). */
  async broadcast(deliveryId: string, round: number): Promise<void> {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || delivery.status !== 'BROADCASTING') return; // resolved already (race with a manual assign/cancel)

    if (round !== delivery.broadcastRound) {
      await this.prisma.delivery.update({ where: { id: deliveryId }, data: { broadcastRound: round } });
    }

    // Superseded by this round — a rider who simply never responded to an
    // earlier round (not an explicit decliner) would otherwise keep that old
    // PENDING offer forever, duplicating this same delivery in their feed
    // alongside the new round's offer.
    const superseded = await this.prisma.deliveryOffer.findMany({
      where: { deliveryId, round: { lt: round }, status: 'PENDING' },
      select: { deliveryBoyId: true },
    });
    if (superseded.length) {
      await this.prisma.deliveryOffer.updateMany({
        where: { deliveryId, round: { lt: round }, status: 'PENDING' },
        data: { status: 'EXPIRED', respondedAt: new Date() },
      });
      for (const s of superseded) this.emitToRider(s.deliveryBoyId, Events.DELIVERY_OFFER_EXPIRED, { deliveryId });
    }

    const settings = await this.settings.getAll(delivery.businessId);

    const declined = await this.prisma.deliveryOffer.findMany({
      where: { deliveryId, status: 'DECLINED' },
      select: { deliveryBoyId: true },
    });
    const declinedIds = declined.map(d => d.deliveryBoyId);

    const candidates = await this.prisma.deliveryBoy.findMany({
      where: {
        businessId: delivery.businessId,
        active: true,
        status: { in: ['AVAILABLE', 'BUSY'] },
        id: { notIn: declinedIds },
      },
    });

    let eligible = candidates.filter(c => c.status === 'AVAILABLE');
    const busyCandidates = candidates.filter(c => c.status === 'BUSY');
    if (busyCandidates.length) {
      const activeCounts = await this.prisma.delivery.groupBy({
        by: ['assignedToId'],
        where: { status: 'ASSIGNED', assignedToId: { in: busyCandidates.map(c => c.id) } },
        _count: { _all: true },
      });
      const countMap = new Map(activeCounts.map(c => [c.assignedToId as string, c._count._all]));
      eligible = eligible.concat(
        busyCandidates.filter(c => (countMap.get(c.id) ?? 0) < settings.maxConcurrentPerRider),
      );
    }

    if (!eligible.length) {
      this.logger.warn(`Broadcast round ${round} for delivery ${deliveryId} found no eligible riders`);
      await this.logEvent(deliveryId, round === 1 ? 'BROADCAST' : 'RE_BROADCAST', { round, riderCount: 0 });
      return;
    }

    await this.prisma.deliveryOffer.createMany({
      data: eligible.map(r => ({ deliveryId, deliveryBoyId: r.id, round })),
      skipDuplicates: true,
    });

    const bodyText = `New delivery available${delivery.deliveryAddressText ? ` near ${delivery.deliveryAddressText}` : ''}${delivery.codAmount ? ` — COD ₹${delivery.codAmount}` : ''}. First to accept gets it!`;

    for (const rider of eligible) {
      this.emitToRider(rider.id, Events.DELIVERY_BROADCAST, {
        deliveryId,
        round,
        deliveryLat: delivery.deliveryLat,
        deliveryLng: delivery.deliveryLng,
        deliveryAddressText: delivery.deliveryAddressText,
        codAmount: delivery.codAmount ? Number(delivery.codAmount) : null,
      });
      this.whatsapp.sendInteractiveButtons(delivery.businessId, rider.phone, bodyText, [
        { id: `ACCEPT_DELIVERY:${deliveryId}`, title: 'Accept' },
        { id: `DECLINE_DELIVERY:${deliveryId}`, title: 'Decline' },
      ]).catch(err => this.logger.error(`Broadcast WhatsApp send failed for rider ${rider.id}: ${err instanceof Error ? err.message : err}`));
    }

    this.events.emitToBusiness(delivery.businessId, Events.DELIVERY_BROADCAST, { deliveryId, round, riderCount: eligible.length });
    await this.logEvent(deliveryId, round === 1 ? 'BROADCAST' : 'RE_BROADCAST', { round, riderCount: eligible.length });
  }

  // ── Rider actions ────────────────────────────────────────────────────────

  async acceptOffer(deliveryId: string, deliveryBoyId: string) {
    const rider = await this.prisma.deliveryBoy.findUnique({ where: { id: deliveryBoyId } });
    if (!rider) throw new NotFoundException('Rider not found');

    // Atomic claim: only the first accept to hit this WHERE clause flips the
    // row, so a second simultaneous tap sees count===0 and gets "already taken".
    const claimed = await this.prisma.delivery.updateMany({
      where: { id: deliveryId, status: 'BROADCASTING' },
      data: { status: 'ASSIGNED', assignedToId: deliveryBoyId, assignedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new ConflictException('This delivery has already been assigned to someone else');
    }

    const delivery = await this.prisma.delivery.findUniqueOrThrow({ where: { id: deliveryId } });

    await this.prisma.deliveryOffer.updateMany({
      where: { deliveryId, deliveryBoyId, round: delivery.broadcastRound, status: 'PENDING' },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    const losingOffers = await this.prisma.deliveryOffer.findMany({
      where: { deliveryId, status: 'PENDING', NOT: { deliveryBoyId } },
      select: { deliveryBoyId: true },
    });
    await this.prisma.deliveryOffer.updateMany({
      where: { deliveryId, status: 'PENDING', NOT: { deliveryBoyId } },
      data: { status: 'EXPIRED', respondedAt: new Date() },
    });
    await this.prisma.deliveryBoy.update({ where: { id: deliveryBoyId }, data: { status: 'BUSY' } });

    // Tell the losing riders directly, so their offers feed drops the card
    // immediately instead of waiting for a manual refresh or a failed accept.
    for (const losing of losingOffers) {
      this.emitToRider(losing.deliveryBoyId, Events.DELIVERY_OFFER_EXPIRED, { deliveryId });
    }

    this.events.emitToBusiness(delivery.businessId, Events.DELIVERY_ASSIGNED, { deliveryId, deliveryBoyId, riderName: rider.name });
    this.emitToDelivery(deliveryId, Events.DELIVERY_ASSIGNED, { deliveryBoyId, riderName: rider.name, riderPhone: rider.phone, vehicleNumber: rider.vehicleNumber });
    await this.logEvent(deliveryId, 'ACCEPTED', { deliveryBoyId });

    if (delivery.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: delivery.customerId }, select: { phone: true } });
      if (customer?.phone) {
        this.whatsapp.sendTextMessage(
          delivery.businessId, customer.phone,
          `Your order is on its way! 🛵 Assigned to ${rider.name}${rider.phone ? ` (${rider.phone})` : ''}. Track live: ${this.trackingUrl(delivery.trackingToken)}`,
        ).catch(err => this.logger.error(`Assigned-notify to customer failed: ${err instanceof Error ? err.message : err}`));
      }
    }

    return this.prisma.delivery.findUnique({ where: { id: deliveryId } });
  }

  async rejectOffer(deliveryId: string, deliveryBoyId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');

    await this.prisma.deliveryOffer.updateMany({
      where: { deliveryId, deliveryBoyId, round: delivery.broadcastRound, status: { in: ['PENDING', 'ACCEPTED'] } },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });
    await this.logEvent(deliveryId, 'REJECTED', { deliveryBoyId });

    const wasAssignedToThisRider = delivery.status === 'ASSIGNED' && delivery.assignedToId === deliveryBoyId;

    if (wasAssignedToThisRider) {
      // Clear the assignment BEFORE freeRiderIfIdle's count check below —
      // otherwise this very row (still ASSIGNED to this rider) makes the
      // rider look non-idle and never gets freed back to AVAILABLE.
      const nextRound = delivery.broadcastRound + 1;
      await this.prisma.delivery.update({
        where: { id: deliveryId },
        data: { status: 'BROADCASTING', assignedToId: null, assignedAt: null, broadcastRound: nextRound },
      });
    }

    await this.freeRiderIfIdle(deliveryBoyId);

    if (wasAssignedToThisRider) {
      await this.broadcast(deliveryId, delivery.broadcastRound + 1);
    }

    return { ok: true };
  }

  async updateLocation(deliveryBoyId: string, lat: number, lng: number) {
    await this.prisma.deliveryBoy.update({ where: { id: deliveryBoyId }, data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() } });

    const active = await this.prisma.delivery.findMany({
      where: { assignedToId: deliveryBoyId, status: 'ASSIGNED' },
      select: { id: true },
    });
    for (const d of active) {
      this.emitToDelivery(d.id, Events.DELIVERY_LOCATION_UPDATE, { lat, lng });
    }
    return { ok: true };
  }

  async confirmDelivery(deliveryId: string, deliveryBoyId: string, dto: ConfirmDeliveryDto) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== 'ASSIGNED' || delivery.assignedToId !== deliveryBoyId) {
      throw new ForbiddenException('This delivery is not currently assigned to you');
    }
    if (dto.otpCode !== delivery.otpCode) {
      throw new BadRequestException('Incorrect OTP');
    }
    if (delivery.codAmount != null && !dto.cashCollected) {
      throw new BadRequestException('Confirm cash collected before marking delivered');
    }
    // Defense-in-depth: the DTO's @ArrayMinSize(1) only fires through the
    // HTTP validation pipe — enforce the same compound-gate rule here too,
    // since this method is the actual business-rule boundary, not the pipe.
    if (!dto.photoIds?.length) {
      throw new BadRequestException('At least one delivery photo is required');
    }

    const ownedPhotos = await this.prisma.orderPhoto.count({
      where: { id: { in: dto.photoIds }, deliveryId, deliveryBoyId },
    });
    if (ownedPhotos !== dto.photoIds.length) {
      throw new BadRequestException('One or more delivery photos are invalid');
    }

    const now = new Date();
    await this.prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'DELIVERED',
        deliveredAt: now,
        otpVerifiedAt: now,
        cashCollectedAt: delivery.codAmount != null ? now : null,
      },
    });

    const settings = await this.settings.getAll(delivery.businessId);
    await this.prisma.deliveryPayoutEntry.create({
      data: { businessId: delivery.businessId, deliveryBoyId, deliveryId, amount: settings.feeAmount },
    });

    await this.freeRiderIfIdle(deliveryBoyId);
    await this.logEvent(deliveryId, 'OTP_VERIFIED');
    if (delivery.codAmount != null) await this.logEvent(deliveryId, 'CASH_COLLECTED', { amount: Number(delivery.codAmount) });
    await this.logEvent(deliveryId, 'DELIVERED');

    this.events.emitToBusiness(delivery.businessId, Events.DELIVERY_DELIVERED, { deliveryId });
    this.emitToDelivery(deliveryId, Events.DELIVERY_DELIVERED, {});

    const customer = await this.prisma.customer.findUnique({ where: { id: delivery.customerId }, select: { phone: true } });
    if (customer?.phone) {
      this.whatsapp.sendTextMessage(
        delivery.businessId, customer.phone,
        `Delivered ✅ Thanks for shopping with us! See your delivery photos: ${this.trackingUrl(delivery.trackingToken)}`,
      ).catch(err => this.logger.error(`Delivered-notify to customer failed: ${err instanceof Error ? err.message : err}`));
    }

    return this.prisma.delivery.findUnique({ where: { id: deliveryId } });
  }

  async failDelivery(deliveryId: string, deliveryBoyId: string, reason: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== 'ASSIGNED' || delivery.assignedToId !== deliveryBoyId) {
      throw new ForbiddenException('This delivery is not currently assigned to you');
    }

    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { status: 'FAILED', failedReason: reason } });
    await this.freeRiderIfIdle(deliveryBoyId);
    await this.logEvent(deliveryId, 'FAILED', { reason });
    this.events.emitToBusiness(delivery.businessId, Events.DELIVERY_FAILED, { deliveryId, reason });

    return this.prisma.delivery.findUnique({ where: { id: deliveryId } });
  }

  // ── Staff actions ────────────────────────────────────────────────────────

  async cancelDelivery(businessId: string, deliveryId: string) {
    const delivery = await this.prisma.delivery.findFirst({ where: { id: deliveryId, businessId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (['DELIVERED', 'CANCELLED', 'FAILED'].includes(delivery.status)) {
      throw new BadRequestException(`Cannot cancel a delivery that is already ${delivery.status.toLowerCase()}`);
    }

    await this.prisma.delivery.update({ where: { id: deliveryId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await this.prisma.deliveryOffer.updateMany({
      where: { deliveryId, status: 'PENDING' },
      data: { status: 'EXPIRED', respondedAt: new Date() },
    });
    if (delivery.assignedToId) await this.freeRiderIfIdle(delivery.assignedToId);

    await this.logEvent(deliveryId, 'CANCELLED');
    this.events.emitToBusiness(businessId, Events.DELIVERY_CANCELLED, { deliveryId });
    this.emitToDelivery(deliveryId, Events.DELIVERY_CANCELLED, {});

    return this.prisma.delivery.findUnique({ where: { id: deliveryId } });
  }

  async manualAssign(businessId: string, deliveryId: string, deliveryBoyId: string) {
    const [delivery, rider] = await Promise.all([
      this.prisma.delivery.findFirst({ where: { id: deliveryId, businessId } }),
      this.prisma.deliveryBoy.findFirst({ where: { id: deliveryBoyId, businessId, active: true } }),
    ]);
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (!rider) throw new NotFoundException('Delivery boy not found');
    if (delivery.status !== 'BROADCASTING') {
      throw new BadRequestException(`Cannot manually assign — delivery is currently ${delivery.status.toLowerCase()}`);
    }

    await this.prisma.deliveryOffer.upsert({
      where: { deliveryId_deliveryBoyId_round: { deliveryId, deliveryBoyId, round: delivery.broadcastRound } },
      update: { status: 'ACCEPTED', respondedAt: new Date() },
      create: { deliveryId, deliveryBoyId, round: delivery.broadcastRound, status: 'ACCEPTED', respondedAt: new Date() },
    });
    return this.acceptOffer(deliveryId, deliveryBoyId);
  }

  // ── Shared helpers ───────────────────────────────────────────────────────

  private async freeRiderIfIdle(deliveryBoyId: string) {
    const remaining = await this.prisma.delivery.count({ where: { assignedToId: deliveryBoyId, status: 'ASSIGNED' } });
    if (remaining === 0) {
      await this.prisma.deliveryBoy.updateMany({ where: { id: deliveryBoyId, status: 'BUSY' }, data: { status: 'AVAILABLE' } });
    }
  }

  /**
   * Resolves the delivery's customer, three ways: an existing customerId
   * (the normal storefront-order case), or a name+phone pair matched by
   * normalized last-10-digits (same logic as
   * WhatsAppService.findCustomerByPhoneNormalized / WebhookController's
   * findCustomerByPhone — not a new matching scheme) and created if no
   * match exists. OnlineOrder has no customerId FK, so this is required for
   * both the "New Delivery" staff form and the online-order dispatch shortcut.
   */
  private async resolveOrCreateCustomer(businessId: string, dto: CreateDeliveryDto): Promise<string> {
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, businessId } });
      if (!customer) throw new NotFoundException('Customer not found');
      return customer.id;
    }

    if (!dto.customerName || !dto.customerPhone) {
      throw new BadRequestException('Provide either customerId or both customerName and customerPhone');
    }

    const digits = dto.customerPhone.replace(/\D/g, '').slice(-10);
    const existing = await this.prisma.customer.findFirst({
      where: { businessId, OR: [{ phone: digits }, { phone: `91${digits}` }, { phone: dto.customerPhone }] },
    });
    if (existing) return existing.id;

    const created = await this.prisma.customer.create({
      data: { businessId, name: dto.customerName, phone: dto.customerPhone },
    });
    return created.id;
  }
}
