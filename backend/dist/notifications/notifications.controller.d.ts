import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private service;
    constructor(service: NotificationsService);
    getUnreadCount(req: any): Promise<{
        count: number;
    }>;
    getNotifications(req: any, page?: string, limit?: string, type?: string, priority?: string, isRead?: string): Promise<{
        data: {
            id: string;
            businessId: string;
            createdAt: Date;
            type: string;
            priority: string;
            title: string;
            message: string;
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
    markAllReadAlias(req: any): Promise<{
        updated: number;
    }>;
    markAllRead(req: any): Promise<{
        updated: number;
    }>;
    markRead(req: any, id: string): Promise<{
        id: string;
        businessId: string;
        createdAt: Date;
        type: string;
        priority: string;
        title: string;
        message: string;
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
}
