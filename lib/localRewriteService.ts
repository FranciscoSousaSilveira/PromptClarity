import { MODEL_PROFILES, type PerformanceMode, type RewriteIntervention } from '../config/product';
import type { ModelRewriteInput, RewritePipelineInput, RewriteResult } from '../types/rewrite';
import { normalizeRewriteMode, runRewritePipeline } from './rewritePipeline';

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const REWRITE_CACHE_MS = 30_000;

interface CachedRewrite {
  result: RewriteResult;
  expiresAt: number;
}

const inFlightRewrites = new Map<string, Promise<RewriteResult>>();
const recentRewrites = new Map<string, CachedRewrite>();

export function resolveLocalOllamaUrl(value = process.env.OLLAMA_URL): string {
  if (!value) return DEFAULT_OLLAMA_URL;
  try {
    const url = new URL(value);
    const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && loopbackHosts.has(url.hostname)) {
      return url.origin;
    }
  } catch {
    // Invalid or non-HTTP values fall through to the safe local default.
  }
  return DEFAULT_OLLAMA_URL;
}

const OLLAMA_URL = resolveLocalOllamaUrl();

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

export function getSelectedLocalModel(mode: PerformanceMode): string {
  if (mode === 'fast') return process.env.OLLAMA_FAST_MODEL || MODEL_PROFILES.fast.model;
  if (mode === 'quality') return process.env.OLLAMA_QUALITY_MODEL || MODEL_PROFILES.quality.model;
  return process.env.OLLAMA_MODEL || MODEL_PROFILES.balanced.model;
}

