import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SocialWebhookController } from './social-webhook.controller';
import { WhatsAppService } from './whatsapp.service';
import { EmailService } from './email.service';
import { InternalNoteService } from './internal-note.service';
import { CannedReplyService } from './canned-reply.service';
import { PushService } from './push.service';
import { EscalationCheckerService } from './escalation-checker.service';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { ReminderRuleCheckerService } from './reminder-rule-checker.service';
import { SocialMessagingService } from './social-messaging.service';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ShopModule } from '../shop/shop.module';
import { AiAgentModule } from '../ai-agent/ai-agent.module';

@Module({
  imports:     [EventsModule, PrismaModule, AuditLogModule, ShopModule, AiAgentModule],
  providers:   [NotificationsService, WhatsAppService, EmailService, InternalNoteService, CannedReplyService, PushService, SocialMessagingService, EscalationCheckerService, CampaignSchedulerService, ReminderRuleCheckerService],
  controllers: [NotificationsController, SocialWebhookController],
  exports:     [NotificationsService, WhatsAppService, EmailService, InternalNoteService, CannedReplyService, PushService, SocialMessagingService],
})
export class NotificationsModule {}
