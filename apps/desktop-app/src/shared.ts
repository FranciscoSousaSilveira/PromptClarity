export interface ReviewIssue {
  title: string;
  suggestion: string;
}

export interface PromptReview {
  overallScore: number;
  label: string;
  summary: string;
  issues: ReviewIssue[];
  strengths: string[];
}

export interface DesktopSettingsView {
  performanceMode: 'fast' | 'balanced' | 'quality';
  language: 'auto' | 'en' | 'pt-PT';
  autoOpen: boolean;
  keepModelsWarm: boolean;
  shortcut: string;
  historyEnabled: boolean;
  historyLimit: number;
}

export interface DesktopHistoryEntry {
  id: string;
  createdAt: string;
  originalText: string;
  improvedText: string;
  source: string;
}

export type DesktopPopupState =
  | {
      status: 'loading';
      originalText: string;
      stage?: 'reading' | 'rewriting' | 'validating';
    }
  | {
      status: 'success';
      originalText: string;
      improvedText: string;
      model?: string;
      sourceDetail: 'local-ai' | 'instant-rules' | 'safety-fallback';
      validationScore: number;
      canUndo: boolean;
      review: PromptReview;
    }
  | {
      status: 'error';
      title: string;
      message: string;
      canRetry: boolean;
    }
  | {
      status: 'settings';
      settings: DesktopSettingsView;
    }
  | {
      status: 'history';
      entries: DesktopHistoryEntry[];
    }
  | {
      status: 'diagnostics';
      lines: string[];
    };

export interface DesktopBridge {
  onState: (listener: (state: DesktopPopupState) => void) => () => void;
  copy: (text?: string) => Promise<boolean>;
  insert: (text?: string) => Promise<boolean>;
  undo: () => Promise<boolean>;
  retry: () => Promise<void>;
  close: () => Promise<void>;
  saveSettings: (settings: Partial<DesktopSettingsView>) => Promise<DesktopSettingsView>;
  clearHistory: () => Promise<void>;
}
