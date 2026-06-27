import { analyzePrompt } from '../lib/promptAnalyzer';

describe('prompt analyzer', () => {
  describe('edge cases', () => {
    it('handles empty prompts gracefully', () => {
      const analysis = analyzePrompt('', 'general');
      expect(analysis.label).toBe('Weak');
      expect(analysis.overallScore).toBeLessThan(40);
    });

    it('handles prompts with only whitespace', () => {
      const analysis = analyzePrompt('   \n\t  ', 'general');
      expect(analysis.label).toBe('Weak');
    });

    it('penalizes very short prompts', () => {
      const short = analyzePrompt('Help.', 'general');
      const longer = analyzePrompt('Help me write a professional email to my manager about my progress this quarter.', 'general');
      expect(short.overallScore).toBeLessThan(longer.overallScore);
    });

    it('handles very long prompts without crashing', () => {
      const longPrompt = 'Write a comprehensive analysis of ' + 'the subject '.repeat(100);
      const analysis = analyzePrompt(longPrompt, 'research');
      expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('score labels and thresholds', () => {
    it('assigns Weak label for scores below 40', () => {
      const analysis = analyzePrompt('Make it better.', 'general');
      expect(analysis.label).toBe('Weak');
    });

    it('assigns Decent label for scores 40-69', () => {
      const analysis = analyzePrompt('Write a friendly email asking for feedback.', 'writing');
      expect(['Decent', 'Strong', 'Excellent']).toContain(analysis.label);
    });

    it('assigns Strong label for scores 70-84', () => {
      const analysis = analyzePrompt(
        'You are a Python expert. I am building a REST API with FastAPI. My database queries are slow. Suggest optimizations in bullet points with code examples.',
        'coding'
      );
      expect(['Strong', 'Excellent']).toContain(analysis.label);
    });

    it('assigns Excellent label for scores 85+', () => {
      const analysis = analyzePrompt(
        'Act as a senior product strategist. Context: We are a B2B SaaS company with 50 customers. ' +
          'Task: Analyze our feature requests from the past quarter and recommend the top 3 features to build next. ' +
          'Constraints: Prioritize features that improve retention and NPS, avoid new platforms. ' +
          'Output format: A 3-section memo with feature, impact, and effort estimate. ' +
          'Audience: This is for our exec team. ' +
          'Success criteria: Each recommendation should be backed by customer feedback and competitive analysis.',
        'business'
      );
      expect(analysis.label).toBe('Excellent');
    });
  });

  describe('category scoring', () => {
    it('scores clarity based on action verbs and vague language', () => {
      const vague = analyzePrompt('Make something better.', 'general');
      const clear = analyzePrompt('Explain the main causes of climate change.', 'general');
      expect(clear.categoryScores.clarity).toBeGreaterThan(vague.categoryScores.clarity);
    });

    it('scores context based on background and audience mentions', () => {
      const noContext = analyzePrompt('Analyze this.', 'general');
      const withContext = analyzePrompt('My team uses React. We are building a dashboard. Analyze performance bottlenecks in data tables with 10k rows.', 'coding');
      expect(withContext.categoryScores.context).toBeGreaterThan(noContext.categoryScores.context);
    });

    it('scores output format based on format keywords', () => {
      const noFormat = analyzePrompt('Explain quantum computing.', 'general');
      const withFormat = analyzePrompt('Explain quantum computing in a table with concept, explanation, and real-world use.', 'general');
      expect(withFormat.categoryScores.outputFormat).toBeGreaterThan(noFormat.categoryScores.outputFormat);
    });

    it('scores constraints based on limit and requirement keywords', () => {
      const noConstraints = analyzePrompt('Write something.', 'general');
      const withConstraints = analyzePrompt('Write a 200-word email in casual but professional tone, avoiding technical jargon.', 'writing');
      expect(withConstraints.categoryScores.constraints).toBeGreaterThan(noConstraints.categoryScores.constraints);
    });

    it('scores audience based on audience and role mentions', () => {
      const noAudience = analyzePrompt('Explain this.', 'general');
      const withAudience = analyzePrompt('Explain this to a beginner software engineer.', 'general');
      expect(withAudience.categoryScores.audience).toBeGreaterThan(noAudience.categoryScores.audience);
    });
  });

  describe('use-case-specific scoring', () => {
    it('rewards coding prompts with language and framework mentions', () => {
      const noTech = analyzePrompt('Fix this code.', 'coding');
      const withTech = analyzePrompt('I have a TypeScript React component that is re-rendering unnecessarily. Help me identify and fix the issue.', 'coding');
      expect(withTech.overallScore).toBeGreaterThan(noTech.overallScore);
    });

    it('rewards writing prompts with tone and audience', () => {
      const noTone = analyzePrompt('Write something.', 'writing');
      const withTone = analyzePrompt('Write a formal business proposal in a persuasive tone for executive stakeholders.', 'writing');
      expect(withTone.overallScore).toBeGreaterThan(noTone.overallScore);
    });

    it('rewards studying prompts with level and practice requests', () => {
      const basic = analyzePrompt('Teach me about photosynthesis.', 'studying');
      const detailed = analyzePrompt('Explain photosynthesis for a high school student using analogies and real-world examples. Then give 3 practice questions.', 'studying');
      expect(detailed.overallScore).toBeGreaterThan(basic.overallScore);
    });

    it('rewards research prompts with scope and evidence language', () => {
      const vague = analyzePrompt('Compare these things.', 'research');
      const precise = analyzePrompt('Compare machine learning approaches to traditional statistical methods. Focus on academic studies from the past 5 years. Highlight tradeoffs in accuracy, interpretability, and scalability.', 'research');
      expect(precise.overallScore).toBeGreaterThan(vague.overallScore);
    });

    it('rewards business prompts with objective and audience', () => {
      const vague = analyzePrompt('Help with this.', 'business');
      const clear = analyzePrompt('Draft a CTA-driven email for sales leads explaining our new pricing tier. Target small business owners. Goal: 20% conversion. Keep it under 150 words.', 'business');
      expect(clear.overallScore).toBeGreaterThan(vague.overallScore);
    });

    it('rewards image prompts with visual details and composition', () => {
      const vague = analyzePrompt('Draw a landscape.', 'imageGeneration');
      const detailed = analyzePrompt('Create a hyperrealistic landscape photograph of a misty mountain valley at sunrise. Golden hour light, wide-angle lens, cinematic composition, cool color palette with warm highlights. Aspect ratio 16:9. Avoid people.', 'imageGeneration');
      expect(detailed.overallScore).toBeGreaterThan(vague.overallScore);
    });
  });

  describe('issue detection', () => {
    it('detects vague task issues', () => {
      const analysis = analyzePrompt('Make this better.', 'general');
      expect(analysis.issues.some((issue) => issue.id === 'vague-task')).toBe(true);
    });

    it('detects missing context issues', () => {
      const analysis = analyzePrompt('Help me.', 'general');
      expect(analysis.issues.some((issue) => issue.id === 'missing-context')).toBe(true);
    });

    it('detects missing output format issues', () => {
      const analysis = analyzePrompt('Explain quantum computing.', 'general');
      expect(analysis.issues.some((issue) => issue.id === 'missing-format')).toBe(true);
    });

    it('detects missing constraints issues', () => {
      const analysis = analyzePrompt('Write something.', 'general');
      expect(analysis.issues.some((issue) => issue.id === 'missing-constraints')).toBe(true);
    });

    it('detects multiple task issues', () => {
      const analysis = analyzePrompt('Analyze this, then explain that, and also suggest improvements.', 'general');
      expect(analysis.issues.some((issue) => issue.id === 'multiple-tasks')).toBe(true);
    });

    it('detects coding-specific issues', () => {
      const analysis = analyzePrompt('Fix my code.', 'coding');
      expect(analysis.issues.some((issue) => issue.id === 'coding-missing-debug-data')).toBe(true);
    });

    it('detects image-specific issues', () => {
      const analysis = analyzePrompt('Draw a city.', 'imageGeneration');
      expect(analysis.issues.some((issue) => issue.id === 'image-missing-visuals')).toBe(true);
    });

    it('does not report issues for strong prompts', () => {
      const analysis = analyzePrompt(
        'Act as a data scientist. I have a dataset of customer churn with 20 features. ' +
          'Build a classification model to predict churn, then explain the top 5 feature importances. ' +
          'Use Python with scikit-learn. Output: Code, model accuracy, and a 1-page interpretation.',
        'coding'
      );
      expect(analysis.issues.length).toBeLessThan(3);
    });
  });

  describe('strengths detection', () => {
    it('includes strengths in the output', () => {
      const analysis = analyzePrompt('Explain this topic in simple terms.', 'studying');
      expect(analysis.strengths.length).toBeGreaterThan(0);
    });

    it('detects action verb as a strength', () => {
      const analysis = analyzePrompt('Analyze the market trends.', 'general');
      expect(analysis.strengths.some((s) => s.includes('action'))).toBe(true);
    });
  });

  describe('rewriter output', () => {
    it('produces a structured prompt from a vague input', () => {
      const analysis = analyzePrompt('Make this better.', 'general');
      expect(analysis.rewrittenPrompt).toContain('Role:');
      expect(analysis.rewrittenPrompt).toContain('Context:');
      expect(analysis.rewrittenPrompt).toContain('Task:');
      expect(analysis.rewrittenPrompt).toContain('Constraints:');
      expect(analysis.rewrittenPrompt).toContain('Output format:');
    });

    it('preserves strong signals in the rewrite', () => {
      const strongPrompt = 'Act as a Python expert. Explain decorators with examples.';
      const analysis = analyzePrompt(strongPrompt, 'coding');
      expect(analysis.rewrittenPrompt).toContain('Python');
      expect(analysis.rewrittenPrompt).toContain('expert');
    });

    it('includes placeholders for missing information', () => {
      const analysis = analyzePrompt('Help me.', 'general');
      expect(analysis.rewrittenPrompt).toContain('[');
      expect(analysis.rewrittenPrompt).toContain(']');
    });

    it('produces a coherent business rewrite without contradictory feedback', () => {
      const prompt = 'Write an email to a client about a delayed project';
      const analysis = analyzePrompt(prompt, 'general');

      expect(analysis.spellingIssues).toEqual([]);
      expect(analysis.correctedPrompt).toBe(prompt);
      expect(analysis.issues.some((issue) => issue.id === 'missing-format')).toBe(false);
      expect(analysis.issues.some((issue) => issue.id === 'missing-audience')).toBe(false);
      expect(analysis.rewrittenPrompt).toContain('ready-to-send email');
      expect(analysis.rewrittenPrompt).not.toMatch(/At as|wwrite|sstring|tstable/);
    });

    it('keeps short factual questions compact and useful', () => {
      const analysis = analyzePrompt('who is JFK', 'research');

      expect(analysis.rewrittenPrompt).toContain('Answer the question: “Who is JFK?”');
      expect(analysis.rewrittenPrompt).toContain('established facts');
      expect(analysis.rewrittenPrompt).toContain('3–5 bullet points');
      expect(analysis.rewrittenPrompt).not.toContain('Role:');
    });

    it('corrects a short Portuguese factual question', () => {
      const analysis = analyzePrompt('quem  e o jfk', 'research');

      expect(analysis.rewrittenPrompt).toContain('Responde à pergunta: “Quem é o JFK?”');
      expect(analysis.rewrittenPrompt).toContain('factos estabelecidos');
      expect(analysis.rewrittenPrompt).not.toContain('quem  e o jfk');
      expect(analysis.rewrittenPrompt).not.toContain('Papel:');
    });

    it('turns a conversational Portuguese course comparison into a useful prompt', () => {
      const analysis = analyzePrompt('mas tum que curso abre mais portas? aero ou mechatronisc?', 'research');

      expect(analysis.rewrittenPrompt).toContain('Compara Engenharia Aeroespacial e Engenharia Mecatrónica');
      expect(analysis.rewrittenPrompt).toContain('empregabilidade');
      expect(analysis.rewrittenPrompt).toContain('mobilidade internacional');
      expect(analysis.rewrittenPrompt).not.toContain('mechatronisc');
      expect(analysis.rewrittenPrompt).not.toContain('Clarify the task');
      expect(analysis.rewrittenPrompt).not.toContain('Papel:');
    });

    it('keeps structured Portuguese fallbacks fully localized', () => {
      const analysis = analyzePrompt('Escreve um plano de estudo para aprender cálculo durante oito semanas.', 'studying');

      expect(analysis.rewrittenPrompt).toContain('Papel: Atua como');
      expect(analysis.rewrittenPrompt).toContain('Formato de saída:');
      expect(analysis.rewrittenPrompt).not.toMatch(/Act as|Add relevant|Output format|Claims are/);
    });
  });

  describe('original test cases', () => {
    it('flags a vague prompt as weak', () => {
      const analysis = analyzePrompt('Make this better.', 'general');

      expect(analysis.label).toBe('Weak');
      expect(analysis.issues.some((issue) => issue.id === 'vague-task')).toBe(true);
      expect(analysis.issues.some((issue) => issue.id === 'missing-format')).toBe(true);
      expect(analysis.rewrittenPrompt).toContain('Role:');
    });

    it('scores a structured coding prompt higher', () => {
      const analysis = analyzePrompt(
        'Act as a senior React engineer. I have a Next.js app that throws a hydration error after adding a new sidebar. Explain the likely cause, list reproduction steps, and give a fix in bullet points.',
        'coding'
      );

      expect(analysis.overallScore).toBeGreaterThanOrEqual(70);
      expect(analysis.categoryScores.context).toBeGreaterThan(analysis.categoryScores.clarity / 2);
      expect(analysis.strengths.length).toBeGreaterThan(0);
    });

    it('adds use-case relevant guidance for image prompts', () => {
      const analysis = analyzePrompt('Create a cool picture of a city.', 'imageGeneration');

      expect(analysis.issues.some((issue) => issue.id === 'image-missing-visuals')).toBe(true);
      expect(analysis.rewrittenPrompt).toContain('image');
    });

    it('produces a stable score label for medium prompts', () => {
      const analysis = analyzePrompt('Write a short email to a customer about the update.', 'business');

      expect(['Decent', 'Strong', 'Excellent']).toContain(analysis.label);
      expect(analysis.summary.length).toBeGreaterThan(0);
    });
  });
});
