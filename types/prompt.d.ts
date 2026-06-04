export type UseCase = 'general' | 'coding' | 'writing' | 'studying' | 'research' | 'business' | 'imageGeneration';
export type CategoryKey = 'clarity' | 'context' | 'goal' | 'constraints' | 'outputFormat' | 'examples' | 'audience' | 'successCriteria';
export type PromptScoreLabel = 'Weak' | 'Decent' | 'Strong' | 'Excellent';
export type IssueSeverity = 'low' | 'medium' | 'high';
export interface PromptIssue {
    id: string;
    severity: IssueSeverity;
    category: CategoryKey | 'general';
    title: string;
    description: string;
    suggestion: string;
}
export interface SpellingIssue {
    word: string;
    suggestions: string[];
    confidence: number;
}
export interface PromptAnalysisCore {
    overallScore: number;
    label: PromptScoreLabel;
    categoryScores: Record<CategoryKey, number>;
    issues: PromptIssue[];
    spellingIssues: SpellingIssue[];
    strengths: string[];
    summary: string;
    categoryNotes: Record<CategoryKey, string[]>;
    correctedPrompt: string;
}
export interface PromptAnalysis extends PromptAnalysisCore {
    rewrittenPrompt: string;
}
export interface PromptTemplate {
    id: string;
    title: string;
    description: string;
    useCase: UseCase;
    prompt: string;
}
export interface UseCaseOption {
    value: UseCase;
    label: string;
    description: string;
}
export declare const USE_CASE_OPTIONS: UseCaseOption[];
export declare const CATEGORY_LABELS: Record<CategoryKey, string>;
//# sourceMappingURL=prompt.d.ts.map