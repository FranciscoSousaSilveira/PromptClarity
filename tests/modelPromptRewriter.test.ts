import { describe, expect, it, vi } from 'vitest';
import { rewritePromptWithModel } from '../lib/modelPromptRewriter';

describe('rewritePromptWithModel', () => {
  it('returns a cleaned model rewrite', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      rewrittenPrompt: '```text\nExplica quem foi JFK em cinco pontos claros.\n```',
      model: 'qwen2.5:3b'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await rewritePromptWithModel({
      prompt: 'quem e jfk',
      useCase: 'general',
      fallbackPrompt: 'fallback'
    }, { fetchImpl: fetchImpl as typeof fetch });

    expect(result.source).toBe('model');
    expect(result.rewrittenPrompt).toBe('Explica quem foi JFK em cinco pontos claros.');
    expect(result.model).toBe('qwen2.5:3b');
  });

  it('uses the rules fallback when the service is offline', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('connection refused'); });

    const result = await rewritePromptWithModel({
      prompt: 'quem e jfk',
      fallbackPrompt: 'Responde à pergunta: “Quem foi JFK?”'
    }, { fetchImpl: fetchImpl as typeof fetch });

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toContain('Quem foi JFK');
    expect(result.error).toContain('connection refused');
  });

  it('rejects a model answer that is implausibly long', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      rewrittenPrompt: 'A'.repeat(2_000)
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const result = await rewritePromptWithModel({
      prompt: 'olá',
      fallbackPrompt: 'Melhora esta saudação.'
    }, { fetchImpl: fetchImpl as typeof fetch });

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toBe('Melhora esta saudação.');
  });
});
