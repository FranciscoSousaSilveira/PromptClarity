import type { UseCase } from '../types/prompt';
import type { PerformanceMode } from '../config/product';
export declare const DEFAULT_REWRITE_ENDPOINT = "http://127.0.0.1:3000/api/rewrite";
export interface ModelRewriteRequest {
    prompt: string;
    useCase?: UseCase;
    fallbackPrompt: string;
    hasPriorConversation?: boolean;
    preferSpeed?: boolean;
    performanceMode?: PerformanceMode;
    keepModelsWarm?: boolean;
}
export interface ModelRewriteResult {
    rewrittenPrompt: string;
    source: 'model' | 'rules';
    model?: string;
    error?: string;
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
export declare function rewriteValidationScore(original: string, rewritten: string): number;
export declare function rewritePromptWithModel(request: ModelRewriteRequest, options?: ModelRewriteOptions): Promise<ModelRewriteResult>;
export {};
//# sourceMappingURL=modelPromptRewriter.d.ts.map