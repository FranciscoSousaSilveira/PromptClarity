import type { UseCase } from '../types/prompt';

export const DEFAULT_REWRITE_ENDPOINT = 'http://127.0.0.1:3000/api/rewrite';

export interface ModelRewriteRequest {
  prompt: string;
  useCase?: UseCase;
  fallbackPrompt: string;
}

export interface ModelRewriteResult {
  rewrittenPrompt: string;
  source: 'model' | 'rules';
  model?: string;
  error?: string;
}

interface ModelRewriteOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function cleanModelOutput(value: string): string {
  let cleaned = value.trim();

  if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const wrappingQuote = cleaned.match(/^["“](.*)["”]$/s);
  if (wrappingQuote) cleaned = wrappingQuote[1].trim();

  cleaned = cleaned
    .replace(/\bnng\b/gi, 'ninguém')
    .replace(/\bn\s+(?=quero|deve|pode|fica|seja|tem|é\b)/gi, 'não ')
    .replace(/\btp\b[,.]?\s*/gi, '')
    .replace(/\brelatorio\b/gi, 'relatório')
    .replace(/\bpaginas\b/gi, 'páginas')
    .replace(/\bcomecar\b/gi, 'começar')
    .replace(/\bsmallville\b/gi, 'Smallville')
    .replace(/\bcta\b/gi, 'CTA')
    .replace(/\bai\b/gi, 'IA');

  return cleaned;
}

function isUsableRewrite(original: string, rewritten: string): boolean {
  if (rewritten.length < 3 || rewritten.length > 8_000) return false;
  if (/^(I cannot|I can't|As an AI|Não posso|Como (?:um|uma) IA)\b/i.test(rewritten)) return false;

  // A rewrite may be longer, but a huge response is usually the model answering
  // the prompt instead of improving it.
  const reasonableLimit = Math.max(1_200, original.length * 8);
  return rewritten.length <= reasonableLimit;
}

export async function rewritePromptWithModel(
  request: ModelRewriteRequest,
  options: ModelRewriteOptions = {}
): Promise<ModelRewriteResult> {
  const endpoint = options.endpoint || DEFAULT_REWRITE_ENDPOINT;
  // Small local models can take longer on their first request while weights
  // are loaded into memory. Subsequent requests are normally much faster.
  const timeoutMs = options.timeoutMs ?? 120_000;
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        useCase: request.useCase || 'general',
        ruleBasedDraft: request.fallbackPrompt
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Local model service returned ${response.status}`);
    }

    const payload = await response.json() as {
      rewrittenPrompt?: unknown;
      model?: unknown;
      error?: unknown;
    };
    const rewritten = cleanModelOutput(
      typeof payload.rewrittenPrompt === 'string' ? payload.rewrittenPrompt : ''
    );

    if (!isUsableRewrite(request.prompt, rewritten)) {
      throw new Error('The model returned an invalid or excessively long rewrite');
    }

    return {
      rewrittenPrompt: rewritten,
      source: 'model',
      model: typeof payload.model === 'string' ? payload.model : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown local model error';
    return {
      rewrittenPrompt: request.fallbackPrompt,
      source: 'rules',
      error: message
    };
  } finally {
    clearTimeout(timeout);
  }
}
