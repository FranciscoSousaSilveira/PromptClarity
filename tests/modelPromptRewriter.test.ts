import { describe, expect, it, vi } from 'vitest';
import { rewritePromptWithModel } from '../lib/modelPromptRewriter';

function modelResponse(rewrittenPrompt: string, model = 'qwen2.5:1.5b') {
  return new Response(JSON.stringify({ rewrittenPrompt, model }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('rewritePromptWithModel', () => {
  it('consumes the normalized result returned by the shared API pipeline', async () => {
    const original = 'diz me mais nomes brincalhoes';
    const corrected = 'Diz-me mais nomes brincalhões.';
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: 'changed',
            original,
            rewritten: corrected,
            source: 'model',
            latencyMs: 18,
            mode: 'fast',
            validation: { passed: true, reason: 'model_output_valid' },
            model: 'qwen2.5:3b'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.status).toBe('changed');
    expect(result.source).toBe('model');
    expect(result.rewrittenPrompt).toBe(corrected);
    expect(result.validation).toEqual({ passed: true, reason: 'model_output_valid' });
    expect(result.latencyMs).toBe(18);
  });

  it('accepts a conservative spelling and grammar correction', async () => {
    const original = 'qual era o jogo online no browser ond eu podia contruir casad com blocos?';
    const corrected = 'Qual era o jogo online no browser onde eu podia construir casas com blocos?';
    const fetchImpl = vi.fn(async () => modelResponse(corrected));

    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('model');
    expect(result.rewrittenPrompt).toBe(corrected);
    expect(result.isAlreadyGood).toBe(false);
  });

  it('marks an unchanged clear prompt as already good', async () => {
    const original = 'Explain photosynthesis in simple terms.';
    const fetchImpl = vi.fn(async () => modelResponse(original));

    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('checkmark');
    expect(result.rewrittenPrompt).toBe(original);
    expect(result.status).toBe('no_change');
    expect(result.isAlreadyGood).toBe(true);
  });

  it('does not add conversation context by itself', async () => {
    const original = 'diz me mais nomes brincalhoes';
    const corrected = 'Diz-me mais nomes brincalhões.';
    const fetchImpl = vi.fn(async () => modelResponse(corrected));

    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original, hasPriorConversation: true },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.rewrittenPrompt).toBe(corrected);
    expect(result.rewrittenPrompt).not.toContain('anterior');
    expect(result.rewrittenPrompt).not.toContain('explicação');
  });

  it('rejects invented previous-context labels in a new conversation', async () => {
    const original = 'Quais são as estâncias de esqui mais próximas?';
    const fetchImpl = vi.fn(async () =>
      modelResponse(`Com base no contexto anterior, pergunta: ${original}`)
    );

    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original, hasPriorConversation: false },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.rewrittenPrompt).toBe(original);
    expect(result.status).toBe('fallback');
    expect(result.source).toBe('local_fallback');
    expect(result.isAlreadyGood).toBe(false);
  });

  it('uses the conservative fallback when the service is offline', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connection refused');
    });

    const result = await rewritePromptWithModel(
      { prompt: 'quem e jfk', fallbackPrompt: 'Quem e jfk' },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('local_fallback');
    expect(result.rewrittenPrompt).toBe('Quem e jfk');
    expect(result.error).toContain('connection refused');
  });

  it('rejects semantic additions that were not requested', async () => {
    const original = 'Quem é JFK?';
    const expanded = 'Explica quem foi JFK em cinco pontos, com fontes e uma conclusão.';
    const fetchImpl = vi.fn(async () => modelResponse(expanded));

    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('local_fallback');
    expect(result.rewrittenPrompt).toBe(original);
  });

  it('rejects an implausibly long model answer', async () => {
    const fetchImpl = vi.fn(async () => modelResponse('A'.repeat(2_000)));
    const result = await rewritePromptWithModel(
      { prompt: 'Olá', fallbackPrompt: 'Olá' },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('local_fallback');
    expect(result.rewrittenPrompt).toBe('Olá');
  });
});
