import { type PerformanceMode, type RewriteIntervention } from '../config/product';
import type { RewriteSource, RewriteStatus } from '../types/rewrite';
export type PopupSurface = 'chrome' | 'desktop' | 'vscode' | 'unknown';
export interface RewritePresentationInput {
    original: string;
    rewritten: string;
    status: RewriteStatus;
    source: RewriteSource;
    mode: PerformanceMode;
    intervention?: RewriteIntervention;
    validationReason?: string | null;
    error?: string | null;
}
export interface RewritePresentationState {
    kind: RewriteStatus;
    title: string;
    subtitle: string;
    message: string;
    originalLabel: string;
    rewrittenLabel: string;
    showComparison: boolean;
    showInsert: boolean;
    showCheckmark: boolean;
    feedbackSource: 'model' | 'local_fallback' | 'checkmark' | 'error';
    intervention: RewriteIntervention;
    validationReasonText: string | null;
}
export interface TooMuchFeedbackEntry {
    original: string;
    rewritten: string;
    source: 'model' | 'local_fallback' | 'checkmark' | 'error';
    status: RewriteStatus;
    mode: PerformanceMode;
    intervention: RewriteIntervention;
    validationReason: string | null;
    timestamp: string;
    reason: 'user_too_much';
    surface: PopupSurface;
}
export declare function describeRewritePresentation(input: RewritePresentationInput): RewritePresentationState;
export declare function buildTooMuchFeedbackEntry(input: RewritePresentationInput & {
    surface?: PopupSurface;
}): TooMuchFeedbackEntry;
//# sourceMappingURL=popupState.d.ts.map