/**
 * Spelling mistake detection and correction for English and European Portuguese
 * Uses Levenshtein distance for finding similar words and common word dictionaries
 */
type Language = 'en' | 'pt';
interface SpellingIssue {
    word: string;
    position: number;
    suggestions: string[];
    confidence: number;
}
/**
 * Detect spelling mistakes in text
 */
export declare function detectSpellingMistakes(text: string, language: Language): SpellingIssue[];
/**
 * Correct spelling in text by replacing misspelled words with suggestions
 */
export declare function correctSpelling(text: string, language: Language, autoCorrectThreshold?: number): string;
/**
 * Get spelling issues with details for display
 */
export declare function getSpellingIssuesForDisplay(text: string, language: Language): Array<{
    original: string;
    suggestions: string[];
    confidence: number;
}>;
/**
 * Batch correct multiple spelling issues
 */
export declare function batchCorrectSpelling(text: string, language: Language, corrections: Record<string, string>): string;
export {};
//# sourceMappingURL=spellChecker.d.ts.map