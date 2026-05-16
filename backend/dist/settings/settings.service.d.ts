import { PrismaService } from '../prisma/prisma.service';
import { UpdateFeaturesDto } from './dto/update-features.dto';
export declare class SettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    getFeatures(businessId: string): Promise<{
        features: Record<string, boolean>;
    }>;
    updateFeatures(businessId: string, dto: UpdateFeaturesDto): Promise<{
        features: Record<string, boolean>;
    }>;
    getBillingSettings(businessId: string): Promise<Record<string, string>>;
    updateBillingSettings(businessId: string, updates: Record<string, string>): Promise<Record<string, string>>;
    getPosSettings(businessId: string): Promise<Record<string, string>>;
    updatePosSettings(businessId: string, updates: Record<string, string>): Promise<Record<string, string>>;
    getPosShortcuts(businessId: string): Promise<Record<string, string>>;
    getSystemSettings(businessId: string): Promise<Record<string, string>>;
    updateSystemSettings(businessId: string, updates: Record<string, string>): Promise<Record<string, string>>;
    updatePosShortcuts(businessId: string, updates: Record<string, string>): Promise<Record<string, string>>;
    getGstSettings(businessId: string): Promise<Record<string, string>>;
    updateGstSettings(businessId: string, updates: Record<string, string>): Promise<Record<string, string>>;
}
