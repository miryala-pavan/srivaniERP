import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
export declare class CustomersService {
    private prisma;
    constructor(prisma: PrismaService);
    create(businessId: string, dto: CreateCustomerDto): Promise<{
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string | null;
        address: string | null;
        isActive: boolean;
        creditLimit: import("@prisma/client/runtime/library").Decimal;
        outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        customerType: string;
        loyaltyPoints: number;
    }>;
    findAll(businessId: string, query: CustomerQueryDto): Promise<{
        data: {
            gstin: string | null;
            email: string | null;
            phone: string | null;
            id: string;
            createdAt: Date;
            name: string;
            outstandingBalance: import("@prisma/client/runtime/library").Decimal;
            customerType: string;
            loyaltyPoints: number;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    findOne(businessId: string, id: string): Promise<{
        stats: {
            totalBills: number;
            totalPurchased: number;
            totalPaid: number;
            outstandingBalance: number;
        };
        recentBills: {
            id: string;
            status: import(".prisma/client").$Enums.BillStatus;
            grandTotal: import("@prisma/client/runtime/library").Decimal;
            paidAmount: import("@prisma/client/runtime/library").Decimal;
            balanceAmount: import("@prisma/client/runtime/library").Decimal;
            paymentMode: import(".prisma/client").$Enums.PaymentMode;
            billNumber: string | null;
            billDate: Date;
        }[];
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string | null;
        address: string | null;
        isActive: boolean;
        creditLimit: import("@prisma/client/runtime/library").Decimal;
        outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        customerType: string;
        loyaltyPoints: number;
    }>;
    update(businessId: string, id: string, dto: UpdateCustomerDto): Promise<{
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string | null;
        address: string | null;
        isActive: boolean;
        creditLimit: import("@prisma/client/runtime/library").Decimal;
        outstandingBalance: import("@prisma/client/runtime/library").Decimal;
        customerType: string;
        loyaltyPoints: number;
    }>;
}
