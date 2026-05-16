import { SettingsService } from './settings.service';
import { UpdateFeaturesDto } from './dto/update-features.dto';
export declare class SettingsController {
    private settingsService;
    constructor(settingsService: SettingsService);
    getFeatures(req: any): Promise<{
        features: Record<string, boolean>;
    }>;
    updateFeatures(req: any, dto: UpdateFeaturesDto): Promise<{
        features: Record<string, boolean>;
    }>;
    getBillingSettings(req: any): Promise<Record<string, string>>;
    updateBillingSettings(req: any, body: Record<string, string>): Promise<Record<string, string>>;
    getPosSettings(req: any): Promise<Record<string, string>>;
    updatePosSettings(req: any, body: Record<string, string>): Promise<Record<string, string>>;
    getSystemSettings(req: any): Promise<Record<string, string>>;
    updateSystemSettings(req: any, body: Record<string, string>): Promise<Record<string, string>>;
    getPosShortcuts(req: any): Promise<Record<string, string>>;
    updatePosShortcuts(req: any, body: Record<string, string>): Promise<Record<string, string>>;
    getGstSettings(req: any): Promise<Record<string, string>>;
    updateGstSettings(req: any, body: Record<string, string>): Promise<Record<string, string>>;
}
