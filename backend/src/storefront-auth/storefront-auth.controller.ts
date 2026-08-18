import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { StorefrontAuthService } from './storefront-auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('storefront-auth')
export class StorefrontAuthController {
  constructor(private readonly service: StorefrontAuthService) {}

  // Tight limit — this is the real abuse surface (spamming WhatsApp sends /
  // enumerating phone numbers), distinct from the generic app-wide throttle.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.service.requestOtp(dto.phone);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.service.verifyOtp(dto.phone, dto.code);
  }

  /** One-time: submit the AUTHENTICATION-category OTP template to Meta for approval. SUPER_ADMIN only. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('register-otp-template')
  registerOtpTemplate() {
    return this.service.registerOtpTemplate();
  }
}
