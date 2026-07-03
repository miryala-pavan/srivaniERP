import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SendSmsDto } from '../notification.provider.interface';

// Stub — wire a real provider (e.g. Twilio, MSG91) when SMS is needed
@Injectable()
export class StubSmsProvider extends SmsProvider {
  private readonly logger = new Logger(StubSmsProvider.name);

  async send(dto: SendSmsDto): Promise<{ messageId: string }> {
    this.logger.warn(`[STUB] SMS to ${dto.to}: ${dto.message}`);
    return { messageId: `stub-sms-${Date.now()}` };
  }
}
