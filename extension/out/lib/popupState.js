"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeRewritePresentation = describeRewritePresentation;
exports.buildTooMuchFeedbackEntry = buildTooMuchFeedbackEntry;
const product_1 = require("../config/product");
function normalizeValidationReason(reason) {
    if (typeof reason !== 'string')
        return null;
    const normalized = reason.trim();
    return normalized.length > 0 ? normalized : null;
}
function describeValidationReason(status, reason) {
    if (status === 'no_change')
        return 'No changes were needed';
    if (status === 'changed')
        return 'Conservative local correction applied';
    if (status === 'fallback') {
        return reason ? `Conservative fallback used · ${reason}` : 'Conservative fallback used';
    }
    if (status === 'error') {
        return reason ? `Local rewrite unavailable · ${reason}` : 'Local rewrite unavailable';
    }
    return reason;
}
function describeRewritePresentation(input) {
    const intervention = input.intervention || product_1.DEFAULT_REWRITE_INTERVENTION;
    const validationReason = normalizeValidationReason(input.validationReason);
    if (input.status === 'no_change') {
        return {
            kind: 'no_change',
            title: 'Prompt checked',
            subtitle: 'No changes were needed',
            message: 'The prompt already reads clearly, so the local rewrite kept it as-is.',
            originalLabel: 'Original prompt',
            rewrittenLabel: 'Same text',
            showComparison: true,
            showInsert: true,
            showCheckmark: true,
            feedbackSource: 'checkmark',
            intervention,
            validationReasonText: describeValidationReason(input.status, validationReason)
        };
    }
    if (input.status === 'changed') {
        return {
            kind: 'changed',
            title: 'Corrected prompt',
            subtitle: 'Conservative local correction ready',
            message: 'The corrected prompt keeps the original intent and wording as close as possible.',
            originalLabel: 'Original',
            rewrittenLabel: 'Corrected',
            showComparison: true,
            showInsert: true,
            showCheckmark: false,
            feedbackSource: input.source === 'model' ? 'model' : 'local_fallback',
            intervention,
            validationReasonText: describeValidationReason(input.status, validationReason)
        };
    }
    if (input.status === 'fallback') {
        return {
            kind: 'fallback',
            title: 'Conservative local correction',
            subtitle: 'A safe local fallback was used',
            message: input.error
                ? 'The model response was not usable, so a local correction was kept instead.'
                : 'The local rewrite used a safe fallback and kept the prompt local.',
            originalLabel: 'Original',
            rewrittenLabel: 'Fallback rewrite',
            showComparison: true,
            showInsert: true,
            showCheckmark: false,
            feedbackSource: 'local_fallback',
            intervention,
            validationReasonText: describeValidationReason(input.status, validationReason)
        };
    }
    return {
        kind: 'error',
        title: 'Local rewrite unavailable',
        subtitle: 'Your text stayed on this device',
        message: input.error || 'The local service is unavailable right now. You can still copy the original text.',
        originalLabel: 'Original',
        rewrittenLabel: 'Unavailable',
        showComparison: false,
        showInsert: false,
        showCheckmark: false,
        feedbackSource: 'error',
        intervention,
        validationReasonText: describeValidationReason(input.status, validationReason)
    };
}
function buildTooMuchFeedbackEntry(input) {
    const intervention = input.intervention || product_1.DEFAULT_REWRITE_INTERVENTION;
    const validationReason = normalizeValidationReason(input.validationReason);
    return {
        original: input.original,
        rewritten: input.rewritten,
        source: input.status === 'changed'
            ? input.source === 'model'
                ? 'model'
                : 'local_fallback'
            : input.status === 'no_change'
                ? 'checkmark'
                : input.status === 'fallback'
                    ? 'local_fallback'
                    : 'error',
        status: input.status,
        mode: input.mode,
        intervention,
        validationReason,
        timestamp: new Date().toISOString(),
        reason: 'user_too_much',
        surface: input.surface || 'unknown'
    };
}
//# sourceMappingURL=popupState.js.map