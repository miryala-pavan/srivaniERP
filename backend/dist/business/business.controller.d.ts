import { BusinessService } from './business.service';
import { SetupDto } from './dto/setup.dto';
export declare class BusinessController {
    private businessService;
    constructor(businessService: BusinessService);
    getSetupStatus(): Promise<{
        exists: boolean;
    }>;
    setup(dto: SetupDto): Promise<{
        business: {
            gstin: string | null;
            email: string | null;
            phone: string | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            stateCode: string;
            stateName: string;
            address: string | null;
            fssaiLicense: string | null;
            isActive: boolean;
        };
        branch: {
            phone: string | null;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            address: string | null;
            isActive: boolean;
        };
        financialYear: {
            id: string;
            businessId: string;
            createdAt: Date;
            isActive: boolean;
            fyCode: string;
            startDate: Date;
            endDate: Date;
        };
        message: string;
    }>;
    getInfo(req: any): Promise<({
        branches: {
            phone: string | null;
            id: string;
            businessId: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            address: string | null;
            isActive: boolean;
        }[];
        financialYears: {
            id: string;
            businessId: string;
            createdAt: Date;
            isActive: boolean;
            fyCode: string;
            startDate: Date;
            endDate: Date;
        }[];
    } & {
        gstin: string | null;
        email: string | null;
        phone: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        stateCode: string;
        stateName: string;
        address: string | null;
        fssaiLicense: string | null;
        isActive: boolean;
    }) | null>;
}
