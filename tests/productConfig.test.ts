import { describe, expect, it } from 'vitest';
import { MODEL_PROFILES, PRODUCT, SUPPORTED_CHAT_ORIGINS, isPerformanceMode } from '../config/product';

describe('product configuration', () => {
  it('defines increasingly capable model profiles', () => {
    expect(MODEL_PROFILES.fast.maxOutputTokens).toBeLessThan(MODEL_PROFILES.balanced.maxOutputTokens);
    expect(MODEL_PROFILES.balanced.maxOutputTokens).toBeLessThan(MODEL_PROFILES.quality.maxOutputTokens);
    expect(MODEL_PROFILES.fast.contextTokens).toBeLessThan(MODEL_PROFILES.quality.contextTokens);
  });

  it('recognizes only supported performance modes', () => {
    expect(isPerformanceMode('fast')).toBe(true);
    expect(isPerformanceMode('balanced')).toBe(true);
    expect(isPerformanceMode('quality')).toBe(true);
    expect(isPerformanceMode('turbo')).toBe(false);
  });

  it('keeps the local API private and includes the main supported sites', () => {
    expect(PRODUCT.apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:/);
    expect(SUPPORTED_CHAT_ORIGINS).toContain('https://chatgpt.com');
    expect(SUPPORTED_CHAT_ORIGINS).toContain('https://gemini.google.com');
  });
});
