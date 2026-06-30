import { readFileSync, writeFileSync } from 'node:fs';
import type { AppSettings } from '../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../types/settings';

export interface PromptHistoryEntry {
  id: string;
  createdAt: string;
  originalText: string;
  improvedText: string;
  source: string;
}

interface StoredData {
  settings: AppSettings;
  history: PromptHistoryEntry[];
}

export class DesktopStore {
  private data: StoredData;

  constructor(private readonly filePath: string) {
    this.data = this.read();
  }

  get settings(): AppSettings {
    return { ...this.data.settings };
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.data.settings = { ...this.data.settings, ...patch };
    this.trimHistory();
    this.write();
    return this.settings;
  }

  get history(): PromptHistoryEntry[] {
    return [...this.data.history];
  }

  addHistory(entry: Omit<PromptHistoryEntry, 'id' | 'createdAt'>) {
    if (!this.data.settings.historyEnabled) return;
    this.data.history.unshift({
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString()
    });
    this.trimHistory();
    this.write();
  }

  clearHistory() {
    this.data.history = [];
    this.write();
  }

  private trimHistory() {
    this.data.history = this.data.history.slice(0, Math.max(1, this.data.settings.historyLimit));
  }

  private read(): StoredData {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<StoredData>;
      return {
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    } catch {
      return { settings: { ...DEFAULT_SETTINGS }, history: [] };
    }
  }

  private write() {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
