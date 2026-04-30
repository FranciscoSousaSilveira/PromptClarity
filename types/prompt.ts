export type UseCase =
  | 'general'
  | 'coding'
  | 'writing'
  | 'studying'
  | 'research'
  | 'business'
  | 'imageGeneration';

export type CategoryKey =
  | 'clarity'
  | 'context'
  | 'goal'
  | 'constraints'
  | 'outputFormat'
  | 'examples'
  | 'audience'
  | 'successCriteria';

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
  confidence: number; // 0-100
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

export const USE_CASE_OPTIONS: UseCaseOption[] = [
  { value: 'general', label: 'General', description: 'Flexible prompts for everyday tasks' },
  { value: 'coding', label: 'Coding', description: 'Debugging, implementation, and code review' },
  { value: 'writing', label: 'Writing', description: 'Drafts, editing, and tone control' },
  { value: 'studying', label: 'Studying', description: 'Learning explanations and practice prompts' },
  { value: 'research', label: 'Research', description: 'Comparisons, evidence, and synthesis' },
  { value: 'business', label: 'Business', description: 'Emails, strategy, and decision support' },
  { value: 'imageGeneration', label: 'Image generation', description: 'Visual prompts for image models' }
];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  clarity: 'Clarity',
  context: 'Context',
  goal: 'Goal',
  constraints: 'Constraints',
  outputFormat: 'Output format',
  examples: 'Examples',
  audience: 'Audience / role',
  successCriteria: 'Success criteria'
};
