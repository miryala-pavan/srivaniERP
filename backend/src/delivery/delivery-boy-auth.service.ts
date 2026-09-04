import { Injectable, Logger, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Dev-only universal code — lets any active rider log in without a real
// WhatsApp send during development (rider OTP has no Meta-approved
// AUTHENTICATION template yet, so real sends only work within a 24h
// session window — see this file's class comment).
//
// Gated on TWO independent conditions, not just NODE_ENV: production was
// found to be running with NODE_ENV unset (confirmed via the live
// process's actual environment, not just its .env file), which would have
// silently defeated a NODE_ENV-only guard - the exact bug this second,
// explicit RIDER_OTP_DEV_MODE flag exists to survive. It must be the
// literal string 'true' and is absent from prod's .env by default, so
// this stays off even if NODE_ENV is ever misconfigured again. Also gates
// the [DEV] plaintext-OTP log line below, for the same reason.
function riderOtpDevModeEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.RIDER_OTP_DEV_MODE === 'true';
}
const DEV_BYPASS_CODE = '000000';

export interface DeliveryBoyJwtPayload {
  deliveryBoyId: string;
  businessId: string;
  type: 'delivery_boy';
}

/**
 * Phone+OTP auth for delivery boys — same shape as StorefrontAuthService,
 * except the OTP is a plain WhatsApp text message (a rider isn't a
 * consumer-facing flow needing a Meta-approved AUTHENTICATION template;
 * sendTextMessage only works within an open 24h session, so a rider must
 * have messaged the store's WhatsApp number at least once — the natural
 * onboarding step when staff add them as a rider).
 */
@Injectable()
export class DeliveryBoyAuthService {
  private readonly logger = new Logger(DeliveryBoyAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async requestOtp(businessId: string, phone: string): Promise<{ sent: boolean }> {
    const rider = await this.prisma.deliveryBoy.findFirst({
      where: { businessId, phone, active: true },
    });
    if (!rider) throw new NotFoundException('No active delivery boy registered with this number');

    // 6 digits — matches VerifyRiderOtpDto's validation and the rider app's
    // input mask. (Not to be confused with the 4-digit delivery-confirmation
    // OTP in ConfirmDeliveryDto — a separate, unrelated code.)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await argon2.hash(code);

    await this.prisma.deliveryBoyOtp.deleteMany({ where: { deliveryBoyId: rider.id } });
    await this.prisma.deliveryBoyOtp.create({
      data: { deliveryBoyId: rider.id, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    if (riderOtpDevModeEnabled()) {
      this.logger.warn(`[DEV] Rider OTP for ${phone}: ${code}`);
    }

    try {
      await this.whatsapp.sendTextMessage(businessId, phone, `Your Srivani Rider login code: ${code} (valid 5 minutes)`);
      return { sent: true };
    } catch (err) {
      this.logger.error(`Rider OTP WhatsApp send failed for ${phone}: ${err instanceof Error ? err.message : err}`);
      return { sent: false };
    }
  }

  async verifyOtp(businessId: string, phone: string, code: string): Promise<{ token: string; deliveryBoyId: string; name: string }> {
    const rider = await this.prisma.deliveryBoy.findFirst({
      where: { businessId, phone, active: true },
    });
    if (!rider) throw new NotFoundException('No active delivery boy registered with this number');

    if (riderOtpDevModeEnabled() && code === DEV_BYPASS_CODE) {
      this.logger.warn(`[DEV] Rider login via universal bypass code for ${phone}`);
      await this.prisma.deliveryBoyOtp.deleteMany({ where: { deliveryBoyId: rider.id } });
      const payload: DeliveryBoyJwtPayload = { deliveryBoyId: rider.id, businessId, type: 'delivery_boy' };
      return { token: this.jwtService.sign(payload), deliveryBoyId: rider.id, name: rider.name };
    }

    const row = await this.prisma.deliveryBoyOtp.findFirst({
      where: { deliveryBoyId: rider.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new BadRequestException('No code pending — request a new one');
    if (row.expiresAt < new Date()) {
      await this.prisma.deliveryBoyOtp.delete({ where: { id: row.id } });
      throw new BadRequestException('Code expired — request a new one');
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await this.prisma.deliveryBoyOtp.delete({ where: { id: row.id } });
      throw new BadRequestException('Too many incorrect attempts — request a new code');
    }

    const valid = await argon2.verify(row.codeHash, code);
    if (!valid) {
      await this.prisma.deliveryBoyOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      const remaining = MAX_ATTEMPTS - (row.attempts + 1);
      throw new UnauthorizedException(
        remaining > 0 ? `Incorrect code — ${remaining} attempt${remaining === 1 ? '' : 's'} left` : 'Too many incorrect attempts — request a new code',
      );
    }

    await this.prisma.deliveryBoyOtp.delete({ where: { id: row.id } });

    const payload: DeliveryBoyJwtPayload = { deliveryBoyId: rider.id, businessId, type: 'delivery_boy' };
    const token = this.jwtService.sign(payload);
    return { token, deliveryBoyId: rider.id, name: rider.name };
  }
}
