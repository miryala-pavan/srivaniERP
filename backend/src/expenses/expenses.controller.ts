import {
  Controller, Get, Post, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditLogService } from '../audit-log/audit-log.service';

const EXPENSE_ROLES = [
  'SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON',
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...EXPENSE_ROLES)
@Controller('expenses')
export class ExpensesController {
  constructor(
    private expensesService: ExpensesService,
    private auditLog: AuditLogService,
  ) {}

  @Get('categories')
  getCategories(@Request() req: any) {
    return this.expensesService.getCategories(req.user.businessId);
  }

  @Post()
  async create(@Request() req: any, @Body() dto: CreateExpenseDto) {
    const expense = await this.expensesService.create(req.user.businessId, dto);
    this.auditLog.log(
      { userId: req.user.userId, userName: req.user.fullName ?? req.user.username ?? 'Unknown', userRole: req.user.role, businessId: req.user.businessId },
      { action: 'CREATE', entity: 'EXPENSE', entityId: expense.id, description: `Expense added: ${dto.category} — ₹${dto.amount}` },
    ).catch(() => {});
    return expense;
  }

  @Get()
  findAll(@Request() req: any, @Query() query: ExpenseQueryDto) {
    return this.expensesService.findAll(req.user.businessId, query);
  }
}
