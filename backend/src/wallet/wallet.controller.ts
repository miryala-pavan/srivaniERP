import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WalletAdjustDto } from './dto/wallet-adjust.dto';

// Viewing is open to order-handling staff; manual credit/debit is
// restricted to managers — it moves money.
const VIEW_ROLES   = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'ACCOUNTS_PERSON', 'BILLING_STAFF'];
const ADJUST_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Roles(...VIEW_ROLES)
  @Get(':customerId')
  getWallet(@Request() req: any, @Param('customerId') customerId: string) {
    return this.wallet.getWallet(req.user.businessId, customerId);
  }

  @Roles(...VIEW_ROLES)
  @Get(':customerId/transactions')
  listTransactions(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wallet.listTransactions(
      req.user.businessId, customerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Roles(...ADJUST_ROLES)
  @Post(':customerId/credit')
  credit(@Request() req: any, @Param('customerId') customerId: string, @Body() dto: WalletAdjustDto) {
    return this.wallet.credit(req.user.businessId, customerId, dto.amount, dto.reason, {
      relatedType: dto.relatedType ?? 'MANUAL',
      relatedId: dto.relatedId,
      createdByName: req.user.fullName ?? req.user.username ?? 'Unknown',
    });
  }

  @Roles(...ADJUST_ROLES)
  @Post(':customerId/debit')
  debit(@Request() req: any, @Param('customerId') customerId: string, @Body() dto: WalletAdjustDto) {
    return this.wallet.debit(req.user.businessId, customerId, dto.amount, dto.reason, {
      relatedType: dto.relatedType ?? 'MANUAL',
      relatedId: dto.relatedId,
      createdByName: req.user.fullName ?? req.user.username ?? 'Unknown',
    });
  }
}
