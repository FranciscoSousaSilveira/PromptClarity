import { describe, expect, it } from 'vitest';
import corpus from './fixtures/prompt-corpus.json';
import { analyzePrompt } from '../lib/promptAnalyzer';

describe('real prompt corpus', () => {
  for (const item of corpus) {
    it(`preserves intent for ${item.id}`, () => {
      const result = analyzePrompt(item.prompt, 'general').rewrittenPrompt;
      const normalized = result
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      for (const term of item.mustInclude) {
        const expected = term
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        expect(normalized).toContain(expected);
      }
      expect(result).not.toMatch(/Resposta corrigida|Here is the corrected|Role:\s*Role:/i);
    });
  }
});
