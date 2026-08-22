import { Module } from '@nestjs/common';
import { ListsService } from './lists.service';
import { ListsController, WebhookController } from './lists.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { OnlineOrdersModule } from '../online-orders/online-orders.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderPhotosModule } from '../order-photos/order-photos.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports:     [PrismaModule, OnlineOrdersModule, EventsModule, NotificationsModule, OrderPhotosModule, HistoryModule],
  providers:   [ListsService],
  controllers: [ListsController, WebhookController],
  exports:     [ListsService],
})
export class ListsModule {}
