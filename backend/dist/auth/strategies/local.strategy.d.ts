import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
declare const LocalStrategy_base: new (...args: [] | [options: import("passport-local").IStrategyOptionsWithRequest] | [options: import("passport-local").IStrategyOptions]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class LocalStrategy extends LocalStrategy_base {
    private authService;
    constructor(authService: AuthService);
    validate(username: string, password: string): Promise<{
        business: {
            gstin: string | null;
            id: string;
            name: string;
            stateName: string;
        };
        username: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        id: string;
        businessId: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        lastLoginIp: string | null;
        counterId: string | null;
        assignedCounterIds: string | null;
        createdById: string | null;
        createdByName: string | null;
        updatedById: string | null;
        updatedByName: string | null;
        deletedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
