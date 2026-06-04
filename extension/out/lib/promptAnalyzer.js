"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzePrompt = analyzePrompt;
const promptRewriter_1 = require("./promptRewriter");
const spellChecker_1 = require("./spellChecker");
const promptEnhancer_1 = require("./promptEnhancer");
// Language detection: Common Portuguese words not in English
const PORTUGUESE_MARKERS = ['que', 'de', 'para', 'com', 'por', 'uma', 'está', 'preciso', 'explique', 'me', 'você', 'escreva', 'crie', 'faça', 'gere', 'quer'];
function detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tokens = tokenize(lower);
    // Count Portuguese markers
    const ptCount = PORTUGUESE_MARKERS.filter(marker => tokens.includes(marker)).length;
    // If we have enough Portuguese markers, assume Portuguese
    return ptCount >= 2 ? 'pt' : 'en';
}
const CATEGORY_WEIGHTS = {
    clarity: 18,
    context: 14,
    goal: 14,
    constraints: 14,
    outputFormat: 12,
    examples: 8,
    audience: 10,
    successCriteria: 10
};
const VAGUE_TERMS = ['thing', 'stuff', 'something', 'anything', 'better', 'help me', 'nice', 'good', 'bad', 'stuff like that'];
const ACTION_VERBS = [
    'analyze',
    'answer',
    'brainstorm',
    'build',
    'classify',
    'compare',
    'create',
    'debug',
    'design',
    'draft',
    'edit',
    'evaluate',
    'explain',
    'fix',
    'generate',
    'improve',
    'plan',
    'proofread',
    'refine',
    'review',
    'rewrite',
    'summarize',
    'write'
];
const FORMAT_TERMS = ['bullet', 'bullets', 'table', 'json', 'yaml', 'csv', 'markdown', 'steps', 'step-by-step', 'checklist', 'outline', 'email', 'memo', 'report', 'code', 'code block'];
const CONSTRAINT_TERMS = ['must', 'should', 'avoid', 'without', 'under', 'within', 'no more than', 'at least', 'deadline', 'limit', 'only', 'include', 'exclude', 'use'];
const CONTEXT_TERMS = ['because', 'background', 'context', 'currently', 'for example', 'for instance', 'in my case', 'we are', 'my team', 'the user', 'audience', 'project', 'goal'];
const EXAMPLE_MARKERS = ['example', 'examples', 'e.g.', 'for example', 'for instance', 'sample', 'desired output', 'bad example'];
const SUCCESS_TERMS = ['success', 'good answer', 'best answer', 'quality bar', 'criteria', 'should achieve', 'goal is', 'expected'];
const AUDIENCE_TERMS = ['beginner', 'advanced', 'expert', 'non-technical', 'technical', 'manager', 'executive', 'founder', 'student', 'teacher', 'customer', 'client', 'team'];
// Portuguese translations
const VAGUE_TERMS_PT = ['coisa', 'coisas', 'algo', 'alguma coisa', 'melhor', 'ajuda', 'legal', 'bom', 'mau', 'ruim', 'coisas assim'];
const ACTION_VERBS_PT = [
    'analisar',
    'responder',
    'brainstorm',
    'criar',
    'construir',
    'classificar',
    'comparar',
    'debugar',
    'desenhar',
    'descrever',
    'editar',
    'avaliar',
    'explicar',
    'consertar',
    'gerar',
    'melhorar',
    'planejar',
    'revisar',
    'reescrever',
    'resumir',
    'escrever',
    'fazer',
    'produzir',
    'corrigir'
];
const FORMAT_TERMS_PT = ['bala', 'balas', 'tabela', 'json', 'yaml', 'csv', 'markdown', 'passos', 'passo a passo', 'checklist', 'esboço', 'email', 'memorando', 'relatório', 'código', 'bloco de código'];
const CONSTRAINT_TERMS_PT = ['deve', 'deveria', 'deve evitar', 'sem', 'sob', 'dentro', 'no máximo', 'pelo menos', 'prazo', 'limite', 'apenas', 'incluir', 'excluir', 'usar'];
const CONTEXT_TERMS_PT = ['porque', 'contexto', 'atualmente', 'por exemplo', 'no meu caso', 'somos', 'minha equipe', 'o usuário', 'público', 'projeto', 'objetivo', 'fundo'];
const EXAMPLE_MARKERS_PT = ['exemplo', 'exemplos', 'ex.', 'por exemplo', 'amostra', 'saída desejada', 'exemplo ruim'];
const SUCCESS_TERMS_PT = ['sucesso', 'boa resposta', 'melhor resposta', 'critério de qualidade', 'critérios', 'deve alcançar', 'objetivo é', 'esperado'];
const AUDIENCE_TERMS_PT = ['iniciante', 'intermediário', 'avançado', 'expert', 'não técnico', 'técnico', 'gestor', 'executivo', 'fundador', 'estudante', 'professor', 'cliente', 'equipe'];
// Helper function to get keywords based on language
function getKeywords(language, keywordType) {
    if (language === 'pt') {
        switch (keywordType) {
            case 'vague': return VAGUE_TERMS_PT;
            case 'action': return ACTION_VERBS_PT;
            case 'format': return FORMAT_TERMS_PT;
            case 'constraint': return CONSTRAINT_TERMS_PT;
            case 'context': return CONTEXT_TERMS_PT;
            case 'example': return EXAMPLE_MARKERS_PT;
            case 'success': return SUCCESS_TERMS_PT;
            case 'audience': return AUDIENCE_TERMS_PT;
        }
    }
    switch (keywordType) {
        case 'vague': return VAGUE_TERMS;
        case 'action': return ACTION_VERBS;
        case 'format': return FORMAT_TERMS;
        case 'constraint': return CONSTRAINT_TERMS;
        case 'context': return CONTEXT_TERMS;
        case 'example': return EXAMPLE_MARKERS;
        case 'success': return SUCCESS_TERMS;
        case 'audience': return AUDIENCE_TERMS;
    }
}
const USE_CASE_HINTS = {
    general: {
        focusTerms: [],
        missingSuggestions: ['Define the task more specifically and add a preferred format.']
    },
    coding: {
        focusTerms: ['javascript', 'typescript', 'python', 'react', 'next', 'api', 'error', 'stack trace', 'reproduce', 'expected', 'actual', 'file', 'function'],
        missingSuggestions: ['Add the language or framework, the expected versus actual behavior, and reproduction steps.']
    },
    writing: {
        focusTerms: ['tone', 'voice', 'audience', 'length', 'style', 'rewrite', 'edit', 'draft'],
        missingSuggestions: ['Add the target reader, tone, and desired length.']
    },
    studying: {
        focusTerms: ['beginner', 'intermediate', 'advanced', 'topic', 'explain', 'practice', 'quiz', 'flashcards', 'step by step'],
        missingSuggestions: ['Add the topic level, desired depth, and whether you want practice questions.']
    },
    research: {
        focusTerms: ['sources', 'evidence', 'compare', 'comparison', 'timeframe', 'credible', 'study', 'research', 'citations'],
        missingSuggestions: ['Specify the scope, timeframe, and what counts as credible evidence.']
    },
    business: {
        focusTerms: ['stakeholder', 'customer', 'client', 'revenue', 'strategy', 'meeting', 'email', 'cta', 'decision', 'objective'],
        missingSuggestions: ['Clarify the business goal, audience, and the action you want the reader to take.']
    },
    imageGeneration: {
        focusTerms: ['subject', 'style', 'lighting', 'camera', 'lens', 'composition', 'mood', 'aspect ratio', 'negative prompt'],
        missingSuggestions: ['Add visual details such as subject, style, lighting, composition, and aspect ratio.']
    }
};
const USE_CASE_HINTS_PT = {
    general: {
        focusTerms: [],
        missingSuggestions: ['Defina a tarefa de forma mais específica e adicione um formato preferido.']
    },
    coding: {
        focusTerms: ['javascript', 'typescript', 'python', 'react', 'next', 'api', 'erro', 'stack trace', 'reproduzir', 'esperado', 'atual', 'arquivo', 'função'],
        missingSuggestions: ['Adicione a linguagem ou framework, o comportamento esperado versus atual, e passos para reproduzir.']
    },
    writing: {
        focusTerms: ['tom', 'voz', 'público', 'comprimento', 'estilo', 'reescrever', 'editar', 'rascunho'],
        missingSuggestions: ['Adicione o leitor alvo, tom e comprimento desejado.']
    },
    studying: {
        focusTerms: ['iniciante', 'intermediário', 'avançado', 'tópico', 'explicar', 'praticar', 'quiz', 'passo a passo'],
        missingSuggestions: ['Adicione o nível do tópico, profundidade desejada e se quer perguntas de prática.']
    },
    research: {
        focusTerms: ['fontes', 'evidência', 'comparar', 'comparação', 'período', 'credível', 'estudo', 'pesquisa', 'citações'],
        missingSuggestions: ['Especifique o escopo, período de tempo e o que conta como evidência credível.']
    },
    business: {
        focusTerms: ['stakeholder', 'cliente', 'receita', 'estratégia', 'reunião', 'email', 'cta', 'decisão', 'objetivo'],
        missingSuggestions: ['Esclareça o objetivo comercial, público e a ação que deseja do leitor.']
    },
    imageGeneration: {
        focusTerms: ['assunto', 'estilo', 'iluminação', 'câmera', 'lente', 'composição', 'humor', 'proporção de aspecto', 'prompt negativo'],
        missingSuggestions: ['Adicione detalhes visuais como assunto, estilo, iluminação, composição e proporção de aspecto.']
    }
};
function getUseCaseHints(language, useCase) {
    const hints = language === 'pt' ? USE_CASE_HINTS_PT : USE_CASE_HINTS;
    return hints[useCase];
}
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function tokenize(prompt) {
    return prompt.toLowerCase().match(/\b[\w'-]+\b/g) ?? [];
}
function countKeywordHits(prompt, terms) {
    return terms.reduce((count, term) => {
        const pattern = new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, 'g');
        const matches = prompt.toLowerCase().match(pattern);
        return count + (matches?.length ?? 0);
    }, 0);
}
function labelForScore(score) {
    if (score >= 85) {
        return 'Excellent';
    }
    if (score >= 70) {
        return 'Strong';
    }
    if (score >= 40) {
        return 'Decent';
    }
    return 'Weak';
}
function severityForGap(score, critical = false) {
    if (critical) {
        return 'high';
    }
    return score < 35 ? 'high' : score < 60 ? 'medium' : 'low';
}
function makeIssue(id, severity, category, title, description, suggestion) {
    return { id, severity, category, title, description, suggestion };
}
function buildSummary(categoryScores) {
    const entries = Object.entries(categoryScores);
    const strongest = entries.filter(([, score]) => score >= 70).map(([key]) => key);
    const weakest = entries.filter(([, score]) => score < 55).map(([key]) => key);
    if (strongest.length === 0 && weakest.length > 0) {
        return `The prompt needs stronger structure, especially around ${weakest.slice(0, 3).map((key) => key.replace(/([A-Z])/g, ' $1')).join(', ')}.`;
    }
    if (strongest.length > 0 && weakest.length > 0) {
        return `Strongest signals are in ${strongest.slice(0, 3).join(', ')}, but the prompt still needs work in ${weakest.slice(0, 3).join(', ')}.`;
    }
    return 'The prompt has good coverage across the main prompt-quality dimensions.';
}
function scoreClarity(prompt, wordCount, taskCount, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const actionVerbs = getKeywords(language, 'action');
    const vagueTerms = getKeywords(language, 'vague');
    const actionHits = countKeywordHits(prompt, actionVerbs);
    const vagueHits = countKeywordHits(prompt, vagueTerms);
    if (actionHits > 0) {
        score += 30;
        strengths.push('Clear action verb detected');
        notes.push(`Action verbs detected: ${actionHits}`);
    }
    else {
        gaps.push('No clear action verb was detected');
        notes.push('The prompt does not clearly state what the model should do');
    }
    if (wordCount >= 8) {
        score += 20;
    }
    else {
        gaps.push('Prompt is very short');
        notes.push('The prompt may be too short to be precise');
    }
    if (wordCount >= 16) {
        score += 15;
    }
    if (vagueHits === 0) {
        score += 20;
        strengths.push('No obvious vague filler');
    }
    else {
        score += Math.max(0, 20 - vagueHits * 6);
        gaps.push('Vague language may cause a generic answer');
        notes.push(`Vague terms detected: ${vagueHits}`);
    }
    if (taskCount <= 1) {
        score += 15;
    }
    else {
        score += 5;
        gaps.push('Prompt combines multiple tasks');
    }
    if (/\?|!/.test(prompt)) {
        score += 5;
    }
    return { score: clamp(score), notes, strengths, gaps };
}
function scoreContext(prompt, useCase, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const contextTerms = getKeywords(language, 'context');
    const audienceTerms = getKeywords(language, 'audience');
    const contextHits = countKeywordHits(prompt, contextTerms);
    const audienceHits = countKeywordHits(prompt, audienceTerms);
    const refHits = /\bfile\b|\bpath\b|\burl\b|\bstack trace\b|\berror\b|\bdataset\b|\blog\b/.test(prompt.toLowerCase()) ? 1 : 0;
    const useCaseHints = getUseCaseHints(language, useCase);
    const useCaseHits = countKeywordHits(prompt, useCaseHints.focusTerms);
    if (contextHits > 0) {
        score += 25;
        strengths.push('Background context included');
        notes.push(`Context markers detected: ${contextHits}`);
    }
    if (audienceHits > 0) {
        score += 20;
        strengths.push('Audience signal detected');
    }
    else {
        gaps.push('No target audience was mentioned');
    }
    if (refHits > 0) {
        score += 20;
        strengths.push('References or concrete artifacts included');
    }
    if (useCaseHits > 0) {
        score += 20;
        notes.push(`Use-case relevant details detected: ${useCaseHits}`);
    }
    if (score === 0) {
        gaps.push('No context provided');
        notes.push('The prompt is missing background and scenario details');
    }
    score += 10;
    return { score: clamp(score), notes, strengths, gaps };
}
function scoreGoal(prompt, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const actionVerbs = getKeywords(language, 'action');
    const successTerms = getKeywords(language, 'success');
    const actionHits = countKeywordHits(prompt, actionVerbs);
    const outcomeHits = countKeywordHits(prompt, successTerms);
    if (actionHits > 0) {
        score += 40;
        strengths.push('Task intent is present');
    }
    if (outcomeHits > 0) {
        score += 25;
        notes.push(`Outcome language detected: ${outcomeHits}`);
    }
    else {
        gaps.push('The desired outcome is not explicit');
    }
    if (/\bwhy\b|\bwhat\b|\bhow\b/.test(prompt.toLowerCase())) {
        score += 15;
    }
    if (score === 0) {
        gaps.push('The goal is not clear');
        notes.push('The prompt does not clearly state the result the user wants');
    }
    score += 15;
    return { score: clamp(score), notes, strengths, gaps };
}
function scoreConstraints(prompt, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const constraintTerms = getKeywords(language, 'constraint');
    const constraintHits = countKeywordHits(prompt, constraintTerms);
    const lengthHints = /\b(short|brief|concise|detailed|under \d+ words|less than \d+ words|more than \d+ words|within \d+)/.test(prompt.toLowerCase());
    const styleHints = /\b(tone|style|formal|casual|friendly|professional|plain english)\b/.test(prompt.toLowerCase());
    const toolsHints = /\b(use|with|without|via|using)\b/.test(prompt.toLowerCase()) && /\b(api|code|python|typescript|json|table|markdown|browser|spreadsheet|docs?)\b/.test(prompt.toLowerCase());
    if (constraintHits > 0) {
        score += Math.min(55, constraintHits * 12);
        strengths.push('Constraints detected');
        notes.push(`Constraint markers detected: ${constraintHits}`);
    }
    else {
        gaps.push('No constraints specified');
    }
    if (lengthHints) {
        score += 15;
    }
    if (styleHints) {
        score += 10;
    }
    if (toolsHints) {
        score += 10;
    }
    if (/\bdeadline|by \w+day|today|tomorrow|this week|this month\b/.test(prompt.toLowerCase())) {
        score += 10;
    }
    return { score: clamp(score), notes, strengths, gaps };
}
function scoreOutputFormat(prompt, useCase, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const formatTerms = getKeywords(language, 'format');
    const formatHits = countKeywordHits(prompt, formatTerms);
    const hasFormatLanguage = /\b(show me|in a|as a|format|layout|structure|template|sections?)\b/.test(prompt.toLowerCase());
    if (formatHits > 0) {
        score += Math.min(60, formatHits * 14);
        strengths.push('Output format specified');
        notes.push(`Format markers detected: ${formatHits}`);
    }
    else {
        gaps.push('Missing output format');
    }
    if (hasFormatLanguage) {
        score += 15;
    }
    if (useCase === 'imageGeneration') {
        if (/\bportrait|landscape|square|16:9|4:3|1:1\b/.test(prompt.toLowerCase())) {
            score += 15;
        }
        else {
            gaps.push('No aspect ratio or image framing hinted');
        }
    }
    return { score: clamp(score), notes, strengths, gaps };
}
function scoreExamples(prompt, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const exampleMarkers = getKeywords(language, 'example');
    const exampleHits = countKeywordHits(prompt, exampleMarkers);
    const quotedExample = /[“"'].+[”"']/.test(prompt);
    if (exampleHits > 0) {
        score += 60;
        strengths.push('Examples or example language included');
        notes.push(`Example markers detected: ${exampleHits}`);
    }
    if (quotedExample) {
        score += 20;
    }
    if (score === 0) {
        gaps.push('No examples included');
        notes.push('The prompt does not show a desired or undesired example');
    }
    score += 20;
    return { score: clamp(score), notes, strengths, gaps };
}
function scoreAudience(prompt, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const audienceTerms = getKeywords(language, 'audience');
    const audienceHits = countKeywordHits(prompt, audienceTerms);
    const roleHints = /\b(act as|pretend you're|you are a|explain to|write for|tailored for)\b/.test(prompt.toLowerCase());
    if (audienceHits > 0) {
        score += Math.min(60, audienceHits * 18);
        strengths.push('Audience or role present');
        notes.push(`Audience markers detected: ${audienceHits}`);
    }
    else {
        gaps.push('No target audience mentioned');
    }
    if (roleHints) {
        score += 25;
    }
    if (score === 0) {
        score = 15;
    }
    return { score: clamp(score), notes, strengths, gaps };
}
function scoreSuccessCriteria(prompt, language) {
    const notes = [];
    const strengths = [];
    const gaps = [];
    let score = 0;
    const successTerms = getKeywords(language, 'success');
    const successHits = countKeywordHits(prompt, successTerms);
    const qualityHints = /\b(best|good|strong|clear|accurate|complete|actionable|useful|specific)\b/.test(prompt.toLowerCase());
    const measurableHints = /\b(\d+|percent|percentage|minutes?|hours?|pages?|words?|bullets?)\b/.test(prompt.toLowerCase());
    if (successHits > 0) {
        score += Math.min(55, successHits * 14);
        strengths.push('Success criteria language detected');
        notes.push(`Success markers detected: ${successHits}`);
    }
    else {
        gaps.push('No success criteria defined');
    }
    if (qualityHints) {
        score += 20;
    }
    if (measurableHints) {
        score += 15;
    }
    if (score === 0) {
        score = 20;
    }
    return { score: clamp(score), notes, strengths, gaps };
}
function detectTaskCount(prompt) {
    const verbs = countKeywordHits(prompt, ACTION_VERBS);
    const conjunctionSplit = /\b(?:and|then|also|plus)\b/.test(prompt.toLowerCase()) ? 1 : 0;
    return Math.max(1, verbs + conjunctionSplit);
}
function applyUseCaseAdjustments(categoryScores, useCase, prompt) {
    const strengths = [];
    const lower = prompt.toLowerCase();
    switch (useCase) {
        case 'coding': {
            const hasStack = /\b(javascript|typescript|python|react|next|node|api|sql|css|html|rust|go|java)\b/.test(lower);
            const hasDebugData = /\b(expected|actual|error|stack trace|reproduce|logs?|files?|steps?)\b/.test(lower);
            if (hasStack) {
                categoryScores.context = clamp(categoryScores.context + 8);
                categoryScores.clarity = clamp(categoryScores.clarity + 5);
                strengths.push('Coding stack or framework mentioned');
            }
            if (hasDebugData) {
                categoryScores.successCriteria = clamp(categoryScores.successCriteria + 10);
                categoryScores.context = clamp(categoryScores.context + 8);
                strengths.push('Debugging details included');
            }
            break;
        }
        case 'writing': {
            const hasTone = /\b(tone|voice|formal|casual|friendly|persuasive|concise)\b/.test(lower);
            const hasAudience = /\b(beginner|manager|executive|client|customer|reader|audience)\b/.test(lower);
            if (hasTone) {
                categoryScores.constraints = clamp(categoryScores.constraints + 8);
                strengths.push('Tone guidance detected');
            }
            if (hasAudience) {
                categoryScores.audience = clamp(categoryScores.audience + 10);
                strengths.push('Writing audience mentioned');
            }
            break;
        }
        case 'studying': {
            const hasLevel = /\b(beginner|intermediate|advanced|high school|college|graduate)\b/.test(lower);
            const hasPractice = /\b(practice|quiz|flashcards|examples?|exercise|questions?)\b/.test(lower);
            if (hasLevel) {
                categoryScores.audience = clamp(categoryScores.audience + 8);
                strengths.push('Learning level mentioned');
            }
            if (hasPractice) {
                categoryScores.successCriteria = clamp(categoryScores.successCriteria + 8);
                strengths.push('Practice request included');
            }
            break;
        }
        case 'research': {
            const hasScope = /\b(timeframe|sources?|citations?|evidence|compare|comparison|study|studies)\b/.test(lower);
            if (hasScope) {
                categoryScores.context = clamp(categoryScores.context + 8);
                categoryScores.successCriteria = clamp(categoryScores.successCriteria + 8);
                strengths.push('Research scope or evidence language included');
            }
            break;
        }
        case 'business': {
            const hasGoal = /\b(objective|goal|cta|call to action|meeting|email|proposal|revenue|pipeline|client|customer)\b/.test(lower);
            if (hasGoal) {
                categoryScores.goal = clamp(categoryScores.goal + 8);
                categoryScores.audience = clamp(categoryScores.audience + 8);
                strengths.push('Business objective or audience is present');
            }
            break;
        }
        case 'imageGeneration': {
            const hasVisualDetails = /\b(subject|style|composition|lighting|camera|lens|mood|palette|aspect ratio|negative prompt)\b/.test(lower);
            if (hasVisualDetails) {
                categoryScores.constraints = clamp(categoryScores.constraints + 8);
                categoryScores.outputFormat = clamp(categoryScores.outputFormat + 10);
                strengths.push('Visual direction and framing details included');
            }
            break;
        }
        case 'general':
        default:
            break;
    }
    return strengths;
}
function buildIssues(categoryScores, useCase, prompt, taskCount, language) {
    const issues = [];
    const lower = prompt.toLowerCase();
    const wellStructured = categoryScores.clarity >= 55 &&
        categoryScores.context >= 35 &&
        categoryScores.goal >= 35 &&
        categoryScores.outputFormat >= 30;
    if (categoryScores.clarity < 45) {
        issues.push(makeIssue('vague-task', severityForGap(categoryScores.clarity, categoryScores.clarity < 25), 'clarity', 'The task is too vague', 'The prompt does not clearly state what should happen next.', 'Name the exact action, outcome, or deliverable you want.'));
    }
    if (categoryScores.context < 45) {
        issues.push(makeIssue('missing-context', severityForGap(categoryScores.context, false), 'context', 'No context provided', 'The model does not know the background, scenario, or audience.', 'Add the background, relevant constraints, and who the output is for.'));
    }
    if (categoryScores.constraints < 40) {
        issues.push(makeIssue('missing-constraints', severityForGap(categoryScores.constraints, false), 'constraints', 'No constraints specified', 'The prompt gives the model too much freedom, which can lead to generic output.', 'Add limits, requirements, style preferences, boundaries, or tools to use.'));
    }
    if (categoryScores.outputFormat < 45) {
        issues.push(makeIssue('missing-format', severityForGap(categoryScores.outputFormat, false), 'outputFormat', 'Missing output format', 'The model is not told what the answer should look like.', 'Specify whether you want bullets, a table, JSON, steps, a checklist, code, or a short answer.'));
    }
    if (!wellStructured && categoryScores.audience < 40) {
        issues.push(makeIssue('missing-audience', severityForGap(categoryScores.audience, false), 'audience', 'No target audience mentioned', 'Without an audience, the answer may use the wrong level of detail or tone.', 'Tell the model who the response is for or what role it should take.'));
    }
    if (!wellStructured && categoryScores.successCriteria < 40) {
        issues.push(makeIssue('missing-success', severityForGap(categoryScores.successCriteria, false), 'successCriteria', 'No success criteria defined', 'The model does not know how to judge a good answer.', 'Describe what a strong answer should achieve and what “good” means.'));
    }
    if (!wellStructured && categoryScores.examples < 35) {
        issues.push(makeIssue('missing-examples', severityForGap(categoryScores.examples, false), 'examples', 'No examples included', 'Examples can anchor style and avoid generic answers.', 'Add a positive example, a bad example, or a sample output if you have one.'));
    }
    if (!wellStructured && taskCount > 2) {
        issues.push(makeIssue('multiple-tasks', 'medium', 'general', 'Prompt combines multiple tasks without prioritization', 'The request appears to ask for more than one thing at once.', 'Split the prompt into separate steps or say which task is most important.'));
    }
    if (!wellStructured && useCase === 'coding' && !/\b(expected|actual|reproduce|stack trace|error|file|language|framework)\b/.test(lower)) {
        issues.push(makeIssue('coding-missing-debug-data', 'medium', 'context', 'Coding prompt is missing debugging details', 'The prompt will be more useful if it includes concrete implementation or error context.', 'Add the language, framework, error message, expected behavior, actual behavior, and reproduction steps.'));
    }
    if (!wellStructured && useCase === 'imageGeneration' && !/\b(subject|style|lighting|camera|composition|aspect ratio|mood|negative prompt)\b/.test(lower)) {
        issues.push(makeIssue('image-missing-visuals', 'medium', 'context', 'Image prompt is missing visual details', 'The model needs more art direction to avoid a generic image.', 'Add the subject, style, composition, lighting, mood, and aspect ratio.'));
    }
    if (/\bmake it better|help me|something\b/.test(lower) && categoryScores.clarity < 60) {
        issues.push(makeIssue('generic-answer-risk', 'high', 'general', 'The prompt may produce a generic answer', 'The request is broad enough that the model may answer with filler instead of a useful result.', 'Replace vague language with a precise task, audience, format, and constraints.'));
    }
    return issues;
}
function buildStrengths(categoryResults, useCaseStrengths) {
    const strengths = new Set();
    Object.values(categoryResults).forEach((bucket) => {
        bucket.strengths.forEach((strength) => strengths.add(strength));
    });
    useCaseStrengths.forEach((strength) => strengths.add(strength));
    if (strengths.size === 0) {
        strengths.add('The prompt is short and easy to revise');
    }
    return Array.from(strengths).slice(0, 6);
}
function deriveCategoryNotes(categoryResults) {
    return {
        clarity: categoryResults.clarity.notes,
        context: categoryResults.context.notes,
        goal: categoryResults.goal.notes,
        constraints: categoryResults.constraints.notes,
        outputFormat: categoryResults.outputFormat.notes,
        examples: categoryResults.examples.notes,
        audience: categoryResults.audience.notes,
        successCriteria: categoryResults.successCriteria.notes
    };
}
function buildCategoryScores(categoryResults) {
    return {
        clarity: categoryResults.clarity.score,
        context: categoryResults.context.score,
        goal: categoryResults.goal.score,
        constraints: categoryResults.constraints.score,
        outputFormat: categoryResults.outputFormat.score,
        examples: categoryResults.examples.score,
        audience: categoryResults.audience.score,
        successCriteria: categoryResults.successCriteria.score
    };
}
function weightedAverage(scores) {
    const weightedTotal = Object.keys(scores).reduce((total, key) => total + scores[key] * CATEGORY_WEIGHTS[key], 0);
    const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((total, weight) => total + weight, 0);
    return weightedTotal / totalWeight;
}
function analyzePrompt(prompt, useCase) {
    const normalized = prompt.trim();
    const language = detectLanguage(normalized);
    const tokens = tokenize(normalized);
    const wordCount = tokens.length;
    const taskCount = detectTaskCount(normalized);
    const categoryResults = {
        clarity: scoreClarity(normalized, wordCount, taskCount, language),
        context: scoreContext(normalized, useCase, language),
        goal: scoreGoal(normalized, language),
        constraints: scoreConstraints(normalized, language),
        outputFormat: scoreOutputFormat(normalized, useCase, language),
        examples: scoreExamples(normalized, language),
        audience: scoreAudience(normalized, language),
        successCriteria: scoreSuccessCriteria(normalized, language)
    };
    const categoryScores = buildCategoryScores(categoryResults);
    const useCaseStrengths = applyUseCaseAdjustments(categoryScores, useCase, normalized);
    const adjustedCategoryScores = { ...categoryScores };
    const rawIssues = buildIssues(adjustedCategoryScores, useCase, normalized, taskCount, language);
    const strengths = buildStrengths(categoryResults, useCaseStrengths);
    const shortPromptPenalty = wordCount < 5 ? 18 : wordCount < 10 ? 10 : wordCount < 16 ? 4 : 0;
    const vagueTerms = getKeywords(language, 'vague');
    const vaguePenalty = countKeywordHits(normalized, vagueTerms) * 4;
    const multiTaskPenalty = taskCount > 2 ? 8 : taskCount === 2 ? 4 : 0;
    const weightedScore = weightedAverage(adjustedCategoryScores);
    const overallScore = clamp(Math.round(weightedScore + 32 - shortPromptPenalty - vaguePenalty - multiTaskPenalty + (useCase === 'business' ? 8 : 0)));
    const label = labelForScore(overallScore);
    const summary = buildSummary(categoryScores);
    const categoryNotes = deriveCategoryNotes(categoryResults);
    const issues = overallScore >= 70 ? rawIssues.slice(0, 2) : rawIssues;
    // Detect spelling mistakes
    const detectedSpellingIssues = (0, spellChecker_1.detectSpellingMistakes)(normalized, language);
    const spellingIssues = detectedSpellingIssues.map(issue => ({
        word: issue.word,
        suggestions: issue.suggestions,
        confidence: Math.round(issue.confidence * 100)
    }));
    // Generate corrected version: spelling fixes + quality improvements to reach 70%+
    let correctedPrompt = (0, spellChecker_1.correctSpelling)(normalized, language, 0.75);
    // If score is below 70, apply quality enhancements
    if (overallScore < 70) {
        correctedPrompt = (0, promptEnhancer_1.enhancePromptQuality)(correctedPrompt, adjustedCategoryScores);
    }
    const core = {
        overallScore,
        label,
        categoryScores: adjustedCategoryScores,
        issues,
        spellingIssues,
        strengths,
        summary,
        categoryNotes,
        correctedPrompt
    };
    return {
        ...core,
        rewrittenPrompt: (0, promptRewriter_1.rewritePrompt)(prompt, useCase, core)
    };
}
//# sourceMappingURL=promptAnalyzer.js.map