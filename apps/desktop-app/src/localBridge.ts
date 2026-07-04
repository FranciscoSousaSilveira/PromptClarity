import { createServer, type Server } from 'node:http';
import { SUPPORTED_CHAT_ORIGINS, isPerformanceMode, isRewriteIntervention } from '../../../config/product';
import { getSelectedLocalModel, resolveLocalOllamaUrl } from '../../../lib/localRewriteService';
import { checkLocalApiHealth } from '../../../lib/localHealth';
import { handleRewriteApiBody, invalidJsonResponse } from '../../../lib/rewriteApi';
import { createRewriteErrorResult } from '../../../lib/rewritePipeline';

const OLLAMA_URL = resolveLocalOllamaUrl();

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
    await fetch('http://127.0.0.1:3000/api/rewrite', { signal: AbortSignal.timeout(1_000) });
    return null;
  } catch {}

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    const headers = responseHeaders(origin);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers);
      response.end();
      return;
    }
    if (request.url?.startsWith('/api/health') && request.method === 'GET') {
      const url = new URL(request.url, 'http://127.0.0.1:3000');
      const modeValue = url.searchParams.get('mode');
      const mode = isPerformanceMode(modeValue) ? modeValue : 'fast';
      const interventionValue = url.searchParams.get('intervention');
      const intervention = isRewriteIntervention(interventionValue) ? interventionValue : 'normal';
      const health = await checkLocalApiHealth({ mode, intervention });
      response.writeHead(health.status === 'ok' ? 200 : 503, headers);
      response.end(JSON.stringify(health));
      return;
    }
    if (request.url?.startsWith('/api/rewrite') && request.method === 'GET') {
      try {
        const url = new URL(request.url, 'http://127.0.0.1:3000');
        const modeValue = url.searchParams.get('mode');
        const mode = isPerformanceMode(modeValue) ? modeValue : 'fast';
        const model = getSelectedLocalModel(mode);
        const tags = (await fetch(`${OLLAMA_URL}/api/tags`).then((result) => result.json())) as {
          models?: Array<{ name?: string }>;
        };
        const installed = tags.models?.some((item) => item.name?.startsWith(model)) || false;
        let warmed: boolean | undefined;
        if (url.searchParams.get('warm') === '1' && installed) {
          const warmResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: AbortSignal.timeout(120_000),
            body: JSON.stringify({
              model,
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
            model,
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
      const startedAt = Date.now();
      try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          const buffer = Buffer.from(chunk);
          size += buffer.length;
          if (size > 100_000) {
            const result = createRewriteErrorResult(
              '',
              'fast',
              'request_too_large',
              'Request body is too large',
              startedAt
            );
            response.writeHead(413, headers);
            response.end(JSON.stringify(result));
            return;
          }
          chunks.push(buffer);
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let body: unknown;
        if (rawBody.trim()) {
          try {
            body = JSON.parse(rawBody) as unknown;
          } catch {
            const invalid = invalidJsonResponse(startedAt);
            response.writeHead(invalid.httpStatus, headers);
            response.end(JSON.stringify(invalid.body));
            return;
          }
        }
        const result = await handleRewriteApiBody(body, undefined, startedAt);
        response.writeHead(result.httpStatus, headers);
        response.end(JSON.stringify(result.body));
      } catch {
        const result = createRewriteErrorResult(
          '',
          'fast',
          'internal_error',
          'Unexpected local API failure',
          startedAt
        );
        response.writeHead(500, headers);
        response.end(JSON.stringify(result));
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
