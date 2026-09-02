import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryBoyDto } from './dto/create-delivery-boy.dto';
import { UpdateDeliveryBoyDto } from './dto/update-delivery-boy.dto';

@Injectable()
export class DeliveryBoyService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(businessId: string) {
    return this.prisma.deliveryBoy.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(businessId: string, id: string) {
    const rider = await this.prisma.deliveryBoy.findFirst({ where: { id, businessId } });
    if (!rider) throw new NotFoundException('Delivery boy not found');
    return rider;
  }

  async create(businessId: string, dto: CreateDeliveryBoyDto) {
    const existing = await this.prisma.deliveryBoy.findUnique({ where: { businessId_phone: { businessId, phone: dto.phone } } });
    if (existing) throw new ConflictException('A delivery boy with this phone number already exists');
    return this.prisma.deliveryBoy.create({ data: { businessId, ...dto } });
  }

  async update(businessId: string, id: string, dto: UpdateDeliveryBoyDto) {
    await this.findOne(businessId, id);
    return this.prisma.deliveryBoy.update({ where: { id }, data: dto });
  }

  async payouts(businessId: string, id: string) {
    await this.findOne(businessId, id);
    const entries = await this.prisma.deliveryPayoutEntry.findMany({
      where: { businessId, deliveryBoyId: id },
      orderBy: { createdAt: 'desc' },
    });
    const owedToRider = entries.filter(e => !e.settled).reduce((sum, e) => sum + Number(e.amount), 0);

    const activeCod = await this.prisma.delivery.findMany({
      where: { assignedToId: id, status: 'ASSIGNED', codAmount: { not: null } },
      select: { codAmount: true },
    });
    const cashInHand = activeCod.reduce((sum, d) => sum + Number(d.codAmount ?? 0), 0);

    return { entries, owedToRider, cashInHand };
  }

  async settlePayouts(businessId: string, id: string) {
    await this.findOne(businessId, id);
    const result = await this.prisma.deliveryPayoutEntry.updateMany({
      where: { businessId, deliveryBoyId: id, settled: false },
      data: { settled: true, settledAt: new Date() },
    });
    return { settledCount: result.count };
  }
}
