import { PrismaService } from '../prisma/prisma.service';
export interface CreateNotificationInput {
    businessId: string;
    type: string;
    priority?: string;
    title: string;
    message: string;
    productId?: string;
    supplierId?: string;
    purchaseId?: string;
    actionUrl?: string;
    actionLabel?: string;
    channel?: string;
}
export declare class NotificationsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(input: CreateNotificationInput): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        type: string;
        message: string;
        priority: string;
        title: string;
        productId: string | null;
        supplierId: string | null;
        purchaseId: string | null;
        actionUrl: string | null;
        actionLabel: string | null;
        isRead: boolean;
        readAt: Date | null;
        readById: string | null;
        channel: string;
    }>;
    getNotifications(businessId: string, page?: number, limit?: number, type?: string, priority?: string, isRead?: boolean): Promise<{
        data: {
            id: string;
            businessId: string;
            createdAt: Date;
            type: string;
            message: string;
            priority: string;
            title: string;
            productId: string | null;
            supplierId: string | null;
            purchaseId: string | null;
            actionUrl: string | null;
            actionLabel: string | null;
            isRead: boolean;
            readAt: Date | null;
            readById: string | null;
            channel: string;
        }[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getUnreadCount(businessId: string): Promise<{
        count: number;
    }>;
    markRead(businessId: string, id: string, userId?: string): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        type: string;
        message: string;
        priority: string;
        title: string;
        productId: string | null;
        supplierId: string | null;
        purchaseId: string | null;
        actionUrl: string | null;
        actionLabel: string | null;
        isRead: boolean;
        readAt: Date | null;
        readById: string | null;
        channel: string;
    }>;
    markAllRead(businessId: string): Promise<{
        updated: number;
    }>;
}
