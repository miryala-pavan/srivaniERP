import { Controller, Post, Body } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryBoyAuthService } from './delivery-boy-auth.service';
import { RequestRiderOtpDto } from './dto/request-rider-otp.dto';
import { VerifyRiderOtpDto } from './dto/verify-rider-otp.dto';
import { NotFoundException } from '@nestjs/common';

// Public — no staff/rider JWT yet, this IS the login flow. Same tight
// per-route throttle as StorefrontAuthController (the real abuse surface
// here is WhatsApp-send spam / phone enumeration, not the generic app-wide
// throttle).
@Controller('rider-auth')
export class RiderAuthController {
  constructor(
    private readonly service: DeliveryBoyAuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/request')
  async requestOtp(@Body() dto: RequestRiderOtpDto) {
    const businessId = await this.resolveBusinessId();
    return this.service.requestOtp(businessId, dto.phone);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyRiderOtpDto) {
    const businessId = await this.resolveBusinessId();
    return this.service.verifyOtp(businessId, dto.phone, dto.code);
  }
}
