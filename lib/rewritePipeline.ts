import {
  DEFAULT_REWRITE_INTERVENTION,
  MODEL_PROFILES,
  isPerformanceMode,
  isRewriteIntervention,
  type PerformanceMode,
  type RewriteIntervention
} from '../config/product';
import { USE_CASE_OPTIONS, type UseCase } from '../types/prompt';
import type {
  ModelRewriteExecutor,
  RewritePipelineInput,
  RewriteResult,
  RewriteValidation
} from '../types/rewrite';
import { analyzePrompt } from './promptAnalyzer';
import { validateModelRewrite } from './rewriteValidator';

const USE_CASES = new Set<UseCase>(USE_CASE_OPTIONS.map((option) => option.value));

function elapsedSince(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function normalizeForEquality(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizedWordBag(value: string): string[] {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .match(/[a-z0-9]+/g) || []
  ).sort();
}

function isMechanicallyWellFormed(value: string): boolean {
  const trimmed = value.trim();
  const firstLetter = trimmed.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/)?.[0];
  return (
    Boolean(firstLetter && firstLetter === firstLetter.toUpperCase()) &&
    /[?!.]$/.test(trimmed) &&
    !/\s{2,}/.test(trimmed) &&
    !/\b(?:nao|sff|nng|tp)\b/i.test(trimmed)
  );
}

function hasSameWords(left: string, right: string): boolean {
  const leftWords = normalizedWordBag(left);
  const rightWords = normalizedWordBag(right);
  return (
    leftWords.length === rightWords.length && leftWords.every((word, index) => word === rightWords[index])
  );
}

function cleanModelOutput(value: string): string {
  let cleaned = value.trim();
  const wrappingQuote = cleaned.match(/^["“](.*)["”]$/s);
  if (wrappingQuote) cleaned = wrappingQuote[1].trim();
  return cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .trim();
}

function normalizeUseCase(useCase: unknown): UseCase {
  return typeof useCase === 'string' && USE_CASES.has(useCase as UseCase) ? (useCase as UseCase) : 'general';
}

export function normalizeRewriteMode(value: unknown, prompt = ''): PerformanceMode {
  if (isPerformanceMode(value)) return value;
  return prompt.trim().length <= 240 ? 'fast' : 'balanced';
}

export function normalizeRewriteIntervention(value: unknown): RewriteIntervention {
  return isRewriteIntervention(value) ? value : DEFAULT_REWRITE_INTERVENTION;
}

export function createRewriteErrorResult(
  original: string,
  mode: PerformanceMode,
  reason: string,
  error: string,
  startedAt = Date.now(),
  intervention: RewriteIntervention = DEFAULT_REWRITE_INTERVENTION
): RewriteResult {
  return {
    status: 'error',
    original,
    rewritten: original,
    source: 'error',
    latencyMs: elapsedSince(startedAt),
    mode,
    intervention,
    validation: { passed: false, reason },
    error
  };
}

function noChangeDetected(original: string, candidate: string): boolean {
  return (
    normalizeForEquality(original) === normalizeForEquality(candidate) ||
    (isMechanicallyWellFormed(original) && hasSameWords(original, candidate))
  );
}

function fallbackResult(
  original: string,
  fallback: string,
  mode: PerformanceMode,
  validation: RewriteValidation,
  error: string,
  startedAt: number,
  intervention: RewriteIntervention
): RewriteResult {
  const safeFallback = fallback.trim() || original;
  if (!safeFallback.trim()) {
    return createRewriteErrorResult(original, mode, 'local_fallback_failed', error, startedAt, intervention);
  }
  return {
    status: 'fallback',
    original,
    rewritten: safeFallback,
    source: 'local_fallback',
    latencyMs: elapsedSince(startedAt),
    mode,
    intervention,
    validation,
    error
  };
}

/**
 * The single rewrite decision pipeline. Transport layers provide a local model
 * executor; analysis, validation, fallback selection and result normalization
 * stay here so every client receives identical behavior.
 */
export async function runRewritePipeline(
  input: RewritePipelineInput,
  rewriteWithModel: ModelRewriteExecutor
): Promise<RewriteResult> {
  const startedAt = Date.now();
  const original = typeof input.prompt === 'string' ? input.prompt : '';
  const prompt = original.trim();
  const mode = normalizeRewriteMode(input.performanceMode, prompt);
  const intervention = normalizeRewriteIntervention(input.intervention);
  const profile = MODEL_PROFILES[mode];

  if (prompt.length < 2) {
    return createRewriteErrorResult(
      original,
      mode,
      'prompt_required',
      'Prompt is required',
      startedAt,
      intervention
    );
  }
  if (prompt.length > profile.maxInputCharacters) {
    return createRewriteErrorResult(
      original,
      mode,
      'prompt_too_long',
      'Prompt is too long for the selected mode',
      startedAt,
      intervention
    );
  }

  let fallback = prompt;
  try {
    fallback =
      analyzePrompt(prompt, normalizeUseCase(input.useCase), intervention).rewrittenPrompt.trim() || prompt;
  } catch {
    // The untouched prompt remains a safe final fallback if local analysis fails.
  }

  try {
    const requestModel = async (safetyRetry: boolean) => {
      const output = await rewriteWithModel({
        prompt,
        mode,
        intervention,
        safetyRetry,
        keepModelsWarm: input.keepModelsWarm !== false
      });
      const cleaned = cleanModelOutput(output.rewritten);
      return {
        rewritten: cleaned,
        model: output.model
      };
    };

    const startStrict = prompt.length <= 240;
    let candidate = await requestModel(startStrict);
    let validation = validateModelRewrite(prompt, candidate.rewritten, intervention);
    if (!startStrict && !validation.passed) {
      candidate = await requestModel(true);
      validation = validateModelRewrite(prompt, candidate.rewritten, intervention);
    }

    if (!validation.passed) {
      return fallbackResult(
        original,
        fallback,
        mode,
        validation,
        `The model rewrite was rejected: ${validation.reason}`,
        startedAt,
        intervention
      );
    }

    if (noChangeDetected(prompt, candidate.rewritten)) {
      return {
        status: 'no_change',
        original,
        rewritten: original,
        source: 'checkmark',
        latencyMs: elapsedSince(startedAt),
        mode,
        intervention,
        validation: { passed: true, reason: 'model_output_unchanged' },
        model: candidate.model
      };
    }

    return {
      status: 'changed',
      original,
      rewritten: candidate.rewritten,
      source: 'model',
      latencyMs: elapsedSince(startedAt),
      mode,
      intervention,
      validation: { passed: true, reason: 'model_output_valid' },
      model: candidate.model
    };
  } catch (error) {
    const message =
      error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
        ? 'Local model request timed out'
        : 'Local model is unavailable';
    return fallbackResult(
      original,
      fallback,
      mode,
      { passed: false, reason: 'model_unavailable' },
      message,
      startedAt,
      intervention
    );
  }
}
