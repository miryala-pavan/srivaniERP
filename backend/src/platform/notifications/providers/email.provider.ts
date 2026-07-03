import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailProvider, SendEmailDto } from '../notification.provider.interface';

@Injectable()
export class NodemailerEmailProvider extends EmailProvider {
  private readonly logger = new Logger(NodemailerEmailProvider.name);
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async send(dto: SendEmailDto): Promise<{ messageId: string }> {
    const info = await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@srivani.store',
      to: Array.isArray(dto.to) ? dto.to.join(', ') : dto.to,
      subject: dto.subject,
      html: dto.html,
      text: dto.text,
    });
    this.logger.log(`Email sent: ${info.messageId as string}`);
    return { messageId: info.messageId as string };
  }
}
