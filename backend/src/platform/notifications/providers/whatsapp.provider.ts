import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppProvider, SendWhatsAppDto } from '../notification.provider.interface';

// Stub — delegates to the existing WhatsAppService until platform migration
@Injectable()
export class StubWhatsAppProvider extends WhatsAppProvider {
  private readonly logger = new Logger(StubWhatsAppProvider.name);

  async send(dto: SendWhatsAppDto): Promise<{ messageId: string }> {
    this.logger.warn(`[STUB] WhatsApp to ${dto.to}: ${dto.message}`);
    return { messageId: `stub-wa-${Date.now()}` };
  }
}
