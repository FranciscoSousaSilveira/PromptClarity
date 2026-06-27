import { describe, it, expect } from 'vitest';
import { enhancePromptQuality } from '../lib/promptEnhancer';
import type { CategoryKey } from '../types/prompt';

describe('Prompt Enhancer', () => {
  it('improves clarity by replacing vague terms', () => {
    const prompt = 'Make this good code';
    const scores: Record<CategoryKey, number> = {
      clarity: 30,
      context: 50,
      goal: 50,
      constraints: 50,
      outputFormat: 50,
      examples: 50,
      audience: 50,
      successCriteria: 50
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced).toContain('excellent');
  });

  it('improves goal clarity for vague prompts', () => {
    const prompt = 'Need help with something';
    const scores: Record<CategoryKey, number> = {
      clarity: 50,
      context: 50,
      goal: 25,
      constraints: 50,
      outputFormat: 50,
      examples: 50,
      audience: 50,
      successCriteria: 50
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced.length).toBeGreaterThan(prompt.length); // Should add helpful prefix
  });

  it('adds format specification when missing', () => {
    const prompt = 'Create a function that processes data';
    const scores: Record<CategoryKey, number> = {
      clarity: 50,
      context: 50,
      goal: 50,
      constraints: 50,
      outputFormat: 20,
      examples: 50,
      audience: 50,
      successCriteria: 50
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced).toContain('format');
  });

  it('adds context when missing for short prompts', () => {
    const prompt = 'Write code';
    const scores: Record<CategoryKey, number> = {
      clarity: 50,
      context: 20,
      goal: 50,
      constraints: 50,
      outputFormat: 50,
      examples: 50,
      audience: 50,
      successCriteria: 50
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced).toContain('context');
  });

  it('does not modify prompts with high scores', () => {
    const prompt = 'Create a function that validates user input and returns true if valid, false otherwise.';
    const scores: Record<CategoryKey, number> = {
      clarity: 85,
      context: 80,
      goal: 85,
      constraints: 80,
      outputFormat: 75,
      examples: 85,
      audience: 80,
      successCriteria: 85
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced).toBe(prompt); // Should not modify high-quality prompts
  });

  it('improves Portuguese prompts', () => {
    const prompt = 'Escreva alguma coisa';
    const scores: Record<CategoryKey, number> = {
      clarity: 30,
      context: 50,
      goal: 50,
      constraints: 50,
      outputFormat: 50,
      examples: 50,
      audience: 50,
      successCriteria: 50
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced.length).toBeGreaterThanOrEqual(prompt.length);
  });

  it('adds success criteria when missing', () => {
    const prompt = 'Build a web server';
    const scores: Record<CategoryKey, number> = {
      clarity: 50,
      context: 50,
      goal: 50,
      constraints: 50,
      outputFormat: 50,
      examples: 50,
      audience: 50,
      successCriteria: 20
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced).toContain('success');
  });

  it('targets multiple weak categories', () => {
    const prompt = 'Do stuff';
    const scores: Record<CategoryKey, number> = {
      clarity: 20,
      context: 20,
      goal: 20,
      constraints: 20,
      outputFormat: 20,
      examples: 20,
      audience: 20,
      successCriteria: 20
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    // Should have multiple improvements
    expect(enhanced.length).toBeGreaterThan(prompt.length);
  });

  it('preserves main intent while improving structure', () => {
    const prompt = 'Create a function';
    const scores: Record<CategoryKey, number> = {
      clarity: 50,
      context: 30,
      goal: 50,
      constraints: 50,
      outputFormat: 50,
      examples: 50,
      audience: 50,
      successCriteria: 50
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced.includes('Create') || enhanced.includes('function')).toBe(true);
  });

  it('handles empty category scores', () => {
    const prompt = 'Help';
    const scores: Record<CategoryKey, number> = {
      clarity: 0,
      context: 0,
      goal: 0,
      constraints: 0,
      outputFormat: 0,
      examples: 0,
      audience: 0,
      successCriteria: 0
    };

    const enhanced = enhancePromptQuality(prompt, scores);
    expect(enhanced.length).toBeGreaterThan(0);
  });
});
