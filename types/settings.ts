import type { PerformanceMode } from '../config/product';

export interface AppSettings {
  performanceMode: PerformanceMode;
  language: 'auto' | 'en' | 'pt-PT';
  autoOpen: boolean;
  keepModelsWarm: boolean;
  shortcut: string;
  historyEnabled: boolean;
  historyLimit: number;
  selectedModel?: string;
  hardwareDetected?: boolean;
  telemetryEnabled?: boolean;
  ollamaAutoInstall?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  performanceMode: 'fast',
  language: 'auto',
  autoOpen: true,
  keepModelsWarm: true,
  shortcut: 'CommandOrControl+Alt+P',
  historyEnabled: false,
  historyLimit: 20,
  telemetryEnabled: false,
  ollamaAutoInstall: true
};
