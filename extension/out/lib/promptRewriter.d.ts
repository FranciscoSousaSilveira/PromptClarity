import type { PromptAnalysisCore, UseCase } from '../types/prompt';
/**
 * Produces a conservative local fallback. It only corrects writing and never
 * invents requirements, output formats, roles, facts, or extra instructions.
 */
export declare function rewritePrompt(prompt: string, _useCase: UseCase, _analysis: PromptAnalysisCore): string;
//# sourceMappingURL=promptRewriter.d.ts.map