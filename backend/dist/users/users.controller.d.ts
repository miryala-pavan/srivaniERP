import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ResetPinDto } from './dto/update-user.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    findAll(req: any): Promise<{
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
    getCounters(req: any): Promise<{
        id: string;
        name: string;
        code: string;
        description: string | null;
    }[]>;
    findOne(id: string, req: any): Promise<{
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
    create(dto: CreateUserDto, req: any): Promise<{
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
    update(id: string, dto: UpdateUserDto, req: any): Promise<{
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
    resetPin(id: string, dto: ResetPinDto, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    toggleActive(id: string, req: any): Promise<{
        isActive: boolean;
        status: string;
    }>;
}
