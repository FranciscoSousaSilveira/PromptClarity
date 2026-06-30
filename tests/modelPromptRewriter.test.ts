import { describe, expect, it, vi } from 'vitest';
import { rewritePromptWithModel } from '../lib/modelPromptRewriter';

describe('rewritePromptWithModel', () => {
  it('returns a cleaned model rewrite', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt: '```text\nExplica quem foi JFK em cinco pontos claros.\n```',
            model: 'qwen2.5:3b'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'quem e jfk',
        useCase: 'general',
        fallbackPrompt: 'fallback'
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('model');
    expect(result.rewrittenPrompt).toBe('Explica quem foi JFK em cinco pontos claros.');
    expect(result.model).toBe('qwen2.5:3b');
  });

  it('expands common Portuguese shorthand left in a model response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt:
              'Cria um relatorio de 10 paginas sobre smallville; n quero texto genérico e nng deve encontrar repetições. Termina com um cta.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'relatorio smallville',
        fallbackPrompt: 'fallback'
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.rewrittenPrompt).toContain('relatório de 10 páginas sobre Smallville');
    expect(result.rewrittenPrompt).toContain('não quero');
    expect(result.rewrittenPrompt).toContain('ninguém');
    expect(result.rewrittenPrompt).toContain('CTA');
  });

  it('preserves a request for more names from the earlier conversation', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt: 'Diga-me alguns nomes divertidos.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'diz me mais nomes mais brincalhoes',
        fallbackPrompt: 'Diz-me mais nomes brincalhões.',
        hasPriorConversation: true
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.rewrittenPrompt).toContain('nomes sugeridos anteriormente');
    expect(result.rewrittenPrompt).toContain('mais opções');
    expect(result.rewrittenPrompt).toContain('tom brincalhão');
    expect(result.rewrittenPrompt).toContain('breve explicação');
  });

  it('does not invent previous context in a new conversation', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt:
              'Com base no contexto anterior, pergunta: Quais são as estâncias de esqui mais próximas do município?'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'Quais são as estâncias de esqui mais próximas do município?',
        fallbackPrompt: 'Quais são as estâncias de esqui mais próximas do município?',
        hasPriorConversation: false
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.rewrittenPrompt).toBe('Quais são as estâncias de esqui mais próximas do município?');
    expect(result.rewrittenPrompt).not.toContain('contexto anterior');
  });

  it('makes a more-names request standalone when no previous messages exist', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt: 'Diga-me alguns nomes divertidos.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'diz me mais nomes mais brincalhoes',
        fallbackPrompt: 'Diz-me mais nomes brincalhões.',
        hasPriorConversation: false
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.rewrittenPrompt).toContain('Apresenta opções de nomes');
    expect(result.rewrittenPrompt).not.toContain('anteriormente');
  });

  it('uses the rules fallback when the service is offline', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connection refused');
    });

    const result = await rewritePromptWithModel(
      {
        prompt: 'quem e jfk',
        fallbackPrompt: 'Responde à pergunta: “Quem foi JFK?”'
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toContain('Quem foi JFK');
    expect(result.error).toContain('connection refused');
  });

  it('rejects a model answer that is implausibly long', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt: 'A'.repeat(2_000)
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'olá',
        fallbackPrompt: 'Melhora esta saudação.'
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toBe('Melhora esta saudação.');
  });
});
