"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRewriteMode = normalizeRewriteMode;
exports.normalizeRewriteIntervention = normalizeRewriteIntervention;
exports.createRewriteErrorResult = createRewriteErrorResult;
exports.runRewritePipeline = runRewritePipeline;
const product_1 = require("../config/product");
const prompt_1 = require("../types/prompt");
const promptAnalyzer_1 = require("./promptAnalyzer");
const rewriteValidator_1 = require("./rewriteValidator");
const USE_CASES = new Set(prompt_1.USE_CASE_OPTIONS.map((option) => option.value));
function elapsedSince(startedAt) {
    return Math.max(0, Date.now() - startedAt);
}
function normalizeForEquality(value) {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}
function normalizedWordBag(value) {
    return (value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .match(/[a-z0-9]+/g) || []).sort();
}
function isMechanicallyWellFormed(value) {
    const trimmed = value.trim();
    const firstLetter = trimmed.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/)?.[0];
    return (Boolean(firstLetter && firstLetter === firstLetter.toUpperCase()) &&
        /[?!.]$/.test(trimmed) &&
        !/\s{2,}/.test(trimmed) &&
        !/\b(?:nao|sff|nng|tp)\b/i.test(trimmed));
}
function hasSameWords(left, right) {
    const leftWords = normalizedWordBag(left);
    const rightWords = normalizedWordBag(right);
    return (leftWords.length === rightWords.length && leftWords.every((word, index) => word === rightWords[index]));
}
function cleanModelOutput(value) {
    let cleaned = value.trim();
    const wrappingQuote = cleaned.match(/^["“](.*)["”]$/s);
    if (wrappingQuote)
        cleaned = wrappingQuote[1].trim();
    return cleaned
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.;:?!])/g, '$1')
        .trim();
}
function normalizeUseCase(useCase) {
    return typeof useCase === 'string' && USE_CASES.has(useCase) ? useCase : 'general';
}
function normalizeRewriteMode(value, prompt = '') {
    if ((0, product_1.isPerformanceMode)(value))
        return value;
    return prompt.trim().length <= 240 ? 'fast' : 'balanced';
}
function normalizeRewriteIntervention(value) {
    return (0, product_1.isRewriteIntervention)(value) ? value : product_1.DEFAULT_REWRITE_INTERVENTION;
}
function createRewriteErrorResult(original, mode, reason, error, startedAt = Date.now(), intervention = product_1.DEFAULT_REWRITE_INTERVENTION) {
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
function noChangeDetected(original, candidate) {
    return (normalizeForEquality(original) === normalizeForEquality(candidate) ||
        (isMechanicallyWellFormed(original) && hasSameWords(original, candidate)));
}
function fallbackResult(original, fallback, mode, validation, error, startedAt, intervention) {
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
async function runRewritePipeline(input, rewriteWithModel) {
    const startedAt = Date.now();
    const original = typeof input.prompt === 'string' ? input.prompt : '';
    const prompt = original.trim();
    const mode = normalizeRewriteMode(input.performanceMode, prompt);
    const intervention = normalizeRewriteIntervention(input.intervention);
    const profile = product_1.MODEL_PROFILES[mode];
    if (prompt.length < 2) {
        return createRewriteErrorResult(original, mode, 'prompt_required', 'Prompt is required', startedAt, intervention);
    }
    if (prompt.length > profile.maxInputCharacters) {
        return createRewriteErrorResult(original, mode, 'prompt_too_long', 'Prompt is too long for the selected mode', startedAt, intervention);
    }
    let fallback = prompt;
    try {
        fallback =
            (0, promptAnalyzer_1.analyzePrompt)(prompt, normalizeUseCase(input.useCase), intervention).rewrittenPrompt.trim() || prompt;
    }
    catch {
        // The untouched prompt remains a safe final fallback if local analysis fails.
    }
    try {
        const requestModel = async (safetyRetry) => {
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
        let validation = (0, rewriteValidator_1.validateModelRewrite)(prompt, candidate.rewritten, intervention);
        if (!startStrict && !validation.passed) {
            candidate = await requestModel(true);
            validation = (0, rewriteValidator_1.validateModelRewrite)(prompt, candidate.rewritten, intervention);
        }
        if (!validation.passed) {
            return fallbackResult(original, fallback, mode, validation, `The model rewrite was rejected: ${validation.reason}`, startedAt, intervention);
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
    }
    catch (error) {
        const message = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
            ? 'Local model request timed out'
            : 'Local model is unavailable';
        return fallbackResult(original, fallback, mode, { passed: false, reason: 'model_unavailable' }, message, startedAt, intervention);
    }
}
//# sourceMappingURL=rewritePipeline.js.map