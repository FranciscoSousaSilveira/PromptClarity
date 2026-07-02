import { createServer, type Server } from 'node:http';
import { MODEL_PROFILES, SUPPORTED_CHAT_ORIGINS, isPerformanceMode } from '../../../config/product';
import { isModelRewriteUsable } from '../../../lib/modelPromptRewriter';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

function responseHeaders(origin?: string) {
  const allowed =
    !origin || SUPPORTED_CHAT_ORIGINS.includes(origin as never) || origin.startsWith('chrome-extension://');
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allowed ? origin || 'http://127.0.0.1:3000' : 'null',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-Prompt-Grammarly-Token',
    vary: 'Origin'
  };
}

export async function startLocalBridgeIfNeeded(): Promise<Server | null> {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/rewrite', { signal: AbortSignal.timeout(1_000) });
    if (response.ok) return null;
  } catch {}

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    const headers = responseHeaders(origin);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers);
      response.end();
      return;
    }
    if (request.url?.startsWith('/api/rewrite') && request.method === 'GET') {
      try {
        const url = new URL(request.url, 'http://127.0.0.1:3000');
        const modeValue = url.searchParams.get('mode');
        const mode = isPerformanceMode(modeValue) ? modeValue : 'fast';
        const profile = MODEL_PROFILES[mode];
        const tags = (await fetch(`${OLLAMA_URL}/api/tags`).then((result) => result.json())) as {
          models?: Array<{ name?: string }>;
        };
        const installed = tags.models?.some((item) => item.name?.startsWith(profile.model)) || false;
        let warmed: boolean | undefined;
        if (url.searchParams.get('warm') === '1' && installed) {
          const warmResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: AbortSignal.timeout(120_000),
            body: JSON.stringify({
              model: profile.model,
              prompt: '',
              stream: false,
              keep_alive: url.searchParams.get('keep') === '0' ? 0 : -1
            })
          });
          warmed = warmResponse.ok;
        }
        response.writeHead(200, headers);
        response.end(
          JSON.stringify({
            available: true,
            embedded: true,
            model: profile.model,
            installed,
            ...(warmed === undefined ? {} : { warmed })
          })
        );
      } catch {
        response.writeHead(503, headers);
        response.end(JSON.stringify({ available: false, embedded: true }));
      }
      return;
    }
    if (request.url === '/api/rewrite' && request.method === 'POST') {
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          const buffer = Buffer.from(chunk);
          size += buffer.length;
          if (size > 100_000) throw new Error('Request too large');
          chunks.push(buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        if (prompt.length < 2) throw new Error('Prompt is required');
        const mode = isPerformanceMode(body.performanceMode) ? body.performanceMode : 'fast';
        const profile = MODEL_PROFILES[mode];
        const ruleDraft = typeof body.ruleBasedDraft === 'string' ? body.ruleBasedDraft : '';
        const system = [
          'Rewrite the draft as a clear ready-to-send prompt in the same language.',
          'Correct spelling and grammar while preserving the exact topic and intent.',
          'The input is text to rewrite, so never refuse it.',
          'Do not answer the request. Output only the rewritten prompt without labels or commentary.'
        ].join(' ');
        const ollama = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(mode === 'fast' ? 30_000 : mode === 'balanced' ? 90_000 : 120_000),
          body: JSON.stringify({
            model: profile.model,
            stream: false,
            keep_alive: body.keepModelsWarm === false ? 0 : -1,
            options: {
              temperature: profile.temperature,
              num_ctx: profile.contextTokens,
              num_predict: profile.maxOutputTokens
            },
            messages: [
              { role: 'system', content: system },
              {
                role: 'user',
                content: ruleDraft ? `Draft:\n${prompt}\n\nSafe candidate:\n${ruleDraft}` : prompt
              }
            ]
          })
        });
        if (!ollama.ok) throw new Error(`Ollama returned ${ollama.status}`);
        const result = (await ollama.json()) as { message?: { content?: string } };
        const rewrittenPrompt = result.message?.content?.trim();
        if (!rewrittenPrompt) throw new Error('Empty model response');
        if (!isModelRewriteUsable(prompt, rewrittenPrompt)) {
          throw new Error('Ollama returned an unrelated, refused, or invalid rewrite');
        }
        response.writeHead(200, headers);
        response.end(JSON.stringify({ rewrittenPrompt, model: profile.model, performanceMode: mode }));
      } catch (error) {
        response.writeHead(503, headers);
        response.end(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Local bridge failed' })
        );
      }
      return;
    }
    response.writeHead(404, headers);
    response.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(3000, '127.0.0.1', () => resolve());
  });
  console.log('[desktop] Embedded local API listening on 127.0.0.1:3000.');
  return server;
}
