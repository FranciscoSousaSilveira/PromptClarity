import type { PerformanceMode, RewriteIntervention } from '../config/product';

export interface LocalApiHealth {
  status: 'ok' | 'degraded' | 'error';
  api: 'ok';
  ollama: {
    status: 'ok' | 'unreachable' | 'error';
    url: string;
    model: string;
    reachable: boolean;
    latencyMs: number | null;
    error?: string;
  };
  config: {
    mode: PerformanceMode;
    intervention: RewriteIntervention;
    keepAlive: string | boolean | null;
    prewarmEnabled: boolean | null;
  };
  lastError: string | null;
}
