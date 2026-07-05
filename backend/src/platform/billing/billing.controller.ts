import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly prisma: PrismaService) {}

  /** Current tenant's subscription status. Legacy businesses without a Tenant
   *  row are treated as perpetual (pre-billing). */
  @Get('plan')
  async plan(@Request() req: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { businessId: req.user.businessId },
      select: {
        plan: true,
        planStatus: true,
        planStartedAt: true,
        planExpiresAt: true,
        trialEndsAt: true,
        onboardingStatus: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      return { plan: 'LEGACY', planStatus: 'ACTIVE', planExpiresAt: null, note: 'Pre-billing business — no subscription enforcement' };
    }

    const daysLeft = tenant.planExpiresAt
      ? Math.ceil((tenant.planExpiresAt.getTime() - Date.now()) / 86400000)
      : null;

    return { ...tenant, daysLeft };
  }
}
