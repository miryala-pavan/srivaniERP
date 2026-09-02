import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? 'http://localhost:4001').replace(/\/$/, '');

// Public — no auth — the unguessable trackingToken IS the access control,
// same pattern as HistoryController/OrderPhotosController.
@Controller('track')
export class TrackController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':token')
  async getByToken(@Param('token') token: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { trackingToken: token },
      include: {
        customer: { select: { name: true } },
        assignedTo: { select: { name: true, phone: true, vehicleType: true, vehicleNumber: true, lastLat: true, lastLng: true, lastLocationAt: true } },
        photos: { where: { imageUrl: { not: '' } } },
      },
    });
    if (!delivery) throw new NotFoundException('Tracking link not found');

    return {
      status: delivery.status,
      customerName: delivery.customer.name,
      deliveryLat: delivery.deliveryLat,
      deliveryLng: delivery.deliveryLng,
      rider: delivery.assignedTo ? {
        name: delivery.assignedTo.name,
        phone: delivery.assignedTo.phone,
        vehicleType: delivery.assignedTo.vehicleType,
        vehicleNumber: delivery.assignedTo.vehicleNumber,
        lastLat: delivery.assignedTo.lastLat,
        lastLng: delivery.assignedTo.lastLng,
      } : null,
      deliveredAt: delivery.deliveredAt,
      photos: delivery.photos.map(p => ({ imageUrl: `${API_PUBLIC_URL}${p.imageUrl}`, capturedAt: p.createdAt })),
      photosExpireAt: delivery.photos[0]?.expiresAt ?? null,
    };
  }
}
