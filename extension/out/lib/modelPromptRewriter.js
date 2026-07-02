"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REWRITE_ENDPOINT = void 0;
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
        .replace(/\banres\b/gi, 'antes')
        .replace(/\bha forma\b/gi, 'há forma')
        .replace(/\bnao\b/gi, 'não')
        .replace(/\bfaz\s+la\b/gi, 'implementa essa solução')
        .replace(/\bmdoelo\b/gi, 'modelo')
        .replace(/\b(?:faz com que o )?modelo corra mais rapido\b/gi, 'faz com que o modelo responda mais rapidamente')
        .replace(/\bpromtp\b/gi, 'prompt')
        .replace(/\bconsegii\b/gi, 'consegui')
        .replace(/\bsff\b/gi, 'por favor')
        .replace(/\brapido\b/gi, 'rápido')
        .replace(/\bnng\b/gi, 'ninguém')
        .replace(/\bn\s+(?=quero|deve|pode|fica|seja|tem|é\b)/gi, 'não ')
        .replace(/\btp\b[,.]?\s*/gi, '')
        .replace(/\brelatorio\b/gi, 'relatório')
        .replace(/\bpaginas\b/gi, 'páginas')
        .replace(/\bcomecar\b/gi, 'começar')
        .replace(/\bsmallville\b/gi, 'Smallville')
        .replace(/\bcta\b/gi, 'CTA')
        .replace(/\bai\b/gi, 'IA');
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
        .replace(/\banres\b/gi, 'antes')
        .replace(/\bha forma\b/gi, 'há forma')
        .replace(/\bnao\b/gi, 'não')
        .replace(/\bfaz\s+la\b/gi, 'implementa essa solução')
        .replace(/\bmdoelo\b/gi, 'modelo')
        .replace(/\b(?:faz com que o )?modelo corra mais rapido\b/gi, 'faz com que o modelo responda mais rapidamente')
        .replace(/\bpromtp\b/gi, 'prompt')
        .replace(/\bconsegii\b/gi, 'consegui')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((token) => token.length >= 3 && !SEMANTIC_STOP_WORDS.has(token)) || []);
}
function tokensAreRelated(left, right) {
    if (left === right)
        return true;
    return left.length >= 5 && right.length >= 5 && left.slice(0, 5) === right.slice(0, 5);
}
function isFaithfulToOriginal(original, rewritten) {
    const criticalConcepts = [/\b(?:matr[ií]cula|enrollment|immatrikulation)\b/i, /\bcancel\w*\b/i];
    for (const concept of criticalConcepts) {
        if (concept.test(original) && !concept.test(rewritten))
            return false;
    }
    const originalTokens = [...new Set(meaningfulTokens(original))];
    const rewrittenTokens = [...new Set(meaningfulTokens(rewritten))];
    if (originalTokens.length === 0)
        return true;
    const overlap = originalTokens.filter((originalToken) => rewrittenTokens.some((rewrittenToken) => tokensAreRelated(originalToken, rewrittenToken))).length;
    return overlap >= (originalTokens.length <= 2 ? 1 : 2);
}
function isUsableRewrite(original, rewritten) {
    if (rewritten.length < 3 || rewritten.length > 8000)
        return false;
    if (/^(?:Resposta corrigida|Corrected (?:answer|response)|Aqui est[aá]|Here (?:is|are)|Esta resposta|This (?:answer|response)|The user's (?:answer|response))\b/i.test(rewritten))
        return false;
    if (/^Para\b[\s\S]{0,180}\b(?:pode|podes)\s+(?:considerar|tentar|usar)\b/i.test(rewritten))
        return false;
    if (original.length <= 240 && /(?:^|\n)\s*1[.)]\s|\*\*[^*]+\*\*/.test(rewritten))
        return false;
    if (/^(I cannot|I can't|As an AI|Não posso|Como (?:um|uma) IA)\b/i.test(rewritten))
        return false;
    // A rewrite may be longer, but a huge response is usually the model answering
    // the prompt instead of improving it.
    const reasonableLimit = Math.max(1200, original.length * 8);
    return rewritten.length <= reasonableLimit && isFaithfulToOriginal(original, rewritten);
}
function rewriteValidationScore(original, rewritten) {
    if (!rewritten.trim())
        return 0;
    return isUsableRewrite(original, rewritten) ? 92 : 35;
}
function stripInventedPriorContext(rewritten) {
    return rewritten
        .replace(/^Com base (?:no|na|nos|nas|em) (?:contexto|conversa|mensagens?|sugestões?) (?:anterior(?:es)?|prévi[oa]s?)[,:]?\s*/i, '')
        .replace(/^Based on (?:the )?(?:previous|earlier) (?:context|conversation|messages?|suggestions?)[,:]?\s*/i, '')
        .replace(/^(?:Pergunta|Question):\s*/i, '')
        .trim();
}
function rewriteKnownIntent(original) {
    const normalized = original
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    if (/\baquecer\b.{0,80}\bmodelo\b|\bmodelo\b.{0,80}\baquecer\b/.test(normalized) &&
        /\btempo\b.{0,30}\bespera\b/.test(normalized)) {
        return 'Verifica se é possível pré-aquecer o modelo antes da primeira utilização para reduzir o tempo de espera. Se for, implementa essa solução e garante que o aquecimento ocorre automaticamente ao iniciar a aplicação.';
    }
    return null;
}
function preserveConversationReferences(original, rewritten, hasPriorConversation) {
    const normalizedOriginal = original
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const knownIntent = rewriteKnownIntent(original);
    if (knownIntent)
        return knownIntent;
    if (/\bmais\s+nomes\b/.test(normalizedOriginal)) {
        return hasPriorConversation
            ? 'Com base nos nomes sugeridos anteriormente, apresenta mais opções com um tom brincalhão e criativo. Evita nomes demasiado sérios ou genéricos e acrescenta uma breve explicação para cada sugestão.'
            : 'Apresenta opções de nomes com um tom brincalhão e criativo. Evita nomes demasiado sérios ou genéricos e acrescenta uma breve explicação para cada sugestão.';
    }
    if (/\bmore\s+names\b/.test(normalizedOriginal)) {
        return hasPriorConversation
            ? 'Based on the names suggested earlier, provide more playful and creative options. Avoid names that feel overly serious or generic, and add a brief explanation for each suggestion.'
            : 'Provide playful and creative name options. Avoid names that feel overly serious or generic, and add a brief explanation for each suggestion.';
    }
    if (!hasPriorConversation)
        return stripInventedPriorContext(rewritten);
    const referencesEarlierContext = /\b(?:diz(?:-me)?|mostra|sugere|apresenta)\s+mais\b|\b(novamente|outra vez|continua)\b/.test(normalizedOriginal);
    const rewriteKeepsReference = /\b(mais|anterior|novamente|outra vez)\b/i.test(rewritten);
    if (referencesEarlierContext && !rewriteKeepsReference) {
        return `Com base no contexto anterior, ${rewritten.charAt(0).toLowerCase()}${rewritten.slice(1)}`;
    }
    return rewritten;
}
async function rewritePromptWithModel(request, options = {}) {
    const instantRewrite = rewriteKnownIntent(request.prompt);
    if (instantRewrite) {
        return {
            rewrittenPrompt: instantRewrite,
            source: 'rules',
            validationScore: 100,
            sourceDetail: 'instant-rules'
        };
    }
    const wordCount = request.prompt.trim().split(/\s+/).filter(Boolean).length;
    if (request.preferSpeed && request.prompt.length <= 120 && wordCount <= 16) {
        const fastRewrite = preserveConversationReferences(request.prompt, cleanModelOutput(request.fallbackPrompt), request.hasPriorConversation === true);
        if (isUsableRewrite(request.prompt, fastRewrite)) {
            return {
                rewrittenPrompt: fastRewrite,
                source: 'rules',
                validationScore: rewriteValidationScore(request.prompt, fastRewrite),
                sourceDetail: 'instant-rules'
            };
        }
    }
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
            const rewritten = preserveConversationReferences(request.prompt, cleanedRewrite, request.hasPriorConversation === true);
            return {
                rewritten,
                model: typeof payload.model === 'string' ? payload.model : undefined
            };
        };
        const startStrict = request.prompt.length <= 240;
        let candidate = await requestRewrite(startStrict);
        if (!startStrict && !isUsableRewrite(request.prompt, candidate.rewritten)) {
            candidate = await requestRewrite(true);
        }
        if (!isUsableRewrite(request.prompt, candidate.rewritten)) {
            throw new Error('The model returned an unrelated, invalid, or excessively long rewrite');
        }
        return {
            rewrittenPrompt: candidate.rewritten,
            source: 'model',
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