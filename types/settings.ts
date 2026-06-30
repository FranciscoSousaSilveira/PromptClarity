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

export const DEFAULT_SETTINGS: AppSettings = {
  performanceMode: 'fast',
  language: 'auto',
  autoOpen: true,
  keepModelsWarm: true,
  shortcut: 'CommandOrControl+Alt+P',
  historyEnabled: true,
  historyLimit: 20
};
