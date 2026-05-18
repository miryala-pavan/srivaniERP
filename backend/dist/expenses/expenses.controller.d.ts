import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
export declare class ExpensesController {
    private expensesService;
    constructor(expensesService: ExpensesService);
    getCategories(req: any): Promise<{
        categories: string[];
    }>;
    create(req: any, dto: CreateExpenseDto): Promise<{
        category: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        description: string | null;
        branchId: string | null;
        paymentMode: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        expenseDate: Date;
        vendorName: string | null;
        referenceNo: string | null;
        remarks: string | null;
    }>;
    findAll(req: any, query: ExpenseQueryDto): Promise<{
        data: {
            category: string | null;
            id: string;
            businessId: string;
            createdAt: Date;
            description: string | null;
            branchId: string | null;
            paymentMode: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            expenseDate: Date;
            vendorName: string | null;
            referenceNo: string | null;
            remarks: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            totalAmount: number;
        };
    }>;
}
