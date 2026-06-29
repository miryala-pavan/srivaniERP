import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { StockAlertsService } from './stock-alerts.service';
import { SubscribeStockAlertDto } from './dto/subscribe.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ADMIN_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR'];

@Controller('stock-alerts')
export class StockAlertsController {
  constructor(private readonly service: StockAlertsService) {}

  @Post()
  subscribe(@Body() dto: SubscribeStockAlertDto) {
    return this.service.subscribe(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Post(':pluBarcode/notify')
  notifySubscribers(
    @Param('pluBarcode') pluBarcode: string,
    @Body('productUrl') productUrl?: string,
  ) {
    return this.service.notifySubscribers(pluBarcode, productUrl);
  }
}
