import { DepartmentsService } from './departments.service';
export declare class DepartmentsController {
    private svc;
    constructor(svc: DepartmentsService);
    findAll(req: any, isActive?: string): Promise<{
        id: string;
        name: string;
        code: string;
        sortOrder: number;
        isActive: boolean;
        createdAt: Date;
        categoryCount: number;
    }[]>;
    create(req: any, body: {
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
    update(req: any, id: string, body: {
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
    remove(req: any, id: string): Promise<{
        message: string;
    }>;
    getCategories(req: any, id: string): Promise<{
        id: string;
        name: string;
        code: string;
        label: string;
        sortOrder: number;
        isActive: boolean;
        subCategoryCount: number;
    }[]>;
}
