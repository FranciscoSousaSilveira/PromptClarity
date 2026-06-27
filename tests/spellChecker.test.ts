import { describe, it, expect } from 'vitest';
import {
  detectSpellingMistakes,
  correctSpelling,
  getSpellingIssuesForDisplay,
  batchCorrectSpelling
} from '../lib/spellChecker';

describe('Spell Checker - English', () => {
  it('detects common misspellings in English', () => {
    const text = 'Creat a program that analyzez data';
    const issues = detectSpellingMistakes(text, 'en');
    
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.word.toLowerCase() === 'creat')).toBe(true);
    expect(issues.some(i => i.word.toLowerCase() === 'analyzez')).toBe(true);
  });

  it('does not flag correctly spelled English words', () => {
    const text = 'Create a program that analyzes data';
    const issues = detectSpellingMistakes(text, 'en');
    
    expect(issues.length).toBe(0);
  });

  it('does not flag ordinary product and business vocabulary', () => {
    const text = 'Write an email to a client about a delayed project';
    const issues = detectSpellingMistakes(text, 'en');

    expect(issues).toEqual([]);
  });

  it('provides correction suggestions for misspelled words', () => {
    const text = 'teh quick brwn fox';
    const issues = detectSpellingMistakes(text, 'en');
    
    const tehIssue = issues.find(i => i.word === 'teh');
    expect(tehIssue).toBeDefined();
    expect(tehIssue!.suggestions).toContain('the');
  });

  it('corrects spelling with high confidence threshold', () => {
    const text = 'teh qwick brwn fox';
    const corrected = correctSpelling(text, 'en', 0.80);
    
    expect(corrected).toContain('the');
    expect(corrected).toContain('quick');
    expect(corrected).toContain('brown');
    expect(corrected).toBe('the quick brown fox');
  });

  it('handles mixed case correctly', () => {
    const text = 'Teh quick brwn fox';
    const corrected = correctSpelling(text, 'en', 0.80);
    
    // Should preserve capitalization
    expect(corrected).toContain('The');
  });

  it('returns empty array for text without misspellings', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const issues = detectSpellingMistakes(text, 'en');
    
    expect(issues).toEqual([]);
  });

  it('skips short words that might be abbreviations', () => {
    const text = 'Th is a test';
    const issues = detectSpellingMistakes(text, 'en');
    
    // Short words like "th" should be skipped
    expect(issues.length).toBe(0);
  });

  it('gets display-ready spelling issues', () => {
    const text = 'Creat a program';
    const display = getSpellingIssuesForDisplay(text, 'en');
    
    expect(display.length).toBeGreaterThan(0);
    expect(display[0]).toHaveProperty('original');
    expect(display[0]).toHaveProperty('suggestions');
    expect(display[0]).toHaveProperty('confidence');
    expect(typeof display[0].confidence).toBe('number');
  });

  it('batch corrects multiple misspellings', () => {
    const text = 'creat a progrm with gud perfomance';
    const corrections = {
      'creat': 'create',
      'progrm': 'program',
      'gud': 'good',
      'perfomance': 'performance'
    };
    
    const corrected = batchCorrectSpelling(text, 'en', corrections);
    
    expect(corrected).toContain('create');
    expect(corrected).toContain('program');
    expect(corrected).toContain('good');
    expect(corrected).toContain('performance');
  });
});

