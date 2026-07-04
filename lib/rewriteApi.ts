import { DEFAULT_REWRITE_INTERVENTION, MODEL_PROFILES, type RewriteIntervention } from '../config/product';
import type { UseCase } from '../types/prompt';
import type { RewritePipelineInput, RewriteResult } from '../types/rewrite';
import { rewritePromptLocally } from './localRewriteService';
import {
  createRewriteErrorResult,
  normalizeRewriteIntervention,
  normalizeRewriteMode
} from './rewritePipeline';

export interface RewriteApiResponse {
  body: RewriteResult;
  httpStatus: number;
}

type RewriteExecutor = (input: RewritePipelineInput) => Promise<RewriteResult>;

function errorResponse(
  original: string,
  mode: RewriteResult['mode'],
  reason: string,
  message: string,
  httpStatus: number,
  startedAt: number,
  intervention: RewriteIntervention = DEFAULT_REWRITE_INTERVENTION
): RewriteApiResponse {
  return {
    body: createRewriteErrorResult(original, mode, reason, message, startedAt, intervention),
    httpStatus
  };
}

/**
 * Validates the transport payload before it reaches the rewrite pipeline.
 * `prompt` remains supported for existing clients while `text` is the public API field.
 */
export async function handleRewriteApiBody(
  body: unknown,
  rewrite: RewriteExecutor = rewritePromptLocally,
  startedAt = Date.now()
): Promise<RewriteApiResponse> {
  if (body === undefined || body === null) {
    return errorResponse('', 'fast', 'missing_body', 'Request body is required', 400, startedAt);
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return errorResponse('', 'fast', 'invalid_body', 'Request body must be a JSON object', 400, startedAt);
  }

  const payload = body as Record<string, unknown>;
  const intervention = normalizeRewriteIntervention(payload.intervention);
  const hasText = Object.prototype.hasOwnProperty.call(payload, 'text');
  const hasLegacyPrompt = Object.prototype.hasOwnProperty.call(payload, 'prompt');
  if (!hasText && !hasLegacyPrompt) {
    return errorResponse('', 'fast', 'missing_text', 'Text is required', 400, startedAt, intervention);
  }

  const candidate = hasText ? payload.text : payload.prompt;
  if (typeof candidate !== 'string') {
    return errorResponse(
      '',
      'fast',
      'non_string_text',
      'Text must be a string',
      400,
      startedAt,
      intervention
    );
  }

  const original = candidate;
  const mode = normalizeRewriteMode(payload.performanceMode ?? payload.mode, original);
  if (!original.trim()) {
    return errorResponse(original, mode, 'empty_text', 'Text cannot be empty', 400, startedAt, intervention);
  }

  const maximum = MODEL_PROFILES[mode].maxInputCharacters;
  if (original.trim().length > maximum) {
    return errorResponse(
      original,
      mode,
      'prompt_too_long',
      `Text exceeds the ${maximum} character limit for ${mode} mode`,
      413,
      startedAt,
      intervention
    );
  }

  try {
    const result = await rewrite({
      prompt: original,
      useCase: typeof payload.useCase === 'string' ? (payload.useCase as UseCase) : 'general',
      hasPriorConversation: payload.hasPriorConversation === true,
      performanceMode: mode,
      intervention,
      keepModelsWarm: payload.keepModelsWarm !== false
    });
    return {
      body: {
        ...result,
        original,
        latencyMs: Math.max(0, Date.now() - startedAt),
        mode,
        intervention
      },
      httpStatus: result.status !== 'error' ? 200 : result.validation.reason === 'prompt_too_long' ? 413 : 500
    };
  } catch {
    // Never expose local stack traces or raw model errors through the API.
    return errorResponse(
      original,
      mode,
      'internal_error',
      'Unexpected local rewrite failure',
      500,
      startedAt,
      intervention
    );
  }
}

export function invalidJsonResponse(startedAt = Date.now()): RewriteApiResponse {
  return errorResponse('', 'fast', 'invalid_json', 'Request body must contain valid JSON', 400, startedAt);
}
