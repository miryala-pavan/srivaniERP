import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { Events } from '../events/event-types';

export interface CreateNotificationInput {
  businessId: string;
  type: string;
  priority?: string;
  title: string;
  message: string;
  productId?: string;
  supplierId?: string;
  purchaseId?: string;
  actionUrl?: string;
  actionLabel?: string;
  channel?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  async create(input: CreateNotificationInput) {
    const notif = await this.prisma.notification.create({
      data: {
        businessId:  input.businessId,
        type:        input.type,
        priority:    input.priority  ?? 'NORMAL',
        title:       input.title,
        message:     input.message,
        productId:   input.productId  ?? null,
        supplierId:  input.supplierId ?? null,
        purchaseId:  input.purchaseId ?? null,
        actionUrl:   input.actionUrl  ?? null,
        actionLabel: input.actionLabel ?? null,
        channel:     input.channel ?? 'IN_APP',
      },
    });
    try {
      this.eventsService.emitToBusiness(input.businessId, Events.NOTIFICATION_CREATED, {
        notificationId: notif.id,
        type:     notif.type,
        title:    notif.title,
        priority: notif.priority,
      });
    } catch (_err) { /* fire-and-forget */ }
    return notif;
  }

  async getNotifications(businessId: string, page = 1, limit = 50, type?: string, priority?: string, isRead?: boolean) {
    const skip  = (page - 1) * limit;
    const where: any = { businessId };
    if (type)                 where.type     = type;
    if (priority)             where.priority = priority;
    if (isRead !== undefined) where.isRead   = isRead;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: Math.min(limit, 50),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getUnreadCount(businessId: string) {
    const count = await this.prisma.notification.count({ where: { businessId, isRead: false } });
    return { count };
  }

  async markRead(businessId: string, id: string, userId?: string) {
    const notif = await this.prisma.notification.findFirst({ where: { id, businessId } });
    if (!notif) throw new NotFoundException('Notification not found');
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date(), readById: userId ?? null },
    });
    try {
      this.eventsService.emitToBusiness(businessId, Events.NOTIFICATION_READ, {
        notificationId: id,
      });
    } catch (_err) { /* fire-and-forget */ }
    return updated;
  }

  async markAllRead(businessId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { businessId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });
    try {
      this.eventsService.emitToBusiness(businessId, Events.NOTIFICATION_READ_ALL, {});
    } catch (_err) { /* fire-and-forget */ }
    return { updated: result.count };
  }
}
