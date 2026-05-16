import { OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService implements OnModuleInit {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    onModuleInit(): Promise<void>;
    validateUser(username: string, password: string): Promise<{
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
    } | null>;
    validateUserByPin(username: string, pinInput: string): Promise<{
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
    } | null>;
    login(user: any): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            fullName: any;
            role: any;
            businessId: any;
            counterId: any;
            business: any;
        };
    }>;
    register(dto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: string;
            username: string;
            fullName: string;
            role: import(".prisma/client").$Enums.UserRole;
            businessId: string;
            counterId: null;
        };
    }>;
    verifyPin(userId: string, pin: string): Promise<boolean>;
    getMe(userId: string): Promise<{
        business: {
            gstin: string | null;
            id: string;
            name: string;
            stateCode: string;
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
        lastLoginAt: Date | null;
        counterId: string | null;
        createdAt: Date;
    } | null>;
    private seedTestUser;
}
