import { Controller, Get, Post, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { ProductGroupsService } from './product-groups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MGMT_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MGMT_ROLES)
@Controller('product-groups')
export class ProductGroupsController {
  constructor(private svc: ProductGroupsService) {}

  @Get()
  listGroups(@Request() req: any) {
    return this.svc.listGroups(req.user.businessId);
  }

  @Get('auto-detect')
  autoDetect(@Request() req: any) {
    return this.svc.autoDetect(req.user.businessId);
  }

  @Post()
  createGroup(@Request() req: any, @Body() body: { name: string; members: { productId: string; displayLabel: string }[] }) {
    return this.svc.createGroup(req.user.businessId, body.name, body.members);
  }

  @Post(':groupId/members')
  addMember(@Request() req: any, @Param('groupId') groupId: string, @Body() body: { productId: string; displayLabel: string }) {
    return this.svc.addMember(req.user.businessId, groupId, body.productId, body.displayLabel);
  }

  @Patch('members/:memberId')
  updateMember(@Request() req: any, @Param('memberId') memberId: string, @Body() body: { displayLabel?: string; sortOrder?: number }) {
    return this.svc.updateMember(req.user.businessId, memberId, body);
  }

  @Delete('members/:memberId')
  removeMember(@Request() req: any, @Param('memberId') memberId: string) {
    return this.svc.removeMember(req.user.businessId, memberId);
  }

  @Delete(':groupId')
  deleteGroup(@Request() req: any, @Param('groupId') groupId: string) {
    return this.svc.deleteGroup(req.user.businessId, groupId);
  }
}
