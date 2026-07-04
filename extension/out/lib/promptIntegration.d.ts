/**
 * Integration module for prompt detection and analysis.
 * This is the core logic for the VS Code popup: detect if text is a prompt,
 * analyze it, and generate an improved version.
 */
import type { RewriteIntervention } from '../config/product';
import type { PromptAnalysis, UseCase } from '../types/prompt';
export interface PopupContentRequest {
    text: string;
    useCase?: UseCase;
}
export interface PopupContent {
    originalText?: string;
    isPrompt: boolean;
    detectionConfidence: number;
    analysis?: PromptAnalysis;
    improvedPrompt?: string;
    copyableText?: string;
    rewriteSource?: 'model' | 'rules';
    rewriteStatus?: 'loading' | 'changed' | 'no_change' | 'fallback' | 'error';
    modelName?: string;
    modelError?: string;
    sourceDetail?: 'local-ai' | 'instant-rules' | 'safety-fallback';
    validationScore?: number;
    isAlreadyGood?: boolean;
    intervention?: RewriteIntervention;
    validationReason?: string | null;
}
/**
 * Main entry point for the VS Code popup.
 * Given user text, determines if it's a prompt and generates improved version.
 */
export declare function analyzeForPopup(request: PopupContentRequest): PopupContent;
/**
 * Determines what to show in the popup based on detection results.
 * Returns the improved prompt ready for copy/paste.
 */
export declare function getPopupContent(text: string, useCase?: UseCase): string | null;
/**
 * Used by the extension to check if it should show a hint/badge
 * without full analysis overhead.
 */
export declare function shouldShowHint(text: string): boolean;
/**
 * Returns a confidence score suitable for UI display (0-100)
 */
export declare function getConfidenceScore(text: string): number;
//# sourceMappingURL=promptIntegration.d.ts.map