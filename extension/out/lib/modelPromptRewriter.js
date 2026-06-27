"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REWRITE_ENDPOINT = void 0;
exports.rewritePromptWithModel = rewritePromptWithModel;
exports.DEFAULT_REWRITE_ENDPOINT = 'http://127.0.0.1:3000/api/rewrite';
function cleanModelOutput(value) {
    let cleaned = value.trim();
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
        cleaned = cleaned.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    const wrappingQuote = cleaned.match(/^["“](.*)["”]$/s);
    if (wrappingQuote)
        cleaned = wrappingQuote[1].trim();
    return cleaned;
}
function isUsableRewrite(original, rewritten) {
    if (rewritten.length < 3 || rewritten.length > 8000)
        return false;
    if (/^(I cannot|I can't|As an AI|Não posso|Como (?:um|uma) IA)\b/i.test(rewritten))
        return false;
    // A rewrite may be longer, but a huge response is usually the model answering
    // the prompt instead of improving it.
    const reasonableLimit = Math.max(1200, original.length * 8);
    return rewritten.length <= reasonableLimit;
}
async function rewritePromptWithModel(request, options = {}) {
    const endpoint = options.endpoint || exports.DEFAULT_REWRITE_ENDPOINT;
    // Small local models can take longer on their first request while weights
    // are loaded into memory. Subsequent requests are normally much faster.
    const timeoutMs = options.timeoutMs ?? 60000;
    const fetchImpl = options.fetchImpl || fetch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: request.prompt,
                useCase: request.useCase || 'general',
                ruleBasedDraft: request.fallbackPrompt
            }),
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(`Local model service returned ${response.status}`);
        }
        const payload = await response.json();
        const rewritten = cleanModelOutput(typeof payload.rewrittenPrompt === 'string' ? payload.rewrittenPrompt : '');
        if (!isUsableRewrite(request.prompt, rewritten)) {
            throw new Error('The model returned an invalid or excessively long rewrite');
        }
        return {
            rewrittenPrompt: rewritten,
            source: 'model',
            model: typeof payload.model === 'string' ? payload.model : undefined
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown local model error';
        return {
            rewrittenPrompt: request.fallbackPrompt,
            source: 'rules',
            error: message
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
//# sourceMappingURL=modelPromptRewriter.js.map