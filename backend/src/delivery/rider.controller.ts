import {
  Controller, Get, Post, Patch, Param, Body, Req, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryBoyJwtGuard } from './guards/delivery-boy-jwt.guard';
import { DeliveryDispatchService } from './delivery-dispatch.service';
import { DeliveryPhotoService } from './delivery-photo.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { FailDeliveryDto } from './dto/fail-delivery.dto';

@UseGuards(DeliveryBoyJwtGuard)
@Controller('rider')
export class RiderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DeliveryDispatchService,
    private readonly photos: DeliveryPhotoService,
  ) {}

  @Get('me')
  async me(@Req() req: any) {
    const rider = await this.prisma.deliveryBoy.findUnique({ where: { id: req.deliveryBoyId } });
    if (!rider) throw new NotFoundException('Rider not found');
    const activeDelivery = await this.prisma.delivery.findFirst({
      where: { assignedToId: rider.id, status: 'ASSIGNED' },
      orderBy: { assignedAt: 'asc' },
      include: { customer: { select: { name: true, phone: true } } },
    });
    return { rider, activeDelivery };
  }

  @Patch('status')
  async setStatus(@Req() req: any, @Body('status') status: 'OFFLINE' | 'AVAILABLE') {
    if (!['OFFLINE', 'AVAILABLE'].includes(status)) {
      throw new BadRequestException('Status must be OFFLINE or AVAILABLE');
    }
    // A rider can't self-set BUSY — that's derived from having an active delivery.
    const activeCount = await this.prisma.delivery.count({ where: { assignedToId: req.deliveryBoyId, status: 'ASSIGNED' } });
    if (activeCount > 0 && status === 'AVAILABLE') {
      // Fine — they can still receive more broadcasts up to the concurrent cap;
      // status field stays informational (see broadcast()'s own count check).
    }
    return this.prisma.deliveryBoy.update({ where: { id: req.deliveryBoyId }, data: { status } });
  }

  @Get('offers')
  async offers(@Req() req: any) {
    return this.prisma.deliveryOffer.findMany({
      where: { deliveryBoyId: req.deliveryBoyId, status: 'PENDING', delivery: { status: 'BROADCASTING' } },
      include: { delivery: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('offers/:deliveryId/accept')
  accept(@Req() req: any, @Param('deliveryId') deliveryId: string) {
    return this.dispatch.acceptOffer(deliveryId, req.deliveryBoyId);
  }

  @Post('offers/:deliveryId/decline')
  decline(@Req() req: any, @Param('deliveryId') deliveryId: string) {
    return this.dispatch.rejectOffer(deliveryId, req.deliveryBoyId);
  }

  @Post('deliveries/:deliveryId/location')
  location(@Req() req: any, @Body() dto: UpdateLocationDto) {
    return this.dispatch.updateLocation(req.deliveryBoyId, dto.lat, dto.lng);
  }

  @Post('deliveries/:deliveryId/photos')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  uploadPhoto(@Req() req: any, @Param('deliveryId') deliveryId: string, @UploadedFile() file: Express.Multer.File) {
    return this.photos.upload(req.businessId, deliveryId, req.deliveryBoyId, file);
  }

  @Post('deliveries/:deliveryId/confirm')
  confirm(@Req() req: any, @Param('deliveryId') deliveryId: string, @Body() dto: ConfirmDeliveryDto) {
    return this.dispatch.confirmDelivery(deliveryId, req.deliveryBoyId, dto);
  }

  @Post('deliveries/:deliveryId/fail')
  fail(@Req() req: any, @Param('deliveryId') deliveryId: string, @Body() dto: FailDeliveryDto) {
    return this.dispatch.failDelivery(deliveryId, req.deliveryBoyId, dto.reason);
  }
}
