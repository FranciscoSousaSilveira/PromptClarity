import { describe, expect, it, vi } from 'vitest';
import { rewritePromptWithModel } from '../lib/modelPromptRewriter';

describe('model rewrite validation', () => {
  it('rejects an unrelated short rewrite immediately', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            rewrittenPrompt:
              'Resposta corrigida: Meu sistema funciona melhor quando estou conectado a internet.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'torna mais rapido e ainda nao consegui meter a funcionar sem ter de selecionar tudo',
        fallbackPrompt: 'Torna o sistema mais rapido.'
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toBe('Torna o sistema mais rapido.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0][1]?.body as string).strict).toBe(true);
  });

  it('understands a misspelled request to make the model respond faster', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt: 'Por favor, tente responder mais rapido.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'faz com que o mdoelo corra mais rapido sff',
        fallbackPrompt: 'Faz com que o modelo responda mais rapidamente, por favor.'
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('model');
    expect(result.rewrittenPrompt).toContain('responder mais');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('preserves a request to pre-warm the model instead of inventing a name', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt: 'Para evitar que o modelo Anreze espere, pode considerar uma estrategia rapida.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt:
          'ha forma de aquecer o modelo anres de ter de usar para nao ter tanto tempo de espera? se sim faz la',
        fallbackPrompt: 'Ha forma de aquecer o modelo antes de o usar?'
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toContain('pré-aquecer o modelo');
    expect(result.rewrittenPrompt).toContain('automaticamente ao iniciar a aplicação');
    expect(result.rewrittenPrompt).not.toContain('Anreze');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses the instant safe rewrite for short prompts in speed mode', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            rewrittenPrompt: 'This response should never be used.'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      {
        prompt: 'explica como funciona a energia solar',
        fallbackPrompt: 'Explica como funciona a energia solar de forma clara.',
        preferSpeed: true
      },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toContain('energia solar');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
