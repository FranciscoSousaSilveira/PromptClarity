"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateModelRewrite = validateModelRewrite;
exports.isModelRewriteUsable = isModelRewriteUsable;
exports.rewriteValidationScore = rewriteValidationScore;
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
const PORTUGUESE_LANGUAGE_WORDS = new Set([
    'a',
    'acho',
    'ajuda',
    'com',
    'como',
    'de',
    'do',
    'e',
    'em',
    'este',
    'esta',
    'explica',
    'isto',
    'me',
    'nao',
    'o',
    'para',
    'pode',
    'portugal',
    'portugues',
    'que',
    'um',
    'uma'
]);
const ENGLISH_LANGUAGE_WORDS = new Set([
    'a',
    'and',
    'can',
    'code',
    'explain',
    'for',
    'help',
    'in',
    'is',
    'it',
    'of',
    'please',
    'that',
    'the',
    'this',
    'to',
    'what',
    'with',
    'you'
]);
const DIRECTIVE_START = /^(?:ajuda|clarifica|corrige|cria|define|diz|encontra|escreve|explica|faz|identifica|indica|lista|melhora|mostra|analisa|compara|responde|revê|sugere|verifica|help|clarify|correct|create|define|tell|find|write|explain|make|identify|state|list|improve|show|analyze|compare|answer|review|suggest|check)\b/i;
const QUESTION_START = /^(?:o que|quem|qual|quais|quando|onde|como|por que|porque é que|podes|pode|podias|what|who|which|when|where|how|why|can you|could you|would you)\b/i;
const ASSISTANT_PREFACE = /(?:(?:^|[\n.!?:;]\s*)(?:claro|sure)(?=[\s,.:;!?]|$)|(?:aqui est[aá]|posso ajudar|a resposta [eé]|here is|here are|i can help|the answer is)(?=[\s,.:;!?]|$))/i;
const REFUSAL = /\b(?:n[aã]o posso|n[aã]o consigo|desculpa|lamento|i cannot|i can't|i am unable|i[’']m sorry|i am sorry|sorry)\b/i;
const PROMPT_COMMENTARY = /(?:\b(?:corrigi (?:a )?(?:gram[aá]tica|ortografia|pontua[çc][aã]o)|esta prompt (?:j[aá] )?est[aá] clara|nenhuma altera[çc][aã]o (?:foi )?necess[aá]ria|sem altera[çc][oõ]es necess[aá]rias|a prompt melhorada [eé]|a vers[aã]o corrigida [eé]|aqui est[aá] a vers[aã]o corrigida|i corrected the grammar|this prompt is already clear|no changes needed|the improved prompt is)\b|(?:vers[aã]o corrigida|corrected version)\s*:)/i;
const MARKDOWN_PATTERNS = [/^\s{0,3}#{1,6}\s+/m, /```|~~~/, /\*\*[^*]+\*\*|__[^_]+__/, /^\s{0,3}>\s+/m];
const LIST_PATTERN = /(?:^|\n)\s*(?:[-+*]|\d+[.)])\s+\S/m;
const SECTION_PATTERN = /(?:^|\n)\s*(?:objetivo|contexto|passos?|requisitos?|formato|conclus[aã]o|objective|context|steps?|requirements?|format|conclusion)\s*:/im;
const TOOL_CONCEPTS = [
    'python',
    'javascript',
    'typescript',
    'java',
    'node',
    'angular',
    'vue',
    'django',
    'flask',
    'sql',
    'rust',
    'react',
    'docker',
    'excel',
    'pdf',
    'json',
    'csv',
    'html',
    'xml',
    'yaml',
    'docx',
    'markdown',
    'framework',
    'frameworks',
    'test',
    'testes',
    'tests',
    'unitários',
    'unitarios',
    'unit',
    'citações',
    'citacoes',
    'citations',
    'fontes',
    'sources',
    'links'
];
const EXPANSION_CONCEPTS = [
    'exemplos',
    'examples',
    'fórmulas',
    'formulas',
    'diagramas',
    'diagrams',
    'práticos',
    'praticos',
    'practical',
    'tabela',
    'table',
    'recomendações',
    'recomendacoes',
    'recommendations',
    'conclusão',
    'conclusao',
    'conclusion',
    'referências',
    'referencias',
    'references'
];
const EXPANSION_PHRASES = [
    /\b(?:adiciona|acrescenta|inclui|usa|utiliza|apresenta|fornece|recomenda)\b/i,
    /\b(?:add|include|use|present|provide|recommend)\b/i,
    /\b(?:passo a passo|step by step|em formato|in (?:a |the )?format|de forma (?:detalhada|simples)|in detail)\b/i,
    /\b(?:no m[aá]ximo|pelo menos|limite de|maximum|at least|limit of)\b/i
];
const UNCERTAINTY_PATTERNS = [
    /\bacho\b/i,
    /\bpenso(?:\s+que)?\b/i,
    /\bdiria\b/i,
    /\btalvez\b/i,
    /\b(?:pode|poder[aá]|poderia)\b/i,
    /\bparece\b/i,
    /\bprovavelmente\b/i,
    /\bpossivelmente\b/i,
    /\bn[aã]o (?:tenho|estou) cert[oa]\b/i,
    /\bi think\b/i,
    /\bi guess\b/i,
    /\bmaybe\b/i,
    /\b(?:may|might|could)\b/i,
    /\bseems?\b/i,
    /\bprobably\b/i,
    /\bpossibly\b/i,
    /\bunsure\b/i
];
const BRAZILIAN_MARKERS = [
    /\bvoc[eê]s?(?=[\s,.:;!?]|$)/i,
    /\busu[aá]ri[oa]s?\b/i,
    /\barquivo(?:s)?\b/i,
    /\baplicativo(?:s)?\b/i,
    /\bcelular(?:es)?\b/i,
    /\b(?:est[aá]|est[aã]o) (?:funcionando|fazendo|usando)\b/i
];
const STRONG_BRAZILIAN_MARKERS = [BRAZILIAN_MARKERS[0], BRAZILIAN_MARKERS[5]];
function normalize(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function words(value) {
    return normalize(value).match(/[a-z0-9]+/g) || [];
}
function meaningfulTokens(value) {
    return words(value).filter((token) => token.length >= 3 && !SEMANTIC_STOP_WORDS.has(token));
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
function hasIntroducedPhrase(original, rewritten, pattern) {
    pattern.lastIndex = 0;
    const inRewrite = pattern.test(rewritten);
    pattern.lastIndex = 0;
    return inRewrite && !pattern.test(original);
}
function hasIntroducedConcept(original, rewritten, concepts) {
    const originalTokens = words(original);
    const rewrittenTokens = words(rewritten);
    const matchesConcept = (token, concept) => token === concept ||
        (token.length >= 5 && concept.length >= 5 && token.replace(/s$/, '') === concept.replace(/s$/, ''));
    return concepts.some((concept) => {
        const normalizedConcept = normalize(concept);
        const appearsInRewrite = rewrittenTokens.some((token) => matchesConcept(token, normalizedConcept));
        const appearsInOriginal = originalTokens.some((token) => matchesConcept(token, normalizedConcept));
        return appearsInRewrite && !appearsInOriginal;
    });
}
function countTaskVerbs(value) {
    const normalized = normalize(value);
    const matches = normalized.match(/(?:^|[.!?;]\s+|\be\s+|\band\s+)(?:ajuda|clarifica|corrige|cria|define|diz|encontra|escreve|explica|faz|identifica|indica|lista|melhora|mostra|analisa|compara|resume|responde|reve|sugere|verifica|help|clarify|correct|create|define|tell|find|write|explain|make|identify|state|list|improve|show|analyze|compare|summarize|answer|review|suggest|check)\b/g);
    return matches?.length || 0;
}
function detectLanguage(value) {
    const tokens = words(value);
    let portuguese = tokens.filter((token) => PORTUGUESE_LANGUAGE_WORDS.has(token)).length;
    const english = tokens.filter((token) => ENGLISH_LANGUAGE_WORDS.has(token)).length;
    if (/[ãõçáéíóúâêô]/i.test(value))
        portuguese += 2;
    if (portuguese >= 2 && portuguese >= english + 1)
        return 'pt';
    if (english >= 2 && english >= portuguese + 1)
        return 'en';
    return 'unknown';
}
function isPortuguesePortugalRequest(value) {
    return /portugu[eê]s (?:de portugal|europeu)|pt[- ]pt/i.test(value);
}
function hasBalancedDelimiters(value) {
    const pairs = { '(': ')', '[': ']', '{': '}' };
    const closing = new Set(Object.values(pairs));
    const stack = [];
    for (const character of value) {
        if (pairs[character])
            stack.push(pairs[character]);
        else if (closing.has(character) && stack.pop() !== character)
            return false;
    }
    if (stack.length > 0)
        return false;
    if ((value.match(/"/g)?.length || 0) % 2 !== 0)
        return false;
    if ((value.match(/“/g)?.length || 0) !== (value.match(/”/g)?.length || 0))
        return false;
    if ((value.match(/«/g)?.length || 0) !== (value.match(/»/g)?.length || 0))
        return false;
    return true;
}
function looksTruncated(original, rewritten) {
    const normalizedOriginal = normalize(original).replace(/\s+/g, ' ').trim();
    const normalizedRewrite = normalize(rewritten).replace(/\s+/g, ' ').trim();
    if (normalizedOriginal.startsWith(normalizedRewrite) &&
        normalizedOriginal.length > normalizedRewrite.length + 3) {
        return true;
    }
    if (/(?:\.{3}|…|[,;:/-])\s*$/.test(rewritten))
        return true;
    if (/\b(?:e|ou|com|como|incluindo|porque|para|mostra|apresenta|and|or|with|including|because|to|show|provide)\s*$/i.test(rewritten)) {
        return true;
    }
    if (original.length >= 30 && rewritten.length < original.length * 0.65)
        return true;
    return false;
}
function maxGrowthRatio(originalLength) {
    if (originalLength < 80)
        return 2.2;
    if (originalLength <= 300)
        return 1.6;
    return 1.25;
}
function changedFactualMarkers(original, rewritten) {
    const originalNumbers = original.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
    const rewrittenNumbers = rewritten.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
    if (originalNumbers.sort().join('|') !== rewrittenNumbers.sort().join('|'))
        return true;
    const hasNegation = (value) => /\b(?:n[aã]o|n|not|never|cannot|can't)\b/i.test(value);
    return hasNegation(original) !== hasNegation(rewritten);
}
function isFaithfulToOriginal(original, rewritten, intervention) {
    const originalTokens = [...new Set(meaningfulTokens(original))];
    const rewrittenTokens = [...new Set(meaningfulTokens(rewritten))];
    if (originalTokens.length === 0)
        return true;
    const overlap = originalTokens.filter((originalToken) => rewrittenTokens.some((rewrittenToken) => tokensAreRelated(originalToken, rewrittenToken))).length;
    const novelTokens = rewrittenTokens.filter((rewrittenToken) => !originalTokens.some((originalToken) => tokensAreRelated(originalToken, rewrittenToken))).length;
    const thresholds = intervention === 'strict'
        ? { overlap: 0.8, novel: 0.18, minimumNovel: 2 }
        : intervention === 'polished'
            ? { overlap: 0.55, novel: 0.45, minimumNovel: 4 }
            : { overlap: 0.65, novel: 0.3, minimumNovel: 3 };
    return (overlap >= Math.max(1, Math.ceil(originalTokens.length * thresholds.overlap)) &&
        novelTokens <= Math.max(thresholds.minimumNovel, Math.ceil(originalTokens.length * thresholds.novel)));
}
function result(passed, reason) {
    return { passed, reason };
}
/**
 * Conservative, deterministic validation for local model output. Every rule
 * returns a stable reason code so heuristic failures are visible and testable.
 */
function validateModelRewrite(original, rewritten, intervention = 'normal') {
    const trimmedOriginal = original.trim();
    const trimmedRewrite = rewritten.trim();
    if (!trimmedRewrite)
        return result(false, 'empty_output');
    if (trimmedRewrite.length > 8000)
        return result(false, 'output_too_long');
    if (!hasBalancedDelimiters(rewritten))
        return result(false, 'unbalanced_delimiters');
    if (trimmedOriginal === trimmedRewrite)
        return result(true, 'model_output_valid');
    if (hasIntroducedPhrase(original, rewritten, REFUSAL))
        return result(false, 'refusal');
    if (hasIntroducedPhrase(original, rewritten, PROMPT_COMMENTARY)) {
        return result(false, 'prompt_commentary');
    }
    if (hasIntroducedPhrase(original, rewritten, ASSISTANT_PREFACE)) {
        return result(false, 'assistant_preface');
    }
    const originalHasMarkdown = MARKDOWN_PATTERNS.some((pattern) => pattern.test(original));
    const rewriteHasMarkdown = MARKDOWN_PATTERNS.some((pattern) => pattern.test(rewritten));
    if (!originalHasMarkdown && rewriteHasMarkdown)
        return result(false, 'markdown_injection');
    if (!LIST_PATTERN.test(original) && LIST_PATTERN.test(rewritten))
        return result(false, 'added_structure');
    if (!SECTION_PATTERN.test(original) && SECTION_PATTERN.test(rewritten)) {
        return result(false, 'added_structure');
    }
    const originalIsPrompt = QUESTION_START.test(trimmedOriginal) ||
        DIRECTIVE_START.test(trimmedOriginal) ||
        /\?\s*$/.test(trimmedOriginal);
    const rewriteKeepsPromptForm = QUESTION_START.test(trimmedRewrite) ||
        DIRECTIVE_START.test(trimmedRewrite) ||
        trimmedRewrite.includes('?');
    if (originalIsPrompt && !rewriteKeepsPromptForm)
        return result(false, 'assistant_answer');
    const originalLanguage = detectLanguage(original);
    const rewrittenLanguage = detectLanguage(rewritten);
    if (originalLanguage !== 'unknown' &&
        rewrittenLanguage !== 'unknown' &&
        originalLanguage !== rewrittenLanguage) {
        return result(false, 'language_shift');
    }
    const introducedBrazilianVariant = BRAZILIAN_MARKERS.some((pattern) => hasIntroducedPhrase(original, rewritten, pattern));
    const introducedStrongBrazilianVariant = STRONG_BRAZILIAN_MARKERS.some((pattern) => hasIntroducedPhrase(original, rewritten, pattern));
    if (originalLanguage === 'pt' &&
        introducedBrazilianVariant &&
        (isPortuguesePortugalRequest(original) || introducedStrongBrazilianVariant)) {
        return result(false, 'language_variant_shift');
    }
    const originalIsUncertain = UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(original));
    const rewriteIsUncertain = UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(rewritten));
    if (originalIsUncertain && !rewriteIsUncertain) {
        return result(false, 'uncertainty_changed');
    }
    if (changedFactualMarkers(original, rewritten))
        return result(false, 'factual_meaning_changed');
    if (looksTruncated(original, rewritten))
        return result(false, 'truncated_output');
    if (hasIntroducedConcept(original, rewritten, TOOL_CONCEPTS)) {
        return result(false, 'introduced_tool');
    }
    if (hasIntroducedConcept(original, rewritten, EXPANSION_CONCEPTS)) {
        return result(false, 'semantic_expansion');
    }
    if (EXPANSION_PHRASES.some((pattern) => hasIntroducedPhrase(original, rewritten, pattern))) {
        return result(false, 'semantic_expansion');
    }
    if (trimmedRewrite.length > Math.max(3, trimmedOriginal.length * maxGrowthRatio(trimmedOriginal.length))) {
        return result(false, 'excessive_length_growth');
    }
    if (countTaskVerbs(rewritten) > countTaskVerbs(original)) {
        return result(false, 'semantic_expansion');
    }
    if (!isFaithfulToOriginal(original, rewritten, intervention)) {
        return result(false, 'unfaithful_rewrite');
    }
    return result(true, 'model_output_valid');
}
function isModelRewriteUsable(original, rewritten, intervention = 'normal') {
    return validateModelRewrite(original, rewritten, intervention).passed;
}
function rewriteValidationScore(original, rewritten, intervention = 'normal') {
    if (!rewritten.trim())
        return 0;
    return validateModelRewrite(original, rewritten, intervention).passed ? 92 : 35;
}
//# sourceMappingURL=rewriteValidator.js.map