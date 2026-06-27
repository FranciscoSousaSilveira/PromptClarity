"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewritePrompt = rewritePrompt;
const PORTUGUESE_MARKERS = [
    'que', 'de', 'para', 'com', 'por', 'uma', 'está', 'preciso', 'você', 'me',
    'como', 'sem', 'mais', 'já', 'também', 'ainda', 'sobre', 'depois', 'durante',
    'mesmo', 'através', 'junto', 'segundo', 'diante', 'enquanto', 'onde', 'quando'
];
function detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    let portugueseMarkerCount = 0;
    for (const marker of PORTUGUESE_MARKERS) {
        if (new RegExp(`\\b${marker}\\b`).test(lower)) {
            portugueseMarkerCount++;
        }
    }
    return portugueseMarkerCount >= 2 ? 'pt' : 'en';
}
function isBlank(value) {
    return value.trim().length === 0;
}
function formatSection(label, content) {
    return `${label}: ${content}`;
}
function inferUseCase(useCase, prompt) {
    if (useCase !== 'general')
        return useCase;
    const lower = prompt.toLowerCase();
    if (/\b(email|memo|proposal|sales|marketing|client|customer|stakeholder)\b/.test(lower))
        return 'business';
    if (/\b(code|bug|debug|function|api|typescript|javascript|python|react|next\.js)\b/.test(lower))
        return 'coding';
    if (/\b(study|learn|teach|explain|beginner|student|quiz|practice)\b/.test(lower))
        return 'studying';
    if (/\b(research|evidence|sources?|compare|study|paper|citations?)\b/.test(lower))
        return 'research';
    if (/\b(image|photo|illustration|portrait|landscape|lighting|composition)\b/.test(lower))
        return 'imageGeneration';
    if (/\b(write|rewrite|edit|draft|proofread|article|story)\b/.test(lower))
        return 'writing';
    return 'general';
}
function roleForUseCase(useCase, prompt) {
    const lower = prompt.toLowerCase();
    switch (useCase) {
        case 'coding': {
            const hasFramework = /react|next|vue|angular|django|flask|rails|spring/.test(lower);
            const isBugFix = /bug|error|fix|broken|crash|fail|issue/.test(lower);
            if (isBugFix) {
                return 'a debugging expert who explains root causes and provides step-by-step fixes';
            }
            if (hasFramework) {
                return 'a senior engineer in ' + (lower.includes('react') ? 'React' :
                    lower.includes('next') ? 'Next.js' :
                        lower.includes('python') ? 'Python' : 'your chosen framework');
            }
            return 'a senior software engineer who is careful about debugging and implementation details';
        }
        case 'writing': {
            const hasTone = /formal|casual|friendly|professional|persuasive|conversational/.test(lower);
            const hasLength = /short|brief|long|detailed|paragraph|section|page/.test(lower);
            if (hasTone || hasLength) {
                const tone = lower.includes('formal') ? 'formal' : lower.includes('casual') ? 'casual' : lower.includes('friendly') ? 'friendly' : 'appropriate';
                return `a sharp ${tone} writer and editor who matches style and audience`;
            }
            return 'a sharp editor who can match tone, audience, and structure';
        }
        case 'studying': {
            const hasLevel = /beginner|intermediate|advanced|grade|high school|college|university/.test(lower);
            if (hasLevel) {
                const level = lower.includes('beginner') ? 'beginner' :
                    lower.includes('advanced') ? 'advanced' : 'intermediate';
                return `a patient ${level}-friendly tutor who explains clearly and checks understanding`;
            }
            return 'a patient tutor who explains clearly and checks understanding';
        }
        case 'research': {
            const hasScope = /compare|comparison|analysis|evidence|sources?|study/.test(lower);
            return hasScope ? 'a research analyst who compares sources, highlights evidence, and surfaces key differences' : 'a research analyst who compares sources and surfaces evidence';
        }
        case 'business': {
            const hasAudience = /executive|founder|sales|marketing|customer|stakeholder/.test(lower);
            if (hasAudience) {
                const audience = lower.includes('executive') ? 'executive' :
                    lower.includes('founder') ? 'founder' :
                        lower.includes('customer') ? 'customer-facing' : 'strategic';
                return `a ${audience}-focused business strategist who drives clear decisions`;
            }
            return 'a practical business strategist who focuses on clarity and action';
        }
        case 'imageGeneration':
            return 'a visual prompt engineer who understands composition, lighting, mood, and style in image generation';
        case 'general':
        default:
            return 'a helpful expert who writes concise, high-signal answers';
    }
}
function outputFormatForUseCase(useCase, analysis, prompt) {
    const suggested = analysis.categoryScores.outputFormat >= 70;
    const lower = prompt.toLowerCase();
    switch (useCase) {
        case 'coding': {
            const wantsBullets = /bullet|list|steps?|steps?-by-step/.test(lower);
            const wantsCode = /code|example|snippet|implementation/.test(lower);
            if (wantsBullets)
                return 'Use bullet points for each step, with code examples where helpful.';
            if (wantsCode)
                return 'Provide a complete, working code example with explanations.';
            return suggested
                ? 'Use the format already implied by the request, and include code blocks when needed.'
                : 'Use sections such as Summary, Root cause, Fix (with code), and Next steps.';
        }
        case 'writing': {
            const wantsDraft = /draft|rewrite|revise|edit/.test(lower);
            const wantsOutline = /outline|structure|format/.test(lower);
            if (wantsDraft)
                return 'Provide the draft directly, then optional suggestions for improvement.';
            if (wantsOutline)
                return 'Start with an outline, then expand with the full content.';
            return suggested
                ? 'Match the format implied by the request.'
                : 'Use a clear format: outline, draft, refined version, or step-by-step refinements.';
        }
        case 'studying': {
            const wantsPractice = /practice|quiz|questions?|exercise/.test(lower);
            const wantsExamples = /example|scenario|real-world/.test(lower);
            if (wantsPractice)
                return 'Explain the concept, provide 2 examples, then 3 practice questions with answer hints.';
            if (wantsExamples)
                return 'Use examples and real-world scenarios to anchor understanding.';
            return suggested
                ? 'Use the requested learning format.'
                : 'Use explanation, examples, and check-your-understanding questions.';
        }
        case 'research': {
            const wantsComparison = /compare|comparison|vs|tradeoffs?|difference/.test(lower);
            const wantsCitations = /cite|source|study|paper|research/.test(lower);
            if (wantsComparison)
                return 'Use a comparison table or structured format highlighting tradeoffs.';
            if (wantsCitations)
                return 'Include specific sources, authors, and publication years.';
            return suggested
                ? 'Use the requested research format.'
                : 'Use structured sections: overview, comparison (or analysis), evidence, conclusion.';
        }
        case 'business': {
            const wantsEmail = /email/.test(lower);
            const wantsMemo = /memo|report/.test(lower);
            const wantsBullets = /bullet|list/.test(lower);
            if (wantsEmail)
                return 'Format as a complete, ready-to-send email with subject line.';
            if (wantsMemo)
                return 'Use memo format with sections: objective, analysis, recommendation, next steps.';
            if (wantsBullets)
                return 'Use concise bullet points with clear CTAs.';
            return suggested
                ? 'Use the requested business format.'
                : 'Use a concise format: bullet list, email, memo, or action plan.';
        }
        case 'imageGeneration': {
            const wantsNegative = /negative|avoid|not/.test(lower);
            return suggested
                ? 'Keep the visual direction clear and specific, with aspect ratio if known.'
                : (wantsNegative
                    ? 'Describe the desired image in detail, then list negative prompts (what to avoid).'
                    : 'Provide a compact visual prompt with subject, style, composition, lighting, mood, and aspect ratio.');
        }
        case 'general':
        default:
            return suggested
                ? 'Use the format implied by the prompt.'
                : 'Choose the most helpful format: bullet list, table, steps, checklist, code block, or short answer.';
    }
}
function buildTask(prompt, analysis, useCase) {
    const trimmed = prompt.trim();
    const lower = trimmed.toLowerCase();
    if (isBlank(trimmed)) {
        return '[State the main task clearly]';
    }
    if (analysis.categoryScores.clarity >= 70) {
        return trimmed;
    }
    // Smart task refinement based on what's missing
    const additions = [];
    if (useCase === 'coding' && analysis.categoryScores.context < 60) {
        additions.push('(Provide: language/framework, expected vs actual behavior)');
    }
    if (useCase === 'writing' && analysis.categoryScores.constraints < 60) {
        additions.push('(Provide: tone, audience, length)');
    }
    if (useCase === 'imageGeneration' && analysis.categoryScores.outputFormat < 60) {
        additions.push('(Provide: subject, style, composition, aspect ratio)');
    }
    if (additions.length > 0) {
        return `${trimmed}\n\nProvide the missing context: ${additions.join(' ')}`;
    }
    return `Clarify the task:\n${trimmed}`;
}
function buildContext(prompt, analysis) {
    const trimmed = prompt.trim();
    if (isBlank(trimmed)) {
        return '[Add relevant background, constraints, and any important context here]';
    }
    if (analysis.categoryScores.context >= 70) {
        return 'Use the background and factual details supplied in the task below.';
    }
    return '[Add relevant background, the recipient or audience, and any facts that must remain accurate]';
}
function buildConstraints(analysis, useCase) {
    if (useCase === 'business') {
        const requirements = ['Use only confirmed facts; do not invent dates, commitments, or outcomes.'];
        if (analysis.categoryScores.constraints < 70)
            requirements.push('Tone and length: [specify if important]');
        return requirements.join(' ');
    }
    const hints = [];
    if (analysis.categoryScores.constraints < 70) {
        hints.push('[Add limits, requirements, style preferences, or boundaries]');
    }
    if (analysis.categoryScores.successCriteria < 70) {
        hints.push('[Define what a strong answer should accomplish]');
    }
    if (hints.length === 0) {
        hints.push('Preserve the key requirements in the original prompt.');
    }
    return hints.join(' ');
}
function successCriteriaForUseCase(useCase) {
    switch (useCase) {
        case 'business':
            return 'The result is ready to send, preserves the facts provided, and makes the next action clear.';
        case 'coding':
            return 'The answer is correct, reproducible, and includes enough detail to verify the result.';
        case 'writing':
            return 'The draft matches the requested audience, tone, and purpose without unnecessary filler.';
        case 'studying':
            return 'The explanation is accurate at the requested level and makes understanding easy to check.';
        case 'research':
            return 'Claims are clearly separated from evidence, with limitations and sources identified.';
        case 'imageGeneration':
            return 'The prompt gives concrete visual direction while preserving the requested subject and mood.';
        case 'general':
        default:
            return 'The response directly solves the task, states necessary assumptions, and is easy to verify.';
    }
}
function rewritePrompt(prompt, useCase, analysis) {
    const effectiveUseCase = inferUseCase(useCase, prompt);
    const language = detectLanguage(prompt);
    const labels = language === 'pt'
        ? { role: 'Papel', context: 'Contexto', task: 'Tarefa', constraints: 'Requisitos', output: 'Formato de saída', success: 'Critérios de sucesso', assumptions: 'Antes de responder, indica apenas as suposições estritamente necessárias.' }
        : { role: 'Role', context: 'Context', task: 'Task', constraints: 'Constraints', output: 'Output format', success: 'Success criteria', assumptions: 'Before answering, state only the assumptions that are strictly necessary.' };
    const sections = [
        formatSection(labels.role, `Act as ${roleForUseCase(effectiveUseCase, prompt)}.`),
        formatSection(labels.context, buildContext(prompt, analysis)),
        formatSection(labels.task, buildTask(prompt, analysis, effectiveUseCase)),
        formatSection(labels.constraints, buildConstraints(analysis, effectiveUseCase)),
        formatSection(labels.output, outputFormatForUseCase(effectiveUseCase, analysis, prompt)),
        formatSection(labels.success, successCriteriaForUseCase(effectiveUseCase)),
        labels.assumptions
    ];
    return sections.join('\n\n');
}
//# sourceMappingURL=promptRewriter.js.map