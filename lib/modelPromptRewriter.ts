import type { UseCase } from '../types/prompt';
import {
  DEFAULT_REWRITE_INTERVENTION,
  isPerformanceMode,
  isRewriteIntervention,
  type PerformanceMode,
  type RewriteIntervention
} from '../config/product';
import type { RewriteResult } from '../types/rewrite';
import { rewriteValidationScore, validateModelRewrite } from './rewriteValidator';

export { isModelRewriteUsable, rewriteValidationScore, validateModelRewrite } from './rewriteValidator';

export const DEFAULT_REWRITE_ENDPOINT = 'http://127.0.0.1:3000/api/rewrite';

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

function cleanModelOutput(value: string): string {
  let cleaned = value.trim();

  const wrappingQuote = cleaned.match(/^["“](.*)["”]$/s);
  if (wrappingQuote) cleaned = wrappingQuote[1].trim();

  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .trim();

  return cleaned;
}

function isNormalizedRewriteResult(value: unknown): value is RewriteResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<RewriteResult>;
  return (
    (result.status === 'changed' ||
      result.status === 'no_change' ||
      result.status === 'fallback' ||
      result.status === 'error') &&
    typeof result.original === 'string' &&
    typeof result.rewritten === 'string' &&
    (result.source === 'model' ||
      result.source === 'local_fallback' ||
      result.source === 'checkmark' ||
      result.source === 'error') &&
    typeof result.latencyMs === 'number' &&
    isPerformanceMode(result.mode) &&
    Boolean(
      result.validation &&
      typeof result.validation.passed === 'boolean' &&
      typeof result.validation.reason === 'string'
    )
  );
}

function toClientResult(result: RewriteResult): ModelRewriteResult {
  const intervention = isRewriteIntervention(result.intervention)
    ? result.intervention
    : DEFAULT_REWRITE_INTERVENTION;
  return {
    ...result,
    intervention,
    rewrittenPrompt: result.rewritten,
    isAlreadyGood: result.status === 'no_change',
    validationScore: result.validation.passed
      ? 92
      : rewriteValidationScore(result.original, result.rewritten, intervention),
    sourceDetail: result.source === 'model' || result.source === 'checkmark' ? 'local-ai' : 'safety-fallback'
  };
}

export async function rewritePromptWithModel(
  request: ModelRewriteRequest,
  options: ModelRewriteOptions = {}
): Promise<ModelRewriteResult> {
  const endpoint = options.endpoint || DEFAULT_REWRITE_ENDPOINT;
  // Small local models can take longer on their first request while weights
  // are loaded into memory. Subsequent requests are normally much faster.
  const timeoutMs = options.timeoutMs ?? 120_000;
  const fetchImpl = options.fetchImpl || fetch;
  const token =
    options.token || (typeof process !== 'undefined' ? process.env?.PROMPT_GRAMMARLY_TOKEN : undefined);
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const mode = isPerformanceMode(request.performanceMode)
    ? request.performanceMode
    : request.prompt.trim().length <= 240
      ? 'fast'
      : 'balanced';
  const intervention = isRewriteIntervention(request.intervention)
    ? request.intervention
    : DEFAULT_REWRITE_INTERVENTION;

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Prompt-Grammarly-Token': token } : {})
      },
      body: JSON.stringify({
        prompt: request.prompt,
        useCase: request.useCase || 'general',
        hasPriorConversation: request.hasPriorConversation === true,
        performanceMode: mode,
        intervention,
        keepModelsWarm: request.keepModelsWarm
      }),
      signal: controller.signal
    });

    const payload = (await response.json()) as unknown;
    if (isNormalizedRewriteResult(payload)) return toClientResult(payload);
    if (!response.ok) throw new Error(`Local model service returned ${response.status}`);

    // Compatibility with a previously built local server during an incremental update.
    const legacy = payload as { rewrittenPrompt?: unknown; model?: unknown };
    const cleanedRewrite = cleanModelOutput(
      typeof legacy.rewrittenPrompt === 'string' ? legacy.rewrittenPrompt : ''
    );
    const rewritten = cleanedRewrite;
    const validation = validateModelRewrite(request.prompt, rewritten, intervention);
    if (!validation.passed) {
      return toClientResult({
        status: 'fallback',
        original: request.prompt,
        rewritten: request.fallbackPrompt || request.prompt,
        source: 'local_fallback',
        latencyMs: Date.now() - startedAt,
        mode,
        intervention,
        validation,
        error: `The model rewrite was rejected: ${validation.reason}`
      });
    }
    const unchanged = request.prompt.trim() === rewritten.trim();
    return toClientResult({
      status: unchanged ? 'no_change' : 'changed',
      original: request.prompt,
      rewritten: unchanged ? request.prompt : rewritten,
      source: unchanged ? 'checkmark' : 'model',
      latencyMs: Date.now() - startedAt,
      mode,
      intervention,
      validation: {
        passed: true,
        reason: unchanged ? 'model_output_unchanged' : 'model_output_valid'
      },
      model: typeof legacy.model === 'string' ? legacy.model : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown local model error';
    return toClientResult({
      status: request.fallbackPrompt.trim() ? 'fallback' : 'error',
      original: request.prompt,
      rewritten: request.fallbackPrompt || request.prompt,
      source: request.fallbackPrompt.trim() ? 'local_fallback' : 'error',
      latencyMs: Date.now() - startedAt,
      mode,
      intervention,
      validation: { passed: false, reason: 'local_service_unavailable' },
      error: message
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}
