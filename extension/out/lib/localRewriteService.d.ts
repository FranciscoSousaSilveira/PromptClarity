import { type PerformanceMode, type RewriteIntervention } from '../config/product';
import type { RewritePipelineInput, RewriteResult } from '../types/rewrite';
export declare function resolveLocalOllamaUrl(value?: string | undefined): string;
export declare function getSelectedLocalModel(mode: PerformanceMode): string;
export declare function buildModelSystemPrompt(isPortuguese: boolean, mode: PerformanceMode, intervention: RewriteIntervention, safetyRetry: boolean): string;
/** Runs the shared pipeline against local Ollama, with only validated model results cached. */
export declare function rewritePromptLocally(input: RewritePipelineInput): Promise<RewriteResult>;
//# sourceMappingURL=localRewriteService.d.ts.map