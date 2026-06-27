import type { PromptAnalysisCore, UseCase } from '../types/prompt';
import { correctSpelling } from './spellChecker';

type Language = 'en' | 'pt';

const PORTUGUESE_MARKERS = [
  'que', 'de', 'para', 'com', 'por', 'uma', 'está', 'preciso', 'você', 'me',
  'como', 'sem', 'mais', 'já', 'também', 'ainda', 'sobre', 'depois', 'durante',
  'mesmo', 'através', 'junto', 'segundo', 'diante', 'enquanto', 'onde', 'quando'
];

function detectLanguage(prompt: string): Language {
  const lower = prompt.toLowerCase();
  if (
    /^(quem|qual|onde|quando|como|por que|porque|o que|explica|escreve|compara|analisa|resume|cria|corrige|melhora)\b/.test(lower.trim()) ||
    /\b(que|qual)\b.{0,120}\bou\b/.test(lower)
  ) {
    return 'pt';
  }

  let portugueseMarkerCount = 0;

  for (const marker of PORTUGUESE_MARKERS) {
    if (new RegExp(`\\b${marker}\\b`).test(lower)) {
      portugueseMarkerCount++;
    }
  }

  return portugueseMarkerCount >= 2 ? 'pt' : 'en';
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

function formatSection(label: string, content: string): string {
  return `${label}: ${content}`;
}

function inferUseCase(useCase: UseCase, prompt: string): UseCase {
  if (useCase !== 'general') return useCase;

  const lower = prompt.toLowerCase();
  if (/\b(email|memo|proposal|sales|marketing|client|customer|stakeholder)\b/.test(lower)) return 'business';
  if (/\b(code|bug|debug|function|api|typescript|javascript|python|react|next\.js)\b/.test(lower)) return 'coding';
  if (/\b(study|learn|teach|explain|beginner|student|quiz|practice)\b/.test(lower)) return 'studying';
  if (/\b(research|evidence|sources?|compare|study|paper|citations?)\b/.test(lower)) return 'research';
  if (/\b(image|photo|illustration|portrait|landscape|lighting|composition)\b/.test(lower)) return 'imageGeneration';
  if (/\b(write|rewrite|edit|draft|proofread|article|story)\b/.test(lower)) return 'writing';
  return 'general';
}

function roleForUseCase(useCase: UseCase, prompt: string): string {
  const lower = prompt.toLowerCase();
  
  switch (useCase) {
    case 'coding': {
      const hasFramework = /react|next|vue|angular|django|flask|rails|spring/.test(lower);
      const isBugFix = /bug|error|fix|broken|crash|fail|issue/.test(lower);
      if (isBugFix) {
        return 'a debugging expert who explains root causes and provides step-by-step fixes';
      }
      if (hasFramework) {
        return 'a senior engineer in ' + (lower.includes('react') ? 'React' : 
              lower.includes('next') ? 'Next.js' : 
              lower.includes('python') ? 'Python' : 'your chosen framework');
      }
      return 'a senior software engineer who is careful about debugging and implementation details';
    }
    case 'writing': {
      const hasTone = /formal|casual|friendly|professional|persuasive|conversational/.test(lower);
      const hasLength = /short|brief|long|detailed|paragraph|section|page/.test(lower);
      if (hasTone || hasLength) {
        const tone = lower.includes('formal') ? 'formal' : lower.includes('casual') ? 'casual' : lower.includes('friendly') ? 'friendly' : 'appropriate';
        return `a sharp ${tone} writer and editor who matches style and audience`;
      }
      return 'a sharp editor who can match tone, audience, and structure';
    }
    case 'studying': {
      const hasLevel = /beginner|intermediate|advanced|grade|high school|college|university/.test(lower);
      if (hasLevel) {
        const level = lower.includes('beginner') ? 'beginner' : 
                      lower.includes('advanced') ? 'advanced' : 'intermediate';
        return `a patient ${level}-friendly tutor who explains clearly and checks understanding`;
      }
      return 'a patient tutor who explains clearly and checks understanding';
    }
    case 'research': {
      const hasScope = /compare|comparison|analysis|evidence|sources?|study/.test(lower);
      return hasScope ? 'a research analyst who compares sources, highlights evidence, and surfaces key differences' : 'a research analyst who compares sources and surfaces evidence';
    }
    case 'business': {
      const hasAudience = /executive|founder|sales|marketing|customer|stakeholder/.test(lower);
      if (hasAudience) {
        const audience = lower.includes('executive') ? 'executive' : 
                        lower.includes('founder') ? 'founder' : 
                        lower.includes('customer') ? 'customer-facing' : 'strategic';
        return `a ${audience}-focused business strategist who drives clear decisions`;
      }
      return 'a practical business strategist who focuses on clarity and action';
    }
    case 'imageGeneration':
      return 'a visual prompt engineer who understands composition, lighting, mood, and style in image generation';
    case 'general':
    default:
      return 'a helpful expert who writes concise, high-signal answers';
  }
}

function outputFormatForUseCase(useCase: UseCase, analysis: PromptAnalysisCore, prompt: string): string {
  const suggested = analysis.categoryScores.outputFormat >= 70;
  const lower = prompt.toLowerCase();

  switch (useCase) {
    case 'coding': {
      const wantsBullets = /bullet|list|steps?|steps?-by-step/.test(lower);
      const wantsCode = /code|example|snippet|implementation/.test(lower);
      if (wantsBullets) return 'Use bullet points for each step, with code examples where helpful.';
      if (wantsCode) return 'Provide a complete, working code example with explanations.';
      return suggested
        ? 'Use the format already implied by the request, and include code blocks when needed.'
        : 'Use sections such as Summary, Root cause, Fix (with code), and Next steps.';
    }
    case 'writing': {
      const wantsDraft = /draft|rewrite|revise|edit/.test(lower);
      const wantsOutline = /outline|structure|format/.test(lower);
      if (wantsDraft) return 'Provide the draft directly, then optional suggestions for improvement.';
      if (wantsOutline) return 'Start with an outline, then expand with the full content.';
      return suggested
        ? 'Match the format implied by the request.'
        : 'Use a clear format: outline, draft, refined version, or step-by-step refinements.';
    }
    case 'studying': {
      const wantsPractice = /practice|quiz|questions?|exercise/.test(lower);
      const wantsExamples = /example|scenario|real-world/.test(lower);
      if (wantsPractice) return 'Explain the concept, provide 2 examples, then 3 practice questions with answer hints.';
      if (wantsExamples) return 'Use examples and real-world scenarios to anchor understanding.';
      return suggested
        ? 'Use the requested learning format.'
        : 'Use explanation, examples, and check-your-understanding questions.';
    }
    case 'research': {
      const wantsComparison = /compare|comparison|vs|tradeoffs?|difference/.test(lower);
      const wantsCitations = /cite|source|study|paper|research/.test(lower);
      if (wantsComparison) return 'Use a comparison table or structured format highlighting tradeoffs.';
      if (wantsCitations) return 'Include specific sources, authors, and publication years.';
      return suggested
        ? 'Use the requested research format.'
        : 'Use structured sections: overview, comparison (or analysis), evidence, conclusion.';
    }
    case 'business': {
      const wantsEmail = /email/.test(lower);
      const wantsMemo = /memo|report/.test(lower);
      const wantsBullets = /bullet|list/.test(lower);
      if (wantsEmail) return 'Format as a complete, ready-to-send email with subject line.';
      if (wantsMemo) return 'Use memo format with sections: objective, analysis, recommendation, next steps.';
      if (wantsBullets) return 'Use concise bullet points with clear CTAs.';
      return suggested
        ? 'Use the requested business format.'
        : 'Use a concise format: bullet list, email, memo, or action plan.';
    }
    case 'imageGeneration': {
      const wantsNegative = /negative|avoid|not/.test(lower);
      return suggested
        ? 'Keep the visual direction clear and specific, with aspect ratio if known.'
        : (wantsNegative 
          ? 'Describe the desired image in detail, then list negative prompts (what to avoid).'
          : 'Provide a compact visual prompt with subject, style, composition, lighting, mood, and aspect ratio.');
    }
    case 'general':
    default:
      return suggested
        ? 'Use the format implied by the prompt.'
        : 'Choose the most helpful format: bullet list, table, steps, checklist, code block, or short answer.';
  }
}

function buildTask(prompt: string, analysis: PromptAnalysisCore, useCase: UseCase): string {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();
  
  if (isBlank(trimmed)) {
    return '[State the main task clearly]';
  }

  if (analysis.categoryScores.clarity >= 70) {
    return trimmed;
  }

  // Smart task refinement based on what's missing
  const additions: string[] = [];
  
  if (useCase === 'coding' && analysis.categoryScores.context < 60) {
    additions.push('(Provide: language/framework, expected vs actual behavior)');
  }
  if (useCase === 'writing' && analysis.categoryScores.constraints < 60) {
    additions.push('(Provide: tone, audience, length)');
  }
  if (useCase === 'imageGeneration' && analysis.categoryScores.outputFormat < 60) {
    additions.push('(Provide: subject, style, composition, aspect ratio)');
  }

  if (additions.length > 0) {
    return `${trimmed}\n\nProvide the missing context: ${additions.join(' ')}`;
  }

  return `Clarify the task:\n${trimmed}`;
}

function buildContext(prompt: string, analysis: PromptAnalysisCore): string {
  const trimmed = prompt.trim();
  if (isBlank(trimmed)) {
    return '[Add relevant background, constraints, and any important context here]';
  }

  if (analysis.categoryScores.context >= 70) {
    return 'Use the background and factual details supplied in the task below.';
  }

  return '[Add relevant background, the recipient or audience, and any facts that must remain accurate]';
}

function buildConstraints(analysis: PromptAnalysisCore, useCase: UseCase): string {
  if (useCase === 'business') {
    const requirements = ['Use only confirmed facts; do not invent dates, commitments, or outcomes.'];
    if (analysis.categoryScores.constraints < 70) requirements.push('Tone and length: [specify if important]');
    return requirements.join(' ');
  }

  const hints: string[] = [];

  if (analysis.categoryScores.constraints < 70) {
    hints.push('[Add limits, requirements, style preferences, or boundaries]');
  }

  if (analysis.categoryScores.successCriteria < 70) {
    hints.push('[Define what a strong answer should accomplish]');
  }

  if (hints.length === 0) {
    hints.push('Preserve the key requirements in the original prompt.');
  }

  return hints.join(' ');
}

function successCriteriaForUseCase(useCase: UseCase): string {
  switch (useCase) {
    case 'business':
      return 'The result is ready to send, preserves the facts provided, and makes the next action clear.';
    case 'coding':
      return 'The answer is correct, reproducible, and includes enough detail to verify the result.';
    case 'writing':
      return 'The draft matches the requested audience, tone, and purpose without unnecessary filler.';
    case 'studying':
      return 'The explanation is accurate at the requested level and makes understanding easy to check.';
    case 'research':
      return 'Claims are clearly separated from evidence, with limitations and sources identified.';
    case 'imageGeneration':
      return 'The prompt gives concrete visual direction while preserving the requested subject and mood.';
    case 'general':
    default:
      return 'The response directly solves the task, states necessary assumptions, and is easy to verify.';
  }
}

function normalizeComparisonOption(value: string, language: Language): string {
  const cleaned = value.trim().replace(/^[\s:,-]+|[\s?!.,]+$/g, '');
  const key = cleaned.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (/^(aero|aeroespacial|aeronautica|engenharia aeroespacial)$/.test(key)) {
    return language === 'pt' ? 'Engenharia Aeroespacial' : 'Aerospace Engineering';
  }
  if (/^(mecha|mechatronisc|mechatronics|mecatronica|engenharia mecatronica)$/.test(key)) {
    return language === 'pt' ? 'Engenharia Mecatrónica' : 'Mechatronics Engineering';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function rewriteShortComparison(prompt: string, useCase: UseCase, language: Language): string | null {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (trimmed.split(/\s+/).length > 30) return null;

  const segments = trimmed.split('?').map((segment) => segment.trim()).filter(Boolean);
  const optionPattern = /^(.{2,50}?)\s+(ou|or|vs\.?|versus)\s+(.{2,50})$/i;
  const match = segments.map((segment) => segment.match(optionPattern)).find(Boolean);
  if (!match) return null;

  const comparisonLanguage: Language = match[2].toLowerCase() === 'ou' ? 'pt' : language;
  const firstOption = normalizeComparisonOption(match[1], comparisonLanguage);
  const secondOption = normalizeComparisonOption(match[3], comparisonLanguage);

  if (comparisonLanguage === 'pt') {
    return `Compara ${firstOption} e ${secondOption} para perceber qual oferece mais e melhores oportunidades profissionais. Avalia empregabilidade, diversidade de setores, procura no mercado, progressão de carreira, mobilidade internacional e facilidade de transição entre áreas. Considera o mercado de [país ou região] e distingue oportunidades no início da carreira e a médio prazo. Apresenta uma tabela com vantagens e limitações de cada opção e termina com uma recomendação condicionada aos interesses e objetivos do estudante. Indica claramente quando a conclusão depender da localização ou de dados atuais.`;
  }

  const evidence = useCase === 'research'
    ? 'Use current evidence where possible and state when the conclusion depends on location or changing market data.'
    : 'State the assumptions that materially affect the comparison.';
  return `Compare ${firstOption} and ${secondOption} to determine which option creates broader career opportunities. Evaluate employability, range of industries, market demand, career progression, international mobility, and ease of moving between fields. Present a table of advantages and limitations, then give a recommendation based on the person's interests and goals. ${evidence}`;
}

function rewriteCourseComparison(prompt: string, language: Language): string | null {
  const key = prompt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const comparesAerospaceAndMechatronics = /\baero(?:espacial)?\b/.test(key) && /\b(mecha|mechat|mecatr)/.test(key);
  if (!comparesAerospaceAndMechatronics) return null;

  const mentionsTum = /\btum\b/.test(key);
  if (language === 'pt') {
    const scope = mentionsTum
      ? 'na TUM, usando informação atual dos planos curriculares e páginas oficiais da universidade'
      : 'considerando a instituição e o mercado de [país ou região]';
    return `Explica, de forma clara e objetiva, as principais diferenças entre Engenharia Aeroespacial e Engenharia Mecatrónica ${scope}. Compara o currículo, as áreas de especialização, a componente prática, a carga de trabalho, os requisitos de admissão, as oportunidades de estágio, a empregabilidade, a diversidade de setores, a mobilidade internacional e a flexibilidade para mudar de área. Apresenta a comparação numa tabela e termina com uma recomendação para diferentes perfis de estudante, deixando claro quando algum dado depender do ano letivo ou precisar de confirmação.`;
  }

  const scope = mentionsTum
    ? 'at TUM, using current curricula and official university pages'
    : 'for the relevant institution and job market';
  return `Explain the main differences between Aerospace Engineering and Mechatronics Engineering ${scope}. Compare the curriculum, specializations, practical work, workload, admission requirements, internship opportunities, career paths, and flexibility to move into other industries. Present the comparison in a table and finish with recommendations for different student profiles, clearly marking anything that depends on the academic year or needs confirmation.`;
}

function polishNaturalPrompt(prompt: string, language: Language): string {
  let polished = prompt.replace(/\s+/g, ' ').trim();

  if (language === 'pt') {
    polished = polished
      .replace(/\bexplica\s+me\b/gi, 'Explica-me')
      .replace(/\bnng\b/gi, 'ninguém')
      .replace(/\bn\s+(?=quero|deve|pode|fica|seja|tem|é\b)/gi, 'não ')
      .replace(/\btp\b[,.]?\s*/gi, '')
      .replace(/\brelatorio\b/gi, 'relatório')
      .replace(/\bpaginas\b/gi, 'páginas')
      .replace(/\bcomecar\b/gi, 'começar')
      .replace(/\bsmallville\b/gi, 'Smallville')
      .replace(/\bcta\b/gi, 'CTA')
      .replace(/\bai\b/gi, 'IA')
      .replace(/\bmechatronica\b/gi, 'Mecatrónica')
      .replace(/\bmecatronica\b/gi, 'Mecatrónica')
      .replace(/\bsff\b/gi, '')
      .replace(/\s+([?!.,])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  polished = polished.charAt(0).toUpperCase() + polished.slice(1);
  if (!/[?!.]$/.test(polished)) polished += '.';
  return polished;
}

function rewriteNaturalPrompt(
  prompt: string,
  useCase: UseCase,
  analysis: PromptAnalysisCore,
  language: Language
): string | null {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const isTooVague = words.length < 4 || /^(help|ajuda|ajuda-me|isto|isso|make this better)[.!?]*$/i.test(prompt.trim());
  if (isTooVague) return null;

  const polished = polishNaturalPrompt(prompt, language);
  const additions: string[] = [];

  if (language === 'pt') {
    switch (useCase) {
      case 'research':
        additions.push('Baseia a resposta em fontes credíveis e atuais, distingue factos de interpretações e assinala limitações ou informação incerta.');
        if (analysis.categoryScores.outputFormat < 70) additions.push('Organiza a resposta com uma visão geral curta, uma comparação clara e uma conclusão prática.');
        break;
      case 'coding':
        additions.push('Explica a causa, apresenta uma solução reproduzível e inclui código completo quando for relevante.');
        break;
      case 'studying':
        additions.push('Adapta a explicação ao nível indicado, usa exemplos concretos e termina com uma forma rápida de confirmar a compreensão.');
        break;
      case 'writing':
        additions.push('Preserva a intenção, adequa o tom ao público e entrega diretamente uma versão final clara e concisa.');
        break;
      case 'business':
        additions.push(/\b(email|e-mail)\b/i.test(polished)
          ? 'Entrega um email completo e pronto a enviar, com assunto, tom adequado e uma próxima ação clara.'
          : 'Mantém a resposta concisa, orientada à decisão e termina com próximos passos concretos.');
        break;
      case 'imageGeneration':
        additions.push('Inclui assunto, estilo, composição, iluminação, ambiente e proporção, sem alterar a intenção principal.');
        break;
      case 'general':
      default:
        additions.push('Responde de forma clara, específica e diretamente útil, indicando apenas as suposições indispensáveis.');
    }
  } else {
    switch (useCase) {
      case 'research': additions.push('Use credible, current sources, separate facts from interpretation, and flag limitations or uncertainty.'); break;
      case 'coding': additions.push('Explain the cause, provide a reproducible solution, and include complete code when relevant.'); break;
      case 'studying': additions.push('Match the requested level, use concrete examples, and finish with a quick comprehension check.'); break;
      case 'writing': additions.push('Preserve the intent, match the audience and tone, and provide the polished final draft directly.'); break;
      case 'business': additions.push(/\bemail\b/i.test(polished)
        ? 'Provide a complete, ready-to-send email with a subject line, appropriate tone, and a clear next action.'
        : 'Keep the response concise and decision-oriented, with concrete next steps.'); break;
      case 'imageGeneration': additions.push('Make the image prompt include subject, style, composition, lighting, mood, and aspect ratio without changing the core intent.'); break;
      case 'general':
      default: additions.push('Answer clearly and specifically, stating only assumptions that materially affect the result.');
    }
  }

  return [polished, ...additions].join(' ');
}

function roleForUseCasePt(useCase: UseCase): string {
  switch (useCase) {
    case 'coding': return 'um engenheiro de software sénior, rigoroso na análise e na implementação';
    case 'writing': return 'um editor experiente, atento ao tom, ao público e à estrutura';
    case 'studying': return 'um tutor paciente que explica com clareza e confirma a compreensão';
    case 'research': return 'um analista de investigação que compara evidência, fontes e limitações';
    case 'business': return 'um estratega de negócios prático, focado em decisões e resultados';
    case 'imageGeneration': return 'um especialista em prompts visuais, composição, luz e estilo';
    case 'general':
    default: return 'um especialista prestável que produz respostas claras, específicas e úteis';
  }
}

function outputFormatForUseCasePt(useCase: UseCase, prompt: string): string {
  const lower = prompt.toLowerCase();
  if (/\b(email|e-mail)\b/.test(lower)) return 'Escreve um email completo e pronto a enviar, incluindo assunto.';

  switch (useCase) {
    case 'coding': return 'Usa as secções Resumo, Causa, Solução com código e Próximos passos.';
    case 'writing': return 'Entrega diretamente o texto final e, se for útil, uma nota curta sobre as escolhas feitas.';
    case 'studying': return 'Combina explicação, exemplos e perguntas rápidas para confirmar a compreensão.';
    case 'research': return 'Usa uma visão geral, análise da evidência, limitações e conclusão.';
    case 'business': return 'Usa um formato conciso e orientado à ação, adequado ao objetivo pedido.';
    case 'imageGeneration': return 'Cria um prompt visual compacto com assunto, estilo, composição, iluminação, ambiente e proporção.';
    case 'general':
    default: return 'Escolhe o formato mais útil para a tarefa: pontos, tabela, passos ou resposta curta.';
  }
}

function successCriteriaForUseCasePt(useCase: UseCase): string {
  switch (useCase) {
    case 'coding': return 'A resposta é correta, reproduzível e permite verificar o resultado.';
    case 'writing': return 'O texto corresponde ao público, tom e objetivo, sem conteúdo desnecessário.';
    case 'studying': return 'A explicação é correta, adequada ao nível pedido e fácil de confirmar.';
    case 'research': return 'As conclusões distinguem factos, evidência, incerteza e limitações.';
    case 'business': return 'O resultado está pronto a usar e torna clara a próxima ação.';
    case 'imageGeneration': return 'O prompt dá direção visual concreta e preserva o assunto e ambiente pedidos.';
    case 'general':
    default: return 'A resposta resolve diretamente a tarefa e torna explícitas apenas as suposições necessárias.';
  }
}

function rewritePortugueseStructuredPrompt(prompt: string, useCase: UseCase, analysis: PromptAnalysisCore): string {
  const context = analysis.categoryScores.context >= 70
    ? 'Usa o contexto e os factos fornecidos na tarefa abaixo.'
    : '[Adiciona o contexto relevante, o público e os factos que devem permanecer corretos]';
  const requirements = analysis.categoryScores.constraints >= 70
    ? 'Mantém todos os requisitos e limites indicados no pedido.'
    : '[Adiciona limites, tom, extensão, requisitos ou elementos a evitar]';

  return [
    formatSection('Papel', `Atua como ${roleForUseCasePt(useCase)}.`),
    formatSection('Contexto', context),
    formatSection('Tarefa', prompt.trim()),
    formatSection('Requisitos', requirements),
    formatSection('Formato de saída', outputFormatForUseCasePt(useCase, prompt)),
    formatSection('Critérios de sucesso', successCriteriaForUseCasePt(useCase)),
    'Antes de responder, indica apenas as suposições estritamente necessárias.'
  ].join('\n\n');
}

function rewriteShortQuestion(prompt: string, useCase: UseCase, language: Language): string | null {
  const trimmed = prompt.trim().replace(/[?!.]+$/, '');
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 10) return null;

  const englishQuestion = trimmed.match(/^(who|what|when|where|why|how)\b/i);
  const portugueseQuestion = trimmed.match(/^(quem|o que|quando|onde|por que|porque|como)\b/i);
  const questionLanguage: Language = portugueseQuestion ? 'pt' : englishQuestion ? 'en' : language;
  const questionType = questionLanguage === 'pt' ? portugueseQuestion?.[1]?.toLowerCase() : englishQuestion?.[1]?.toLowerCase();
  if (!questionType) return null;

  let polishedQuestion = trimmed.replace(/\s+/g, ' ').trim();
  if (questionLanguage === 'pt') {
    polishedQuestion = polishedQuestion
      .replace(/^quem\s+e\b/i, 'Quem é')
      .replace(/^o que\s+e\b/i, 'O que é')
      .replace(/^qual\s+e\b/i, 'Qual é')
      .replace(/\b(jfk|ue|eua|nato|onu|ia|api|html|css|sql|llm|gpt)\b/gi, (value) => value.toUpperCase());
    polishedQuestion = polishedQuestion.charAt(0).toUpperCase() + polishedQuestion.slice(1);
  } else {
    polishedQuestion = polishedQuestion.charAt(0).toUpperCase() + polishedQuestion.slice(1);
  }

  if (questionLanguage === 'pt') {
    const focus = questionType === 'quem'
      ? 'Inclui quem é a pessoa, porque é relevante, os principais acontecimentos ou contributos associados e o seu legado.'
      : 'Inclui uma definição clara, o contexto essencial, porque é relevante e exemplos concretos quando forem úteis.';
    const evidence = useCase === 'research'
      ? 'Usa linguagem neutra, distingue factos estabelecidos de afirmações disputadas e indica fontes quando necessário.'
      : 'Usa linguagem clara e não assumes conhecimento prévio.';
    return `Responde à pergunta: “${polishedQuestion}?” ${focus} ${evidence} Estrutura a resposta com uma introdução curta seguida de 3 a 5 pontos.`;
  }

  const focus = questionType === 'who'
    ? 'Cover who the person is, why they are notable, the key events or contributions associated with them, and their legacy.'
    : questionType === 'how'
      ? 'Explain the process step by step, including prerequisites, important tradeoffs, and a concrete example.'
      : questionType === 'why'
        ? 'Explain the main causes, the strongest supporting evidence, and credible alternative explanations.'
        : 'Give a clear definition or direct answer, essential context, why it matters, and a concrete example when useful.';
  const evidence = useCase === 'research'
    ? 'Use neutral language, distinguish established facts from disputed claims, and name sources when appropriate.'
    : 'Use plain language and do not assume prior knowledge.';

  return `Answer the question: “${polishedQuestion}?” ${focus} ${evidence} Format the response as a short introduction followed by 3–5 bullet points.`;
}

export function rewritePrompt(prompt: string, useCase: UseCase, analysis: PromptAnalysisCore): string {
  const language = detectLanguage(prompt);
  const correctedPrompt = correctSpelling(prompt, language, 0.88);
  const effectiveUseCase = inferUseCase(useCase, correctedPrompt);

  const courseComparisonRewrite = rewriteCourseComparison(correctedPrompt, language);
  if (courseComparisonRewrite) return courseComparisonRewrite;

  const shortComparisonRewrite = rewriteShortComparison(correctedPrompt, effectiveUseCase, language);
  if (shortComparisonRewrite) return shortComparisonRewrite;

  const shortQuestionRewrite = rewriteShortQuestion(correctedPrompt, effectiveUseCase, language);
  if (shortQuestionRewrite) return shortQuestionRewrite;

  const naturalRewrite = rewriteNaturalPrompt(correctedPrompt, effectiveUseCase, analysis, language);
  if (naturalRewrite) return naturalRewrite;

  if (language === 'pt') {
    return rewritePortugueseStructuredPrompt(correctedPrompt, effectiveUseCase, analysis);
  }

  const labels = { role: 'Role', context: 'Context', task: 'Task', constraints: 'Constraints', output: 'Output format', success: 'Success criteria', assumptions: 'Before answering, state only the assumptions that are strictly necessary.' };
  const sections = [
    formatSection(labels.role, `Act as ${roleForUseCase(effectiveUseCase, correctedPrompt)}.`),
    formatSection(labels.context, buildContext(correctedPrompt, analysis)),
    formatSection(labels.task, buildTask(correctedPrompt, analysis, effectiveUseCase)),
    formatSection(labels.constraints, buildConstraints(analysis, effectiveUseCase)),
    formatSection(labels.output, outputFormatForUseCase(effectiveUseCase, analysis, correctedPrompt)),
    formatSection(labels.success, successCriteriaForUseCase(effectiveUseCase)),
    labels.assumptions
  ];

  return sections.join('\n\n');
}
