export const PRODUCT = {
  name: 'PromptClarity',
  desktopName: 'PromptClarity Desktop',
  version: '0.2.0',
  apiUrl: 'http://127.0.0.1:3000/api/rewrite',
  defaultShortcut: 'CommandOrControl+Alt+P'
} as const;

export const SUPPORTED_CHAT_ORIGINS = [
  'https://chatgpt.com',
  'https://chat.openai.com',
  'https://claude.ai',
  'https://gemini.google.com',
  'https://copilot.microsoft.com',
  'https://www.perplexity.ai',
  'https://chat.deepseek.com',
  'https://grok.com',
  'https://chat.mistral.ai',
  'https://poe.com',
  'https://www.meta.ai'
] as const;

export type PerformanceMode = 'fast' | 'balanced' | 'quality';
export type RewriteIntervention = 'strict' | 'normal' | 'polished';

export const DEFAULT_REWRITE_INTERVENTION: RewriteIntervention = 'normal';

export function isRewriteIntervention(value: unknown): value is RewriteIntervention {
  return value === 'strict' || value === 'normal' || value === 'polished';
}

export interface ModelProfile {
  mode: PerformanceMode;
  label: string;
  model: string;
  maxInputCharacters: number;
  maxOutputTokens: number;
  contextTokens: number;
  temperature: number;
  useInstantRulesForShortPrompts: boolean;
}

export const MODEL_PROFILES: Record<PerformanceMode, ModelProfile> = {
  fast: {
    mode: 'fast',
    label: 'Fast',
    model: 'qwen2.5:3b',
    maxInputCharacters: 1_500,
    maxOutputTokens: 64,
    contextTokens: 1_024,
    temperature: 0.05,
    useInstantRulesForShortPrompts: true
  },
  balanced: {
    mode: 'balanced',
    label: 'Balanced',
    model: 'qwen2.5:3b',
    maxInputCharacters: 6_000,
    maxOutputTokens: 180,
    contextTokens: 2_048,
    temperature: 0.1,
    useInstantRulesForShortPrompts: false
  },
  quality: {
    mode: 'quality',
    label: 'Quality',
    model: 'qwen2.5:3b',
    maxInputCharacters: 12_000,
    maxOutputTokens: 320,
    contextTokens: 4_096,
    temperature: 0.15,
    useInstantRulesForShortPrompts: false
  }
};

export function isPerformanceMode(value: unknown): value is PerformanceMode {
  return value === 'fast' || value === 'balanced' || value === 'quality';
}
