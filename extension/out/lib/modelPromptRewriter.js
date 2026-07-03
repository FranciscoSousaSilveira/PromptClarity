"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REWRITE_ENDPOINT = void 0;
exports.isModelRewriteUsable = isModelRewriteUsable;
exports.rewriteValidationScore = rewriteValidationScore;
exports.rewritePromptWithModel = rewritePromptWithModel;
exports.DEFAULT_REWRITE_ENDPOINT = 'http://127.0.0.1:3000/api/rewrite';
function cleanModelOutput(value) {
    let cleaned = value.trim();
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
        cleaned = cleaned
            .replace(/^```(?:text|markdown)?\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();
    }
    const wrappingQuote = cleaned.match(/^["“](.*)["”]$/s);
    if (wrappingQuote)
        cleaned = wrappingQuote[1].trim();
    cleaned = cleaned
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.;:?!])/g, '$1')
        .trim();
    return cleaned;
}
const SEMANTIC_STOP_WORDS = new Set([
    'the',
    'and',
    'for',
    'with',
    'this',
    'that',
    'from',
    'into',
    'your',
    'you',
    'are',
    'uma',
    'uns',
    'nas',
    'nos',
    'das',
    'dos',
    'que',
    'para',
    'com',
    'por',
    'mais',
    'nao',
    'ainda',
    'sem',
    'ter',
    'faz',
    'fazer',
    'quero'
]);
function meaningfulTokens(value) {
    return (value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((token) => token.length >= 3 && !SEMANTIC_STOP_WORDS.has(token)) || []);
}
function tokensAreRelated(left, right) {
    if (left === right)
        return true;
    if (left.length >= 5 && right.length >= 5 && left.slice(0, 5) === right.slice(0, 5))
        return true;
    if (left.length < 4 || right.length < 4 || Math.abs(left.length - right.length) > 2)
        return false;
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
        let diagonal = previous[0];
        previous[0] = leftIndex;
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
            const above = previous[rightIndex];
            previous[rightIndex] = Math.min(previous[rightIndex] + 1, previous[rightIndex - 1] + 1, diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
            diagonal = above;
        }
    }
    return previous[right.length] <= 2;
}
function isFaithfulToOriginal(original, rewritten) {
    const originalTokens = [...new Set(meaningfulTokens(original))];
    const rewrittenTokens = [...new Set(meaningfulTokens(rewritten))];
    if (originalTokens.length === 0)
        return true;
    const overlap = originalTokens.filter((originalToken) => rewrittenTokens.some((rewrittenToken) => tokensAreRelated(originalToken, rewrittenToken))).length;
    const novelTokens = rewrittenTokens.filter((rewrittenToken) => !originalTokens.some((originalToken) => tokensAreRelated(originalToken, rewrittenToken))).length;
    return (overlap >= Math.max(1, Math.ceil(originalTokens.length * 0.5)) &&
        novelTokens <= Math.max(3, Math.ceil(originalTokens.length * 0.35)));
}
function isModelRewriteUsable(original, rewritten) {
    const trimmedRewrite = rewritten.trim();
    if (trimmedRewrite.length < 3 || trimmedRewrite.length > 8000)
        return false;
    if (/^(?:Resposta corrigida|Corrected (?:answer|response)|Aqui est[aá]|Here (?:is|are)|Esta resposta|This (?:answer|response)|The user's (?:answer|response))\b/i.test(rewritten))
        return false;
    if (/^Para\b[\s\S]{0,180}\b(?:pode|podes)\s+(?:considerar|tentar|usar)\b/i.test(rewritten))
        return false;
    if (original.length <= 240 && /(?:^|\n)\s*1[.)]\s|\*\*[^*]+\*\*/.test(rewritten))
        return false;
    if (/^(?:(?:Eu|I)\s+)?(?:não|nao)\s+(?:posso|consigo)\b|^I\s+(?:cannot|can't|am unable)\b|^As an AI\b|^Como (?:um|uma) IA\b/i.test(rewritten))
        return false;
    if (/^(?:O que (?:você|tu) (?:está|estás) (?:buscando|a procurar|à procura)|Parece que (?:você|tu)|It (?:sounds|seems) like you(?:'re| are) looking for)\b/i.test(trimmedRewrite))
        return false;
    if (!/[?!.]$/.test(trimmedRewrite) &&
        /\b(?:como|por exemplo|incluindo|tais como|such as|including|for example|like)\s*$/i.test(trimmedRewrite))
        return false;
    const originalIsQuestion = /\?\s*$/.test(original.trim());
    const rewriteIsRequest = trimmedRewrite.includes('?') ||
        /^(?:Ajuda|Identifica|Sugere|Explica|Analisa|Compara|Indica|Diz|Responde|Lista|Encontra|Escreve|Cria|Verifica|Considera|Help|Identify|Suggest|Explain|Analyze|Compare|State|Tell|Answer|List|Find|Write|Create|Check|Consider)\b/i.test(trimmedRewrite);
    if (originalIsQuestion && !rewriteIsRequest)
        return false;
    // A rewrite may be longer, but a huge response is usually the model answering
    // the prompt instead of improving it.
    const reasonableLimit = Math.max(original.length + 80, original.length * 1.6);
    return trimmedRewrite.length <= reasonableLimit && isFaithfulToOriginal(original, trimmedRewrite);
}
function rewriteValidationScore(original, rewritten) {
    if (!rewritten.trim())
        return 0;
    return isModelRewriteUsable(original, rewritten) ? 92 : 35;
}
function stripInventedPriorContext(rewritten) {
    return rewritten
        .replace(/^Com base (?:no|na|nos|nas|em) (?:contexto|conversa|mensagens?|sugestões?) (?:anterior(?:es)?|prévi[oa]s?)[,:]?\s*/i, '')
        .replace(/^Based on (?:the )?(?:previous|earlier) (?:context|conversation|messages?|suggestions?)[,:]?\s*/i, '')
        .replace(/^(?:Pergunta|Question):\s*/i, '')
        .trim();
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
async function rewritePromptWithModel(request, options = {}) {
    const endpoint = options.endpoint || exports.DEFAULT_REWRITE_ENDPOINT;
    // Small local models can take longer on their first request while weights
    // are loaded into memory. Subsequent requests are normally much faster.
    const timeoutMs = options.timeoutMs ?? 120000;
    const fetchImpl = options.fetchImpl || fetch;
    const token = options.token || (typeof process !== 'undefined' ? process.env?.PROMPT_GRAMMARLY_TOKEN : undefined);
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const requestRewrite = async (strict) => {
            const response = await fetchImpl(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'X-Prompt-Grammarly-Token': token } : {})
                },
                body: JSON.stringify({
                    prompt: request.prompt,
                    useCase: request.useCase || 'general',
                    ruleBasedDraft: request.fallbackPrompt,
                    hasPriorConversation: request.hasPriorConversation === true,
                    strict,
                    performanceMode: request.performanceMode,
                    keepModelsWarm: request.keepModelsWarm
                }),
                signal: controller.signal
            });
            if (!response.ok)
                throw new Error(`Local model service returned ${response.status}`);
            const payload = (await response.json());
            const cleanedRewrite = cleanModelOutput(typeof payload.rewrittenPrompt === 'string' ? payload.rewrittenPrompt : '');
            const rewritten = request.hasPriorConversation
                ? cleanedRewrite
                : stripInventedPriorContext(cleanedRewrite);
            return {
                rewritten,
                model: typeof payload.model === 'string' ? payload.model : undefined
            };
        };
        const startStrict = request.prompt.length <= 240;
        let candidate = await requestRewrite(startStrict);
        if (!startStrict && !isModelRewriteUsable(request.prompt, candidate.rewritten)) {
            candidate = await requestRewrite(true);
        }
        if (!isModelRewriteUsable(request.prompt, candidate.rewritten)) {
            throw new Error('The model returned an unrelated, invalid, or excessively long rewrite');
        }
        const isAlreadyGood = isMechanicallyWellFormed(request.prompt) && hasSameWords(request.prompt, candidate.rewritten);
        return {
            rewrittenPrompt: isAlreadyGood ? request.prompt.trim() : candidate.rewritten,
            source: 'model',
            isAlreadyGood,
            model: candidate.model,
            validationScore: rewriteValidationScore(request.prompt, candidate.rewritten),
            sourceDetail: 'local-ai'
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown local model error';
        return {
            rewrittenPrompt: request.fallbackPrompt,
            source: 'rules',
            isAlreadyGood: normalizeForEquality(request.fallbackPrompt) === normalizeForEquality(request.prompt),
            error: message,
            validationScore: rewriteValidationScore(request.prompt, request.fallbackPrompt),
            sourceDetail: 'safety-fallback'
        };
    }
    finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abortFromCaller);
    }
}
//# sourceMappingURL=modelPromptRewriter.js.map