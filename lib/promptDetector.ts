/**
 * Prompt detection for VS Code chat context.
 * Identifies text that looks like a prompt (AI instruction/request) with low false positives.
 * Designed for short, in-progress chat messages.
 */

export interface DetectionResult {
  isPrompt: boolean;
  confidence: number; // 0-1, higher = more confident it's a prompt
  signals: DetectionSignal[];
}

export interface DetectionSignal {
  name: string;
  weight: number; // contribution to confidence
  present: boolean;
}

// Signals that strongly indicate prompt-like text
const ACTION_VERBS = [
  'explain',
  'help',
  'write',
  'create',
  'generate',
  'build',
  'design',
  'review',
  'analyze',
  'debug',
  'fix',
  'improve',
  'optimize',
  'refactor',
  'simplify',
  'summarize',
  'compare',
  'convert',
  'translate',
  'rewrite',
  'check',
  'suggest',
  'recommend',
  'find',
  'search',
  'list',
  'show',
  'describe',
  'tell',
  'teach',
  'explain',
  'demonstrate',
  'provide',
  'give',
  'explica',
  'explicar',
  'escreve',
  'escrever',
  'cria',
  'criar',
  'analisa',
  'analisar',
  'resume',
  'resumir',
  'compara',
  'comparar',
  'melhora',
  'melhorar',
  'corrige',
  'corrigir',
  'mostra',
  'lista',
  'diz',
  'diga',
  'sugere',
  'sugira',
  'indica',
  'indique',
  'apresenta',
  'apresente',
  'propõe'
];

const CONSTRAINT_INDICATORS = [
  'must',
  'should',
  'dont',
  'should not',
  'avoid',
  'without',
  'under',
  'within',
  'limit',
  'at least',
  'no more than',
  'only',
  'exclude',
  'include'
];

const FORMAT_INDICATORS = [
  'bullet',
  'bullets',
  'table',
  'json',
  'yaml',
  'csv',
  'markdown',
  'code',
  'html',
  'step',
  'steps',
  'list',
  'outline',
  'format',
  'as a',
  'like a'
];

const CONTEXT_INDICATORS = [
  'im',
  'i am',
  'we are',
  'my',
  'our',
  'we',
  'the',
  'currently',
  'background',
  'context',
  'situation'
];

const GOAL_INDICATORS = [
  'want',
  'need',
  'trying',
  'trying to',
  'to help',
  'goal',
  'objective',
  'purpose',
  'aim',
  'so that'
];

/**
 * Detects if text looks like a prompt (instruction/request for AI).
 * Returns confidence 0-1 and explanation signals.
 */
export function detectPrompt(text: string): DetectionResult {
  if (!text || text.trim().length < 5) {
    return { isPrompt: false, confidence: 0, signals: [] };
  }

  const lower = text.toLowerCase();
  const words = tokenize(lower);
  const signals: DetectionSignal[] = [];

  const hasDirectQuestion =
    /^(who|what|when|where|why|how|quem|qual|quando|onde|como|por que|porque|o que)\b/i.test(lower.trim()) ||
    /\b(what|which|qual|que)\b.{0,120}\b(or|ou|vs|versus)\b/i.test(lower);
  signals.push({
    name: 'direct_question',
    weight: 0.36,
    present: hasDirectQuestion
  });

  // Signal 1: Starts with or contains action verb (strong indicator)
  const hasActionVerb = ACTION_VERBS.some((verb) => new RegExp(`\\b${verb}\\b`).test(lower));
  signals.push({
    name: 'action_verb',
    weight: 0.25,
    present: hasActionVerb
  });

  // Signal 2: Contains constraint language (moderate indicator)
  const hasConstraints = CONSTRAINT_INDICATORS.some((term) => new RegExp(`\\b${term}\\b`).test(lower));
  signals.push({
    name: 'constraints',
    weight: 0.15,
    present: hasConstraints
  });

  // Signal 3: Specifies output format (strong indicator of intentional prompt)
  const hasFormatRequest = FORMAT_INDICATORS.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(lower));
  signals.push({
    name: 'format_request',
    weight: 0.2,
    present: hasFormatRequest
  });

  // Signal 4: Includes context or background (moderate indicator)
  const hasContext = CONTEXT_INDICATORS.some((term) => new RegExp(`\\b${term}\\b`).test(lower));
  signals.push({
    name: 'context',
    weight: 0.1,
    present: hasContext
  });

  // Signal 5: Goal or intention language (moderate indicator)
  const hasGoal = GOAL_INDICATORS.some((term) => new RegExp(`\\b${term}\\b`).test(lower));
  signals.push({
    name: 'goal',
    weight: 0.2,
    present: hasGoal
  });

  // Signal 6: Length heuristic - prompts tend to be longer than casual chat
  // But not too long (>200 chars might be narrative)
  const textLength = text.trim().length;
  const goodLength = textLength >= 15 && textLength <= 500;
  signals.push({
    name: 'good_length',
    weight: 0.08,
    present: goodLength
  });

  // Signal 7: Question mark or colon (might indicate instruction/request)
  const hasQuestion = /\?|:$/.test(text) || hasDirectQuestion;
  signals.push({
    name: 'question_or_colon',
    weight: 0.05,
    present: hasQuestion
  });

  // Signal 8: Contains command-like imperative form
  const imperative = detectImperative(lower, words);
  signals.push({
    name: 'imperative',
    weight: 0.18,
    present: imperative
  });

  // Calculate confidence: sum of weights where signal is present
  const confidence = signals.reduce((sum, signal) => sum + (signal.present ? signal.weight : 0), 0);

  // Threshold: need at least 0.3 confidence to consider it a prompt
  // This avoids false positives on normal chat
  const isPrompt = confidence >= 0.25;

  return {
    isPrompt,
    confidence: Math.min(confidence, 1),
    signals
  };
}

/**
 * Detects imperative form (commands): starts with verb or has verb-object structure
 */
function detectImperative(lower: string, words: string[]): boolean {
  if (words.length === 0) return false;

  const firstWord = words[0];
  // Check if starts with action verb
  if (ACTION_VERBS.includes(firstWord)) {
    return true;
  }

  // Check for "please [verb]" pattern
  if (firstWord === 'please' && words.length > 1) {
    return ACTION_VERBS.includes(words[1]);
  }

  // Check for pattern like "can you [verb]" or "could you [verb]"
  if (/^(can|could|will|would|please)\s+you\b/.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Simple tokenizer for text analysis
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^\w]/g, ''))
    .filter((word) => word.length > 0);
}

/**
 * Determines if the confidence is high enough to show the popup
 * Uses a threshold to balance detection vs false positives
 */
export function shouldShowPopup(confidence: number): boolean {
  // For MVP: require 0.4+ confidence to reduce false positives
  return confidence >= 0.4;
}
