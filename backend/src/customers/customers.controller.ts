import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
  'FLOOR_SUPERVISOR', 'SALES_REP', 'CASHIER',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(req.user.businessId, dto);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: CustomerQueryDto) {
    return this.customersService.findAll(req.user.businessId, query);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.customersService.findOne(req.user.businessId, id);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(req.user.businessId, id, dto);
  }
}
