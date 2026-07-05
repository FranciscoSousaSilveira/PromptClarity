import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTooMuchFeedbackEntry, describeRewritePresentation } from '../lib/popupState';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('popup presentation helpers', () => {
  it('describes a no-change rewrite as a checkmark state', () => {
    const state = describeRewritePresentation({
      original: 'Explain photosynthesis in simple terms.',
      rewritten: 'Explain photosynthesis in simple terms.',
      status: 'no_change',
      source: 'checkmark',
      mode: 'fast',
      validationReason: 'model_output_unchanged'
    });

    expect(state.kind).toBe('no_change');
    expect(state.showCheckmark).toBe(true);
    expect(state.showInsert).toBe(true);
    expect(state.subtitle).toContain('No changes were needed');
  });

  it('describes changed, fallback, and error states distinctly', () => {
    const changed = describeRewritePresentation({
      original: 'diz me mais nomes brincalhoes',
      rewritten: 'Diz-me mais nomes brincalhões.',
      status: 'changed',
      source: 'model',
      mode: 'fast',
      intervention: 'normal',
      validationReason: 'model_output_valid'
    });

    const fallback = describeRewritePresentation({
      original: 'quem e jfk',
      rewritten: 'Quem e jfk',
      status: 'fallback',
      source: 'local_fallback',
      mode: 'fast',
      validationReason: 'assistant_preface'
    });

    const error = describeRewritePresentation({
      original: 'explica este erro',
      rewritten: 'explica este erro',
      status: 'error',
      source: 'error',
      mode: 'balanced',
      validationReason: null,
      error: 'Local service is unavailable'
    });

    expect(changed.kind).toBe('changed');
    expect(changed.showComparison).toBe(true);
    expect(changed.showInsert).toBe(true);
    expect(changed.validationReasonText).toContain('Conservative local correction');

    expect(fallback.kind).toBe('fallback');
    expect(fallback.showComparison).toBe(true);
    expect(fallback.validationReasonText).toContain('assistant_preface');

    expect(error.kind).toBe('error');
    expect(error.showInsert).toBe(false);
    expect(error.message).toContain('Local service is unavailable');
  });

  it('defaults a missing intervention to normal and tolerates unknown validation reasons', () => {
    const state = describeRewritePresentation({
      original: 'Olá mundo',
      rewritten: 'Olá mundo',
      status: 'changed',
      source: 'model',
      mode: 'quality',
      validationReason: '   '
    });

    expect(state.intervention).toBe('normal');
    expect(state.validationReasonText).toBe('Conservative local correction applied');
  });

  it('builds a local-only too much feedback entry', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const entry = buildTooMuchFeedbackEntry({
      original: 'Explica o erro.',
      rewritten: 'Explica o erro.',
      status: 'fallback',
      source: 'local_fallback',
      mode: 'balanced',
      intervention: 'polished',
      validationReason: 'model_unavailable',
      surface: 'chrome'
    });

    expect(entry.reason).toBe('user_too_much');
    expect(entry.surface).toBe('chrome');
    expect(entry.status).toBe('fallback');
    expect(entry.source).toBe('local_fallback');
    expect(entry.validationReason).toBe('model_unavailable');
    expect(entry.timestamp).toEqual(expect.any(String));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
