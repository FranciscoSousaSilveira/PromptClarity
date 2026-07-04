import { DEFAULT_REWRITE_INTERVENTION, type PerformanceMode, type RewriteIntervention } from '../config/product';
import { buildTooMuchFeedbackEntry, type TooMuchFeedbackEntry } from './popupState';
import type { RewriteSource, RewriteStatus } from '../types/rewrite';

export interface VscodeRewritePresentationInput {
  original: string;
  rewritten: string;
  status: RewriteStatus;
  source: RewriteSource;
  mode: PerformanceMode;
  intervention?: RewriteIntervention;
  validationReason?: string | null;
  error?: string | null;
}

export interface VscodeRewritePresentation {
  status: RewriteStatus;
  title: string;
  subtitle: string;
  message: string;
  originalLabel: string;
  rewrittenLabel: string;
  copyLabel: string;
  insertLabel: string;
  canInsert: boolean;
  canCopy: boolean;
  copyText: string;
  intervention: RewriteIntervention;
  validationReasonText: string | null;
  source: RewriteSource;
}

function normalizeReason(reason: string | null | undefined): string | null {
  if (typeof reason !== 'string') return null;
  const normalized = reason.trim();
  return normalized.length > 0 ? normalized : null;
}

export function describeVscodeRewritePresentation(input: VscodeRewritePresentationInput): VscodeRewritePresentation {
  const intervention = input.intervention || DEFAULT_REWRITE_INTERVENTION;
  const reason = normalizeReason(input.validationReason);
  const copyText = input.status === 'error' ? input.original : input.rewritten;

  if (input.status === 'no_change') {
    return {
      status: 'no_change',
      title: 'Prompt checked',
      subtitle: 'No changes needed',
      message: 'The local rewrite kept your prompt unchanged.',
      originalLabel: 'Original prompt',
      rewrittenLabel: 'Same text',
      copyLabel: 'Copy Original',
      insertLabel: 'Insert Original',
      canInsert: true,
      canCopy: true,
      copyText,
      intervention,
      validationReasonText: 'No changes were needed',
      source: 'checkmark'
    };
  }

  if (input.status === 'changed') {
    return {
      status: 'changed',
      title: 'Corrected prompt',
      subtitle: 'Conservative local correction',
      message: 'The corrected prompt keeps the original intent and stays local.',
      originalLabel: 'Original prompt',
      rewrittenLabel: 'Corrected prompt',
      copyLabel: 'Copy',
      insertLabel: 'Insert',
      canInsert: true,
      canCopy: true,
      copyText,
      intervention,
      validationReasonText: reason || 'Local correction applied',
      source: input.source
    };
  }

  if (input.status === 'fallback') {
    return {
      status: 'fallback',
      title: 'Conservative local correction',
      subtitle: 'Safe local fallback used',
      message: input.error
        ? 'The model response was rejected, so a safe local correction was used instead.'
        : 'A safe local correction was used to keep your prompt local.',
      originalLabel: 'Original prompt',
      rewrittenLabel: 'Fallback rewrite',
      copyLabel: 'Copy',
      insertLabel: 'Insert',
      canInsert: true,
      canCopy: true,
      copyText,
      intervention,
      validationReasonText: reason || 'Conservative local fallback used',
      source: 'local_fallback'
    };
  }

  return {
    status: 'error',
    title: 'Local rewrite unavailable',
    subtitle: 'Your text stayed local',
    message: input.error || 'The local service is unavailable right now.',
    originalLabel: 'Original prompt',
    rewrittenLabel: 'Unavailable',
    copyLabel: 'Copy Original',
    insertLabel: 'Insert',
    canInsert: false,
    canCopy: true,
    copyText,
    intervention,
    validationReasonText: reason || 'Local rewrite unavailable',
    source: 'error'
  };
}

export function buildVscodeTooMuchFeedbackEntry(
  input: Omit<TooMuchFeedbackEntry, 'surface'> & { surface?: never }
) {
  return buildTooMuchFeedbackEntry({ ...input, surface: 'vscode' });
}
