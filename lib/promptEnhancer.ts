/**
 * Prompt enhancement and quality improvement
 * Applies tactical improvements to raise prompt quality towards 70%+ while preserving intent
 */

import type { CategoryKey } from '../types/prompt';

export function enhancePromptQuality(
  prompt: string,
  categoryScores: Record<CategoryKey, number>
): string {
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
  const lower = prompt.toLowerCase();

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
    '\\bprovavelmente\\b': 'muito provavelmente',
  };

  let improved = prompt;
  for (const [vague, specific] of Object.entries(vagueReplacements)) {
    improved = improved.replace(new RegExp(vague, 'gi'), specific);
  }

  return improved;
}

/**
 * Improve context by adding situational context if missing
 */
function improveContext(prompt: string): string {
  // Check if context is missing (prompt doesn't mention background/situation)
  const contextIndicators = [
    'context', 'background', 'situation', 'scenario', 'project', 'currently',
    'working', 'building', 'need', 'trying', 'reason', 'because',
    'contexto', 'situação', 'projeto', 'atualmente', 'trabalhando',
    'construindo', 'preciso', 'razão', 'porquê'
  ];

  const hasContext = contextIndicators.some(indicator =>
    new RegExp(`\\b${indicator}\\b`, 'i').test(prompt)
  );

  // If no context and prompt is short, add context request
  if (!hasContext && prompt.length < 100) {
    return prompt + '. Please consider what context or background might be relevant.';
  }

  return prompt;
}

/**
 * Improve goal clarity by ensuring task is explicit
 */
function improveGoal(prompt: string): string {
  // Check if has clear action verb at start or early
  const actionVerbs = [
    'create', 'write', 'build', 'analyze', 'explain', 'describe', 'generate',
    'develop', 'design', 'implement', 'review', 'summarize', 'fix',
    'criar', 'escrever', 'construir', 'analisar', 'explicar', 'descrever',
    'gerar', 'desenvolver', 'projetar', 'implementar', 'revisar', 'resumir', 'corrigir'
  ];

  const startsWithAction = actionVerbs.some(verb =>
    new RegExp(`^\\s*(please\\s+)?${verb}`, 'i').test(prompt)
  );

  // If doesn't start with clear action, prepend one
  if (!startsWithAction && !prompt.match(/^\s*(can you|could you|please|I need|preciso|pode|poderia)/i)) {
    // Infer what to do based on content
    if (prompt.match(/data|analyze|examine/i)) {
      return 'Analyze the following: ' + prompt;
    } else if (prompt.match(/code|program|function|debug|fix/i)) {
      return 'Create or improve code for: ' + prompt;
    } else if (prompt.match(/explain|describe|clarify/i)) {
      return 'Explain or describe: ' + prompt;
    } else if (prompt.match(/write|compose|draft/i)) {
      return 'Write: ' + prompt;
    } else {
      return 'Help with: ' + prompt;
    }
  }

  return prompt;
}

/**
 * Improve constraints by adding important ones if missing
 */
function improveConstraints(prompt: string): string {
  // Check if has constraint keywords
  const constraintKeywords = [
    'must', 'should', 'cannot', 'without', 'limited', 'avoid', 'only', 'except',
    'deve', 'não deve', 'evitar', 'apenas', 'exceto', 'limitado', 'sem'
  ];

  const hasConstraints = constraintKeywords.some(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(prompt)
  );

  // If no constraints mentioned and prompt is vague, suggest adding them
  if (!hasConstraints && prompt.length < 150) {
    // This improves structure by reminding user to add constraints
    return prompt + ' (Consider adding any constraints, limitations, or things to avoid)';
  }

  return prompt;
}

/**
 * Improve output format specification
 */
function improveOutputFormat(prompt: string): string {
  // Check if output format is specified
  const formatKeywords = [
    'format', 'output', 'return', 'result', 'as', 'structure', 'json', 'table',
    'list', 'paragraph', 'bullets', 'code', 'steps', 'markdown',
    'formato', 'saída', 'retorne', 'resultado', 'estrutura', 'tabela',
    'lista', 'parágrafo', 'etapas', 'markdown', 'json'
  ];

  const hasFormat = formatKeywords.some(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(prompt)
  );

  // If no format specified, add reminder
  if (!hasFormat) {
    return prompt + '. Please specify the desired output format (e.g., code, JSON, steps, summary).';
  }

  return prompt;
}

/**
 * Improve by ensuring examples are mentioned
 */
function improveExamples(prompt: string): string {
  // Check if prompt mentions examples
  const exampleKeywords = [
    'example', 'like', 'such as', 'for instance', 'e.g.', 'instance',
    'exemplo', 'como', 'por exemplo', 'instância'
  ];

  const hasExamples = exampleKeywords.some(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(prompt)
  );

  // If no examples and prompt seems to need clarity
  if (!hasExamples && prompt.length < 80) {
    return prompt + '. Please provide example(s) to clarify.';
  }

  return prompt;
}

/**
 * Improve by clarifying audience/level
 */
function improveAudience(prompt: string): string {
  // Check if mentions intended audience/level
  const audienceKeywords = [
    'beginner', 'intermediate', 'advanced', 'expert', 'junior', 'senior',
    'level', 'audience', 'for', 'intended', 'kids', 'professionals',
    'iniciante', 'intermediário', 'avançado', 'especialista', 'nível',
    'público', 'para', 'profissionais', 'técnico'
  ];

  const hasAudience = audienceKeywords.some(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(prompt)
  );

  // If no audience mentioned, it's harder to judge quality
  if (!hasAudience && prompt.length < 120) {
    return prompt + ' (for a general audience at an intermediate level)';
  }

  return prompt;
}

/**
 * Improve by specifying success criteria
 */
function improveSuccessCriteria(prompt: string): string {
  // Check if mentions what success looks like
  const successKeywords = [
    'success', 'criteria', 'should', 'must', 'ensure', 'verify', 'check',
    'correct', 'valid', 'working', 'meets', 'satisfies', 'achieves',
    'sucesso', 'critério', 'deve', 'verifica', 'válido', 'funciona',
    'satisfaz', 'atinge', 'garante'
  ];

  const hasSuccessCriteria = successKeywords.some(kw =>
    new RegExp(`\\b${kw}\\b`, 'i').test(prompt)
  );

  // If vague about what good looks like
  if (!hasSuccessCriteria && prompt.length < 350) {
    return prompt + ' How will we know this is successful?';
  }

  return prompt;
}
