import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StorefrontJwtPayload } from '../storefront-auth.service';

/**
 * Gates storefront customer routes (addresses, profile, orders) on a phone
 * actually verified via WhatsApp OTP — separate secret/JwtService instance
 * from the staff JwtStrategy so a leaked storefront token can never be
 * replayed against ERP staff routes, and vice versa (also checks a `type`
 * discriminator in the payload as a second guard against that).
 */
@Injectable()
export class StorefrontJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Phone verification required');

    let payload: StorefrontJwtPayload;
    try {
      payload = this.jwtService.verify<StorefrontJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired verification — please verify your phone again');
    }
    if (payload.type !== 'storefront' || !payload.phone) {
      throw new UnauthorizedException('Invalid verification token');
    }

    req.verifiedPhone = payload.phone;
    req.verifiedBusinessId = payload.businessId;
    return true;
  }
}
