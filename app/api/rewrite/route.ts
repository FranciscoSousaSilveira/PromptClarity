import { NextRequest, NextResponse } from 'next/server';
import { SUPPORTED_CHAT_ORIGINS, isPerformanceMode } from '../../../config/product';
import { getSelectedLocalModel, resolveLocalOllamaUrl } from '../../../lib/localRewriteService';
import { handleRewriteApiBody, invalidJsonResponse } from '../../../lib/rewriteApi';
import {
  createRewriteErrorResult,
  normalizeRewriteIntervention,
  normalizeRewriteMode
} from '../../../lib/rewritePipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = resolveLocalOllamaUrl();
const MODEL_WARM_FOR_MS = 24 * 60 * 60 * 1_000;
const lastModelWarmAt = new Map<string, number>();
const modelWarmRequests = new Map<string, Promise<boolean>>();
const allowedOrigins = new Set<string>(SUPPORTED_CHAT_ORIGINS);

function corsHeaders(request?: NextRequest) {
  const origin = request?.headers.get('origin');
  const allowedOrigin =
    !origin || allowedOrigins.has(origin) || origin.startsWith('chrome-extension://')
      ? origin || 'http://127.0.0.1:3000'
      : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Prompt-Grammarly-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(body: unknown, status = 200, request?: NextRequest) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

function isAuthorized(request: NextRequest): boolean {
  const expectedToken = process.env.PROMPT_GRAMMARLY_TOKEN;
  return !expectedToken || request.headers.get('x-prompt-grammarly-token') === expectedToken;
}

async function warmLocalModel(model: string, keepWarm: boolean): Promise<boolean> {
  if (keepWarm && Date.now() - (lastModelWarmAt.get(model) || 0) < MODEL_WARM_FOR_MS) return true;
  const existing = modelWarmRequests.get(model);
  if (existing) return existing;

  const request = (async () => {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: '', stream: false, keep_alive: keepWarm ? -1 : 0 }),
        cache: 'no-store'
      });
      if (!response.ok) return false;
      if (keepWarm) lastModelWarmAt.set(model, Date.now());
      else lastModelWarmAt.delete(model);
      return true;
    } catch {
      return false;
    } finally {
      modelWarmRequests.delete(model);
    }
  })();
  modelWarmRequests.set(model, request);
  return request;
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const requestedMode = request.nextUrl.searchParams.get('mode');
  const mode = isPerformanceMode(requestedMode) ? requestedMode : 'fast';
  const modelToWarm = getSelectedLocalModel(mode);
  const model = getSelectedLocalModel('balanced');
  const fastModel = getSelectedLocalModel('fast');
  const qualityModel = getSelectedLocalModel('quality');
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const installed = data.models?.some((item) => item.name?.startsWith(modelToWarm)) || false;
    const keepWarm = request.nextUrl.searchParams.get('keep') !== '0';
    const warmed =
      installed && request.nextUrl.searchParams.get('warm') === '1'
        ? await warmLocalModel(modelToWarm, keepWarm)
        : undefined;

    return json(
      {
        available: true,
        model,
        fastModel,
        qualityModel,
        installed,
        ...(warmed === undefined ? {} : { warmed })
      },
      200,
      request
    );
  } catch {
    return json({ available: false, model, fastModel, qualityModel, installed: false }, 503, request);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    const invalid = invalidJsonResponse(startedAt);
    return json(invalid.body, invalid.httpStatus, request);
  }

  let body: unknown;
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      const invalid = invalidJsonResponse(startedAt);
      return json(invalid.body, invalid.httpStatus, request);
    }
  }

  if (!isAuthorized(request)) {
    const payload =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : undefined;
    const candidate = payload
      ? Object.prototype.hasOwnProperty.call(payload, 'text')
        ? payload.text
        : payload.prompt
      : undefined;
    const original = typeof candidate === 'string' ? candidate : '';
    const mode = normalizeRewriteMode(payload?.performanceMode ?? payload?.mode, original);
    const intervention = normalizeRewriteIntervention(payload?.intervention);
    return json(
      createRewriteErrorResult(
        original,
        mode,
        'unauthorized',
        'Unauthorized local client',
        startedAt,
        intervention
      ),
      401,
      request
    );
  }

  const result = await handleRewriteApiBody(body, undefined, startedAt);
  return json(result.body, result.httpStatus, request);
}
