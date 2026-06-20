import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WhatsAppService } from './whatsapp.service';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [EventsModule, PrismaModule],
  providers:   [NotificationsService, WhatsAppService],
  controllers: [NotificationsController],
  exports:     [NotificationsService, WhatsAppService],
})
export class NotificationsModule {}
