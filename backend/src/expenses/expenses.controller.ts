import {
  Controller, Get, Post, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const EXPENSE_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...EXPENSE_ROLES)
@Controller('expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  // Static before parameterised
  @Get('categories')
  getCategories(@Request() req: any) {
    return this.expensesService.getCategories(req.user.businessId);
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(req.user.businessId, dto);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: ExpenseQueryDto) {
    return this.expensesService.findAll(req.user.businessId, query);
  }
}
