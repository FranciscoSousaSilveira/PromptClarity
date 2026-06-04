import { describe, it, expect } from 'vitest';
import { detectPrompt, shouldShowPopup } from '../lib/promptDetector';

describe('promptDetector', () => {
  describe('detectPrompt', () => {
    it('detects clear action-verb prompts', () => {
      const result = detectPrompt('explain how React hooks work');
      expect(result.isPrompt).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.signals.find(s => s.name === 'action_verb')?.present).toBe(true);
    });

    it('detects prompts with format requests', () => {
      const result = detectPrompt('write a summary in bullet points');
      expect(result.isPrompt).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.4);
      expect(result.signals.find(s => s.name === 'format_request')?.present).toBe(true);
    });

    it('detects prompts with constraints', () => {
      const result = detectPrompt('create a function that must be less than 50 lines');
      expect(result.isPrompt).toBe(true);
      expect(result.signals.find(s => s.name === 'constraints')?.present).toBe(true);
    });

    it('detects prompts starting with imperatives', () => {
      const result = detectPrompt('please fix this code for me');
      expect(result.isPrompt).toBe(true);
      expect(result.signals.find(s => s.name === 'imperative')?.present).toBe(true);
    });

    it('detects prompts with "can you" pattern', () => {
      const result = detectPrompt('can you help me debug this error');
      expect(result.isPrompt).toBe(true);
      expect(result.signals.find(s => s.name === 'imperative')?.present).toBe(true);
    });

    it('rejects very short text as non-prompt', () => {
      const result = detectPrompt('hi');
      expect(result.isPrompt).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });

    it('rejects empty or whitespace-only text', () => {
      const result = detectPrompt('   ');
      expect(result.isPrompt).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('flags normal chat as non-prompt', () => {
      const result = detectPrompt('yeah, I was thinking about that earlier');
      expect(result.isPrompt).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
    });

    it('flags casual question as low confidence', () => {
      const result = detectPrompt('what do you think about this');
      expect(result.isPrompt).toBe(false);
      expect(result.confidence).toBeLessThan(0.4);
    });

    it('detects prompt with multiple signals', () => {
      const result = detectPrompt('can you create a TypeScript function that validates email addresses and returns true or false');
      expect(result.isPrompt).toBe(true);
      const presentSignals = result.signals.filter(s => s.present).length;
      expect(presentSignals).toBeGreaterThan(1);
    });

    it('handles text with punctuation', () => {
      const result = detectPrompt('explain quantum computing in simple terms!');
      expect(result.isPrompt).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('detects goal-oriented prompts', () => {
      const result = detectPrompt('I need a function that generates random passwords');
      expect(result.isPrompt).toBe(true);
      expect(result.signals.find(s => s.name === 'goal')?.present).toBe(true);
    });

    it('detects context-rich prompts', () => {
      const result = detectPrompt('My team is building a React app and we need to optimize performance');
      expect(result.isPrompt).toBe(true);
      expect(result.signals.find(s => s.name === 'context')?.present).toBe(true);
    });

    it('rejects narrative text', () => {
      const result = detectPrompt('This is a story about how I learned to code. It all started when I was young.');
      // Long narrative should be low confidence
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('detects "how do you" as low-confidence prompt', () => {
      const result = detectPrompt('how do you build a web server');
      // This might be a question or might be a prompt for instructions
      expect(result.confidence).toBeGreaterThanOrEqual(0.2);
    });

    it('calculates confidence correctly with no signals', () => {
      const result = detectPrompt('the weather is nice today');
      expect(result.confidence).toBeLessThan(0.3);
      expect(result.isPrompt).toBe(false);
    });

    it('handles mixed case text', () => {
      const result = detectPrompt('HELP ME DEBUG THIS CODE PLEASE');
      expect(result.isPrompt).toBe(true);
    });

    it('detects json/yaml format as prompt', () => {
      const result = detectPrompt('convert this data to JSON format');
      expect(result.isPrompt).toBe(true);
      expect(result.signals.find(s => s.name === 'format_request')?.present).toBe(true);
    });

    it('detects list/table format as prompt', () => {
      const result = detectPrompt('give me a table of all the planets');
      expect(result.isPrompt).toBe(true);
    });

    it('rejects generic filler text', () => {
      const result = detectPrompt('you know stuff and things like that');
      expect(result.isPrompt).toBe(false);
    });

    it('detects code review as prompt', () => {
      const result = detectPrompt('review this code and suggest improvements');
      expect(result.isPrompt).toBe(true);
      expect(result.signals.find(s => s.name === 'action_verb')?.present).toBe(true);
    });

    it('detects summarization as prompt', () => {
      const result = detectPrompt('summarize the main ideas from this article');
      expect(result.isPrompt).toBe(true);
    });

    it('detects translation as prompt', () => {
      const result = detectPrompt('translate this text to Spanish');
      expect(result.isPrompt).toBe(true);
    });

    it('rejects single-line casual statement', () => {
      const result = detectPrompt('that sounds good to me');
      expect(result.isPrompt).toBe(false);
    });

    it('handles text at length boundary (15 chars)', () => {
      const result = detectPrompt('please help me now');
      // 15+ chars with action verb should be a prompt
      expect(result.signals.find(s => s.name === 'good_length')?.present).toBe(true);
    });

    it('handles text exceeding length boundary (500 chars)', () => {
      const longText = 'help me ' + 'a'.repeat(500);
      const result = detectPrompt(longText);
      expect(result.signals.find(s => s.name === 'good_length')?.present).toBe(false);
    });
  });

  describe('shouldShowPopup', () => {
    it('shows popup for confidence >= 0.4', () => {
      expect(shouldShowPopup(0.40)).toBe(true);
      expect(shouldShowPopup(0.5)).toBe(true);
      expect(shouldShowPopup(1.0)).toBe(true);
    });

    it('hides popup for confidence < 0.4', () => {
      expect(shouldShowPopup(0.39)).toBe(false);
      expect(shouldShowPopup(0.30)).toBe(false);
      expect(shouldShowPopup(0.0)).toBe(false);
    });

    it('hides popup for exactly 0.39 confidence', () => {
      expect(shouldShowPopup(0.39)).toBe(false);
    });

    it('shows popup for exactly 0.40 confidence', () => {
      expect(shouldShowPopup(0.40)).toBe(true);
    });
  });

  describe('false positive avoidance', () => {
    // These tests ensure normal chat doesn't trigger the popup
    it('rejects "sounds good"', () => {
      const result = detectPrompt('sounds good to me');
      expect(shouldShowPopup(result.confidence)).toBe(false);
    });

    it('rejects "I agree"', () => {
      const result = detectPrompt('I totally agree with that');
      expect(shouldShowPopup(result.confidence)).toBe(false);
    });

    it('rejects "thanks"', () => {
      const result = detectPrompt('thanks for your help');
      expect(shouldShowPopup(result.confidence)).toBe(false);
    });

    it('rejects "see you later"', () => {
      const result = detectPrompt('see you later');
      expect(shouldShowPopup(result.confidence)).toBe(false);
    });

    it('rejects "have a good day"', () => {
      const result = detectPrompt('have a good day');
      expect(shouldShowPopup(result.confidence)).toBe(false);
    });

    it('rejects "how is the weather"', () => {
      const result = detectPrompt('how is the weather today');
      expect(shouldShowPopup(result.confidence)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles URLs in text', () => {
      const result = detectPrompt('analyze the content at https://example.com');
      expect(result.isPrompt).toBe(true);
    });

    it('handles code snippets in quotes', () => {
      const result = detectPrompt('explain this code: console.log("hello")');
      expect(result.isPrompt).toBe(true);
    });

    it('handles special characters', () => {
      const result = detectPrompt('write a function that handles @mentions & #tags');
      expect(result.isPrompt).toBe(true);
    });

    it('handles numbers and references', () => {
      const result = detectPrompt('create 5 test cases for the login function');
      expect(result.isPrompt).toBe(true);
    });

    it('detects question as potential prompt when followed by context', () => {
      const result = detectPrompt('what would be the best way to optimize this React component?');
      expect(result.confidence).toBeGreaterThan(0.2);
    });
  });
});
