import { type PerformanceMode, type RewriteIntervention } from '../config/product';
import { type TooMuchFeedbackEntry } from './popupState';
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
export declare function describeVscodeRewritePresentation(input: VscodeRewritePresentationInput): VscodeRewritePresentation;
export declare function buildVscodeTooMuchFeedbackEntry(input: Omit<TooMuchFeedbackEntry, 'surface'> & {
    surface?: never;
}): TooMuchFeedbackEntry;
//# sourceMappingURL=vscodePresentation.d.ts.map