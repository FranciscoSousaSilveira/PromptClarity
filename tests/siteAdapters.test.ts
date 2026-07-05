import { describe, expect, it } from 'vitest';
import {
  CHAT_SITE_ADAPTERS,
  findAdapterComposer,
  getSiteAdapter,
  matchesChatSiteHost
} from '../chrome-extension/src/siteAdapters';

describe('chat site adapters', () => {
  it.each([
    ['chatgpt.com', 'chatgpt'],
    ['claude.ai', 'claude'],
    ['gemini.google.com', 'gemini'],
    ['copilot.microsoft.com', 'copilot'],
    ['www.perplexity.ai', 'perplexity'],
    ['perplexity.ai', 'perplexity'],
    ['chat.deepseek.com', 'deepseek'],
    ['grok.com', 'grok'],
    ['chat.mistral.ai', 'mistral'],
    ['poe.com', 'poe'],
    ['www.meta.ai', 'meta'],
    ['meta.ai', 'meta']
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

  it('matches supported hosts from subdomains without widening to unrelated domains', () => {
    expect(matchesChatSiteHost('www.meta.ai', 'meta.ai')).toBe(true);
    expect(matchesChatSiteHost('app.chatgpt.com', 'chatgpt.com')).toBe(true);
    expect(matchesChatSiteHost('chatgpt.example.com', 'chatgpt.com')).toBe(false);
  });

  it('normalizes unknown hosts into the generic adapter cleanly', () => {
    const adapter = getSiteAdapter('UNSUPPORTED.EXAMPLE');
    expect(adapter.id).toBe('generic');
    expect(adapter.hosts).toEqual(['unsupported.example']);
    expect(adapter.composerSelectors).toContain('textarea');
  });

  it('does not define duplicate adapter ids', () => {
    const ids = CHAT_SITE_ADAPTERS.map((adapter) => adapter.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(['textarea', 'input[type="text"]', '[contenteditable="true"]'])(
    'finds the generic %s composer strategy',
    (expectedSelector) => {
      const adapter = getSiteAdapter('unsupported.example');
      const element = { nodeType: 1 } as unknown as Element;
      const target = {
        closest: (selector: string) => (selector === expectedSelector ? element : null)
      } as Pick<Element, 'closest'>;
      expect(findAdapterComposer(target, adapter)).toBe(element);
    }
  );

  it('returns null when no adapter composer exists', () => {
    const target = { closest: () => null } as Pick<Element, 'closest'>;
    expect(findAdapterComposer(target, getSiteAdapter('chatgpt.com'))).toBeNull();
  });

  it('continues to generic selectors after a stale site-specific selector throws', () => {
    const adapter = getSiteAdapter('chatgpt.com');
    const element = { nodeType: 1 } as unknown as Element;
    const target = {
      closest: (selector: string) => {
        if (selector === '#prompt-textarea') throw new Error('unsupported selector');
        return selector === 'textarea' ? element : null;
      }
    } as Pick<Element, 'closest'>;
    expect(findAdapterComposer(target, adapter)).toBe(element);
  });
});
