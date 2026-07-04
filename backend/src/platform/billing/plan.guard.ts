import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * PlanGuard — applied globally (or per-controller) to block expired / suspended tenants.
 *
 * Behaviour:
 *   • ACTIVE + planExpiresAt in future → allowed
 *   • planExpiresAt has passed          → sets planStatus=EXPIRED, throws 403 PLAN_EXPIRED
 *   • planStatus EXPIRED | SUSPENDED    → throws 403 immediately (no DB update needed)
 *   • No Tenant row for businessId      → allowed (legacy business or public route)
 *   • No businessId in JWT              → allowed (auth guard handles that separately)
 *
 * Response body on rejection:
 *   { statusCode: 403, code: "PLAN_EXPIRED", message: "...", expiresAt: "<date>" }
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { businessId?: string } }>();
    const businessId = req.user?.businessId;

    // No businessId in token → public or unauthenticated route; let other guards decide
    if (!businessId) return true;

    const tenant = await this.prisma.tenant.findUnique({
      where: { businessId },
      select: { id: true, planStatus: true, planExpiresAt: true, plan: true },
    });

    // No Tenant row → legacy business (pre-billing), allow through
    if (!tenant) return true;

    // Already marked EXPIRED or SUSPENDED
    if (tenant.planStatus === 'EXPIRED' || tenant.planStatus === 'SUSPENDED') {
      throw new ForbiddenException({
        code: 'PLAN_EXPIRED',
        message:
          'Your subscription has expired or been suspended. Please renew at erp.srivani.com/billing.',
        plan: tenant.plan,
        expiresAt: tenant.planExpiresAt,
      });
    }

    // Check live expiry date
    if (tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
      // Auto-transition to EXPIRED so future requests skip the date check
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { planStatus: 'EXPIRED' },
      });
      throw new ForbiddenException({
        code: 'PLAN_EXPIRED',
        message:
          'Your annual subscription expired on ' +
          tenant.planExpiresAt.toLocaleDateString('en-IN') +
          '. Please renew to continue.',
        plan: tenant.plan,
        expiresAt: tenant.planExpiresAt,
      });
    }

    return true;
  }
}
