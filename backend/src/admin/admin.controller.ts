import { Controller, Get, Post, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('taxes')
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'ACCOUNTS_PERSON', 'VIEWER')
  getTaxes(@Request() req: any) {
    return this.adminService.getTaxes(req.user.businessId);
  }

  @Post('seed')
  seed(@Request() req: any) {
    return this.adminService.seed(req.user.businessId);
  }

  @Post('fix-product-data')
  fixProductData(@Request() req: any) {
    return this.adminService.fixProductData(req.user.businessId);
  }

  @Post('reset-bill-series')
  @HttpCode(200)
  resetBillSeries(@Request() req: any, @Body() body: {
    taxInvoiceStart?: number;
    retailInvoiceStart?: number;
    estimateStart?: number;
  }) {
    return this.adminService.resetBillSeries(req.user.businessId, body);
  }
}
