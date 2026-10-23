/**
 * Prompt enhancement and quality improvement
 * Applies tactical improvements to raise prompt quality towards 70%+ while preserving intent
 */

import type { CategoryKey } from '../types/prompt';

export function enhancePromptQuality(prompt: string, categoryScores: Record<CategoryKey, number>): string {
  let enhanced = prompt.trim();

  // Identify weak categories
  const weakCategories = Object.entries(categoryScores)
    .filter(([, score]) => score < 60)
    .map(([category]) => category as CategoryKey);

  // Apply targeted improvements based on weak categories
  for (const category of weakCategories) {
    enhanced = applyImprovementForCategory(enhanced, category);
  }

  return enhanced;
}

function applyImprovementForCategory(prompt: string, category: CategoryKey): string {
  switch (category) {
    case 'clarity':
      return improveClarity(prompt);

    case 'context':
      return improveContext(prompt);

    case 'goal':
      return improveGoal(prompt);

    case 'constraints':
      return improveConstraints(prompt);

    case 'outputFormat':
      return improveOutputFormat(prompt);

    case 'examples':
      return improveExamples(prompt);

    case 'audience':
      return improveAudience(prompt);

    case 'successCriteria':
      return improveSuccessCriteria(prompt);

    default:
      return prompt;
  }
}

/**
 * Improve clarity by replacing vague terms with specific ones
 * Returns enhanced prompt with brief explanation of changes
 */
function improveClarity(prompt: string): string {
  const vagueReplacements: Record<string, string> = {
    '\\bvague\\b': 'specific', // English
    '\\bsorta\\b': 'rather',
    '\\bkinda\\b': 'somewhat',
    '\\bnice\\b': 'excellent',
    '\\bgood\\b': 'excellent', // context dependent
    '\\bbetter\\b': 'improved',
    '\\bstuff\\b': 'items',
    '\\bthings\\b': 'items',
    '\\bidea\\b': 'concept',
    '\\bmaybe\\b': 'possibly',
    '\\bprobably\\b': 'likely',
    '\\bbasically\\b': 'fundamentally',
    // Portuguese replacements
    '\\bvago\\b': 'específico',
    '\\bcoisa\\b': 'elemento',
    '\\bcoisas\\b': 'elementos',
    '\\balgo\\b': 'algo específico',
    '\\bmelhor\\b': 'excelente',
    '\\bbom\\b': 'excelente',
    '\\btalvez\\b': 'possivelmente',
    '\\bprovavelmente\\b': 'muito provavelmente'
  };

  let improved = prompt;
  const replacementsMade: string[] = [];
  
  for (const [vague, specific] of Object.entries(vagueReplacements)) {
    const regex = new RegExp(vague, 'gi');
    if (regex.test(improved)) {
      improved = improved.replace(regex, specific);
      replacementsMade.push(`${vague} → ${specific}`);
    }
  }

  if (replacementsMade.length > 0) {
    return improved + ' (Clarity improved: ' + replacementsMade.join(', ') + ')';
  }

  return improved;
}

/**
 * Improve context by adding situational context if missing
 * Returns enhanced prompt with brief explanation of changes
 */
function improveContext(prompt: string): string {
  // Check if context is missing (prompt doesn't mention background/situation)
  const contextIndicators = [
    'context',
    'background',
    'situation',
    'scenario',
    'project',
    'currently',
    'working',
    'building',
    'need',
    'trying',
    'reason',
    'because',
    'contexto',
    'situação',
    'projeto',
    'atualmente',
    'trabalhando',
    'construindo',
    'preciso',
    'razão',
    'porquê'
  ];

  const hasContext = contextIndicators.some((indicator) =>
    new RegExp(`\\b${indicator}\\b`, 'i').test(prompt)
  );

  // If no context and prompt is short, add context request
  if (!hasContext && prompt.length < 100) {
    return prompt + '. (Context improved: Consider what context or background might be relevant.)';
  }

  return prompt;
}

/**
 * Improve goal clarity by ensuring task is explicit
 * Returns enhanced prompt with brief explanation of changes
 */
