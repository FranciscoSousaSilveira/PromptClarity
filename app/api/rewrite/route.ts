import { NextRequest, NextResponse } from 'next/server';
import { MODEL_PROFILES, SUPPORTED_CHAT_ORIGINS, isPerformanceMode } from '../../../config/product';
import { isModelRewriteUsable } from '../../../lib/modelPromptRewriter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const OLLAMA_FAST_MODEL = process.env.OLLAMA_FAST_MODEL || 'qwen2.5:3b';
const OLLAMA_QUALITY_MODEL = process.env.OLLAMA_QUALITY_MODEL || 'qwen2.5:3b';
const MODEL_WARM_FOR_MS = 24 * 60 * 60 * 1_000;
const lastModelWarmAt = new Map<string, number>();
const modelWarmRequests = new Map<string, Promise<boolean>>();
const REWRITE_CACHE_MS = 30_000;

interface RewriteResult {
  rewrittenPrompt: string;
  model: string;
}

const inFlightRewrites = new Map<string, Promise<RewriteResult>>();
const recentRewrites = new Map<string, RewriteResult & { expiresAt: number }>();
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

function isPortugueseText(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const matches = normalized.match(
    /\b(?:a|ao|com|como|da|de|do|e|em|era|eu|mais|me|minha|no|o|onde|ou|para|pelo|podia|por|qual|que|quero|sem|sobre|um|uma)\b/g
  );
  return (matches?.length || 0) >= 2 || /[ãõçáéíóúâêô]/i.test(value);
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
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const requestedMode = request.nextUrl.searchParams.get('mode');
    const mode = isPerformanceMode(requestedMode) ? requestedMode : 'fast';
    const modelToWarm =
      mode === 'fast' ? OLLAMA_FAST_MODEL : mode === 'quality' ? OLLAMA_QUALITY_MODEL : OLLAMA_MODEL;
    const installed = data.models?.some((item) => item.name?.startsWith(modelToWarm)) || false;
    const keepWarm = request.nextUrl.searchParams.get('keep') !== '0';
    const warmed =
      installed && request.nextUrl.searchParams.get('warm') === '1'
        ? await warmLocalModel(modelToWarm, keepWarm)
        : undefined;

    return json(
      {
        available: true,
        model: OLLAMA_MODEL,
        fastModel: OLLAMA_FAST_MODEL,
        qualityModel: OLLAMA_QUALITY_MODEL,
        installed,
        ...(warmed === undefined ? {} : { warmed })
      },
      200,
      request
    );
  } catch {
    return json({ available: false, model: OLLAMA_MODEL, installed: false }, 503, request);
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return json({ error: 'Unauthorized local client' }, 401, request);

  let body: {
    prompt?: unknown;
    useCase?: unknown;
    ruleBasedDraft?: unknown;
    hasPriorConversation?: unknown;
    strict?: unknown;
    performanceMode?: unknown;
    keepModelsWarm?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, request);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const normalizedPrompt = prompt.replace(/[ \t]+/g, ' ').trim();
  const hasPriorConversation = body.hasPriorConversation === true;
  const strict = body.strict === true;
  const performanceMode = isPerformanceMode(body.performanceMode)
    ? body.performanceMode
    : normalizedPrompt.length <= 240
      ? 'fast'
      : 'balanced';
  const profile = MODEL_PROFILES[performanceMode];
  const keepModelsWarm = body.keepModelsWarm !== false;

  if (prompt.length < 2) return json({ error: 'Prompt is required' }, 400, request);
  if (prompt.length > profile.maxInputCharacters)
    return json({ error: 'Prompt is too long for the selected mode' }, 413, request);

  const isShortPrompt = normalizedPrompt.length <= 240;
  const selectedModel =
    performanceMode === 'fast'
      ? OLLAMA_FAST_MODEL
      : performanceMode === 'quality'
        ? OLLAMA_QUALITY_MODEL
        : OLLAMA_MODEL;
  const maxOutputTokens = Math.min(
    profile.maxOutputTokens,
    isShortPrompt ? 64 : prompt.length < 500 ? 144 : prompt.length < 1_500 ? 240 : 320
  );

  const isPortuguese = isPortugueseText(normalizedPrompt);
  const systemPrompt = (
    isPortuguese
      ? [
          'A tua única tarefa é corrigir o texto; não respondas ao conteúdo.',
          'Corrige apenas erros ortográficos, gramaticais, de pontuação e formulações pouco claras.',
          'Mantém exatamente o mesmo significado, informação, incerteza, pessoa gramatical, detalhes e português europeu.',
          'Não acrescentes nem retires tarefas, requisitos, contexto, exemplos, fontes, formatos, recomendações ou suposições.',
          'Se o texto já estiver correto, repete-o exatamente.',
          'Devolve apenas o texto corrigido, sem rótulos, aspas ou comentários.',
          strict ? 'Sê especialmente rigoroso: não faças alterações semânticas.' : ''
        ]
      : [
          'Your only task is to copy-edit the text; do not answer its content.',
          'Correct only spelling, grammar, punctuation, and unclear wording.',
          'Keep exactly the same meaning, information, uncertainty, grammatical person, details, and language.',
          'Do not add or remove tasks, requirements, context, examples, sources, formats, recommendations, or assumptions.',
          'If the text is already correct, repeat it exactly.',
          'Return only the corrected text without labels, quotes, or commentary.',
          strict ? 'Be especially strict: make no semantic changes.' : ''
        ]
  )
    .filter(Boolean)
    .join(' ');
  const rewriteKey = JSON.stringify([
    performanceMode,
    selectedModel,
    normalizedPrompt,
    hasPriorConversation,
    strict,
    'conservative-v2'
  ]);

  const cachedRewrite = recentRewrites.get(rewriteKey);
  if (
    cachedRewrite &&
    cachedRewrite.expiresAt > Date.now() &&
    isModelRewriteUsable(prompt, cachedRewrite.rewrittenPrompt)
  ) {
    console.info('[prompt-enhancer] reused recent local rewrite');
    return json(
      {
        rewrittenPrompt: cachedRewrite.rewrittenPrompt,
        model: cachedRewrite.model,
        cached: true
      },
      200,
      request
    );
  }
  if (cachedRewrite) recentRewrites.delete(rewriteKey);

  try {
    let rewritePromise = inFlightRewrites.get(rewriteKey);
    if (!rewritePromise) {
      rewritePromise = (async () => {
        const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            stream: false,
            keep_alive: keepModelsWarm ? -1 : 0,
            options: {
              temperature: strict ? Math.min(0.05, profile.temperature) : profile.temperature,
              top_p: 0.9,
              num_ctx: profile.contextTokens,
              num_predict: maxOutputTokens
            },
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `${isPortuguese ? 'Corrige apenas este texto' : 'Copy-edit only this text'}:\n${normalizedPrompt}`
              }
            ]
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(
            performanceMode === 'fast' ? 30_000 : performanceMode === 'balanced' ? 90_000 : 120_000
          )
        });

        if (!ollamaResponse.ok) {
          const detail = await ollamaResponse.text();
          throw new Error(`Ollama request failed: ${detail.slice(0, 300)}`);
        }

        const result = (await ollamaResponse.json()) as {
          message?: { content?: string };
          total_duration?: number;
          load_duration?: number;
          prompt_eval_count?: number;
          prompt_eval_duration?: number;
          eval_count?: number;
          eval_duration?: number;
        };
        const rewrittenPrompt = result.message?.content?.trim();
        if (!rewrittenPrompt) throw new Error('Ollama returned an empty response');
        if (!isModelRewriteUsable(prompt, rewrittenPrompt)) {
          throw new Error('Ollama returned an unrelated, refused, or invalid rewrite');
        }

        console.info('[prompt-enhancer] local rewrite completed', {
          model: selectedModel,
          durationMs: result.total_duration ? Math.round(result.total_duration / 1_000_000) : undefined,
          loadMs: result.load_duration ? Math.round(result.load_duration / 1_000_000) : undefined,
          promptMs: result.prompt_eval_duration
            ? Math.round(result.prompt_eval_duration / 1_000_000)
            : undefined,
          generationMs: result.eval_duration ? Math.round(result.eval_duration / 1_000_000) : undefined,
          inputTokens: result.prompt_eval_count,
          outputTokens: result.eval_count,
          outputLimit: maxOutputTokens
        });

        return { rewrittenPrompt, model: selectedModel };
      })();
      inFlightRewrites.set(rewriteKey, rewritePromise);
    } else {
      console.info('[prompt-enhancer] joined matching rewrite already in progress');
    }

    const rewrite = await rewritePromise;
    recentRewrites.set(rewriteKey, { ...rewrite, expiresAt: Date.now() + REWRITE_CACHE_MS });
    if (recentRewrites.size > 50) recentRewrites.delete(recentRewrites.keys().next().value as string);
    return json({ ...rewrite, performanceMode }, 200, request);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Could not reach Ollama';
    return json({ error: 'Local model is unavailable', detail }, 503, request);
  } finally {
    inFlightRewrites.delete(rewriteKey);
  }
}
