export interface SendEmailDto {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendSmsDto {
  to: string;
  message: string;
}

export interface SendWhatsAppDto {
  to: string;
  message: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export abstract class EmailProvider {
  abstract send(dto: SendEmailDto): Promise<{ messageId: string }>;
}

export abstract class SmsProvider {
  abstract send(dto: SendSmsDto): Promise<{ messageId: string }>;
}

export abstract class WhatsAppProvider {
  abstract send(dto: SendWhatsAppDto): Promise<{ messageId: string }>;
}
