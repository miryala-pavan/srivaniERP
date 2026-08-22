import { Module } from '@nestjs/common';
import { OrderPhotosService } from './order-photos.service';
import { OrderPhotosController } from './order-photos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [PrismaModule, NotificationsModule],
  providers:   [OrderPhotosService],
  controllers: [OrderPhotosController],
  exports:     [OrderPhotosService],
})
export class OrderPhotosModule {}
