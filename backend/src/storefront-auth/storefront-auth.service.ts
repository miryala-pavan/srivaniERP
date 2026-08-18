import { Injectable, Logger, BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const AUTH_TEMPLATE_NAME = 'svn_storefront_otp';

export interface StorefrontJwtPayload {
  phone: string;
  businessId: string;
  type: 'storefront';
}

@Injectable()
export class StorefrontAuthService {
  private readonly logger = new Logger(StorefrontAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  private async getBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  async requestOtp(phone: string): Promise<{ sent: boolean }> {
    const businessId = await this.getBusinessId();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await argon2.hash(code);

    // One live code per phone — a fresh request invalidates any prior one.
    await this.prisma.storefrontOtp.deleteMany({ where: { phone } });
    await this.prisma.storefrontOtp.create({
      data: { phone, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    // Dev/staging visibility: the Meta AUTHENTICATION template needs approval
    // before real sends work, so this keeps local testing unblocked in the
    // meantime — mirrors the same NODE_ENV bypass the old Firebase flow used.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.warn(`[DEV] Storefront OTP for ${phone}: ${code}`);
    }

    const result = await this.whatsapp.sendTemplateToNumber(businessId, phone, AUTH_TEMPLATE_NAME, 'en', [code]);
    if (!result.ok) {
      this.logger.error(`Storefront OTP WhatsApp send failed for ${phone}: ${result.reason}`);
    }
    return { sent: result.ok };
  }

  async verifyOtp(phone: string, code: string): Promise<{ token: string; phone: string }> {
    const businessId = await this.getBusinessId();
    const row = await this.prisma.storefrontOtp.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new BadRequestException('No code pending — request a new one');
    if (row.expiresAt < new Date()) {
      await this.prisma.storefrontOtp.delete({ where: { id: row.id } });
      throw new BadRequestException('Code expired — request a new one');
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await this.prisma.storefrontOtp.delete({ where: { id: row.id } });
      throw new BadRequestException('Too many incorrect attempts — request a new code');
    }

    const valid = await argon2.verify(row.codeHash, code);
    if (!valid) {
      await this.prisma.storefrontOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      const remaining = MAX_ATTEMPTS - (row.attempts + 1);
      throw new UnauthorizedException(
        remaining > 0 ? `Incorrect code — ${remaining} attempt${remaining === 1 ? '' : 's'} left` : 'Too many incorrect attempts — request a new code',
      );
    }

    await this.prisma.storefrontOtp.delete({ where: { id: row.id } });

    const payload: StorefrontJwtPayload = { phone, businessId, type: 'storefront' };
    const token = this.jwtService.sign(payload);
    return { token, phone };
  }

  /** One-time: submit the AUTHENTICATION-category OTP template to Meta for approval. */
  async registerOtpTemplate() {
    return this.whatsapp.createTemplate({
      name: AUTH_TEMPLATE_NAME,
      category: 'AUTHENTICATION',
      language: 'en',
      authentication: { codeExpirationMinutes: 5, addSecurityRecommendation: true, otpType: 'COPY_CODE' },
    });
  }
}
