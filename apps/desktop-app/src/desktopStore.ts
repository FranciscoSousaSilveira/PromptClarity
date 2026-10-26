import { readFileSync, writeFileSync } from 'node:fs';
import type { AppSettings } from '../../../types/settings';
import { DEFAULT_SETTINGS } from '../../../types/settings';
import type { DesktopTooMuchFeedbackEntry } from './shared';

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
  feedback: DesktopTooMuchFeedbackEntry[];
}

export class DesktopStore {
  private data: StoredData;
  private changeListeners: Map<string, Set<(value: any) => void>> = new Map();

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
    this.notifyChanges(patch);
    return this.settings;
  }

  private notifyChanges(patch: Partial<AppSettings>) {
    for (const key of Object.keys(patch) as (keyof AppSettings)[]) {
      const listeners = this.changeListeners.get(key);
      if (listeners) {
        for (const listener of listeners) {
          listener(this.data.settings[key]);
        }
      }
    }
  }

  onDidChange(key: string, listener: (value: any) => void) {
    if (!this.changeListeners.has(key)) {
      this.changeListeners.set(key, new Set());
    }
    this.changeListeners.get(key)!.add(listener);
  }

  get history(): PromptHistoryEntry[] {
    return [...this.data.history];
  }

  get feedback(): DesktopTooMuchFeedbackEntry[] {
    return [...this.data.feedback];
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

  addFeedback(entry: Omit<DesktopTooMuchFeedbackEntry, 'timestamp'>) {
    this.data.feedback.unshift({
      ...entry,
      timestamp: new Date().toISOString()
    });
    this.data.feedback = this.data.feedback.slice(0, 50);
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
        history: Array.isArray(parsed.history) ? parsed.history : [],
        feedback: Array.isArray(parsed.feedback) ? parsed.feedback : []
      };
    } catch {
      return { settings: { ...DEFAULT_SETTINGS }, history: [], feedback: [] };
    }
  }

  private write() {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}
