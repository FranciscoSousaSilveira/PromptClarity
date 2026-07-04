import type { UseCase } from '../types/prompt';
import { type PerformanceMode, type RewriteIntervention } from '../config/product';
import type { RewriteResult } from '../types/rewrite';
export { isModelRewriteUsable, rewriteValidationScore, validateModelRewrite } from './rewriteValidator';
export declare const DEFAULT_REWRITE_ENDPOINT = "http://127.0.0.1:3000/api/rewrite";
export interface ModelRewriteRequest {
    prompt: string;
    useCase?: UseCase;
    fallbackPrompt: string;
    hasPriorConversation?: boolean;
    preferSpeed?: boolean;
    performanceMode?: PerformanceMode;
    intervention?: RewriteIntervention;
    keepModelsWarm?: boolean;
}
export interface ModelRewriteResult extends RewriteResult {
    rewrittenPrompt: string;
    isAlreadyGood: boolean;
    validationScore: number;
    sourceDetail: 'local-ai' | 'instant-rules' | 'safety-fallback';
}
interface ModelRewriteOptions {
    endpoint?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    token?: string;
    signal?: AbortSignal;
}
export declare function rewritePromptWithModel(request: ModelRewriteRequest, options?: ModelRewriteOptions): Promise<ModelRewriteResult>;
//# sourceMappingURL=modelPromptRewriter.d.ts.map