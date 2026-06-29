import {
  Controller, Get, Post, Delete, Query, Param, Body, UseGuards,
} from '@nestjs/common';
import { VolumePricingService } from './volume-pricing.service';
import { CreateVolumeTierDto } from './dto/create-tier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ADMIN_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER'] as const;

@Controller('volume-pricing')
export class VolumePricingController {
  constructor(private readonly service: VolumePricingService) {}

  // Public — storefront product page reads tiers to show discount table
  @Get()
  getByPlu(@Query('pluBarcode') pluBarcode: string) {
    return this.service.getByPlu(pluBarcode ?? '');
  }

  // Admin — create or update a tier (upsert on pluBarcode+minQty)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  create(@Body() dto: CreateVolumeTierDto) {
    return this.service.create(dto);
  }

  // Admin — delete a tier by id
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
