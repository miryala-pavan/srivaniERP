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

  @Post('seed-departments')
  seedDepartments(@Request() req: any) {
    return this.adminService.seedDepartments(req.user.businessId);
  }

  @Post('repair-product-plus')
  repairProductPlus(@Request() req: any) {
    return this.adminService.repairProductPlus(req.user.businessId);
  }

  @Post('migrate-orphans-phase-1')
  migrateOrphansPhase1(@Request() req: any) {
    return this.adminService.migrateOrphansPhase1(req.user.businessId);
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
