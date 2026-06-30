import { describe, expect, it } from 'vitest';
import { CHAT_SITE_ADAPTERS, getSiteAdapter } from '../chrome-extension/src/siteAdapters';

describe('chat site adapters', () => {
  it.each([
    ['chatgpt.com', 'chatgpt'],
    ['claude.ai', 'claude'],
    ['gemini.google.com', 'gemini'],
    ['copilot.microsoft.com', 'copilot'],
    ['www.perplexity.ai', 'perplexity']
  ])('selects the %s adapter', (host, id) => {
    const adapter = getSiteAdapter(host);
    expect(adapter.id).toBe(id);
    expect(adapter.composerSelectors.length).toBeGreaterThan(0);
    expect(adapter.userMessageSelectors.length).toBeGreaterThan(0);
  });

  it('provides a safe generic adapter for unknown chat sites', () => {
    const adapter = getSiteAdapter('local-chat.example');
    expect(adapter.id).toBe('generic');
    expect(adapter.hosts).toEqual(['local-chat.example']);
    expect(adapter.composerSelectors).toContain('[contenteditable="true"]');
  });

  it('does not define duplicate adapter ids', () => {
    const ids = CHAT_SITE_ADAPTERS.map((adapter) => adapter.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
