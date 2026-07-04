"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRewriteApiBody = handleRewriteApiBody;
exports.invalidJsonResponse = invalidJsonResponse;
const product_1 = require("../config/product");
const localRewriteService_1 = require("./localRewriteService");
const rewritePipeline_1 = require("./rewritePipeline");
function errorResponse(original, mode, reason, message, httpStatus, startedAt, intervention = product_1.DEFAULT_REWRITE_INTERVENTION) {
    return {
        body: (0, rewritePipeline_1.createRewriteErrorResult)(original, mode, reason, message, startedAt, intervention),
        httpStatus
    };
}
/**
 * Validates the transport payload before it reaches the rewrite pipeline.
 * `prompt` remains supported for existing clients while `text` is the public API field.
 */
async function handleRewriteApiBody(body, rewrite = localRewriteService_1.rewritePromptLocally, startedAt = Date.now()) {
    if (body === undefined || body === null) {
        return errorResponse('', 'fast', 'missing_body', 'Request body is required', 400, startedAt);
    }
    if (typeof body !== 'object' || Array.isArray(body)) {
        return errorResponse('', 'fast', 'invalid_body', 'Request body must be a JSON object', 400, startedAt);
    }
    const payload = body;
    const intervention = (0, rewritePipeline_1.normalizeRewriteIntervention)(payload.intervention);
    const hasText = Object.prototype.hasOwnProperty.call(payload, 'text');
    const hasLegacyPrompt = Object.prototype.hasOwnProperty.call(payload, 'prompt');
    if (!hasText && !hasLegacyPrompt) {
        return errorResponse('', 'fast', 'missing_text', 'Text is required', 400, startedAt, intervention);
    }
    const candidate = hasText ? payload.text : payload.prompt;
    if (typeof candidate !== 'string') {
        return errorResponse('', 'fast', 'non_string_text', 'Text must be a string', 400, startedAt, intervention);
    }
    const original = candidate;
    const mode = (0, rewritePipeline_1.normalizeRewriteMode)(payload.performanceMode ?? payload.mode, original);
    if (!original.trim()) {
        return errorResponse(original, mode, 'empty_text', 'Text cannot be empty', 400, startedAt, intervention);
    }
    const maximum = product_1.MODEL_PROFILES[mode].maxInputCharacters;
    if (original.trim().length > maximum) {
        return errorResponse(original, mode, 'prompt_too_long', `Text exceeds the ${maximum} character limit for ${mode} mode`, 413, startedAt, intervention);
    }
    try {
        const result = await rewrite({
            prompt: original,
            useCase: typeof payload.useCase === 'string' ? payload.useCase : 'general',
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
    }
    catch {
        // Never expose local stack traces or raw model errors through the API.
        return errorResponse(original, mode, 'internal_error', 'Unexpected local rewrite failure', 500, startedAt, intervention);
    }
}
function invalidJsonResponse(startedAt = Date.now()) {
    return errorResponse('', 'fast', 'invalid_json', 'Request body must contain valid JSON', 400, startedAt);
}
//# sourceMappingURL=rewriteApi.js.map