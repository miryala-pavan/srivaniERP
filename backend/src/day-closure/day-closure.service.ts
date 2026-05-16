import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function yesterdayRange() {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

@Injectable()
export class DayClosureService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async getDefaultBranchId(businessId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return branch?.id ?? null;
  }

  async getToday(businessId: string, branchId?: string) {
    const resolvedBranchId = branchId ?? await this.getDefaultBranchId(businessId);
    const { start, end } = todayRange();

    // Today's bills
    const bills = await this.prisma.salesBill.findMany({
      where: {
        businessId,
        branchId: resolvedBranchId ?? undefined,
        status: 'FINAL',
        billDate: { gte: start, lte: end },
      },
      select: { grandTotal: true, paymentMode: true },
    });

    let totalBills = bills.length;
    let totalSales = 0, totalCash = 0, totalUpi = 0, totalCard = 0;
    for (const b of bills) {
      const amt = Number(b.grandTotal);
      totalSales += amt;
      if (b.paymentMode === 'CASH')  totalCash += amt;
      if (b.paymentMode === 'UPI')   totalUpi  += amt;
      if (b.paymentMode === 'CARD')  totalCard += amt;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Opening cash from first shift of today
    const shift = await this.prisma.posShift.findFirst({
      where: {
        branchId: resolvedBranchId ?? undefined,
        startTime: { gte: start, lte: end },
        status: { not: 'SUSPENDED' },
      },
      orderBy: { startTime: 'asc' },
      select: { openingCash: true },
    });
    const openingCash = Number(shift?.openingCash ?? 0);
    const systemCash  = round2(totalCash + openingCash);

    // Pending GRNs
    const grnsPending = await this.prisma.purchase.count({
      where: { businessId, status: 'PENDING_APPROVAL' },
    });

    // Unread stock alerts
    const stockAlerts = await this.prisma.notification.count({
      where: { businessId, isRead: false, type: { in: ['OUT_OF_STOCK', 'LOW_STOCK'] } },
    });

    // Open shifts today
    const openShifts = await this.prisma.posShift.count({
      where: {
        branchId: resolvedBranchId ?? undefined,
        startTime: { gte: start, lte: end },
        status: 'OPEN',
      },
    });

    // Today's closure record (if exists)
    const closureDate = new Date(); closureDate.setHours(0, 0, 0, 0);
    const existing = await this.prisma.dayClosure.findFirst({
      where: { businessId, branchId: resolvedBranchId ?? '', closureDate },
    });

    return {
      branchId: resolvedBranchId,
      closureDate,
      status: existing?.status ?? null,
      totalBills,
      totalSales:  round2(totalSales),
      totalCash:   round2(totalCash),
      totalUpi:    round2(totalUpi),
      totalCard:   round2(totalCard),
      openingCash,
      systemCash,
      actualCash:     existing?.actualCash ? Number(existing.actualCash) : null,
      cashDifference: existing?.cashDifference ? Number(existing.cashDifference) : null,
      grnsPending,
      stockAlerts,
      openShifts,
      closedAt:   existing?.closedAt ?? null,
      notes:      existing?.notes ?? null,
    };
  }

  async getYesterdayStatus(businessId: string) {
    const { start } = yesterdayRange();
    const closureDate = new Date(start); closureDate.setHours(0, 0, 0, 0);
    const branchId = await this.getDefaultBranchId(businessId);
    if (!branchId) return { isClosed: true };

    const closure = await this.prisma.dayClosure.findFirst({
      where: { businessId, branchId, closureDate, status: 'COMPLETED' },
    });
    return { isClosed: !!closure, date: closureDate };
  }

  async close(businessId: string, actualCash: number, notes: string | undefined, userId: string) {
    const branchId = await this.getDefaultBranchId(businessId);
    if (!branchId) throw new BadRequestException('No active branch found');

    // Block if any shifts are still open today
    const { start } = todayRange();
    const openShifts = await this.prisma.posShift.count({
      where: { branchId, startTime: { gte: start }, status: 'OPEN' },
    });
    if (openShifts > 0) {
      throw new BadRequestException(
        `Cannot close day. ${openShifts} shift${openShifts > 1 ? 's' : ''} still open. Cashiers must close their shifts first.`,
      );
    }

    const summary = await this.getToday(businessId, branchId);
    const round2  = (n: number) => Math.round(n * 100) / 100;
    const cashDiff = round2(actualCash - summary.systemCash);
    const closureDate = new Date(); closureDate.setHours(0, 0, 0, 0);

    const closure = await this.prisma.dayClosure.upsert({
      where: { businessId_branchId_closureDate: { businessId, branchId, closureDate } },
      update: {
        status:        'COMPLETED',
        systemCash:    summary.systemCash,
        actualCash,
        cashDifference: cashDiff,
        totalBills:    summary.totalBills,
        totalSales:    summary.totalSales,
        totalCash:     summary.totalCash,
        totalUpi:      summary.totalUpi,
        totalCard:     summary.totalCard,
        grnsPending:   summary.grnsPending,
        closedById:    userId,
        closedAt:      new Date(),
        notes: notes ?? null,
      },
      create: {
        businessId, branchId, closureDate,
        status:        'COMPLETED',
        systemCash:    summary.systemCash,
        actualCash,
        cashDifference: cashDiff,
        totalBills:    summary.totalBills,
        totalSales:    summary.totalSales,
        totalCash:     summary.totalCash,
        totalUpi:      summary.totalUpi,
        totalCard:     summary.totalCard,
        grnsPending:   summary.grnsPending,
        closedById:    userId,
        closedAt:      new Date(),
        notes: notes ?? null,
      },
    });

    this.notifications.create({
      businessId,
      type:     'SYSTEM',
      priority: 'NORMAL',
      title:    `Day Closed — ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
      message:  `Sales: ₹${summary.totalSales} · Cash: ₹${summary.totalCash} · UPI: ₹${summary.totalUpi} · Diff: ₹${cashDiff}`,
    }).catch(() => {});

    return closure;
  }

  async open(businessId: string, userId: string, userName: string) {
    const branchId = await this.getDefaultBranchId(businessId);
    if (!branchId) throw new BadRequestException('No active branch found');
    const closureDate = new Date(); closureDate.setHours(0, 0, 0, 0);

    const existing = await this.prisma.dayClosure.findFirst({
      where: { businessId, branchId, closureDate },
    });
    if (existing?.status === 'PENDING') {
      throw new BadRequestException('Day is already open.');
    }

    await this.prisma.dayClosure.upsert({
      where: { businessId_branchId_closureDate: { businessId, branchId, closureDate } },
      create: { businessId, branchId, closureDate, status: 'PENDING', openedById: userId, openedByName: userName },
      update: { status: 'PENDING', closedById: null, closedAt: null, openedById: userId, openedByName: userName },
    });
    return { opened: true, date: closureDate };
  }

  async getHistory(businessId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    return this.prisma.dayClosure.findMany({
      where: { businessId, closureDate: { gte: since } },
      orderBy: { closureDate: 'desc' },
      take: 30,
    });
  }

  async forceCloseShifts(businessId: string, managerName: string) {
    const branchId = await this.getDefaultBranchId(businessId);
    if (!branchId) throw new BadRequestException('No active branch found');
    const { start } = todayRange();
    const result = await this.prisma.posShift.updateMany({
      where: { branchId, startTime: { gte: start }, status: 'OPEN' },
      data: {
        status: 'CLOSED',
        endTime: new Date(),
        notes: `Force closed by manager: ${managerName}`,
      },
    });
    return { closed: result.count };
  }
}
