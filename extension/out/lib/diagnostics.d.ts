import { type PerformanceMode, type RewriteIntervention } from '../config/product';
import type { PromptGrammarlyDiagnostics, RewriteDiagnostics } from '../types/diagnostics';
import type { RewriteResult } from '../types/rewrite';
export declare const DEFAULT_HEALTH_ENDPOINT = "http://127.0.0.1:3000/api/health";
export declare const DIAGNOSTICS_TIMEOUT_MS = 2000;
export declare const EMPTY_REWRITE_DIAGNOSTICS: RewriteDiagnostics;
interface CollectDiagnosticsOptions {
    fetchImpl?: typeof fetch;
    apiUrl?: string;
    timeoutMs?: number;
    mode?: PerformanceMode;
    intervention?: RewriteIntervention;
    historyEnabled?: boolean | null;
    historyCount?: number;
    feedbackCount?: number;
    keepAlive?: string | boolean | null;
    prewarmEnabled?: boolean | null;
    rewrite?: RewriteDiagnostics;
}
export declare function createRewriteDiagnostics(result: Pick<RewriteResult, 'status' | 'latencyMs' | 'source' | 'validation'>): RewriteDiagnostics;
export declare function createRewriteErrorDiagnostics(latencyMs: number | null, reason?: string): RewriteDiagnostics;
export declare function describeRewriteDiagnostic(reason: string | null | undefined): string | null;
export declare function formatDiagnosticsReport(diagnostics: PromptGrammarlyDiagnostics): string[];
export declare function collectLocalDiagnostics(options?: CollectDiagnosticsOptions): Promise<PromptGrammarlyDiagnostics>;
export {};
//# sourceMappingURL=diagnostics.d.ts.map