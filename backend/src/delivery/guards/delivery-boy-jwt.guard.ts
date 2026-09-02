import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { DeliveryBoyJwtPayload } from '../delivery-boy-auth.service';

/**
 * Gates rider-app routes on a phone actually verified via WhatsApp OTP —
 * separate secret/JwtService instance from both the staff JwtStrategy and
 * StorefrontJwtGuard, mirroring exactly why StorefrontJwtGuard does the
 * same: a leaked rider token must never be replayable against ERP staff
 * routes or storefront customer routes, and vice versa. Also checks a
 * `type` discriminator in the payload as a second guard against that.
 */
@Injectable()
export class DeliveryBoyJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Rider login required');

    let payload: DeliveryBoyJwtPayload;
    try {
      payload = this.jwtService.verify<DeliveryBoyJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired login — please verify your phone again');
    }
    if (payload.type !== 'delivery_boy' || !payload.deliveryBoyId) {
      throw new UnauthorizedException('Invalid rider token');
    }

    req.deliveryBoyId = payload.deliveryBoyId;
    req.businessId = payload.businessId;
    return true;
  }
}
