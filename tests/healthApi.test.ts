import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { checkLocalApiHealth } from '../lib/localHealth';
import { GET } from '../app/api/health/route';
import type { LocalApiHealth } from '../types/health';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OLLAMA_URL;
});

describe('local Ollama health check', () => {
  it('returns a valid reachable health object without running a rewrite', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ models: [] }), { status: 200 }));
    const health = await checkLocalApiHealth({ fetchImpl: fetchImpl as typeof fetch, mode: 'balanced' });

    expect(health).toEqual({
      status: 'ok',
      api: 'ok',
      ollama: {
        status: 'ok',
        url: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        reachable: true,
        latencyMs: expect.any(Number)
      },
      config: { mode: 'balanced', intervention: 'normal', keepAlive: null, prewarmEnabled: null },
      lastError: null
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('returns degraded when Ollama is unreachable', async () => {
    const health = await checkLocalApiHealth({
      fetchImpl: vi.fn(async () => {
        throw new Error('connection refused with private detail');
      }) as typeof fetch
    });

    expect(health.status).toBe('degraded');
    expect(health.ollama).toMatchObject({
      status: 'unreachable',
      reachable: false,
      error: 'Ollama is unreachable'
    });
    expect(health.lastError).toBe('Ollama is unreachable');
    expect(JSON.stringify(health)).not.toContain('private detail');
  });

  it('returns error when the local Ollama HTTP endpoint responds with an error', async () => {
    const health = await checkLocalApiHealth({
      fetchImpl: vi.fn(async () => new Response('', { status: 500 })) as typeof fetch
    });

    expect(health.status).toBe('error');
    expect(health.ollama).toMatchObject({ status: 'error', reachable: true });
    expect(health.lastError).toBe('Ollama returned HTTP 500');
  });

  it('times out quickly even if the fetch implementation never settles', async () => {
    const fetchImpl = vi.fn(() => new Promise<Response>(() => undefined));
    const startedAt = Date.now();
    const health = await checkLocalApiHealth({
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 10
    });

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(health.status).toBe('degraded');
    expect(health.ollama.error).toBe('Ollama health check timed out');
  });

  it('ignores an external Ollama URL and uses the safe loopback default', async () => {
    process.env.OLLAMA_URL = 'https://external.example/ollama';
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const health = await checkLocalApiHealth({
      fetchImpl: fetchImpl as typeof fetch
    });

    expect(health.ollama.url).toBe('http://127.0.0.1:11434');
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:11434/api/tags', expect.any(Object));
  });
});

describe('GET /api/health', () => {
  it('returns the documented health object from the route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 }))
    );
    const request = new NextRequest('http://127.0.0.1:3000/api/health?mode=quality');
    const response = await GET(request);
    const body = (await response.json()) as LocalApiHealth;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.api).toBe('ok');
    expect(body.ollama.reachable).toBe(true);
    expect(body.config.mode).toBe('quality');
    expect(body.lastError).toBeNull();
  });

  it('returns a normalized degraded object and 503 when Ollama is offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    const response = await GET(new NextRequest('http://127.0.0.1:3000/api/health'));
    const body = (await response.json()) as LocalApiHealth;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: 'degraded',
      api: 'ok',
      ollama: { status: 'unreachable', reachable: false },
      lastError: 'Ollama is unreachable'
    });
  });
});
