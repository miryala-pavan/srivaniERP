import { PrismaService } from './prisma/prisma.service';
export declare class AppController {
    private prisma;
    constructor(prisma: PrismaService);
    health(): Promise<{
        status: string;
        timestamp: string;
        database: string;
        service: string;
        version: any;
    }>;
}
