import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  phone: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly configured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const publicKey  = config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    const subject    = config.get<string>('VAPID_SUBJECT');
    this.configured = !!(publicKey && privateKey && subject);
    if (this.configured) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled. Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT.');
    }
  }

  async subscribe(businessId: string, userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.prisma.pushSubscription.upsert({
      where:  { endpoint: sub.endpoint },
      update: { businessId, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      create: { businessId, userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  }

  async unsubscribe(businessId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { businessId, endpoint } });
    return { message: 'Unsubscribed' };
  }

  /** Fire-and-forget push to every subscribed device for a business — callers should .catch(). */
  async sendToBusiness(businessId: string, payload: PushPayload): Promise<void> {
    if (!this.configured) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { businessId } });
    await this.deliver(subs, payload);
  }

  /** Fire-and-forget push to every subscribed device for one specific user — callers should .catch(). */
  async sendToUser(businessId: string, userId: string, payload: PushPayload): Promise<void> {
    if (!this.configured) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { businessId, userId } });
    await this.deliver(subs, payload);
  }

  private async deliver(subs: { id: string; endpoint: string; p256dh: string; auth: string }[], payload: PushPayload): Promise<void> {
    if (subs.length === 0) return;

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        // 404/410 = the subscription expired or was revoked on the browser
        // side — standard web-push hygiene is to drop it rather than keep
        // retrying a dead endpoint forever.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await this.prisma.pushSubscription.deleteMany({ where: { id: sub.id } }).catch(() => {});
        } else {
          this.logger.warn(`Push send failed for subscription ${sub.id}: ${err?.message ?? err}`);
        }
      }
    }));
  }
}
