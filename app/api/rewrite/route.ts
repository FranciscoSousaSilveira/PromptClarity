import { NextRequest, NextResponse } from 'next/server';
import type { UseCase } from '../../../types/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const MODEL_WARM_FOR_MS = 25 * 60 * 1_000;
let lastModelWarmAt = 0;
let modelWarmRequest: Promise<boolean> | null = null;
const ALLOWED_USE_CASES = new Set<UseCase>([
  'general',
  'coding',
  'writing',
  'studying',
  'research',
  'business',
  'imageGeneration'
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

function normalizePortugueseShorthand(value: string): string {
  return value
    .replace(/\bnng\b/gi, 'ninguém')
    .replace(/\bn\s+(?=quero|deve|pode|fica|seja|tem|é\b)/gi, 'não ')
    .replace(/\btp\b[,.]?\s*/gi, '')
    .replace(/\brelatorio\b/gi, 'relatório')
    .replace(/\bpaginas\b/gi, 'páginas')
    .replace(/\bcomecar\b/gi, 'começar')
    .replace(/\bsmallville\b/gi, 'Smallville')
    .replace(/\bcta\b/gi, 'CTA')
    .replace(/\bai\b/gi, 'IA');
}

async function warmLocalModel(): Promise<boolean> {
  if (Date.now() - lastModelWarmAt < MODEL_WARM_FOR_MS) return true;
  if (modelWarmRequest) return modelWarmRequest;

  modelWarmRequest = (async () => {
    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: '',
          stream: false,
          keep_alive: '30m'
        }),
        cache: 'no-store'
      });
      if (!response.ok) return false;
      lastModelWarmAt = Date.now();
      return true;
    } catch {
      return false;
    } finally {
      modelWarmRequest = null;
    }
  })();

  return modelWarmRequest;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

    const data = await response.json() as { models?: Array<{ name?: string }> };
    const installed = data.models?.some(item => item.name?.startsWith(OLLAMA_MODEL)) || false;
    const warmed = installed && request.nextUrl.searchParams.get('warm') === '1'
      ? await warmLocalModel()
      : undefined;

    return json({
      available: true,
      model: OLLAMA_MODEL,
      installed,
      ...(warmed === undefined ? {} : { warmed })
    });
  } catch {
    return json({ available: false, model: OLLAMA_MODEL, installed: false }, 503);
  }
}

export async function POST(request: NextRequest) {
  let body: { prompt?: unknown; useCase?: unknown; ruleBasedDraft?: unknown };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const normalizedPrompt = normalizePortugueseShorthand(prompt);
  const ruleBasedDraft = typeof body.ruleBasedDraft === 'string'
    ? body.ruleBasedDraft.trim().slice(0, 12_000)
    : '';
  const requestedUseCase = typeof body.useCase === 'string' ? body.useCase : 'general';
  const useCase = ALLOWED_USE_CASES.has(requestedUseCase as UseCase)
    ? requestedUseCase as UseCase
    : 'general';

  if (prompt.length < 2) return json({ error: 'Prompt is required' }, 400);
  if (prompt.length > 12_000) return json({ error: 'Prompt is too long' }, 413);

  const systemPrompt = [
    'Rewrite the user draft into a polished, ready-to-send prompt. Return only that prompt: no introduction, quotes, markdown fence, explanation, or answer.',
    'Preserve its language and intent; use European Portuguese when applicable. Correct spelling, grammar, punctuation, unclear wording, and obvious abbreviations.',
    'Preserve specialist terms, brands, titles, acronyms, institutions, and names from the rule-based candidate. Never replace an uncertain term with another concept.',
    'Improve meaningfully, not just cosmetically: add only safely inferred structure, constraints, decision criteria, or output guidance. Never invent facts or preferences.',
    'Convert “AI slop” or detection wording into concrete quality requirements: natural specific prose, varied sentences, no clichés, repetition, or generic filler. Do not promise undetectability.',
    'For long reports, clarify structure, visual presentation, tone, opening, transitions, conclusion, and CTA. Prefer natural prose over Role/Context/Task sections.',
    `Use case: ${useCase}.`
  ].join(' ');

  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        keep_alive: '30m',
        options: {
          temperature: 0.2,
          top_p: 0.9,
          num_ctx: 2048,
          num_predict: 320
        },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: ruleBasedDraft
              ? `Original draft:\n${normalizedPrompt}\n\nRule-based candidate (use it to preserve the interpreted intent, then improve its wording):\n${ruleBasedDraft}`
              : normalizedPrompt
          }
        ]
      }),
      cache: 'no-store',
      signal: request.signal
    });

    if (!ollamaResponse.ok) {
      const detail = await ollamaResponse.text();
      return json({ error: 'Ollama request failed', detail: detail.slice(0, 300) }, 502);
    }

    const result = await ollamaResponse.json() as { message?: { content?: string } };
    const rewrittenPrompt = result.message?.content?.trim();
    if (!rewrittenPrompt) return json({ error: 'Ollama returned an empty response' }, 502);

    return json({ rewrittenPrompt, model: OLLAMA_MODEL });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Could not reach Ollama';
    return json({ error: 'Local model is unavailable', detail }, 503);
  }
}
