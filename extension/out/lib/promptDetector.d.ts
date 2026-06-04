/**
 * Prompt detection for VS Code chat context.
 * Identifies text that looks like a prompt (AI instruction/request) with low false positives.
 * Designed for short, in-progress chat messages.
 */
export interface DetectionResult {
    isPrompt: boolean;
    confidence: number;
    signals: DetectionSignal[];
}
export interface DetectionSignal {
    name: string;
    weight: number;
    present: boolean;
}
/**
 * Detects if text looks like a prompt (instruction/request for AI).
 * Returns confidence 0-1 and explanation signals.
 */
export declare function detectPrompt(text: string): DetectionResult;
/**
 * Determines if the confidence is high enough to show the popup
 * Uses a threshold to balance detection vs false positives
 */
export declare function shouldShowPopup(confidence: number): boolean;
//# sourceMappingURL=promptDetector.d.ts.map