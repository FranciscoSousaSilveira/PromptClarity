import type { UseCase } from '../types/prompt';
export declare const DEFAULT_REWRITE_ENDPOINT = "http://127.0.0.1:3000/api/rewrite";
export interface ModelRewriteRequest {
    prompt: string;
    useCase?: UseCase;
    fallbackPrompt: string;
}
export interface ModelRewriteResult {
    rewrittenPrompt: string;
    source: 'model' | 'rules';
    model?: string;
    error?: string;
}
interface ModelRewriteOptions {
    endpoint?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}
export declare function rewritePromptWithModel(request: ModelRewriteRequest, options?: ModelRewriteOptions): Promise<ModelRewriteResult>;
export {};
//# sourceMappingURL=modelPromptRewriter.d.ts.map