import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectLocalDiagnostics,
  createRewriteDiagnostics,
  describeRewriteDiagnostic,
  formatDiagnosticsReport
} from '../lib/diagnostics';
import type { LocalApiHealth } from '../types/health';

afterEach(() => {
  vi.restoreAllMocks();
});

function health(overrides: Partial<LocalApiHealth> = {}): LocalApiHealth {
  return {
    status: 'ok',
    api: 'ok',
    ollama: {
      status: 'ok',
      url: 'http://127.0.0.1:11434',
      model: 'qwen2.5:3b',
      reachable: true,
      latencyMs: 4
    },
    config: {
      mode: 'fast',
      intervention: 'normal',
      keepAlive: null,
      prewarmEnabled: null
    },
    lastError: null,
    ...overrides
  };
}

describe('shared local diagnostics', () => {
  it('combines health, config, storage counts and prompt-free rewrite metadata', async () => {
    const privatePrompt = 'PRIVATE PROMPT CONTENT';
    const rewrite = createRewriteDiagnostics({
      status: 'fallback',
      latencyMs: 37,
      source: 'local_fallback',
      validation: { passed: false, reason: 'model_unavailable' },
      original: privatePrompt
    } as Parameters<typeof createRewriteDiagnostics>[0] & { original: string });
    const diagnostics = await collectLocalDiagnostics({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(health()), { status: 200 })) as typeof fetch,
      mode: 'balanced',
      intervention: 'polished',
      historyEnabled: false,
      historyCount: 0,
      feedbackCount: 2,
      keepAlive: true,
      prewarmEnabled: true,
      rewrite
    });

    expect(diagnostics).toMatchObject({
      api: { status: 'ok', url: 'http://127.0.0.1:3000/api/health', lastError: null },
      ollama: { status: 'ok', model: 'qwen2.5:3b', reachable: true },
      rewrite: {
        lastStatus: 'fallback',
        lastLatencyMs: 37,
        lastSource: 'local_fallback',
        lastValidationReason: 'model_unavailable',
        fallbackUsed: true
      },
      config: {
        mode: 'balanced',
        intervention: 'polished',
        historyEnabled: false,
        keepAlive: true,
        prewarmEnabled: true
      },
      storage: { historyEnabled: false, historyCount: 0, feedbackCount: 2 }
    });
    expect(JSON.stringify(diagnostics)).not.toContain(privatePrompt);
    expect(formatDiagnosticsReport(diagnostics).join('\n')).not.toContain(privatePrompt);
  });

  it('distinguishes an online API with offline Ollama', async () => {
    const offline = health({
      status: 'degraded',
      ollama: {
        status: 'unreachable',
        url: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
        reachable: false,
        latencyMs: 8,
        error: 'Ollama is unreachable'
      },
      lastError: 'Ollama is unreachable'
    });
    const diagnostics = await collectLocalDiagnostics({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify(offline), { status: 503 })) as typeof fetch
    });

    expect(diagnostics.api.status).toBe('degraded');
    expect(diagnostics.ollama.status).toBe('unreachable');
    expect(diagnostics.api.lastError).toBe('Ollama is unreachable');
  });

  it('normalizes API failures without exposing raw errors or stack traces', async () => {
    const diagnostics = await collectLocalDiagnostics({
      fetchImpl: vi.fn(async () => {
        throw new Error('private filesystem detail\n    at secret/path.ts:10');
      }) as typeof fetch
    });
    const serialized = JSON.stringify(diagnostics);

    expect(diagnostics.api).toMatchObject({ status: 'error', lastError: 'Local API is offline' });
    expect(serialized).not.toContain('private filesystem detail');
    expect(serialized).not.toContain('secret/path');
  });

  it('times out quickly when a health request never settles', async () => {
    const startedAt = Date.now();
    const diagnostics = await collectLocalDiagnostics({
      fetchImpl: vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch,
      timeoutMs: 10
    });

    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(diagnostics.api.lastError).toBe('Local API health check timed out');
  });

  it('refuses external diagnostics URLs', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(health()), { status: 200 }));
    await collectLocalDiagnostics({
      fetchImpl: fetchImpl as typeof fetch,
      apiUrl: 'https://example.com/health'
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:3000\/api\/health\?/),
      expect.any(Object)
    );
  });

  it('provides friendly Chrome diagnostics for API and Ollama failures', () => {
    expect(describeRewriteDiagnostic('local_service_unavailable')).toContain('Local API unavailable');
    expect(describeRewriteDiagnostic('model_unavailable')).toContain('Ollama');
  });

  it('declares the VS Code diagnostics command', () => {
    const manifest = JSON.parse(readFileSync('extension/package.json', 'utf8')) as {
      contributes?: { commands?: Array<{ command?: string }> };
    };
    expect(manifest.contributes?.commands).toContainEqual(
      expect.objectContaining({ command: 'prompt-enhancement.showDiagnostics' })
    );
  });
});
