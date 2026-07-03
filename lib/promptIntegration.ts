/**
 * Integration module for prompt detection and analysis.
 * This is the core logic for the VS Code popup: detect if text is a prompt,
 * analyze it, and generate an improved version.
 */

import { detectPrompt, shouldShowPopup } from './promptDetector';
import { analyzePrompt } from './promptAnalyzer';
import type { PromptAnalysis, UseCase } from '../types/prompt';

export interface PopupContentRequest {
  text: string;
  useCase?: UseCase;
}

export interface PopupContent {
  isPrompt: boolean;
  detectionConfidence: number;
  analysis?: PromptAnalysis;
  improvedPrompt?: string;
  copyableText?: string;
  rewriteSource?: 'model' | 'rules';
  rewriteStatus?: 'loading' | 'ready' | 'fallback';
  modelName?: string;
  modelError?: string;
  sourceDetail?: 'local-ai' | 'instant-rules' | 'safety-fallback';
  validationScore?: number;
  isAlreadyGood?: boolean;
}

/**
 * Main entry point for the VS Code popup.
 * Given user text, determines if it's a prompt and generates improved version.
 */
export function analyzeForPopup(request: PopupContentRequest): PopupContent {
  const { text, useCase = 'general' } = request;

  // Step 1: Detect if text looks like a prompt
  const detection = detectPrompt(text);

  if (!shouldShowPopup(detection.confidence)) {
    return {
      isPrompt: false,
      detectionConfidence: detection.confidence
    };
  }

  // Step 2: Analyze the detected prompt
  try {
    const analysis = analyzePrompt(text, useCase);

    return {
      isPrompt: true,
      detectionConfidence: detection.confidence,
      analysis,
      improvedPrompt: analysis.rewrittenPrompt,
      copyableText: analysis.rewrittenPrompt
    };
  } catch (error) {
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
export function getPopupContent(text: string, useCase: UseCase = 'general'): string | null {
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
export function shouldShowHint(text: string): boolean {
  const detection = detectPrompt(text);
  return detection.confidence >= 0.35; // Lower threshold for hints
}

/**
 * Returns a confidence score suitable for UI display (0-100)
 */
export function getConfidenceScore(text: string): number {
  const detection = detectPrompt(text);
  return Math.round(detection.confidence * 100);
}
