import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
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
    verifyPin(body: {
        pin: string;
    }, req: any): Promise<{
        success: boolean;
    }>;
    refresh(req: any): Promise<{
        access_token: string;
        user: {
            id: string;
            username: string;
            fullName: string;
            role: import(".prisma/client").$Enums.UserRole;
            businessId: string;
            counterId: string | null;
            business: {
                id: string;
                name: string;
                gstin: string | null;
                stateName: string;
            };
        };
    }>;
    getMe(req: any): Promise<{
        id: string;
        username: string;
        email: string | null;
        fullName: string;
        phone: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        status: import(".prisma/client").$Enums.UserStatus;
        lastLoginAt: Date | null;
        counterId: string | null;
        createdAt: Date;
        business: {
            id: string;
            name: string;
            gstin: string | null;
            stateCode: string;
            stateName: string;
        };
        businessId: string;
    } | null>;
}
