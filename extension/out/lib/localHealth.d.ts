import { type PerformanceMode, type RewriteIntervention } from '../config/product';
import type { LocalApiHealth } from '../types/health';
export declare const OLLAMA_HEALTH_TIMEOUT_MS = 1500;
interface HealthCheckOptions {
    fetchImpl?: typeof fetch;
    ollamaUrl?: string;
    mode?: PerformanceMode;
    intervention?: RewriteIntervention;
    timeoutMs?: number;
    keepAlive?: string | boolean | null;
    prewarmEnabled?: boolean | null;
}
/** Lightweight local-only check. It never loads the model or performs a rewrite. */
export declare function checkLocalApiHealth(options?: HealthCheckOptions): Promise<LocalApiHealth>;
export {};
//# sourceMappingURL=localHealth.d.ts.map