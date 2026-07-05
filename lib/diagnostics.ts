import {
  DEFAULT_REWRITE_INTERVENTION,
  isPerformanceMode,
  isRewriteIntervention,
  type PerformanceMode,
  type RewriteIntervention
} from '../config/product';
import type { PromptGrammarlyDiagnostics, RewriteDiagnostics } from '../types/diagnostics';
import type { LocalApiHealth } from '../types/health';
import type { RewriteResult } from '../types/rewrite';

export const DEFAULT_HEALTH_ENDPOINT = 'http://127.0.0.1:3000/api/health';
export const DIAGNOSTICS_TIMEOUT_MS = 2_000;

export const EMPTY_REWRITE_DIAGNOSTICS: RewriteDiagnostics = {
  lastStatus: null,
  lastLatencyMs: null,
  lastSource: null,
  lastValidationReason: null,
  fallbackUsed: false
};

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

function elapsedSince(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function safeLocalHealthUrl(value?: string): string {
  try {
    const url = new URL(value || DEFAULT_HEALTH_ENDPOINT);
    const localHost =
      url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    if (url.protocol !== 'http:' || !localHost) return DEFAULT_HEALTH_ENDPOINT;
    url.pathname = '/api/health';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_HEALTH_ENDPOINT;
  }
}

function isLocalApiHealth(value: unknown): value is LocalApiHealth {
  if (!value || typeof value !== 'object') return false;
  const health = value as Partial<LocalApiHealth>;
  return (
    (health.status === 'ok' || health.status === 'degraded' || health.status === 'error') &&
    health.api === 'ok' &&
    Boolean(health.ollama) &&
    (health.ollama?.status === 'ok' ||
      health.ollama?.status === 'unreachable' ||
      health.ollama?.status === 'error') &&
    typeof health.ollama?.url === 'string' &&
    typeof health.ollama?.model === 'string' &&
    typeof health.ollama?.reachable === 'boolean'
  );
}

export function createRewriteDiagnostics(
  result: Pick<RewriteResult, 'status' | 'latencyMs' | 'source' | 'validation'>
): RewriteDiagnostics {
  return {
    lastStatus: result.status,
    lastLatencyMs: Number.isFinite(result.latencyMs) ? Math.max(0, result.latencyMs) : null,
    lastSource: result.source,
    lastValidationReason: result.validation.reason.trim() || null,
    fallbackUsed: result.status === 'fallback' || result.source === 'local_fallback'
  };
}

export function createRewriteErrorDiagnostics(
  latencyMs: number | null,
  reason = 'local_service_unavailable'
): RewriteDiagnostics {
  return {
    lastStatus: 'error',
    lastLatencyMs: latencyMs === null ? null : Math.max(0, latencyMs),
    lastSource: 'error',
    lastValidationReason: reason,
    fallbackUsed: false
  };
}

export function describeRewriteDiagnostic(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason === 'local_service_unavailable')
    return 'Local API unavailable. Start the local service and try again.';
  if (reason === 'model_unavailable')
    return 'Local API is running, but Ollama or the selected model is unavailable.';
  if (reason === 'local_fallback_failed')
    return 'The local model and conservative fallback were unavailable.';
  if (reason === 'internal_error') return 'The local API returned an internal error.';
  return `Local validation reason: ${reason}`;
}

export function formatDiagnosticsReport(diagnostics: PromptGrammarlyDiagnostics): string[] {
  const value = (input: unknown) => (input === null || input === undefined ? 'not available' : String(input));
  return [
    `API: ${diagnostics.api.status} (${value(diagnostics.api.latencyMs)} ms)`,
    `Ollama: ${diagnostics.ollama.status} · ${diagnostics.ollama.model} (${value(diagnostics.ollama.latencyMs)} ms)`,
    `Mode: ${diagnostics.config.mode}`,
    `Intervention: ${diagnostics.config.intervention}`,
    `Last rewrite: ${value(diagnostics.rewrite.lastStatus)} (${value(diagnostics.rewrite.lastLatencyMs)} ms)`,
    `Last source: ${value(diagnostics.rewrite.lastSource)}`,
    `Validation reason: ${value(diagnostics.rewrite.lastValidationReason)}`,
    `Fallback used: ${diagnostics.rewrite.fallbackUsed ? 'yes' : 'no'}`,
    `History: ${diagnostics.storage.historyEnabled === true ? 'enabled' : diagnostics.storage.historyEnabled === false ? 'disabled' : 'not available'}${diagnostics.storage.historyCount === undefined ? '' : ` · ${diagnostics.storage.historyCount} entries`}`,
    `Too much feedback: ${value(diagnostics.storage.feedbackCount)}`,
    `Keep alive: ${value(diagnostics.config.keepAlive)}`,
    `Prewarm: ${value(diagnostics.config.prewarmEnabled)}`
  ];
}

export async function collectLocalDiagnostics(
  options: CollectDiagnosticsOptions = {}
): Promise<PromptGrammarlyDiagnostics> {
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = safeLocalHealthUrl(options.apiUrl);
  const mode = isPerformanceMode(options.mode) ? options.mode : 'fast';
  const intervention = isRewriteIntervention(options.intervention)
    ? options.intervention
    : DEFAULT_REWRITE_INTERVENTION;
  const url = new URL(baseUrl);
  url.searchParams.set('mode', mode);
  url.searchParams.set('intervention', intervention);
  const timeoutMs = options.timeoutMs ?? DIAGNOSTICS_TIMEOUT_MS;
  const startedAt = Date.now();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const base = {
    rewrite: options.rewrite || EMPTY_REWRITE_DIAGNOSTICS,
    storage: {
      historyEnabled: options.historyEnabled ?? null,
      ...(options.historyCount === undefined ? {} : { historyCount: options.historyCount }),
      ...(options.feedbackCount === undefined ? {} : { feedbackCount: options.feedbackCount })
    }
  };

  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        const error = new Error('Local diagnostics timed out');
        error.name = 'AbortError';
        reject(error);
      }, timeoutMs);
    });
    const response = await Promise.race([
      fetchImpl(url.toString(), { cache: 'no-store', signal: controller.signal }),
      timeoutPromise
    ]);
    const payload = (await response.json()) as unknown;
    if (!isLocalApiHealth(payload)) throw new Error('Invalid local health response');

    return {
      api: {
        status: payload.status === 'ok' ? 'ok' : 'degraded',
        url: baseUrl,
        latencyMs: elapsedSince(startedAt),
        lastError: payload.lastError
      },
      ollama: payload.ollama,
      ...base,
      config: {
        mode,
        intervention,
        historyEnabled: options.historyEnabled ?? null,
        keepAlive: options.keepAlive ?? payload.config.keepAlive,
        prewarmEnabled: options.prewarmEnabled ?? payload.config.prewarmEnabled
      }
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    const message = timedOut ? 'Local API health check timed out' : 'Local API is offline';
    return {
      api: { status: 'error', url: baseUrl, latencyMs: elapsedSince(startedAt), lastError: message },
      ollama: {
        status: 'unreachable',
        url: 'http://127.0.0.1:11434',
        model: 'unknown',
        reachable: false,
        latencyMs: null,
        error: 'Ollama status unavailable while the local API is offline'
      },
      ...base,
      config: {
        mode,
        intervention,
        historyEnabled: options.historyEnabled ?? null,
        keepAlive: options.keepAlive ?? null,
        prewarmEnabled: options.prewarmEnabled ?? null
      }
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
