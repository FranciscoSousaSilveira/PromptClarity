import { NextRequest, NextResponse } from 'next/server';
import type { UseCase } from '../../../types/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

    const data = await response.json() as { models?: Array<{ name?: string }> };
    return json({
      available: true,
      model: OLLAMA_MODEL,
      installed: data.models?.some(item => item.name?.startsWith(OLLAMA_MODEL)) || false
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
    'You improve user prompts before they are sent to another AI.',
    'Return only the improved prompt, with no introduction, quotation marks, markdown fence, explanation, or answer to the prompt.',
    'Preserve the user’s language and intent. Correct spelling, grammar, punctuation, and unclear wording.',
    'Add only useful context, constraints, and output guidance that can be inferred safely.',
    'Do more than proofreading: make the request meaningfully more useful while keeping it concise.',
    'For a short factual question, request a clear overview, the most relevant facts, and why the subject matters.',
    'For a comparison or decision, name the options correctly and request concrete decision criteria and trade-offs.',
    'Treat acronyms, institutions, product names, and course names found in the rule-based candidate as intentional unless clearly impossible.',
    'Never ask for your own preference or opinion; improve what the user should ask the next AI.',
    'When the user writes in Portuguese, use natural European Portuguese.',
    'Never invent personal facts, requirements, dates, sources, or preferences.',
    'Prefer a natural ready-to-send request. Use Role/Context/Task sections only when the original task is genuinely complex.',
    `The selected use case is: ${useCase}.`,
    'Example: "quem e o jfk" becomes "Explica quem foi John F. Kennedy, destacando os principais acontecimentos da sua presidência, o seu impacto histórico e as circunstâncias da sua morte. Apresenta a resposta de forma clara e concisa."'
  ].join(' ');

  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        options: { temperature: 0.2, top_p: 0.9 },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: ruleBasedDraft
              ? `Original draft:\n${prompt}\n\nRule-based candidate (use it to preserve the interpreted intent, then improve its wording):\n${ruleBasedDraft}`
              : prompt
          }
        ]
      }),
      cache: 'no-store'
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
