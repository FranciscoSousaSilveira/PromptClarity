import type { RewriteIntervention } from '../../../config/product';
import type { PopupSurface } from '../../../lib/popupState';
import type { PromptGrammarlyDiagnostics } from '../../../types/diagnostics';

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

export interface DesktopTooMuchFeedbackEntry {
  original: string;
  rewritten: string;
  source: 'model' | 'local_fallback' | 'checkmark' | 'error';
  status: 'changed' | 'no_change' | 'fallback' | 'error';
  mode: 'fast' | 'balanced' | 'quality';
  intervention: RewriteIntervention;
  validationReason: string | null;
  timestamp: string;
  reason: 'user_too_much';
  surface: PopupSurface;
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
      rewriteStatus: 'changed' | 'no_change' | 'fallback' | 'error';
      intervention: RewriteIntervention;
      validationReason: string | null;
      validationScore: number;
      isAlreadyGood: boolean;
      canUndo: boolean;
      review: PromptReview;
    }
  | {
      status: 'error';
      title: string;
      message: string;
      canRetry: boolean;
      originalText?: string;
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
      diagnostics: PromptGrammarlyDiagnostics;
      hints: string[];
    };

export interface DesktopBridge {
  onState: (listener: (state: DesktopPopupState) => void) => () => void;
  copy: (text?: string) => Promise<boolean>;
  insert: (text?: string) => Promise<boolean>;
  undo: () => Promise<boolean>;
  tooMuch: () => Promise<boolean>;
  retry: () => Promise<void>;
  close: () => Promise<void>;
  saveSettings: (settings: Partial<DesktopSettingsView>) => Promise<DesktopSettingsView>;
  clearHistory: () => Promise<void>;
}
