import type { PromptAnalysisCore, UseCase } from '../types/prompt';
import type { RewriteIntervention } from '../config/product';
import { correctSpelling } from './spellChecker';

type Language = 'en' | 'pt';

const PORTUGUESE_WORDS = new Set([
  'a',
  'ao',
  'aos',
  'com',
  'como',
  'da',
  'de',
  'do',
  'e',
  'em',
  'era',
  'eu',
  'mais',
  'me',
  'minha',
  'no',
  'o',
  'onde',
  'ou',
  'para',
  'pelo',
  'podia',
  'por',
  'qual',
  'que',
  'quero',
  'sem',
  'sobre',
  'um',
  'uma'
]);

function detectLanguage(prompt: string): Language {
  const words =
    prompt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .match(/[a-z]+/g) || [];
  const portugueseHits = words.filter((word) => PORTUGUESE_WORDS.has(word)).length;
  return portugueseHits >= 2 || /[ãõçáéíóúâêô]/i.test(prompt) ? 'pt' : 'en';
}

function normalizePortugueseWriting(value: string): string {
  return value
    .replace(/\bnao\b/gi, 'não')
    .replace(/\bvoce\b/gi, 'você')
    .replace(/\bninguem\b/gi, 'ninguém')
    .replace(/\bpor\s+favor\b/gi, 'por favor')
    .replace(/\bsff\b/gi, 'por favor')
    .replace(/\bexplica\s+me\b/gi, 'explica-me')
    .replace(/\bdiz\s+me\b/gi, 'diz-me');
}

function polishWithoutExpanding(prompt: string, language: Language): string {
  const originalWasQuestion = /\?\s*$/.test(prompt);
  let polished = prompt
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/([,.;:?!])(?=[^\s\n])/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  polished = correctSpelling(polished, language, 0.9).trim();
  if (language === 'pt') polished = normalizePortugueseWriting(polished);
  polished = polished.charAt(0).toUpperCase() + polished.slice(1);

  if (originalWasQuestion && !/\?\s*$/.test(polished)) {
    polished = `${polished.replace(/[.!]+\s*$/, '')}?`;
  }
  return polished;
}

/**
 * Produces a conservative local fallback. It only corrects writing and never
 * invents requirements, output formats, roles, facts, or extra instructions.
 */
export function rewritePrompt(
  prompt: string,
  _useCase: UseCase,
  _analysis: PromptAnalysisCore,
  _intervention: RewriteIntervention = 'normal'
): string {
  // Polished intentionally shares the normal fallback until safe deterministic polishing exists.
  return polishWithoutExpanding(prompt, detectLanguage(prompt));
}
