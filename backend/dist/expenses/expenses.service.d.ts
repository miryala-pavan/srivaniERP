import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
export declare class ExpensesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateExpenseDto): Promise<{
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
    findAll(businessId: string, query: ExpenseQueryDto): Promise<{
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
    getCategories(businessId: string): Promise<{
        categories: string[];
    }>;
}
