import type { PerformanceMode } from '../config/product';
export interface AppSettings {
    performanceMode: PerformanceMode;
    language: 'auto' | 'en' | 'pt-PT';
    autoOpen: boolean;
    keepModelsWarm: boolean;
    shortcut: string;
    historyEnabled: boolean;
    historyLimit: number;
}
export declare const DEFAULT_SETTINGS: AppSettings;
//# sourceMappingURL=settings.d.ts.map