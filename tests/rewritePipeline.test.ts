import { describe, expect, it, vi } from 'vitest';
import { resolveLocalOllamaUrl } from '../lib/localRewriteService';
import { runRewritePipeline } from '../lib/rewritePipeline';

describe('shared rewrite pipeline', () => {
  it('never allows Ollama configuration to leave the local machine', () => {
    expect(resolveLocalOllamaUrl('http://localhost:11434')).toBe('http://localhost:11434');
    expect(resolveLocalOllamaUrl('http://127.0.0.1:22114/api')).toBe('http://127.0.0.1:22114');
    expect(resolveLocalOllamaUrl('https://example.com/ollama')).toBe('http://127.0.0.1:11434');
  });

  it('returns a normalized changed result for a valid model correction', async () => {
    const model = vi.fn(async () => ({
      rewritten: 'Faz com que o modelo corra mais rápido, por favor.',
      model: 'qwen2.5:3b'
    }));

    const result = await runRewritePipeline(
      { prompt: 'faz com que o mdoelo corra mais rapido sff', performanceMode: 'fast' },
      model
    );

    expect(result).toMatchObject({
      status: 'changed',
      original: 'faz com que o mdoelo corra mais rapido sff',
      rewritten: 'Faz com que o modelo corra mais rápido, por favor.',
      source: 'model',
      mode: 'fast',
      validation: { passed: true, reason: 'model_output_valid' },
      model: 'qwen2.5:3b'
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns no_change and preserves the original text when it is already clear', async () => {
    const original = 'Explain photosynthesis in simple terms.';
    const result = await runRewritePipeline({ prompt: original }, async () => ({ rewritten: original }));

    expect(result.status).toBe('no_change');
    expect(result.source).toBe('checkmark');
    expect(result.original).toBe(original);
    expect(result.rewritten).toBe(original);
    expect(result.validation.passed).toBe(true);
  });

  it('rejects invalid model output and returns the conservative local fallback', async () => {
    const original = 'quem e jfk';
    const result = await runRewritePipeline({ prompt: original }, async () => ({
      rewritten: 'Aqui está uma biografia detalhada de John F. Kennedy com fontes.'
    }));

    expect(result.status).toBe('fallback');
    expect(result.source).toBe('local_fallback');
    expect(result.rewritten).toBe('Quem e jfk');
    expect(result.validation).toEqual({ passed: false, reason: 'assistant_preface' });
    expect(result.error).toContain('assistant_preface');
  });

  it('uses the same safe fallback when Ollama is unavailable', async () => {
    const result = await runRewritePipeline({ prompt: 'diz me mais nomes brincalhoes' }, async () => {
      throw new Error('connection refused');
    });

    expect(result.status).toBe('fallback');
    expect(result.source).toBe('local_fallback');
    expect(result.validation).toEqual({ passed: false, reason: 'model_unavailable' });
    expect(result.error).toBe('Local model is unavailable');
  });

  it('returns a safe normalized error without calling the model for invalid input', async () => {
    const model = vi.fn(async () => ({ rewritten: 'unused' }));
    const result = await runRewritePipeline({ prompt: '' }, model);

    expect(model).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'error',
      original: '',
      rewritten: '',
      source: 'error',
      mode: 'fast',
      validation: { passed: false, reason: 'prompt_required' },
      error: 'Prompt is required'
    });
  });

  it('retries a rejected long rewrite in strict mode inside the central pipeline', async () => {
    const original = `${'Explica cuidadosamente o funcionamento deste sistema local. '.repeat(6)}`.trim();
    const model = vi
      .fn()
      .mockResolvedValueOnce({ rewritten: 'Aqui está a resposta completa.' })
      .mockResolvedValueOnce({ rewritten: original });

    const result = await runRewritePipeline({ prompt: original }, model);

    expect(model).toHaveBeenCalledTimes(2);
    expect(model.mock.calls[0][0].safetyRetry).toBe(false);
    expect(model.mock.calls[1][0].safetyRetry).toBe(true);
    expect(result.status).toBe('no_change');
  });
});
