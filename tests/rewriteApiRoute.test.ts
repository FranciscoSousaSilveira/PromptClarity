import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { RewritePipelineInput, RewriteResult } from '../types/rewrite';
import { runRewritePipeline } from '../lib/rewritePipeline';

const rewriteMock = vi.hoisted(() => vi.fn<(input: RewritePipelineInput) => Promise<RewriteResult>>());

vi.mock('../lib/localRewriteService', async () => {
  const actual = await vi.importActual<typeof import('../lib/localRewriteService')>(
    '../lib/localRewriteService'
  );
  return { ...actual, rewritePromptLocally: rewriteMock };
});

import { POST } from '../app/api/rewrite/route';

function request(body?: unknown, raw = false): NextRequest {
  return new NextRequest('http://127.0.0.1:3000/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: raw ? String(body) : JSON.stringify(body) })
  });
}

function result(overrides: Partial<RewriteResult> = {}): RewriteResult {
  return {
    status: 'changed',
    original: 'explica este erro',
    rewritten: 'Explica este erro.',
    source: 'model',
    latencyMs: 5,
    mode: 'fast',
    validation: { passed: true, reason: 'model_output_valid' },
    model: 'qwen2.5:3b',
    ...overrides,
    intervention: overrides.intervention ?? 'normal'
  };
}

async function responseBody(response: Response): Promise<RewriteResult> {
  return (await response.json()) as RewriteResult;
}

describe('POST /api/rewrite', () => {
  beforeEach(() => {
    rewriteMock.mockReset();
    delete process.env.PROMPT_GRAMMARLY_TOKEN;
  });

  afterEach(() => {
    delete process.env.PROMPT_GRAMMARLY_TOKEN;
  });

  it('returns the normalized shape for a valid rewrite', async () => {
    rewriteMock.mockResolvedValue(result());
    const response = await POST(request({ text: 'explica este erro', performanceMode: 'fast' }));
    const body = await responseBody(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'changed',
      original: 'explica este erro',
      rewritten: 'Explica este erro.',
      source: 'model',
      mode: 'fast',
      intervention: 'normal',
      validation: { passed: true, reason: 'model_output_valid' }
    });
    expect(body.latencyMs).toEqual(expect.any(Number));
    expect(rewriteMock).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'explica este erro', performanceMode: 'fast' })
    );
  });

  it('returns no_change and preserves the exact original input', async () => {
    const original = 'Explica este exercício em português de Portugal.';
    rewriteMock.mockResolvedValue(
      result({
        status: 'no_change',
        original,
        rewritten: original,
        source: 'checkmark',
        validation: { passed: true, reason: 'model_output_unchanged' }
      })
    );

    const body = await responseBody(await POST(request({ text: original })));
    expect(body.status).toBe('no_change');
    expect(body.original).toBe(original);
    expect(body.rewritten).toBe(original);
  });

  it('returns a local fallback when strict validation rejects the model output', async () => {
    rewriteMock.mockImplementation((input) =>
      runRewritePipeline(input, async () => ({
        rewritten: 'Aqui está uma resposta detalhada com fontes.'
      }))
    );

    const body = await responseBody(await POST(request({ text: 'quem e jfk' })));
    expect(body.status).toBe('fallback');
    expect(body.source).toBe('local_fallback');
    expect(body.original).toBe('quem e jfk');
    expect(body.validation.passed).toBe(false);
    expect(body.validation.reason).toBe('assistant_preface');
  });

  it('returns a safe normalized error if the API execution path throws', async () => {
    rewriteMock.mockRejectedValue(new Error('secret stack or filesystem detail'));
    const response = await POST(request({ text: 'explica este erro' }));
    const body = await responseBody(response);

    expect(response.status).toBe(500);
    expect(body.status).toBe('error');
    expect(body.original).toBe('explica este erro');
    expect(body.validation).toEqual({ passed: false, reason: 'internal_error' });
    expect(body.error).toBe('Unexpected local rewrite failure');
    expect(JSON.stringify(body)).not.toContain('secret stack');
  });

  it('rejects a missing body', async () => {
    const response = await POST(request());
    const body = await responseBody(response);
    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      status: 'error',
      original: '',
      validation: { passed: false, reason: 'missing_body' }
    });
  });

  it('rejects a body without text or the legacy prompt field', async () => {
    const body = await responseBody(await POST(request({ performanceMode: 'fast' })));
    expect(body.validation.reason).toBe('missing_text');
    expect(rewriteMock).not.toHaveBeenCalled();
  });

  it('rejects non-string text', async () => {
    const body = await responseBody(await POST(request({ text: 123 })));
    expect(body.validation.reason).toBe('non_string_text');
    expect(body.status).toBe('error');
  });

  it('rejects empty or whitespace-only text', async () => {
    const body = await responseBody(await POST(request({ text: '   \n  ' })));
    expect(body.original).toBe('   \n  ');
    expect(body.validation.reason).toBe('empty_text');
  });

  it('rejects malformed JSON with a normalized response', async () => {
    const body = await responseBody(await POST(request('{bad json', true)));
    expect(body.validation.reason).toBe('invalid_json');
    expect(body.latencyMs).toEqual(expect.any(Number));
  });

  it('rejects text above the configured mode limit and preserves it', async () => {
    const original = 'a'.repeat(1_501);
    const response = await POST(request({ text: original, performanceMode: 'fast' }));
    const body = await responseBody(response);
    expect(response.status).toBe(413);
    expect(body.original).toBe(original);
    expect(body.validation.reason).toBe('prompt_too_long');
    expect(rewriteMock).not.toHaveBeenCalled();
  });

  it('keeps the legacy prompt field working for existing clients', async () => {
    rewriteMock.mockResolvedValue(result());
    const response = await POST(request({ prompt: 'explica este erro' }));
    expect(response.status).toBe(200);
    expect(rewriteMock).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'explica este erro' }));
  });

  it.each(['strict', 'normal', 'polished'] as const)(
    'accepts the %s intervention independently from performance mode',
    async (intervention) => {
      rewriteMock.mockResolvedValue(result({ intervention }));
      const response = await POST(request({ text: 'explica este erro', mode: 'balanced', intervention }));
      const body = await responseBody(response);

      expect(body.mode).toBe('balanced');
      expect(body.intervention).toBe(intervention);
      expect(rewriteMock).toHaveBeenCalledWith(
        expect.objectContaining({ performanceMode: 'balanced', intervention })
      );
    }
  );

  it('falls back safely to normal for an invalid intervention', async () => {
    rewriteMock.mockResolvedValue(result());
    const body = await responseBody(
      await POST(request({ text: 'explica este erro', intervention: 'maximum' }))
    );

    expect(body.intervention).toBe('normal');
    expect(rewriteMock).toHaveBeenCalledWith(expect.objectContaining({ intervention: 'normal' }));
  });

  it('includes the selected intervention in normalized input errors', async () => {
    const body = await responseBody(await POST(request({ text: '   ', intervention: 'strict' })));
    expect(body.status).toBe('error');
    expect(body.intervention).toBe('strict');
  });

  it('returns a normalized unauthorized response while preserving the original', async () => {
    process.env.PROMPT_GRAMMARLY_TOKEN = 'expected-local-token';
    const response = await POST(request({ text: 'explica este erro' }));
    const body = await responseBody(response);

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      status: 'error',
      original: 'explica este erro',
      rewritten: 'explica este erro',
      source: 'error',
      validation: { passed: false, reason: 'unauthorized' }
    });
    expect(rewriteMock).not.toHaveBeenCalled();
  });
});
