import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { InternalNoteService } from './internal-note.service';
import { CannedReplyService } from './canned-reply.service';
import { PushService } from './push.service';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [EventsModule, PrismaModule],
  providers:   [NotificationsService, WhatsAppService, EmailService, InternalNoteService, CannedReplyService, PushService],
  controllers: [NotificationsController],
  exports:     [NotificationsService, WhatsAppService, EmailService, InternalNoteService, CannedReplyService, PushService],
})
export class NotificationsModule {}