describe('Spell Checker - Portuguese', () => {
  it('detects common misspellings in Portuguese', () => {
    const text = 'Cria um prgrma que analiza dados';
    const issues = detectSpellingMistakes(text, 'pt');
    
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.word.toLowerCase() === 'prgrma')).toBe(true);
  });

  it('does not flag correctly spelled Portuguese words', () => {
    const text = 'Cria um programa que analisa dados';
    const issues = detectSpellingMistakes(text, 'pt');
    
    expect(issues.length).toBe(0);
  });

  it('provides correction suggestions for Portuguese misspellings', () => {
    const text = 'prgrma de código';
    const issues = detectSpellingMistakes(text, 'pt');
    
    const issue = issues.find(i => i.word === 'prgrma');
    expect(issue).toBeDefined();
    expect(issue!.suggestions).toContain('programa');
  });

  it('corrects Portuguese spelling', () => {
    const text = 'Creia um prgrma qué funcina bem';
    const corrected = correctSpelling(text, 'pt', 0.80);
    
    expect(corrected).toBeDefined();
    expect(corrected.length).toBeGreaterThan(0);
  });

  it('handles Portuguese with accents', () => {
    const text = 'análize este código';
    const issues = detectSpellingMistakes(text, 'pt');
    
    // Should be able to handle accented characters
    expect(Array.isArray(issues)).toBe(true);
  });

  it('returns empty array for correct Portuguese text', () => {
    const text = 'Cria um programa que analisa dados com precisão';
    const issues = detectSpellingMistakes(text, 'pt');
    
    expect(issues).toEqual([]);
  });

  it('gets display-ready spelling issues for Portuguese', () => {
    const text = 'Prgrma qué funcina';
    const display = getSpellingIssuesForDisplay(text, 'pt');
    
    expect(display.length).toBeGreaterThan(0);
    expect(display[0]).toHaveProperty('original');
    expect(display[0]).toHaveProperty('suggestions');
    expect(display[0]).toHaveProperty('confidence');
  });

  it('batch corrects multiple Portuguese misspellings', () => {
    const text = 'creia um prgrma qué funcina bem';
    const corrections = {
      'creia': 'cria',
      'prgrma': 'programa',
      'qué': 'que',
      'funcina': 'funciona'
    };
    
    const corrected = batchCorrectSpelling(text, 'pt', corrections);
    
    expect(corrected).toContain('cria');
    expect(corrected).toContain('programa');
  });
});

describe('Spell Checker - Common Issues', () => {
  it('handles empty string', () => {
    const issues = detectSpellingMistakes('', 'en');
    expect(issues).toEqual([]);
  });

  it('handles whitespace-only string', () => {
    const issues = detectSpellingMistakes('   ', 'en');
    expect(issues).toEqual([]);
  });

  it('ignores words with numbers', () => {
    const text = 'test123 and code456';
    const issues = detectSpellingMistakes(text, 'en');
    
    // Words with numbers should be skipped
    expect(issues.length).toBe(0);
  });

  it('ignores all-caps words (acronyms)', () => {
    const text = 'API and HTML are standards';
    const issues = detectSpellingMistakes(text, 'en');
    
    // Acronyms should not be flagged
    expect(issues.length).toBe(0);
  });

  it('ignores duplicate misspellings', () => {
    const text = 'teh teh test with brwn brwn fox';
    const issues = detectSpellingMistakes(text, 'en');
    
    // Should report each unique misspelling only once
    const words = issues.map(i => i.word.toLowerCase());
    expect(words.filter(w => w === 'teh').length).toBe(1);
    expect(words.filter(w => w === 'brwn').length).toBe(1);
  });

  it('sorts issues by confidence', () => {
    const text = 'teh brwn fox';
    const issues = detectSpellingMistakes(text, 'en');
    
    // Issues should be sorted by confidence (highest first)
    if (issues.length > 1) {
      for (let i = 1; i < issues.length; i++) {
        expect(issues[i - 1].confidence).toBeGreaterThanOrEqual(issues[i].confidence);
      }
    }
  });

  it('respects auto-correct threshold', () => {
    const text = 'Teh quick brwn fox';
    const correctedStrict = correctSpelling(text, 'en', 0.95);
    const correctedLoose = correctSpelling(text, 'en', 0.70);
    
    // Loose threshold should correct more words
    expect(correctedLoose.length).toBeGreaterThanOrEqual(correctedStrict.length);
  });
});
