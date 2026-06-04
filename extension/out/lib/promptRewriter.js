"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewritePrompt = rewritePrompt;
const spellChecker_1 = require("./spellChecker");
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
function formatList(items) {
    return items.map((item) => `- ${item}`).join('\n');
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
        return trimmed;
    }
    return `${trimmed}\n\n[Add: relevant background, who the output is for, and any prior work]`;
}
function buildConstraints(analysis) {
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
function buildStrengths(analysis) {
    if (analysis.strengths.length === 0) {
        return '[No strong signals were detected yet]';
    }
    return formatList(analysis.strengths);
}
function qualityBarForUseCase(useCase, analysis, prompt) {
    const baseline = 'Stay specific, avoid filler, and answer only what the prompt asks.';
    const lower = prompt.toLowerCase();
    if (analysis.issues.length === 0) {
        return `${baseline} Preserve the original intent and keep the response polished.`;
    }
    switch (useCase) {
        case 'coding':
            return `${baseline} Prioritize correctness, reproducibility, and actionable debugging steps.${/error|bug|crash/.test(lower) ? ' Include error messages and fixes.' : ''}`;
        case 'writing':
            return `${baseline} Match the requested tone${/tone|formal|casual/.test(lower) ? ' and audience' : ''}. Avoid filler.`;
        case 'studying':
            return `${baseline} Explain at the right level and include a quick comprehension check or practice questions.`;
        case 'research':
            return `${baseline} Favor credible evidence, named sources${/paper|study|academic/.test(lower) ? ', and publication years' : ''}, and clear tradeoffs.`;
        case 'business':
            return `${baseline} Keep it concise, outcome-oriented${/cta|call to action|conversion/.test(lower) ? ', with a clear CTA' : ''}.`;
        case 'imageGeneration':
            return `${baseline} Include concrete visual details (subject, style, composition, lighting, mood${/aspect|ratio|16:9|4:3/.test(lower) ? ', aspect ratio' : ''}).`;
        case 'general':
        default:
            return `${baseline} Make the response easy to act on and easy to verify.`;
    }
}
function rewritePrompt(prompt, useCase, analysis) {
    const language = detectLanguage(prompt);
    const sections = [
        formatSection('Role', `Act as ${roleForUseCase(useCase, prompt)}.`),
        formatSection('Context', buildContext(prompt, analysis)),
        formatSection('Task', buildTask(prompt, analysis, useCase)),
        formatSection('Constraints', buildConstraints(analysis)),
        formatSection('Output format', outputFormatForUseCase(useCase, analysis, prompt)),
        formatSection('Quality bar', qualityBarForUseCase(useCase, analysis, prompt)),
        formatSection('Strengths to preserve', buildStrengths(analysis)),
        'Before answering, state any assumptions you are making.'
    ];
    let rewritten = sections.join('\n\n');
    // Apply spelling corrections based on detected language
    rewritten = (0, spellChecker_1.correctSpelling)(rewritten, language, 0.80);
    return rewritten;
}
//# sourceMappingURL=promptRewriter.js.map