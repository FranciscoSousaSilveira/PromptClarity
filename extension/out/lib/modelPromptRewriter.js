"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REWRITE_ENDPOINT = exports.validateModelRewrite = exports.rewriteValidationScore = exports.isModelRewriteUsable = void 0;
exports.rewritePromptWithModel = rewritePromptWithModel;
const product_1 = require("../config/product");
const rewriteValidator_1 = require("./rewriteValidator");
var rewriteValidator_2 = require("./rewriteValidator");
Object.defineProperty(exports, "isModelRewriteUsable", { enumerable: true, get: function () { return rewriteValidator_2.isModelRewriteUsable; } });
Object.defineProperty(exports, "rewriteValidationScore", { enumerable: true, get: function () { return rewriteValidator_2.rewriteValidationScore; } });
Object.defineProperty(exports, "validateModelRewrite", { enumerable: true, get: function () { return rewriteValidator_2.validateModelRewrite; } });
exports.DEFAULT_REWRITE_ENDPOINT = 'http://127.0.0.1:3000/api/rewrite';
function cleanModelOutput(value) {
    let cleaned = value.trim();
    const wrappingQuote = cleaned.match(/^["“](.*)["”]$/s);
    if (wrappingQuote)
        cleaned = wrappingQuote[1].trim();
    cleaned = cleaned
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.;:?!])/g, '$1')
        .trim();
    return cleaned;
}
function isNormalizedRewriteResult(value) {
    if (!value || typeof value !== 'object')
        return false;
    const result = value;
    return ((result.status === 'changed' ||
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
        (0, product_1.isPerformanceMode)(result.mode) &&
        Boolean(result.validation &&
            typeof result.validation.passed === 'boolean' &&
            typeof result.validation.reason === 'string'));
}
function toClientResult(result) {
    const intervention = (0, product_1.isRewriteIntervention)(result.intervention)
        ? result.intervention
        : product_1.DEFAULT_REWRITE_INTERVENTION;
    return {
        ...result,
        intervention,
        rewrittenPrompt: result.rewritten,
        isAlreadyGood: result.status === 'no_change',
        validationScore: result.validation.passed
            ? 92
            : (0, rewriteValidator_1.rewriteValidationScore)(result.original, result.rewritten, intervention),
        sourceDetail: result.source === 'model' || result.source === 'checkmark' ? 'local-ai' : 'safety-fallback'
    };
}
async function rewritePromptWithModel(request, options = {}) {
    const endpoint = options.endpoint || exports.DEFAULT_REWRITE_ENDPOINT;
    // Small local models can take longer on their first request while weights
    // are loaded into memory. Subsequent requests are normally much faster.
    const timeoutMs = options.timeoutMs ?? 120000;
    const fetchImpl = options.fetchImpl || fetch;
    const token = options.token || (typeof process !== 'undefined' ? process.env?.PROMPT_CLARITY_TOKEN : undefined);
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const mode = (0, product_1.isPerformanceMode)(request.performanceMode)
        ? request.performanceMode
        : request.prompt.trim().length <= 240
            ? 'fast'
            : 'balanced';
    const intervention = (0, product_1.isRewriteIntervention)(request.intervention)
        ? request.intervention
        : product_1.DEFAULT_REWRITE_INTERVENTION;
    try {
        const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'X-PromptClarity-Token': token } : {})
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
        const payload = (await response.json());
        if (isNormalizedRewriteResult(payload))
            return toClientResult(payload);
        if (!response.ok)
            throw new Error(`Local model service returned ${response.status}`);
        // Compatibility with a previously built local server during an incremental update.
        const legacy = payload;
        const cleanedRewrite = cleanModelOutput(typeof legacy.rewrittenPrompt === 'string' ? legacy.rewrittenPrompt : '');
        const rewritten = cleanedRewrite;
        const validation = (0, rewriteValidator_1.validateModelRewrite)(request.prompt, rewritten, intervention);
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
    }
    catch (error) {
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
    }
    finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
    }
}
//# sourceMappingURL=modelPromptRewriter.js.map