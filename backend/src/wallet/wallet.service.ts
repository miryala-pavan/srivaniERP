import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Store-credit wallet on the Customer record.
 *
 * Credits come from online-order edit settlements (paid order's total went
 * down → difference is credited here instead of a Razorpay refund), or
 * manual staff adjustments. Debits are staff-applied — at delivery or POS.
 * Customer self-serve redemption is deliberately not exposed until the
 * storefront has real customer authentication (OTP), since orders are
 * keyed only by phone number today.
 *
 * Every balance change writes a WalletTransaction row with balanceAfter,
 * so the ledger is always reconstructable and auditable.
 */
@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getWallet(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, name: true, phone: true, walletBalance: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return {
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone,
      balance: Number(customer.walletBalance),
    };
  }

  async listTransactions(businessId: string, customerId: string, page = 1, limit = 20) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const where = { businessId, customerId };
    const [items, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Credits the wallet. Standalone version — wraps creditTx in its own
   * transaction. Use creditTx directly when already inside one (e.g. the
   * order-edit settlement).
   */
  async credit(
    businessId: string,
    customerId: string,
    amount: number,
    reason: string,
    opts?: { relatedType?: string; relatedId?: string; createdByName?: string },
  ) {
    return this.prisma.$transaction((tx) =>
      this.creditTx(tx, businessId, customerId, amount, reason, opts),
    );
  }

  async creditTx(
    tx: Prisma.TransactionClient,
    businessId: string,
    customerId: string,
    amount: number,
    reason: string,
    opts?: { relatedType?: string; relatedId?: string; createdByName?: string },
  ) {
    if (!(amount > 0)) throw new BadRequestException('Credit amount must be positive');
    const rounded = Math.round(amount * 100) / 100;

    const customer = await tx.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: { walletBalance: { increment: rounded } },
      select: { walletBalance: true },
    });
    const txn = await tx.walletTransaction.create({
      data: {
        businessId, customerId,
        type: 'CREDIT',
        amount: rounded,
        balanceAfter: updated.walletBalance,
        reason,
        relatedType: opts?.relatedType,
        relatedId: opts?.relatedId,
        createdByName: opts?.createdByName ?? 'System',
      },
    });
    return { balance: Number(updated.walletBalance), transaction: txn };
  }

  /**
   * Debits the wallet (staff-applied redemption at delivery/POS, or a
   * correction). Blocks overdraw — the wallet can never go negative.
   */
  async debit(
    businessId: string,
    customerId: string,
    amount: number,
    reason: string,
    opts?: { relatedType?: string; relatedId?: string; createdByName?: string },
  ) {
    return this.prisma.$transaction((tx) =>
      this.debitTx(tx, businessId, customerId, amount, reason, opts),
    );
  }

  async debitTx(
    tx: Prisma.TransactionClient,
    businessId: string,
    customerId: string,
    amount: number,
    reason: string,
    opts?: { relatedType?: string; relatedId?: string; createdByName?: string },
  ) {
    if (!(amount > 0)) throw new BadRequestException('Debit amount must be positive');
    const rounded = Math.round(amount * 100) / 100;

    // Conditional update guards against concurrent debits overdrawing:
    // the WHERE clause re-checks the balance atomically at write time.
    const result = await tx.customer.updateMany({
      where: { id: customerId, businessId, walletBalance: { gte: rounded } },
      data: { walletBalance: { decrement: rounded } },
    });
    if (result.count === 0) {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId },
        select: { walletBalance: true },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ₹${Number(customer.walletBalance).toFixed(2)}, requested: ₹${rounded.toFixed(2)}`,
      );
    }

    const updated = await tx.customer.findUniqueOrThrow({
      where: { id: customerId },
      select: { walletBalance: true },
    });
    const txn = await tx.walletTransaction.create({
      data: {
        businessId, customerId,
        type: 'DEBIT',
        amount: rounded,
        balanceAfter: updated.walletBalance,
        reason,
        relatedType: opts?.relatedType,
        relatedId: opts?.relatedId,
        createdByName: opts?.createdByName ?? 'System',
      },
    });
    return { balance: Number(updated.walletBalance), transaction: txn };
  }
}
