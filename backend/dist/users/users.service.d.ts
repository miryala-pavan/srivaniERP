import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPinDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(businessId: string): Promise<{
        counterName: string | null;
        isActive: boolean;
        username: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        id: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        lastLoginAt: Date | null;
        counterId: string | null;
        createdByName: string | null;
        createdAt: Date;
    }[]>;
    findOne(id: string, businessId: string): Promise<{
        isActive: boolean;
        username: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        id: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        lastLoginAt: Date | null;
        counterId: string | null;
        assignedCounterIds: string | null;
        createdByName: string | null;
        createdAt: Date;
    }>;
    create(businessId: string, dto: CreateUserDto, createdBy: {
        id: string;
        fullName: string;
    }): Promise<{
        isActive: boolean;
        username: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        id: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        lastLoginAt: Date | null;
        counterId: string | null;
        createdByName: string | null;
        createdAt: Date;
    }>;
    update(id: string, businessId: string, dto: UpdateUserDto, updatedBy: {
        id: string;
        fullName: string;
    }): Promise<{
        isActive: boolean;
        username: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        id: string;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        lastLoginAt: Date | null;
        counterId: string | null;
        createdByName: string | null;
        createdAt: Date;
    }>;
    resetPin(id: string, businessId: string, dto: ResetPinDto, resetBy: {
        id: string;
        fullName: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    toggleActive(id: string, businessId: string, requesterId: string): Promise<{
        isActive: boolean;
        status: string;
    }>;
    getCounters(businessId: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        code: string;
    }[]>;
}
