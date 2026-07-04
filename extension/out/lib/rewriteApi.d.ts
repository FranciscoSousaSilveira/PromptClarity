import type { RewritePipelineInput, RewriteResult } from '../types/rewrite';
export interface RewriteApiResponse {
    body: RewriteResult;
    httpStatus: number;
}
type RewriteExecutor = (input: RewritePipelineInput) => Promise<RewriteResult>;
/**
 * Validates the transport payload before it reaches the rewrite pipeline.
 * `prompt` remains supported for existing clients while `text` is the public API field.
 */
export declare function handleRewriteApiBody(body: unknown, rewrite?: RewriteExecutor, startedAt?: number): Promise<RewriteApiResponse>;
export declare function invalidJsonResponse(startedAt?: number): RewriteApiResponse;
export {};
//# sourceMappingURL=rewriteApi.d.ts.map