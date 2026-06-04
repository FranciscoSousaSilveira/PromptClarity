"use strict";
/**
 * Integration module for prompt detection and analysis.
 * This is the core logic for the VS Code popup: detect if text is a prompt,
 * analyze it, and generate an improved version.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeForPopup = analyzeForPopup;
exports.getPopupContent = getPopupContent;
exports.shouldShowHint = shouldShowHint;
exports.getConfidenceScore = getConfidenceScore;
const promptDetector_1 = require("./promptDetector");
const promptAnalyzer_1 = require("./promptAnalyzer");
/**
 * Main entry point for the VS Code popup.
 * Given user text, determines if it's a prompt and generates improved version.
 */
function analyzeForPopup(request) {
    const { text, useCase = 'general' } = request;
    // Step 1: Detect if text looks like a prompt
    const detection = (0, promptDetector_1.detectPrompt)(text);
    if (!(0, promptDetector_1.shouldShowPopup)(detection.confidence)) {
        return {
            isPrompt: false,
            detectionConfidence: detection.confidence
        };
    }
    // Step 2: Analyze the detected prompt
    try {
        const analysis = (0, promptAnalyzer_1.analyzePrompt)(text, useCase);
        return {
            isPrompt: true,
            detectionConfidence: detection.confidence,
            analysis,
            improvedPrompt: analysis.rewrittenPrompt,
            copyableText: analysis.rewrittenPrompt
        };
    }
    catch (error) {
        // If analysis fails, still return the detected status
        console.error('Failed to analyze prompt:', error);
        return {
            isPrompt: true,
            detectionConfidence: detection.confidence,
            improvedPrompt: text,
            copyableText: text
        };
    }
}
/**
 * Determines what to show in the popup based on detection results.
 * Returns the improved prompt ready for copy/paste.
 */
function getPopupContent(text, useCase = 'general') {
    const popup = analyzeForPopup({ text, useCase });
    if (!popup.isPrompt) {
        return null;
    }
    return popup.copyableText || null;
}
/**
 * Used by the extension to check if it should show a hint/badge
 * without full analysis overhead.
 */
function shouldShowHint(text) {
    const detection = (0, promptDetector_1.detectPrompt)(text);
    return detection.confidence >= 0.35; // Lower threshold for hints
}
/**
 * Returns a confidence score suitable for UI display (0-100)
 */
function getConfidenceScore(text) {
    const detection = (0, promptDetector_1.detectPrompt)(text);
    return Math.round(detection.confidence * 100);
}
//# sourceMappingURL=promptIntegration.js.map