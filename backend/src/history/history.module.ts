import { Module } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports:     [PrismaModule, NotificationsModule],
  providers:   [HistoryService],
  controllers: [HistoryController],
  exports:     [HistoryService],
})
export class HistoryModule {}
