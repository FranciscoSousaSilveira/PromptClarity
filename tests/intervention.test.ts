import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REWRITE_INTERVENTION,
  isRewriteIntervention,
  type RewriteIntervention
} from '../config/product';
import { buildModelSystemPrompt } from '../lib/localRewriteService';
import { normalizeRewriteIntervention, runRewritePipeline } from '../lib/rewritePipeline';
import { validateModelRewrite } from '../lib/rewriteValidator';

const INTERVENTIONS: RewriteIntervention[] = ['strict', 'normal', 'polished'];

describe('rewrite intervention configuration', () => {
  it('defaults to normal', () => {
    expect(DEFAULT_REWRITE_INTERVENTION).toBe('normal');
    expect(normalizeRewriteIntervention(undefined)).toBe('normal');
    expect(normalizeRewriteIntervention('unsupported')).toBe('normal');
  });

  it.each(INTERVENTIONS)('recognizes %s as a valid intervention', (intervention) => {
    expect(isRewriteIntervention(intervention)).toBe(true);
    expect(normalizeRewriteIntervention(intervention)).toBe(intervention);
  });

  it.each(INTERVENTIONS)('includes %s in every normalized pipeline response', async (intervention) => {
    const original = 'Explica este erro.';
    const result = await runRewritePipeline({ prompt: original, intervention }, async () => ({
      rewritten: original
    }));
    expect(result.intervention).toBe(intervention);
  });
});

describe('intervention-aware model instructions', () => {
  it('constructs strict surface-only instructions with a separate performance profile', () => {
    const prompt = buildModelSystemPrompt(true, 'fast', 'strict', false);
    expect(prompt).toContain('Perfil de desempenho: fast');
    expect(prompt).toContain('Intervenção estrita');
    expect(prompt).toContain('evita reformular');
    expect(prompt).toContain('Não uses Markdown');
  });

  it('constructs normal conservative clarity instructions', () => {
    const prompt = buildModelSystemPrompt(false, 'balanced', 'normal', false);
    expect(prompt).toContain('Performance profile: balanced');
    expect(prompt).toContain('Normal intervention');
    expect(prompt).toContain('improve clarity conservatively');
  });

  it('constructs polished fluency instructions without relaxing semantic safety', () => {
    const prompt = buildModelSystemPrompt(false, 'quality', 'polished', true);
    const portuguesePrompt = buildModelSystemPrompt(true, 'quality', 'polished', false);
    expect(prompt).toContain('Performance profile: quality');
    expect(prompt).toContain('Polished intervention');
    expect(prompt).toContain('improve fluency');
    expect(prompt).toContain('uncertainty markers');
    expect(prompt).toContain('Never turn uncertainty into certainty');
    expect(prompt).toContain('I think');
    expect(prompt).toContain('might');
    expect(prompt).toContain('Do not add or remove tasks');
    expect(prompt).toContain('Safety retry');
    expect(portuguesePrompt).toContain('Nunca transformes incerteza em certeza');
    expect(portuguesePrompt).toContain('“acho”');
    expect(portuguesePrompt).toContain('“provavelmente”');
  });
});

describe('intervention-aware validation', () => {
  const original = 'ajuda me com este codigo acho que n ta a funcionar';

  it('accepts a minimal surface correction in strict mode', () => {
    expect(
      validateModelRewrite(original, 'Ajuda-me com este código. Acho que não está a funcionar.', 'strict')
    ).toEqual({ passed: true, reason: 'model_output_valid' });
  });

  it('accepts a safe smoother formulation in polished mode', () => {
    expect(
      validateModelRewrite(
        original,
        'Ajuda-me a perceber porque é que este código parece não estar a funcionar.',
        'polished'
      )
    ).toEqual({ passed: true, reason: 'model_output_valid' });
  });

  it('requires higher lexical similarity in strict than polished mode', () => {
    const polished = 'Ajuda-me a perceber porque é que este código parece não estar a funcionar.';
    expect(validateModelRewrite(original, polished, 'strict').passed).toBe(false);
    expect(validateModelRewrite(original, polished, 'polished').passed).toBe(true);
  });

  it.each(INTERVENTIONS)('rejects added tasks and tools in %s mode', (intervention) => {
    expect(
      validateModelRewrite(
        'ajuda me com este codigo',
        'Analisa este código, identifica bugs, propõe melhorias de performance e escreve testes unitários.',
        intervention
      ).passed
    ).toBe(false);
  });

  it.each(INTERVENTIONS)('rejects semantic expansion in %s mode', (intervention) => {
    expect(
      validateModelRewrite(
        'explica tcp reno',
        'Explica TCP Reno com exemplos, fórmulas, diagramas e casos práticos.',
        intervention
      ).passed
    ).toBe(false);
  });

  it.each(INTERVENTIONS)('rejects language shifts in %s mode', (intervention) => {
    expect(
      validateModelRewrite(
        'explica isto em português de portugal',
        'Explain this in European Portuguese.',
        intervention
      ).passed
    ).toBe(false);
  });

  it('rejects removal of uncertainty in polished mode', () => {
    expect(validateModelRewrite('acho que isto pode estar errado', 'Isto está errado.', 'polished')).toEqual({
      passed: false,
      reason: 'uncertainty_changed'
    });
  });

  it.each([
    {
      name: 'Portuguese acho',
      original: 'acho que este código não está a funcionar',
      rewritten: 'Este código não está a funcionar.'
    },
    {
      name: 'Portuguese parece',
      original: 'parece que isto está errado',
      rewritten: 'Isto está errado.'
    },
    {
      name: 'Portuguese talvez',
      original: 'talvez esta solução esteja mal',
      rewritten: 'Esta solução está mal.'
    },
    {
      name: 'English I think',
      original: 'I think this code is broken',
      rewritten: 'This code is broken.'
    }
  ])('preserves uncertainty for $name in every intervention', ({ original, rewritten }) => {
    for (const intervention of INTERVENTIONS) {
      expect(validateModelRewrite(original, rewritten, intervention)).toEqual({
        passed: false,
        reason: 'uncertainty_changed'
      });
    }
  });

  it('accepts an equivalent uncertainty marker in polished mode', () => {
    expect(
      validateModelRewrite(
        'ajuda me com este codigo acho que n ta a funcionar',
        'Ajuda-me a perceber porque é que este código parece não estar a funcionar.',
        'polished'
      )
    ).toEqual({ passed: true, reason: 'model_output_valid' });
  });
});
