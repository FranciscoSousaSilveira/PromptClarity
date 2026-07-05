import type { PerformanceMode, RewriteIntervention } from '../config/product';
import type { RewriteSource, RewriteStatus } from './rewrite';
export interface RewriteDiagnostics {
    lastStatus: RewriteStatus | null;
    lastLatencyMs: number | null;
    lastSource: RewriteSource | null;
    lastValidationReason: string | null;
    fallbackUsed: boolean;
}
export interface PromptGrammarlyDiagnostics {
    api: {
        status: 'ok' | 'degraded' | 'error';
        url: string;
        latencyMs: number | null;
        lastError: string | null;
    };
    ollama: {
        status: 'ok' | 'unreachable' | 'error';
        url: string;
        model: string;
        reachable: boolean;
        latencyMs: number | null;
        error?: string;
    };
    rewrite: RewriteDiagnostics;
    config: {
        mode: PerformanceMode;
        intervention: RewriteIntervention;
        historyEnabled: boolean | null;
        keepAlive: string | boolean | null;
        prewarmEnabled: boolean | null;
    };
    storage: {
        historyEnabled: boolean | null;
        historyCount?: number;
        feedbackCount?: number;
    };
}
//# sourceMappingURL=diagnostics.d.ts.map