function improveGoal(prompt: string): string {
  // Check if has clear action verb at start or early
  const actionVerbs = [
    'create',
    'write',
    'build',
    'analyze',
    'explain',
    'describe',
    'generate',
    'develop',
    'design',
    'implement',
    'review',
    'summarize',
    'fix',
    'criar',
    'escrever',
    'construir',
    'analisar',
    'explicar',
    'descrever',
    'gerar',
    'desenvolver',
    'projetar',
    'implementar',
    'revisar',
    'resumir',
    'corrigir'
  ];

  const startsWithAction = actionVerbs.some((verb) =>
    new RegExp(`^\\s*(please\\s+)?${verb}`, 'i').test(prompt)
  );

  // If doesn't start with clear action, prepend one
  if (!startsWithAction && !prompt.match(/^\s*(can you|could you|please|I need|preciso|pode|poderia)/i)) {
    // Infer what to do based on content
    if (prompt.match(/data|analyze|examine/i)) {
      return 'Analyze the following: ' + prompt + ' (Goal improved: Added explicit action verb for clarity)';
    } else if (prompt.match(/code|program|function|debug|fix/i)) {
      return 'Create or improve code for: ' + prompt + ' (Goal improved: Added explicit action verb for clarity)';
    } else if (prompt.match(/explain|describe|clarify/i)) {
      return 'Explain or describe: ' + prompt + ' (Goal improved: Added explicit action verb for clarity)';
    } else if (prompt.match(/write|compose|draft/i)) {
      return 'Write: ' + prompt + ' (Goal improved: Added explicit action verb for clarity)';
    } else {
      return 'Help with: ' + prompt + ' (Goal improved: Added explicit action verb for clarity)';
    }
  }

  return prompt;
}

/**
 * Improve constraints by adding important ones if missing
 * Returns enhanced prompt with brief explanation of changes
 */
function improveConstraints(prompt: string): string {
  // Check if has constraint keywords
  const constraintKeywords = [
    'must',
    'should',
    'cannot',
    'without',
    'limited',
    'avoid',
    'only',
    'except',
    'deve',
    'não deve',
    'evitar',
    'apenas',
    'exceto',
    'limitado',
    'sem'
  ];

  const hasConstraints = constraintKeywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(prompt));

  // If no constraints mentioned and prompt is vague, suggest adding them
  if (!hasConstraints && prompt.length < 150) {
    // This improves structure by reminding user to add constraints
    return prompt + ' (Constraints improved: Consider adding limitations or things to avoid)';
  }

  return prompt;
}

/**
 * Improve output format specification
 * Returns enhanced prompt with brief explanation of changes
 */
function improveOutputFormat(prompt: string): string {
  // Check if output format is specified
  const formatKeywords = [
    'format',
    'output',
    'return',
    'result',
    'as',
    'structure',
    'json',
    'table',
    'list',
    'paragraph',
    'bullets',
    'code',
    'steps',
    'markdown',
    'formato',
    'saída',
    'retorne',
    'resultado',
    'estrutura',
    'tabela',
    'lista',
    'parágrafo',
    'etapas',
    'markdown',
    'json'
  ];

  const hasFormat = formatKeywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(prompt));

  // If no format specified, add reminder
  if (!hasFormat) {
    return prompt + ' (Output format improved: Specify desired format like code, JSON, steps, or summary)';
  }

  return prompt;
}

/**
 * Improve by ensuring examples are mentioned
 * Returns enhanced prompt with brief explanation of changes
 */
function improveExamples(prompt: string): string {
  // Check if prompt mentions examples
  const exampleKeywords = [
    'example',
    'like',
    'such as',
    'for instance',
    'e.g.',
    'instance',
    'exemplo',
    'como',
    'por exemplo',
    'instância'
  ];

  const hasExamples = exampleKeywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(prompt));

  // If no examples and prompt seems to need clarity
  if (!hasExamples && prompt.length < 80) {
    return prompt + ' (Examples improved: Provide examples to clarify your intent)';
  }

  return prompt;
}

/**
 * Improve by clarifying audience/level
 * Returns enhanced prompt with brief explanation of changes
 */
function improveAudience(prompt: string): string {
  // Check if mentions intended audience/level
  const audienceKeywords = [
    'beginner',
    'intermediate',
    'advanced',
    'expert',
    'junior',
    'senior',
    'level',
    'audience',
    'for',
    'intended',
    'kids',
    'professionals',
    'iniciante',
    'intermediário',
    'avançado',
    'especialista',
    'nível',
    'público',
    'para',
    'profissionais',
    'técnico'
  ];

  const hasAudience = audienceKeywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(prompt));

  // If no audience mentioned, it's harder to judge quality
  if (!hasAudience && prompt.length < 120) {
    return prompt + ' (Audience improved: Specify audience level like beginner, intermediate, or advanced)';
  }

  return prompt;
}

/**
 * Improve by specifying success criteria
 * Returns enhanced prompt with brief explanation of changes
 */
function improveSuccessCriteria(prompt: string): string {
  // Check if mentions what success looks like
  const successKeywords = [
    'success',
    'criteria',
    'should',
    'must',
    'ensure',
    'verify',
    'check',
    'correct',
    'valid',
    'working',
    'meets',
    'satisfies',
    'achieves',
    'sucesso',
    'critério',
    'deve',
    'verifica',
    'válido',
    'funciona',
    'satisfaz',
    'atinge',
    'garante'
  ];

  const hasSuccessCriteria = successKeywords.some((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(prompt));

  // If vague about what good looks like
  if (!hasSuccessCriteria && prompt.length < 350) {
    return prompt + ' (Success criteria improved: Define what success looks like or how to measure it)';
  }

  return prompt;
}
