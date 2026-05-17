import { PrismaService } from '../prisma/prisma.service';
export declare class DepartmentsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(businessId: string, isActive?: string): Promise<{
        id: string;
        name: string;
        code: string;
        sortOrder: number;
        isActive: boolean;
        createdAt: Date;
        categoryCount: number;
    }[]>;
    create(businessId: string, body: {
        name: string;
        code: string;
        sortOrder?: number;
    }): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        code: string;
        sortOrder: number;
    }>;
    update(businessId: string, id: string, body: {
        name?: string;
        sortOrder?: number;
        isActive?: boolean;
    }): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        isActive: boolean;
        code: string;
        sortOrder: number;
    }>;
    remove(businessId: string, id: string): Promise<{
        message: string;
    }>;
    getCategories(businessId: string, id: string): Promise<{
        id: string;
        name: string;
        code: string;
        label: string;
        sortOrder: number;
        isActive: boolean;
        subCategoryCount: number;
    }[]>;
}
