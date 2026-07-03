import { Module } from '@nestjs/common';
import {
  EmailProvider,
  SmsProvider,
  WhatsAppProvider,
} from './notification.provider.interface';
import { NodemailerEmailProvider } from './providers/email.provider';
import { StubSmsProvider } from './providers/sms.provider';
import { StubWhatsAppProvider } from './providers/whatsapp.provider';

@Module({
  providers: [
    { provide: EmailProvider, useClass: NodemailerEmailProvider },
    { provide: SmsProvider, useClass: StubSmsProvider },
    { provide: WhatsAppProvider, useClass: StubWhatsAppProvider },
  ],
  exports: [EmailProvider, SmsProvider, WhatsAppProvider],
})
export class PlatformNotificationsModule {}
