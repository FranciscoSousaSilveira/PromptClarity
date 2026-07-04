import { describe, expect, it } from 'vitest';
import {
  buildVscodeTooMuchFeedbackEntry,
  describeVscodeRewritePresentation
} from '../lib/vscodePresentation';

describe('VS Code rewrite presentation', () => {
  it('maps no-change, changed, fallback, and error states', () => {
    const noChange = describeVscodeRewritePresentation({
      original: 'Explain photosynthesis in simple terms.',
      rewritten: 'Explain photosynthesis in simple terms.',
      status: 'no_change',
      source: 'checkmark',
      mode: 'fast'
    });

    const changed = describeVscodeRewritePresentation({
      original: 'diz me mais nomes brincalhoes',
      rewritten: 'Diz-me mais nomes brincalhões.',
      status: 'changed',
      source: 'model',
      mode: 'balanced',
      intervention: 'polished'
    });

    const fallback = describeVscodeRewritePresentation({
      original: 'quem e jfk',
      rewritten: 'Quem e jfk',
      status: 'fallback',
      source: 'local_fallback',
      mode: 'quality',
      validationReason: 'assistant_preface'
    });

    const error = describeVscodeRewritePresentation({
      original: 'explica este erro',
      rewritten: 'explica este erro',
      status: 'error',
      source: 'error',
      mode: 'fast',
      error: 'Local service unavailable'
    });

    expect(noChange.title).toBe('Prompt checked');
    expect(noChange.canInsert).toBe(true);
    expect(noChange.copyText).toBe('Explain photosynthesis in simple terms.');

    expect(changed.status).toBe('changed');
    expect(changed.validationReasonText).toContain('Local correction');
    expect(changed.intervention).toBe('polished');

    expect(fallback.source).toBe('local_fallback');
    expect(fallback.message).toContain('safe local correction');

    expect(error.canInsert).toBe(false);
    expect(error.copyText).toBe('explica este erro');
    expect(error.validationReasonText).toContain('Local rewrite unavailable');
  });

  it('defaults missing intervention to normal and keeps Too much local-only', () => {
    const presentation = describeVscodeRewritePresentation({
      original: 'Olá mundo',
      rewritten: 'Olá mundo',
      status: 'changed',
      source: 'model',
      mode: 'quality',
      validationReason: '   '
    });

    const feedback = buildVscodeTooMuchFeedbackEntry({
      original: 'Olá mundo',
      rewritten: 'Olá mundo',
      source: 'model',
      status: 'changed',
      mode: 'quality',
      intervention: presentation.intervention,
      validationReason: null,
      timestamp: new Date().toISOString(),
      reason: 'user_too_much'
    });

    expect(presentation.intervention).toBe('normal');
    expect(feedback.surface).toBe('vscode');
    expect(feedback.reason).toBe('user_too_much');
  });
});