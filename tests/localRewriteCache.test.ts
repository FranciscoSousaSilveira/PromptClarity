import { afterEach, describe, expect, it, vi } from 'vitest';
import { rewritePromptLocally } from '../lib/localRewriteService';

afterEach(() => {
  vi.unstubAllGlobals();
});

function ollamaResponse(rewritten: string): Response {
  return new Response(JSON.stringify({ message: { content: rewritten } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('validated local rewrite cache', () => {
  it('does not cache an invalid model output', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ollamaResponse('Aqui está uma resposta que não é uma correção.'))
      .mockResolvedValueOnce(ollamaResponse('Explica o comportamento único da cache local.'));
    vi.stubGlobal('fetch', fetchImpl);
    const input = {
      prompt: 'explica o comportamento unico da cache local',
      performanceMode: 'fast' as const
    };

    const first = await rewritePromptLocally(input);
    const second = await rewritePromptLocally(input);

    expect(first.status).toBe('fallback');
    expect(second.status).toBe('changed');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not cache model errors but does cache the following valid result', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline detail'))
      .mockResolvedValueOnce(ollamaResponse('Explica a segunda verificação exclusiva da cache.'));
    vi.stubGlobal('fetch', fetchImpl);
    const input = {
      prompt: 'explica a segunda verificacao exclusiva da cache',
      performanceMode: 'fast' as const
    };

    const failed = await rewritePromptLocally(input);
    const valid = await rewritePromptLocally(input);
    const cached = await rewritePromptLocally(input);

    expect(failed.status).toBe('fallback');
    expect(failed.error).toBe('Local model is unavailable');
    expect(valid.status).toBe('changed');
    expect(cached.cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