export function buildModelSystemPrompt(
  isPortuguese: boolean,
  mode: PerformanceMode,
  intervention: RewriteIntervention,
  safetyRetry: boolean
): string {
  const performanceInstruction = isPortuguese
    ? `Perfil de desempenho: ${mode}. Este perfil afeta apenas os limites de execução, não a segurança semântica.`
    : `Performance profile: ${mode}. This profile affects only runtime limits, not semantic safety.`;
  const interventionInstruction = isPortuguese
    ? intervention === 'strict'
      ? 'Intervenção estrita: corrige apenas erros superficiais evidentes e preserva ao máximo as palavras e a estrutura originais; evita reformular.'
      : intervention === 'polished'
        ? 'Intervenção polida: melhora a fluidez e torna a formulação mais natural, mas preserva rigorosamente intenção, factos, idioma, nível de detalhe e marcadores de incerteza. Nunca transformes incerteza em certeza: mantém ou reformula com segurança expressões como “acho”, “talvez”, “pode”, “parece”, “provavelmente” e semelhantes.'
        : intervention === 'enhanced'
          ? 'Intervenção melhorada: atua como especialista em engenharia de prompts. Transforma pedidos vagos e genéricos em prompts claros, estruturados, com especificações acionáveis, tom e formato adequados para um modelo de IA, mantendo o objetivo central do utilizador.'
          : 'Intervenção normal: melhora a clareza de forma conservadora, preservando a intenção e o nível de detalhe.'
    : intervention === 'strict'
      ? 'Strict intervention: correct only obvious surface errors and preserve the original words and structure as much as possible; avoid rephrasing.'
      : intervention === 'polished'
        ? 'Polished intervention: improve fluency and make the wording smoother, while strictly preserving intent, facts, language, detail level, and uncertainty markers. Never turn uncertainty into certainty: keep or safely rephrase markers such as “I think”, “maybe”, “may”, “might”, “seems”, “probably”, and similar wording.'
        : intervention === 'enhanced'
          ? 'Enhanced intervention: act as an expert prompt engineer. Transform vague, generic requests into clear, well-structured, actionable prompts with key criteria, tone, and format for an AI assistant, while preserving the user core intent.'
          : 'Normal intervention: improve clarity conservatively while preserving intent and detail level.';

  if (intervention === 'enhanced') {
    return (
      isPortuguese
        ? [
            'És um especialista em engenharia de prompts para IA. A tua tarefa é otimizar prompts para serem claros, estruturados e eficazes para um assistente de IA.',
            'Regra crítica de modalidade da intenção:',
            '1. Se o utilizador pede uma EXPLICAÇÃO, TUTORIAL ou GUIA ("explica", "como posso", "ensina-me", "explica como"), o prompt DEVE pedir uma explicação detalhada (ex: "Explica passo a passo como construir...", "Fornece um guia com boas práticas para..."). NUNCA transformes um pedido de explicação num comando de criação direta.',
            '2. Se o utilizador pede para CRIAR ou GERAR diretamente ("cria", "faz uma apresentação", "escreve código", "desenvolve"), aí sim usa comandos de criação direta ("Cria...", "Desenvolve...").',
            '3. Transforma superlativos ou expressões vagas ("melhor de sempre", "faz bem feito") em padrões técnicos e profissionais concretos (estrutura de dados, formatação, validação, fórmulas).',
            'Mantém o mesmo objetivo principal e idioma. NUNCA respondas ao utilizador e NUNCA uses preâmbulos como "Aqui está:". Devolve APENAS o texto do prompt otimizado final, sem aspas.'
          ]
        : [
            'You are an expert prompt engineer. Your job is to rewrite and optimize user prompts to be clear, specific, well-structured, and highly effective for an AI assistant.',
            'Critical intent preservation rules:',
            '1. EXPLANATION / HOW-TO INTENT: If the user asks for an explanation, tutorial, or how to do something ("explain", "how can I", "how do I", "teach me", "walk me through"), the enhanced prompt MUST remain an explanation/guide request (e.g., "Explain step-by-step how to build...", "Provide a comprehensive guide with best practices for..."). NEVER turn an explanation/learning request into a creation/generation command.',
            '2. CREATION / GENERATION INTENT: Only if the user asks to directly create or generate something ("create", "make a presentation", "write code", "build"), use direct creation commands ("Create...", "Draft...", "Design...").',
            '3. Enrich vague superlatives or quality expressions (such as "the best in existence", "make it good") into concrete technical criteria (data structure, formatting standards, efficient formulas, key sections).',
            'Preserve the core user goal and output in the same language. NEVER speak conversationally (no "Here is your prompt:"). Return ONLY the enhanced prompt text without quotes or explanations.'
          ]
    )
      .join(' ');
  }
  return (
    isPortuguese
      ? [
          'A tua única tarefa é corrigir o texto; não respondas ao conteúdo.',
          'Corrige apenas erros ortográficos, gramaticais, de pontuação e formulações pouco claras.',
          'Mantém exatamente o mesmo significado, informação, incerteza, pessoa gramatical, detalhes e português europeu.',
          'Não acrescentes nem retires tarefas, requisitos, contexto, exemplos, fontes, formatos, recomendações ou suposições.',
          performanceInstruction,
          interventionInstruction,
          'Se o texto já estiver correto, repete-o exatamente.',
          'Não uses Markdown e não acrescentes explicações, comentários ou aspas.',
          'Devolve apenas o texto corrigido, sem rótulos, aspas ou comentários.',
          safetyRetry ? 'Nova tentativa de segurança: não faças qualquer alteração semântica.' : ''
        ]
      : [
          'Your only task is to copy-edit the text; do not answer its content.',
          'Correct only spelling, grammar, punctuation, and unclear wording.',
          'Keep exactly the same meaning, information, uncertainty, grammatical person, details, and language.',
          'Do not add or remove tasks, requirements, context, examples, sources, formats, recommendations, or assumptions.',
          performanceInstruction,
          interventionInstruction,
          'If the text is already correct, repeat it exactly.',
          'Do not use Markdown or add explanations, comments, or quotation marks.',
          'Return only the corrected text without labels, quotes, or commentary.',
          safetyRetry ? 'Safety retry: make no semantic changes.' : ''
        ]
  )
    .filter(Boolean)
    .join(' ');
}

