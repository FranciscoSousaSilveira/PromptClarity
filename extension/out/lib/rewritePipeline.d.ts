import { type PerformanceMode, type RewriteIntervention } from '../config/product';
import type { ModelRewriteExecutor, RewritePipelineInput, RewriteResult } from '../types/rewrite';
export declare function normalizeRewriteMode(value: unknown, prompt?: string): PerformanceMode;
export declare function normalizeRewriteIntervention(value: unknown): RewriteIntervention;
export declare function createRewriteErrorResult(original: string, mode: PerformanceMode, reason: string, error: string, startedAt?: number, intervention?: RewriteIntervention): RewriteResult;
/**
 * The single rewrite decision pipeline. Transport layers provide a local model
 * executor; analysis, validation, fallback selection and result normalization
 * stay here so every client receives identical behavior.
 */
export declare function runRewritePipeline(input: RewritePipelineInput, rewriteWithModel: ModelRewriteExecutor): Promise<RewriteResult>;
//# sourceMappingURL=rewritePipeline.d.ts.map