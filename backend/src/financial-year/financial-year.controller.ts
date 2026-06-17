import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { FinancialYearService } from './financial-year.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard }   from '../auth/guards/roles.guard';
import { Roles }        from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('financial-year')
export class FinancialYearController {
  constructor(private fyService: FinancialYearService) {}

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get()
  listAll(@Request() req: any) {
    return this.fyService.listAll(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('active')
  getActive(@Request() req: any) {
    return this.fyService.getActive(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('close-preview')
  getClosePreview(@Request() req: any) {
    return this.fyService.getClosePreview(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get('comparison')
  getComparison(@Request() req: any) {
    return this.fyService.getYearComparison(req.user.businessId);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON')
  @Get(':id')
  getById(@Request() req: any, @Param('id') id: string) {
    return this.fyService.getById(req.user.businessId, id);
  }

  // Only SUPER_ADMIN can close a year
  @Roles('SUPER_ADMIN')
  @Post('close')
  closeYear(@Request() req: any) {
    return this.fyService.closeYear(req.user.businessId);
  }
}
