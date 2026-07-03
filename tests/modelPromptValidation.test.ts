import { describe, expect, it, vi } from 'vitest';
import { isModelRewriteUsable, rewritePromptWithModel } from '../lib/modelPromptRewriter';

function response(rewrittenPrompt: string) {
  return new Response(JSON.stringify({ rewrittenPrompt }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('conservative model rewrite validation', () => {
  it('accepts corrections that preserve the same request', () => {
    expect(
      isModelRewriteUsable(
        'faz com que o mdoelo corra mais rapido sff',
        'Faz com que o modelo corra mais rápido, por favor.'
      )
    ).toBe(true);
  });

  it('rejects unrelated rewrites', async () => {
    const original = 'torna o programa mais rápido';
    const fetchImpl = vi.fn(async () => response('O meu sistema funciona melhor com internet.'));
    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toBe(original);
  });

  it('calls the model even in fast mode instead of using a case-based rewrite', async () => {
    const original = 'explica como funciona a energia solar';
    const corrected = 'Explica como funciona a energia solar.';
    const fetchImpl = vi.fn(async () => response(corrected));
    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original, preferSpeed: true, performanceMode: 'fast' },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('model');
    expect(result.rewrittenPrompt).toBe(corrected);
  });

  it('rejects a generic course comparison for an enrollment question', async () => {
    const original =
      'A matrícula final é depois do diploma e posso cancelar Mecatrónica nessa fase. Isto vai ser quando?';
    const expanded =
      'Compara Engenharia Aeroespacial e Engenharia Mecatrónica em currículo, empregabilidade e mobilidade.';
    const fetchImpl = vi.fn(async () => response(expanded));
    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toBe(original);
  });

  it('rejects refusals for benign prompts', async () => {
    const original = 'Posso deixar a candidatura à TUM neste estado enquanto espero pelo diploma?';
    const fetchImpl = vi.fn(async () => response('Eu não posso ajudar com isso.'));
    const result = await rewritePromptWithModel(
      { prompt: original, fallbackPrompt: original },
      { fetchImpl: fetchImpl as typeof fetch }
    );

    expect(result.source).toBe('rules');
    expect(result.rewrittenPrompt).toBe(original);
  });

  it('rejects incomplete model output', () => {
    const original = 'Qual era o jogo online de browser onde podia construir casas com blocos?';
    expect(
      isModelRewriteUsable(
        original,
        'O que você está buscando é um jogo online num navegador específico, como'
      )
    ).toBe(false);
  });

  it('rejects added requirements, formats, and recommendations', () => {
    const original = 'Explica as diferenças entre Aeroespacial e Mecatrónica.';
    const expanded =
      'Explica as diferenças entre Aeroespacial e Mecatrónica. Usa fontes atuais, apresenta uma tabela e recomenda o melhor curso.';
    expect(isModelRewriteUsable(original, expanded)).toBe(false);
  });
});
