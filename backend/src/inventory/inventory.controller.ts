import {
  Controller, Get, Post, Body, Query, UseGuards, Request, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { StockTakeDto } from './dto/stock-take.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const INVENTORY_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'PURCHASE_CHECKER', 'FLOOR_SUPERVISOR',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...INVENTORY_ROLES)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post('adjust')
  adjust(@Request() req: any, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjust(req.user.businessId, dto);
  }

  @Get('movements')
  getMovements(@Request() req: any, @Query() query: MovementQueryDto) {
    return this.inventoryService.getMovements(req.user.businessId, query);
  }

  @Post('stock-take')
  stockTake(@Request() req: any, @Body() dto: StockTakeDto) {
    return this.inventoryService.stockTake(req.user.businessId, req.user.userId, dto);
  }

  @Get('stock-take/template')
  async stockTakeTemplate(@Request() req: any, @Res() res: Response) {
    const csv = await this.inventoryService.getStockTakeTemplate(req.user.businessId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stock-take-template.csv"');
    res.send(csv);
  }

  @Get('stock-levels')
  getStockLevels(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.inventoryService.getStockLevels(req.user.businessId, branchId);
  }

  @Get('opening-stock')
  getOpeningStockSummary(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.inventoryService.getOpeningStockSummary(req.user.businessId, branchId);
  }
}
