export type RewriteValidationReason = 'model_output_valid' | 'empty_output' | 'output_too_long' | 'assistant_preface' | 'assistant_answer' | 'refusal' | 'prompt_commentary' | 'semantic_expansion' | 'introduced_tool' | 'added_structure' | 'markdown_injection' | 'language_shift' | 'language_variant_shift' | 'uncertainty_changed' | 'factual_meaning_changed' | 'truncated_output' | 'unbalanced_delimiters' | 'excessive_length_growth' | 'unfaithful_rewrite';
export interface ModelOutputValidation {
    passed: boolean;
    reason: RewriteValidationReason;
}
/**
 * Conservative, deterministic validation for local model output. Every rule
 * returns a stable reason code so heuristic failures are visible and testable.
 */
export declare function validateModelRewrite(original: string, rewritten: string, intervention?: RewriteIntervention): ModelOutputValidation;
export declare function isModelRewriteUsable(original: string, rewritten: string, intervention?: RewriteIntervention): boolean;
export declare function rewriteValidationScore(original: string, rewritten: string, intervention?: RewriteIntervention): number;
import type { RewriteIntervention } from '../config/product';
//# sourceMappingURL=rewriteValidator.d.ts.map