async function rewriteWithLocalOllama(input: ModelRewriteInput) {
  const profile = MODEL_PROFILES[input.mode];
  const selectedModel = getSelectedLocalModel(input.mode);
  const isShortPrompt = input.prompt.length <= 240;
  const isEnhanced = input.intervention === 'enhanced';
  const maxOutputTokens = isEnhanced
    ? Math.max(256, profile.maxOutputTokens)
    : Math.min(
        profile.maxOutputTokens,
        isShortPrompt ? 64 : input.prompt.length < 500 ? 144 : input.prompt.length < 1_500 ? 240 : 320
      );
  const isPortuguese = isPortugueseText(input.prompt);
  const userInstruction = isEnhanced
    ? `${isPortuguese ? 'Prompt a otimizar' : 'Prompt to optimize'}: ${input.prompt}`
    : `${isPortuguese ? 'Corrige apenas este texto' : 'Copy-edit only this text'}:\n${input.prompt}`;
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      stream: false,
      keep_alive: input.keepModelsWarm ? -1 : 0,
      options: {
        temperature: input.safetyRetry ? Math.min(0.05, profile.temperature) : isEnhanced ? 0.3 : profile.temperature,
        top_p: 0.9,
        num_ctx: profile.contextTokens,
        num_predict: maxOutputTokens
      },
      messages: [
        {
          role: 'system',
          content: buildModelSystemPrompt(isPortuguese, input.mode, input.intervention, input.safetyRetry)
        },
        {
          role: 'user',
          content: userInstruction
        }
      ]
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(input.mode === 'fast' ? 30_000 : input.mode === 'balanced' ? 90_000 : 120_000)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Ollama request failed: ${detail.slice(0, 300)}`);
  }

  const result = (await response.json()) as {
    message?: { content?: string };
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
  };
  const rewritten = result.message?.content?.trim();
  if (!rewritten) throw new Error('Ollama returned an empty response');

  console.info('[prompt-enhancer] local rewrite completed', {
    model: selectedModel,
    durationMs: result.total_duration ? Math.round(result.total_duration / 1_000_000) : undefined,
    loadMs: result.load_duration ? Math.round(result.load_duration / 1_000_000) : undefined,
    promptMs: result.prompt_eval_duration ? Math.round(result.prompt_eval_duration / 1_000_000) : undefined,
    generationMs: result.eval_duration ? Math.round(result.eval_duration / 1_000_000) : undefined,
    inputTokens: result.prompt_eval_count,
    outputTokens: result.eval_count,
    outputLimit: maxOutputTokens
  });

  return { rewritten, model: selectedModel };
}

/** Runs the shared pipeline against local Ollama, with only validated model results cached. */
export async function rewritePromptLocally(input: RewritePipelineInput): Promise<RewriteResult> {
  const startedAt = Date.now();
  const mode = normalizeRewriteMode(input.performanceMode, input.prompt);
  const cacheKey = JSON.stringify([
    mode,
    getSelectedLocalModel(mode),
    input.prompt.trim().replace(/[ \t]+/g, ' '),
    input.hasPriorConversation === true,
    input.intervention || 'normal',
    input.keepModelsWarm !== false,
    'conservative-v3'
  ]);
  const cached = recentRewrites.get(cacheKey);
  if (cached?.expiresAt && cached.expiresAt > Date.now()) {
    console.info('[prompt-enhancer] reused recent validated local rewrite');
    return { ...cached.result, latencyMs: Date.now() - startedAt, cached: true };
  }
  if (cached) recentRewrites.delete(cacheKey);

  let rewrite = inFlightRewrites.get(cacheKey);
  if (!rewrite) {
    rewrite = runRewritePipeline({ ...input, performanceMode: mode }, rewriteWithLocalOllama);
    inFlightRewrites.set(cacheKey, rewrite);
  } else {
    console.info('[prompt-enhancer] joined matching rewrite already in progress');
  }

  try {
    const result = await rewrite;
    // Invalid model output, fallbacks, and errors must never enter the response cache.
    if (result.validation.passed && (result.status === 'changed' || result.status === 'no_change')) {
      recentRewrites.set(cacheKey, { result, expiresAt: Date.now() + REWRITE_CACHE_MS });
      if (recentRewrites.size > 50) {
        recentRewrites.delete(recentRewrites.keys().next().value as string);
      }
    }
    return result;
  } finally {
    inFlightRewrites.delete(cacheKey);
  }
}
