import type { PerformanceMode, RewriteIntervention } from '../config/product';
import type { UseCase } from './prompt';

export type RewriteStatus = 'changed' | 'no_change' | 'fallback' | 'error';
export type RewriteSource = 'model' | 'local_fallback' | 'checkmark' | 'error';

export interface RewriteValidation {
  passed: boolean;
  reason: string;
}

export interface RewriteResult {
  status: RewriteStatus;
  original: string;
  rewritten: string;
  source: RewriteSource;
  latencyMs: number;
  mode: PerformanceMode;
  intervention: RewriteIntervention;
  validation: RewriteValidation;
  model?: string;
  cached?: boolean;
  error?: string;
}

export interface RewritePipelineInput {
  prompt: string;
  useCase?: UseCase;
  hasPriorConversation?: boolean;
  performanceMode?: PerformanceMode;
  intervention?: RewriteIntervention;
  keepModelsWarm?: boolean;
}

export interface ModelRewriteInput {
  prompt: string;
  mode: PerformanceMode;
  intervention: RewriteIntervention;
  safetyRetry: boolean;
  keepModelsWarm: boolean;
}

export interface ModelRewriteOutput {
  rewritten: string;
  model?: string;
}

export type ModelRewriteExecutor = (input: ModelRewriteInput) => Promise<ModelRewriteOutput>;
